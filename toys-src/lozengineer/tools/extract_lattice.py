#!/usr/bin/env python3
"""How the reference pattern was decoded (needs pillow, numpy).

Samples the reference image (local/lozengineer/reference.jpeg, not committed) on its triangular lattice, prints the stripe-direction map
for one 20x15 repeat, then derives the 4x3 coarse lozenge cell (BRICK in index.html)
and checks that it is a valid dimer cover.
"""
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image

a = np.array(Image.open(Path(__file__).resolve().parents[3] / 'local/lozengineer/reference.jpeg').convert('L'), float)
H, W = a.shape
s, p = 776 / 15, 896 / 20          # lattice edge length; spacing between parallel lattice lines
C, R = 20, 15                      # repeat in fine lattice columns and rows
ox, oy = 765.0, 374.0              # a Y-junction; value matches the app's default pan


def pos(c, r):
    return ox + c * p, oy + (r + (0.5 if c % 2 else 0)) * s


def nb(c, r):
    o = c % 2
    return {'N': (c, r - 1), 'S': (c, r + 1), 'NE': (c + 1, r - 1 + o), 'SE': (c + 1, r + o),
            'SW': (c - 1, r + o), 'NW': (c - 1, r - 1 + o)}


G = {}
for c in range(C):
    for r in range(R):
        cc, rr = c - 8, r - 3
        x, y = pos(cc, rr)
        G[c, r] = [d for d, (c2, r2) in nb(cc, rr).items()
                   if a[int((y + pos(c2, r2)[1]) / 2) - 1:int((y + pos(c2, r2)[1]) / 2) + 2,
                        int((x + pos(c2, r2)[0]) / 2) - 1:int((x + pos(c2, r2)[0]) / 2) + 2].mean() < 128]
print('vertex degrees', Counter(len(v) for v in G.values()))


def glyph(v):
    t = set(v)
    if len(v) == 1: return 'o'
    if len(v) == 3: return 'Y'
    return {frozenset(('N', 'S')): '|', frozenset(('NE', 'SW')): '/', frozenset(('SE', 'NW')): '\\'}.get(frozenset(t), '*')


for r in range(R):
    print(' '.join(glyph(G[c, r]) for c in range(C)))


def stripe_type(q, rho):
    rr = rho + (q - (q & 1)) // 2
    return {frozenset(('N', 'S')): 2, frozenset(('NE', 'SW')): 0, frozenset(('SE', 'NW')): 1}.get(
        frozenset(G[(q + 8) % 20, (rr + 3) % 15]))


A, B, D = 4, -2, 3                 # coarse repeat in Hermite normal form: (A,B), (0,D)
cells = {(i, j): stripe_type(5 * i + 2, 5 * j + 2) for i in range(A) for j in range(D)}


def canon(i, j):
    k = i // A
    return i - k * A, (j - k * B) % D


bad = sum(1 for i in range(A) for j in range(D)
          if (cells[canon(i, j)] == 0) + (cells[canon(i, j + 1)] == 1) + (cells[canon(i + 1, j)] == 2) != 1)
print('BRICK', [cells[i, j] for j in range(D) for i in range(A)], 'invalid dimers', bad)
