import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { StorageService } from '../storage/storage.service'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const CACHE_DIR = path.join(process.cwd(), 'cache')
const MOBILE_SESSIONS_PATH = path.join(CACHE_DIR, 'mobile-sessions.json')
const CLEANUP_INTERVAL_MINUTES = Number(
	process.env.CLEANUP_INTERVAL_MINUTES ?? 30,
)
const UPLOAD_TTL_HOURS = Number(process.env.UPLOAD_TTL_HOURS ?? 24)

@Injectable()
export class UploadService {
	constructor(private readonly storage: StorageService) {
		if (!fs.existsSync(UPLOAD_DIR)) {
			fs.mkdirSync(UPLOAD_DIR, { recursive: true })
		}
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true })
		}
		this.scheduleCleanup()
	}

	async saveUpload(
		file: Express.Multer.File,
	): Promise<{ roomImageUrl: string; uploadId: string }> {
		const hash = createHash('sha256').update(file.buffer).digest('hex')
		const uploadId = hash.slice(0, 16)
		const ext = path.extname(file.originalname) || '.jpg'
		const filename = `${uploadId}${ext}`
		const key = `uploads/${filename}`
		const roomImageUrl = await this.storage.put(key, file.buffer, file.mimetype)
		return { roomImageUrl, uploadId }
	}

	async recordMobileSession(
		sessionId: string,
		payload: { uploadId: string; roomImageUrl: string },
	) {
		const data = await this.readMobileSessions()
		const list = data[sessionId] ?? []
		const exists = list.some((item) => item.uploadId === payload.uploadId)
		if (!exists) {
			list.push({
				...payload,
				uploadedAt: new Date().toISOString(),
			})
		}
		data[sessionId] = list
		await this.writeMobileSessions(data)
		return list
	}

	async listMobileSession(sessionId: string) {
		const data = await this.readMobileSessions()
		return data[sessionId] ?? []
	}

	private async readMobileSessions(): Promise<
		Record<
			string,
			{ uploadId: string; roomImageUrl: string; uploadedAt: string }[]
		>
	> {
		try {
			const raw = await fs.promises.readFile(MOBILE_SESSIONS_PATH, 'utf-8')
			const parsed = JSON.parse(raw) as Record<
				string,
				{ uploadId: string; roomImageUrl: string; uploadedAt: string }[]
			>
			return parsed ?? {}
		} catch {
			return {}
		}
	}

	private async writeMobileSessions(
		data: Record<
			string,
			{ uploadId: string; roomImageUrl: string; uploadedAt: string }[]
		>,
	) {
		await fs.promises.writeFile(
			MOBILE_SESSIONS_PATH,
			JSON.stringify(data, null, 2),
		)
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
