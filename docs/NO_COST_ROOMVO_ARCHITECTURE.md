# No-Cost Roomvo-Like System — Technical Architecture

Technical blueprint for a room visualization system with **zero software licensing cost**: open-source stack only, no paid APIs, no SaaS, no proprietary SDKs. Optimized for single-server MVP and real-world implementation.

---

## 1. Backend Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Runtime** | Node.js 20+ or Python 3.10+ | API and orchestration; Python preferred for CV pipelines (library ecosystem). |
| **API** | NestJS (Node) or FastAPI (Python) | REST: upload, segment, materials, projects, export. Already using NestJS in this repo. |
| **Image I/O** | Sharp (Node) or OpenCV + Pillow (Python) | Decode, resize, encode; no ImageMagick license ambiguity. |
| **Segmentation** | ONNX Runtime (Node or Python) or PyTorch (Python) | Run exported segmentation models; CPU or GPU. |
| **Depth (optional)** | ONNX Runtime or PyTorch | Run MiDaS/DPT/ZoeDepth exported to ONNX. |
| **Geometry** | OpenCV (Python) or opencv4nodejs (Node) | Homography, perspective warp, contour/quad detection. |
| **Storage** | Local filesystem or MinIO (S3-compatible) | Uploads, masks, exports; no vendor lock-in. |
| **Queue (optional)** | Bull (Redis) or in-memory queue | Decouple upload from heavy inference so API stays responsive. |

**Recommendation for this repo:** Keep NestJS (Node) for API; add a **Python worker** (FastAPI or script) that receives image paths, runs segmentation + depth via ONNX/PyTorch, writes masks and metadata to disk, and returns paths. Node calls the worker via HTTP or reads from a shared directory. Alternative: run everything in Node using ONNX Runtime and pre-exported models (no Python).

---

## 2. Open-Source AI Models

### 2.1 Semantic Segmentation (floors, walls, cabinets, countertops)

| Model | Dataset | Output classes | Size / speed | License | Notes |
|-------|---------|----------------|--------------|---------|--------|
| **DeepLabv3+ (ADE20K)** | ADE20K | 150 (includes floor, wall, cabinet, countertop) | ~50MB; CPU ~2–5s/image | Apache 2.0 | Strong quality; use class indices 1=wall, 4=floor, 11=cabinet, 71=countertop. |
| **BiSeNet V2** | Cityscapes/ADE20K | Configurable | Smaller, faster | MIT | Good speed/accuracy tradeoff for real time. |
| **PIDNet** | Cityscapes | 19 or custom | Fast, accurate | Apache 2.0 | Alternative if you need edge quality. |
| **Segment Anything (SAM)** | SA-1B | Instance masks (no fixed classes) | Large, slow | Apache 2.0 | Overkill for “floor/wall/cabinet”; use only if you need arbitrary object cutouts. |

**Practical choice:** DeepLabv3+ with ADE20K, exported to ONNX. Run in Python (torch/onnxruntime) or Node (onnxruntime-node). Class IDs for room surfaces: 1=wall, 4=floor, 11=cabinet, 71=countertop (verify against ADE20K label list).

### 2.2 Depth Estimation (optional, for scale/perspective)

| Model | Output | Size / speed | License | Use |
|-------|--------|--------------|---------|-----|
| **MiDaS v3.1 (small)** | Monocular depth map | Small; CPU-friendly | MIT | Scale and soft shadows. |
| **DPT (Dense Prediction Transformer)** | Higher-quality depth | Larger | MIT | Better detail; heavier. |
| **ZoeDepth** | Metric depth (optional) | Multiple variants | MIT | Use if you need real-world scale. |

**Practical choice:** MiDaS small or DPT, exported to ONNX. Depth is used to: (1) improve surface boundary refinement, (2) drive simple shading or occlusion at edges, (3) order layers for compositing.

### 2.3 Exporting Models to ONNX (for cross-language use)

- **PyTorch:** `torch.onnx.export()` with fixed input size (e.g. 513×513 for DeepLab).
- **TensorFlow:** `tf2onnx` to convert SavedModel to ONNX.
- Prefer **ONNX** so the same model can run in Node (onnxruntime-node) or Python (onnxruntime) without shipping PyTorch/TF in production.

---

## 3. Image Processing Pipeline (Step-by-Step)

```
[Upload] → [Decode / Validate] → [Resize for model] → [Segmentation] → [Depth (optional)]
    → [Mask extraction] → [Surface refinement] → [Quad/geometry per surface]
    → [Texture mapping] → [Composite] → [Encode] → [Cache / Return]
```

### Step 1: Ingest and validate

- Accept JPEG/PNG (e.g. max 10MB, max 4096×4096).
- Decode with Sharp or Pillow; reject if corrupt.
- Store original; keep a copy for inference.

### Step 2: Resize for model

