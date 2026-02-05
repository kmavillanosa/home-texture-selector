import { Module } from '@nestjs/common'
import { SegmentController } from './segment.controller'
import { SegmentService } from './segment.service'
import { StorageModule } from '../storage/storage.module'

@Module({
	imports: [StorageModule],
	controllers: [SegmentController],
	providers: [SegmentService],
	exports: [SegmentService],
})
export class SegmentModule {}
