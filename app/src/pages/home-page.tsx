import { Link } from 'react-router-dom'

export function HomePage() {
	return (
		<div className="landing-grid landing-grid-major relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-16 sm:py-24">
			<div className="absolute right-6 top-6 flex items-center gap-3 text-sm font-semibold">
				<Link
					to="/login"
					className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
				>
					Login
				</Link>
				<Link
					to="/register"
					className="inline-flex items-center justify-center rounded-full border border-emerald-200/80 px-3 py-1 text-emerald-700 transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:text-emerald-100"
				>
					Register
				</Link>
			</div>
			<div className="mx-auto max-w-2xl text-center">
				<h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl sm:leading-tight">
					Design your room in real materials
				</h1>
				<p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
					Upload a photo, we detect your surfaces, then you can preview colors and
					finishes and buy the materials you love.
				</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-3">
					<Link
						to="/upload"
						className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
					>
						Upload room photo
					</Link>
					<Link
						to="/samples"
						className="inline-flex items-center justify-center rounded-xl border border-emerald-200/70 bg-white px-6 py-3.5 text-base font-semibold text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-200 dark:hover:text-emerald-100"
					>
						Try sample rooms
					</Link>
				</div>
				<ul className="mt-16 grid max-w-xl gap-4 text-left text-slate-600 dark:text-slate-400 sm:mx-auto sm:max-w-2xl sm:grid-cols-2">
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Auto wall & floor detection</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Material library: flooring, paint, tiles, wallpapers</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Real-time preview with zoom & pan</span>
					</li>
					<li className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Save, share & download</span>
					</li>
				</ul>
				<section className="mt-16 grid w-full gap-6 text-left sm:mt-20 sm:grid-cols-3">
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Instant visualization
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							See every finish before you buy
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Swap paint, flooring, and tile options in seconds with
							true-to-scale previews.
						</p>
					</div>
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Curated materials
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Shop-ready finishes, organized
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Explore a library of materials and match them to every
							surface in your room.
						</p>
					</div>
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Share faster
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Align decisions with your team
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Send a link or download a preview to keep everyone
							synced on the final look.
						</p>
					</div>
				</section>
				<section className="mt-16 w-full rounded-3xl border border-slate-200/70 bg-white/80 px-6 py-10 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:mt-20 sm:px-10">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
								Vendor partners
							</p>
							<h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
								We are open for vendors
							</h2>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
								Showcase your materials, reach new customers, and
								get discovered inside every room visualization.
							</p>
						</div>
						<Link
							to="/register"
							className="inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/60 dark:bg-slate-950 dark:text-emerald-200 dark:hover:text-emerald-100"
						>
							Become a vendor
						</Link>
					</div>
				</section>
				<section className="mt-16 w-full rounded-3xl border border-emerald-100 bg-emerald-50/80 px-6 py-10 text-left dark:border-emerald-900/60 dark:bg-emerald-900/20 sm:mt-20 sm:px-10">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
								Build with confidence
							</p>
							<h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
								Try a sample room in seconds
							</h2>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
								Start with a preloaded scene to explore the full
								material experience.
							</p>
						</div>
						<Link
							to="/samples"
							className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700"
						>
							Explore samples
						</Link>
					</div>
				</section>
			</div>
			<footer className="mt-16 w-full border-t border-slate-200/70 pt-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
				<div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-4 sm:flex-row">
					<span>© 2026 Anyo Haus Studio. All rights reserved.</span>
					<div className="flex items-center gap-4">
						<Link to="/login" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">
							Login
						</Link>
						<Link to="/register" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">
							Register
						</Link>
						<Link to="/upload" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">
							Start a project
						</Link>
					</div>
				</div>
			</footer>
		</div>
	)
}
