import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage
from typing import Optional

try:
	from retinex_net import load_decomnet
except Exception:
	load_decomnet = None  # type: ignore


def _configure_torch() -> None:
	import torch
	threads_raw = os.environ.get("TORCH_NUM_THREADS", "")
	if threads_raw.isdigit():
		torch.set_num_threads(int(threads_raw))
	if torch.cuda.is_available():
		torch.backends.cudnn.benchmark = True
	if hasattr(torch, "set_float32_matmul_precision"):
		torch.set_float32_matmul_precision("high")


def get_segmentation_device():
	import torch
	device_raw = os.environ.get("SEGMENTATION_DEVICE", "auto").lower()
	if device_raw == "auto":
		if torch.cuda.is_available():
			return torch.device("cuda")
		if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
			return torch.device("mps")
		return torch.device("cpu")
	try:
		return torch.device(device_raw)
	except Exception:
		return torch.device("cpu")


def load_model():
	# Best SegFormer for ADE20K: B5 ~51% mIoU. Use B4 (50.3%) for less VRAM:
	#   ADE_MODEL_ID=nvidia/segformer-b4-finetuned-ade-512-512
	# B2 is lighter: nvidia/segformer-b2-finetuned-ade-512-512
	model_id = os.environ.get(
		"ADE_MODEL_ID", "nvidia/segformer-b5-finetuned-ade-640-640"
	)
	from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
	import torch

	_configure_torch()
	device = get_segmentation_device()
	processor = SegformerImageProcessor.from_pretrained(model_id)
	model = SegformerForSemanticSegmentation.from_pretrained(model_id)
	model.to(device)
	model.eval()
	return processor, model, device


_RETINEX_DECOM_MODEL = None


def get_retinex_model() -> Optional[object]:
	"""Load DecomNet once (optional)."""
	global _RETINEX_DECOM_MODEL
	if _RETINEX_DECOM_MODEL is not None:
		return _RETINEX_DECOM_MODEL
	if load_decomnet is None:
		return None
	ckpt_path = os.environ.get("RETINEX_DECOM_CKPT", "")
	if not ckpt_path or not os.path.exists(ckpt_path):
		return None
	_RETINEX_DECOM_MODEL = load_decomnet(ckpt_path)
	return _RETINEX_DECOM_MODEL


def compute_illumination_map(img_array: np.ndarray) -> Optional[np.ndarray]:
	"""
	Run Retinex DecomNet to get illumination map (H,W) in [0,255].
	Returns None if model not available.
	"""
	model = get_retinex_model()
	if model is None:
		return None
	import torch
	with torch.no_grad():
		h, w = img_array.shape[:2]
		# Normalize RGB to [0,1]
		rgb = img_array.astype(np.float32) / 255.0
		gray = np.mean(rgb, axis=2, keepdims=True)
		inp = np.concatenate([rgb, gray], axis=2)  # H,W,4
		t = torch.from_numpy(inp).permute(2, 0, 1).unsqueeze(0)
		R, I = model(t)
		illum = I.squeeze(0).squeeze(0).cpu().numpy()
		illum = np.clip(illum, 0, 1)
		return (illum * 255.0).astype(np.uint8)


