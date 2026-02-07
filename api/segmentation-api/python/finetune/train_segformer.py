import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor


class AdeDataset(Dataset):
	def __init__(self, images_dir: Path, labels_dir: Path, processor):
		self.images = sorted(images_dir.glob('*'))
		self.labels = sorted(labels_dir.glob('*'))
		self.processor = processor
		if len(self.images) != len(self.labels):
			raise ValueError('Images and labels count mismatch')

	def __len__(self):
		return len(self.images)

	def __getitem__(self, idx):
		img_path = self.images[idx]
		lbl_path = self.labels[idx]
		image = Image.open(img_path).convert('RGB')
		label = Image.open(lbl_path)
		# ADE20K labels are stored as raw class IDs (0..149)
		label_tensor = torch.from_numpy(
			np.array(label, dtype=np.int64)
		)
		encoded = self.processor(images=image, return_tensors='pt')
		encoded = {k: v.squeeze(0) for k, v in encoded.items()}
		encoded['labels'] = label_tensor
		return encoded


def parse_args():
	parser = argparse.ArgumentParser()
	parser.add_argument('--data-dir', required=True)
	parser.add_argument('--model-id', required=True)
	parser.add_argument('--output-dir', required=True)
	parser.add_argument('--epochs', type=int, default=3)
	parser.add_argument('--batch-size', type=int, default=2)
	parser.add_argument('--lr', type=float, default=5e-5)
	parser.add_argument('--num-workers', type=int, default=2)
	return parser.parse_args()


def main():
	args = parse_args()
	data_dir = Path(args.data_dir)
	train_images = data_dir / 'images' / 'train'
	train_labels = data_dir / 'annotations' / 'train'
	val_images = data_dir / 'images' / 'val'
	val_labels = data_dir / 'annotations' / 'val'

	processor = SegformerImageProcessor.from_pretrained(args.model_id)
	model = SegformerForSemanticSegmentation.from_pretrained(args.model_id)
	model.train()

	train_ds = AdeDataset(train_images, train_labels, processor)
	train_loader = DataLoader(
		train_ds,
		batch_size=args.batch_size,
		shuffle=True,
		num_workers=args.num_workers,
	)

	device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
	model.to(device)

	optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

	for epoch in range(args.epochs):
		total_loss = 0.0
		for batch in train_loader:
			labels = batch.pop('labels').to(device)
			batch = {k: v.to(device) for k, v in batch.items()}
			out = model(**batch, labels=labels)
			loss = out.loss
			optimizer.zero_grad()
			loss.backward()
			optimizer.step()
			total_loss += loss.item()
		avg = total_loss / max(len(train_loader), 1)
		print(f'Epoch {epoch + 1}: loss={avg:.4f}')

	output_dir = Path(args.output_dir)
	output_dir.mkdir(parents=True, exist_ok=True)
	model.save_pretrained(output_dir)
	processor.save_pretrained(output_dir)


if __name__ == '__main__':
	main()
