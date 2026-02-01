/** Max long edge for upload (speeds upload + API decode and inference). */
const MAX_DIMENSION = 1440
const JPEG_QUALITY = 0.82

/**
 * Resize image file to max dimension on long edge, output as JPEG.
 * Skips resize if already small; returns original for non-image types.
 */
export function resizeImageForUpload(file: File): Promise<File> {
	if (!file.type.startsWith('image/')) {
		return Promise.resolve(file)
	}
	return new Promise((resolve) => {
		const img = new Image()
		const url = URL.createObjectURL(file)
		img.onload = () => {
			URL.revokeObjectURL(url)
			const w = img.naturalWidth
			const h = img.naturalHeight
			if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
				resolve(file)
				return
			}
			const scale = MAX_DIMENSION / Math.max(w, h)
			const dw = Math.round(w * scale)
			const dh = Math.round(h * scale)
			const canvas = document.createElement('canvas')
			canvas.width = dw
			canvas.height = dh
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				resolve(file)
				return
			}
			ctx.drawImage(img, 0, 0, dw, dh)
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						resolve(file)
						return
					}
					const name = file.name.replace(/\.(png|webp|gif)$/i, '.jpg')
					resolve(new File([blob], name, { type: 'image/jpeg' }))
				},
				'image/jpeg',
				JPEG_QUALITY,
			)
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			resolve(file)
		}
		img.src = url
	})
}
