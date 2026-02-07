import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

/**
 * S3-compatible blob storage (Cloudflare R2, AWS S3, MinIO).
 * Falls back to local filesystem when not configured.
 */
@Injectable()
export class StorageService {
	private readonly s3: S3Client | null = null
	private readonly bucket: string
	private readonly publicBaseUrl: string | null
	private readonly useLocal: boolean

	constructor(private readonly config: ConfigService) {
		const endpoint = this.config.get<string>('STORAGE_ENDPOINT')
		const accessKey = this.config.get<string>('STORAGE_ACCESS_KEY')
		const secretKey = this.config.get<string>('STORAGE_SECRET_KEY')
		this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'uploads'
		this.publicBaseUrl = this.config.get<string>('STORAGE_PUBLIC_URL') ?? null

		if (endpoint && accessKey && secretKey) {
			const region = this.config.get<string>('STORAGE_REGION') ?? 'auto'
			this.s3 = new S3Client({
				endpoint,
				region,
				credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
				forcePathStyle: this.config.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true',
			})
			this.useLocal = false
		} else {
			this.s3 = null
			this.useLocal = true
		}
	}

	/**
	 * Upload a buffer to storage. Returns the public URL to access the file.
	 * Key format: "uploads/filename.jpg" for consistency.
	 */
	async put(key: string, buffer: Buffer, contentType?: string): Promise<string> {
		if (this.s3) {
			await this.s3.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: buffer,
					ContentType: contentType ?? 'application/octet-stream',
				}),
			)
			return this.getPublicUrl(key)
		}
		// Local fallback: write to uploads/ dir
		const baseDir = path.join(process.cwd(), 'uploads')
		const filePath = path.join(baseDir, key.replace(/^uploads\/?/, ''))
		const dir = path.dirname(filePath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}
		fs.writeFileSync(filePath, buffer)
		return `/uploads/${key.replace(/^uploads\/?/, '').replace(/\\/g, '/')}`
	}

	/**
	 * Get file contents from storage.
	 */
	async get(key: string): Promise<Buffer | null> {
		if (this.s3) {
			try {
				const res = await this.s3.send(
					new GetObjectCommand({ Bucket: this.bucket, Key: key }),
				)
				const chunks: Buffer[] = []
				for await (const chunk of res.Body as AsyncIterable<Buffer>) {
					chunks.push(chunk)
				}
				return Buffer.concat(chunks)
			} catch {
				return null
			}
		}
		const localKey = key.replace(/^uploads\/?/, '')
		const filePath = path.join(process.cwd(), 'uploads', localKey)
		if (!fs.existsSync(filePath)) return null
		return fs.readFileSync(filePath)
	}

	/**
	 * Delete a file from storage.
	 */
	async delete(key: string): Promise<void> {
		if (this.s3) {
			await this.s3.send(
				new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
			)
			return
		}
		const localKey = key.replace(/^uploads\/?/, '')
		const filePath = path.join(process.cwd(), 'uploads', localKey)
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath)
		}
	}

	/**
	 * Extract storage key from a public URL (for fetching).
	 */
	getKeyFromUrl(url: string): string {
		if (url.startsWith('/')) {
			const p = url.replace(/^\//, '')
			return p.startsWith('uploads/') ? p : `uploads/${p}`
		}
		try {
			const u = new URL(url)
			const p = u.pathname.replace(/^\//, '')
			return p || url
		} catch {
			return url
		}
	}

	/**
	 * Return the public URL for a key.
	 */
	getPublicUrl(key: string): string {
		if (this.publicBaseUrl) {
			const base = this.publicBaseUrl.replace(/\/$/, '')
			return `${base}/${key.replace(/\\/g, '/')}`
		}
		if (this.s3) {
			// R2/S3 custom domain or default endpoint URL
			const endpoint = this.config.get<string>('STORAGE_ENDPOINT') ?? ''
			if (endpoint.includes('r2.cloudflarestorage.com')) {
				// R2: need custom domain for public access
				const accountId = this.config.get<string>('R2_ACCOUNT_ID')
				if (accountId) {
					return `https://${this.bucket}.${accountId}.r2.cloudflarestorage.com/${key}`
				}
			}
		}
		return `/uploads/${key.replace(/\\/g, '/')}`
	}

	get isLocal(): boolean {
		return this.useLocal
	}
}
