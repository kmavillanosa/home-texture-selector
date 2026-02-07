import {
	Controller,
	Post,
	UseInterceptors,
	UploadedFile,
	BadRequestException,
	Get,
	Param,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png']

@Controller('upload')
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	@Post()
	@UseInterceptors(FileInterceptor('file'))
	async uploadRoomImage(
		@UploadedFile() file: Express.Multer.File | undefined,
	): Promise<{ roomImageUrl: string; uploadId: string }> {
		if (!file) {
			throw new BadRequestException('No file provided')
		}
		if (!ALLOWED_MIMES.includes(file.mimetype)) {
			throw new BadRequestException('Only JPEG and PNG are allowed')
		}
		if (file.size > MAX_SIZE) {
			throw new BadRequestException('File must be under 10MB')
		}
		return this.uploadService.saveUpload(file)
	}

	@Post('mobile/:sessionId')
	@UseInterceptors(FileInterceptor('file'))
	async uploadMobileImage(
		@Param('sessionId') sessionId: string,
		@UploadedFile() file: Express.Multer.File | undefined,
	): Promise<{ roomImageUrl: string; uploadId: string }> {
		if (!sessionId) {
			throw new BadRequestException('Missing sessionId')
		}
		if (!file) {
			throw new BadRequestException('No file provided')
		}
		if (!ALLOWED_MIMES.includes(file.mimetype)) {
			throw new BadRequestException('Only JPEG and PNG are allowed')
		}
		if (file.size > MAX_SIZE) {
			throw new BadRequestException('File must be under 10MB')
		}
		const saved = await this.uploadService.saveUpload(file)
		await this.uploadService.recordMobileSession(sessionId, saved)
		return saved
	}

	@Get('mobile/:sessionId')
	async listMobileUploads(@Param('sessionId') sessionId: string) {
		if (!sessionId) {
			throw new BadRequestException('Missing sessionId')
		}
		return this.uploadService.listMobileSession(sessionId)
	}
}
