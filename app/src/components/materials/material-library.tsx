import { useEffect, useMemo, useState } from 'react'
import { listMaterials, renderTexture } from '../../api/client'
import type { Material } from '../../types'
import { MaterialCard } from './material-card'
import { useVisualizerStore } from '../../store/visualizer-store'

const CATEGORIES: { value: string; label: string }[] = [
	{ value: '', label: 'All' },
	{ value: 'flooring', label: 'Flooring' },
	{ value: 'paint', label: 'Paint' },
	{ value: 'tiles', label: 'Tiles' },
	{ value: 'wallpapers', label: 'Wallpapers' },
	{ value: 'furniture', label: 'Furniture' },
]

const CATEGORY_BY_LABEL: Record<
	string,
	('flooring' | 'paint' | 'tiles' | 'wallpapers' | 'furniture')[]
> = {
	Floor: ['flooring', 'tiles'],
	Wall: ['paint', 'wallpapers', 'tiles'],
	Ceiling: ['paint'],
	Backsplash: ['tiles'],
	Countertop: ['tiles'],
	Cabinet: ['furniture'],
	Shelf: ['furniture'],
	Door: ['paint'],
	Window: ['paint'],
	Bed: ['furniture'],
	Chair: ['furniture'],
	Sofa: ['furniture'],
	Table: ['furniture'],
	Refrigerator: ['furniture'],
	Stove: ['furniture'],
	Sink: ['furniture'],
	Mirror: ['furniture'],
	Light: ['furniture'],
	Rug: ['flooring'],
}

const getBaseLabel = (label: string) => label.replace(/\s+\d+$/, '')

const getAllowedCategories = (labels: string[]) => {
	const allowed = new Set<string>()
	for (const label of labels) {
		const categories = CATEGORY_BY_LABEL[getBaseLabel(label)]
		if (!categories) continue
		categories.forEach((c) => allowed.add(c))
	}
	return allowed
}

const pickRegionIdForCategory = (
	category: string,
	detections: { id: string; baseLabel: string }[],
): string | null => {
	const prefs: Record<string, string[]> = {
		flooring: ['Floor', 'Rug'],
		paint: ['Wall', 'Ceiling', 'Door'],
		wallpapers: ['Wall'],
		tiles: ['Floor', 'Wall', 'Countertop'],
		furniture: ['Cabinet', 'Shelf', 'Sofa', 'Chair', 'Table', 'Bed'],
	}
	const preferred = prefs[category] ?? []
	for (const label of preferred) {
		const hit = detections.find((d) => d.baseLabel === label)
		if (hit) return hit.id
	}
	return detections[0]?.id ?? null
}

