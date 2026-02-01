import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const VENV_PYTHON = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
const PYTHON_BIN =
	process.env.PYTHON_BIN ?? (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python')
const PYTHON_SCRIPT = path.join(process.cwd(), 'python', 'inpaint_sd.py')
const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS ?? 300000)

export interface RenderRequest {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
}

@Injectable()
export class RenderService {
	constructor() {
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true })
		}
	}

	async render(request: RenderRequest): Promise<{ renderedUrl: string }> {
		const imagePath = path.join(process.cwd(), request.imageUrl.replace(/^\//, ''))
		const maskPath = path.join(process.cwd(), request.maskUrl.replace(/^\//, ''))
		if (!fs.existsSync(imagePath)) {
			throw new Error(`Image not found: ${imagePath}`)
		}
		if (!fs.existsSync(maskPath)) {
			throw new Error(`Mask not found: ${maskPath}`)
		}
		const outName = `${request.uploadId}-${request.label}-rendered.png`.replace(
			' ',
			'_',
		)
		const outPath = path.join(CACHE_DIR, outName)
		await this.runPython(imagePath, maskPath, request.prompt, outPath)
		return { renderedUrl: `/cache/${outName}` }
	}

	private async runPython(
		imagePath: string,
		maskPath: string,
		prompt: string,
		outPath: string,
	): Promise<void> {
		if (!fs.existsSync(PYTHON_SCRIPT)) {
			throw new Error(`Inpaint script missing: ${PYTHON_SCRIPT}`)
		}
		await new Promise<void>((resolve, reject) => {
			const proc = spawn(
				PYTHON_BIN,
				[
					PYTHON_SCRIPT,
					'--image',
					imagePath,
					'--mask',
					maskPath,
					'--prompt',
					prompt,
					'--output',
					outPath,
				],
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
