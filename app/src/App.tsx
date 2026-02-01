import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/main-layout'
import { HomePage } from './pages/home-page'
import { UploadPage } from './pages/upload-page'
import { VisualizerPage } from './pages/visualizer-page'
import './App.css'

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<MainLayout />}>
					<Route path="/" element={<HomePage />} />
					<Route path="/upload" element={<UploadPage />} />
					<Route path="/visualizer" element={<VisualizerPage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Routes>
		</BrowserRouter>
	)
}

export default App
