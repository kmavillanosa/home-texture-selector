import { randomUUID } from 'crypto'
import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import type { DetectionResult } from '../common/types'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const CACHE_VERSION = 10
const CLEANUP_INTERVAL_MINUTES = Number(
	process.env.CLEANUP_INTERVAL_MINUTES ?? 30,
)
const CACHE_TTL_HOURS = Number(process.env.CACHE_TTL_HOURS ?? 24)

const USE_PYTHON_SEGMENTATION = true
const USE_SEGMENTATION_DAEMON =
	process.env.USE_SEGMENTATION_DAEMON?.toLowerCase() === 'true'
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python'
const PYTHON_SCRIPT = path.join(process.cwd(), 'python', 'segment_ade20k.py')
const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS ?? 120000)

type PythonResult = Pick<
	DetectionResult,
	'detections' | 'segmentationMapUrl' | 'segmentationLabels' | 'illuminationMapUrl'
>
type DaemonJob = {
	imagePath: string
	uploadId: string
	resolve: (value: PythonResult) => void
	reject: (reason: Error) => void
}
type CurrentJob = {
	resolve: (value: PythonResult) => void
	reject: (reason: Error) => void
	timeout: ReturnType<typeof setTimeout>
}

@Injectable()
export class SegmentService {
	private worker: ChildProcess | null = null
	private workerReady = false
	private stdoutBuffer = ''
	private pendingQueue: DaemonJob[] = []
	private currentJob: CurrentJob | null = null

