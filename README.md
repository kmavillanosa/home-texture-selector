# Room Visualizer (home-texture-selector)

An interactive Room Visualizer tool similar to Roomvo: upload a photo of your room, get automatic wall/floor (and small-object) detection, then try flooring, paint, tiles, wallpapers, and furniture in real time with undo/redo, zoom/pan, save/share, and downloadable preview.

## Stack

- **Frontend**: Vite + React (TypeScript), React Router, Tailwind CSS, Zustand
- **Backend**: NestJS (Node), REST API, multer for uploads

## Quick start

1. **API** (port 3000). No API key required; object detection uses TensorFlow.js COCO-SSD.

   ```bash
   cd api && npm install && npm run start:dev
   ```

2. **App** (port 5173):

   ```bash
   cd app && npm install && npm run dev
   ```

3. Open **http://localhost:5173**. Upload a room image (JPEG/PNG, max 10MB), click **Detect objects**, then use the visualizer: overlay shows detected objects (boxes + labels); zoom/pan (toolbar), save project and download preview.

## Spec and design

See **[docs/ROOM_VISUALIZER_SPEC.md](docs/ROOM_VISUALIZER_SPEC.md)** for:

- Detailed requirements (upload, AI segmentation, material library, real-time preview, undo/redo, save/share, download)
- User flow and UI layout (wireframe)
- Database schema and API routes
- UI/UX guidance and technical build (React + Node + AI + rendering)
- Product brief, roadmap, and AI behavior / output style

## Project layout

- **app/** – Vite React app (pages: Home, Upload, Visualizer; components: layout, upload, materials, canvas, regions, controls, save)
- **api/** – NestJS API (upload, segment, materials, projects)
- **docs/** – Specification and design

**Object detection** uses [TensorFlow.js](https://www.tensorflow.org/js) and [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) (free, no API key). See [docs/FREE_MODEL_CHOICE.md](docs/FREE_MODEL_CHOICE.md).
