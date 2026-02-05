const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'
const MATERIALS_TTL_MS = 5 * 60 * 1000
const PROJECTS_TTL_MS = 5 * 60 * 1000
const RENDER_TTL_MS = 10 * 60 * 1000
const materialsCache = new Map<
	string,
	{ data: import('../types').Material[]; expiresAt: number }
>()
const projectCache = new Map<
	string,
	{ data: import('../types').Project; expiresAt: number }
>()
let projectsListCache:
	| { data: import('../types').Project[]; expiresAt: number }
	| null = null
const renderCache = new Map<
	string,
	{ data: { renderedUrl: string }; expiresAt: number }
>()
const renderJobCache = new Map<string, { renderedUrl: string }>()

async function request<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const url = path.startsWith('http') ? path : `${API_BASE}${path}`
	const res = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: res.statusText }))
		throw new Error((err as { message?: string }).message ?? res.statusText)
	}
	return res.json() as Promise<T>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function uploadRoomImage(file: File): Promise<{
	roomImageUrl: string
	uploadId: string
}> {
	const form = new FormData()
	form.append('file', file)
	const url = `${API_BASE}/upload`
	const res = await fetch(url, {
		method: 'POST',
		body: form,
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: res.statusText }))
		throw new Error((err as { message?: string }).message ?? res.statusText)
	}
	return res.json()
}

export async function uploadMobileImage(
	sessionId: string,
	file: File,
): Promise<{ roomImageUrl: string; uploadId: string }> {
	const form = new FormData()
	form.append('file', file)
	const url = `${API_BASE}/upload/mobile/${encodeURIComponent(sessionId)}`
	const res = await fetch(url, {
		method: 'POST',
		body: form,
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: res.statusText }))
		throw new Error((err as { message?: string }).message ?? res.statusText)
	}
	return res.json()
}

export async function listMobileSessionUploads(sessionId: string): Promise<
	{ uploadId: string; roomImageUrl: string; uploadedAt: string }[]
> {
	return request(`/upload/mobile/${encodeURIComponent(sessionId)}`)
}

export async function segmentRoom(body: {
	uploadId?: string
	imageUrl?: string
	useDaemon?: boolean
}): Promise<import('../types').DetectionResult> {
	return request('/segment', {
		method: 'POST',
		body: JSON.stringify(body),
	})
}

export async function listMaterials(
	category?: string,
	search?: string,
): Promise<import('../types').Material[]> {
	const params = new URLSearchParams()
	if (category) params.set('category', category)
	if (search) params.set('search', search)
	const q = params.toString()
	const key = `${category ?? ''}::${search ?? ''}`
	const cached = materialsCache.get(key)
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data
	}
	const data = await request(`/materials${q ? `?${q}` : ''}`)
	materialsCache.set(key, { data, expiresAt: Date.now() + MATERIALS_TTL_MS })
	return data
}

export async function getMaterial(id: string): Promise<import('../types').Material> {
	return request(`/materials/${id}`)
}

export async function createProject(dto: {
	name: string
	roomImageUrl: string
	segmentationResult?: import('../types').SegmentationResult
	detectionResult?: import('../types').DetectionResult
	appliedMaterials?: Record<string, string>
	scenes?: import('../types').Scene[]
}): Promise<import('../types').Project> {
	const data = await request('/projects', {
		method: 'POST',
		body: JSON.stringify(dto),
	})
	projectCache.set(data.id, {
		data,
		expiresAt: Date.now() + PROJECTS_TTL_MS,
	})
	projectsListCache = null
	return data
}

export async function listProjects(): Promise<import('../types').Project[]> {
	if (projectsListCache && projectsListCache.expiresAt > Date.now()) {
		return projectsListCache.data
	}
	const data = await request('/projects')
	projectsListCache = {
		data,
		expiresAt: Date.now() + PROJECTS_TTL_MS,
	}
	return data
}

export async function listSamples(): Promise<import('../types').SampleProject[]> {
	return request('/projects/samples')
}

export async function listSampleGroups(): Promise<
	import('../types').SampleGroup[]
> {
	return request('/projects/sample-groups')
}

export async function getProject(id: string): Promise<import('../types').Project> {
	const cached = projectCache.get(id)
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data
	}
	const data = await request(`/projects/${id}`)
	projectCache.set(id, { data, expiresAt: Date.now() + PROJECTS_TTL_MS })
	return data
}

export async function updateProject(
	id: string,
	dto: {
		name?: string
		thumbnailUrl?: string
		appliedMaterials?: Record<string, string>
		scenes?: import('../types').Scene[]
	},
): Promise<import('../types').Project> {
	const data = await request(`/projects/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(dto),
	})
	projectCache.set(id, { data, expiresAt: Date.now() + PROJECTS_TTL_MS })
	projectsListCache = null
	return data
}

export async function renderTexture(body: {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
	textureUrl?: string
}): Promise<{ renderedUrl: string }> {
	const cacheKey = [
		body.imageUrl,
		body.maskUrl,
		body.prompt,
		body.uploadId,
		body.label,
		body.textureUrl ?? '',
	].join('::')
	const cached = renderCache.get(cacheKey)
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data
	}
	const res = await request<{ renderedUrl?: string; jobId?: string }>('/render', {
		method: 'POST',
		body: JSON.stringify(body),
	})
	if (res.renderedUrl) {
		const data = { renderedUrl: res.renderedUrl }
		renderCache.set(cacheKey, {
			data,
			expiresAt: Date.now() + RENDER_TTL_MS,
		})
		return data
	}
	if (!res.jobId) throw new Error('Render job missing id')
	const cachedJob = renderJobCache.get(res.jobId)
	if (cachedJob) return cachedJob
	const startedAt = Date.now()
	let delay = 1500
	while (Date.now() - startedAt < 20 * 60 * 1000) {
		const status = await request<{
			status: 'queued' | 'active' | 'completed' | 'failed' | 'missing'
			renderedUrl?: string
		}>(`/render/status/${res.jobId}`)
		if (status.status === 'completed' && status.renderedUrl) {
			const data = { renderedUrl: status.renderedUrl }
			renderCache.set(cacheKey, {
				data,
				expiresAt: Date.now() + RENDER_TTL_MS,
			})
			renderJobCache.set(res.jobId, data)
			return data
		}
		if (status.status === 'failed' || status.status === 'missing') {
			throw new Error('Render failed')
		}
		await sleep(delay)
		delay = Math.min(5000, Math.round(delay * 1.25))
	}
	throw new Error('Render timed out')
}
