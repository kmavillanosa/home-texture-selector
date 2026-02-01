import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const PUBLIC_PATH = '/uploads'
const CLEANUP_INTERVAL_MINUTES = Number(
	process.env.CLEANUP_INTERVAL_MINUTES ?? 30,
)
const UPLOAD_TTL_HOURS = Number(process.env.UPLOAD_TTL_HOURS ?? 24)

@Injectable()
export class UploadService {
	constructor() {
		if (!fs.existsSync(UPLOAD_DIR)) {
			fs.mkdirSync(UPLOAD_DIR, { recursive: true })
		}
		this.scheduleCleanup()
	}

	saveUpload(file: Express.Multer.File): { roomImageUrl: string; uploadId: string } {
		const hash = createHash('sha256').update(file.buffer).digest('hex')
		const uploadId = hash.slice(0, 16)
		const ext = path.extname(file.originalname) || '.jpg'
		const filename = `${uploadId}${ext}`
		const filepath = path.join(UPLOAD_DIR, filename)
		if (!fs.existsSync(filepath)) {
			fs.writeFileSync(filepath, file.buffer)
		}
		const roomImageUrl = `${PUBLIC_PATH}/${filename}`
		return { roomImageUrl, uploadId }
	}

	private scheduleCleanup() {
		const intervalMs = Math.max(CLEANUP_INTERVAL_MINUTES, 5) * 60 * 1000
		const ttlMs = Math.max(UPLOAD_TTL_HOURS, 1) * 60 * 60 * 1000
		const run = async () => {
			try {
				const entries = await fs.promises.readdir(UPLOAD_DIR)
				const now = Date.now()
				await Promise.all(
					entries.map(async (entry) => {
						const p = path.join(UPLOAD_DIR, entry)
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
