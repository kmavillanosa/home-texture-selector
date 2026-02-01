/**
 * Shared DTOs and types for Anyo Haus Studio API
 */

/** Hint for how to draw the overlay: trace the object shape (e.g. circle for plate, rectangle for book). */
export type DetectionShape = 'rectangle' | 'ellipse'

/** Single detection; bbox in % 0–100; polygon is free-form outline in % (when present, use instead of bbox for drawing) */
export interface Detection {
	label: string
	score: number
	bbox: { x: number; y: number; width: number; height: number }
	/** How to highlight: ellipse for round objects (plate, bowl, cup), rectangle otherwise. */
	shape?: DetectionShape
	/** Free-form outline as percentage points (0–100). Use for drawing; when absent, derive from bbox. */
	polygon?: { x: number; y: number }[]
	/** Optional mask image (white + alpha). */
	maskUrl?: string
	/** Cropped region from the uploaded image (room pixels with mask as alpha). */
	croppedUrl?: string
	/** Dominant texture/edge angle in degrees [0, 180) for rotating applied texture. */
	textureAngle?: number
}

export interface DetectionResult {
	uploadId: string
	detections: Detection[]
	detectionFailed?: boolean
	/** Full-res map: pixel value = 1-based detection index, 0 = background. */
	segmentationMapUrl?: string
	/** Labels in order: index i (1-based in map) = segmentationLabels[i - 1]. */
	segmentationLabels?: string[]
	/** Illumination map (grayscale) for relighting textures. */
	illuminationMapUrl?: string
}

export interface SegmentationRegion {
	id: string
	label: 'wall' | 'floor' | 'ceiling' | 'door' | 'door_knob' | 'window' | 'fixture' | 'other'
	maskUrl?: string
	bounds: { x: number; y: number; width: number; height: number }
}

export interface SegmentationResult {
	uploadId: string
	regions: SegmentationRegion[]
	/** True when API failed and we did not guess regions. */
	detectionFailed?: boolean
}

export interface MaterialDto {
	id: string
	category: 'flooring' | 'paint' | 'tiles' | 'wallpapers' | 'furniture'
	name: string
	thumbnailUrl: string
	assetUrl: string
	metadata?: Record<string, unknown>
}

export interface SceneDto {
	id: string
	name: string
	roomImageUrl: string
	segmentationResult?: SegmentationResult
	detectionResult?: DetectionResult
	appliedMaterials?: Record<string, string>
}

export interface ProjectDto {
	id: string
	name: string
	thumbnailUrl?: string
	roomImageUrl: string
	segmentationResult?: SegmentationResult
	detectionResult?: DetectionResult
	appliedMaterials?: Record<string, string>
	scenes?: SceneDto[]
	createdAt: string
	updatedAt: string
}

export interface SampleProjectDto {
	id: string
	uploadId: string
	name: string
	roomImageUrl: string
}

export interface SampleGroupDto {
	groupId: string
	name: string
	samples: SampleProjectDto[]
}

export interface CreateProjectDto {
	name: string
	roomImageUrl: string
	segmentationResult?: SegmentationResult
	detectionResult?: DetectionResult
	appliedMaterials?: Record<string, string>
	scenes?: SceneDto[]
}

export interface UpdateProjectDto {
	name?: string
	thumbnailUrl?: string
	appliedMaterials?: Record<string, string>
}
