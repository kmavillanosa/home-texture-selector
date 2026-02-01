# Texture Images

This directory contains texture images for the kitchen preview tool.

## Required Textures

### Countertops (6 textures)
- `countertop-marble-white.jpg` - White Carrara marble with gray veining
- `countertop-granite-dark.jpg` - Dark gray granite with speckles
- `countertop-quartz-white.jpg` - White quartz with sparkle
- `countertop-butcher-block.jpg` - Natural wood butcher block
- `countertop-concrete.jpg` - Polished concrete
- `countertop-quartz-gray.jpg` - Gray quartz

### Backsplash (6 textures)
- `backsplash-subway-white.jpg` - White subway tile pattern
- `backsplash-mosaic-blue.jpg` - Blue mosaic tile
- `backsplash-herringbone.jpg` - Herringbone pattern tile
- `backsplash-brick.jpg` - Brick pattern
- `backsplash-stone.jpg` - Natural stone tile
- `backsplash-subway-gray.jpg` - Gray subway tile pattern

### Cabinets (6 textures)
- `cabinet-white.jpg` - White painted cabinet texture
- `cabinet-gray.jpg` - Gray painted cabinet texture
- `cabinet-navy.jpg` - Navy blue painted cabinet texture
- `cabinet-walnut-wood.jpg` - Walnut wood grain
- `cabinet-oak-wood.jpg` - Oak wood grain
- `cabinet-cream.jpg` - Cream painted cabinet texture

### Floors (6 textures)
- `floor-oak.jpg` - Oak hardwood floor planks
- `floor-tile-gray.jpg` - Gray tile floor
- `floor-dark-wood.jpg` - Dark hardwood floor planks
- `floor-light-wood.jpg` - Light hardwood floor planks
- `floor-stone.jpg` - Natural stone floor tiles
- `floor-bamboo.jpg` - Bamboo floor planks

## Generating Textures

You can generate these textures using the provided script:

```bash
npm install canvas
node scripts/generate-textures.js
```

This will create all texture images automatically.

## Adding Your Own Textures

1. Add your texture image files to this directory (`public/textures/`)
2. Update `public/content/textures.json` with your new texture entries
3. Make sure the `value` field points to the correct file path (e.g., `textures/your-texture.jpg`)
4. Set `type` to `"texture"` for image files or `"color"` for solid colors

## Texture Requirements

- **Format**: JPG or PNG
- **Size**: Recommended 400x400px or larger (will be tiled)
- **Seamless**: Textures should be tileable (seamless when repeated)
- **File Size**: Keep under 500KB per texture for optimal performance
