import { create } from 'zustand'
import type { DetectionResult, Material } from '../types'

export interface AppliedMaterial {
	materialId: string
	color: string
	assetUrl: string
	rotation: number
}

interface VisualizerState {
	roomImageUrl: string | null
	detectionResult: DetectionResult | null
	scale: number
	pan: { x: number; y: number }
	selectedMaterial: Material | null
	selectedRegionId: string | null
	appliedMaterials: Record<string, AppliedMaterial>
	renderedImageUrl: string | null
	hideHeader: boolean
	setRoomImage: (url: string | null) => void
	setDetectionResult: (result: DetectionResult | null) => void
	setScale: (scale: number) => void
	setPan: (pan: { x: number; y: number }) => void
	setSelectedMaterial: (material: Material | null) => void
	setSelectedRegionId: (regionId: string | null) => void
	setRenderedImageUrl: (url: string | null) => void
	setAppliedMaterials: (materials: Record<string, AppliedMaterial>) => void
	setHideHeader: (hide: boolean) => void
	applyMaterial: (regionId: string, material: Material, rotation?: number) => void
	setMaterialRotation: (regionId: string, rotation: number) => void
	clearMaterial: (regionId: string) => void
	clearAllMaterials: () => void
	resetView: () => void
	reset: () => void
}

const initialState = {
	roomImageUrl: null as string | null,
	detectionResult: null as DetectionResult | null,
	scale: 1,
	pan: { x: 0, y: 0 },
	selectedMaterial: null as Material | null,
	selectedRegionId: null as string | null,
	appliedMaterials: {} as Record<string, AppliedMaterial>,
	renderedImageUrl: null as string | null,
	hideHeader: false,
}

export const useVisualizerStore = create<VisualizerState>((set) => ({
	...initialState,
	setRoomImage: (roomImageUrl) => set({ roomImageUrl }),
	setDetectionResult: (detectionResult) => set({ detectionResult }),
	setScale: (scale) => set({ scale }),
	setPan: (pan) => set({ pan }),
	setSelectedMaterial: (selectedMaterial) => set({ selectedMaterial }),
	setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId }),
	setRenderedImageUrl: (renderedImageUrl) => set({ renderedImageUrl }),
	setAppliedMaterials: (appliedMaterials) => set({ appliedMaterials }),
	setHideHeader: (hideHeader) => set({ hideHeader }),
	applyMaterial: (regionId, material, rotation) =>
		set((state) => ({
			appliedMaterials: {
				...state.appliedMaterials,
				[regionId]: {
					materialId: material.id,
					color: (material.metadata?.color as string) ?? '#e2e8f0',
					assetUrl: material.assetUrl,
					rotation: rotation ?? 0,
				},
			},
		})),
	setMaterialRotation: (regionId, rotation) =>
		set((state) => {
			const current = state.appliedMaterials[regionId]
			if (!current) return state
			return {
				appliedMaterials: {
					...state.appliedMaterials,
					[regionId]: { ...current, rotation },
				},
			}
		}),
	clearMaterial: (regionId) =>
		set((state) => {
			const next = { ...state.appliedMaterials }
			delete next[regionId]
			return { appliedMaterials: next }
		}),
	clearAllMaterials: () => set({ appliedMaterials: {}, renderedImageUrl: null }),
	resetView: () => set({ scale: 1, pan: { x: 0, y: 0 } }),
	reset: () => set(initialState),
}))
