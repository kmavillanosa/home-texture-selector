# Training for More Accurate Segmentation

This guide explains how to improve segment boundaries and accuracy by (1) **edge refinement** (no training) and (2) **fine-tuning** the model on your own or public data.

---

## 1. Edge refinement (no training)

Segment edges can be aligned to the original image so boundaries are a **clear cut** of the surfaces.

### Refine edges with image (GrabCut)

Set in `api/segmentation-api/.env`:

```env
REFINE_EDGES_WITH_IMAGE=true
```

This runs **GrabCut** on each mask using the photo as guidance: the boundary band is marked “probable” so the algorithm refines it to image edges. Boundaries become sharper and follow object contours.

- **Default:** `true`. Set to `false` to use raw model masks only.
- **Slower:** GrabCut runs per surface; disable if speed is more important than edge quality.

### Precise mode (no feather, no morph)

For pixel-sharp boundaries without smoothing:

```env
PRECISE_SEGMENTATION=true
```

This turns off feathering and morphological closing so masks match the model (and refinement) exactly.

---

## 2. Dataset format for training / fine-tuning

To train or fine-tune the model you need **images + pixel-level labels** in a format the trainer can read.

### ADE20K-style layout

SegFormer (and our script) expect **one class index per pixel**:

- **Image:** any resolution, e.g. `image.png` or `image.jpg`.
- **Label image:** same size as the image, single channel (grayscale PNG), **pixel value = class index**.
  - `0` = background / ignore.
  - `1..N` = your class IDs (must match the order in your config).

Example directory layout:

```
data/
  images/
    train/
      room_001.png
      room_002.png
    val/
      room_101.png
  annotations/
    train/
      room_001.png   # same name, pixel value = class index
      room_002.png
    val/
      room_101.png
```

Class index meaning (example):

- 0: background  
- 1: wall  
- 2: floor  
- 3: ceiling  
- 4: cabinet  
- …

You can start from **ADE20K** (150 classes, indoor/outdoor) or build a **small custom set** of room photos + hand-drawn or tool-assisted masks.

### Creating training data with good experience

1. **Use high-quality photos:** good lighting, sharp, representative of your use case (e.g. same room types, angles).
2. **Consistent labels:** same class index for the same surface type across all images; avoid mixing naming (e.g. “Wall” vs “wall”).
3. **Clear boundaries:** masks should follow real edges (walls, furniture, floor). Use a brush or polygon tool; avoid jagged or approximate boundaries if you want “clear cut” segments.
4. **Enough variety:** different rooms, angles, and furniture so the model generalizes.
5. **Validation set:** keep 10–20% of images for validation (do not train on them) to monitor overfitting and boundary quality.

Tools that can help create label images:

- **Labelme** (polygons → export as PNG with class indices).
- **CVAT** (semantic segmentation, export in the format your trainer expects).
- **Custom scripts** to convert vector masks or COCO-style segmentations to single-channel PNGs with pixel = class index.

---

## 3. Fine-tuning SegFormer with Hugging Face

We use **SegFormer** (e.g. `nvidia/segformer-b5-finetuned-ade-640-640`) and the **Hugging Face Transformers** API. You can fine-tune it on your dataset.

### 3.1 Prepare a dataset Hugging Face can load

Use the **Datasets** library with a custom loading script or a builder that:

- Loads images from `images/train`, `images/val`.
- Loads label PNGs from `annotations/train`, `annotations/val` (same filenames).
- Returns `{"pixel_values": tensor, "labels": tensor}` where `labels` is the same shape as the image, with class indices (int), and **reduce_labels** applied if your labels are 1..N (then 0..N-1) to match the model’s loss.

Example (conceptual):

```python
# datasets/room_seg.py (custom dataset script)
def load_room_seg(split):
    # load image paths and annotation paths for split in ("train", "val")
    # decode image, decode label PNG (single channel, pixel = class index)
    # return {"pixel_values": ..., "label": ...}  (label shape = H, W)
```

Or use **ImageFolder**-style with a custom `map` that loads the corresponding annotation PNG and returns the right keys.

### 3.2 Training script (outline)

- **Model:** `SegformerForSemanticSegmentation.from_pretrained("nvidia/segformer-b5-finetuned-ade-640-640")`.
- **Processor:** `SegformerImageProcessor.from_pretrained(...)` (same ID). Use the same `size`, `reduce_labels`, etc. as the pre-trained config.
- **Data:** Your dataset that yields `pixel_values` and `labels` (and optional `mask` for loss masking).
- **Training:** Use `Trainer` with `TrainingArguments` (e.g. output_dir, num_epochs, per_device_train_batch_size, learning_rate, fp16). Loss is typically **cross-entropy** over pixels (ignore index = 255 or your background index if you use `reduce_labels`).
- **Validation:** Compute mean IoU (and optionally boundary F1) on the validation set.

After training, **save the model and processor** (e.g. to a local path or Hugging Face Hub). Point the app to this model via:

```env
ADE_MODEL_ID=/path/to/your/finetuned-segformer
```

(or your Hugging Face model ID).

### 3.3 Tips for better boundaries and accuracy

- **Higher resolution:** If your GPU allows, train/validate at 640×640 or higher so boundaries are finer.
- **Boundary loss:** Optionally add a boundary-weighted term (e.g. higher loss on pixels near boundaries) so the model focuses on clear cuts.
- **Data augmentation:** Random crop, flip, color jitter; avoid heavy blur that would soften edges if you want sharp boundaries.
- **Pre-trained checkpoint:** Start from `nvidia/segformer-b5-finetuned-ade-640-640` (or B4) so you keep ADE20K knowledge and only adapt to your rooms.

---

## 4. References

- **ADE20K:** [Semantic Understanding of Scenes through ADE20K](https://groups.csail.mit.edu/vision/datasets/ADE20K/). Use their annotation format/tools as a reference for “good experience” data.
- **SegFormer:** [Hugging Face SegFormer](https://huggingface.co/docs/transformers/model_doc/segformer), [NVIDIA SegFormer B5 ADE20K](https://huggingface.co/nvidia/segformer-b5-finetuned-ade-640-640).
- **Training:** [Hugging Face Image Segmentation](https://huggingface.co/docs/transformers/tasks/semantic_segmentation) task guide.

Using **REFINE_EDGES_WITH_IMAGE=true** (and optionally **PRECISE_SEGMENTATION**) gives clearer segment edges without training. For even better accuracy and boundaries on your own scenes, add training data in the format above and fine-tune SegFormer as in §3.
