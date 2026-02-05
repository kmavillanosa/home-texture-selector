import { useRef, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import { useVisualizerStore } from '../../store/visualizer-store'
import { listMaterials } from '../../api/client'
import type { Scene, Material, Detection } from '../../types'
import type { AppliedMaterial } from '../../store/visualizer-store'

const COLOR_APPLY_ALPHA = 0.9
const REPORT_TITLE = 'AnyoHaus Materials Report'

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

const getBaseLabel = (label: string) => label.replace(/\s+\d+$/, '')

const loadImage = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = url
	})

const normalizeAppliedMaterials = (
	applied: Scene['appliedMaterials'] | undefined,
	materialsById: Map<string, Material>,
) => {
	const out: Record<string, AppliedMaterial> = {}
	if (!applied) return out
	Object.entries(applied).forEach(([label, value]) => {
		if (value && typeof value === 'object' && 'materialId' in value) {
			out[label] = value as AppliedMaterial
			return
		}
		if (typeof value === 'string') {
			const match = materialsById.get(value)
			if (match) {
				out[label] = {
					materialId: match.id,
					color: (match.metadata?.color as string) ?? '#e2e8f0',
					assetUrl: match.assetUrl,
					rotation: 0,
				}
			}
		}
	})
	return out
}

const getTextureScale = (
	detection: Detection,
	textureImg: HTMLImageElement,
	width: number,
	height: number,
) => {
	const bbox = detection.bbox
	if (!bbox || !textureImg.naturalWidth || !textureImg.naturalHeight) return 1
	const surfaceW = (bbox.width / 100) * width
	const surfaceH = (bbox.height / 100) * height
	const repeats = 4
	const tileW = Math.max(surfaceW / repeats, 48)
	const tileH = Math.max(surfaceH / repeats, 48)
	const scaleX = tileW / textureImg.naturalWidth
	const scaleY = tileH / textureImg.naturalHeight
	return Math.min(scaleX, scaleY, 1)
}

const buildSceneImage = async (
	scene: Scene,
	materialsById: Map<string, Material>,
) => {
	const roomImg = await loadImage(scene.roomImageUrl)
	const w = roomImg.naturalWidth
	const h = roomImg.naturalHeight
	const canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas not available')
	ctx.drawImage(roomImg, 0, 0)

	const detectionResult = scene.detectionResult
	if (!detectionResult) {
		return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h }
	}

	const appliedMaterials = normalizeAppliedMaterials(
		scene.appliedMaterials,
		materialsById,
	)
	const detections = detectionResult.detections ?? []
	const maskUrls = detections.map((d) => d.maskUrl).filter(Boolean) as string[]
	const uniqueMaskUrls = [...new Set(maskUrls)]
	const maskImages = await Promise.allSettled(uniqueMaskUrls.map(loadImage))
	const maskMap = new Map<string, HTMLImageElement>()
	maskImages.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			maskMap.set(uniqueMaskUrls[index], result.value)
		}
	})

	const textureUrls = [
		...new Set(
			Object.values(appliedMaterials)
				.map((m) => m.assetUrl)
				.filter(Boolean),
		),
	]
	const textureImages = await Promise.allSettled(textureUrls.map(loadImage))
	const textureMap = new Map<string, HTMLImageElement>()
	textureImages.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			textureMap.set(textureUrls[index], result.value)
		}
	})

	detections.forEach((d) => {
		const applied = appliedMaterials[d.label]
		if (!applied || !d.maskUrl) return
		const maskImg = maskMap.get(d.maskUrl)
		if (!maskImg) return
		const overlay = document.createElement('canvas')
		overlay.width = maskImg.naturalWidth
		overlay.height = maskImg.naturalHeight
		const octx = overlay.getContext('2d')
		if (!octx) return

		if (applied.assetUrl && textureMap.has(applied.assetUrl)) {
			const textureImg = textureMap.get(applied.assetUrl)!
			const textureScale = getTextureScale(d, textureImg, overlay.width, overlay.height)
			const rotationDeg = applied.rotation ?? 0
			const rotationRad = (rotationDeg * Math.PI) / 180
			octx.save()
			const pattern = octx.createPattern(textureImg, 'repeat')
			if (pattern && 'setTransform' in pattern) {
				pattern.setTransform(
					new DOMMatrix().scale(textureScale).rotate(rotationDeg),
				)
			}
			if (
				!('setTransform' in (pattern as unknown as { setTransform?: unknown })) &&
				pattern
			) {
				octx.translate(overlay.width / 2, overlay.height / 2)
				octx.rotate(rotationRad)
				octx.scale(textureScale, textureScale)
				octx.fillStyle = pattern
				octx.fillRect(
					-overlay.width / (2 * textureScale),
					-overlay.height / (2 * textureScale),
					overlay.width / textureScale,
					overlay.height / textureScale,
				)
			} else if (pattern) {
				octx.fillStyle = pattern
				octx.fillRect(0, 0, overlay.width, overlay.height)
			}
			octx.restore()
		} else {
			octx.fillStyle = hexToRgba(applied.color, COLOR_APPLY_ALPHA)
			octx.fillRect(0, 0, overlay.width, overlay.height)
		}

		octx.globalCompositeOperation = 'destination-in'
		octx.drawImage(maskImg, 0, 0)
		ctx.globalCompositeOperation = 'multiply'
		ctx.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, w, h)
		ctx.globalCompositeOperation = 'source-over'
	})

	return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h }
}

