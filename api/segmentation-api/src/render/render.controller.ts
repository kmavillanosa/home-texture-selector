import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { RenderService } from './render.service'

export interface RenderRequestDto {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
	textureUrl?: string
}

@Controller('render')
export class RenderController {
	constructor(private readonly renderService: RenderService) {}

	@Post()
	async render(@Body() body: RenderRequestDto, @Req() req: Request) {
		const origin =
			req.headers.origin ||
			req.headers.referer ||
			(req.headers['x-forwarded-for'] as string | undefined) ||
			req.socket.remoteAddress ||
			'unknown'
		return this.renderService.render(body, String(origin))
	}

	@Get('status/:id')
	async status(@Param('id') id: string) {
		return this.renderService.getRenderStatus(id)
	}
}
