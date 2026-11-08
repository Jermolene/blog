import json,glob,gzip,base64,math,collections,sys,struct
import numpy as np, shapefile, shapely, geonamescache
from shapely.geometry import shape,Point,LineString
from shapely.ops import unary_union,transform
from pyproj import Transformer
from scipy.spatial import cKDTree
import os
S=os.environ.get('SRC','src')+'/'
tf=Transformer.from_crs(4326,27700,always_xy=True)
SPEED={0:100,1:85,2:70,3:55,4:50,5:25,6:50}
links={}
for f in glob.glob(S+'tm-impact-data/docs/t/*.json'):
    for l in json.load(open(f))['links']:
        links[l[0]]=l
print('A/M links',len(links))
L=[] # (cls,road,pts ndarray,isM)
for l in links.values():
    _,road,name,form,c,fn,trunk,prim,ln,xy=l
    if form=='L':k=4
    elif form=='R':k=5
    elif c=='M':k=0
    elif form in('D','C'):k=1
    elif prim:k=2
    else:k=3
    L.append((k,road or '',np.array(xy,float).reshape(-1,2)))
s=shapefile.Reader(S+'os-openroads-geodata/b_road_trimmed')
for sr in s.shapeRecords():
    p=np.array(sr.shape.points);x,y=tf.transform(p[:,0],p[:,1]);q=np.c_[x,y]
    pa=list(sr.shape.parts)+[len(q)]
    for a,b in zip(pa,pa[1:]):
        if b-a>=2:L.append((6,sr.record[0] or '',q[a:b]))
print('links',len(L),'km',sum(np.hypot(*np.diff(l[2],axis=0).T).sum() for l in L)/1000)
# endpoints
n=len(L);E=np.zeros((2*n,2));isM=np.zeros(2*n,bool)
for i,(k,r,p) in enumerate(L):
    E[2*i]=p[0];E[2*i+1]=p[-1];isM[2*i]=isM[2*i+1]=k==0
par=np.arange(2*n)
def find(a):
    while par[a]!=a:par[a]=par[par[a]];a=par[a]
    return a
t=cKDTree(E)
for a,b in t.query_pairs(7.0,output_type='ndarray'):
    d=np.hypot(*(E[a]-E[b]))
    if (isM[a] or isM[b]) and d>1.5 :continue
    par[find(a)]=find(b)
root=np.array([find(i) for i in range(2*n)])
uq,nid=np.unique(root,return_inverse=True)
NN=len(uq);nx=np.zeros(NN);ny=np.zeros(NN);nx[nid]=E[:,0];ny[nid]=E[:,1]
print('nodes',NN)
# edges: u,v,cls,road,pts,sec
def sec(k,m,f=1):return m/(SPEED[k]*f/3.6)
ED=[[int(nid[2*i]),int(nid[2*i+1]),k,r,p] for i,(k,r,p) in enumerate(L) if nid[2*i]!=nid[2*i+1] or len(p)>3]
# land
d=json.load(open(S+'ne/sub.geojson'))
polys={}
for f in d['features']:
    if f['properties'].get('SUBUNIT') in('England','Scotland','Wales'):
        polys[f['properties']['SUBUNIT']]=transform(lambda x,y,z=None:tf.transform(x,y),shape(f['geometry']))
land=unary_union(list(polys.values())).buffer(0);shapely.prepare(land)
coast=land.simplify(120)
# towns
g=geonamescache.GeonamesCache(min_city_population=1000)
C=[v for v in g.get_cities().values() if v['countrycode']=='GB' and v['admin1code'] in('ENG','SCT','WLS')]
C.sort(key=lambda v:-v['population'])
T=[]
for v in C:
    x,y=tf.transform(v['longitude'],v['latitude'])
    if v['name'] in('Saint Peters','Archway','Ilford','Barking'):continue
    if not land.buffer(0).contains(Point(x,y)) and land.distance(Point(x,y))>5000:continue
    r=math.sqrt(v['population']/(math.pi*3200))*1000
    sub=any(math.hypot(x-t['x'],y-t['y'])<t['r'] and t['pop']>v['population'] for t in T if t['pop']>100000)
    T.append(dict(name=v['name'],x=x,y=y,pop=v['population'],r=r,cc=v['admin1code'][0],sub=sub))
