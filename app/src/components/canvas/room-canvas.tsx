import { useEffect, useRef, useCallback, useState } from 'react'
import { useVisualizerStore } from '../../store/visualizer-store'
import type { Detection } from '../../types'

const LABEL_FONT =
	'600 12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const LABEL_PADDING_X = 8
const LABEL_ROW = 22
const LABEL_RADIUS = 9
const LABEL_BG = 'rgba(15, 23, 42, 0.8)'
const LABEL_STROKE = 'rgba(255, 255, 255, 0.16)'
const LABEL_COLOR = '#f8fafc'
const LABEL_SHADOW = 'rgba(15, 23, 42, 0.35)'
const HOVER_FILL = 'rgba(34, 197, 94, 0.35)'
const HOVER_STROKE = 'rgba(34, 197, 94, 0.9)'
const HOVER_DASH = [8, 5]
const SELECTED_GROUP_FILL = 'rgba(14, 116, 144, 0.25)'
const SELECTED_GROUP_STROKE = 'rgba(14, 116, 144, 0.85)'
const SELECTED_GROUP_DASH = [6, 4]
const COLOR_APPLY_ALPHA = 0.9
const TEXTURE_SILHOUETTE_ALPHA = 0.6
const ILLUM_SILHOUETTE_ALPHA = 0.5
const VISIBLE_LABELS = new Set([
	'Wall',
	'Floor',
	'Ceiling',
	'Cabinet',
	'Shelf',
	'Countertop',
	'Backsplash',
])

/** Trace outer boundary of mask alpha (threshold > 0) using Moore neighborhood. */
function traceMaskContour(
	maskImg: HTMLImageElement,
): { x: number; y: number }[] {
	const w = maskImg.naturalWidth
	const h = maskImg.naturalHeight
	const canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h
	const ctx = canvas.getContext('2d')
	if (!ctx) return []
	ctx.drawImage(maskImg, 0, 0)
	const data = ctx.getImageData(0, 0, w, h).data
	const alpha = (i: number, j: number) =>
		i >= 0 && i < h && j >= 0 && j < w ? data[(i * w + j) * 4 + 3] : 0
	const isFg = (i: number, j: number) => alpha(i, j) > 0
	const isBg = (i: number, j: number) => alpha(i, j) === 0
	// 8-neighbor deltas: N, NE, E, SE, S, SW, W, NW
	const dr = [-1, -1, 0, 1, 1, 1, 0, -1]
	const dc = [0, 1, 1, 1, 0, -1, -1, -1]
	let r0 = -1,
		c0 = -1,
		d0 = -1
	for (let i = 0; i < h && r0 < 0; i++) {
		for (let j = 0; j < w && r0 < 0; j++) {
			if (!isFg(i, j)) continue
			if (isBg(i - 1, j)) {
				r0 = i
				c0 = j
				d0 = 4
				break
			}
			if (isBg(i + 1, j)) {
				r0 = i
				c0 = j
				d0 = 0
				break
			}
			if (isBg(i, j - 1)) {
				r0 = i
				c0 = j
				d0 = 2
				break
			}
			if (isBg(i, j + 1)) {
				r0 = i
				c0 = j
				d0 = 6
				break
			}
		}
	}
	if (r0 < 0) return []
	const path: { x: number; y: number }[] = []
	let r = r0,
		c = c0,
		d = d0
	do {
		path.push({ x: c + 0.5, y: r + 0.5 })
		let next = -1
		for (let k = 1; k <= 8; k++) {
			const kk = (d + k) % 8
			const nr = r + dr[kk]
			const nc = c + dc[kk]
			if (isFg(nr, nc)) {
				next = kk
				break
			}
		}
		if (next < 0) break
		r += dr[next]
		c += dc[next]
		d = (next + 4) % 8
	} while (path.length < w * h && (r !== r0 || c !== c0))
	return path
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	radius: number,
) {
	const r = Math.min(radius, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + r, y)
	ctx.arcTo(x + w, y, x + w, y + h, r)
	ctx.arcTo(x + w, y + h, x, y + h, r)
	ctx.arcTo(x, y + h, x, y, r)
	ctx.arcTo(x, y, x + w, y, r)
	ctx.closePath()
}

