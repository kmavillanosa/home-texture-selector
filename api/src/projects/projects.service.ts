import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import type {
	ProjectDto,
	CreateProjectDto,
	UpdateProjectDto,
	SampleProjectDto,
	SampleGroupDto,
	SceneDto,
} from '../common/types'
import { SegmentService } from '../segment/segment.service'
import { PrismaService } from '../prisma/prisma.service'

const SAMPLE_PROJECT_ID = 'sample'
const SAMPLE_PROJECT_PREFIX = 'sample-'
const SAMPLE_GROUP_PREFIX = 'sample-group-'
const SAMPLE_UPLOAD_ID = process.env.SAMPLE_UPLOAD_ID ?? '588fcc6c63d7ed1b'
const SAMPLE_IMAGE_URL =
	process.env.SAMPLE_IMAGE_URL ?? '/uploads/588fcc6c63d7ed1b.png'
const SAMPLES_DIR = path.join(process.cwd(), 'samples')
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

@Injectable()
export class ProjectsService {
	constructor(
		private readonly segmentService: SegmentService,
		private readonly prisma: PrismaService,
	) {}

	async getOrCreateSample(): Promise<ProjectDto | undefined> {
		return this.getOrCreateSampleByUploadId(
			SAMPLE_PROJECT_ID,
			SAMPLE_UPLOAD_ID,
			SAMPLE_IMAGE_URL,
		)
	}

	async listSamples(): Promise<SampleProjectDto[]> {
		const uploadIds = this.getSampleUploadIds()
		const uploads = this.listUploadFiles()
		return uploadIds
			.map((uploadId, index) => {
				const roomImageUrl = this.getUploadImageUrl(uploadId, uploads)
				if (!roomImageUrl) return null
				return {
					id: `${SAMPLE_PROJECT_PREFIX}${uploadId}`,
					uploadId,
					name: `Sample room ${index + 1}`,
					roomImageUrl,
				}
			})
			.filter((item): item is SampleProjectDto => item !== null)
	}

	/** Returns groups matching the original batch upload ranges. */
	async listSampleGroups(): Promise<SampleGroupDto[]> {
		return this.getSampleGroupsByBatch()
	}

	async create(dto: CreateProjectDto): Promise<ProjectDto> {
		const firstScene = dto.scenes?.[0]
		const project = await this.prisma.project.create({
			data: {
				name: dto.name,
				roomImageUrl: firstScene?.roomImageUrl ?? dto.roomImageUrl,
				segmentationResult: (firstScene?.segmentationResult ??
					dto.segmentationResult) as object | undefined,
				detectionResult: (firstScene?.detectionResult ??
					dto.detectionResult) as object | undefined,
				appliedMaterials: (firstScene?.appliedMaterials ??
					dto.appliedMaterials ?? {}) as object | undefined,
				scenes: dto.scenes as object | undefined,
			},
		})
		return this.toProjectDto(project)
	}

	async list(): Promise<ProjectDto[]> {
		const rows = await this.prisma.project.findMany({
			orderBy: { updatedAt: 'desc' },
		})
		return rows.map((r) => this.toProjectDto(r))
	}

	async get(id: string): Promise<ProjectDto | undefined> {
		if (id.startsWith(SAMPLE_GROUP_PREFIX)) {
			const index = parseInt(id.slice(SAMPLE_GROUP_PREFIX.length), 10)
			if (!Number.isNaN(index) && index >= 0) {
				return this.getOrCreateSampleGroupByIndex(index)
			}
			return undefined
		}
		if (id.startsWith(SAMPLE_PROJECT_PREFIX)) {
			const uploadId = id.slice(SAMPLE_PROJECT_PREFIX.length)
			const roomImageUrl = this.getUploadImageUrl(
				uploadId,
				this.listUploadFiles(),
			)
			if (!roomImageUrl) return undefined
			return this.getOrCreateSampleByUploadId(id, uploadId, roomImageUrl)
		}
		const row = await this.prisma.project.findUnique({ where: { id } })
		if (!row) return undefined
		return this.toProjectDto(row)
	}

	async update(id: string, dto: UpdateProjectDto): Promise<ProjectDto | undefined> {
		if (this.isSampleProjectId(id)) return undefined
		const row = await this.prisma.project.update({
			where: { id },
			data: {
				...(dto.name !== undefined && { name: dto.name }),
				...(dto.thumbnailUrl !== undefined && {
					thumbnailUrl: dto.thumbnailUrl,
				}),
				...(dto.appliedMaterials !== undefined && {
					appliedMaterials: dto.appliedMaterials as object,
				}),
				...(dto.scenes !== undefined && {
					scenes: dto.scenes as object,
				}),
			},
		})
		return this.toProjectDto(row)
	}

	private getSampleUploadIds(): string[] {
		return this.getSampleUploadIdsWithMtime().map((x) => x.uploadId)
	}

	/** Upload ids with mtime of result file (for batch grouping). */
	private getSampleUploadIdsWithMtime(): { uploadId: string; mtime: number }[] {
		if (!fs.existsSync(SAMPLES_DIR)) return []
		const entries = fs.readdirSync(SAMPLES_DIR)
		const withMtime: { uploadId: string; mtime: number }[] = []
		for (const entry of entries) {
			const match = entry.match(/^(.+)-result\.v\d+\.json$/)
			if (!match) continue
			const uploadId = match[1]
			const filePath = path.join(SAMPLES_DIR, entry)
			try {
				const stat = fs.statSync(filePath)
				withMtime.push({
					uploadId,
					mtime: stat.mtimeMs ?? stat.mtime.getTime(),
				})
			} catch {
				// skip
			}
		}
		withMtime.sort((a, b) => a.mtime - b.mtime)
		return withMtime
	}