def normalize_shadows(
	img_rgb: np.ndarray, clip_limit: float = 2.0, tile_size: int = 8, blur_radius: int = 0
) -> np.ndarray:
	"""Apply CLAHE on L channel so shadowed surfaces look more like lit ones."""
	# PIL Image is RGB; OpenCV expects BGR
	bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
	lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
	l, a, b = cv2.split(lab)
	clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
	l = clahe.apply(l)
	lab = cv2.merge([l, a, b])
	bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
	if blur_radius > 0:
		ksize = blur_radius * 2 + 1
		bgr = cv2.GaussianBlur(bgr, (ksize, ksize), 0)
	return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def refine_surface_mask(
	mask: np.ndarray,
	*,
	close_radius: int = 4,
	fill_holes: bool = False,
	max_hole_pixels: int | None = None,
) -> np.ndarray:
	"""
	Refine a surface mask so it extends through shadows and small occlusions.
	- Closing (dilate + erode) bridges gaps from shadows or thin occluders.
	- Optional hole-fill makes the surface continuous under furniture (e.g. floor under table).
	"""
	out = mask.astype(np.uint8)
	if close_radius > 0:
		kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * close_radius + 1,) * 2)
		out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, kernel)
	if fill_holes:
		if max_hole_pixels is None or max_hole_pixels <= 0:
			out = ndimage.binary_fill_holes(out).astype(np.uint8)
		else:
			# Fill only small holes (e.g. floor under chair), not large occlusions (e.g. table interior)
			inv = 1 - out
			labeled, num = ndimage.label(inv)
			border_labels = set(
				np.unique(
					np.concatenate([
						labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
					])
				)
			)
			for i in range(1, num + 1):
				if i in border_labels:
					continue
				if (labeled == i).sum() <= max_hole_pixels:
					out[labeled == i] = 1
	return out


def remove_small_components(mask: np.ndarray, min_pixels: int) -> np.ndarray:
	"""Remove tiny islands from a binary mask."""
	if min_pixels <= 0:
		return mask
	labeled, num = ndimage.label(mask)
	if num <= 1:
		return mask
	out = np.zeros_like(mask, dtype=bool)
	for i in range(1, num + 1):
		count = int((labeled == i).sum())
		if count >= min_pixels:
			out |= labeled == i
	return out


def keep_largest_component(mask: np.ndarray, min_pixels: int) -> np.ndarray:
	"""Keep only the largest connected component if it is big enough."""
	labeled, num = ndimage.label(mask)
	if num <= 1:
		return mask
	sizes = [(i, int((labeled == i).sum())) for i in range(1, num + 1)]
	idx, size = max(sizes, key=lambda x: x[1])
	if size < min_pixels:
		return mask
	return labeled == idx


def smooth_mask_edges(mask: np.ndarray, radius: int = 2) -> np.ndarray:
	"""Light smoothing to reduce jagged or irregular edges."""
	if radius <= 0:
		return mask
	out = mask.astype(np.uint8)
	kernel = cv2.getStructuringElement(
		cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1)
	)
	out = cv2.morphologyEx(out, cv2.MORPH_OPEN, kernel)
	out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, kernel)
	blurred = cv2.medianBlur((out * 255).astype(np.uint8), 2 * radius + 1)
	return (blurred > 127).astype(bool)


def split_components(mask: np.ndarray, min_pixels: int) -> list[np.ndarray]:
	"""Split mask into connected components, keeping only significant regions."""
	labeled, num = ndimage.label(mask)
	if num <= 1:
		return [mask]
	out: list[np.ndarray] = []
	for i in range(1, num + 1):
		comp = labeled == i
		if int(comp.sum()) >= min_pixels:
			out.append(comp)
	return out if out else [mask]


def base_label(label: str) -> str:
	return label.split(" ")[0]


def dominant_texture_angle(img_array: np.ndarray, mask: np.ndarray) -> float:
	"""
	Estimate dominant edge/texture direction in the masked region using structure tensor.
	Returns angle in degrees [0, 180) so the applied texture can be rotated to match.
	"""
	gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
	gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
	gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
	m = mask.astype(bool) if mask.dtype != bool else mask
	gxx = np.where(m, gx * gx, 0)
	gyy = np.where(m, gy * gy, 0)
	gxy = np.where(m, gx * gy, 0)
	total = max(m.sum(), 1)
	Gxx, Gyy, Gxy = gxx.sum() / total, gyy.sum() / total, gxy.sum() / total
	# Principal angle of gradient (direction of least change = along edges)
	angle_rad = 0.5 * np.arctan2(2 * Gxy, Gxx - Gyy)
	# Texture runs perpendicular to edges
	texture_rad = angle_rad + np.pi / 2
	deg = np.degrees(texture_rad)
	deg = deg % 180.0
	return float(deg)


