import torch
import torch.nn as nn
import torch.nn.functional as F


class DecomNet(nn.Module):
	"""
	Lightweight DecomNet from RetinexNet (BMVC'18).
	Outputs reflectance (R) and illumination (I).
	"""
	def __init__(self):
		super().__init__()
		self.conv1 = nn.Conv2d(4, 64, kernel_size=3, padding=1)
		self.conv2 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
		self.conv3 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
		self.conv4 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
		self.conv5 = nn.Conv2d(64, 4, kernel_size=3, padding=1)

	def forward(self, x):
		x = F.relu(self.conv1(x))
		x = F.relu(self.conv2(x))
		x = F.relu(self.conv3(x))
		x = F.relu(self.conv4(x))
		x = self.conv5(x)
		# R: first 3 channels, I: last channel
		R = torch.sigmoid(x[:, 0:3, :, :])
		I = torch.sigmoid(x[:, 3:4, :, :])
		return R, I


def load_decomnet(checkpoint_path: str | None):
	"""
	Load DecomNet weights from a checkpoint path.
	If path is None or missing, returns None.
	"""
	if not checkpoint_path:
		return None
	model = DecomNet()
	ckpt = torch.load(checkpoint_path, map_location="cpu")
	state_dict = ckpt.get("state_dict", ckpt)
	model.load_state_dict(state_dict, strict=False)
	model.eval()
	return model