function getBaseLabel(label: string) {
	return label.replace(/\s+\d+$/, '')
}

const defaultMetrics = { dw: 0, dh: 0, fit: 1, baseX: 0, baseY: 0 }

const drawFallbackOverlay = (
	ctx: CanvasRenderingContext2D,
	detection: Detection,
	width: number,
	height: number,
) => {
	ctx.fillStyle = HOVER_FILL
	ctx.strokeStyle = HOVER_STROKE
	ctx.lineWidth = 2
	ctx.setLineDash(HOVER_DASH)
	if (detection.polygon && detection.polygon.length >= 3) {
		ctx.beginPath()
		detection.polygon.forEach((point, index) => {
			const x = (point.x / 100) * width
			const y = (point.y / 100) * height
			if (index === 0) ctx.moveTo(x, y)
			else ctx.lineTo(x, y)
		})
		ctx.closePath()
		ctx.fill()
		ctx.stroke()
		return
	}
	const x = (detection.bbox.x / 100) * width
	const y = (detection.bbox.y / 100) * height
	const w = (detection.bbox.width / 100) * width
	const h = (detection.bbox.height / 100) * height
	if (detection.shape === 'ellipse') {
		ctx.beginPath()
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
		ctx.fill()
		ctx.stroke()
		return
	}
	ctx.fillRect(x, y, w, h)
	ctx.strokeRect(x, y, w, h)
}


const drawSelectedGroupOverlay = (
	ctx: CanvasRenderingContext2D,
	detection: Detection,
	width: number,
	height: number,
) => {
	ctx.fillStyle = SELECTED_GROUP_FILL
	ctx.strokeStyle = SELECTED_GROUP_STROKE
	ctx.lineWidth = 2
	ctx.setLineDash(SELECTED_GROUP_DASH)
	if (detection.polygon && detection.polygon.length >= 3) {
		ctx.beginPath()
		detection.polygon.forEach((point, index) => {
			const x = (point.x / 100) * width
			const y = (point.y / 100) * height
			if (index === 0) ctx.moveTo(x, y)
			else ctx.lineTo(x, y)
		})
		ctx.closePath()
		ctx.fill()
		ctx.stroke()
		return
	}
	const x = (detection.bbox.x / 100) * width
	const y = (detection.bbox.y / 100) * height
	const w = (detection.bbox.width / 100) * width
	const h = (detection.bbox.height / 100) * height
	if (detection.shape === 'ellipse') {
		ctx.beginPath()
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
		ctx.fill()
		ctx.stroke()
		return
	}
	ctx.fillRect(x, y, w, h)
	ctx.strokeRect(x, y, w, h)
}

const getPolygonCentroid = (points: { x: number; y: number }[]) => {
	let area = 0
	let cx = 0
	let cy = 0
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const p1 = points[j]
		const p2 = points[i]
		const cross = p1.x * p2.y - p2.x * p1.y
		area += cross
		cx += (p1.x + p2.x) * cross
		cy += (p1.y + p2.y) * cross
	}
	if (area === 0) {
		const avg = points.reduce(
			(acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
			{ x: 0, y: 0 },
		)
		return { x: avg.x / points.length, y: avg.y / points.length }
	}
	const scale = 1 / (3 * area)
	return { x: cx * scale, y: cy * scale }
}

const getLabelAnchor = (detection: Detection) => {
	if (detection.polygon && detection.polygon.length >= 3) {
		return getPolygonCentroid(detection.polygon)
	}
	return {
		x: detection.bbox.x + detection.bbox.width / 2,
		y: detection.bbox.y + detection.bbox.height / 2,
	}
}

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

