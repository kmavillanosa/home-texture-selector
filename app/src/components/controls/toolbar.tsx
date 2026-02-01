import { useVisualizerStore } from '../../store/visualizer-store'

export function Toolbar() {
	const clearAllMaterials = useVisualizerStore((s) => s.clearAllMaterials)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)
	const hasAnyApplied = Object.keys(appliedMaterials).length > 0


	if(!hasAnyApplied) return null;

	return (
		<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
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

function ResetAllIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			<line x1="10" y1="11" x2="10" y2="17" />
			<line x1="14" y1="11" x2="14" y2="17" />
		</svg>
	)
}
