import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { uploadMobileImage } from '../api/client'

export function MobileUploadPage() {
	const [searchParams] = useSearchParams()
	const sessionId = searchParams.get('session') ?? ''
	const [photos, setPhotos] = useState<File[]>([])
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isSending, setIsSending] = useState(false)
	const [isConverting, setIsConverting] = useState(false)

	const convertHeicToJpeg = async (file: File) => {
		const { default: heic2any } = await import('heic2any')
		const blob = (await heic2any({
			blob: file,
			toType: 'image/jpeg',
			quality: 0.92,
		})) as Blob
		const name = file.name.replace(/\.[^.]+$/, '.jpg')
		return new File([blob], name, { type: 'image/jpeg' })
	}

	const getImageSize = (file: File) =>
		new Promise<{ width: number; height: number }>((resolve, reject) => {
			const url = URL.createObjectURL(file)
			const img = new Image()
			img.onload = () => {
				URL.revokeObjectURL(url)
				resolve({ width: img.width, height: img.height })
			}
			img.onerror = () => {
				URL.revokeObjectURL(url)
				reject(new Error('Failed to read image size.'))
			}
			img.src = url
		})

	const handleFileChange = async (files: FileList | null) => {
		if (!files || files.length === 0) return
		setError(null)
		setIsConverting(true)
		try {
			const incoming = Array.from(files)
			const normalized = await Promise.all(
				incoming.map(async (file) => {
					if (file.type === 'image/heic' || file.type === 'image/heif') {
						return convertHeicToJpeg(file)
					}
					return file
				}),
			)
			const allowed = ['image/jpeg', 'image/png']
			const invalid = normalized.find((file) => !allowed.includes(file.type))
			if (invalid) {
				setError('Only JPEG or PNG are supported.')
				return
			}
			const sizes = await Promise.all(normalized.map(getImageSize))
			const landscape = normalized.filter((_, index) => {
				const { width, height } = sizes[index]
				return width >= height
			})
			if (landscape.length === 0) {
				setError('Please take landscape photos (rotate your phone).')
				return
			}
			if (landscape.length !== normalized.length) {
				setError('Some photos were skipped because they are portrait.')
			}
			setPhotos((prev) => [...prev, ...landscape])
		} catch {
			setError('Failed to convert HEIC image. Please try again.')
		} finally {
			setIsConverting(false)
		}
	}

	const previews = useMemo(
		() => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
		[photos],
	)

	useEffect(() => {
		return () => {
			previews.forEach((item) => URL.revokeObjectURL(item.url))
		}
	}, [previews])

	const handleSend = async () => {
		if (!sessionId || photos.length === 0) return
		setIsSending(true)
		setMessage(null)
		try {
			await Promise.all(photos.map((file) => uploadMobileImage(sessionId, file)))
			setPhotos([])
			setMessage('Sent! You can return to your desktop session.')
		} catch (err) {
			setMessage(err instanceof Error ? err.message : 'Upload failed.')
		} finally {
			setIsSending(false)
		}
	}

	return (
		<div className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
			<div className="mx-auto hidden w-full max-w-md flex-col gap-6 md:flex">
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						Mobile only
					</p>
					<h1 className="mt-2 text-xl font-semibold text-slate-900">
						Open this link on your phone
					</h1>
					<p className="mt-2 text-sm text-slate-500">
						Use your mobile camera to capture room photos.
					</p>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-md flex-col gap-6 md:hidden">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
						Mobile capture
					</p>
					<h1 className="mt-2 text-2xl font-semibold text-slate-900">
						Capture room photos
					</h1>
					<p className="mt-2 text-sm text-slate-600">
						Take photos on your phone and send them back to the desktop
						session.
					</p>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between text-xs text-slate-500">
						<span>Session</span>
						<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
							{sessionId || 'Unknown'}
						</span>
					</div>
					<label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-700 transition-colors hover:border-emerald-400 hover:text-emerald-700">
						<input
							type="file"
							accept="image/*"
							capture="environment"
							multiple
							className="hidden"
							onChange={(event) => handleFileChange(event.target.files)}
						/>
						<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
							Add photos
						</span>
						<span className="text-xs text-slate-500">
							Tap to use your camera or pick from gallery
						</span>
					</label>
				</div>

				{previews.length > 0 && (
					<div className="grid grid-cols-3 gap-2">
						{previews.map(({ file, url }) => (
							<div
								key={`${file.name}-${file.lastModified}`}
								className="relative aspect-square overflow-hidden rounded-xl border border-slate-200"
							>
								<img
									src={url}
									alt={file.name}
									className="h-full w-full object-cover"
								/>
							</div>
						))}
					</div>
				)}

				<button
					type="button"
					onClick={handleSend}
					disabled={photos.length === 0 || !sessionId || isSending || isConverting}
					className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
				>
					{isConverting
						? 'Converting…'
						: isSending
							? 'Sending…'
							: 'Send to desktop'}
				</button>

				{error && (
					<p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
						{error}
					</p>
				)}
				{message && (
					<p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
						{message}
					</p>
				)}
			</div>
		</div>
	)
}
