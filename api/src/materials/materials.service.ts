import { Injectable, NotFoundException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import type { MaterialDto } from '../common/types'

const TEXTURES_DIR = path.join(process.cwd(), 'textures')
const TEXTURE_PREFIX = '/textures'

const TEXTURE_FOLDERS: { folder: string; category: MaterialDto['category'] }[] =
	[
		{ folder: 'floor', category: 'flooring' },
		{ folder: 'cabinets', category: 'furniture' },
		{ folder: 'countertop', category: 'tiles' },
		{ folder: 'backsplash', category: 'tiles' },
	]

const APPLIES_TO_BY_FOLDER: Record<string, string[]> = {
	floor: ['Floor', 'Rug'],
	cabinets: ['Cabinet'],
	countertop: ['Countertop'],
	backsplash: ['Wall', 'Countertop'],
}

const SOLID_COLOR_MATERIALS: MaterialDto[] = [
	{
		id: 'paint-sage-green',
		category: 'paint',
		name: 'Sage Green',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#9caf88', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-charcoal',
		category: 'paint',
		name: 'Charcoal',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1f2937', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-pale-sky',
		category: 'paint',
		name: 'Pale Sky',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#dbe8f4', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-misty-gray',
		category: 'paint',
		name: 'Misty Gray',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e4e7ea', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-sandstone',
		category: 'paint',
		name: 'Sandstone',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e8dcc8', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-mushroom',
		category: 'paint',
		name: 'Mushroom',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d7cdbf', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-stone',
		category: 'paint',
		name: 'Stone',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#cfd3d6', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-smoke-blue',
		category: 'paint',
		name: 'Smoke Blue',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#8aa0b2', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-olive',
		category: 'paint',
		name: 'Olive',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#7f8b68', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-clay',
		category: 'paint',
		name: 'Clay',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c59a7b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-ink',
		category: 'paint',
		name: 'Ink',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#26323f', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-ceiling-bright',
		category: 'paint',
		name: 'Ceiling Bright',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f9fafb', appliesTo: ['Ceiling'] },
	},
	{
		id: 'wallpaper-sand',
		category: 'wallpapers',
		name: 'Sand',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e7dccb', appliesTo: ['Wall'] },
	},
	{
		id: 'wallpaper-mist',
		category: 'wallpapers',
		name: 'Mist',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d9e2e8', appliesTo: ['Wall'] },
	},
	{
		id: 'wallpaper-linen',
		category: 'wallpapers',
		name: 'Linen',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#ece3d6', appliesTo: ['Wall'] },
	},
	{
		id: 'wallpaper-ash',
		category: 'wallpapers',
		name: 'Ash',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#cfd3d6', appliesTo: ['Wall'] },
	},
	{
		id: 'flooring-oat',
		category: 'flooring',
		name: 'Oat',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d8c9b2', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-honey',
		category: 'flooring',
		name: 'Honey',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#caa67a', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-toffee',
		category: 'flooring',
		name: 'Toffee',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#b0845a', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-walnut',
		category: 'flooring',
		name: 'Walnut',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#7a5a3a', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-slate',
		category: 'flooring',
		name: 'Slate',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#4b5563', appliesTo: ['Floor'] },
	},
	{
		id: 'tiles-porcelain',
		category: 'tiles',
		name: 'Porcelain',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: {
			color: '#f3f4f6',
			appliesTo: ['Backsplash', 'Countertop', 'Wall', 'Floor'],
		},
	},
	{
		id: 'tiles-marble',
		category: 'tiles',
		name: 'Marble',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: {
			color: '#e5e7eb',
			appliesTo: ['Backsplash', 'Countertop', 'Wall', 'Floor'],
		},
	},
	{
		id: 'tiles-limestone',
		category: 'tiles',
		name: 'Limestone',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: {
			color: '#d7d1c4',
			appliesTo: ['Backsplash', 'Countertop', 'Wall', 'Floor'],
		},
	},
	{
		id: 'tiles-sand',
		category: 'tiles',
		name: 'Sand',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: {
			color: '#cdbca2',
			appliesTo: ['Backsplash', 'Countertop', 'Wall', 'Floor'],
		},
	},
	{
		id: 'tiles-graphite',
		category: 'tiles',
		name: 'Graphite',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#4b5563', appliesTo: ['Backsplash', 'Countertop'] },
	},
	{
		id: 'cabinet-greige',
		category: 'furniture',
		name: 'Cabinet Greige',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d6cec3', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-sage',
		category: 'furniture',
		name: 'Cabinet Sage',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#93a483', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-navy',
		category: 'furniture',
		name: 'Cabinet Navy',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#334155', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-ink',
		category: 'furniture',
		name: 'Cabinet Ink',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1f2937', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'paint-linen-white',
		category: 'paint',
		name: 'Linen White',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f5f1eb', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-soft-sand',
		category: 'paint',
		name: 'Soft Sand',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e2d6c7', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-pure-trim',
		category: 'paint',
		name: 'Pure Trim',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#ffffff', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-urban-ash',
		category: 'paint',
		name: 'Urban Ash',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#8a8a8a', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-nordic-white',
		category: 'paint',
		name: 'Nordic White',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#fafaf8', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-mist-grey',
		category: 'paint',
		name: 'Mist Grey',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e6e8e3', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-pine-shadow',
		category: 'paint',
		name: 'Pine Shadow',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#9fa6a0', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-soft-charcoal',
		category: 'paint',
		name: 'Soft Charcoal',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2f2f2f', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-clay-beige',
		category: 'paint',
		name: 'Clay Beige',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#efe7dc', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-warm-dune',
		category: 'paint',
		name: 'Warm Dune',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d6c2a8', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-olive-drift',
		category: 'paint',
		name: 'Olive Drift',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#7e8f7c', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-deep-soil',
		category: 'paint',
		name: 'Deep Soil',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#3f3a34', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-cloud-beige',
		category: 'paint',
		name: 'Cloud Beige',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f2f0ed', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-stone-mist',
		category: 'paint',
		name: 'Stone Mist',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#dad6d1', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-concrete-taupe',
		category: 'paint',
		name: 'Concrete Taupe',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#a59f97', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-bright-trim',
		category: 'paint',
		name: 'Bright Trim',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#ffffff', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-midnight-black',
		category: 'paint',
		name: 'Midnight Black',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1e1e1e', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-graphite-core',
		category: 'paint',
		name: 'Graphite Core',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2c2c2c', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-royal-navy',
		category: 'paint',
		name: 'Royal Navy',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1f2a44', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-evening-blue',
		category: 'paint',
		name: 'Evening Blue',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2f3e66', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-warm-stone',
		category: 'paint',
		name: 'Warm Stone',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#8b7e74', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-forest-core',
		category: 'paint',
		name: 'Forest Core',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1f3d2b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-pine-deep',
		category: 'paint',
		name: 'Pine Deep',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#355f4b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-ivory-clay',
		category: 'paint',
		name: 'Ivory Clay',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#efefea', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-iron-black',
		category: 'paint',
		name: 'Iron Black',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2a2a2a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-burnt-terracotta',
		category: 'paint',
		name: 'Burnt Terracotta',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c65a3a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-soft-clay',
		category: 'paint',
		name: 'Soft Clay',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#e4a28a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-warm-linen',
		category: 'paint',
		name: 'Warm Linen',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#faf3ee', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-matte-black',
		category: 'paint',
		name: 'Matte Black',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2b2b2b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-clean-white',
		category: 'paint',
		name: 'Clean White',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f6f6f4', appliesTo: ['Wall', 'Ceiling', 'Door'] },
	},
	{
		id: 'paint-sage-neutral',
		category: 'paint',
		name: 'Sage Neutral',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#bfc7c1', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-soft-graphite',
		category: 'paint',
		name: 'Soft Graphite',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#4a4a4a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-rice-paper',
		category: 'paint',
		name: 'Rice Paper',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f3efea', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-sandstone-japandi',
		category: 'paint',
		name: 'Sandstone',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#d4c8b8', appliesTo: ['Wall', 'Ceiling'] },
	},
	{
		id: 'paint-ink-black',
		category: 'paint',
		name: 'Ink Black',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#3b3b3b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-zen-moss',
		category: 'paint',
		name: 'Zen Moss',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#9fae9f', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-terracotta-glow',
		category: 'paint',
		name: 'Terracotta Glow',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c65a3a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-sunflower',
		category: 'paint',
		name: 'Sunflower',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#f2c94c', appliesTo: ['Wall', 'Door'] },
	},
	{
		id: 'paint-slate-teal',
		category: 'paint',
		name: 'Slate Teal',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2f6f73', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-forest-jade',
		category: 'paint',
		name: 'Forest Jade',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#1f6f4a', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-cobalt-night',
		category: 'paint',
		name: 'Cobalt Night',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#2f3e66', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-plum-velvet',
		category: 'paint',
		name: 'Plum Velvet',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#5b2a5b', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-rose-clay',
		category: 'paint',
		name: 'Rose Clay',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c98c8c', appliesTo: ['Wall'] },
	},
	{
		id: 'paint-graphite-blue',
		category: 'paint',
		name: 'Graphite Blue',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#3d4a5c', appliesTo: ['Wall'] },
	},
	{
		id: 'flooring-honey-oak',
		category: 'flooring',
		name: 'Honey Oak',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#b89b7a', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-driftwood',
		category: 'flooring',
		name: 'Driftwood',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c7beb1', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-cocoa-timber',
		category: 'flooring',
		name: 'Cocoa Timber',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#9c7a5b', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-natural-timber',
		category: 'flooring',
		name: 'Natural Timber',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#8e7d6b', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-light-oak',
		category: 'flooring',
		name: 'Light Oak',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#a68b6a', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-rustic-oak',
		category: 'flooring',
		name: 'Rustic Oak',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#7a5c3e', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-dark-walnut',
		category: 'flooring',
		name: 'Dark Walnut',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#6f4e37', appliesTo: ['Floor'] },
	},
	{
		id: 'flooring-chestnut-brown',
		category: 'flooring',
		name: 'Chestnut Brown',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#8b5e3c', appliesTo: ['Floor'] },
	},
	{
		id: 'tiles-soft-porcelain',
		category: 'tiles',
		name: 'Soft Porcelain',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: {
			color: '#ededed',
			appliesTo: ['Backsplash', 'Countertop', 'Wall', 'Floor'],
		},
	},
	{
		id: 'cabinet-slate',
		category: 'furniture',
		name: 'Slate Cabinet',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#6b6e70', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-brushed-gold',
		category: 'furniture',
		name: 'Brushed Gold',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c9a24d', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-champagne-brass',
		category: 'furniture',
		name: 'Champagne Brass',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c7a75b', appliesTo: ['Cabinet', 'Shelf'] },
	},
	{
		id: 'cabinet-muted-brass',
		category: 'furniture',
		name: 'Muted Brass',
		thumbnailUrl: '',
		assetUrl: '',
		metadata: { color: '#c4a484', appliesTo: ['Cabinet', 'Shelf'] },
	},
]

const toTitleCase = (value: string) =>
	value
		.replace(/\.(jpe?g|png|webp)$/i, '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')

let cachedTextureMaterials: MaterialDto[] | null = null
const getTextureMaterials = (): MaterialDto[] => {
	if (cachedTextureMaterials) return cachedTextureMaterials
	const out: MaterialDto[] = []
	for (const { folder, category } of TEXTURE_FOLDERS) {
		const abs = path.join(TEXTURES_DIR, folder)
		if (!fs.existsSync(abs)) continue
		const files = fs
			.readdirSync(abs)
			.filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
		for (const file of files) {
			const appliesTo = APPLIES_TO_BY_FOLDER[folder] ?? []
			out.push({
				id: `tex-${folder}-${file}`.toLowerCase(),
				category,
				name: toTitleCase(file),
				thumbnailUrl: `${TEXTURE_PREFIX}/${folder}/${file}`,
				assetUrl: `${TEXTURE_PREFIX}/${folder}/${file}`,
				metadata: { appliesTo, textureGroup: folder },
			})
		}
	}
	cachedTextureMaterials = out
	return out
}

const getAllMaterials = () => [...getTextureMaterials(), ...SOLID_COLOR_MATERIALS]

@Injectable()
export class MaterialsService {
	list(category?: string, search?: string): MaterialDto[] {
		let list = getAllMaterials()
		if (category) {
			list = list.filter((m) => m.category === category)
		}
		if (search) {
			const q = search.toLowerCase()
			list = list.filter(
				(m) =>
					m.name.toLowerCase().includes(q) ||
					m.category.toLowerCase().includes(q),
			)
		}
		return list
	}

	get(id: string): MaterialDto {
		const m = getAllMaterials().find((x) => x.id === id)
		if (!m) throw new NotFoundException('Material not found')
		return m
	}
}
