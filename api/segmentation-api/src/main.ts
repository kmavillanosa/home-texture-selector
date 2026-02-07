import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { join } from 'path'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createConnection } from 'net'
import * as fs from 'fs'
import * as path from 'path'

const RETRY_DELAY_MS = 1500
const PID_FILE = path.join(process.cwd(), '.api.pid')
const STOP_GRACE_MS = 1200

const isPortInUse = (port: number) =>
	new Promise<boolean>((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' })
		const finalize = (inUse: boolean) => {
			socket.removeAllListeners()
			socket.destroy()
			resolve(inUse)
		}
		socket.once('connect', () => finalize(true))
		socket.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'ECONNREFUSED') {
				finalize(false)
				return
			}
			finalize(true)
		})
	})

const safeUnlink = (filePath: string) => {
	try {
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
	} catch {
		// ignore
	}
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const stopPreviousApiProcess = async () => {
	try {
		if (!fs.existsSync(PID_FILE)) return
		const raw = fs.readFileSync(PID_FILE, 'utf8').trim()
		const pid = Number(raw)
		if (!Number.isFinite(pid) || pid <= 0) {
			safeUnlink(PID_FILE)
			return
		}
		if (pid === process.pid) return
		try {
			// Throws if process doesn't exist
			process.kill(pid, 0)
		} catch {
			safeUnlink(PID_FILE)
			return
		}
		// Only stop if it's our previously started process.
		// (Still best-effort; if PID was reused, this could stop the wrong process.)
		process.kill(pid, 'SIGTERM')
		await sleep(STOP_GRACE_MS)
		try {
			process.kill(pid, 0)
		} catch {
			safeUnlink(PID_FILE)
			return
		}
		// Force kill if still alive (Windows will terminate the process)
		process.kill(pid, 'SIGKILL')
		await sleep(250)
		safeUnlink(PID_FILE)
	} catch {
		// ignore
	}
}

async function bootstrap() {
	// Best-effort: stop previous API instance we started (dev convenience).
	await stopPreviousApiProcess()

	const app = await NestFactory.create<NestExpressApplication>(AppModule)
	app.enableCors({ origin: true }) // allow frontend dev server
	app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' })
	app.useStaticAssets(join(process.cwd(), 'cache'), { prefix: '/cache/' })
	app.useStaticAssets(join(process.cwd(), 'samples'), { prefix: '/samples/' })
	app.useStaticAssets(join(process.cwd(), 'textures'), { prefix: '/textures/' })

	const port = Number(process.env.PORT ?? 3000)

	// Track PID so we can shut down the previous instance next startup.
	try {
		fs.writeFileSync(PID_FILE, String(process.pid), 'utf8')
	} catch {
		// ignore
	}

	const shutdown = async (exitCode = 0) => {
		try {
			await app.close()
		} catch {
			// ignore
		} finally {
			safeUnlink(PID_FILE)
			process.exit(exitCode)
		}
	}

	process.once('SIGINT', () => void shutdown(0))
	process.once('SIGTERM', () => void shutdown(0))
	process.once('uncaughtException', (err) => {
		console.error('uncaughtException', err)
		void shutdown(1)
	})
	process.once('unhandledRejection', (err) => {
		console.error('unhandledRejection', err)
		void shutdown(1)
	})

	const tryListen = async () => {
		const inUse = await isPortInUse(port)
		if (inUse) {
			// If the port is busy and we have a pid file, try stopping the previous instance again.
			if (fs.existsSync(PID_FILE)) {
				await stopPreviousApiProcess()
			}
			console.error(
				`Port ${port} already in use. Retrying in ${RETRY_DELAY_MS}ms...`,
			)
			setTimeout(tryListen, RETRY_DELAY_MS)
			return
		}
		await app.listen(port)
	}

	await tryListen()
}

bootstrap()