print('towns',len(T),'non-sub',sum(not t['sub'] for t in T))
print([t['name'] for t in T if not t['sub']][:70])
# 1km land grid + people
X,Y=np.meshgrid(np.arange(500,660000,1000),np.arange(500,1225000,1000))
mask=shapely.contains_xy(land,X.ravel(),Y.ravel()).reshape(X.shape)
print('land km2',mask.sum())
pop=np.zeros(X.shape)
for t in T:
    if t['sub']:continue
    r=max(t['r'],700);ix=int(t['x']//1000);iy=int(t['y']//1000);R=int(r//1000)+2
    y0,y1=max(iy-R,0),min(iy+R+1,X.shape[0]);x0,x1=max(ix-R,0),min(ix+R+1,X.shape[1])
    dd=np.hypot(X[y0:y1,x0:x1]-t['x'],Y[y0:y1,x0:x1]-t['y']);w=(dd<=r)*mask[y0:y1,x0:x1]*1.0
    if w.sum()==0:w=(dd==dd.min())*1.0
    pop[y0:y1,x0:x1]+=t['pop']*w/w.sum()
TOTAL=65.3e6
print('town pop',pop.sum())
if pop.sum()<TOTAL: pop+= mask*(TOTAL-pop.sum())/mask.sum()
else: pop*=TOTAL/pop.sum()
# urban factors
def dens(x,y):
    ix=np.clip((x//1000).astype(int),0,X.shape[1]-1);iy=np.clip((y//1000).astype(int),0,X.shape[0]-1);return pop[iy,ix]
for e in ED:
    p=e[4];e.append(float(np.hypot(*np.diff(p,axis=0).T).sum()))
    if e[2]==0: f=1
    else:
        m=(p[0]+p[-1])/2;de=dens(np.array([m[0]]),np.array([m[1]]))[0]
        f=0.55 if de>2500 else 0.72 if de>1000 else 1
    e.append(sec(e[2],e[5],f))
# ferries (lat,lon,lat,lon,minutes inc. boarding,name)
FER=[(50.793,-1.095,50.731,-1.167,75,'Portsmouth–Fishbourne'),(50.895,-1.40,50.76,-1.29,90,'Southampton–East Cowes'),(50.757,-1.538,50.705,-1.50,70,'Lymington–Yarmouth'),
(57.006,-5.828,57.066,-5.89,60,'Mallaig–Armadale'),(57.585,-6.37,57.897,-6.80,130,'Uig–Tarbert'),(57.585,-6.37,57.597,-7.16,135,'Uig–Lochmaddy'),(57.895,-5.16,58.208,-6.386,195,'Ullapool–Stornoway'),
(56.415,-5.48,56.47,-5.707,76,'Oban–Craignure'),(56.415,-5.48,56.954,-7.487,335,'Oban–Castlebay'),(57.006,-5.828,57.15,-7.30,255,'Mallaig–Lochboisdale'),(56.415,-5.48,56.50,-6.80,245,'Oban–Tiree'),
(55.81,-5.48,55.63,-6.19,165,'Kennacraig–Port Ellen'),(55.64,-4.82,55.576,-5.14,85,'Ardrossan–Brodick'),(55.875,-4.89,55.837,-5.055,55,'Wemyss Bay–Rothesay'),(55.96,-4.82,55.95,-4.92,45,'Gourock–Dunoon'),
(56.72,-5.24,56.725,-5.225,20,'Corran'),(55.70,-5.30,55.75,-5.39,50,'Lochranza–Claonaig'),
(58.61,-3.55,58.96,-3.30,135,'Scrabster–Stromness'),(57.145,-2.08,58.985,-2.96,420,'Aberdeen–Kirkwall'),(57.145,-2.08,60.155,-1.145,780,'Aberdeen–Lerwick')]
def comps():
    p=list(range(NN))
    def fd(a):
        while p[a]!=a:p[a]=p[p[a]];a=p[a]
        return a
    for e in ED:p[fd(e[0])]=fd(e[1])
    return np.array([fd(i) for i in range(NN)])
isMnode=np.ones(NN,bool)
for e in ED:
    if e[2]!=0:isMnode[e[0]]=isMnode[e[1]]=False
nonM=np.where(~isMnode)[0];kN=cKDTree(np.c_[nx[nonM],ny[nonM]])
# connectors: join small comps to the rest across land
c=comps();cnt=collections.Counter(c.tolist());main=cnt.most_common(1)[0][0];print('comps',len(cnt),'main',cnt[main],'/',NN)
added=0
for round_ in range(6):
    c=comps();cnt=collections.Counter(c.tolist());main=cnt.most_common(1)[0][0]
    mi=np.where((c==main)&~isMnode)[0];tm=cKDTree(np.c_[nx[mi],ny[mi]]);done=set()
    groups=collections.defaultdict(list)
    for i in nonM:
        if c[i]!=main:groups[c[i]].append(i)
    for cid,ids in groups.items():
        ids=np.array(ids);dd,ii=tm.query(np.c_[nx[ids],ny[ids]]);j=int(np.argmin(dd))
        if dd[j]>4000:continue
        a=int(ids[j]);b=int(mi[ii[j]])
        ls=LineString([(nx[a],ny[a]),(nx[b],ny[b])])
        if dd[j]>150 and not land.buffer(30).contains(ls):continue
        ED.append([a,b,8,'',np.array([[nx[a],ny[a]],[nx[b],ny[b]]]),float(dd[j]),float(dd[j]*1.3/(30/3.6))]);added+=1
print('connectors',added)
# ferries
fn=[]
for a,b,c2,d2,mi,nm in FER:
    pts=[]
    for la,lo in((a,b),(c2,d2)):
        x,y=tf.transform(lo,la);dist,i=kN.query([x,y]);pts.append(int(nonM[i]));
    u,v=pts;dd=math.hypot(nx[u]-nx[v],ny[u]-ny[v])
    ED.append([u,v,7,nm,np.array([[nx[u],ny[u]],[nx[v],ny[v]]]),dd,mi*60.0]);fn.append(nm)
    print(' ferry',nm,round(dist),end=';')
print()
# islands reached by ferries may need connectors too: run again ferry-aware
c=comps();cnt=collections.Counter(c.tolist());main=cnt.most_common(1)[0][0]
print('after: comps',len(cnt),'main',cnt[main],'/',NN)
keep=c==main
lost=collections.Counter()
for e in ED:
    if not keep[e[0]]:lost[(int(nx[e[0]]//100000),int(ny[e[0]]//100000))]+=e[5]/1000
print('dropped km by 100km square',{k:round(v) for k,v in lost.items() if v>5})
ED=[e for e in ED if keep[e[0]] and keep[e[1]]]
# contraction of degree-2 chains (same class & road)
adj=collections.defaultdict(list)
for i,e in enumerate(ED):adj[e[0]].append(i);adj[e[1]].append(i)
used=[False]*len(ED);out=[]
def mergeable(n):
    if len(adj[n])!=2:return False
    a,b=adj[n]
    return a!=b and ED[a][2]==ED[b][2] and ED[a][3]==ED[b][3] and ED[a][2]<7
for i,e in enumerate(ED):
    if used[i]:continue
    used[i]=True
    u,v=e[0],e[1];segs=[e[4]];ln=e[5];se=e[6]
    for end in(1,0):
        n=v if end else u
        while mergeable(n):
            a,b=adj[n];nx_=b if a in() else None
            j=a if not used[a] else b
            if used[j]:break
            used[j]=True;f=ED[j];pts=f[4];other=f[1] if f[0]==n else f[0]
            if f[0]!=n:pts=pts[::-1]
            ln+=f[5];se+=f[6]
            if end:segs.append(pts);v=other
            else:segs.insert(0,pts[::-1]);u=other
            n=other
            if n==(u if end else v):break
    pts=np.vstack(segs)
    out.append([u,v,e[2],e[3],pts,ln,se])
print('contracted edges',len(out))
used_nodes=sorted({e[0] for e in out}|{e[1] for e in out});remap={o:i for i,o in enumerate(used_nodes)}
X_=nx[used_nodes];Y_=ny[used_nodes];N=len(used_nodes);print('final nodes',N)
# weights
ee=[(remap[e[0]],remap[e[1]],e[2]) for e in out]
nm=np.ones(N,bool)
for a,b,k in ee:
    if k not in(0,4,7):nm[a]=nm[b]=False
idx=np.where(~nm)[0];tree=cKDTree(np.c_[X_[idx],Y_[idx]])
yy,xx=np.where(mask|(pop>0));dd,ii=tree.query(np.c_[X[yy,xx],Y[yy,xx]])
ok=dd<12000;print('land cells',len(yy),'kept',ok.sum())
landW=np.zeros(N,float);peopleW=np.zeros(N,float)
np.add.at(landW,idx[ii[ok]],1.0);np.add.at(peopleW,idx[ii[ok]],pop[yy[ok],xx[ok]])
# pack
U=20
def rdp(p,t):
    if len(p)<3:return p
    ls=shapely.simplify(LineString(p),t);return np.array(ls.coords)
roads={};rd=lambda r:roads.setdefault(r,len(roads))
rd('')
eu=[];ev=[];el=[];es=[];ec=[];er=[];go=[0];gm=[]
tot=0
for e in out:
    a,b=remap[e[0]],remap[e[1]]
    p=rdp(e[4],25) if e[2]<7 else e[4]
    # orient geometry u->v
    if np.hypot(*(p[0]-[X_[a],Y_[a]]))>np.hypot(*(p[-1]-[X_[a],Y_[a]])):p=p[::-1]
    q=np.round(p/U).astype(int);q=q[1:-1] if len(q)>2 else q[:0]
    prev=np.array([round(X_[a]/U),round(Y_[a]/U)])
    for pt in q:
        dx,dy=int(pt[0]-prev[0]),int(pt[1]-prev[1])
        if dx==0 and dy==0:continue
        gm+= [dx,dy];prev=pt;tot+=1
    go.append(tot);eu.append(a);ev.append(b);el.append(min(65535,round(e[5]/10)));es.append(min(65535,max(1,round(e[6]))));ec.append(e[2]);er.append(rd(e[3]))
print('edges',len(eu),'geom pts',tot)
blobs=[np.round(X_/U).astype('<u2'),np.round(Y_/U).astype('<u2'),np.array(eu,'<u4'),np.array(ev,'<u4'),np.array(el,'<u2'),np.array(es,'<u2'),np.array(er,'<u2'),np.array(go,'<u4'),np.array(gm,'<i2'),np.array(landW,'<f4'),np.array(peopleW,'<f4'),np.array(ec,'u1')]
sizes=[b.nbytes for b in blobs];raw=b''.join(b.tobytes() for b in blobs)
gz=gzip.compress(raw,9);print('raw',len(raw),'gz',len(gz))
def polyout(g):
    r=[]
    gs=list(g.geoms) if hasattr(g,'geoms') else [g]
    for a in gs:
        if a.area<2e6:continue
        for ring in[a.exterior]:
            r.append([round(v/U) for c in ring.coords for v in c[:2]])
    return r
towns=[[t['name'],round(t['x']/U),round(t['y']/U),t['pop'],t['cc'],1 if t['sub'] else 0] for t in T if t['pop']>=3000]
meta=dict(n=N,m=len(eu),sizes=sizes,roads=list(roads),towns=towns,coast=polyout(coast),landKm=float(landW.sum()),people=float(peopleW.sum()))
open('data/data.json','w').write(json.dumps(meta,separators=(',',':'),ensure_ascii=False))
open('data/data.b64','w').write(base64.b64encode(gz).decode())
print('meta',len(json.dumps(meta)),'towns',len(towns),'land',landW.sum(),'people',peopleW.sum())
