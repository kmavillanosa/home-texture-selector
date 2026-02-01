import { Link } from 'react-router-dom'

export function HomePage() {
	return (
		<div className="landing-grid landing-grid-major min-h-screen w-full flex flex-col items-center justify-center px-4 py-16 sm:py-24">
			<div className="mx-auto max-w-2xl text-center">
				<h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl sm:leading-tight">
					See your room with new materials
				</h1>
				<p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
					Upload a photo. We detect walls, floors, and surfaces—then try flooring,
					paint, tiles, and wallpapers in real time.
				</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-3">
					<Link
						to="/upload"
						className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
					>
						Upload room
					</Link>
				</div>
				<ul className="mt-16 grid max-w-xl gap-4 text-left text-slate-600 dark:text-slate-400 sm:mx-auto sm:max-w-2xl sm:grid-cols-2">
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" aria-hidden>✓</span>
						<span>Auto wall & floor detection</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" aria-hidden>✓</span>
						<span>Material library: flooring, paint, tiles, wallpapers</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" aria-hidden>✓</span>
						<span>Real-time preview with zoom & pan</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" aria-hidden>✓</span>
						<span>Save, share & download</span>
					</li>
				</ul>
			</div>
		</div>
	)
}