export function RoomCanvas() {
	const containerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const renderMetricsRef = useRef(defaultMetrics)
	const maskOverlayRef = useRef<Record<string, HTMLCanvasElement>>({})

	const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl)
	const selectedRegionId = useVisualizerStore((s) => s.selectedRegionId)
	const renderedImageUrl = useVisualizerStore((s) => s.renderedImageUrl)
	const detectionResult = useVisualizerStore((s) => s.detectionResult)
	const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials)
	const setSelectedRegionId = useVisualizerStore((s) => s.setSelectedRegionId)
	const scale = useVisualizerStore((s) => s.scale)
	const pan = useVisualizerStore((s) => s.pan)

	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const labelBoundsRef = useRef<
		{ index: number; x: number; y: number; width: number; height: number }[]
	>([])
	const baseCacheRef = useRef<HTMLCanvasElement | null>(null)
	const baseCacheKeyRef = useRef<string>('')

	const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null)
	const loadedImageRef = useRef<HTMLImageElement | null>(null)
	const hasAutoFittedRef = useRef(false)
	const [croppedImages, setCroppedImages] = useState<
		Record<string, HTMLImageElement>
	>({})
	const croppedUrls = ((detectionResult?.detections ?? [])
		.map((d) => d.croppedUrl)
		.filter(Boolean) ?? []) as string[]
	const croppedUrlKey = `${detectionResult?.uploadId ?? ''}-cropped-${
		croppedUrls.length
	}`
	const [maskImages, setMaskImages] = useState<
		Record<string, HTMLImageElement>
	>({})
	const maskUrls = ((detectionResult?.detections ?? [])
		.map((d) => d.maskUrl)
		.filter(Boolean) ?? []) as string[]
	const maskUrlKey = `${detectionResult?.uploadId ?? ''}-mask-${
		maskUrls.length
	}`
	const [illuminationImage, setIlluminationImage] =
		useState<HTMLImageElement | null>(null)
	const illuminationUrl = detectionResult?.illuminationMapUrl ?? ''

	useEffect(() => {
		loadedImageRef.current = loadedImage
	}, [loadedImage])

	const displayImageUrl = renderedImageUrl ?? roomImageUrl

	useEffect(() => {
		if (!displayImageUrl) {
			setLoadedImage(null)
			hasAutoFittedRef.current = false
			return
		}
		hasAutoFittedRef.current = false
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.src = displayImageUrl.startsWith('http')
			? displayImageUrl
			: displayImageUrl
		img.onload = () => setLoadedImage(img)
		img.onerror = () => setLoadedImage(null)
		return () => setLoadedImage(null)
	}, [displayImageUrl])

	useEffect(() => {
		if (croppedUrls.length === 0) {
			setCroppedImages({})
			return
		}
		setCroppedImages({})
		const urls = [...new Set(croppedUrls)]
		urls.forEach((url) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.onload = () => setCroppedImages((prev) => ({ ...prev, [url]: img }))
			img.onerror = () => {}
			img.src = url
		})
	}, [croppedUrlKey])

	useEffect(() => {
		if (maskUrls.length === 0) {
			setMaskImages({})
			return
		}
		setMaskImages({})
		const urls = [...new Set(maskUrls)]
		urls.forEach((url) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.onload = () => setMaskImages((prev) => ({ ...prev, [url]: img }))
			img.onerror = () => {}
			img.src = url
		})
	}, [maskUrlKey])

	useEffect(() => {
		if (!illuminationUrl) {
			setIlluminationImage(null)
			return
		}
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => setIlluminationImage(img)
		img.onerror = () => setIlluminationImage(null)
		img.src = illuminationUrl
		return () => setIlluminationImage(null)
	}, [illuminationUrl])

	const [textureImages, setTextureImages] = useState<
		Record<string, HTMLImageElement>
	>({})
	const textureUrls = Object.values(appliedMaterials)
		.map((m) => m.assetUrl)
		.filter(Boolean) as string[]
	const textureUrlKey = `${textureUrls.length}-${textureUrls.join('|')}`

	useEffect(() => {
		if (textureUrls.length === 0) {
			setTextureImages({})
			return
		}
		const urls = [...new Set(textureUrls)]
		setTextureImages((prev) => {
			const next: Record<string, HTMLImageElement> = { ...prev }
			urls.forEach((url) => {
				if (next[url]) return
				const img = new Image()
				img.crossOrigin = 'anonymous'
				img.onload = () =>
					setTextureImages((p) => ({
						...p,
						[url]: img,
					}))
				img.onerror = () => {}
				img.src = url
			})
			return next
		})
	}, [textureUrlKey])

	const getMaskOverlay = useCallback(
		(maskUrl: string, maskImg: HTMLImageElement) => {
			const existing = maskOverlayRef.current[maskUrl]
			if (existing) return existing
			const canvas = document.createElement('canvas')
			canvas.width = maskImg.naturalWidth
			canvas.height = maskImg.naturalHeight
			const ctx = canvas.getContext('2d')
			if (!ctx) return canvas
			ctx.fillStyle = HOVER_FILL
			ctx.fillRect(0, 0, canvas.width, canvas.height)
			ctx.globalCompositeOperation = 'destination-in'
			ctx.drawImage(maskImg, 0, 0)
			ctx.globalCompositeOperation = 'source-over'
			const contour = traceMaskContour(maskImg)
			if (contour.length >= 2) {
				ctx.strokeStyle = HOVER_STROKE
				ctx.lineWidth = 2
				ctx.setLineDash(HOVER_DASH)
				ctx.beginPath()
				ctx.moveTo(contour[0].x, contour[0].y)
				for (let i = 1; i < contour.length; i++) {
					ctx.lineTo(contour[i].x, contour[i].y)
				}
				ctx.closePath()
				ctx.stroke()
			}
			maskOverlayRef.current[maskUrl] = canvas
			return canvas
		},
		[],
	)

	const getTintedMaskOverlay = useCallback(
		(maskUrl: string, color: string, maskImg: HTMLImageElement) => {
			const key = `${maskUrl}::${color}`
			const existing = maskOverlayRef.current[key]
			if (existing) return existing
			const canvas = document.createElement('canvas')
			canvas.width = maskImg.naturalWidth
			canvas.height = maskImg.naturalHeight
			const ctx = canvas.getContext('2d')
			if (!ctx) return canvas
			ctx.fillStyle = hexToRgba(color, COLOR_APPLY_ALPHA)
			ctx.fillRect(0, 0, canvas.width, canvas.height)
			ctx.globalCompositeOperation = 'destination-in'
			ctx.drawImage(maskImg, 0, 0)
			maskOverlayRef.current[key] = canvas
			return canvas
		},
		[],
	)

	const getTexturedMaskOverlay = useCallback(
		(
			maskUrl: string,
			textureUrl: string,
			maskImg: HTMLImageElement,
			textureImg: HTMLImageElement,
			_roomImg: HTMLImageElement | null,
			detection: Detection,
		) => {
			const illumKey = illuminationImage?.src ?? ''
			const key = `${maskUrl}::tex::${textureUrl}::silhouette::${illumKey}`
			const existing = maskOverlayRef.current[key]
			if (existing) return existing
			const canvas = document.createElement('canvas')
			canvas.width = maskImg.naturalWidth
			canvas.height = maskImg.naturalHeight
			const ctx = canvas.getContext('2d')
			if (!ctx) return canvas
			const w = canvas.width
			const h = canvas.height
			// Draw texture silhouette (subtle overlay)
			ctx.globalCompositeOperation = 'source-over'
			ctx.globalAlpha = TEXTURE_SILHOUETTE_ALPHA
			const surfaceW = (detection.bbox.width / 100) * w
			const surfaceH = (detection.bbox.height / 100) * h
			const repeats = 4
			const scaleX = surfaceW / (textureImg.naturalWidth * repeats)
			const scaleY = surfaceH / (textureImg.naturalHeight * repeats)
			const textureScale = Math.max(scaleX, scaleY, 0.1)

			// Build a full-canvas texture fill (scaled + rotated), then optionally warp for floors
			const textureCanvas = document.createElement('canvas')
			textureCanvas.width = w
			textureCanvas.height = h
			const tctx = textureCanvas.getContext('2d')
			if (!tctx) return canvas
			const pattern = tctx.createPattern(textureImg, 'repeat')
			if (pattern && 'setTransform' in pattern) {
				pattern.setTransform(
					new DOMMatrix()
						.scale(textureScale)
				)
			}
			tctx.save()
			if (!('setTransform' in (pattern as unknown as { setTransform?: unknown })) && pattern) {
				// Fallback: scale context if pattern.setTransform is unavailable
				tctx.scale(textureScale, textureScale)
				tctx.fillStyle = pattern
				tctx.fillRect(0, 0, w / textureScale, h / textureScale)
			} else if (pattern) {
				tctx.fillStyle = pattern
				tctx.fillRect(0, 0, w, h)
			}
			tctx.restore()

			// Default: straight texture fill
			ctx.drawImage(textureCanvas, 0, 0)
			if (illuminationImage) {
				ctx.globalCompositeOperation = 'multiply'
				ctx.globalAlpha = ILLUM_SILHOUETTE_ALPHA
				ctx.drawImage(illuminationImage, 0, 0, w, h)
			}
			ctx.globalAlpha = 1
			ctx.globalCompositeOperation = 'destination-in'
			ctx.drawImage(maskImg, 0, 0)
			maskOverlayRef.current[key] = canvas
			return canvas
		},
		[illuminationImage],
	)

	const getBaseCacheKey = useCallback(
		(width: number, height: number, dw: number, dh: number) => {
			const detectionKey =
				detectionResult?.detections
					.map((d) => `${d.label}:${d.maskUrl ?? ''}:${d.croppedUrl ?? ''}`)
					.join('|') ?? ''
			const materialsKey = Object.keys(appliedMaterials)
				.sort()
				.map((key) => {
					const m = appliedMaterials[key]
					return `${key}:${m.materialId}:${m.assetUrl}:${m.color}`
				})
				.join('|')
			const illumKey = illuminationImage?.src ?? ''
			const scaleKey = `${useVisualizerStore.getState().scale}:${useVisualizerStore.getState().pan.x}:${useVisualizerStore.getState().pan.y}`
			return [
				width,
				height,
				dw,
				dh,
				loadedImage?.src ?? '',
				detectionKey,
				materialsKey,
				illumKey,
				scaleKey,
			].join('::')
		},
		[appliedMaterials, detectionResult, illuminationImage, loadedImage],
	)

	const draw = useCallback(
		(ctx: CanvasRenderingContext2D, width: number, height: number) => {
			const { scale: s, pan: p } = useVisualizerStore.getState()
			ctx.clearRect(0, 0, width, height)
			if (!loadedImage) return

			const iw = loadedImage.naturalWidth
			const ih = loadedImage.naturalHeight
			const fit = Math.min(width / iw, height / ih, 1)
			const dw = iw * fit
			const dh = ih * fit
			const baseX = (width - dw) / 2
			const baseY = (height - dh) / 2
			renderMetricsRef.current = { dw, dh, fit, baseX, baseY }

			const detections = detectionResult?.detections ?? []
			if (detections.length === 0) return

			const baseKey = getBaseCacheKey(width, height, dw, dh)
			if (baseCacheKeyRef.current !== baseKey) {
				baseCacheKeyRef.current = baseKey
				if (!baseCacheRef.current) {
					baseCacheRef.current = document.createElement('canvas')
				}
				const baseCanvas = baseCacheRef.current
				baseCanvas.width = width
				baseCanvas.height = height
				const bctx = baseCanvas.getContext('2d')
				if (bctx) {
					bctx.clearRect(0, 0, width, height)
					// 1. Base layer: uploaded image (scale pivot at image center)
					bctx.save()
					bctx.translate(p.x + baseX, p.y + baseY)
					bctx.translate(dw / 2, dh / 2)
					bctx.scale(s, s)
					bctx.translate(-dw / 2, -dh / 2)
					bctx.drawImage(loadedImage, 0, 0, dw, dh)
					bctx.restore()

					// 2. Result layers: all detected objects as layers on top
					const bboxCenterY = (d: { bbox: { y: number; height: number } }) =>
						d.bbox.y + d.bbox.height / 2
					const layerOrder = (
						a: { bbox: { y: number; height: number } },
						b: { bbox: { y: number; height: number } },
					) => bboxCenterY(b) - bboxCenterY(a)
					const sortedForLayers = [...detections].sort(layerOrder)
					bctx.save()
					bctx.translate(p.x + baseX, p.y + baseY)
					bctx.translate(dw / 2, dh / 2)
					bctx.scale(s, s)
					bctx.translate(-dw / 2, -dh / 2)
					sortedForLayers.forEach((d) => {
						if (d.croppedUrl && croppedImages[d.croppedUrl]) {
							const cropImg = croppedImages[d.croppedUrl]
							const cropX = (d.bbox.x / 100) * dw
							const cropY = (d.bbox.y / 100) * dh
							const cropW = (d.bbox.width / 100) * dw
							const cropH = (d.bbox.height / 100) * dh
							bctx.drawImage(
								cropImg,
								0,
								0,
								cropImg.naturalWidth,
								cropImg.naturalHeight,
								cropX,
								cropY,
								cropW,
								cropH,
							)
						}
					})
					bctx.restore()

					// 2.5 Applied materials (persistent)
					bctx.save()
					bctx.translate(p.x + baseX, p.y + baseY)
					bctx.translate(dw / 2, dh / 2)
					bctx.scale(s, s)
					bctx.translate(-dw / 2, -dh / 2)
					sortedForLayers.forEach((d) => {
						const applied = appliedMaterials[d.label]
						if (!applied) return
						if (d.maskUrl && maskImages[d.maskUrl]) {
							if (applied.assetUrl && textureImages[applied.assetUrl]) {
								const overlay = getTexturedMaskOverlay(
									d.maskUrl,
									applied.assetUrl,
									maskImages[d.maskUrl],
									textureImages[applied.assetUrl],
									loadedImage,
									d,
								)
								bctx.globalCompositeOperation = 'source-over'
								bctx.globalAlpha = 1
								bctx.drawImage(
									overlay,
									0,
									0,
									overlay.width,
									overlay.height,
									0,
									0,
									dw,
									dh,
								)
								bctx.globalAlpha = 1
								return
							}
							const overlay = getTintedMaskOverlay(
								d.maskUrl,
								applied.color,
								maskImages[d.maskUrl],
							)
							bctx.drawImage(
								overlay,
								0,
								0,
								overlay.width,
								overlay.height,
								0,
								0,
								dw,
								dh,
							)
							return
						}
						bctx.fillStyle = hexToRgba(applied.color, COLOR_APPLY_ALPHA)
						bctx.strokeStyle = hexToRgba(applied.color, 0.9)
						bctx.lineWidth = 2
						drawFallbackOverlay(bctx, d, dw, dh)
					})
					bctx.restore()
				}
			}

			if (baseCacheRef.current) {
				ctx.drawImage(baseCacheRef.current, 0, 0, width, height)
			}

			// 3. Hover highlight overlay
			if (hoveredIndex !== null && detections[hoveredIndex]) {
				const detection = detections[hoveredIndex]
				const base = getBaseLabel(detection.label)
				ctx.save()
				ctx.translate(p.x + baseX, p.y + baseY)
				ctx.translate(dw / 2, dh / 2)
				ctx.scale(s, s)
				ctx.translate(-dw / 2, -dh / 2)
				detections.forEach((d) => {
					if (getBaseLabel(d.label) !== base) return
					if (d.maskUrl && maskImages[d.maskUrl]) {
						const maskImg = maskImages[d.maskUrl]
						const overlay = getMaskOverlay(d.maskUrl, maskImg)
						ctx.globalCompositeOperation = 'source-over'
						ctx.globalAlpha = 0.8
						ctx.drawImage(
							overlay,
							0,
							0,
							overlay.width,
							overlay.height,
							0,
							0,
							dw,
							dh,
						)
						ctx.globalAlpha = 1
						return
					}
					drawSelectedGroupOverlay(ctx, d, dw, dh)
				})
				ctx.restore()
			}

			// 4. Labels on top
			ctx.save()
			ctx.translate(p.x + baseX, p.y + baseY)
			ctx.translate(dw / 2, dh / 2)
			ctx.scale(s, s)
			ctx.translate(-dw / 2, -dh / 2)
			ctx.font = LABEL_FONT
			ctx.textAlign = 'left'
			ctx.textBaseline = 'middle'
			labelBoundsRef.current = []
			detections.forEach((d, index) => {
				const baseLabel = getBaseLabel(d.label)
				if (!VISIBLE_LABELS.has(baseLabel)) return
				if (
					selectedRegionId &&
					getBaseLabel(selectedRegionId) !== baseLabel
				)
					return
				const showScore = d.score < 0.999
				const displayLabel = getBaseLabel(d.label)
				const label = showScore
					? `${displayLabel} ${(d.score * 100).toFixed(0)}%`
					: displayLabel
				const tw = ctx.measureText(label).width
				const w = tw + LABEL_PADDING_X * 2
				const h = LABEL_ROW
				const anchor = getLabelAnchor(d)
				const labelX = Math.max(
					0,
					Math.min(dw - w, (anchor.x / 100) * dw - w / 2),
				)
				const labelY = Math.max(
					0,
					Math.min(dh - h, (anchor.y / 100) * dh - h - 6),
				)
				ctx.save()
				ctx.shadowColor = LABEL_SHADOW
				ctx.shadowBlur = 10
				ctx.shadowOffsetY = 2
				drawRoundedRect(ctx, labelX, labelY, w, h, LABEL_RADIUS)
				ctx.fillStyle = LABEL_BG
				ctx.fill()
				ctx.shadowBlur = 0
				ctx.strokeStyle = LABEL_STROKE
				ctx.lineWidth = 1
				ctx.stroke()
				ctx.restore()
				ctx.fillStyle = LABEL_COLOR
				ctx.fillText(label, labelX + LABEL_PADDING_X, labelY + h / 2)
				labelBoundsRef.current.push({
					index,
					x: labelX,
					y: labelY,
					width: w,
					height: h,
				})
			})
			ctx.restore()
		},
		[
			loadedImage,
			detectionResult,
			appliedMaterials,
			croppedImages,
			hoveredIndex,
			maskImages,
			getMaskOverlay,
			getTintedMaskOverlay,
			getTexturedMaskOverlay,
			textureImages,
			selectedRegionId,
		],
	)

	useEffect(() => {
		const container = containerRef.current
		const canvas = canvasRef.current
		if (!container || !canvas) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const dpr = window.devicePixelRatio ?? 1
		const resize = () => {
			const w = container.clientWidth
			const h = container.clientHeight
			canvas.width = w * dpr
			canvas.height = h * dpr
			canvas.style.width = `${w}px`
			canvas.style.height = `${h}px`
			ctx.setTransform(1, 0, 0, 1, 0, 0)
			ctx.scale(dpr, dpr)
			// Auto-fit once when we have image and valid container size (fixes cropped first paint)
			if (
				w > 0 &&
				h > 0 &&
				loadedImageRef.current &&
				!hasAutoFittedRef.current
			) {
				hasAutoFittedRef.current = true
				useVisualizerStore.getState().resetView()
			}
			draw(ctx, w, h)
		}
		resize()
		const ro = new ResizeObserver(resize)
		ro.observe(container)
		return () => ro.disconnect()
	}, [draw])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const w = canvas.width / (window.devicePixelRatio ?? 1)
		const h = canvas.height / (window.devicePixelRatio ?? 1)
		draw(ctx, w, h)
	}, [draw])

	/* Zoom is managed by Fit button only; no wheel zoom to avoid accidental changes */
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (e.button !== 0) return
	}, [])
	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			const canvas = canvasRef.current
			const detections = detectionResult?.detections ?? []
			if (!canvas || detections.length === 0) {
				if (hoveredIndex !== null) setHoveredIndex(null)
				return
			}
			const rect = canvas.getBoundingClientRect()
			const metrics = renderMetricsRef.current
			const pointerX =
				(e.clientX - rect.left - (pan.x + metrics.baseX) - metrics.dw / 2) /
					scale +
				metrics.dw / 2
			const pointerY =
				(e.clientY - rect.top - (pan.y + metrics.baseY) - metrics.dh / 2) /
					scale +
				metrics.dh / 2
			const labels = labelBoundsRef.current
			let nextIndex: number | null = null
			for (let i = labels.length - 1; i >= 0; i -= 1) {
				const label = labels[i]
				if (
					pointerX >= label.x &&
					pointerX <= label.x + label.width &&
					pointerY >= label.y &&
					pointerY <= label.y + label.height
				) {
					nextIndex = label.index
					break
				}
			}
			if (nextIndex !== hoveredIndex) setHoveredIndex(nextIndex)
		},
		[detectionResult, hoveredIndex, pan, scale],
	)
	const handleMouseUp = useCallback(() => {}, [])
	const handleMouseLeave = useCallback(() => {
		setHoveredIndex(null)
	}, [])

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			if (!detectionResult) return
			const canvas = canvasRef.current
			if (!canvas) return
			const rect = canvas.getBoundingClientRect()
			const metrics = renderMetricsRef.current
			const pointerX =
				(e.clientX - rect.left - (pan.x + metrics.baseX) - metrics.dw / 2) /
					scale +
				metrics.dw / 2
			const pointerY =
				(e.clientY - rect.top - (pan.y + metrics.baseY) - metrics.dh / 2) /
					scale +
				metrics.dh / 2
			const labels = labelBoundsRef.current
			let nextIndex: number | null = null
			for (let i = labels.length - 1; i >= 0; i -= 1) {
				const label = labels[i]
				if (
					pointerX >= label.x &&
					pointerX <= label.x + label.width &&
					pointerY >= label.y &&
					pointerY <= label.y + label.height
				) {
					nextIndex = label.index
					break
				}
			}
			if (nextIndex === null) return
			const detection = detectionResult.detections[nextIndex]
			if (!detection) return
			e.preventDefault()
			e.stopPropagation()
			setHoveredIndex(nextIndex)
			setSelectedRegionId(detection.label)
		},
		[detectionResult, pan, scale, setSelectedRegionId],
	)

	if (!roomImageUrl || !detectionResult) {
		return (
			<div className="flex h-full min-h-[400px] items-center justify-center bg-slate-50">
				<p className="text-sm text-slate-500">
					No room image. Upload an image to analyze surfaces automatically.
				</p>
			</div>
		)
	}

	if (detectionResult.detectionFailed) {
		return (
			<div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 bg-slate-50 p-6">
				<p className="text-center font-medium text-slate-700">
					Surface detection unavailable
				</p>
				<p className="text-center text-sm text-slate-500">
					Segmentation runs via a Python worker. Set <code className="rounded bg-slate-200 px-1">USE_PYTHON_SEGMENTATION=true</code> in <code className="rounded bg-slate-200 px-1">api/.env</code>, install <code className="rounded bg-slate-200 px-1">api/python/requirements.txt</code>, and check the API server logs.
				</p>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			role="application"
			aria-label="Room preview. Click a label to select a surface."
			title="Click labels to select surfaces."
			tabIndex={-1}
			className="relative h-full min-h-[400px] overflow-hidden bg-slate-50 outline-none"
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseLeave}
			onClick={handleClick}
			style={{
				cursor:
					hoveredIndex !== null &&
					detectionResult?.detections?.[hoveredIndex]?.maskUrl
						? 'pointer'
						: hoveredIndex !== null
							? 'not-allowed'
							: 'default',
				backgroundImage:
					'linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
				backgroundSize: '24px 24px',
			}}
		>
			<canvas ref={canvasRef} className="block h-full w-full" tabIndex={-1} />
		</div>
	)
}
