import { useCallback, useRef } from 'react'

interface ImageUploadZoneProps {
	files: File[]
	onFileSelect: (files: File[]) => void
	accept: string
	maxSizeBytes: number
}

export function ImageUploadZone({
	files,
	onFileSelect,
	accept,
	maxSizeBytes,
}: ImageUploadZoneProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			const dropped = Array.from(e.dataTransfer.files ?? [])
			if (dropped.length > 0) onFileSelect(dropped)
		},
		[onFileSelect],
	)
	const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), [])
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const picked = Array.from(e.target.files ?? [])
			onFileSelect(picked)
		},
		[onFileSelect],
	)
	const handleClick = useCallback(() => inputRef.current?.click(), [])

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onKeyDown={(e) => e.key === 'Enter' && handleClick()}
			className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 transition-colors hover:border-teal-400 hover:bg-teal-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-teal-500 dark:hover:bg-teal-900/20"
		>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple
				className="sr-only"
				onChange={handleChange}
				aria-label="Choose room image"
			/>
			{files.length > 0 ? (
				<>
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400">
						<ImageIcon className="h-7 w-7" />
					</div>
					<p className="mt-4 font-semibold text-slate-800 dark:text-slate-100">
						{files.length === 1 ? files[0].name : `${files.length} scenes selected`}
					</p>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Click or drop more images to update selection
					</p>
				</>
			) : (
				<>
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
						<UploadIcon className="h-8 w-8" />
					</div>
					<p className="mt-4 text-base font-medium text-slate-700 dark:text-slate-200">
						Drop your image here or click to browse
					</p>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						JPEG or PNG, max {(maxSizeBytes / 1024 / 1024).toFixed(0)}MB
					</p>
				</>
			)}
		</div>
	)
}

function UploadIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	)
}

function ImageIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</svg>
	)
}