	/** Group samples by fixed ranges (1-5, 6-15, 16-24). */
	private getSampleGroupsByBatch(): SampleGroupDto[] {
		const withMtime = this.getSampleUploadIdsWithMtime()
		const uploads = this.listUploadFiles()
		const samplesWithTime: (SampleProjectDto & { mtime: number })[] = []
		withMtime.forEach(({ uploadId, mtime }, index) => {
			const roomImageUrl = this.getUploadImageUrl(uploadId, uploads)
			if (!roomImageUrl) return
			samplesWithTime.push({
				id: `${SAMPLE_PROJECT_PREFIX}${uploadId}`,
				uploadId,
				name: `Sample room ${index + 1}`,
				roomImageUrl,
				mtime,
			})
		})
		if (samplesWithTime.length === 0) return []
		const ranges = [
			{ start: 0, end: 4, name: 'Modern Loft' },
			{ start: 5, end: 14, name: 'Coastal Retreat' },
			{ start: 15, end: 23, name: 'Classic Cozy' },
		]
		const groups: SampleGroupDto[] = []
		ranges.forEach((range) => {
			const slice = samplesWithTime.slice(range.start, range.end + 1)
			if (slice.length === 0) return
			groups.push({
				groupId: `${SAMPLE_GROUP_PREFIX}${groups.length}`,
				name: range.name,
				samples: slice.map((s) => ({
					id: s.id,
					uploadId: s.uploadId,
					name: s.name,
					roomImageUrl: s.roomImageUrl,
				})),
			})
		})
		return groups
	}

	private listUploadFiles(): string[] {
		if (!fs.existsSync(UPLOADS_DIR)) return []
		return fs.readdirSync(UPLOADS_DIR)
	}

	private getUploadImageUrl(uploadId: string, entries: string[]): string | null {
		const match = entries.find((entry) => entry.startsWith(`${uploadId}.`))
		if (!match) return null
		return `/uploads/${match}`
	}

	private sampleCache = new Map<string, ProjectDto>()

	private async getOrCreateSampleByUploadId(
		projectId: string,
		uploadId: string,
		roomImageUrl: string,
	): Promise<ProjectDto | undefined> {
		const existing = this.sampleCache.get(projectId)
		if (existing) return existing
		try {
			const result = await this.segmentService.segment(uploadId, roomImageUrl)
			const now = new Date().toISOString()
			const project: ProjectDto = {
				id: projectId,
				name: 'Sample room',
				roomImageUrl,
				detectionResult: result,
				appliedMaterials: {},
				createdAt: now,
				updatedAt: now,
			}
			this.sampleCache.set(projectId, project)
			return project
		} catch {
			return undefined
		}
	}

	/** Builds a project with scenes for the batch at the given index. */
	private async getOrCreateSampleGroupByIndex(
		groupIndex: number,
	): Promise<ProjectDto | undefined> {
		const groups = this.getSampleGroupsByBatch()
		const group = groups[groupIndex]
		if (!group || group.samples.length === 0) return undefined
		const groupId = group.groupId
		const existing = this.sampleCache.get(groupId)
		if (existing) return existing
		const scenes: SceneDto[] = []
		for (const sample of group.samples) {
			const project = await this.getOrCreateSampleByUploadId(
				sample.id,
				sample.uploadId,
				sample.roomImageUrl,
			)
			if (!project?.detectionResult) continue
			scenes.push({
				id: project.id,
				name: sample.name,
				roomImageUrl: project.roomImageUrl,
				detectionResult: project.detectionResult,
				appliedMaterials: {},
			})
		}
		if (scenes.length === 0) return undefined
		const now = new Date().toISOString()
		const project: ProjectDto = {
			id: groupId,
			name: group.name,
			roomImageUrl: scenes[0].roomImageUrl,
			detectionResult: scenes[0].detectionResult,
			appliedMaterials: {},
			scenes,
			createdAt: now,
			updatedAt: now,
		}
		this.sampleCache.set(groupId, project)
		return project
	}

	private toProjectDto(row: {
		id: string
		name: string
		thumbnailUrl: string | null
		roomImageUrl: string
		segmentationResult: unknown
		detectionResult: unknown
		appliedMaterials: unknown
		scenes: unknown
		createdAt: Date
		updatedAt: Date
	}): ProjectDto {
		return {
			id: row.id,
			name: row.name,
			thumbnailUrl: row.thumbnailUrl ?? undefined,
			roomImageUrl: row.roomImageUrl,
			segmentationResult: row.segmentationResult as ProjectDto['segmentationResult'],
			detectionResult: row.detectionResult as ProjectDto['detectionResult'],
			appliedMaterials: (row.appliedMaterials as Record<string, string>) ?? {},
			scenes: row.scenes as ProjectDto['scenes'],
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		}
	}

	private isSampleProjectId(id: string) {
		return id.startsWith(SAMPLE_PROJECT_PREFIX) || id.startsWith(SAMPLE_GROUP_PREFIX)
	}

	private resetSampleProject(project: ProjectDto): ProjectDto {
		return {
			...project,
			appliedMaterials: {},
			scenes: project.scenes?.map((scene) => ({
				...scene,
				appliedMaterials: {},
			})),
		}
	}
}
