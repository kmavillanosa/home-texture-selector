import type { Material } from '../../types'
import { useVisualizerStore } from '../../store/visualizer-store'

interface MaterialCardProps {
	material: Material
	onSelect: (material: Material) => void
}

export function MaterialCard({ material, onSelect }: MaterialCardProps) {
	const selectedMaterial = useVisualizerStore((s) => s.selectedMaterial)

	const isSelected = selectedMaterial?.id === material.id

	const handleClick = () => {
		onSelect(material)
	}

	const color = (material.metadata?.color as string) ?? '#e2e8f0'
	const isTexture = Boolean(material.assetUrl)

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`flex flex-col items-stretch rounded-lg border-2 p-1.5 text-left transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 active:scale-[0.97] ${
				isSelected
					? 'border-teal-500 bg-teal-50/90 ring-2 ring-teal-500/20 dark:bg-teal-900/20 dark:ring-teal-400/25'
					: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800/40'
			}`}
		>
			<div
				className="aspect-square w-full shrink-0 rounded-md border border-slate-200/80 dark:border-slate-600"
				style={{
					backgroundColor: color,
					backgroundImage: isTexture ? `url(${material.assetUrl})` : undefined,
					backgroundSize: isTexture ? 'cover' : undefined,
					backgroundPosition: isTexture ? 'center' : undefined,
				}}
			/>
			<span className="mt-1 w-full truncate text-center text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-200">
				{material.name}
			</span>
		</button>
	)
}
