import { useState, useCallback } from 'react'
import { useVisualizerStore } from '../../store/visualizer-store'
import { createProject } from '../../api/client'

export function SaveShare() {
	const [saving, setSaving] = useState(false)
	const [shareUrl, setShareUrl] = useState<string | null>(null)
	const [projectName, setProjectName] = useState('My room')
	const [saved, setSaved] = useState(false)

	const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl)
	const detectionResult = useVisualizerStore((s) => s.detectionResult)

	const handleSave = useCallback(async () => {
		if (!roomImageUrl || !detectionResult) return
		setSaving(true)
		try {
			const project = await createProject({
				name: projectName,
				roomImageUrl,
				detectionResult,
			})
			const url = `${window.location.origin}/visualizer?project=${project.id}`
			setShareUrl(url)
			setSaved(true)
			try {
				await navigator.clipboard.writeText(url)
			} catch {
				// ignore
			}
		} catch {
			// ignore
		} finally {
			setSaving(false)
		}
	}, [roomImageUrl, detectionResult, projectName])

	const handleCopyShare = useCallback(() => {
		if (!shareUrl) return
		navigator.clipboard.writeText(shareUrl)
	}, [shareUrl])

	const canSave = roomImageUrl && detectionResult

	return (
		<div className="flex flex-wrap items-center gap-3">
			<input
				type="text"
				value={projectName}
				onChange={(e) => setProjectName(e.target.value)}
				placeholder="Project name"
				className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
			/>
			<button
				type="button"
				onClick={handleSave}
				disabled={!canSave || saving}
				className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 dark:bg-teal-600 dark:hover:bg-teal-500"
			>
				{saving ? 'Saving…' : 'Save & share'}
			</button>
			{saved && shareUrl && (
				<>
					<span className="text-xs font-medium text-slate-500 dark:text-slate-400">
						Link copied
					</span>
					<button
						type="button"
						onClick={handleCopyShare}
						className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Copy again
					</button>
				</>
			)}
		</div>
	)
}
