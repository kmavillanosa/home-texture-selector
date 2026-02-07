import { Body, Controller, Post } from '@nestjs/common'
import { SegmentService } from './segment.service'

export interface SegmentRequestDto {
	uploadId?: string
	imageUrl?: string
	useDaemon?: boolean
}

@Controller('segment')
export class SegmentController {
	constructor(private readonly segmentService: SegmentService) {}

	@Post()
	async segment(@Body() body: SegmentRequestDto) {
		return this.segmentService.segment(
			body.uploadId,
			body.imageUrl,
			body.useDaemon,
		)
	}
}
