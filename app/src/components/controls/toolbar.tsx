import { useVisualizerStore } from '../../store/visualizer-store'

export function Toolbar() {
	const resetView = useVisualizerStore((s) => s.resetView)
	const clearAllMaterials = useVisualizerStore((s) => s.clearAllMaterials)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)
	const hasAnyApplied = Object.keys(appliedMaterials).length > 0

	return (
		<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
			<button
				type="button"
				onClick={resetView}
				className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
				title="Fit view"
				aria-label="Reset zoom and pan to fit"
			>
				<ResetViewIcon />
				<span>Fit</span>
			</button>
			{hasAnyApplied && (
				<button
					type="button"
					onClick={clearAllMaterials}
					className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
					title="Remove all applied textures"
					aria-label="Reset all textures"
				>
					<ResetAllIcon />
					<span>Reset all</span>
				</button>
			)}
		</div>
	)
}

function ResetViewIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
		</svg>
	)
}

function ResetAllIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			<line x1="10" y1="11" x2="10" y2="17" />
			<line x1="14" y1="11" x2="14" y2="17" />
		</svg>
	)
}
