#!/bin/sh
MODEL_ID="${SD_INPAINT_MODEL_ID:-stable-diffusion-v1-5/stable-diffusion-inpainting}"
HF_HOME="${HF_HOME:-/app/.cache/huggingface}"

echo "Prefetching inpaint model: ${MODEL_ID}"
echo "HF_HOME=${HF_HOME}"
echo "Python version: $(python3 --version 2>&1)"
echo "Disk usage (HF cache):"
du -sh "${HF_HOME}" 2>/dev/null || true

python3 -c "import os, sys; from diffusers import StableDiffusionInpaintPipeline as P; from huggingface_hub import logging as hf_logging; hf_logging.set_verbosity_info(); hf_logging.enable_progress_bars(); os.environ['HF_HUB_DISABLE_TELEMETRY']='1'; model_id=os.environ.get('SD_INPAINT_MODEL_ID','stable-diffusion-v1-5/stable-diffusion-inpainting'); cache_dir=os.environ.get('HF_HOME','/app/.cache/huggingface'); print(f'Downloading model to cache_dir={cache_dir}'); sys.stdout.flush(); pipe=P.from_pretrained(model_id, cache_dir=cache_dir, local_files_only=False); print('Model downloaded. Components:', list(pipe.components.keys())); print('Model cached.')"

echo "Disk usage (HF cache) after:"
du -sh "${HF_HOME}" 2>/dev/null || true
