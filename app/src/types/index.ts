/** How to trace the detected object: ellipse (e.g. plate, bowl) or rectangle. */
export type DetectionShape = 'rectangle' | 'ellipse'

/** Single detection. Use shape + bbox/polygon to draw overlay (e.g. circle for plate). maskUrl = optional mask image. */
export interface Detection {
	label: string
	score: number
	bbox: { x: number; y: number; width: number; height: number }
	/** Overlay shape: ellipse for round objects, rectangle otherwise. */
	shape?: DetectionShape
	/** Free-form outline in %; when shape is rectangle and polygon present, use for drawing. */
	polygon?: { x: number; y: number }[]
	maskUrl?: string
	/** Cropped region from the uploaded image (room pixels with mask as alpha). */
	croppedUrl?: string
	/** Dominant texture/edge angle in degrees [0, 180) so applied texture can be rotated to match. */
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
	detectionFailed?: boolean
}

export interface Material {
	id: string
	category: 'flooring' | 'paint' | 'tiles' | 'wallpapers' | 'furniture'
	name: string
	thumbnailUrl: string
	assetUrl: string
	metadata?: Record<string, unknown>
}

export interface AppliedMaterialSnapshot {
	materialId: string
	color: string
	assetUrl: string
	rotation: number
}

export interface Scene {
	id: string
	name: string
	roomImageUrl: string
	segmentationResult?: SegmentationResult
	detectionResult?: DetectionResult
	appliedMaterials?: Record<string, string | AppliedMaterialSnapshot>
	notes?: string
}

export interface Project {
	id: string
	name: string
	thumbnailUrl?: string
	roomImageUrl: string
	segmentationResult?: SegmentationResult
	detectionResult?: DetectionResult
	appliedMaterials?: Record<string, string | AppliedMaterialSnapshot>
	scenes?: Scene[]
	createdAt: string
	updatedAt: string
}

export interface SampleProject {
	id: string
	uploadId: string
	name: string
	roomImageUrl: string
}

export interface SampleGroup {
	groupId: string
	name: string
	samples: SampleProject[]
}
