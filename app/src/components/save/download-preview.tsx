import { useRef, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import { useVisualizerStore } from '../../store/visualizer-store'
import { listMaterials } from '../../api/client'
import type { Scene, Material, Detection } from '../../types'
import type { AppliedMaterial } from '../../store/visualizer-store'

const COLOR_APPLY_ALPHA = 0.9
const REPORT_TITLE = 'AnyoHaus Materials Report'
const REPORT_ACCENT = [16, 185, 129] as const
const REPORT_TEXT = [15, 23, 42] as const
const REPORT_MUTED = [100, 116, 139] as const
const REPORT_BORDER = [226, 232, 240] as const
const REPORT_HEADER_BG = [248, 250, 252] as const

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

const hexToRgb = (hex: string) => {
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
	return [r, g, b] as const
}

const buildTextureThumbnail = (img: HTMLImageElement, size = 96) => {
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) return canvas.toDataURL('image/png')
	const pattern = ctx.createPattern(img, 'repeat')
	if (pattern) {
		ctx.fillStyle = pattern
		ctx.fillRect(0, 0, size, size)
	} else {
		ctx.drawImage(img, 0, 0, size, size)
	}
	return canvas.toDataURL('image/png')
}

const formatReportDate = () =>
	new Date().toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
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
						scale: 1,
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
	scale: number,
) => {
	const bbox = detection.bbox
	if (!bbox || !textureImg.naturalWidth || !textureImg.naturalHeight) return 1
	const surfaceW = (bbox.width / 100) * width
	const surfaceH = (bbox.height / 100) * height
	const repeats = 4
	const tileW = Math.max(surfaceW / repeats, 48) * scale
	const tileH = Math.max(surfaceH / repeats, 48) * scale
	const scaleX = tileW / textureImg.naturalWidth
	const scaleY = tileH / textureImg.naturalHeight
	return Math.min(scaleX, scaleY)
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
			const textureScale = getTextureScale(
				d,
				textureImg,
				overlay.width,
				overlay.height,
				applied.scale ?? 1,
			)
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
		const contentWidth = pageWidth - margin * 2
		const headerHeight = 88
		const imageCardHeight = pageHeight * 0.42
		const cardPadding = 12
		const cardGap = 16
		const cardHeight = 72
		const thumbSize = 48
		const generatedOn = formatReportDate()

		const setTextColor = (color: readonly number[]) => {
			doc.setTextColor(color[0], color[1], color[2])
		}

		const setFillColor = (color: readonly number[]) => {
			doc.setFillColor(color[0], color[1], color[2])
		}

		const setDrawColor = (color: readonly number[]) => {
			doc.setDrawColor(color[0], color[1], color[2])
		}

		const drawHeader = (sceneName: string) => {
			setFillColor(REPORT_HEADER_BG)
			doc.rect(0, 0, pageWidth, headerHeight, 'F')
			setFillColor(REPORT_ACCENT)
			doc.rect(0, 0, 6, headerHeight, 'F')

			setTextColor(REPORT_TEXT)
			doc.setFont('times', 'bold')
			doc.setFontSize(22)
			doc.text(REPORT_TITLE, margin, 36)

			doc.setFont('helvetica', 'normal')
			doc.setFontSize(12)
			doc.text(sceneName, margin, 58)

			setTextColor(REPORT_MUTED)
			doc.setFontSize(10)
			doc.text(`Generated ${generatedOn}`, margin, 74)
		}

		const drawSectionTitle = (title: string, y: number) => {
			setTextColor(REPORT_TEXT)
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(12)
			doc.text(title, margin, y)
		}

		const getMaterialLabel = (material?: AppliedMaterial) => {
			if (!material) return 'None selected'
			const match = materialsById.get(material.materialId)
			if (material.assetUrl) {
				return (
					match?.name ??
					material.assetUrl.split('/').pop()?.split('?')[0] ??
					'Texture'
				)
			}
			const name = match?.name ?? 'Color'
			return `${name} • ${material.color}`
		}

		for (let i = 0; i < scenes.length; i += 1) {
			const scene = scenes[i]
			if (i > 0) doc.addPage()

			drawHeader(scene.name || `Scene ${i + 1}`)

			const imageData = await buildSceneImage(scene, materialsById)
			const imageCardY = headerHeight + 20
			const imageCardW = contentWidth
			const imageCardX = margin

			setFillColor([255, 255, 255])
			setDrawColor(REPORT_BORDER)
			doc.rect(imageCardX, imageCardY, imageCardW, imageCardHeight, 'FD')

			const imageMaxW = imageCardW - cardPadding * 2
			const imageMaxH = imageCardHeight - cardPadding * 2
			const scale = Math.min(
				imageMaxW / imageData.width,
				imageMaxH / imageData.height,
			)
			const imgW = imageData.width * scale
			const imgH = imageData.height * scale
			const imgX = imageCardX + (imageCardW - imgW) / 2
			const imgY = imageCardY + (imageCardHeight - imgH) / 2
			doc.addImage(imageData.dataUrl, 'JPEG', imgX, imgY, imgW, imgH)

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

			const textureUrls = [
				...new Set(
					[...surfaceMap.values()]
						.map((material) => material?.assetUrl)
						.filter(Boolean),
				),
			] as string[]
			const textureImages = await Promise.allSettled(
				textureUrls.map(loadImage),
			)
			const texturePreviewMap = new Map<string, string>()
			textureImages.forEach((result, index) => {
				if (result.status !== 'fulfilled') return
				const preview = buildTextureThumbnail(result.value)
				texturePreviewMap.set(textureUrls[index], preview)
			})

			let cursorY = imageCardY + imageCardHeight + 24
			drawSectionTitle('Selected textures', cursorY)
			cursorY += 12

			const columns = 2
			const cardWidth =
				(contentWidth - cardGap * (columns - 1)) / columns
			let columnIndex = 0
			let rowY = cursorY + 8

			const entries = [...surfaceMap.entries()]
			if (entries.length === 0) {
				setTextColor(REPORT_MUTED)
				doc.setFont('helvetica', 'normal')
				doc.setFontSize(11)
				doc.text(
					'No textures selected for this scene.',
					margin,
					rowY + 12,
				)
				rowY += 28
			}
			for (
				let entryIndex = 0;
				entryIndex < entries.length;
				entryIndex += 1
			) {
				const [base, material] = entries[entryIndex]
				const nextY = rowY + cardHeight
				const overflow = nextY > pageHeight - margin - 120

				if (overflow) {
					doc.addPage()
					drawHeader(scene.name || `Scene ${i + 1}`)
					rowY = headerHeight + 20
					drawSectionTitle('Selected textures (cont.)', rowY)
					rowY += 20
					columnIndex = 0
				}

				const cardX = margin + columnIndex * (cardWidth + cardGap)

				setDrawColor(REPORT_BORDER)
				setFillColor([255, 255, 255])
				doc.rect(cardX, rowY, cardWidth, cardHeight, 'FD')

				const thumbX = cardX + 12
				const thumbY = rowY + (cardHeight - thumbSize) / 2
				if (material?.assetUrl && texturePreviewMap.has(material.assetUrl)) {
					doc.addImage(
						texturePreviewMap.get(material.assetUrl)!,
						'PNG',
						thumbX,
						thumbY,
						thumbSize,
						thumbSize,
					)
				} else if (material?.color) {
					const [r, g, b] = hexToRgb(material.color)
					doc.setFillColor(r, g, b)
					doc.rect(thumbX, thumbY, thumbSize, thumbSize, 'F')
					setDrawColor(REPORT_BORDER)
					doc.rect(thumbX, thumbY, thumbSize, thumbSize)
				} else {
					setFillColor(REPORT_HEADER_BG)
					doc.rect(thumbX, thumbY, thumbSize, thumbSize, 'F')
					setDrawColor(REPORT_BORDER)
					doc.rect(thumbX, thumbY, thumbSize, thumbSize)
				}

				const textX = thumbX + thumbSize + 12
				const textWidth = cardWidth - (textX - cardX) - 12
				setTextColor(REPORT_TEXT)
				doc.setFont('helvetica', 'bold')
				doc.setFontSize(11)
				doc.text(base, textX, rowY + 26)
				doc.setFont('helvetica', 'normal')
				doc.setFontSize(10)
				setTextColor(REPORT_MUTED)
				const details = doc.splitTextToSize(
					getMaterialLabel(material),
					textWidth,
				)
				doc.text(details, textX, rowY + 42)

				columnIndex += 1
				if (columnIndex >= columns) {
					columnIndex = 0
					rowY += cardHeight + 12
				}
			}

			if (columnIndex !== 0) rowY += cardHeight + 12
			cursorY = rowY + 10
			if (cursorY + 80 > pageHeight - margin) {
				doc.addPage()
				drawHeader(scene.name || `Scene ${i + 1}`)
				cursorY = headerHeight + 20
			}
			drawSectionTitle('Notes', cursorY)

			const notes = scene.notes?.trim() || 'No notes'
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(11)
			setTextColor(REPORT_TEXT)
			const noteLines = doc.splitTextToSize(notes, contentWidth)
			doc.text(noteLines, margin, cursorY + 16)
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
