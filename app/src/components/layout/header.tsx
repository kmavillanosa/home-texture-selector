import { Link } from 'react-router-dom'
import logoUrl from '../../assets/logo.png'

export function Header() {
	return (
		<header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
			<div className="flex w-full items-center justify-between gap-4">
				<Link
					to="/"
					className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100"
				>
					<img
						src={logoUrl}
						alt="AnyoHaus logo"
						className="h-6 w-6 object-contain"
					/>
					<span>AnyoHaus</span>
				</Link>
				<div className="flex items-center gap-3">
					<Link
						to="/login"
						className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
					>
						Login
					</Link>
					<Link
						to="/register"
						className="inline-flex items-center justify-center rounded-full border border-emerald-200/80 px-3 py-1 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:text-emerald-100"
					>
						Register
					</Link>
					<a
						href="https://www.flaticon.com/free-icons/monstera"
						title="Monstera icons created by Futuer - Flaticon"
						target="_blank"
						rel="noreferrer"
						aria-label="Monstera icons created by Futuer - Flaticon"
						className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
					>
						i
					</a>
				</div>
			</div>
		</header>
	)
}
