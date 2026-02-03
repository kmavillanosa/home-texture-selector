import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisualizerStore } from '../store/visualizer-store'
import { uploadRoomImage, segmentRoom, createProject } from '../api/client'
import { ImageUploadZone } from '../components/upload/image-upload-zone'
import { resizeImageForUpload } from '../utils/resize-image'
import type { Scene } from '../types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_SIZE_MB = 10
const LAST_PROJECT_KEY = 'room-visualizer:last-project'

export function UploadPage() {
	const navigate = useNavigate()
	const setRoomImage = useVisualizerStore((s) => s.setRoomImage)
	const setDetectionResult = useVisualizerStore((s) => s.setDetectionResult)
	const setHideHeader = useVisualizerStore((s) => s.setHideHeader)

	const [files, setFiles] = useState<File[]>([])
	const [previewUrls, setPreviewUrls] = useState<string[]>([])
	const [error, setError] = useState<string | null>(null)
	const [isAnalyzing, setIsAnalyzing] = useState(false)
	const [progressTotal, setProgressTotal] = useState(0)
	const [progressDone, setProgressDone] = useState(0)
	const runningRef = useRef(false)

	const handleFileSelect = useCallback((selected: File[]) => {
		setError(null)
		if (!selected || selected.length === 0) {
			setFiles([])
			setPreviewUrls([])
			return
		}
		const next: File[] = []
		const errors: string[] = []
		selected.forEach((file) => {
			if (!ALLOWED_TYPES.includes(file.type)) {
				errors.push(`${file.name} is not a JPEG or PNG.`)
				return
			}
			if (file.size > MAX_SIZE_MB * 1024 * 1024) {
				errors.push(`${file.name} exceeds ${MAX_SIZE_MB}MB.`)
				return
			}
			next.push(file)
		})
		if (errors.length > 0) {
			setError(errors[0])
		}
		setFiles(next)
		setPreviewUrls(next.map((file) => URL.createObjectURL(file)))
	}, [])

	useEffect(() => {
		const shouldHideHeader = previewUrls.length > 0 || isAnalyzing
		setHideHeader(shouldHideHeader)
		return () => setHideHeader(false)
	}, [isAnalyzing, previewUrls.length, setHideHeader])

	useEffect(() => {
		return () => {
			previewUrls.forEach((url) => URL.revokeObjectURL(url))
		}
	}, [previewUrls])

	useEffect(() => {
		if (files.length === 0 || runningRef.current) return
		runningRef.current = true
		setIsAnalyzing(true)
		setProgressTotal(files.length)
		setProgressDone(0)
		setError(null)
		;(async () => {
			try {
				const scenes: Scene[] = []
				for (let i = 0; i < files.length; i += 1) {
					const file = files[i]
					const toUpload = await resizeImageForUpload(file)
					const { roomImageUrl, uploadId } = await uploadRoomImage(toUpload)
					const result = await segmentRoom({ uploadId, imageUrl: roomImageUrl })
					scenes.push({
						id: uploadId,
						name: file.name || `Scene ${i + 1}`,
						roomImageUrl,
						detectionResult: result,
						appliedMaterials: {},
					})
					setProgressDone(i + 1)
					if (i === 0) {
						setRoomImage(roomImageUrl)
						setDetectionResult(result)
					}
				}
				if (scenes.length === 0) {
					throw new Error('No valid images to process.')
				}
				let projectId: string | null = null
				try {
					const project = await createProject({
						name:
							files.length === 1
								? files[0]?.name || 'Untitled room'
								: 'Multi-scene project',
						roomImageUrl: scenes[0].roomImageUrl,
						detectionResult: scenes[0].detectionResult,
						scenes,
					})
					projectId = project.id
					localStorage.setItem(LAST_PROJECT_KEY, projectId)
				} catch (projectErr) {
					console.error('Failed to create project', projectErr)
				}
				if (projectId) {
					navigate(`/visualizer?project=${projectId}`, { replace: true })
				} else {
					navigate('/visualizer', { replace: true })
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Upload or analysis failed.')
			} finally {
				setIsAnalyzing(false)
				setProgressTotal(0)
				setProgressDone(0)
				runningRef.current = false
			}
		})()
	}, [files, navigate, setRoomImage, setDetectionResult])

	return (
		<div className="relative flex h-full w-full items-center justify-center px-4 py-10 sm:px-8">
			{previewUrls.length > 0 && (
				<div className="absolute inset-0 z-0 bg-slate-950/95">
					<img
						src={previewUrls[0]}
						alt="Uploaded room preview"
						className="h-full w-full object-cover"
					/>
					{previewUrls.length > 1 && (
						<div className="absolute right-4 top-4 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white">
							{previewUrls.length} scenes
						</div>
					)}
				</div>
			)}
			<div className="relative z-10 w-full max-w-3xl">
				<div className="mb-8">
					<p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
						Upload your room
					</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
						Add a room photo
					</h1>
					<p className="mt-3 text-slate-600 dark:text-slate-400">
						Drop or choose a photo and we'll detect walls, floors, and surfaces.
						JPEG or PNG, up to {MAX_SIZE_MB}MB.
					</p>
					<div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
						<p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
							Tips for better results:
						</p>
						<ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-emerald-500">✓</span>
								<span>Good lighting helps — natural daylight works best</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-emerald-500">✓</span>
								<span>Make sure walls and surfaces are clearly visible</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-emerald-500">✓</span>
								<span>Avoid extreme shadows or overly bright spots</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 text-emerald-500">✓</span>
								<span>Take the photo from a straight angle if possible</span>
							</li>
						</ul>
					</div>
				</div>
				{!isAnalyzing && (
					<ImageUploadZone
						files={files}
						onFileSelect={handleFileSelect}
						accept={ALLOWED_TYPES.join(',')}
						maxSizeBytes={MAX_SIZE_MB * 1024 * 1024}
					/>
				)}
				{isAnalyzing && (
					<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
						<div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-10 py-8 shadow-lg dark:border-slate-600 dark:bg-slate-800">
							<span className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
							<p className="text-base font-semibold text-slate-800 dark:text-slate-100">
								Analyzing your room…
							</p>
							<p className="text-sm text-slate-500 dark:text-slate-400">
								Detecting walls, floors & surfaces
							</p>
							<div className="w-full">
								<div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
									<span>
										Scene {Math.min(progressDone + 1, progressTotal)} of{' '}
										{Math.max(progressTotal, 1)}
									</span>
									<span>
										{progressTotal > 0
											? Math.round((progressDone / progressTotal) * 100)
											: 0}
										%
									</span>
								</div>
								<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
									<div
										className="h-full rounded-full bg-emerald-500 transition-all duration-300"
										style={{
											width:
												progressTotal > 0
													? `${(progressDone / progressTotal) * 100}%`
													: '0%',
										}}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
				{error && (
					<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
						<p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">
							{error}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}
