const fs=require('fs'),zlib=require('zlib');
const meta=JSON.parse(fs.readFileSync('../data/data.json'));const raw=zlib.gunzipSync(Buffer.from(fs.readFileSync('../data/data.b64','utf8'),'base64'));
const ab=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length);let o=0;const T=[Uint16Array,Uint16Array,Uint32Array,Uint32Array,Uint16Array,Uint16Array,Uint16Array,Uint32Array,Int16Array,Float32Array,Float32Array,Uint8Array];
const A=meta.sizes.map((s,i)=>{const a=new T[i](ab.slice(o,o+s));o+=s;return a});const [nx,ny,eu,ev,el,es]=A;const N=meta.n,M=meta.m,ec=A[11];
const adj=Array.from({length:N},()=>[]);for(let i=0;i<M;i++){adj[eu[i]].push([ev[i],es[i]]);adj[ev[i]].push([eu[i],es[i]])}
function dij(s){const d=new Float64Array(N).fill(1e12);d[s]=0;const h=[[0,s]];const up=()=>{};
 const pq=[];const push=(k,v)=>{pq.push([k,v]);let i=pq.length-1;while(i){const p=i-1>>1;if(pq[p][0]<=pq[i][0])break;[pq[p],pq[i]]=[pq[i],pq[p]];i=p}};
 const pop=()=>{const t=pq[0],l=pq.pop();if(pq.length){pq[0]=l;let i=0;for(;;){let a=2*i+1,b=a+1,m=i;if(a<pq.length&&pq[a][0]<pq[m][0])m=a;if(b<pq.length&&pq[b][0]<pq[m][0])m=b;if(m==i)break;[pq[m],pq[i]]=[pq[i],pq[m]];i=m}}return t};
 push(0,s);while(pq.length){const [k,u]=pop();if(k>d[u])continue;for(const [v,w] of adj[u]){if(k+w<d[v]){d[v]=k+w;push(d[v],v)}}}return d}
const near=(name)=>{const t=meta.towns.find(t=>t[0]==name);if(!t)throw name;let b=0,bd=1e18;for(let i=0;i<N;i++){const x=nx[i]-t[1],y=ny[i]-t[2],q=x*x+y*y;if(q<bd){bd=q;b=i}}return b};
const f=s=>{const m=Math.round(s/60);return (m/60|0)+'h'+String(m%60).padStart(2,'0')};
const P=[['London','Edinburgh','7:45'],['Oxford','Manchester','2:50'],['London','Cardiff','2:50'],['Bristol','Birmingham','1:35'],['Glasgow','Inverness','3:15'],['Exeter','Penzance','2:00'],['Leeds','Newcastle upon Tyne','1:50'],['London','Norwich','2:40'],['Aberystwyth','Cardiff','2:50'],['Penzance','Wick','13:30'],['Oxford','London','1:30'],['Birmingham','Liverpool','1:50'],['Carlisle','Glasgow','1:35'],['Southampton','Newcastle upon Tyne','5:30']];
for(const [a,b,r] of P){const t=Date.now();const d=dij(near(a));console.log(a,b,f(d[near(b)]),'real',r,Date.now()-t,'ms')}
const cc={};for(let i=0;i<M;i++){cc[ec[i]]=(cc[ec[i]]||0)+el[i]/100}console.log(cc);
