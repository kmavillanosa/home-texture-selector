# Anyo Haus Studio – Specification

A Roomvo-style web tool for uploading room photos, detecting surfaces (walls, floors, small objects), and applying materials in real time with realistic rendering.

---

## 1. Detailed Requirements (Tech + UI)

### 1.1 Core Features

| Feature | Description |
|--------|-------------|
| **Upload** | User room photo (JPEG/PNG), max size configurable (e.g. 10MB) |
| **Auto detection** | AI segmentation for walls, floors; optional detection of small objects (door knobs, fixtures) for masking/management |
| **Material library** | Flooring, paint, tiles, wallpapers, furniture – browsable, filterable, searchable |
| **Real-time preview** | Canvas/WebGL with shadows and lighting; apply materials to detected regions |
| **Editing** | Undo/Redo, Zoom/Pan on canvas |
| **Persistence** | Save project, share link, generate downloadable preview image |

### 1.2 User Flow

1. **Home** → CTA “Start with your room photo” or “Try sample room”
2. **Upload** → Drag-and-drop or file picker → optional crop/rotate → “Analyze room”
3. **Analysis** → Backend runs segmentation → returns masks (walls, floor, optional small objects)
4. **Visualizer** → Canvas shows photo + overlay masks; user selects region (wall/floor/object) and picks material; preview updates in real time
5. **Save / Share** → Save project (name, thumbnail), get shareable link; “Download preview” exports image

### 1.3 UI Layout (Wireframe)

- **Header**: Logo, “My projects” (optional), user menu
- **Left panel (collapsible)**: Material library – categories (Flooring, Paint, Tiles, Wallpapers, Furniture), search, selected material preview
- **Center**: Main canvas – zoom/pan controls, undo/redo, “Reset view”
- **Right panel (collapsible)**: Layer list (detected regions: Wall 1, Wall 2, Floor, Door, etc.) with per-layer material and visibility toggle
- **Bottom bar**: “Save project”, “Share”, “Download image”, optional “Compare” (before/after slider)

### 1.4 Database Schema (Conceptual)

```text
users (id, email, name, created_at)
projects (id, user_id, name, thumbnail_url, room_image_url, segmentation_result_json, created_at, updated_at)
materials (id, category, name, thumbnail_url, asset_url, metadata_json)
project_materials (project_id, region_id, material_id, applied_at)  -- which material on which region
```

Segmentation result stored as JSON: `{ "regions": [ { "id", "label": "wall"|"floor"|"door_knob"|..., "mask": "base64 or url", "bounds": {} } ] }`.

### 1.5 APIs Required

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/upload` | Multipart room image upload; returns `room_image_url`, `upload_id` |
| POST | `/segment` | Body: `upload_id` or `image_url`; returns segmentation result (masks, region ids) |
| GET | `/materials` | List materials; query: `category`, `search` |
| GET | `/materials/:id` | Single material details |
| POST | `/projects` | Create project (name, room_image_url, segmentation_result) |
| GET | `/projects` | List user projects |
| GET | `/projects/:id` | Get project (for load/share) |
| PATCH | `/projects/:id` | Update project (name, applied materials, thumbnail) |
| POST | `/projects/:id/export` | Generate downloadable preview image (optional) |

---

## 2. UI/UX Design Guidance

### 2.1 Screens

- **Home**: Hero with value prop, “Upload your room” primary button, “Try sample” secondary, short feature list, footer
- **Upload**: Large drop zone, format/size hint, “Analyze” button, loading state with progress
- **Material selection**: Grid or list of material cards; active selection clearly highlighted; optional “Favorites”
- **Preview**: Canvas dominant; subtle toolbar; panels don’t obscure center
- **Save/Compare**: Modal or side panel for project name; share link copy; before/after slider for compare

### 2.2 Style Guidance

- **Theme**: Light default; optional dark mode via CSS variables
- **Typography**: Clear hierarchy (e.g. one display font, one UI font); comfortable reading size
- **Colors**: Neutral background; primary for CTAs; success for “Saved”; caution for “Unsaved changes”
- **Spacing**: Consistent scale (e.g. 4/8/16/24/32); panels with clear separation
- **Accessibility**: Keyboard navigation, focus states, ARIA where needed, contrast ratios

---

## 3. Technical Build (React + Node + AI + Rendering)

### 3.1 Stack

- **Frontend**: Vite + React (TypeScript), React Router, state (e.g. Zustand or React state)
- **Backend**: NestJS (Node), multer for uploads, REST APIs above
- **AI**: TensorFlow.js + COCO-SSD for object detection (free, no API key); no Hugging Face or Vision API in repo
- **Rendering**: Canvas 2D for MVP (draw image + masks, composite materials); optional WebGL/Three.js later for lighting/shadows

### 3.2 Frontend Component Structure

```text
app/src/
  components/
    layout/         Header, SidePanel, MainLayout
    upload/         ImageUploadZone, UploadProgress
    materials/      MaterialLibrary, MaterialCard, MaterialCategoryList
    canvas/         RoomCanvas (zoom/pan, draw image + masks + materials)
    regions/        RegionList, RegionItem (layer list)
    controls/       UndoRedo, ZoomPan, Toolbar
    save/           SaveProjectModal, ShareDialog, DownloadButton
  pages/            Home, Upload, Visualizer
  hooks/            useCanvas, useUndoRedo, useSegmentation
  api/              client for backend (upload, segment, materials, projects)
  types/            Project, Material, Region, SegmentationResult
