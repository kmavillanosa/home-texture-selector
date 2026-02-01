const API_BASE = '/api'

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

export async function segmentRoom(body: {
	uploadId?: string
	imageUrl?: string
}): Promise<import('../types').DetectionResult> {
	return request('/segment', {
		method: 'POST',
		body: JSON.stringify(body),
	})
}

export async function listMaterials(category?: string, search?: string): Promise<import('../types').Material[]> {
	const params = new URLSearchParams()
	if (category) params.set('category', category)
	if (search) params.set('search', search)
	const q = params.toString()
	return request(`/materials${q ? `?${q}` : ''}`)
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
	return request('/projects', { method: 'POST', body: JSON.stringify(dto) })
}

export async function listProjects(): Promise<import('../types').Project[]> {
	return request('/projects')
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
	return request(`/projects/${id}`)
}

export async function updateProject(
	id: string,
	dto: { name?: string; thumbnailUrl?: string; appliedMaterials?: Record<string, string> },
): Promise<import('../types').Project> {
	return request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(dto) })
}

export async function renderTexture(body: {
	imageUrl: string
	maskUrl: string
	prompt: string
	uploadId: string
	label: string
}): Promise<{ renderedUrl: string }> {
	return request('/render', {
		method: 'POST',
		body: JSON.stringify(body),
	})
}
