import { Injectable } from '@nestjs/common'
import { Queue, Worker } from 'bullmq'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import IORedis from 'ioredis'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const VENV_PYTHON = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
const PYTHON_BIN =
	process.env.PYTHON_BIN ?? (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python')
const PYTHON_SCRIPT = path.join(process.cwd(), 'python', 'inpaint_sd.py')
const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS ?? 300000)
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379'
const RENDER_QUEUE_NAME = process.env.RENDER_QUEUE_NAME ?? 'render-queue'
const RENDER_CONCURRENCY = Math.max(
	1,
	Number(process.env.RENDER_CONCURRENCY ?? 1),
)
const RENDER_RESULT_TTL_MS = Math.max(
	10000,
	Number(process.env.RENDER_RESULT_TTL_MS ?? 300000),
)

export interface RenderRequest {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
	textureUrl?: string
}

type RenderJob = {
	request: RenderRequest
	jobKey: string
}

@Injectable()
export class RenderService {
	private readonly redis: IORedis
	private readonly queue: Queue<RenderJob, { renderedUrl: string }>
	private readonly worker: Worker<RenderJob, { renderedUrl: string }>

	constructor() {
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true })
		}
		this.redis = new IORedis(REDIS_URL, {
			maxRetriesPerRequest: null,
			enableReadyCheck: false,
		})
		this.queue = new Queue(RENDER_QUEUE_NAME, {
			connection: this.redis,
		})
		this.queue.setMaxListeners(0)
		this.worker = new Worker(
			RENDER_QUEUE_NAME,
			async (job) => this.executeJob(job.data.request, job.data.jobKey),
			{
				connection: this.redis,
				concurrency: RENDER_CONCURRENCY,
			},
		)
	}

	async render(
		request: RenderRequest,
		originKey = 'unknown',
	): Promise<{ renderedUrl?: string; jobId?: string }> {
		const requestKey = this.getRequestKey(request, originKey)
		const outName = this.getOutName(request, requestKey)
		const outPath = path.join(CACHE_DIR, outName)
		if (fs.existsSync(outPath)) {
			return { renderedUrl: `/cache/${outName}` }
		}
		const job = await this.queue.add(
			'render',
			{ request, jobKey: requestKey },
			{
				jobId: requestKey,
				removeOnComplete: {
					age: Math.ceil(RENDER_RESULT_TTL_MS / 1000),
				},
				removeOnFail: {
					age: Math.ceil(RENDER_RESULT_TTL_MS / 1000),
				},
			},
		)
		return { jobId: job.id ?? requestKey }
	}

	async getRenderStatus(jobId: string): Promise<{
		status: 'queued' | 'active' | 'completed' | 'failed' | 'missing'
		renderedUrl?: string
	}> {
		const job = await this.queue.getJob(jobId)
		if (job) {
			const outName = this.getOutName(job.data.request, jobId)
			const outPath = path.join(CACHE_DIR, outName)
			if (fs.existsSync(outPath)) {
				return { status: 'completed', renderedUrl: `/cache/${outName}` }
			}
			const state = await job.getState()
			if (state === 'active') return { status: 'active' }
			if (state === 'completed')
				return { status: 'completed', renderedUrl: `/cache/${outName}` }
			if (state === 'failed') return { status: 'failed' }
			return { status: 'queued' }
		}
		const suffix = `-${jobId}-rendered.png`
		const match = fs
			.readdirSync(CACHE_DIR)
			.find((entry) => entry.endsWith(suffix))
		if (match) {
			return { status: 'completed', renderedUrl: `/cache/${match}` }
		}
		return { status: 'missing' }
	}

	private async executeJob(
		request: RenderRequest,
		jobKey?: string,
	): Promise<{ renderedUrl: string }> {
		const safeKey = jobKey ?? this.getRequestKey(request, 'local')
		const imagePath = path.join(process.cwd(), request.imageUrl.replace(/^\//, ''))
		const maskPath = path.join(process.cwd(), request.maskUrl.replace(/^\//, ''))
		const texturePath = request.textureUrl
			? path.join(process.cwd(), request.textureUrl.replace(/^\//, ''))
			: null
		if (!fs.existsSync(imagePath)) {
			throw new Error(`Image not found: ${imagePath}`)
		}
		if (!fs.existsSync(maskPath)) {
			throw new Error(`Mask not found: ${maskPath}`)
		}
		if (texturePath && !fs.existsSync(texturePath)) {
			throw new Error(`Texture not found: ${texturePath}`)
		}
		const outName = this.getOutName(request, safeKey)
		const outPath = path.join(CACHE_DIR, outName)
		if (fs.existsSync(outPath)) {
			const renderedUrl = `/cache/${outName}`
			return { renderedUrl }
		}
		await this.runPython(
			imagePath,
			maskPath,
			request.prompt,
			outPath,
			texturePath ?? undefined,
		)
		return { renderedUrl: `/cache/${outName}` }
	}

	private getRequestKey(request: RenderRequest, originKey: string) {
		const rawKey = [
			originKey,
			request.imageUrl,
			request.maskUrl,
			request.prompt,
			request.uploadId,
			request.label,
			request.textureUrl ?? '',
		].join('::')
		return createHash('sha256').update(rawKey).digest('hex')
	}

	private getOutName(request: RenderRequest, key: string) {
		return `${request.uploadId}-${request.label}-${key}-rendered.png`
			.replace(/\s+/g, '_')
			.slice(0, 200)
	}

	private async runPython(
		imagePath: string,
		maskPath: string,
		prompt: string,
		outPath: string,
		texturePath?: string,
	): Promise<void> {
		if (!fs.existsSync(PYTHON_SCRIPT)) {
			throw new Error(`Inpaint script missing: ${PYTHON_SCRIPT}`)
		}
		await new Promise<void>((resolve, reject) => {
			const args = [
				PYTHON_SCRIPT,
				'--image',
				imagePath,
				'--mask',
				maskPath,
				'--prompt',
				prompt,
				'--output',
				outPath,
			]
			if (texturePath) {
				args.push('--texture', texturePath)
			}
			const proc = spawn(
				PYTHON_BIN,
				args,
				{
					windowsHide: true,
					env: process.env,
				},
			)

			let stderr = ''
			const timeout = setTimeout(() => {
				try {
					proc.kill()
				} catch {
					// ignore
				}
				reject(new Error(`Inpaint timed out after ${PYTHON_TIMEOUT_MS}ms`))
			}, PYTHON_TIMEOUT_MS)

			proc.stderr.on('data', (buf) => {
				stderr += String(buf)
			})
			proc.on('error', (err) => {
				clearTimeout(timeout)
				reject(err)
			})
			proc.on('close', (code) => {
				clearTimeout(timeout)
				if (code !== 0) {
					reject(new Error(`Inpaint failed (exit ${code}). ${stderr.trim()}`))
					return
				}
				resolve()
			})
		})
	}
}