export function MaterialLibrary() {
	const [allMaterials, setAllMaterials] = useState<Material[]>([])
	const [category, setCategory] = useState('')
	const [search, setSearch] = useState('')
	const detectionResult = useVisualizerStore((s) => s.detectionResult)
	const selectedRegionId = useVisualizerStore((s) => s.selectedRegionId)
	const setSelectedRegionId = useVisualizerStore((s) => s.setSelectedRegionId)
	const setSelectedMaterial = useVisualizerStore((s) => s.setSelectedMaterial)
	const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl)
	const renderedImageUrl = useVisualizerStore((s) => s.renderedImageUrl)
	const setRenderedImageUrl = useVisualizerStore((s) => s.setRenderedImageUrl)
	const applyMaterial = useVisualizerStore((s) => s.applyMaterial)
	const clearMaterial = useVisualizerStore((s) => s.clearMaterial)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)
	const selectedDetection =
		detectionResult?.detections.find((d) => d.label === selectedRegionId) ?? null
	const canApply = Boolean(selectedDetection?.maskUrl)
	const detectionLabels = (detectionResult?.detections ?? []).map((d) => d.label)
	const detectionMeta = detectionLabels.map((label) => ({
		id: label,
		baseLabel: getBaseLabel(label),
	}))
	const selectedRegionBase = selectedRegionId ? getBaseLabel(selectedRegionId) : null
	const scopeLabels = selectedRegionBase
		? [selectedRegionBase]
		: detectionMeta.map((d) => d.baseLabel)
	const scopeKey = scopeLabels.join('|')
	const allowedCategories = useMemo(
		() => getAllowedCategories(scopeLabels),
		[scopeKey],
	)
	const visibleCategories =
		allowedCategories.size > 0
			? CATEGORIES.filter((c) => c.value === '' || allowedCategories.has(c.value))
			: CATEGORIES

	useEffect(() => {
		listMaterials(category || undefined, search || undefined).then((list) => {
			setAllMaterials(list)
		})
	}, [category, search])

	useEffect(() => {
		if (allowedCategories.size > 0 && category && !allowedCategories.has(category)) {
			setCategory('')
			return
		}
	}, [allowedCategories, category])

	const materials = useMemo(() => {
		const filtered =
			allowedCategories.size > 0
				? allMaterials.filter((m) => allowedCategories.has(m.category))
				: allMaterials
		if (!selectedRegionBase) return filtered
		return filtered.filter((m) => {
			const appliesTo = (m.metadata?.appliesTo as string[] | undefined) ?? []
			return appliesTo.length === 0 || appliesTo.includes(selectedRegionBase)
		})
	}, [allMaterials, allowedCategories, selectedRegionBase])

	const handleCategoryClick = (nextCategory: string) => {
		setCategory(nextCategory)
		if (!nextCategory) return
		const regionId = pickRegionIdForCategory(nextCategory, detectionMeta)
		if (regionId) setSelectedRegionId(regionId)
	}

	const handleMaterialSelect = (material: Material) => {
		if (selectedRegionId && !canApply) return
		setSelectedMaterial(material)
		const regionId =
			selectedRegionId ?? pickRegionIdForCategory(category, detectionMeta)
		if (!regionId) return
		applyMaterial(regionId, material)
		setSelectedRegionId(regionId)
		// Photorealistic render (local GPU diffusion)
		const detection = detectionResult?.detections.find((d) => d.label === regionId)
		if (material.assetUrl && detection?.maskUrl && roomImageUrl) {
			const prompt = `${material.name} ${regionId} texture, realistic, photo`
			renderTexture({
				imageUrl: renderedImageUrl ?? roomImageUrl,
				maskUrl: detection.maskUrl,
				prompt,
				uploadId: detectionResult?.uploadId ?? 'render',
				label: regionId,
			})
				.then((res) => {
					setRenderedImageUrl(res.renderedUrl)
				})
				.catch(() => {})
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
				<input
					type="search"
					placeholder="Search…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
				/>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{visibleCategories.map((c) => (
						<button
							key={c.value}
							type="button"
							onClick={() => handleCategoryClick(c.value)}
							className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
								category === c.value
									? 'bg-teal-600 text-white dark:bg-teal-600'
									: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
							}`}
						>
							{c.label}
						</button>
					))}
				</div>
				{selectedRegionId && (
					<div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/80">
						<span className="truncate text-[11px] text-slate-600 dark:text-slate-400">
							To <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRegionId}</span>
						</span>
						<button
							type="button"
							onClick={() => clearMaterial(selectedRegionId)}
							disabled={!appliedMaterials[selectedRegionId]}
							className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
						>
							Reset
						</button>
					</div>
				)}
			{selectedRegionId && !canApply && (
				<div className="mt-2 rounded-lg border border-orange-200/80 bg-orange-50/80 px-2.5 py-1.5 text-[11px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-900/20 dark:text-orange-200">
					Texture not available for this surface. Select a dashed outline.
				</div>
			)}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-2.5">
				<div className="grid grid-cols-3 gap-2">
					{materials.map((m) => (
						<MaterialCard
							key={m.id}
							material={m}
							onSelect={handleMaterialSelect}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
