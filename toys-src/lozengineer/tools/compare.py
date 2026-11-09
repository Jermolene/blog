#!/usr/bin/env python3
"""Pixel-diff out/default.png against reference/reference.jpeg (needs pillow, numpy)."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image
root = Path(__file__).resolve().parent.parent
a = np.array(Image.open(root / 'reference/reference.jpeg').convert('L'), float)
b = np.array(Image.open(root / 'out/default.png').convert('L'), float)
if a.shape != b.shape:
    sys.exit(f'size mismatch {a.shape} vs {b.shape}')
mismatch = ((a < 128) != (b < 128)).mean()
print(f'threshold mismatch {mismatch:.4%}; black reference {(a<128).mean():.4f}, render {(b<128).mean():.4f}')
sys.exit(1 if mismatch > 0.02 else 0)
