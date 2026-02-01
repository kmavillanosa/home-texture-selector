import { randomUUID } from 'crypto'
import { Injectable } from '@nestjs/common'
import type {
	ProjectDto,
	CreateProjectDto,
	UpdateProjectDto,
} from '../common/types'
import { SegmentService } from '../segment/segment.service'

const store = new Map<string, ProjectDto>()

const SAMPLE_PROJECT_ID = 'sample'
const SAMPLE_UPLOAD_ID = process.env.SAMPLE_UPLOAD_ID ?? '588fcc6c63d7ed1b'
const SAMPLE_IMAGE_URL = process.env.SAMPLE_IMAGE_URL ?? '/uploads/588fcc6c63d7ed1b.png'

@Injectable()
export class ProjectsService {
	constructor(private readonly segmentService: SegmentService) {}

	async getOrCreateSample(): Promise<ProjectDto | undefined> {
		const existing = store.get(SAMPLE_PROJECT_ID)
		if (existing) return existing
		try {
			const result = await this.segmentService.segment(
				SAMPLE_UPLOAD_ID,
				SAMPLE_IMAGE_URL,
			)
			const now = new Date().toISOString()
			const project: ProjectDto = {
				id: SAMPLE_PROJECT_ID,
				name: 'Sample room',
				roomImageUrl: SAMPLE_IMAGE_URL,
				detectionResult: result,
				appliedMaterials: {},
				createdAt: now,
				updatedAt: now,
			}
			store.set(SAMPLE_PROJECT_ID, project)
			return project
		} catch {
			return undefined
		}
	}

	create(dto: CreateProjectDto): ProjectDto {
		const now = new Date().toISOString()
		const firstScene = dto.scenes?.[0]
		const project: ProjectDto = {
			id: randomUUID(),
			name: dto.name,
			roomImageUrl: firstScene?.roomImageUrl ?? dto.roomImageUrl,
			segmentationResult: firstScene?.segmentationResult ?? dto.segmentationResult,
			detectionResult: firstScene?.detectionResult ?? dto.detectionResult,
			appliedMaterials: firstScene?.appliedMaterials ?? dto.appliedMaterials ?? {},
			scenes: dto.scenes,
			createdAt: now,
			updatedAt: now,
		}
		store.set(project.id, project)
		return project
	}

	list(): ProjectDto[] {
		return Array.from(store.values()).sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)
	}

	get(id: string): ProjectDto | undefined {
		return store.get(id)
	}

	update(id: string, dto: UpdateProjectDto): ProjectDto | undefined {
		const project = store.get(id)
		if (!project) return undefined
		if (dto.name !== undefined) project.name = dto.name
		if (dto.thumbnailUrl !== undefined) project.thumbnailUrl = dto.thumbnailUrl
		if (dto.appliedMaterials !== undefined)
			project.appliedMaterials = dto.appliedMaterials
		project.updatedAt = new Date().toISOString()
		store.set(id, project)
		return project
	}
}
