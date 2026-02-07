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
	parser.add_argument("--texture")
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


def build_texture_hint(texture_path: Path, size: tuple[int, int]) -> Image.Image:
	texture = Image.open(texture_path).convert("RGB")
	tw, th = texture.size
	w, h = size
	if tw == 0 or th == 0:
		return texture.resize(size, resample=Image.BILINEAR)
	tiles_x = max(1, int((w + tw - 1) / tw))
	tiles_y = max(1, int((h + th - 1) / th))
	canvas = Image.new("RGB", (tw * tiles_x, th * tiles_y))
	for y in range(tiles_y):
		for x in range(tiles_x):
			canvas.paste(texture, (x * tw, y * th))
	return canvas.crop((0, 0, w, h))


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

	model_path = Path(model_id)
	if not model_path.is_absolute():
		model_path = Path.cwd() / model_path
	is_ckpt = model_path.is_file() and model_path.suffix in {".ckpt", ".safetensors"}
	if is_ckpt:
		config_path = os.environ.get("SD_INPAINT_CONFIG")
		kwargs: dict[str, object] = {"torch_dtype": dtype}
		if config_path:
			config_file = Path(config_path)
			if not config_file.is_absolute():
				config_file = Path.cwd() / config_file
			kwargs["original_config"] = str(config_file)
		pipe = StableDiffusionInpaintPipeline.from_single_file(
			str(model_path),
			**kwargs,
		)
	else:
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
	texture_hint = None
	if args.texture:
		texture_path = Path(args.texture)
		if not texture_path.is_absolute():
			texture_path = Path.cwd() / texture_path
		if texture_path.exists():
			texture_hint = build_texture_hint(texture_path, image.size)
			image = Image.composite(texture_hint, image, mask)

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
	if texture_hint:
		blend_alpha = float(os.environ.get("TEXTURE_BLEND_ALPHA", "0.6"))
		blend_alpha = max(0.0, min(1.0, blend_alpha))
		blended = Image.blend(out, texture_hint, blend_alpha)
		out = Image.composite(blended, out, mask)
	out.save(args.output)


if __name__ == "__main__":
	main()
