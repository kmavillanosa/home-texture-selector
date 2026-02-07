import { Link } from 'react-router-dom'

export function HomePage() {
	return (
		<div className="relative min-h-screen w-full overflow-hidden bg-linear-to-b from-emerald-50 via-slate-50 to-white flex flex-col items-center justify-center px-4 py-16 sm:py-24 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
			<div className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-900/30" />
			<div className="pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-900/30" />
			<div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-152 -translate-x-1/2 rounded-full bg-emerald-100/40 blur-3xl dark:bg-emerald-900/30" />
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
			<div className="relative mx-auto max-w-2xl text-center">
				<span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900/70 dark:text-emerald-200">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
					Know it before you paint it
				</span>
				<h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl sm:leading-tight">
					Know it before you paint it
				</h1>
				<p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
					Stop guessing. Upload a photo and preview paint colors and finishes on your
					actual room before you commit.
				</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-3">
					<Link
						to="/upload"
						className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
					>
						Upload your room
					</Link>
					<Link
						to="/samples"
						className="inline-flex items-center justify-center rounded-xl border border-emerald-200/70 bg-white px-6 py-3.5 text-base font-semibold text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-200 dark:hover:text-emerald-100"
					>
						Preview sample rooms
					</Link>
				</div>
				<ul className="mt-14 grid max-w-xl gap-4 text-left text-slate-600 dark:text-slate-400 sm:mx-auto sm:max-w-2xl sm:grid-cols-2">
					<li className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Auto-detect walls and paintable surfaces</span>
					</li>
					<li className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Paint palettes you can try instantly</span>
					</li>
					<li className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Real-time before-and-after previews</span>
					</li>
					<li className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>✓</span>
						<span>Save, compare, and share your top picks</span>
					</li>
				</ul>
				<section className="mt-16 grid w-full gap-6 text-left sm:mt-20 sm:grid-cols-3">
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							True-to-life preview
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							See your room before you paint
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Swap paint colors in seconds and preview them on your
							exact lighting and layout.
						</p>
					</div>
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Color confidence
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Make the right choice once
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Compare shades side by side, then lock in the one you
							love without costly repainting.
						</p>
					</div>
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Aligned decisions
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Get buy-in before you paint
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Share a link or snapshot so everyone agrees on the
							color before the first coat.
						</p>
					</div>
				</section>
				<section className="mt-16 grid w-full gap-6 text-left sm:mt-20 sm:grid-cols-2">
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Perfect for
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Anyone choosing a paint color
						</h2>
						<ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
							<li>Homeowners testing weekend projects</li>
							<li>Designers presenting color options</li>
							<li>Landlords standardizing unit palettes</li>
							<li>Realtors staging with confidence</li>
						</ul>
					</div>
					<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
							Especially helpful for
						</p>
						<h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
							Fast, confident paint decisions
						</h2>
						<ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
							<li>Contractors confirming client picks</li>
							<li>Renovation planners comparing shades</li>
							<li>Multifamily teams setting standards</li>
							<li>DIYers who want zero repainting</li>
						</ul>
					</div>
				</section>
				<section className="mt-16 w-full rounded-3xl border border-emerald-100 bg-emerald-50/80 px-6 py-10 text-left dark:border-emerald-900/60 dark:bg-emerald-900/20 sm:mt-20 sm:px-10">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
								Try it fast
							</p>
							<h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
								Preview paint in seconds
							</h2>
							<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
								Start with a sample room to see how colors feel
								before you upload yours.
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
					<span>© 2026 AnyoHaus. All rights reserved.</span>
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