	constructor() {
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true })
		}
		this.scheduleCleanup()
	}

	async segment(
		uploadId?: string,
		imageUrl?: string,
	): Promise<DetectionResult> {
		const id = uploadId ?? randomUUID()
		const imagePath = imageUrl
			? path.join(process.cwd(), imageUrl.replace(/^\//, ''))
			: null

		if (!imagePath || !fs.existsSync(imagePath)) {
			return { uploadId: id, detections: [] }
		}

		const cached = this.readCachedResult(id)
		if (cached) return cached

		try {
			const pythonResult = USE_PYTHON_SEGMENTATION
				? await this.runPythonSegmentation(imagePath, id)
				: { detections: [] }
			const result: DetectionResult = {
				uploadId: id,
				detections: pythonResult.detections,
				segmentationMapUrl: pythonResult.segmentationMapUrl,
				segmentationLabels: pythonResult.segmentationLabels,
				illuminationMapUrl: pythonResult.illuminationMapUrl,
			}
			this.writeCachedResult(id, result)
			return result
		} catch (err) {
			console.error('SegmentService.segment error', err)
			return {
				uploadId: id,
				detections: [],
				detectionFailed: true,
			}
		}
	}

	private async runPythonSegmentation(
		imagePath: string,
		uploadId: string,
	): Promise<PythonResult> {
		if (!fs.existsSync(PYTHON_SCRIPT)) {
			throw new Error(`Python segmentation script missing: ${PYTHON_SCRIPT}`)
		}
		if (USE_SEGMENTATION_DAEMON) {
			return this.runViaDaemon(imagePath, uploadId)
		}
		return this.runPythonOneShot(imagePath, uploadId)
	}

	/** Spawn per-request Python process (used when daemon is disabled). */
	private runPythonOneShot(
		imagePath: string,
		uploadId: string,
	): Promise<PythonResult> {
		return new Promise<PythonResult>((resolve, reject) => {
			const proc = spawn(
				PYTHON_BIN,
				[
					PYTHON_SCRIPT,
					'--image',
					imagePath,
					'--upload-id',
					uploadId,
					'--cache-dir',
					CACHE_DIR,
				],
				{ windowsHide: true, env: process.env },
			)
			let stdout = ''
			let stderr = ''
			const timeout = setTimeout(() => {
				try {
					proc.kill()
				} catch {
					// ignore
				}
				reject(new Error(`Python segmentation timed out after ${PYTHON_TIMEOUT_MS}ms`))
			}, PYTHON_TIMEOUT_MS)
			proc.stdout.on('data', (buf) => {
				stdout += String(buf)
			})
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
					reject(
						new Error(
							`Python segmentation failed (exit ${code}). ${stderr.trim()}`,
						),
					)
					return
				}
				try {
					const parsed = JSON.parse(stdout) as DetectionResult
					resolve({
						detections: parsed.detections ?? [],
						segmentationMapUrl: parsed.segmentationMapUrl,
						segmentationLabels: parsed.segmentationLabels,
						illuminationMapUrl: parsed.illuminationMapUrl,
					})
				} catch (parseErr) {
					reject(
						new Error(
							`Python segmentation returned invalid JSON. ${String(parseErr)}\n${stdout}`,
						),
					)
				}
			})
		})
	}

	/** Queue job and run via persistent daemon (model stays loaded). */
	private runViaDaemon(imagePath: string, uploadId: string): Promise<PythonResult> {
		return new Promise<PythonResult>((resolve, reject) => {
			this.pendingQueue.push({ imagePath, uploadId, resolve, reject })
			this.ensureWorker()
			this.processQueue()
		})
	}

	private ensureWorker(): void {
		if (this.worker !== null) return
		const proc = spawn(
			PYTHON_BIN,
			[PYTHON_SCRIPT, '--daemon', '--cache-dir', CACHE_DIR],
			{ windowsHide: true, env: process.env, stdio: ['pipe', 'pipe', 'inherit'] },
		)
		this.worker = proc
		this.workerReady = false
		this.stdoutBuffer = ''
		if (!proc.stdin) {
			this.worker = null
			return
		}
		proc.stdout.on('data', (buf: Buffer) => {
			this.stdoutBuffer += String(buf)
			for (;;) {
				const i = this.stdoutBuffer.indexOf('\n')
				if (i < 0) break
				const line = this.stdoutBuffer.slice(0, i).trim()
				this.stdoutBuffer = this.stdoutBuffer.slice(i + 1)
				if (!line) continue
				try {
					const parsed = JSON.parse(line) as Record<string, unknown>
					if (parsed.ready === true) {
						this.workerReady = true
						this.processQueue()
						continue
					}
					// Result line (or error from worker)
					const job = this.currentJob
					this.currentJob = null
					if (job) {
						clearTimeout(job.timeout)
						if (parsed.error != null) {
							job.reject(new Error(String(parsed.error)))
						} else {
							job.resolve({
								detections: (parsed.detections as DetectionResult['detections']) ?? [],
								segmentationMapUrl: parsed.segmentationMapUrl as string | undefined,
								segmentationLabels: parsed.segmentationLabels as string[] | undefined,
								illuminationMapUrl: parsed.illuminationMapUrl as string | undefined,
							})
						}
					}
					this.processQueue()
				} catch {
					// ignore malformed line
				}
			}
		})
		proc.on('error', (err) => {
			this.onWorkerExit(err)
		})
		proc.on('close', (code, signal) => {
			this.onWorkerExit(
				code !== 0 && code !== null
					? new Error(`Worker exited with code ${code}`)
					: null,
			)
		})
	}

	private onWorkerExit(err: Error | null): void {
		const proc = this.worker
		this.worker = null
		this.workerReady = false
		this.stdoutBuffer = ''
		if (this.currentJob) {
			clearTimeout(this.currentJob.timeout)
			this.currentJob.reject(
				err ?? new Error('Segmentation worker process exited'),
			)
			this.currentJob = null
		}
		for (const job of this.pendingQueue) {
			job.reject(err ?? new Error('Segmentation worker process exited'))
		}
		this.pendingQueue = []
	}

	private processQueue(): void {
		if (this.currentJob !== null || this.pendingQueue.length === 0) return
		if (this.worker === null || !this.worker.stdin || !this.workerReady) return
		const job = this.pendingQueue.shift()!
		const timeout = setTimeout(() => {
			const current = this.currentJob
			if (!current) return
			this.currentJob = null
			clearTimeout(current.timeout)
			try {
				this.worker?.kill()
			} catch {
				// ignore
			}
			this.worker = null
			this.workerReady = false
			current.reject(
				new Error(`Python segmentation timed out after ${PYTHON_TIMEOUT_MS}ms`),
			)
			this.processQueue()
		}, PYTHON_TIMEOUT_MS)
		this.currentJob = { resolve: job.resolve, reject: job.reject, timeout }
		this.worker.stdin.write(
			JSON.stringify({
				image: job.imagePath,
				uploadId: job.uploadId,
				cacheDir: CACHE_DIR,
			}) + '\n',
		)
	}

	private getResultCachePath(uploadId: string) {
		return path.join(CACHE_DIR, `${uploadId}-result.v${CACHE_VERSION}.json`)
	}

	private readCachedResult(uploadId: string): DetectionResult | null {
		try {
			const p = this.getResultCachePath(uploadId)
			if (!fs.existsSync(p)) return null
			const raw = fs.readFileSync(p, 'utf8')
			const parsed = JSON.parse(raw) as DetectionResult
			if (!parsed || parsed.uploadId !== uploadId) return null
			return parsed
		} catch {
			return null
		}
	}

	private writeCachedResult(uploadId: string, result: DetectionResult) {
		try {
			void fs.promises.writeFile(
				this.getResultCachePath(uploadId),
				JSON.stringify(result),
				'utf8',
			)
		} catch {
			// ignore
		}
	}

	private scheduleCleanup() {
		const intervalMs = Math.max(CLEANUP_INTERVAL_MINUTES, 5) * 60 * 1000
		const ttlMs = Math.max(CACHE_TTL_HOURS, 1) * 60 * 60 * 1000
		const run = async () => {
			try {
				const entries = await fs.promises.readdir(CACHE_DIR)
				const now = Date.now()
				await Promise.all(
					entries.map(async (entry) => {
						const p = path.join(CACHE_DIR, entry)
						const stat = await fs.promises.stat(p).catch(() => null)
						if (!stat || !stat.isFile()) return
						if (now - stat.mtimeMs < ttlMs) return
						await fs.promises.unlink(p).catch(() => null)
					}),
				)
			} catch {
				// ignore cleanup errors
			}
		}
		run()
		const timer = setInterval(run, intervalMs)
		timer.unref?.()
	}
}