def refine_mask_edges(
	img_bgr: np.ndarray,
	mask: np.ndarray,
	boundary_width: int = 5,
) -> np.ndarray:
	"""
	Refine mask boundaries so they align with image edges (clear cut).
	Uses GrabCut with the mask as initialization; boundary band is marked probable
	so the algorithm can refine it. Returns refined boolean mask.
	"""
	# OpenCV GrabCut: 0=GC_BGD, 1=GC_FGD, 2=GC_PR_BGD, 3=GC_PR_FGD
	GC_BGD, GC_FGD = 0, 1
	GC_PR_BGD, GC_PR_FGD = 2, 3
	H, W = mask.shape[:2]
	mask_bool = mask.astype(bool) if mask.dtype != bool else mask
	gc_mask = np.full((H, W), GC_PR_BGD, dtype=np.uint8)
	gc_mask[mask_bool] = GC_PR_FGD
	# Certain foreground: interior (eroded)
	kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (boundary_width * 2 + 1,) * 2)
	interior = cv2.erode(mask_bool.astype(np.uint8), kernel).astype(bool)
	if interior.any():
		gc_mask[interior] = GC_FGD
	# Certain background: exterior (dilated inverse)
	exterior = cv2.dilate((~mask_bool).astype(np.uint8), kernel).astype(bool)
	if exterior.any():
		gc_mask[exterior] = GC_BGD
	# Bounding rect for GrabCut
	ys, xs = np.where(mask_bool)
	if len(ys) == 0:
		return mask_bool
	x1, x2 = max(0, int(xs.min()) - 1), min(W, int(xs.max()) + 2)
	y1, y2 = max(0, int(ys.min()) - 1), min(H, int(ys.max()) + 2)
	rect = (x1, y1, x2 - x1, y2 - y1)
	bgd_model = np.zeros((1, 65), dtype=np.float64)
	fgd_model = np.zeros((1, 65), dtype=np.float64)
	try:
		cv2.grabCut(img_bgr, gc_mask, rect, bgd_model, fgd_model, 2, cv2.GC_INIT_WITH_MASK)
		refined = (gc_mask == GC_FGD) | (gc_mask == GC_PR_FGD)
		return refined
	except Exception:
		return mask_bool


def soft_mask_to_png(mask: np.ndarray, out_path: Path):
	# mask: uint8 0..255 alpha
	rgba = np.zeros((mask.shape[0], mask.shape[1], 4), dtype=np.uint8)
	rgba[..., 0:3] = 255
	rgba[..., 3] = mask
	Image.fromarray(rgba, mode="RGBA").save(out_path, format="PNG")

def apply_mask_crop(img: Image.Image, alpha: np.ndarray, out_path: Path):
	rgba = img.convert("RGBA")
	alpha_img = Image.fromarray(alpha, mode="L")
	rgba.putalpha(alpha_img)
	rgba.save(out_path, format="PNG")


def apply_mask_crop_tight(
	img: Image.Image,
	alpha: np.ndarray,
	min_x: int,
	min_y: int,
	max_x: int,
	max_y: int,
	out_path: Path,
) -> None:
	"""Crop image and alpha to the exact bounding box so the file is pixel-precise per object."""
	w = max_x - min_x + 1
	h = max_y - min_y + 1
	box = (min_x, min_y, max_x + 1, max_y + 1)
	img_crop = img.crop(box)
	alpha_crop = alpha[min_y : max_y + 1, min_x : max_x + 1]
	rgba = img_crop.convert("RGBA")
	rgba.putalpha(Image.fromarray(alpha_crop, mode="L"))
	rgba.save(out_path, format="PNG")


