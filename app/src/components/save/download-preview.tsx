import { useRef, useCallback } from 'react'
import { useVisualizerStore } from '../../store/visualizer-store'

export function DownloadPreview() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl)
	const detectionResult = useVisualizerStore((s) => s.detectionResult)

	const handleDownload = useCallback(async () => {
		const canvas = canvasRef.current
		if (!canvas || !roomImageUrl || !detectionResult) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const roomImg = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.src = roomImageUrl.startsWith('http') ? roomImageUrl : roomImageUrl
			img.onload = () => resolve(img)
			img.onerror = reject
		})

		const w = roomImg.naturalWidth
		const h = roomImg.naturalHeight
		canvas.width = w
		canvas.height = h
		ctx.drawImage(roomImg, 0, 0)

		const detections = detectionResult.detections ?? []
		const croppedUrls = detections.map((d) => d.croppedUrl).filter(Boolean) as string[]

		// Layer all detected objects on top (same order as canvas: back-to-front by position)
		if (croppedUrls.length > 0) {
			const bboxCenterY = (d: { bbox: { y: number; height: number } }) =>
				d.bbox.y + d.bbox.height / 2
			const layerOrder = (
				a: { bbox: { y: number; height: number } },
				b: { bbox: { y: number; height: number } },
			) => bboxCenterY(b) - bboxCenterY(a)
			const sorted = [...detections].sort(layerOrder)
			const croppedImages = await Promise.all(
				[...new Set(croppedUrls)].map(
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
				[...new Set(croppedUrls)].map((url, i) => [url, croppedImages[i]]),
			)
			sorted.forEach((d) => {
				if (d.croppedUrl && urlToImg[d.croppedUrl]) {
					const img = urlToImg[d.croppedUrl]
					ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h)
				}
			})
		}

		const LABEL_FONT = '14px sans-serif'
		const LABEL_PADDING = 6
		const LABEL_ROW = 22
		ctx.font = LABEL_FONT
		detections.forEach((d) => {
			const text = `${d.label} ${(d.score * 100).toFixed(0)}%`
			const tw = ctx.measureText(text).width
			const lw = tw + LABEL_PADDING * 2
			const lh = LABEL_ROW
			const lx = (d.bbox.x / 100) * w
			const ly = Math.max(0, (d.bbox.y / 100) * h - lh - 4)
			ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
			ctx.fillRect(lx, ly, lw, lh)
			ctx.fillStyle = '#fff'
			ctx.font = LABEL_FONT
			ctx.fillText(text, lx + LABEL_PADDING, ly + lh - 6)
		})

		const link = document.createElement('a')
		link.download = 'room-preview.png'
		link.href = canvas.toDataURL('image/png')
		link.click()
	}, [roomImageUrl, detectionResult])

	const canDownload = roomImageUrl && detectionResult

	return (
		<>
			<canvas ref={canvasRef} className="hidden" width={1} height={1} />
			<button
				type="button"
				onClick={handleDownload}
				disabled={!canDownload}
				className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
			>
				Download
			</button>
		</>
	)
}
