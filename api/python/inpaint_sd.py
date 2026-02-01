import argparse
import os
from pathlib import Path

import torch
from PIL import Image


def parse_args():
	parser = argparse.ArgumentParser()
	parser.add_argument("--image", required=True)
	parser.add_argument("--mask", required=True)
	parser.add_argument("--prompt", required=True)
	parser.add_argument("--output", required=True)
	parser.add_argument("--steps", type=int, default=25)
	parser.add_argument("--seed", type=int, default=0)
	return parser.parse_args()


def load_mask(mask_path: Path, size: tuple[int, int]) -> Image.Image:
	mask = Image.open(mask_path)
	if mask.mode == "RGBA":
		# Use alpha as mask
		alpha = mask.split()[-1]
		mask = alpha
	else:
		mask = mask.convert("L")
	mask = mask.resize(size, resample=Image.NEAREST)
	return mask


def main():
	args = parse_args()
	model_id = os.environ.get(
		"SD_INPAINT_MODEL_ID", "runwayml/stable-diffusion-inpainting"
	)
	token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
	local_only = os.environ.get("SD_LOCAL_ONLY", "false").lower() == "true"
	device = "cuda" if torch.cuda.is_available() else "cpu"
	dtype = torch.float16 if device == "cuda" else torch.float32

	from diffusers import StableDiffusionInpaintPipeline

	pipe = StableDiffusionInpaintPipeline.from_pretrained(
		model_id,
		torch_dtype=dtype,
		token=token,
		local_files_only=local_only,
	)
	pipe = pipe.to(device)
	pipe.safety_checker = None

	image = Image.open(args.image).convert("RGB")
	mask = load_mask(Path(args.mask), image.size)

	generator = None
	if args.seed and args.seed > 0:
		generator = torch.Generator(device=device).manual_seed(args.seed)

	result = pipe(
		prompt=args.prompt,
		image=image,
		mask_image=mask,
		num_inference_steps=args.steps,
		generator=generator,
	)
	out = result.images[0]
	out.save(args.output)


if __name__ == "__main__":
	main()