- Resize to model input size (e.g. 513×513 or 1024×1024) with aspect ratio preserved or letterbox; record scale and offset for mapping predictions back to original coordinates.

### Step 3: Segmentation

- Run DeepLab (or chosen model) on the resized image.
- Output: H×W integer label map (pixel class IDs).
- Map indices to semantic labels (floor, wall, cabinet, countertop); ignore other classes or merge into “other”.

### Step 4: Depth (optional)

- Run MiDaS/DPT on same resized image.
- Output: H×W float depth map; normalize to 0–1 for storage or visualization.

### Step 5: Mask extraction

- For each target class (floor, wall, cabinet, countertop):
  - Binary mask: `mask = (label_map == class_id)`.
  - Upsample mask to original resolution using the same scale/offset as in Step 2.
  - Optional: morphological cleanup (open/close) to remove small holes and speckle.
  - Optional: boundary refinement with CRF or contour smoothing.
- Save each mask as PNG (or RLE); optionally store as data URL or file path in API response.

### Step 6: Surface geometry (for texture mapping)

- **Planar assumption:** Each surface (floor, wall, cabinet face, countertop) is treated as a plane and represented by a quadrilateral in image space.
- For each mask:
  - Find contour (e.g. largest connected component, outer boundary).
  - Fit a quad (4 corners): convex hull then simplify to 4 points, or detect four dominant corners (e.g. Harris + selection, or min-area quadrilateral).
  - Store quad in normalized coordinates (0–1 or 0–100%) so the frontend or backend can scale to any resolution.
- If quad fitting fails (e.g. thin or curved region), fall back to bounding box or the mask’s axis-aligned bounding box.

### Step 7: Texture mapping (see Section 4)

- For each surface with an assigned texture:
  - Load texture image; optionally tile or scale to quad size.
  - Compute homography from texture quad (e.g. unit square or tiled quad) to image-space quad.
  - Warp texture onto image (OpenCV `warpPerspective` or equivalent).
  - Blend with original using mask (and optional depth-based opacity).

### Step 8: Composite and encode

- Composite order: back to front (e.g. floor → wall → cabinet → countertop); use depth map to resolve overlaps if needed.
- Blend warped textures with original photo (multiply or overlay to preserve lighting).
- Encode result to JPEG/PNG; store in cache or attach to project.

### Step 9: Cache and return

- Cache final image and masks by `uploadId` or hash; TTL or LRU to limit disk use.
- Return URLs or inline data (e.g. mask URLs, composite URL) in API response.

---

## 4. Realistic Texture Mapping Without Full 3D

Roomvo-style systems often use 3D reconstruction. Here we stay in **2D image space** and assume **planar surfaces** to avoid full 3D.

### 4.1 Homography-based projection

- A plane in 3D is related to the image by a **homography** (3×3 matrix).
- **Texture quad** (e.g. unit square `(0,0), (1,0), (1,1), (0,1)` or a rectangle with correct aspect ratio) is mapped to the **detected quad** in the image.
- Compute homography `H` from texture corners to detected quad corners (e.g. `getPerspectiveTransform` in OpenCV).
- Warp texture with `warpPerspective` using `H`; then mask by the surface mask so only the intended region is replaced.

### 4.2 Tiling and scale

- **Tiling:** If texture is smaller than the quad, tile it in texture space first (repeat), then warp the tiled result so perspective is correct in image space.
- **Scale:** User or system can choose “scale” (e.g. 1 tile per 2 m²). Convert to pixels using estimated scale from depth or a fixed DPI assumption; then tile accordingly before warp.

### 4.3 Lighting preservation

- **Option A (simple):** Composite warped texture with **multiply** or **overlay** blend using the original image’s luminance in that region so lighting and shadows from the photo are preserved.
- **Option B:** Estimate simple lighting from the original (e.g. average intensity per channel in the mask); scale texture by a factor so highlights/shadows roughly match.
- **Option C (advanced):** Use depth to compute a simple normal and modulate texture with a directional light; still 2D, no full 3D mesh.

### 4.4 Edges and occlusion

- Use the **binary mask** so texture is only applied inside the surface; feathered mask edges (e.g. 2–5 px) reduce hard seams.
- When multiple surfaces overlap (e.g. cabinet in front of wall), composite in depth order (e.g. wall first, then cabinet) so occlusion is correct.

### 4.5 Limitations

- **Single view:** No parallax; moving the “camera” would require full 3D.
- **Planar assumption:** Curved walls or rounded corners are approximated by a single quad; accuracy is limited.
- **Reflections and complex lighting:** Not re-rendered; we only re-texture and blend.

---