export function DownloadPreview({ scenes }: { scenes: Scene[] }) {
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

	const handleDownloadReport = useCallback(async () => {
		if (!scenes || scenes.length === 0) return
		const materials = await listMaterials()
		const materialsById = new Map(materials.map((m) => [m.id, m]))
		const doc = new jsPDF({ unit: 'pt', format: 'a4' })
		const pageWidth = doc.internal.pageSize.getWidth()
		const pageHeight = doc.internal.pageSize.getHeight()
		const margin = 48
		const maxImageHeight = pageHeight * 0.45

		for (let i = 0; i < scenes.length; i += 1) {
			const scene = scenes[i]
			if (i > 0) doc.addPage()

			doc.setFont('helvetica', 'bold')
			doc.setFontSize(18)
			doc.text(REPORT_TITLE, margin, margin)
			doc.setFontSize(12)
			doc.text(
				scene.name || `Scene ${i + 1}`,
				margin,
				margin + 24,
			)

			const imageData = await buildSceneImage(scene, materialsById)
			const scale = Math.min(
				(pageWidth - margin * 2) / imageData.width,
				maxImageHeight / imageData.height,
			)
			const imgW = imageData.width * scale
			const imgH = imageData.height * scale
			const imgX = (pageWidth - imgW) / 2
			const imgY = margin + 48
			doc.addImage(imageData.dataUrl, 'JPEG', imgX, imgY, imgW, imgH)
			doc.setDrawColor(226, 232, 240)
			doc.rect(imgX, imgY, imgW, imgH)

			const applied = normalizeAppliedMaterials(
				scene.appliedMaterials,
				materialsById,
			)
			const surfaceMap = new Map<
				string,
				AppliedMaterial | undefined
			>()
			scene.detectionResult?.detections.forEach((d) => {
				const base = getBaseLabel(d.label)
				if (!surfaceMap.has(base)) {
					surfaceMap.set(base, applied[d.label])
				}
			})

			const lines: string[] = []
			surfaceMap.forEach((material, base) => {
				if (!material) {
					lines.push(`${base}: None`)
					return
				}
				const match = materialsById.get(material.materialId)
				if (material.assetUrl) {
					const name =
						match?.name ??
						material.assetUrl.split('/').pop()?.split('?')[0] ??
						'Texture'
					lines.push(`${base}: ${name}`)
					return
				}
				const name = match?.name ?? 'Color'
				lines.push(`${base}: ${name} (${material.color})`)
			})

			doc.setFont('helvetica', 'bold')
			doc.setFontSize(12)
			let cursorY = imgY + imgH + 28
			doc.text('Materials used', margin, cursorY)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(11)
			cursorY += 14
			lines.forEach((line) => {
				doc.text(line, margin, cursorY)
				cursorY += 14
			})

			const notes = scene.notes?.trim() || 'No notes'
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(12)
			cursorY += 10
			doc.text('Notes', margin, cursorY)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(11)
			const noteLines = doc.splitTextToSize(
				notes,
				pageWidth - margin * 2,
			)
			doc.text(noteLines, margin, cursorY + 14)
		}

		doc.save('materials-report.pdf')
	}, [scenes])

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
			<button
				type="button"
				onClick={handleDownloadReport}
				disabled={!scenes || scenes.length === 0}
				className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
			>
				Download report
			</button>
		</>
	)
}
