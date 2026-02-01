import {
	Controller,
	Get,
	Post,
	Patch,
	Param,
	Body,
	NotFoundException,
} from '@nestjs/common'
import { ProjectsService } from './projects.service'
import type { CreateProjectDto, UpdateProjectDto } from '../common/types'

@Controller('projects')
export class ProjectsController {
	constructor(private readonly projectsService: ProjectsService) {}

	@Post()
	create(@Body() dto: CreateProjectDto) {
		return this.projectsService.create(dto)
	}

	@Get()
	list() {
		return this.projectsService.list()
	}

	@Get('samples')
	listSamples() {
		return this.projectsService.listSamples()
	}

	@Get('sample-groups')
	listSampleGroups() {
		return this.projectsService.listSampleGroups()
	}

	@Get('sample')
	async getSample() {
		const project = await this.projectsService.getOrCreateSample()
		if (!project) throw new NotFoundException('Sample not available')
		return project
	}

	@Get(':id')
	async get(@Param('id') id: string) {
		const project = await this.projectsService.get(id)
		if (!project) throw new NotFoundException('Project not found')
		return project
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
		const project = this.projectsService.update(id, dto)
		if (!project) throw new NotFoundException('Project not found')
		return project
	}
}
