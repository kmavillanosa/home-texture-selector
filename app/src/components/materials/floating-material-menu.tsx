import { useEffect, useRef, useState } from 'react'
import { useVisualizerStore } from '../../store/visualizer-store'
import { MaterialLibrary } from './material-library'

export function FloatingMaterialMenu() {
	const selectedRegionId = useVisualizerStore((s) => s.selectedRegionId)
	const setSelectedRegionId = useVisualizerStore((s) => s.setSelectedRegionId)
	const clearAllMaterials = useVisualizerStore((s) => s.clearAllMaterials)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)
	const hasAnyApplied = Object.keys(appliedMaterials).length > 0
	const panelRef = useRef<HTMLDivElement>(null)
	const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 })
	const dragStateRef = useRef<{
		isDragging: boolean
		startX: number
		startY: number
		originX: number
		originY: number
	}>({
		isDragging: false,
		startX: 0,
		startY: 0,
		originX: 0,
		originY: 0,
	})

	useEffect(() => {
		if (!selectedRegionId) return
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setSelectedRegionId(null)
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedRegionId, setSelectedRegionId])

	useEffect(() => {
		const handlePointerMove = (e: PointerEvent) => {
			if (!dragStateRef.current.isDragging) return
			const nextX = dragStateRef.current.originX + (e.clientX - dragStateRef.current.startX)
			const nextY = dragStateRef.current.originY + (e.clientY - dragStateRef.current.startY)
			setPanelOffset({ x: nextX, y: nextY })
		}
		const handlePointerUp = () => {
			dragStateRef.current.isDragging = false
		}
		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}
	}, [])

	if (!selectedRegionId) return null

	return (
		<div
			className="pointer-events-none fixed inset-0 z-40"
			aria-modal="true"
			aria-label="Material options"
		>
			<div
				ref={panelRef}
				className="pointer-events-auto absolute left-56 top-24 ml-3 flex max-h-[75vh] w-full max-w-74 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
				style={{
					height: 'min(75vh, 22rem)',
					transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)`,
				}}
			>
				<div
					className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1.5 dark:border-slate-700"
					onPointerDown={(e) => {
						if ((e.target as HTMLElement).closest('button')) return
						dragStateRef.current.isDragging = true
						dragStateRef.current.startX = e.clientX
						dragStateRef.current.startY = e.clientY
						dragStateRef.current.originX = panelOffset.x
						dragStateRef.current.originY = panelOffset.y
					}}
					style={{ cursor: 'move', touchAction: 'none' }}
				>
					<h2 className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
						{selectedRegionId}
					</h2>
					<div className="flex items-center gap-1">
						{hasAnyApplied && (
							<button
								type="button"
								onClick={clearAllMaterials}
								className="rounded-md px-1.5 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
								aria-label="Reset all textures"
							>
								Reset all
							</button>
						)}
						<button
							type="button"
							onClick={() => setSelectedRegionId(null)}
							className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
							aria-label="Close menu"
						>
							<CloseIcon className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					<MaterialLibrary />
				</div>
			</div>
		</div>
	)
}

function CloseIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M18 6L6 18M6 6l12 12" />
		</svg>
	)
}
