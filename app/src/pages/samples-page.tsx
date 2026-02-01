import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSampleGroups } from '../api/client'
import type { SampleGroup } from '../types'

export function SamplesPage() {
	const [groups, setGroups] = useState<SampleGroup[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [requestId, setRequestId] = useState(0)

	useEffect(() => {
		let isMounted = true
		setIsLoading(true)
		listSampleGroups()
			.then((items) => {
				if (!isMounted) return
				setGroups(items)
				setError(null)
			})
			.catch((err) => {
				if (!isMounted) return
				setError(
					err instanceof Error ? err.message : 'Unable to load sample groups',
				)
			})
			.finally(() => {
				if (!isMounted) return
				setIsLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [requestId])

	const totalSamples = groups.reduce((sum, g) => sum + g.samples.length, 0)

	return (
		<div className="min-h-screen w-full bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 sm:py-10 lg:px-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 sm:gap-10">
				{/* Hero */}
				<section className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-8 sm:py-10">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
						<div className="max-w-2xl">
							<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
								Sample rooms
							</p>
							<h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
								Explore real spaces with instant material swaps
							</h1>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
								Open a group as multiple scenes in the visualizer, or pick a
								single room.
							</p>
							<div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
								<span className="rounded-full border border-emerald-100/80 bg-emerald-50/60 px-3 py-1 dark:border-emerald-900/40 dark:bg-emerald-950/40">
									Multi-scene batches
								</span>
								<span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-950">
									Instant preview
								</span>
								<span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-950">
									Real room photos
								</span>
							</div>
						</div>
						{!isLoading && groups.length > 0 && (
							<div className="shrink-0 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
								{groups.length} groups · {totalSamples} rooms
							</div>
						)}
					</div>
				</section>

				{/* Content */}
				{isLoading && (
					<div className="flex flex-col gap-8">
						{[1, 2].map((g) => (
							<div key={`group-skeleton-${g}`} className="flex flex-col gap-4">
								<div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
									{Array.from({ length: 4 }).map((_, i) => (
										<div
											key={`skeleton-${g}-${i}`}
											className="flex flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900/60"
										>
											<div className="aspect-4/3 w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
											<div className="flex flex-col gap-2 p-3 sm:p-4">
												<div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
												<div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}

				{!isLoading && error && (
					<section className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center dark:border-rose-900/50 dark:bg-rose-900/20">
						<p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
						<button
							type="button"
							onClick={() => setRequestId((id) => id + 1)}
							className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/30"
						>
							Try again
						</button>
					</section>
				)}

				{!isLoading && !error && groups.length === 0 && (
					<section className="rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-sm text-slate-600 dark:text-slate-400">
							No sample groups available yet.
						</p>
					</section>
				)}

				{!isLoading && !error && groups.length > 0 && (
					<div className="flex flex-col gap-10">
						{groups.map((group) => (
							<section
								key={group.groupId}
								aria-label={group.name}
								className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h2 className="text-lg font-semibold text-slate-900 dark:text-white">
											{group.name}
										</h2>
										<p className="text-xs text-slate-500 dark:text-slate-400">
											{group.samples.length} scenes · Open as a full batch or pick one.
										</p>
									</div>
									<Link
										to={`/visualizer?project=${group.groupId}`}
										className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-emerald-900/60"
									>
										Open batch →
									</Link>
								</div>
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
									{group.samples.map((sample, index) => (
										<Link
											key={sample.id}
											to={`/visualizer?project=${sample.id}`}
											className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-emerald-800/80"
										>
											<div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
												<img
													src={sample.roomImageUrl}
													alt=""
													className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
													loading="lazy"
												/>
												<span className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:left-3 sm:top-3 sm:text-xs">
													{index + 1}
												</span>
												<div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
											</div>
											<div className="flex flex-col gap-1 p-3 sm:p-4">
												<h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
													{sample.name}
												</h3>
												<span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
													Open single room →
												</span>
											</div>
										</Link>
									))}
								</div>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
