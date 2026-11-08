# Fits the sketch sheet cell by cell: for each lattice cell, tries all 65 ordered stacks of
# quarter discs and prints the best (a=TL b=TR c=BR d=BL, bottom layer first, .=empty)
# plus the error x100 for each cell. Needs pillow, numpy, scipy.
# Run from the project root: python3 tools/fit_sketch.py [image]
from PIL import Image
import numpy as np, itertools, sys
from scipy.ndimage import map_coordinates as mc
a=np.array(Image.open(sys.argv[1] if len(sys.argv)>1 else 'reference/sketches.jpeg').convert('L')).astype(float)
ink=np.clip((245-a)/(245-80),0,1)
N=48;S=85.35;n=9;rho=.5
g=(np.arange(N)+.5)/N;U,V=np.meshgrid(g,g)
C=[(0,0),(1,0),(1,1),(0,1)]
disc=[];band=[]
for c in C:
  d=np.hypot(U-c[0],V-c[1]);disc.append(d<=1-(1-rho)/(2*n));band.append(((d*n)%1>.25)&((d*n)%1<.75))
stacks=[()]+[p for k in range(1,5) for p in itertools.permutations(range(4),k)]
R={}
for s in stacks:
  m=np.zeros((N,N))
  for c in s: m=np.where(disc[c],band[c].astype(float),m)
  R[s]=m
def cell(x,y):
  yy=y+V*S;xx=x+U*S
  return mc(ink,[yy-.5,xx-.5],order=1)
def fit(name,x0,y0,cols,rows):
  print('==',name)
  # refine origin
  best=None
  for dx in range(-4,5):
   for dy in range(-4,5):
    e=0;o=[]
    for j in range(rows):
     for i in range(cols):
      c=cell(x0+dx+i*S,y0+dy+j*S);errs={s:((c-m)**2).mean() for s,m in R.items()}
      s=min(errs,key=lambda k:(round(errs[k],3),len(k)));e+=errs[s];o.append((s,errs[s]))
    if best is None or e<best[0]:best=(e,dx,dy,o)
  e,dx,dy,o=best;print('offset',dx,dy,'mean',e/len(o))
  for j in range(rows):
    print(' '.join('%-5s'%(''.join('abcd'[c] for c in o[j*cols+i][0]) or '.') for i in range(cols)),'  ',' '.join('%2d'%(100*o[j*cols+i][1]) for i in range(cols)))
fit('braid',27.6,61.6,8,2)
fit('wave',27.6,293,8,4)
fit('wave2',27.6,676,8,4)
fit('chain',897,119,8,4)
fit('cloud',89.3,1123.6,6,4)
fit('part',1192,772,5,4)
fit('chain2',89,1591,8,4)