# ADE20K target classes (1-indexed per objectInfo150.csv); stored as 0-indexed for model.
_TARGET = [
	("Wall", [1]),
	("Floor", [4]),
	("Ceiling", [6]),
	("Rug", [29]),
	("Cabinet", [11]),
	("Shelf", [25]),
	("Counter", [46]),
	("Countertop", [71]),
]
_TARGET = [(label, [i - 1 for i in ids]) for (label, ids) in _TARGET]
_TARGET = [(label, np.array(ids, dtype=np.int32)) for (label, ids) in _TARGET]
_SURFACE_LABELS = {"Floor", "Flooring", "Wall", "Ceiling", "Backsplash", "Rug"}

# ADE20K "thing" classes to exclude from surface masks (1-indexed ids)
_OCCLUDER_IDS = {
	i - 1
	for i in [
		5, 8, 9, 11, 13, 15, 16, 18, 19, 20, 21, 23, 24, 25, 28, 31, 32, 33,
		34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48, 50, 51, 54,
		56, 57, 58, 59, 63, 64, 65, 66, 67, 68, 70, 71, 72, 73, 74, 75, 76,
		77, 78, 79, 81, 82, 83, 84, 86, 87, 88, 89, 90, 91, 93, 94, 96, 98,
		99, 100, 101, 103, 104, 105, 107, 108, 109, 111, 112, 113, 115, 116,
		117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131,
		132, 133, 134, 135, 136, 137, 138, 139, 140, 142, 143, 144, 145, 146,
		147, 148, 149, 150,
	]
}
_OCCLUDER_IDS_ARRAY = np.array(sorted(_OCCLUDER_IDS), dtype=np.int32)


def _read_config(orig_w: int, orig_h: int):
	"""Read env-derived config used by run_one (so daemon can re-use per request)."""
	fast_mode = os.environ.get("FAST_SEGMENTATION", "false").lower() == "true"
	precise_seg = os.environ.get("PRECISE_SEGMENTATION", "false").lower() == "true"
	morph_close_radius = 0 if precise_seg else int(os.environ.get("MORPH_CLOSE_RADIUS", "4"))
	fill_surface_holes = os.environ.get("FILL_SURFACE_HOLES", "true").lower() == "true"
	max_hole_pixels_raw = os.environ.get("MAX_HOLE_PIXELS", "")
	max_hole_pixels = int(max_hole_pixels_raw) if max_hole_pixels_raw.isdigit() else None
	if max_hole_pixels is None and fill_surface_holes:
		max_hole_pixels = max(500, int(orig_w * orig_h * 0.02))
	feather = 0.0 if precise_seg else float(os.environ.get("CROP_FEATHER_RADIUS", "4.0"))
	refine_edges = os.environ.get("REFINE_EDGES_WITH_IMAGE", "true").lower() == "true"
	use_shadow_norm = os.environ.get("USE_SHADOW_NORMALIZATION", "true").lower() == "true"
	use_relighting = os.environ.get("USE_RETINEX_RELIGHTING", "false").lower() == "true"
	use_texture_angle = os.environ.get("USE_TEXTURE_ANGLE", "true").lower() == "true"
	smooth_masks = os.environ.get("USE_MASK_SMOOTHING", "true").lower() == "true"
	occluder_dilate_radius = int(os.environ.get("OCCLUDER_DILATE_RADIUS", "3"))
	shadow_blur_radius = int(os.environ.get("SHADOW_BLUR_RADIUS", "1"))
	input_size_raw = os.environ.get("SEGMENTATION_INPUT_SIZE", "")
	input_size = int(input_size_raw) if input_size_raw.isdigit() else None
	output_max_edge_raw = os.environ.get("SEGMENTATION_OUTPUT_MAX_EDGE", "")
	output_max_edge = (
		int(output_max_edge_raw) if output_max_edge_raw.isdigit() else None
	)
	if fast_mode:
		use_shadow_norm = False
		use_relighting = False
		refine_edges = False
		use_texture_angle = False
		smooth_masks = False
		occluder_dilate_radius = 0
		morph_close_radius = 0
		fill_surface_holes = False
		max_hole_pixels = None
		feather = 0.0
		shadow_blur_radius = 0
	return {
		"fast_mode": fast_mode,
		"use_shadow_norm": use_shadow_norm,
		"shadow_clip_limit": float(os.environ.get("SHADOW_CLIP_LIMIT", "2.2")),
		"shadow_tile_size": int(os.environ.get("SHADOW_TILE_SIZE", "10")),
		"shadow_blur_radius": shadow_blur_radius,
		"occluder_dilate_radius": occluder_dilate_radius,
		"occluder_block_surfaces": os.environ.get("OCCLUDER_BLOCK_SURFACES", "true").lower() == "true",
		"generate_cropped": os.environ.get("GENERATE_CROPPED", "false") == "true",
		"refine_edges": refine_edges,
		"feather": feather,
		"morph_close_radius": morph_close_radius,
		"fill_surface_holes": fill_surface_holes,
		"max_hole_pixels": max_hole_pixels,
		"use_relighting": use_relighting,
		"use_texture_angle": use_texture_angle,
		"smooth_masks": smooth_masks,
		"input_size": input_size,
		"output_max_edge": output_max_edge,
	}


