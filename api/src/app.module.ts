import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { UploadModule } from './upload/upload.module'
import { SegmentModule } from './segment/segment.module'
import { MaterialsModule } from './materials/materials.module'
import { ProjectsModule } from './projects/projects.module'
import { RenderModule } from './render/render.module'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		UploadModule,
		SegmentModule,
		MaterialsModule,
		ProjectsModule,
		RenderModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
