import { Link, useLocation } from 'react-router-dom'

export function Header() {
	const isStudio = useLocation().pathname === '/visualizer'

	return (
		<header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
				<div className="flex w-full items-center justify-between gap-4">
				<Link
					to="/"
					className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100"
				>
					<StudioIcon />
					<span>Room Visualizer</span>
				</Link>
				{!isStudio && (
					<Link
						to="/upload"
						className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500"
					>
						Upload room
					</Link>
				)}
			</div>
		</header>
	)
}

function StudioIcon() {
	return (
		<svg
			className="h-6 w-6 text-teal-600 dark:text-teal-400"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<path d="M3 9h18" />
			<path d="M9 21V9" />
		</svg>
	)
}
