import { useRef, useCallback } from 'react'
import { useVisualizerStore } from '../../store/visualizer-store'

const COLOR_APPLY_ALPHA = 0.9

const hexToRgba = (hex: string, alpha: number) => {
	const cleaned = hex.replace('#', '').trim()
	const value =
		cleaned.length === 3
			? cleaned
					.split('')
					.map((c) => c + c)
					.join('')
			: cleaned
	const r = Number.parseInt(value.slice(0, 2), 16)
	const g = Number.parseInt(value.slice(2, 4), 16)
	const b = Number.parseInt(value.slice(4, 6), 16)
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DownloadPreview() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl)
	const renderedImageUrl = useVisualizerStore((s) => s.renderedImageUrl)
	const detectionResult = useVisualizerStore((s) => s.detectionResult)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)

	const handleDownload = useCallback(async () => {
		const canvas = canvasRef.current
		const baseImageUrl = renderedImageUrl ?? roomImageUrl
		if (!canvas || !baseImageUrl || !detectionResult) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const roomImg = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.src = baseImageUrl.startsWith('http')
				? baseImageUrl
				: baseImageUrl
			img.onload = () => resolve(img)
			img.onerror = reject
		})

		const w = roomImg.naturalWidth
		const h = roomImg.naturalHeight
		canvas.width = w
		canvas.height = h
		ctx.drawImage(roomImg, 0, 0)

		const detections = detectionResult.detections ?? []
		if (!renderedImageUrl && detections.length > 0) {
			const maskUrls = detections
				.map((d) => d.maskUrl)
				.filter(Boolean) as string[]
			const maskImages = await Promise.all(
				[...new Set(maskUrls)].map(
					(url) =>
						new Promise<HTMLImageElement>((resolve, reject) => {
							const img = new Image()
							img.crossOrigin = 'anonymous'
							img.onload = () => resolve(img)
							img.onerror = reject
							img.src = url
						}),
				),
			)
			const urlToImg = Object.fromEntries(
				[...new Set(maskUrls)].map((url, i) => [url, maskImages[i]]),
			)
			detections.forEach((d) => {
				const applied = appliedMaterials[d.label]
				if (!applied || !d.maskUrl || !urlToImg[d.maskUrl]) return
				const maskImg = urlToImg[d.maskUrl]
				const overlay = document.createElement('canvas')
				overlay.width = maskImg.naturalWidth
				overlay.height = maskImg.naturalHeight
				const octx = overlay.getContext('2d')
				if (!octx) return
				octx.fillStyle = hexToRgba(applied.color, COLOR_APPLY_ALPHA)
				octx.fillRect(0, 0, overlay.width, overlay.height)
				octx.globalCompositeOperation = 'destination-in'
				octx.drawImage(maskImg, 0, 0)
				ctx.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, w, h)
			})
		}

		const link = document.createElement('a')
		link.download = 'room-preview.png'
		link.href = canvas.toDataURL('image/png')
		link.click()
	}, [roomImageUrl, renderedImageUrl, detectionResult, appliedMaterials])

	const canDownload = (renderedImageUrl ?? roomImageUrl) && detectionResult

	return (
		<>
			<canvas ref={canvasRef} className="hidden" width={1} height={1} />
			<button
				type="button"
				onClick={handleDownload}
				disabled={!canDownload}
				className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
			>
				Download
			</button>
		</>
	)
}
