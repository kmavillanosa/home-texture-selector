import { Body, Controller, Post } from '@nestjs/common'
import { RenderService } from './render.service'

export interface RenderRequestDto {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
}

@Controller('render')
export class RenderController {
	constructor(private readonly renderService: RenderService) {}

	@Post()
	async render(@Body() body: RenderRequestDto) {
		return this.renderService.render(body)
	}
}
