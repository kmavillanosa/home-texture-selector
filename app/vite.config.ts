import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

const apiPort = process.env.API_PORT ?? 3000
const apiTarget = `http://localhost:${apiPort}`

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: apiTarget,
				changeOrigin: true,
				rewrite: (p) => p.replace(/^\/api/, ''),
				timeout: 120000,
			},
			'/uploads': { target: apiTarget, changeOrigin: true },
			'/cache': { target: apiTarget, changeOrigin: true },
			'/textures': { target: apiTarget, changeOrigin: true },
		},
	},
})
