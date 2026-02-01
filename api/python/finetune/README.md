# ADE20K fine-tuning scaffold

This folder is a lightweight **scaffold** to fine-tune SegFormer
for room segmentation. It does not download ADE20K automatically.

## 1) Prepare data

Expected structure:

```
api/python/finetune/data/ade20k/
  images/
    train/
    val/
  annotations/
    train/
    val/
```

- `images/*` are RGB images (jpg/png)
- `annotations/*` are label masks (png) with **class IDs** (0..149)

If you already have ADE20K, point `--data-dir` to it.

## 2) Create a venv (optional)

```
python -m venv .venv
.venv\\Scripts\\activate
pip install -r ..\\requirements.txt
```

## 3) Run training

```
python train_segformer.py ^
  --data-dir data/ade20k ^
  --model-id nvidia/segformer-b4-finetuned-ade-512-512 ^
  --output-dir outputs/segformer-ade-room ^
  --epochs 3 ^
  --batch-size 2 ^
  --lr 5e-5
```

## 4) Use your fine-tuned model

Point the API to the output directory:

```
ADE_MODEL_ID=outputs/segformer-ade-room
```

Or upload it to Hugging Face and use that model ID.
