# Free Models for Segmentation (No-Cost Roomvo-Like)

Surface detection uses **TensorFlow.js** with **DeepLab ADE20K** (pixel-level segmentation). No paid APIs, no COCO-SSD in this repo.

## Pixel-level segmentation (DeepLab ADE20K)

- **Model**: DeepLab ADE20K loaded from TF Hub via `tf.loadGraphModel` (no separate deeplab package)
- **URL**: `https://tfhub.dev/tensorflow/tfjs-model/deeplab/ade20k/1/quantized/2/1`
- **Task**: Semantic segmentation (Wall, Floor, Cabinet, Countertop) — ADE20K class IDs 1, 4, 11, 71
- **Output**: PNG mask per surface served from `/cache/`; overlays follow actual pixels
- **Image I/O**: Sharp (resize, raw buffer, mask PNG); `node-fetch` polyfill for Node &lt; 18

## Setup

1. In `api/segmentation-api`: `npm install` (adds `@tensorflow/tfjs`, `sharp`, `node-fetch`).
2. Restart the API; `POST /segment` with `uploadId` or `imageUrl` runs DeepLab and returns detections with `maskUrl` per surface.

No environment variables or API keys are required.

## When detection fails

If the model fails to load or run (e.g. network, missing deps), the backend returns `detections: []` and `detectionFailed: true`. The UI shows “Surface detection unavailable”.

## Not used in this repo

- **COCO-SSD** – removed (object detection not used for room surfaces)
- **Hugging Face Inference API** – not used
- **Google Cloud Vision API / other Vision APIs** – not integrated

See **NO_COST_ROOMVO_ARCHITECTURE.md** for full pipeline and optional depth/ONNX.