## 5. Minimal MVP Architecture (Single Server)

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Single server                  │
  Client            │  ┌─────────────┐    ┌─────────────────────────┐ │
  (Browser) ────────┼──│  NestJS API │───▶│  Python worker (optional)│ │
                    │  │  (Node)     │    │  or ONNX in Node         │ │
                    │  └──────┬──────┘    │  Segmentation + Depth    │ │
                    │         │           └─────────────┬─────────────┘ │
                    │         │                         │               │
                    │         ▼                         ▼               │
                    │  ┌─────────────┐           ┌─────────────┐        │
                    │  │  Local FS   │           │  Mask +     │        │
                    │  │  uploads/   │           │  composite  │        │
                    │  │  exports/   │           │  cache      │        │
                    │  └─────────────┘           └─────────────┘        │
                    └─────────────────────────────────────────────────┘
```

### 5.1 Components

| Component | Responsibility |
|-----------|----------------|
| **NestJS API** | Upload (multer), segment (call worker or run ONNX), materials, projects, export; serve static or redirect to stored files. |
| **Worker** | Optional separate process (Python or Node): read image path from queue or HTTP, run segmentation (+ optional depth), write masks and metadata, return paths or JSON. |
| **Disk** | `uploads/` (originals), `cache/` (masks, composites keyed by uploadId/hash), `exports/` (downloadable previews). |
| **Materials** | Static assets (thumbnails + textures) under `public/materials/` or in MinIO; metadata in JSON or DB. |

### 5.2 Data flow (MVP)

1. **POST /upload** → file saved to `uploads/`, return `uploadId` and `roomImageUrl`.
2. **POST /segment** (body: `uploadId` or `image_url`) → API calls worker (or runs ONNX in-process); worker returns `DetectionResult` with `detections[]` (each with `label`, `bbox`, `maskUrl`, optional `quad`).
3. **GET /materials** → list materials; **PATCH /projects/:id** → store `appliedMaterials` (regionId → materialId).
4. **POST /projects/:id/export** (or GET with cache) → load project, load masks and applied textures, run texture mapping + composite, write to `exports/`, return URL.

### 5.3 No GPU required

- DeepLab and MiDaS small run on CPU (ONNX Runtime) in a few seconds per image; acceptable for MVP.
- Optional: CUDA execution provider for ONNX or PyTorch if a GPU is available; same code path, faster.

### 5.4 Scaling later

- Move inference to a dedicated worker pool; API stays stateless.
- Put uploads and cache in MinIO or S3-compatible storage.
- Add Redis for job queue and optional response cache.

---

## 6. Limitations vs Roomvo

| Aspect | This system (no-cost, open-source) | Roomvo (typical commercial) |
|--------|-----------------------------------|-----------------------------|
| **Input** | Single photo | Often multiple photos or 3D scan |
| **Geometry** | 2D masks + planar quads | Full 3D mesh / room model |
| **View** | Fixed viewpoint | Multiple views / walk-through |
| **Materials** | Homography warp + blend | PBR in 3D engine |
| **Lighting** | Preserve original or simple modulation | Re-rendered lighting |
| **Accuracy** | Depends on segmentation and quad fit | Higher with 3D and multi-view |
| **Cost** | $0 licensing | Licensing and/or SaaS fees |
| **Deployment** | Self-hosted, single server possible | Often cloud-only |

---

## 7. Implementation Checklist (MVP)

- [ ] Choose segmentation model (recommended: DeepLab ADE20K), export to ONNX.
- [ ] Implement segment endpoint: load image, run ONNX, extract floor/wall/cabinet/countertop masks, return `DetectionResult` with `maskUrl` (and optional `quad`).
- [ ] Optional: add depth model (MiDaS small) and expose depth for ordering/blending.
- [ ] Implement quad detection from each mask (contour → 4 corners); store in detection or separate geometry endpoint.
- [ ] Implement texture mapping: homography from texture to quad, warp, mask, blend; expose via export or preview endpoint.
- [ ] Add caching for masks and composites; TTL or LRU.
- [ ] Document ADE20K class IDs and any config (input size, confidence threshold) in code or `docs/`.

---

## 8. References (all open-source)

- **DeepLab:** [TensorFlow DeepLab](https://github.com/tensorflow/models/tree/master/research/deeplab), [ADE20K class list](https://github.com/CSAILVision/sceneparsing/blob/master/objectInfo150.csv).
- **ONNX Runtime:** [onnxruntime](https://github.com/microsoft/onnxruntime) (Node and Python).
- **MiDaS:** [Intel MiDaS](https://github.com/isl-org/MiDaS); ONNX exports available.
- **OpenCV:** [opencv-python](https://pypi.org/project/opencv-python/) or [opencv4nodejs](https://github.com/justadudewhoah/opencv4nodejs) for homography and warp.

This document is the single source of truth for the no-cost, open-source room visualization stack and pipeline. Implementation can start from the existing NestJS API and segment stub by plugging in ONNX segmentation and the pipeline above.
