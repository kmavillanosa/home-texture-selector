import { useVisualizerStore } from '../../store/visualizer-store'
import type { SegmentationRegion } from '../../types'

function regionLabel(region: SegmentationRegion): string {
	const id = region.id
	if (region.label === 'wall') return id.includes('wall-1') ? 'Wall 1' : 'Wall'
	if (region.label === 'floor') return 'Floor'
	if (region.label === 'ceiling') return 'Ceiling'
	if (region.label === 'door_knob') return 'Door knob'
	if (region.label === 'door') return 'Door'
	if (region.label === 'window') return 'Window'
	if (region.label === 'fixture') return 'Fixture'
	return 'Region'
}

export function RegionList() {
	const segmentationResult = useVisualizerStore((s) => s.segmentationResult)
	const selectedRegionId = useVisualizerStore((s) => s.selectedRegionId)
	const setSelectedRegion = useVisualizerStore((s) => s.setSelectedRegion)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)

	if (!segmentationResult?.regions?.length) {
		return (
			<div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
				<h2 className="font-semibold text-slate-800 dark:text-slate-100">
					Regions
				</h2>
				<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
					No regions detected. Analyze a room first.
				</p>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
			<h2 className="border-b border-slate-200 p-3 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
				Regions
			</h2>
			<ul className="flex-1 overflow-y-auto p-2">
				{segmentationResult.regions.map((region) => {
					const isSelected = selectedRegionId === region.id
					const materialId = appliedMaterials[region.id]
					return (
						<li key={region.id}>
							<button
								type="button"
								onClick={() =>
									setSelectedRegion(isSelected ? null : region.id)
								}
								className={`mb-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
									isSelected
										? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/30'
										: 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
								}`}
							>
								<span className="font-medium text-slate-700 dark:text-slate-200">
									{regionLabel(region)}
								</span>
								{materialId && (
									<span className="truncate text-xs text-slate-500 dark:text-slate-400">
										Applied
									</span>
								)}
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