def run_one(
	image_path: Path,
	upload_id: str,
	cache_dir: Path,
	url_prefix: str,
	processor,
	model,
	device,
) -> dict:
	"""
	Run segmentation for one image. Used by both CLI and daemon.
	Returns result dict: uploadId, detections, segmentationMapUrl, segmentationLabels.
	"""
	from PIL import ImageFilter
	import torch
	import torch.nn.functional as F

	cache_dir.mkdir(parents=True, exist_ok=True)
	if not url_prefix:
		url_prefix = "/cache"
	if not url_prefix.startswith("/"):
		url_prefix = f"/{url_prefix}"
	url_prefix = url_prefix.rstrip("/")
	img = Image.open(image_path).convert("RGB")
	orig_w, orig_h = img.size
	cfg = _read_config(orig_w, orig_h)
	img_array = None

	def get_img_array():
		nonlocal img_array, img
		if img_array is None:
			img_array = np.array(img)
		return img_array

	if cfg["use_shadow_norm"]:
		img_array = normalize_shadows(
			get_img_array(),
			clip_limit=cfg["shadow_clip_limit"],
			tile_size=cfg["shadow_tile_size"],
			blur_radius=cfg["shadow_blur_radius"],
		)
		img = Image.fromarray(img_array)
	img_bgr = cv2.cvtColor(get_img_array(), cv2.COLOR_RGB2BGR) if cfg["refine_edges"] else None

	input_size = cfg["input_size"]
	if input_size is not None:
		inputs = processor(
			images=img,
			return_tensors="pt",
			size={"height": input_size, "width": input_size},
		)
	else:
		inputs = processor(images=img, return_tensors="pt")
	inputs = {k: v.to(device) for (k, v) in inputs.items()}
	use_amp = device.type == "cuda" and os.environ.get("USE_TORCH_AMP", "true").lower() == "true"
	with torch.inference_mode():
		if use_amp:
			with torch.autocast("cuda", dtype=torch.float16):
				outputs = model(**inputs)
		else:
			outputs = model(**inputs)
	logits = outputs.logits
	output_max_edge = cfg["output_max_edge"]
	if output_max_edge is not None and max(orig_w, orig_h) > output_max_edge:
		scale = output_max_edge / float(max(orig_w, orig_h))
		target_w = max(1, int(round(orig_w * scale)))
		target_h = max(1, int(round(orig_h * scale)))
	else:
		target_w, target_h = orig_w, orig_h
	logits = F.interpolate(
		logits,
		size=(target_h, target_w),
		mode="bilinear",
		align_corners=False,
	)
	seg = logits.argmax(dim=1)[0].cpu().numpy().astype(np.int32)
	if target_h != orig_h or target_w != orig_w:
		seg = cv2.resize(
			seg.astype(np.uint8),
			(orig_w, orig_h),
			interpolation=cv2.INTER_NEAREST,
		).astype(np.int32)
	occluder_mask = np.isin(seg, _OCCLUDER_IDS_ARRAY)
	occluder_dilate = cfg["occluder_dilate_radius"]
	if occluder_dilate > 0:
		kernel = cv2.getStructuringElement(
			cv2.MORPH_ELLIPSE, (2 * occluder_dilate + 1, 2 * occluder_dilate + 1)
		)
		occluder_mask = cv2.dilate(occluder_mask.astype(np.uint8), kernel).astype(bool)

	illumination_map_url = None
	if cfg["use_relighting"]:
		illum = compute_illumination_map(get_img_array())
		if illum is not None:
			illum_name = f"{upload_id}-illumination.png"
			Image.fromarray(illum, mode="L").save(cache_dir / illum_name)
			illumination_map_url = f"{url_prefix}/{illum_name}"

	items: list[tuple[str, np.ndarray, int, int, int, int]] = []
	for label, class_ids in _TARGET:
		mask = np.isin(seg, class_ids)
		if not mask.any():
			continue
		base = base_label(label)
		occluder_mask_label = occluder_mask & ~mask
		# Slightly stronger closing for counters/countertops to stabilize edges
		extra_close = 2 if base in {"Counter", "Countertop"} else 0
		mask = refine_surface_mask(
			mask,
			close_radius=cfg["morph_close_radius"] + extra_close,
			fill_holes=cfg["fill_surface_holes"] and base in _SURFACE_LABELS,
			max_hole_pixels=cfg["max_hole_pixels"]
			if (cfg["fill_surface_holes"] and base in _SURFACE_LABELS)
			else None,
		).astype(bool)
		if base in {"Wall", "Ceiling", "Floor", "Rug"}:
			if cfg["occluder_block_surfaces"]:
				mask = mask & ~occluder_mask_label
			mask = remove_small_components(mask, max(800, int(orig_w * orig_h * 0.003)))
			if cfg["smooth_masks"]:
				mask = smooth_mask_edges(mask, radius=3)
		elif base in {"Counter", "Countertop", "Backsplash"}:
			if cfg["occluder_block_surfaces"]:
				mask = mask & ~occluder_mask_label
			mask = remove_small_components(mask, max(700, int(orig_w * orig_h * 0.002)))
			if cfg["smooth_masks"]:
				mask = smooth_mask_edges(mask, radius=2)
		elif base in {"Cabinet", "Shelf"}:
			mask = remove_small_components(mask, max(700, int(orig_w * orig_h * 0.002)))
			if cfg["smooth_masks"]:
				mask = smooth_mask_edges(mask, radius=2)
		multi_label = base in {
			"Wall",
			"Ceiling",
			"Floor",
			"Rug",
			"Cabinet",
			"Shelf",
			"Counter",
			"Countertop",
			"Backsplash",
		}
		if multi_label:
			if base in {"Wall", "Ceiling", "Floor", "Rug"}:
				min_comp = max(1200, int(orig_w * orig_h * 0.004))
			elif base == "Shelf":
				min_comp = max(1200, int(orig_w * orig_h * 0.004))
			else:
				min_comp = max(400, int(orig_w * orig_h * 0.0015))
			components = split_components(mask, min_comp)
		else:
			components = [mask]
		for idx, comp in enumerate(components):
			if not comp.any():
				continue
			ys, xs = np.where(comp)
			min_x, max_x = int(xs.min()), int(xs.max())
			min_y, max_y = int(ys.min()), int(ys.max())
			name = label if len(components) == 1 else f"{label} {idx + 1}"
			items.append((name, comp, min_x, max_x, min_y, max_y))

	other_mask = np.zeros((orig_h, orig_w), dtype=bool)
	for i, (label, mask, *_) in enumerate(items):
		if base_label(label) in _SURFACE_LABELS:
			continue
		other_mask |= mask
	for i, (label, mask, *_) in enumerate(items):
		if base_label(label) in _SURFACE_LABELS:
			items[i] = (label, mask & ~other_mask, *items[i][2:])

	# 2b. Backsplash: wall area just above countertop
	def find_mask_by_label(name: str):
		for label, mask, *_ in items:
			if base_label(label) == name:
				return mask
		return None

	wall_mask = find_mask_by_label("Wall")
	counter_mask = find_mask_by_label("Countertop")
	if wall_mask is not None and counter_mask is not None and counter_mask.any():
		ys, xs = np.where(counter_mask)
		min_x, max_x = int(xs.min()), int(xs.max())
		min_y, max_y = int(ys.min()), int(ys.max())
		pad_x = int((max_x - min_x + 1) * 0.15)
		band_top = max(0, min_y - int(orig_h * 0.25))
		band_bottom = min(orig_h - 1, min_y + int((max_y - min_y + 1) * 0.2))
		x1 = max(0, min_x - pad_x)
		x2 = min(orig_w - 1, max_x + pad_x)
		band = np.zeros((orig_h, orig_w), dtype=bool)
		band[band_top : band_bottom + 1, x1 : x2 + 1] = True
		backsplash_mask = wall_mask & band
		backsplash_mask = backsplash_mask & ~occluder_mask
		if backsplash_mask.any():
			ys, xs = np.where(backsplash_mask)
			bx1, bx2 = int(xs.min()), int(xs.max())
			by1, by2 = int(ys.min()), int(ys.max())
			items.append(("Backsplash", backsplash_mask, bx1, bx2, by1, by2))

	def bbox_inside(ax1, ax2, ay1, ay2, bx1, bx2, by1, by2):
		return ax1 <= bx1 and ay1 <= by1 and bx2 <= ax2 and by2 <= ay2

	for i in range(len(items)):
		label_a, mask_a, ax1, ax2, ay1, ay2 = items[i]
		hole = np.zeros((orig_h, orig_w), dtype=bool)
		for j in range(len(items)):
			if i == j:
				continue
			_, mask_b, bx1, bx2, by1, by2 = items[j]
			if bbox_inside(ax1, ax2, ay1, ay2, bx1, bx2, by1, by2):
				hole |= mask_b
		new_mask = mask_a & ~hole
		if new_mask.any():
			ys, xs = np.where(new_mask)
			nx1, nx2 = int(xs.min()), int(xs.max())
			ny1, ny2 = int(ys.min()), int(ys.max())
			items[i] = (label_a, new_mask, nx1, nx2, ny1, ny2)
		else:
			items[i] = (label_a, new_mask, ax1, ax2, ay1, ay2)

	detections = []
	for label, mask, min_x, max_x, min_y, max_y in items:
		if not mask.any():
			continue
		if cfg["refine_edges"] and img_bgr is not None:
			try:
				mask = refine_mask_edges(img_bgr, mask, boundary_width=4)
				ys, xs = np.where(mask)
				if len(ys) > 0:
					min_x, max_x = int(xs.min()), int(xs.max())
					min_y, max_y = int(ys.min()), int(ys.max())
			except Exception:
				pass
		alpha = (mask.astype(np.uint8) * 255)
		if cfg["feather"] > 0:
			alpha_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=cfg["feather"]))
			alpha = np.array(alpha_img, dtype=np.uint8)
		mask_name = f"{upload_id}-{label}.png".replace(" ", "_")
		soft_mask_to_png(alpha, cache_dir / mask_name)
		cropped_url = None
		if cfg["generate_cropped"]:
			crop_name = f"{upload_id}-{label}-cropped.png".replace(" ", "_")
			apply_mask_crop_tight(img, alpha, min_x, min_y, max_x, max_y, cache_dir / crop_name)
			cropped_url = f"{url_prefix}/{crop_name}"
		texture_angle = 0.0
		if cfg["use_texture_angle"]:
			try:
				texture_angle = dominant_texture_angle(get_img_array(), mask)
			except Exception:
				pass
		detections.append({
			"label": label,
			"score": 1,
			"bbox": {
				"x": (min_x / orig_w) * 100.0,
				"y": (min_y / orig_h) * 100.0,
				"width": ((max_x - min_x + 1) / orig_w) * 100.0,
				"height": ((max_y - min_y + 1) / orig_h) * 100.0,
			},
			"maskUrl": f"{url_prefix}/{mask_name}",
			"croppedUrl": cropped_url,
			"textureAngle": texture_angle,
		})

	seg_map = np.zeros((orig_h, orig_w), dtype=np.uint8)
	detection_index = 0
	for label, mask, *_ in items:
		if not mask.any():
			continue
		detection_index += 1
		seg_map[mask] = detection_index
	seg_map_name = f"{upload_id}-segmentation.png"
	Image.fromarray(seg_map, mode="L").save(cache_dir / seg_map_name)
	segmentation_labels = [d["label"] for d in detections]
	return {
		"uploadId": upload_id,
		"detections": detections,
		"segmentationMapUrl": f"{url_prefix}/{seg_map_name}",
		"segmentationLabels": segmentation_labels,
		"illuminationMapUrl": illumination_map_url,
	}


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("--image", required=False)
	parser.add_argument("--upload-id", required=False)
	parser.add_argument("--cache-dir", required=False)
	parser.add_argument("--url-prefix", required=False)
	parser.add_argument("--daemon", action="store_true", help="Keep model loaded; read jobs from stdin (JSON lines), write results to stdout")
	args = parser.parse_args()

	if args.daemon:
		# Persistent worker: load model once, then process jobs from stdin
		processor, model, device = load_model()
		sys.stdout.write(json.dumps({"ready": True}) + "\n")
		sys.stdout.flush()
		while True:
			line = sys.stdin.readline()
			if not line:
				break
			line = line.strip()
			if not line:
				continue
			try:
				job = json.loads(line)
				image_path = Path(job["image"])
				upload_id = str(job["uploadId"])
				cache_dir = Path(job["cacheDir"])
				url_prefix = str(job.get("urlPrefix") or "/cache")
			except (KeyError, TypeError, ValueError) as e:
				sys.stdout.write(json.dumps({"error": str(e), "uploadId": None}) + "\n")
				sys.stdout.flush()
				continue
			if not image_path.is_file():
				sys.stdout.write(json.dumps({"error": "image not found", "uploadId": upload_id}) + "\n")
				sys.stdout.flush()
				continue
			try:
				out = run_one(
					image_path,
					upload_id,
					cache_dir,
					url_prefix,
					processor,
					model,
					device,
				)
				sys.stdout.write(json.dumps(out) + "\n")
				sys.stdout.flush()
			except Exception as e:
				sys.stdout.write(json.dumps({"error": str(e), "uploadId": upload_id, "detections": []}) + "\n")
				sys.stdout.flush()
		return

	# CLI: single job
	if not args.image or not args.upload_id or not args.cache_dir:
		parser.error("--image, --upload-id, and --cache-dir are required when not using --daemon")
	image_path = Path(args.image)
	cache_dir = Path(args.cache_dir)
	url_prefix = args.url_prefix or "/cache"
	processor, model, device = load_model()
	out = run_one(
		image_path,
		args.upload_id,
		cache_dir,
		url_prefix,
		processor,
		model,
		device,
	)
	sys.stdout.write(json.dumps(out))
	sys.stdout.flush()


if __name__ == "__main__":
	main()

