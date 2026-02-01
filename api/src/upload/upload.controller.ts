import {
	Controller,
	Post,
	UseInterceptors,
	UploadedFile,
	BadRequestException,
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
}
