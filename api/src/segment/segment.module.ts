import { Module } from '@nestjs/common'
import { SegmentController } from './segment.controller'
import { SegmentService } from './segment.service'

@Module({
	controllers: [SegmentController],
	providers: [SegmentService],
	exports: [SegmentService],
})
export class SegmentModule {}
