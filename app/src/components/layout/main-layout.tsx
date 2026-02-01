import { Outlet, useLocation } from 'react-router-dom'
import { useVisualizerStore } from '../../store/visualizer-store'
import { Header } from './header'

export function MainLayout() {
	const { pathname } = useLocation()
	const isLanding = pathname === '/'
	const isStudio = pathname === '/visualizer'
	const isUpload = pathname === '/upload'
	const isSamples = pathname === '/samples'
	const hideHeader = useVisualizerStore((s) => s.hideHeader)

	return (
		<div
			className={`flex flex-col bg-slate-100 dark:bg-slate-950 ${
				isStudio || isUpload ? 'h-screen overflow-hidden' : 'min-h-screen'
			}`}
		>
		{!isLanding && !hideHeader && <Header />}
			<main
				className={
					isLanding || isSamples
						? 'flex min-h-screen flex-1 flex-col'
						: isStudio
							? 'flex min-h-0 flex-1 flex-col overflow-y-auto'
							: isUpload
								? 'flex min-h-0 flex-1 flex-col overflow-y-auto'
								: 'mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6'
				}
			>
				<Outlet />
			</main>
		</div>
	)
}