```

### 3.3 AI Model Flow

1. User uploads image → stored (e.g. local `uploads/`)
2. Client or backend triggers “Segment” → backend runs TensorFlow.js COCO-SSD on the image
3. Model returns bounding boxes + labels (COCO 80 classes: chair, couch, bed, etc.)
4. Backend returns detections with bbox in percentage (0–100) → response to client
5. Client draws image and overlay (boxes + labels) on canvas

### 3.4 Asset Management

- **Materials**: Thumbnails + full-res textures; stored in CDN or `/public/materials`; metadata in DB or JSON
- **User uploads**: Temporary or permanent storage; URLs returned to client
- **Exports**: Generated image stored temporarily or attached to project; download link

---

## 4. Product Brief (Stakeholder-Ready)

### 4.1 Target Audience

- Homeowners and renters planning renovations
- Interior designers presenting options to clients
- Retailers (flooring, paint, furniture) for “try in your room” experiences

### 4.2 Key Features

- Upload room photo and get automatic wall/floor (and optional small-object) detection
- Try flooring, paint, tiles, wallpapers, and furniture in real time
- Realistic preview with lighting/shadows (MVP: compositing; v2: WebGL)
- Save projects, share links, download previews

### 4.3 Competitive Advantages

- One-click segmentation (no manual tracing)
- Fine-grained control (e.g. door knobs, fixtures) where supported
- Real-time application without page reload
- Shareable links and export for social or client approval

### 4.4 Monetization Options

- Freemium: N projects or resolutions free; unlimited or HD export paid
- B2B: White-label or API for retailers
- Affiliate: Links to purchase selected materials
- Premium material packs or “pro” lighting/rendering

### 4.5 6-Month Roadmap (High-Level)

| Month | Focus |
|-------|--------|
| 1–2 | MVP: Upload, segmentation (API or mock), canvas with materials, save/share, download |
| 3 | Material library expansion; performance; mobile-friendly layout |
| 4 | Small-object detection; “Compare” view; optional accounts and project list |
| 5 | WebGL/Three.js preview with lighting; improved realism |
| 6 | Polish, analytics, A/B tests; prepare for B2B or paid tiers |

### 4.6 UI Screenshots Suggestions

- Home hero + CTA
- Upload drop zone (empty and with image)
- Visualizer: room with materials applied + left material panel + right layer list
- Save modal and share success
- Download preview example

---

## 5. AI Behavior & Output Style

### 5.1 Material Recommendation Logic (Structured)

- **Input**: Room type (e.g. living room, bathroom), region type (wall, floor), current style (if detectable).
- **Output**: Ordered list of material IDs with short reason.

Example JSON:

```json
{
  "recommendations": [
    { "materialId": "mat-1", "reason": "Popular for living room floors" },
    { "materialId": "mat-2", "reason": "Matches warm wall tone" }
  ]
}
```

### 5.2 Real-Time Preview Best Practices

- Throttle/debounce material application to avoid jank (e.g. 60fps target)
- Use offscreen canvas for composite then draw to visible canvas once per frame
- Cache texture uploads for materials when using WebGL

### 5.3 Error Handling for Bad Images

- **Too small**: “Image should be at least 640×480 for best results.”
- **Unsupported format**: “Please use JPEG or PNG.”
- **Segmentation failed**: “We couldn’t detect walls and floors. Try a clearer photo with good lighting.”
- **Upload failed**: Retry once; then “Upload failed. Check connection and try again.”

### 5.4 Realistic Rendering Tips

- Preserve original lighting direction when compositing (simple blend modes)
- Scale texture to region; avoid obvious tiling (e.g. scale or seamless textures)
- Optional: ambient occlusion or shadow at wall-floor edge for depth

### 5.5 Example UI Copy (JSON)

```json
{
  "upload": {
    "title": "Upload your room",
    "subtitle": "We'll detect walls and floors automatically",
    "dropHint": "Drop your image here or click to browse",
    "formats": "JPEG or PNG, up to 10MB"
  },
  "analyze": {
    "button": "Analyze room",
    "progress": "Detecting walls and floors…"
  },
  "materials": {
    "title": "Materials",
    "categories": ["Flooring", "Paint", "Tiles", "Wallpapers", "Furniture"],
    "searchPlaceholder": "Search materials"
  },
  "save": {
    "button": "Save project",
    "namePlaceholder": "Project name",
    "shareSuccess": "Link copied to clipboard"
  }
}
```

---

## 6. Summary

This spec covers: **upload** (JPEG/PNG), **AI segmentation** (walls, floors, optional small objects), **material library**, **real-time preview** (canvas/WebGL), **undo/redo, zoom/pan**, **save/share and download**. It defines user flow, UI layout, DB schema, APIs, component structure, AI flow, product brief, roadmap, and structured UI/AI behavior. Implementation can start from MVP (canvas 2D + mock segmentation) and iterate toward WebGL and full AI integration.
