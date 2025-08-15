// Minimal voxel engine with long horizon fog and color jitter per block
// No external deps; WebGL1 for broad compatibility

const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl', { antialias: false });
if (!gl) alert('WebGL not supported');
// Minimap canvas and state
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
let minimapVisible = true;
const minimapWrap = document.getElementById('minimapWrap');
if (minimapWrap) minimapWrap.style.display = minimapVisible ? 'flex' : 'none';

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr);
  const h = Math.floor(innerHeight * dpr);
  canvas.width = w; canvas.height = h;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  gl.viewport(0, 0, w, h);
}
window.addEventListener('resize', resize); resize();

// Persist simple settings (fog, selected block, walk/fly)
const SETTINGS_KEY = 'voxelcraft_settings_v1';
let worldSeedStr = 'default';
let worldSeed = 1337 >>> 0;
function hashString32(str){
  let h = 2166136261 >>> 0; // FNV-1a style
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
try{
  const raw = localStorage.getItem(SETTINGS_KEY);
  if(raw){
    const s=JSON.parse(raw);
    if(typeof s.fog==='number') fogDistance=s.fog;
    if(typeof s.sel==='number') selectedBlock=s.sel;
    if(typeof s.walk==='boolean') cam.walk=s.walk;
    if(typeof s.seedStr==='string'){ worldSeedStr=s.seedStr; worldSeed=hashString32(worldSeedStr); }
  }
}catch{}
if (minimapCanvas) { minimapCanvas.width = 160; minimapCanvas.height = 160; }
function setWorldSeed(str){
  worldSeedStr = String(str||'default');
  worldSeed = hashString32(worldSeedStr);
  saveSettings();
  resetWorldForSeed();
}
// Simple RNG for per-block color jitter (deterministic by block position and seed)
function hash3i(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ Math.imul(z, 2147483647) ^ worldSeed;
  h = Math.imul((h ^ (h >>> 13)), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Matrices
// Column-major 4x4 matrix helpers compatible with WebGL (transpose=false)
function mat4_identity(){ const m=new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; }
function mat4_perspective(fovy, aspect, near, far){
  const f = 1/Math.tan(fovy/2);
  const nf = 1/(near - far);
  const out = new Float32Array(16);
  out[0] = f/aspect; out[1]=0; out[2]=0; out[3]=0;
  out[4] = 0; out[5]=f; out[6]=0; out[7]=0;
  out[8] = 0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
  out[12]=0; out[13]=0; out[14]=2*far*near*nf; out[15]=0;
  return out;
}
function mat4_lookAt(eye, center, up){
  // Build a view matrix in column-major order for WebGL
  let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
  let zl = Math.hypot(zx,zy,zz) || 1; zx/=zl; zy/=zl; zz/=zl; // camera backward (+Z in view)
  // x = normalize(cross(up, z))
  let xx = up[1]*zz - up[2]*zy;
  let xy = up[2]*zx - up[0]*zz;
  let xz = up[0]*zy - up[1]*zx;
  let xl = Math.hypot(xx,xy,xz) || 1; xx/=xl; xy/=xl; xz/=xl;
  // y = cross(z, x)
  const yx = zy*xz - zz*xy;
  const yy = zz*xx - zx*xz;
  const yz = zx*xy - zy*xx;
  const out = mat4_identity();
  // Columns = [x, y, z, t]
  out[0]=xx; out[1]=yx; out[2]=zx; out[3]=0;
  out[4]=xy; out[5]=yy; out[6]=zy; out[7]=0;
  out[8]=xz; out[9]=yz; out[10]=zz; out[11]=0;
  out[12] = -(xx*eye[0] + xy*eye[1] + xz*eye[2]);
  out[13] = -(yx*eye[0] + yy*eye[1] + yz*eye[2]);
  out[14] = -(zx*eye[0] + zy*eye[1] + zz*eye[2]);
  out[15] = 1;
  return out;
}

// Camera and controls
const cam = { pos:[0, 22, 0], rot:[-0.2, 0.6], vel:[0,0,0], walk:false, onGround:false };
let key = {}; window.addEventListener('keydown', e=> key[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e=> key[e.key.toLowerCase()] = false);
const lockBtn = document.getElementById('lock');
if (lockBtn){
  lockBtn.addEventListener('click', ()=> canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', ()=>{
    if (!lockBtn) return;
    if (document.pointerLockElement===canvas) lockBtn.textContent='Pointer Locked';
    else lockBtn.textContent='Click to Lock Pointer';
  });
} else {
  // Minimal UI: click canvas to lock pointer if no lock button exists
  canvas.addEventListener('click', ()=>{ if (document.pointerLockElement!==canvas) canvas.requestPointerLock(); });
}
document.addEventListener('mousemove', e=>{ if (document.pointerLockElement===canvas){ cam.rot[1] -= e.movementX*0.0025; cam.rot[0] -= e.movementY*0.0025; cam.rot[0]=Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, cam.rot[0])); }});
canvas.addEventListener('contextmenu', e => e.preventDefault());
// Toggle walk/fly mode with G, fog +/- and number keys 1..8 to select blocks
window.addEventListener('keydown', (e)=>{
  const k = e.key;
  if (k.toLowerCase()==='h') { minimapVisible = !minimapVisible; if (minimapWrap) minimapWrap.style.display = minimapVisible?'flex':'none'; }
  if (k.toLowerCase()==='g') { cam.walk = !cam.walk; saveSettings(); }
  if (k === '+') { fogDistance = Math.min(2000, fogDistance + 50); saveSettings(); }
  if (k === '-') { fogDistance = Math.max(100, fogDistance - 50); saveSettings(); }
  if (k === '1') { selectedBlock = GRASS; updateHotbar(selectedBlock); }
  if (k === '2') { selectedBlock = DIRT; updateHotbar(selectedBlock); }
  if (k === '3') { selectedBlock = STONE; updateHotbar(selectedBlock); }
  if (k === '4') { selectedBlock = SAND; updateHotbar(selectedBlock); }
  if (k === '5') { selectedBlock = WATER; updateHotbar(selectedBlock); }
  if (k === '6') { selectedBlock = WOOD; updateHotbar(selectedBlock); }
  if (k === '7') { selectedBlock = LEAVES; updateHotbar(selectedBlock); }
  if (k === '8') { selectedBlock = SNOW; updateHotbar(selectedBlock); }
  if (k.toLowerCase() === 'p') { selectedBlock = PORTAL; updateHotbar(selectedBlock); }
  // Bio-sim controls
  if (k.toLowerCase()==='b') { bio.toggle(); }
  if (k.toLowerCase()==='m') { bio.running = !bio.running; nca.running = !nca.running; }
  if (k.toLowerCase()==='n') { bio.stepOnce(); nca.stepOnce(); }
  if (k.toLowerCase()==='r') { bio.seedRandom(); nca.seedSeed(); }
  if (k.toLowerCase()==='v') { nca.toggle(); }
});

// Persist simple settings (fog, selected block, walk/fly)
// duplicate constant removed above; keep single definition only
try{
  const raw = localStorage.getItem(SETTINGS_KEY);
  if(raw){
    const s=JSON.parse(raw);
    if(typeof s.fog==='number') fogDistance=s.fog;
    if(typeof s.sel==='number') selectedBlock=s.sel;
    if(typeof s.walk==='boolean') cam.walk=s.walk;
    if(typeof s.seedStr==='string'){ worldSeedStr=s.seedStr; worldSeed=hashString32(worldSeedStr); }
  }
}catch{}

// Mouse wheel cycles through hotbar items
window.addEventListener('wheel', (e)=>{
  const ids = [GRASS, DIRT, STONE, SAND, WATER, WOOD, LEAVES, SNOW];
  const dir = e.deltaY>0 ? 1 : -1;
  const idx = Math.max(0, ids.indexOf(selectedBlock));
  const next = (idx + dir + ids.length) % ids.length;
  selectedBlock = ids[next];
  updateHotbar(selectedBlock);
  saveSettings();
});

// Additional number keys for slots 5..8
window.addEventListener('keydown', (e)=>{
  const k = e.key;
  if (k === '5') { selectedBlock = WATER; updateHotbar(selectedBlock); }
  if (k === '6') { selectedBlock = WOOD; updateHotbar(selectedBlock); }
  if (k === '7') { selectedBlock = LEAVES; updateHotbar(selectedBlock); }
  if (k === '8') { selectedBlock = SNOW; updateHotbar(selectedBlock); }
});

function saveSettings(){
  if (saveSettings._t) cancelAnimationFrame(saveSettings._t);
  saveSettings._t = requestAnimationFrame(()=>{
    try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fog:fogDistance, sel:selectedBlock, walk:cam.walk, seedStr:worldSeedStr })); }catch{}
  });
}

// World/chunks
const CHUNK = 32; // larger chunk to reduce overhead
const WORLD_HEIGHT = 64;
const WATER_LEVEL = 20; // global water plane height
const viewDistance = { chunks: 8 }; // long horizon; tune if needed
let fogDistance = 600; // can be tweaked with +/-
let selectedBlock = 3; // default STONE
let currentSky = [0.53, 0.69, 1.0];

// Simple UI toggles for view distance and FOV
let fovDeg = 60;
window.addEventListener('keydown', (e)=>{
  if (e.key === ',') { viewDistance.chunks = Math.max(2, viewDistance.chunks-1); }
  if (e.key === '.') { viewDistance.chunks = Math.min(16, viewDistance.chunks+1); }
  if (e.key === '/') { fovDeg = Math.min(100, fovDeg+2); }
  if (e.key === '?') { fovDeg = Math.max(40, fovDeg-2); }
});

// Simple value-noise
function noise2(x, z){
  const x0=Math.floor(x), z0=Math.floor(z);
  const x1=x0+1, z1=z0+1;
  const sx=x-x0, sz=z-z0;
  const n00=hash3i(x0,0,z0), n10=hash3i(x1,0,z0), n01=hash3i(x0,0,z1), n11=hash3i(x1,0,z1);
  const ix0=n00+(n10-n00)*sx; const ix1=n01+(n11-n01)*sx; return ix0+(ix1-ix0)*sz;
}

function heightAt(x, z){
  const h = noise2(x*0.05, z*0.05)*24 + noise2(x*0.15, z*0.15)*6 + 16;
  return Math.floor(h);
}

// --- Simple biome sampling using temperature and moisture ---
function lerp(a,b,t){ return a + (b-a)*t; }
function clamp(x,lo,hi){ return x<lo?lo:(x>hi?hi:x); }
function mixColor(a,b,t){ return [ Math.round(lerp(a[0],b[0],t)), Math.round(lerp(a[1],b[1],t)), Math.round(lerp(a[2],b[2],t)) ]; }
// Temperature field favors lower altitudes and varies slowly with position
function temperatureAt(x, z){
  const base = noise2(x*0.008 + worldSeed*0.001, z*0.008 - worldSeed*0.001); // 0..1
  const mid  = noise2(x*0.03 + 100.123, z*0.03 - 55.321); // 0..1
  const alt = heightAt(x, z) / WORLD_HEIGHT; // 0..1
  let t = 0.7*base + 0.3*mid; // 0..1
  t -= alt * 0.6; // cooler with altitude
  return clamp(t, 0, 1);
}
// Moisture field varies at a different frequency; slightly wetter near sea level
function moistureAt(x, z){
  const base = noise2(x*0.01 - worldSeed*0.001, z*0.01 + worldSeed*0.001);
  const mid  = noise2(x*0.05 + 333.77, z*0.05 - 987.11);
  const h = heightAt(x, z);
  let m = 0.6*base + 0.4*mid;
  if (h < 16) m = clamp(m + 0.15, 0, 1); // near sea level, wetter
  return clamp(m, 0, 1);
}
// Apply biome tint to base RGB (0-255 array) based on temp/moist
function applyBiomeTint(baseRGB, id, wx, wy, wz){
  const t = temperatureAt(wx, wz);
  const m = moistureAt(wx, wz);
  // Default: no change
  let out = baseRGB;
  if (id === GRASS){
    const dry = [160,140,60];
    const lush = [80,180,80];
    const cold = [180,200,180];
    const lushAmt = clamp(0.55*m + 0.35*t, 0, 1);
    let g = mixColor(dry, lush, lushAmt);
    if (t < 0.3){ // push towards frosty green in cold regions
      const cAmt = clamp((0.3 - t)/0.3, 0, 1);
      g = mixColor(g, cold, cAmt*0.8);
    }
    out = g;
  } else if (id === LEAVES){
    const dry = [100,140,60];
    const lush = [70,170,70];
    const g = mixColor(dry, lush, clamp(0.6*m + 0.2*t, 0, 1));
    out = g;
  } else if (id === STONE){
    // Slightly cooler hue when cold, slightly warmer when hot
    const cool = [105,110,120];
    const warm = [120,115,110];
    out = mixColor(cool, warm, clamp(t, 0, 1));
  } else if (id === SAND){
    // Subtle warmth variation
    const cool = [210,205,160];
    const warm = [230,215,165];
    out = mixColor(cool, warm, clamp(t*0.7 + m*0.15, 0, 1));
  }
  return out;
}

// Block IDs and base colors
const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, WATER=5, WOOD=6, LEAVES=7, SNOW=8, PORTAL=9;
const BASE_COLOR = {
  [GRASS]: [95, 159, 53],
  [DIRT]: [134, 96, 67],
  [STONE]: [112, 112, 112],
  [SAND]: [219, 211, 160],
  [WATER]: [64, 96, 255],
  [WOOD]: [102, 81, 52],
  [LEAVES]: [76, 128, 76],
  [SNOW]: [240, 248, 255],
  [PORTAL]: [180, 60, 200],
};

// Multiplayer state (single definition, declared early to avoid TDZ issues)
const MP = { url:null, clientId:Math.random().toString(36).slice(2,10), color:[0.2+Math.random()*0.8,0.2+Math.random()*0.8,0.2+Math.random()*0.8], peers:new Map(), connected:false, lastSend:0 };

// ---------------------------------------------------------
// Bio-simulation overlay: 3D cyclic cellular automaton (CCA)
// Produces complex wave/filament patterns in 3D, rendered as translucent voxels
// Controls: B toggle, M run/pause, N step once, R reseed
class BioSim3D {
  constructor(glCtx){
    this.gl = glCtx;
    this.enabled = false;
    this.running = true;
    this.size = { x: 24, y: 16, z: 24 };
    this.origin = { x: -12, y: 28, z: -12 }; // world-space anchor near spawn
    this.states = 8; // number of CCA states (0..states-1)
    this.threshold = 3; // neighbors of next state to trigger advance
    this.grid = new Uint8Array(this.size.x * this.size.y * this.size.z);
    this.next = new Uint8Array(this.grid.length);
    this.vbo = null; this.count = 0;
    this.stepInterval = 0.2; // seconds between steps when running
    this._accum = 0;
    this.seedRandom();
  }
  idx(x,y,z){ return (y*this.size.z + z)*this.size.x + x; }
  seedRandom(d=0.10){
    for (let i=0;i<this.grid.length;i++){
      const r = Math.random();
      this.grid[i] = r<d ? (1 + Math.floor(Math.random()*(this.states-1))) : 0;
    }
    this.rebuildMesh();
  }
  toggle(){ this.enabled = !this.enabled; }
  stepOnce(){ this.step(); this.rebuildMesh(); }
  update(dt){
    if (!this.enabled) return;
    this._accum += dt;
    if (this.running && this._accum >= this.stepInterval){
      this._accum = 0;
      this.step();
      this.rebuildMesh();
    }
  }
  neighborCountNext(x,y,z){
    const w=this.size.x, h=this.size.y, d=this.size.z;
    const cur = this.grid[this.idx(x,y,z)];
    const want = (cur + 1) % this.states;
    let c=0;
    for (let dy=-1; dy<=1; dy++){
      const yy = y+dy; if (yy<0||yy>=h) continue;
      for (let dz=-1; dz<=1; dz++){
        const zz = z+dz; if (zz<0||zz>=d) continue;
        for (let dx=-1; dx<=1; dx++){
          const xx = x+dx; if (xx<0||xx>=w) continue;
          if (dx===0&&dy===0&&dz===0) continue;
          const s = this.grid[this.idx(xx,yy,zz)];
          if (s===want) c++;
        }
      }
    }
    return c;
  }
  step(){
    const w=this.size.x, h=this.size.y, d=this.size.z;
    for (let y=0;y<h;y++){
      for (let z=0;z<d;z++){
        for (let x=0;x<w;x++){
          const i=this.idx(x,y,z);
          const s=this.grid[i];
          const nn = this.neighborCountNext(x,y,z);
          if (nn>=this.threshold){
            this.next[i] = (s + 1) % this.states;
          } else {
            // small spontaneous ignition to prevent freeze
            if (s===0 && Math.random()<0.0008) this.next[i]=1; else this.next[i]=s;
          }
        }
      }
    }
    // swap
    const t=this.grid; this.grid=this.next; this.next=t;
  }
  rebuildMesh(){
    // Build faces only where cell is non-zero and neighbor is zero (surface)
    const out = [];
    const w=this.size.x, h=this.size.y, d=this.size.z;
    const ox=this.origin.x, oy=this.origin.y, oz=this.origin.z;
    const dirs = [
      [ 1, 0, 0], [-1, 0, 0], [0, 1, 0], [0,-1, 0], [0, 0, 1], [0, 0,-1]
    ];
    const quads = [
      [[1,0,0],[1,1,0],[1,1,1],[1,0,1],[1,0,0]], // +X
      [[0,0,1],[0,1,1],[0,1,0],[0,0,0],[-1,0,0]], // -X
      [[0,1,1],[1,1,1],[1,1,0],[0,1,0],[0,1,0]], // +Y
      [[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,-1,0]], // -Y
      [[0,0,1],[1,0,1],[1,1,1],[0,1,1],[0,0,1]], // +Z
      [[0,1,0],[1,1,0],[1,0,0],[0,0,0],[0,0,-1]], // -Z
    ];
    function hsv2rgb(h,s,v){
      const i = Math.floor(h*6), f=h*6 - i; const p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
      const m=i%6; const out = [v,v,v];
      if (m===0) out.splice(0,3, v,t,p);
      if (m===1) out.splice(0,3, q,v,p);
      if (m===2) out.splice(0,3, p,v,t);
      if (m===3) out.splice(0,3, p,q,v);
      if (m===4) out.splice(0,3, t,p,v);
      if (m===5) out.splice(0,3, v,p,q);
      return out;
    }
    for (let y=0;y<h;y++){
      for (let z=0;z<d;z++){
        for (let x=0;x<w;x++){
          const i=this.idx(x,y,z); const s=this.grid[i];
          if (s===0) continue;
          const hue = (s/this.states + 0.6) % 1.0; // cycle hues
          const col = hsv2rgb(hue, 0.75, 0.9);
          for (let f=0; f<6; f++){
            const nx=x+dirs[f][0], ny=y+dirs[f][1], nz=z+dirs[f][2];
            let occ=0;
            if (nx>=0&&nx<w&&ny>=0&&ny<h&&nz>=0&&nz<d){
              occ = this.grid[this.idx(nx,ny,nz)]!==0 ? 1:0;
            }
            if (occ) continue; // neighbor present -> culled
            const q = quads[f];
            const n = q[4];
            const p0=[ox+x+q[0][0], oy+y+q[0][1], oz+z+q[0][2]];
            const p1=[ox+x+q[1][0], oy+y+q[1][1], oz+z+q[1][2]];
            const p2=[ox+x+q[2][0], oy+y+q[2][1], oz+z+q[2][2]];
            const p3=[ox+x+q[3][0], oy+y+q[3][1], oz+z+q[3][2]];
            out.push(...p0, ...col, ...n, ...p1, ...col, ...n, ...p2, ...col, ...n);
            out.push(...p0, ...col, ...n, ...p2, ...col, ...n, ...p3, ...col, ...n);
          }
        }
      }
    }
    const buf = new Float32Array(out);
    if (!this.vbo) this.vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW);
    this.count = buf.length/9;
  }
  draw(){
    if (!this.enabled || !this.vbo || this.count===0) return;
    const gl=this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 9*4, 0);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 9*4, 3*4);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 9*4, 6*4);
    gl.uniform1f(uAlpha, 0.7);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  }
}
const bio = new BioSim3D(gl);

// ---------------------------------------------------------
// Neural Cellular Automata (NCA) 3D overlay
// Lightweight CPU implementation with tiny MLP update per cell
class Nca3D {
  constructor(glCtx){
    this.gl = glCtx;
    this.enabled = false;
    this.running = true;
    this.size = { x: 28, y: 18, z: 28 };
    this.origin = { x: -14, y: 28, z: -14 };
    this.C = 6; // channels per cell
    const N = this.size.x * this.size.y * this.size.z * this.C;
    this.state = new Float32Array(N);
    this.next = new Float32Array(N);
    this.vbo = null; this.count = 0;
    this.stepInterval = 0.15;
    this._accum = 0;
    // Tiny MLP params (inputs: state+neighborMean+laplacian => 3*C)
    this.H = 16;
    const inDim = this.C * 3;
    // Initialize weights with small values for stability
    function randn(){ return (Math.random()*2-1) * 0.3; }
    this.W1 = new Float32Array(this.H * inDim);
    this.b1 = new Float32Array(this.H);
    this.W2 = new Float32Array(this.C * this.H);
    this.b2 = new Float32Array(this.C);
    for (let i=0;i<this.W1.length;i++) this.W1[i] = randn()/Math.sqrt(inDim);
    for (let i=0;i<this.b1.length;i++) this.b1[i] = 0;
    for (let i=0;i<this.W2.length;i++) this.W2[i] = randn()/Math.sqrt(this.H);
    for (let i=0;i<this.b2.length;i++) this.b2[i] = 0;
    // Bias channel 0 growth slightly
    this.b2[0] = 0.02;
    this.seedSeed();
  }
  idx(x,y,z,c){ const {x:W,y:H,z:D}=this.size; return (((y*D)+z)*W + x)*this.C + c; }
  toggle(){ this.enabled = !this.enabled; }
  seedSeed(){
    this.state.fill(0);
    const cx = Math.floor(this.size.x/2), cy=Math.floor(this.size.y/2), cz=Math.floor(this.size.z/2);
    const r = 2;
    for (let z=-r; z<=r; z++) for (let y=-r; y<=r; y++) for (let x=-r; x<=r; x++){
      const dx=x, dy=y, dz=z; if (dx*dx+dy*dy+dz*dz>r*r) continue;
      const ix=cx+x, iy=cy+y, iz=cz+z;
      if (ix<0||iy<0||iz<0||ix>=this.size.x||iy>=this.size.y||iz>=this.size.z) continue;
      this.state[this.idx(ix,iy,iz,0)] = 1.0; // alive
      this.state[this.idx(ix,iy,iz,1)] = 0.5;
      this.state[this.idx(ix,iy,iz,2)] = -0.2;
    }
    this.rebuildMesh();
  }
  stepOnce(){ this.step(); this.rebuildMesh(); }
  update(dt){
    if (!this.enabled) return;
    this._accum += dt;
    if (this.running && this._accum >= this.stepInterval){ this._accum=0; this.step(); this.rebuildMesh(); }
  }
  step(){
    const {x:W,y:H,z:D} = this.size;
    const C = this.C;
    const inDim = C*3, Hdim = this.H;
    // For each cell, compute neighbor mean and laplacian using 6-neighborhood + self
    for (let y=0;y<H;y++){
      for (let z=0;z<D;z++){
        for (let x=0;x<W;x++){
          // Build input vector
          const inp = new Float32Array(inDim);
          for (let c=0;c<C;c++){
            const s = this.state[this.idx(x,y,z,c)];
            // mean of self + 6 neighbors
            let sum = s; let cnt=1;
            const nbs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
            for (let k=0;k<nbs.length;k++){
              const nx=x+nbs[k][0], ny=y+nbs[k][1], nz=z+nbs[k][2];
              if (nx<0||ny<0||nz<0||nx>=W||ny>=H||nz>=D) continue;
              sum += this.state[this.idx(nx,ny,nz,c)]; cnt++;
            }
            const mean = sum / cnt;
            const lap = mean - s;
            inp[c] = s;
            inp[C + c] = mean;
            inp[2*C + c] = lap;
          }
          // MLP: relu(W1*inp+b1) -> delta = W2*h + b2
          const h = new Float32Array(Hdim);
          for (let i=0;i<Hdim;i++){
            let acc = this.b1[i];
            const off = i*inDim;
            for (let j=0;j<inDim;j++) acc += this.W1[off+j]*inp[j];
            h[i] = acc>0?acc:0; // ReLU
          }
          for (let c=0;c<C;c++){
            let acc = this.b2[c];
            const off = c*Hdim;
            for (let i=0;i<Hdim;i++) acc += this.W2[off+i]*h[i];
            // Stochastic update mask (fire rate ~0.5)
            const fire = Math.random()<0.5 ? 1.0 : 0.0;
            const cur = this.state[this.idx(x,y,z,c)];
            let nxt = cur + fire * 0.1 * acc;
            // Damp and clamp for stability
            nxt = Math.max(-1.0, Math.min(1.0, nxt));
            this.next[this.idx(x,y,z,c)] = nxt;
          }
        }
      }
    }
    // swap
    const t = this.state; this.state=this.next; this.next=t;
  }
  rebuildMesh(){
    const out=[]; const {x:W,y:H,z:D}=this.size; const ox=this.origin.x, oy=this.origin.y, oz=this.origin.z;
    const nDirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const quads=[
      [[1,0,0],[1,1,0],[1,1,1],[1,0,1],[1,0,0]],
      [[0,0,1],[0,1,1],[0,1,0],[0,0,0],[-1,0,0]],
      [[0,1,1],[1,1,1],[1,1,0],[0,1,0],[0,1,0]],
      [[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,-1,0]],
      [[0,0,1],[1,0,1],[1,1,1],[0,1,1],[0,0,1]],
      [[0,1,0],[1,1,0],[1,0,0],[0,0,0],[0,0,-1]],
    ];
    function sigmoid(x){ return 1/(1+Math.exp(-x)); }
    for (let y=0;y<H;y++){
      for (let z=0;z<D;z++){
        for (let x=0;x<W;x++){
          const a = sigmoid(this.state[this.idx(x,y,z,0)]*4);
          if (a<0.15) continue; // not alive enough
          // Color derived from channels 3,4 as angle; saturation from ch2; value from ch1
          const v = sigmoid(this.state[this.idx(x,y,z,1)]);
          const s = sigmoid(this.state[this.idx(x,y,z,2)]);
          const ax = this.state[this.idx(x,y,z,3)];
          const ay = this.state[this.idx(x,y,z,4)];
          const hue = (Math.atan2(ay, ax)/(2*Math.PI) + 1.0) % 1.0;
          const col = hsvToRgb(hue, 0.2+0.6*s, 0.3+0.7*v);
          for (let f=0; f<6; f++){
            const nx=x+nDirs[f][0], ny=y+nDirs[f][1], nz=z+nDirs[f][2];
            let nbAlive = 0;
            if (nx>=0&&nx<W&&ny>=0&&ny<H&&nz>=0&&nz<D){
              nbAlive = sigmoid(this.state[this.idx(nx,ny,nz,0)]*4) >= 0.15 ? 1:0;
            }
            if (nbAlive) continue;
            const q=quads[f]; const n=q[4];
            const p0=[ox+x+q[0][0], oy+y+q[0][1], oz+z+q[0][2]];
            const p1=[ox+x+q[1][0], oy+y+q[1][1], oz+z+q[1][2]];
            const p2=[ox+x+q[2][0], oy+y+q[2][1], oz+z+q[2][2]];
            const p3=[ox+x+q[3][0], oy+y+q[3][1], oz+z+q[3][2]];
            // use alpha a for translucency via draw path
            const c=[col[0], col[1], col[2]];
            out.push(...p0, ...c, ...n, ...p1, ...c, ...n, ...p2, ...c, ...n);
            out.push(...p0, ...c, ...n, ...p2, ...c, ...n, ...p3, ...c, ...n);
          }
        }
      }
    }
    const buf = new Float32Array(out);
    if (!this.vbo) this.vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW);
    this.count = buf.length/9;
  }
  draw(){ if (!this.enabled || !this.vbo || this.count===0) return; const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,9*4,0); gl.vertexAttribPointer(aCol,3,gl.FLOAT,false,9*4,3*4); gl.vertexAttribPointer(aNor,3,gl.FLOAT,false,9*4,6*4); gl.uniform1f(uAlpha, 0.5); gl.drawArrays(gl.TRIANGLES, 0, this.count); }
}
function hsvToRgb(h, s, v){
  const i = Math.floor(h*6), f=h*6-i; const p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  switch(i%6){
    case 0: return [v,t,p]; case 1: return [q,v,p]; case 2: return [p,v,t];
    case 3: return [p,q,v]; case 4: return [t,p,v]; case 5: return [v,p,q];
  }
}
const nca = new Nca3D(gl);

// Chunk storage and meshing
const chunks = new Map(); // key "cx,cz" -> {voxels, solidVBO, solidCount, waterVBO, waterCount, cx, cz}
const scheduled = new Set();
const buildQueue = []; // [{cx,cz}]

// Persistent edits (placed/removed blocks) stored in localStorage
function editsKey(){ return 'voxelcraft_edits_v1_' + worldSeedStr; }
const edits = new Map(); // key "x,y,z" -> id
function loadEdits(){
  try{ const raw = localStorage.getItem(editsKey()); if(!raw) return; const obj = JSON.parse(raw); for(const k in obj){ edits.set(k, obj[k]|0); } }catch{}
}
function saveEdits(){
  // small debounce to avoid spamming storage
  if (saveEdits._t) cancelAnimationFrame(saveEdits._t);
  saveEdits._t = requestAnimationFrame(()=>{
    const obj = {}; for(const [k,v] of edits) obj[k]=v;
    try{ localStorage.setItem(editsKey(), JSON.stringify(obj)); }catch{}
  });
}
loadEdits();

function chunkKey(cx, cz){ return cx+","+cz; }

function genChunk(cx, cz){
  const voxels = new Uint8Array(CHUNK*WORLD_HEIGHT*CHUNK);
  for (let x=0;x<CHUNK;x++){
    for (let z=0; z<CHUNK; z++){
      const wx = cx*CHUNK + x;
      const wz = cz*CHUNK + z;
      const hh = heightAt(wx, wz);
      for (let y=0; y<WORLD_HEIGHT; y++){
        let id=AIR;
        if (y<=hh){
          if (hh < WATER_LEVEL + 2) id = SAND;
          else if (y===hh) id = (hh>36 ? SNOW : GRASS);
          else if (y>hh-3) id = DIRT;
          else id = STONE;
        } else if (y < WATER_LEVEL && y > hh) {
          id = WATER;
        }
        voxels[(y*CHUNK + z)*CHUNK + x] = id;
      }
      // Simple trees on grass between certain heights
      // Chance determined by hash; avoid near waterline
      if (hh>=18 && hh<=36) {
        const r = hash3i(wx*3, 0, wz*7);
        if (r > 0.995) {
          placeTreeInChunk(voxels, x, hh+1, z); // base sits above ground
        }
      }
    }
  }
  // Apply persistent edits that fall into this chunk
  for (const [key, id] of edits){
    const [wx, wy, wz] = key.split(',').map(n=>parseInt(n,10));
    if (wy<0 || wy>=WORLD_HEIGHT) continue;
    const ecx = Math.floor(wx/CHUNK), ecz = Math.floor(wz/CHUNK);
    if (ecx===cx && ecz===cz){
      const lx = wx - cx*CHUNK; const lz = wz - cz*CHUNK; const ly = wy;
      if (lx>=0&&lx<CHUNK&&lz>=0&&lz<CHUNK){
        voxels[(ly*CHUNK + lz)*CHUNK + lx] = id;
      }
    }
  }
  return voxels;
}

function placeTreeInChunk(voxels, lx, baseY, lz){
  // Trunk height 4-6
  const h = 4 + (Math.floor(hash3i(lx, baseY, lz)*3));
  const top = Math.min(WORLD_HEIGHT-1, baseY + h);
  // Place trunk
  for (let y=baseY; y<=top; y++){
    if (y<0||y>=WORLD_HEIGHT) break;
    const idx = (y*CHUNK + lz)*CHUNK + lx;
    voxels[idx] = WOOD;
  }
  // Simple leaf blob around top
  const radius = 2;
  for (let dy=-radius; dy<=radius; dy++){
    const y = top + dy;
    if (y<0||y>=WORLD_HEIGHT) continue;
    for (let dz=-radius; dz<=radius; dz++){
      const z = lz + dz; if (z<0||z>=CHUNK) continue;
      for (let dx=-radius; dx<=radius; dx++){
        const x = lx + dx; if (x<0||x>=CHUNK) continue;
        const d = Math.abs(dx)+Math.abs(dy)+Math.abs(dz);
        if (d<=radius+1){
          const idx = (y*CHUNK + z)*CHUNK + x;
          // Do not overwrite solid trunk at center top; allow replacing air or foliage/snow
          if (voxels[idx]===AIR || voxels[idx]===LEAVES || voxels[idx]===SNOW) voxels[idx]=LEAVES;
        }
      }
    }
  }
}

// Mesh building with face culling and color jitter
const faces = [
  {dir:[ 1, 0, 0], verts:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]], norm:[1,0,0]},
  {dir:[-1, 0, 0], verts:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]], norm:[-1,0,0]},
  {dir:[0, 1, 0], verts:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], norm:[0,1,0]},
  {dir:[0,-1, 0], verts:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], norm:[0,-1,0]},
  {dir:[0, 0, 1], verts:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], norm:[0,0,1]},
  {dir:[0, 0,-1], verts:[[0,1,0],[1,1,0],[1,0,0],[0,0,0]], norm:[0,0,-1]},
];

function getVoxel(voxels, x,y,z){
  if (x<0||x>=CHUNK||y<0||y>=WORLD_HEIGHT||z<0||z>=CHUNK) return AIR;
  return voxels[(y*CHUNK+z)*CHUNK+x];
}

function jitterColor(base, wx, wy, wz){
  // Per-block slight jitter, deterministic
  const r = hash3i(wx, wy, wz) - 0.5;
  const f = 1 + r*0.12; // +/-12%
  return [base[0]*f/255, base[1]*f/255, base[2]*f/255];
}

function buildMesh(cx, cz, voxels){
  const solid=[]; // position (3) + color (3) + normal (3)
  const water=[]; // same layout; rendered in transparent pass
  const portals=[]; // portal quads for translucent pass
  for (let x=0;x<CHUNK;x++){
    for (let y=0;y<WORLD_HEIGHT;y++){
      for (let z=0;z<CHUNK;z++){
        const id = getVoxel(voxels, x,y,z);
        if (id===AIR) continue;
        let base = BASE_COLOR[id];
        const wx = cx*CHUNK + x, wy=y, wz = cz*CHUNK + z;
        base = applyBiomeTint(base, id, wx, wy, wz);
        const col = jitterColor(base, wx, wy, wz);
        // Skip rendering blocks far below water if water on top to reduce overdraw
        if (id!==WATER && wy < WATER_LEVEL && getVoxel(voxels, x,wy+1,z)===WATER) continue;
        for (const f of faces){
          const nx=x+f.dir[0], ny=y+f.dir[1], nz=z+f.dir[2];
          const neighbor = getVoxel(voxels, nx,ny,nz);
          if (neighbor!==AIR && !(id===WATER && neighbor===WATER) && !(id===PORTAL && neighbor===PORTAL)) continue;
          // Create two tris
          const v=f.verts;
          const p0=[wx+v[0][0], wy+v[0][1], wz+v[0][2]];
          const p1=[wx+v[1][0], wy+v[1][1], wz+v[1][2]];
          const p2=[wx+v[2][0], wy+v[2][1], wz+v[2][2]];
          const p3=[wx+v[3][0], wy+v[3][1], wz+v[3][2]];
          const n=f.norm;
          const c=[col[0], col[1], col[2]];
          let out = solid;
          if (id===WATER) out = water; else if (id===PORTAL) out = portals;
          out.push(...p0, ...c, ...n,  ...p1, ...c, ...n,  ...p2, ...c, ...n);
          out.push(...p0, ...c, ...n,  ...p2, ...c, ...n,  ...p3, ...c, ...n);
        }
      }
    }
  }
  const solidBuf = new Float32Array(solid);
  const solidVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, solidVBO);
  gl.bufferData(gl.ARRAY_BUFFER, solidBuf, gl.STATIC_DRAW);
  const waterBuf = new Float32Array(water);
  const waterVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterVBO);
  gl.bufferData(gl.ARRAY_BUFFER, waterBuf, gl.STATIC_DRAW);
  const portalBuf = new Float32Array(portals);
  const portalVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, portalVBO);
  gl.bufferData(gl.ARRAY_BUFFER, portalBuf, gl.STATIC_DRAW);
  return { solidVBO, solidCount: solidBuf.length/9, waterVBO, waterCount: waterBuf.length/9, portalVBO, portalCount: portalBuf.length/9 };
}

function updateChunk(cx, cz){
  const key = chunkKey(cx, cz);
  let ent = chunks.get(key);
  if (!ent){ ent = {}; chunks.set(key, ent); }
  if (!ent.voxels){ ent.voxels = genChunk(cx, cz); }
  if (ent.solidVBO) gl.deleteBuffer(ent.solidVBO);
  if (ent.waterVBO) gl.deleteBuffer(ent.waterVBO);
  if (ent.portalVBO) gl.deleteBuffer(ent.portalVBO);
  const mesh = buildMesh(cx, cz, ent.voxels);
  ent.solidVBO = mesh.solidVBO; ent.solidCount = mesh.solidCount;
  ent.waterVBO = mesh.waterVBO; ent.waterCount = mesh.waterCount;
  ent.portalVBO = mesh.portalVBO; ent.portalCount = mesh.portalCount;
  ent.cx=cx; ent.cz=cz;
}

function ensureChunk(cx, cz){
  const key = chunkKey(cx, cz);
  let ent = chunks.get(key);
  if (!ent){
    ent = { cx, cz };
    ent.voxels = genChunk(cx, cz);
    chunks.set(key, ent);
  }
  if (!ent.solidVBO && !ent.waterVBO) updateChunk(cx, cz); else { ent.cx=cx; ent.cz=cz; }
  return ent;
}

function worldToLocal(wx, wy, wz){
  const cx = Math.floor(wx/CHUNK), cz = Math.floor(wz/CHUNK);
  const lx = wx - cx*CHUNK, lz = wz - cz*CHUNK, ly = wy;
  return { cx, cz, lx, ly, lz };
}

// Internal setter that updates memory/meshes but does not record history/persist
function setVoxelInternal(wx, wy, wz, id){
  if (wy<0 || wy>=WORLD_HEIGHT) return { changed:false, prev:AIR };
  const {cx, cz, lx, ly, lz} = worldToLocal(wx, wy, wz);
  const ent = ensureChunk(cx, cz);
  const idx = (ly*CHUNK + lz)*CHUNK + lx;
  const prev = ent.voxels[idx];
  if (prev === id) return { changed:false, prev };
  ent.voxels[idx] = id;
  // Rebuild this chunk and neighbors if edge touched
  updateChunk(cx, cz);
  if (lx===0) updateChunk(cx-1, cz);
  if (lx===CHUNK-1) updateChunk(cx+1, cz);
  if (lz===0) updateChunk(cx, cz-1);
  if (lz===CHUNK-1) updateChunk(cx, cz+1);
  return { changed:true, prev };
}

// Undo/redo stacks (single definition)
const undoStack = [];
const redoStack = [];

function setVoxel(wx, wy, wz, id){
  // In survival mode, placing consumes, removing adds
  if (survival){
    if (id!==AIR){ if (!invConsume(id,1)) return false; }
  }
  const {changed, prev} = setVoxelInternal(wx, wy, wz, id);
  if (!changed) return false;
  // persist edit
  edits.set(`${wx},${wy},${wz}`, id);
  saveEdits();
  // record history
  undoStack.push({ wx, wy, wz, prev, next:id });
  if (undoStack.length>1000) undoStack.shift();
  redoStack.length = 0;
  if (survival){
    if (id===AIR && prev!==AIR){ invAdd(prev, 1); }
  }
  return true;
}

function undoEdit(){
  const e = undoStack.pop(); if (!e) return;
  const { wx, wy, wz, prev, next } = e;
  setVoxelInternal(wx, wy, wz, prev);
  edits.set(`${wx},${wy},${wz}`, prev);
  saveEdits();
  redoStack.push(e);
}
function redoEdit(){
  const e = redoStack.pop(); if (!e) return;
  const { wx, wy, wz, prev, next } = e;
  setVoxelInternal(wx, wy, wz, next);
  edits.set(`${wx},${wy},${wz}`, next);
  saveEdits();
  undoStack.push(e);
}

function getVoxelWorld(wx, wy, wz){
  if (wy<0 || wy>=WORLD_HEIGHT) return AIR;
  const {cx, cz, lx, ly, lz} = worldToLocal(wx, wy, wz);
  const ent = chunks.get(chunkKey(cx, cz));
  if (!ent || !ent.voxels) return AIR;
  return ent.voxels[(ly*CHUNK + lz)*CHUNK + lx];
}

// Shader program with directional lighting and fog
const vs = `
attribute vec3 aPos; attribute vec3 aCol; attribute vec3 aNor;
uniform mat4 uProj, uView; uniform float uIsWater; uniform float uTime;
varying vec3 vCol; varying float vDist; varying vec3 vNor;
void main(){
  vec3 pos = aPos;
  // Apply subtle waves to top faces of water during transparent pass
  if (uIsWater > 0.5 && aNor.y > 0.5){
    float w = sin(pos.x*0.07 + uTime*1.2)*0.04 + cos(pos.z*0.05 + uTime*0.8)*0.04;
    pos.y += w;
  }
  vec4 wp = uView * vec4(pos, 1.0);
  vDist = length(wp.xyz);
  vCol = aCol;
  vNor = aNor;
  gl_Position = uProj * wp;
}`;
const fs = `
precision mediump float; varying vec3 vCol; varying float vDist; varying vec3 vNor;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
uniform vec3 uLightDir; uniform vec3 uLightColor; uniform vec3 uAmbient;
uniform float uAlpha;
void main(){
  float ndl = max(dot(normalize(vNor), normalize(uLightDir)), 0.0);
  // Basic lambert + cheap tonemap-like curve
  vec3 lit = vCol * (uAmbient + uLightColor * ndl);
  lit = lit / (lit + vec3(0.7));
  float f = smoothstep(uFogNear, uFogFar, vDist);
  vec3 col = mix(lit, uFogCol, f);
  gl_FragColor = vec4(col, uAlpha);
}`;

function compile(type, src){ const s=gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
function program(vsSrc, fsSrc){ const p=gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc)); gl.linkProgram(p); if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p; }
const prog = program(vs, fs);
gl.useProgram(prog);
const aPos = gl.getAttribLocation(prog, 'aPos');
const aCol = gl.getAttribLocation(prog, 'aCol');
const aNor = gl.getAttribLocation(prog, 'aNor');
const uProj = gl.getUniformLocation(prog, 'uProj');
const uView = gl.getUniformLocation(prog, 'uView');
const uFogCol = gl.getUniformLocation(prog, 'uFogCol');
const uFogNear = gl.getUniformLocation(prog, 'uFogNear');
const uFogFar = gl.getUniformLocation(prog, 'uFogFar');
const uLightDir = gl.getUniformLocation(prog, 'uLightDir');
const uLightColor = gl.getUniformLocation(prog, 'uLightColor');
const uAmbient = gl.getUniformLocation(prog, 'uAmbient');
const uAlpha = gl.getUniformLocation(prog, 'uAlpha');
const uIsWater = gl.getUniformLocation(prog, 'uIsWater');
const uTime = gl.getUniformLocation(prog, 'uTime');

gl.enableVertexAttribArray(aPos);
gl.enableVertexAttribArray(aCol);
gl.enableVertexAttribArray(aNor);

// Line shader for block highlight
const vsL = `
attribute vec3 aPos;
uniform mat4 uProj, uView; varying float vDist;
void main(){
  vec4 wp = uView * vec4(aPos, 1.0);
  vDist = length(wp.xyz);
  gl_Position = uProj * wp;
}`;
const fsL = `
precision mediump float; varying float vDist;
uniform vec3 uColor; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
void main(){
  float f = smoothstep(uFogNear, uFogFar, vDist);
  vec3 col = mix(uColor, uFogCol, f);
  gl_FragColor = vec4(col, 1.0);
}`;
const linesProg = program(vsL, fsL);
const aPosL = gl.getAttribLocation(linesProg, 'aPos');
const uProjL = gl.getUniformLocation(linesProg, 'uProj');
const uViewL = gl.getUniformLocation(linesProg, 'uView');
const uColorL = gl.getUniformLocation(linesProg, 'uColor');
const uFogColL = gl.getUniformLocation(linesProg, 'uFogCol');
const uFogNearL = gl.getUniformLocation(linesProg, 'uFogNear');
const uFogFarL = gl.getUniformLocation(linesProg, 'uFogFar');

// Render loop
// Distant-horizon configuration and toggle
const farLOD = { enabled: true, radius: 3072 };
window.addEventListener('keydown', (e)=>{ if (e.key.toLowerCase()==='k') farLOD.enabled = !farLOD.enabled; });

function updateViewProj(){
  const aspect = canvas.width / canvas.height;
  // Extend far plane to accommodate distant horizon geometry
  const farPlane = Math.max(2000, fogDistance*6, farLOD.enabled ? farLOD.radius*2 : 0);
  const proj = mat4_perspective((fovDeg*Math.PI/180), aspect, 0.1, farPlane);
  const cp=Math.cos(cam.rot[0]), sp=Math.sin(cam.rot[0]);
  const cy=Math.cos(cam.rot[1]), sy=Math.sin(cam.rot[1]);
  const fwd = [sy*cp, -sp, cy*cp];
  const center = [cam.pos[0]+fwd[0], cam.pos[1]+fwd[1], cam.pos[2]+fwd[2]];
  const view = mat4_lookAt(cam.pos, center, [0,1,0]);
  gl.uniformMatrix4fv(uProj, false, proj);
  gl.uniformMatrix4fv(uView, false, view);
}

// Movement
function move(dt){
  const base = cam.walk ? 7 : 18;
  const speed = key['shift'] ? base*1.7 : base;
  const forward = [Math.sin(cam.rot[1]), 0, Math.cos(cam.rot[1])];
  const right = [Math.cos(cam.rot[1]), 0,-Math.sin(cam.rot[1])];
  if (!cam.walk){
    // Fly mode constant velocity control
    if (key['w']) { cam.pos[0]+=forward[0]*dt*speed; cam.pos[2]+=forward[2]*dt*speed; }
    if (key['s']) { cam.pos[0]-=forward[0]*dt*speed; cam.pos[2]-=forward[2]*dt*speed; }
    // Invert A/D to match expected strafing (A = left, D = right)
    if (key['a']) { cam.pos[0]+=right[0]*dt*speed; cam.pos[2]+=right[2]*dt*speed; }
    if (key['d']) { cam.pos[0]-=right[0]*dt*speed; cam.pos[2]-=right[2]*dt*speed; }
    if (key[' ']) cam.pos[1]+=dt*speed;
    if (key['shift']) cam.pos[1]-=dt*speed;
    return;
  }
  // Walk mode with gravity and simple ground collision (voxel AABB at feet)
  const accel = [0, -30, 0];
  const moveDir = [0,0,0];
  if (key['w']) { moveDir[0]+=Math.sin(cam.rot[1]); moveDir[2]+=Math.cos(cam.rot[1]); }
  if (key['s']) { moveDir[0]-=Math.sin(cam.rot[1]); moveDir[2]-=Math.cos(cam.rot[1]); }
  if (key['a']) { moveDir[0]-=Math.cos(cam.rot[1]); moveDir[2]+=Math.sin(cam.rot[1]); }
  if (key['d']) { moveDir[0]+=Math.cos(cam.rot[1]); moveDir[2]-=Math.sin(cam.rot[1]); }
  const len = Math.hypot(moveDir[0], moveDir[2]);
  if (len>0){ moveDir[0]/=len; moveDir[2]/=len; }
  cam.vel[0] = moveDir[0]*speed;
  cam.vel[2] = moveDir[2]*speed;
  // Jump
  if (key[' '] && cam.onGround){ cam.vel[1] = 10; cam.onGround=false; }
  cam.vel[1] += accel[1]*dt;
  // Attempt vertical move with ground and ceiling collision
  let nextY = cam.pos[1] + cam.vel[1]*dt;
  const height = 1.7; // approx player height
  const eyeToFeet = 1.6;
  let feetY = nextY - eyeToFeet;
  const wx0 = Math.floor(cam.pos[0]);
  const wz0 = Math.floor(cam.pos[2]);
  const under = getVoxelWorld(wx0, Math.floor(feetY), wz0);
  if (under!==AIR && under!==WATER && feetY<Math.floor(feetY)+1){
    cam.onGround = true;
    cam.vel[1] = 0;
    // snap feet to top of block
    cam.pos[1] = Math.floor(feetY)+1 + eyeToFeet;
  } else {
    cam.onGround = false;
    // Ceiling collision: if head intersects a solid block, push down
    const headY = nextY - eyeToFeet + height;
    const aboveY = Math.floor(headY + 1e-3);
    const above = getVoxelWorld(wx0, aboveY, wz0);
    if (above!==AIR && above!==WATER && headY > aboveY){
      cam.vel[1] = Math.min(0, cam.vel[1]);
      cam.pos[1] = aboveY + eyeToFeet - height - 1e-3;
    } else {
      cam.pos[1] = nextY;
    }
  }
  // Horizontal collision (prevent walking through walls)
  const r = 0.3; // player radius
  function aabbBlocked(x, yFeet, z){
    const minX = Math.floor(x - r), maxX = Math.floor(x + r);
    const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);
    const minY = Math.floor(yFeet), maxY = Math.floor(yFeet + height);
    for (let by=minY; by<=maxY; by++){
      for (let bz=minZ; bz<=maxZ; bz++){
        for (let bx=minX; bx<=maxX; bx++){
          const id = getVoxelWorld(bx, by, bz);
          if (id!==AIR && id!==WATER) return true;
        }
      }
    }
    return false;
  }
  function headBlocked(x, headY, z){
    const y = Math.floor(headY + 1e-3);
    const minX = Math.floor(x - r), maxX = Math.floor(x + r);
    const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);
    for (let bz=minZ; bz<=maxZ; bz++){
      for (let bx=minX; bx<=maxX; bx++){
        const id = getVoxelWorld(bx, y, bz);
        if (id!==AIR && id!==WATER) return true;
      }
    }
    return false;
  }
  // Axis-separated resolution: X then Z
  let tryX = cam.pos[0] + cam.vel[0]*dt;
  feetY = cam.pos[1] - eyeToFeet;
  if (!aabbBlocked(tryX, feetY, cam.pos[2])){
    cam.pos[0] = tryX;
  } else {
    // Step-down assist: allow moving if we can step down a small height at destination
    const stepDown = 0.6;
    if (!aabbBlocked(tryX, feetY - stepDown, cam.pos[2])){
      cam.pos[0] = tryX; cam.pos[1] -= stepDown;
    } else {
      cam.vel[0] = 0;
    }
  }
  let tryZ = cam.pos[2] + cam.vel[2]*dt;
  if (!aabbBlocked(cam.pos[0], feetY, tryZ)){
    cam.pos[2] = tryZ;
  } else {
    const stepDown = 0.6;
    if (!aabbBlocked(cam.pos[0], feetY - stepDown, tryZ)){
      cam.pos[2] = tryZ; cam.pos[1] -= stepDown;
    } else {
      cam.vel[2] = 0;
    }
  }
  // Prevent getting stuck inside walls when both axes blocked: nudge slightly outward
  if (aabbBlocked(cam.pos[0], feetY, cam.pos[2])){
    const nudge = 0.05;
    if (!aabbBlocked(cam.pos[0]+nudge, feetY, cam.pos[2])) cam.pos[0]+=nudge;
    else if (!aabbBlocked(cam.pos[0]-nudge, feetY, cam.pos[2])) cam.pos[0]-=nudge;
    if (!aabbBlocked(cam.pos[0], feetY, cam.pos[2]+nudge)) cam.pos[2]+=nudge;
    else if (!aabbBlocked(cam.pos[0], feetY, cam.pos[2]-nudge)) cam.pos[2]-=nudge;
  }
}

// Chunk streaming around camera
function scheduleChunk(cx, cz){
  const key = chunkKey(cx, cz);
  if (chunks.has(key) || scheduled.has(key)) return;
  scheduled.add(key);
  buildQueue.push({ cx, cz });
}

function updateVisibleChunks(){
  const cx = Math.floor(cam.pos[0]/CHUNK);
  const cz = Math.floor(cam.pos[2]/CHUNK);
  for (let dz=-viewDistance.chunks; dz<=viewDistance.chunks; dz++){
    for (let dx=-viewDistance.chunks; dx<=viewDistance.chunks; dx++){
      scheduleChunk(cx+dx, cz+dz);
    }
  }
  // Also refresh minimap for the new center
  updateMinimap();
}

// Reset world cache when seed changes
function resetWorldForSeed(){
  chunks.clear();
  scheduled.clear();
  buildQueue.length = 0;
  edits.clear();
  loadEdits();
  updateVisibleChunks();
}

// Toolbar actions: export/import/clear edits and screenshot
const exportBtn = document.getElementById('exportEdits');
const importBtn = document.getElementById('importEdits');
const clearBtn = document.getElementById('clearEdits');
const shotBtn = document.getElementById('screenshot');
const openInvBtn = document.getElementById('openInventory');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const lodBtn = document.getElementById('lodBtn');
const seedBtn = document.getElementById('seedBtn');

if (exportBtn) exportBtn.onclick = ()=>{
  const obj = {}; for (const [k,v] of edits) obj[k]=v;
  const blob = new Blob([JSON.stringify(obj)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'voxelcraft-edits.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};
if (importBtn) importBtn.onclick = ()=>{
  const inp = document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange = ()=>{
    const file = inp.files && inp.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try {
        const obj = JSON.parse(reader.result);
        edits.clear();
        for (const k in obj){ edits.set(k, obj[k]|0); }
        saveEdits();
        // force rebuild around current view
        chunks.clear(); scheduled.clear(); buildQueue.length=0;
        updateVisibleChunks();
      } catch(err){ alert('Failed to import edits: '+err); }
    };
    reader.readAsText(file);
  };
  inp.click();
};
if (clearBtn) clearBtn.onclick = ()=>{
  if (!confirm('Clear all local edits?')) return;
  edits.clear(); saveEdits();
  chunks.clear(); scheduled.clear(); buildQueue.length=0;
  updateVisibleChunks();
};
if (shotBtn) shotBtn.onclick = ()=>{
  const prev = canvas.toDataURL('image/png');
  const a = document.createElement('a'); a.href = prev; a.download = 'voxelcraft.png'; a.click();
};

// Inventory / survival state
const INV_KEY = 'voxelcraft_inventory_v1';
let survival = false;
const inventory = new Map(); // id -> count
function invLoad(){
  try{
    const raw = localStorage.getItem(INV_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    survival = !!obj.survival;
    if (obj.items){ for (const k in obj.items) inventory.set(+k, obj.items[k]|0); }
  }catch{}
}
function invSave(){
  if (invSave._t) cancelAnimationFrame(invSave._t);
  invSave._t = requestAnimationFrame(()=>{
    const items={}; for (const [k,v] of inventory) items[k]=v;
    try{ localStorage.setItem(INV_KEY, JSON.stringify({ survival, items })); }catch{}
  });
}
function invAdd(id, n=1){
  if (!id) return;
  inventory.set(id, (inventory.get(id)|0)+n);
  invSave();
  if (typeof updateInvUI === 'function') updateInvUI();
  updateHotbarCounts();
}
function invHas(id, n=1){ return (inventory.get(id)|0) >= n; }
function invConsume(id, n=1){
  if (!invHas(id,n)) return false;
  inventory.set(id, (inventory.get(id)|0)-n);
  invSave();
  if (typeof updateInvUI === 'function') updateInvUI();
  updateHotbarCounts();
  return true;
}
function updateHotbarCounts(){
  const slots = hotbar ? hotbar.querySelectorAll('.slot') : [];
  slots.forEach(el=>{
    const id = parseInt(el.dataset.id,10);
    let span = el.querySelector('.count');
    if (!span){ span = document.createElement('div'); span.className='count'; el.appendChild(span); }
    span.textContent = survival ? String(inventory.get(id)||0) : '';
  });
}
invLoad();
if (lodBtn) lodBtn.onclick = ()=>{ farLOD.enabled = !farLOD.enabled; };

// Seed UI wiring
const seedInput = document.getElementById('seedInput');
const applySeedBtn = document.getElementById('applySeed');
const randomSeedBtn = document.getElementById('randomSeed');
if (seedInput){ seedInput.value = worldSeedStr; }
if (applySeedBtn){ applySeedBtn.onclick = ()=>{ setWorldSeed(seedInput.value.trim()||'default'); if (seedInput) seedInput.value=worldSeedStr; }; }
if (randomSeedBtn){ randomSeedBtn.onclick = ()=>{ const s = Math.random().toString(36).slice(2,8); setWorldSeed(s); if (seedInput) seedInput.value=s; }; }

// Inventory modal wiring
const invEl = document.getElementById('inventory');
const invGrid = document.getElementById('invGrid');
const closeInvBtn = document.getElementById('closeInventory');
const survivalToggle = document.getElementById('survivalToggle');
if (openInvBtn) openInvBtn.onclick = ()=> toggleInventory();
if (closeInvBtn) closeInvBtn.onclick = ()=> toggleInventory(false);
if (survivalToggle) survivalToggle.checked = survival;
if (survivalToggle) survivalToggle.onchange = ()=>{ survival = !!survivalToggle.checked; invSave(); updateHotbarCounts(); };
window.addEventListener('keydown', (e)=>{ if (e.key.toLowerCase()==='i'){ toggleInventory(); }});
function toggleInventory(force){ if (!invEl) return; const next = (typeof force==='boolean')? force : (invEl.style.display!=='block'); invEl.style.display = next?'block':'none'; if (next) renderInventory(); }
function renderInventory(){ if (!invGrid) return; invGrid.innerHTML=''; const ids=[GRASS,DIRT,STONE,SAND,WATER,WOOD,LEAVES,SNOW]; ids.forEach((id,i)=>{ const d=document.createElement('div'); d.className='invSlot'; d.dataset.id=''+id; d.textContent=hotbarNames[i]; const c=document.createElement('div'); c.className='count'; c.textContent=String(inventory.get(id)||0); d.appendChild(c); d.onclick=()=>{ selectedBlock=id; updateHotbarActive(); toggleInventory(false); }; invGrid.appendChild(d); }); }

// Keyboard shortcuts: undo/redo
window.addEventListener('keydown', (e)=>{
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key==='z' && !e.shiftKey){ e.preventDefault(); undoEdit(); }
  else if (((e.ctrlKey || e.metaKey) && (key==='y' || (key==='z' && e.shiftKey)))){ e.preventDefault(); redoEdit(); }
});

// Hotbar UI (single implementation)
const hotbar = document.getElementById('hotbar');
const hotbarIds = [GRASS, DIRT, STONE, SAND, WATER, WOOD, LEAVES, SNOW, PORTAL];
const hotbarNames = ['Grass','Dirt','Stone','Sand','Water','Wood','Leaves','Snow','Portal'];
function renderHotbar(){
  if (!hotbar) return;
  hotbar.innerHTML = '';
  for (let i=0;i<hotbarIds.length;i++){
    const el = document.createElement('div'); el.className='slot'; el.dataset.id = ''+hotbarIds[i];
    el.innerHTML = `<span>${i+1}</span>${hotbarNames[i]}`;
    el.onclick = ()=>{ selectedBlock = hotbarIds[i]; updateHotbarActive(); };
    hotbar.appendChild(el);
  }
  updateHotbarActive();
}
function updateHotbarActive(){
  if (!hotbar) return;
  for (const el of hotbar.querySelectorAll('.slot')){
    const id = parseInt(el.dataset.id,10);
    if (id === selectedBlock) el.classList.add('active'); else el.classList.remove('active');
  }
}
// Back-compat wrapper used by earlier code paths (single definition)
function updateHotbar(sel){
  if (typeof sel === 'number') selectedBlock = sel;
  updateHotbarActive();
  if (typeof updateHotbarCounts === 'function') updateHotbarCounts();
}
renderHotbar();

// Toolbar undo/redo buttons already wired above

// --- Multiplayer minimal client using server in run_voxelcraft.py ---
// Delay initialization until after MP is defined
window.addEventListener('load', ()=>{
  // Ensure MP object exists before use
  if (typeof MP === 'undefined') {
    window.MP = { url:null, clientId:Math.random().toString(36).slice(2,10), peers:new Map(), connected:false, lastSend:0 };
  }
  function mpParseUrl(){
    try{
      const u = new URL(location.href);
      const host = u.searchParams.get('host') || u.hostname || '127.0.0.1';
      const port = u.searchParams.get('port') || u.port || '8000';
      MP.url = `${u.protocol}//${host}:${port}`;
      MP.room = (u.searchParams.get('room') || 'default');
      MP.name = (u.searchParams.get('name') || `Player-${MP.clientId.slice(0,4)}`);
    }catch{ MP.url = null; }
  }
  mpParseUrl();
  function mpPost(evt){ if (!MP.url) return; const withRoom = Object.assign({ room: MP.room, name: MP.name }, evt); fetch(`${MP.url}/publish`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(withRoom) }).catch(()=>{}); }
  function mpConnect(){
    if (!MP.url) return;
    try{
      const es = new EventSource(`${MP.url}/events?room=${encodeURIComponent(MP.room||'default')}`);
      es.onopen = ()=>{ MP.connected=true; };
      es.onerror = ()=>{ MP.connected=false; };
      es.onmessage = (ev)=>{
        try{
          const data = JSON.parse(ev.data);
          if (data.type==='pos' && data.clientId){
            if (data.clientId!==MP.clientId){
              MP.peers.set(data.clientId, { x:data.x, y:data.y, z:data.z, color:data.color||[0.3,1,0.3], name:data.name, yaw:data.yaw||0, pitch:data.pitch||0, ts:performance.now() });
            }
          } else if (data.type==='edit' && data.clientId!==MP.clientId){
            const [wx,wy,wz] = data.key.split(',').map(n=>parseInt(n,10));
            setVoxelInternal(wx, wy, wz, data.id);
            edits.set(data.key, data.id);
            saveEdits();
          } else if (data.type==='leave'){
            MP.peers.delete(data.clientId);
          }
        }catch{}
      };
      // Pull initial snapshot to backfill peer list
      fetch(`${MP.url}/snapshot?room=${encodeURIComponent(MP.room||'default')}`).then(r=>r.json()).then(snap=>{
        try{
          if (snap && snap.clients){
            for (const [cid, p] of Object.entries(snap.clients)){
              if (cid!==MP.clientId){ MP.peers.set(cid, { x:p.x, y:p.y, z:p.z, color:p.color||[0.3,1,0.3], name:p.name, yaw:p.yaw||0, pitch:p.pitch||0, ts:performance.now() }); }
            }
          }
        }catch{}
      }).catch(()=>{});
      // announce our seed and initial position so others see us immediately
      mpPost({ type:'seed', seed: worldSeedStr, clientId: MP.clientId, room: MP.room });
      mpPost({ type:'pos', clientId: MP.clientId, x: cam.pos[0], y: cam.pos[1], z: cam.pos[2], color: MP.color, name: MP.name, room: MP.room });
      window.addEventListener('beforeunload', ()=> mpPost({ type:'leave', clientId: MP.clientId }));
    }catch{}
  }
  // Replace the module-scoped mpMaybeSend (module script, not global)
  mpMaybeSend = function(nowMs){
    if (!MP.url) return;
    if (nowMs - MP.lastSend < 120) return;
    MP.lastSend=nowMs;
    mpPost({ type:'pos', clientId:MP.clientId, x:cam.pos[0], y:cam.pos[1], z:cam.pos[2], color:MP.color, name:MP.name, yaw:cam.rot[1], pitch:cam.rot[0] });
  };
  // Broadcast edits by wrapping setVoxel
  const _setVoxel = setVoxel;
  setVoxel = function(wx,wy,wz,id){ const ok = _setVoxel(wx,wy,wz,id); if (ok && MP.url){ mpPost({ type:'edit', clientId:MP.clientId, key:`${wx},${wy},${wz}`, id }); } return ok; };
  mpConnect();
});

function drawPeers(){
  if (!MP.peers || MP.peers.size===0) return;
  gl.useProgram(linesProg);
  gl.uniformMatrix4fv(uProjL, false, lastProj);
  gl.uniformMatrix4fv(uViewL, false, lastView);
  gl.uniform3f(uFogColL, currentSky[0], currentSky[1], currentSky[2]);
  gl.uniform1f(uFogNearL, fogDistance*0.35);
  gl.uniform1f(uFogFarL, fogDistance);
  // Disable main program attributes to avoid WebGL complaining about enabled attribs without buffers
  gl.disableVertexAttribArray(aPos);
  gl.disableVertexAttribArray(aCol);
  gl.disableVertexAttribArray(aNor);
  // Ensure line program attribute location is valid
  if (aPosL < 0) { gl.useProgram(prog); gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aCol); gl.enableVertexAttribArray(aNor); return; }
  for (const [cid,p] of MP.peers.entries()){
    const x=p.x, y=p.y-1.6, z=p.z;
    const s=0.5;
    // Solid colored cube as linesProg TRIANGLES with uniform color
    const tri = new Float32Array([
      // +Z face
      x-s,y-s,z+s,  x+s,y-s,z+s,  x+s,y+s,z+s,
      x-s,y-s,z+s,  x+s,y+s,z+s,  x-s,y+s,z+s,
      // -Z face
      x+s,y-s,z-s,  x-s,y-s,z-s,  x-s,y+s,z-s,
      x+s,y-s,z-s,  x-s,y+s,z-s,  x+s,y+s,z-s,
      // -X face
      x-s,y-s,z-s,  x-s,y-s,z+s,  x-s,y+s,z+s,
      x-s,y-s,z-s,  x-s,y+s,z+s,  x-s,y+s,z-s,
      // +X face
      x+s,y-s,z+s,  x+s,y-s,z-s,  x+s,y+s,z-s,
      x+s,y-s,z+s,  x+s,y+s,z-s,  x+s,y+s,z+s,
      // +Y face
      x-s,y+s,z+s,  x+s,y+s,z+s,  x+s,y+s,z-s,
      x-s,y+s,z+s,  x+s,y+s,z-s,  x-s,y+s,z-s,
      // -Y face
      x-s,y-s,z-s,  x+s,y-s,z-s,  x+s,y-s,z+s,
      x-s,y-s,z-s,  x+s,y-s,z+s,  x-s,y-s,z+s,
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPosL);
    gl.vertexAttribPointer(aPosL, 3, gl.FLOAT, false, 3*4, 0);
    const c = p.color || [0.9,0.4,0.4];
    gl.uniform3f(uColorL, c[0], c[1], c[2]);
    gl.drawArrays(gl.TRIANGLES, 0, tri.length/3);
    gl.disableVertexAttribArray(aPosL);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteBuffer(vbo);
    // Direction cone placed at the player's head, pointing exactly along look vector
    const h = 0.8, r = 0.22; // cone length and base radius
    const segments = 18;
    const yaw = p.yaw || 0;
    const pitch = p.pitch || 0;
    // Head (eye) position
    const head = [x, p.y, z];
    // Forward vector from yaw/pitch (same convention as camera)
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const dir = [sy*cp, -sp, cy*cp];
    // Build orthonormal basis (u,v) perpendicular to dir
    const upRef = Math.abs(dir[1]) > 0.9 ? [1,0,0] : [0,1,0];
    // u = normalize(cross(dir, upRef))
    let ux = dir[1]*upRef[2] - dir[2]*upRef[1];
    let uy = dir[2]*upRef[0] - dir[0]*upRef[2];
    let uz = dir[0]*upRef[1] - dir[1]*upRef[0];
    let ul = Math.hypot(ux,uy,uz) || 1; ux/=ul; uy/=ul; uz/=ul;
    // v = cross(dir, u)
    const vx = dir[1]*uz - dir[2]*uy;
    const vy = dir[2]*ux - dir[0]*uz;
    const vz = dir[0]*uy - dir[1]*ux;
    // Tip of cone in front of head
    const tip = [head[0] + dir[0]*h, head[1] + dir[1]*h, head[2] + dir[2]*h];
    const verts = [];
    for (let i=0;i<segments;i++){
      const a0 = (i*(2*Math.PI/segments));
      const a1 = ((i+1)*(2*Math.PI/segments));
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const b0 = [ head[0] + (ux*c0 + vx*s0)*r, head[1] + (uy*c0 + vy*s0)*r, head[2] + (uz*c0 + vz*s0)*r ];
      const b1 = [ head[0] + (ux*c1 + vx*s1)*r, head[1] + (uy*c1 + vy*s1)*r, head[2] + (uz*c1 + vz*s1)*r ];
      verts.push(...tip, ...b0, ...b1);
    }
    const cone = new Float32Array(verts);
    const vbo2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo2);
    gl.bufferData(gl.ARRAY_BUFFER, cone, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPosL);
    gl.vertexAttribPointer(aPosL, 3, gl.FLOAT, false, 3*4, 0);
    gl.uniform3f(uColorL, Math.min(1,c[0]*1.2), Math.min(1,c[1]*1.2), Math.min(1,c[2]*1.2));
    gl.drawArrays(gl.TRIANGLES, 0, cone.length/3);
    gl.disableVertexAttribArray(aPosL);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteBuffer(vbo2);
  }
  gl.useProgram(prog);
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aCol);
  gl.enableVertexAttribArray(aNor);
}

function updatePlayersOverlay(t){
  const el = document.getElementById('players');
  if (!el || !MP || !MP.peers) return;
  // List local + peers in current room
  const items = [];
  items.push(`${MP.name || 'Me'} (you)`);
  for (const [cid,p] of MP.peers.entries()){
    const nm = p.name || `Player-${cid.slice(0,4)}`;
    items.push(nm);
  }
  el.textContent = items.join('  •  ');
}

function processBuildQueue(budget=3){
  if (buildQueue.length===0) return;
  const cx = Math.floor(cam.pos[0]/CHUNK);
  const cz = Math.floor(cam.pos[2]/CHUNK);
  // sort nearest first this frame
  buildQueue.sort((a,b)=>{
    const da=(a.cx-cx)**2+(a.cz-cz)**2; const db=(b.cx-cx)**2+(b.cz-cz)**2; return da-db;
  });
  for (let i=0;i<budget && buildQueue.length>0;i++){
    const {cx:bx, cz:bz} = buildQueue.shift();
    updateChunk(bx, bz);
    scheduled.delete(chunkKey(bx,bz));
  }
}

function pruneChunks(){
  const cx = Math.floor(cam.pos[0]/CHUNK);
  const cz = Math.floor(cam.pos[2]/CHUNK);
  const maxd = viewDistance.chunks + 2;
  for (const [key, ent] of chunks){
    const dx = ent.cx - cx; const dz = ent.cz - cz;
    if (Math.abs(dx)>maxd || Math.abs(dz)>maxd){
      if (ent.solidVBO) gl.deleteBuffer(ent.solidVBO);
      if (ent.waterVBO) gl.deleteBuffer(ent.waterVBO);
      // drop voxel data to free memory; will regenerate when needed
      ent.voxels = null;
      chunks.delete(key);
    }
  }
}

function draw(){
  gl.clearColor(currentSky[0], currentSky[1], currentSky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Fog color set per-frame from sky in loop
  gl.uniform3f(uFogCol, currentSky[0], currentSky[1], currentSky[2]);
  // Push fog a bit further and soften for smoother far blending
  gl.uniform1f(uFogNear, fogDistance*0.45);
  gl.uniform1f(uFogFar, fogDistance*1.6);

  // Opaque pass
  gl.useProgram(prog);
  gl.uniform1f(uTime, timeSec);
  gl.uniform1f(uIsWater, 0.0);
  for (const ent of chunks.values()){
    if (!ent.solidVBO || ent.solidCount===0) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, ent.solidVBO);
    // stride = 9 floats
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 9*4, 0);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 9*4, 3*4);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 9*4, 6*4);
    gl.uniform1f(uAlpha, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, ent.solidCount);
  }

  // Transparent water pass
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.uniform1f(uIsWater, 1.0);
  for (const ent of chunks.values()){
    if (!ent.waterVBO || ent.waterCount===0) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, ent.waterVBO);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 9*4, 0);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 9*4, 3*4);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 9*4, 6*4);
    gl.uniform1f(uAlpha, 0.6);
    gl.drawArrays(gl.TRIANGLES, 0, ent.waterCount);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.BLEND);

  // Bio overlay pass (translucent)
  if (bio.enabled || nca.enabled){
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(uIsWater, 0.0);
    bio.draw();
    nca.draw();
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // Draw highlight lines if any
  if (highlight && highlight.vbo && highlight.count){
    gl.useProgram(linesProg);
    gl.uniformMatrix4fv(uProjL, false, lastProj);
    gl.uniformMatrix4fv(uViewL, false, lastView);
    gl.uniform3f(uColorL, 1.0, 0.95, 0.2);
    // match fog color to sky (set per-frame in loop)
    gl.uniform3f(uFogColL, currentSky[0], currentSky[1], currentSky[2]);
    gl.uniform1f(uFogNearL, fogDistance*0.35);
    gl.uniform1f(uFogFarL, fogDistance);
    gl.bindBuffer(gl.ARRAY_BUFFER, highlight.vbo);
    gl.enableVertexAttribArray(aPosL);
    gl.vertexAttribPointer(aPosL, 3, gl.FLOAT, false, 3*4, 0);
    gl.drawArrays(gl.LINES, 0, highlight.count);
    // Do not disable attribute arrays here; attribute indices are global across programs.
    // Switch back to main program and ensure its attributes are enabled.
    gl.useProgram(prog);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aCol);
    gl.enableVertexAttribArray(aNor);
  }

  // Far horizon pass: render simplified distant terrain as a height fog dome
  if (farLOD.enabled){
    gl.useProgram(prog);
    gl.uniform1f(uIsWater, 0.0);
    gl.uniform1f(uAlpha, 1.0);
    // Build a coarse ring of quads around the player projected onto height map
    const step = 64; // coarse sampling
    const rad = farLOD.radius;
    const verts = [];
    const px = Math.floor(cam.pos[0]);
    const pz = Math.floor(cam.pos[2]);
    for (let a=0; a<360; a+=3){
      const a0 = (a)*Math.PI/180, a1 = (a+3)*Math.PI/180;
      const r0 = rad, r1 = rad;
      const x0 = px + Math.sin(a0)*r0, z0 = pz + Math.cos(a0)*r0;
      const x1 = px + Math.sin(a1)*r1, z1 = pz + Math.cos(a1)*r1;
      const h0 = heightAt(x0, z0);
      const h1 = heightAt(x1, z1);
      const y0 = h0 + 1;
      const y1 = h1 + 1;
      // color blended to fog for distant appearance
      const c = [currentSky[0]*0.9, currentSky[1]*0.9, currentSky[2]*0.9];
      const n = [0,1,0];
      const innerY = Math.min(y0, y1) - 20; // slight slope inward to avoid gaps
      const ix0 = px + Math.sin(a0)*(rad-64), iz0 = pz + Math.cos(a0)*(rad-64);
      const ix1 = px + Math.sin(a1)*(rad-64), iz1 = pz + Math.cos(a1)*(rad-64);
      const ih0 = heightAt(ix0, iz0)+1;
      const ih1 = heightAt(ix1, iz1)+1;
      const py00=[ix0, ih0, iz0], py01=[ix1, ih1, iz1], py10=[x1, y1, z1], py11=[x0, y0, z0];
      verts.push(
        ...py11, ...c, ...n,  ...py00, ...c, ...n,  ...py01, ...c, ...n,
        ...py11, ...c, ...n,  ...py01, ...c, ...n,  ...py10, ...c, ...n
      );
    }
    const buf = new Float32Array(verts);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 9*4, 0);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 9*4, 3*4);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 9*4, 6*4);
    gl.drawArrays(gl.TRIANGLES, 0, buf.length/9);
    gl.deleteBuffer(vbo);
  }
  // Minimap after world draw
  updateMinimap();
}

// Raycasting via grid DDA to find targeted block and face
function dirFromRot(pitch, yaw){
  const cp=Math.cos(pitch), sp=Math.sin(pitch), cy=Math.cos(yaw), sy=Math.sin(yaw);
  // Forward vector for our camera convention
  return [sy*cp, -sp, cy*cp];
}

function raycast(maxDist=8){
  const dir = dirFromRot(cam.rot[0], cam.rot[1]);
  let x = cam.pos[0], y = cam.pos[1], z = cam.pos[2];
  // step and tDelta according to 3D DDA
  const stepX = dir[0]>0?1:-1, stepY = dir[1]>0?1:-1, stepZ = dir[2]>0?1:-1;
  const tDeltaX = Math.abs(1/(dir[0]||1e-6));
  const tDeltaY = Math.abs(1/(dir[1]||1e-6));
  const tDeltaZ = Math.abs(1/(dir[2]||1e-6));
  let ix = Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
  let tMaxX = ((stepX>0? (ix+1 - x):(x - ix)))*Math.abs(1/(dir[0]||1e-6));
  let tMaxY = ((stepY>0? (iy+1 - y):(y - iy)))*Math.abs(1/(dir[1]||1e-6));
  let tMaxZ = ((stepZ>0? (iz+1 - z):(z - iz)))*Math.abs(1/(dir[2]||1e-6));
  let face = [0,0,0];
  let dist = 0;
  for (let i=0;i<256 && dist<=maxDist;i++){
    const id = getVoxelWorld(ix, iy, iz);
    if (id !== AIR){
      return { hit:true, x:ix, y:iy, z:iz, face };
    }
    if (tMaxX < tMaxY){
      if (tMaxX < tMaxZ){ ix += stepX; dist = tMaxX; tMaxX += tDeltaX; face=[-stepX,0,0]; }
      else { iz += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; face=[0,0,-stepZ]; }
    } else {
      if (tMaxY < tMaxZ){ iy += stepY; dist = tMaxY; tMaxY += tDeltaY; face=[0,-stepY,0]; }
      else { iz += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; face=[0,0,-stepZ]; }
    }
  }
  return { hit:false };
}

// Simple paired portal system: place two portals and teleport between them on contact
let portalA = null, portalB = null;
function placePortal(wx, wy, wz){
  setVoxel(wx, wy, wz, PORTAL);
  if (!portalA) portalA = {x:wx,y:wy,z:wz};
  else if (!portalB && (wx!==portalA.x || wy!==portalA.y || wz!==portalA.z)) portalB = {x:wx,y:wy,z:wz};
  else { portalA = portalB; portalB = {x:wx,y:wy,z:wz}; }
}

function tryTeleport(){
  if (!portalA || !portalB) return;
  const footX = cam.pos[0];
  const footY = cam.pos[1] - 1.6; // feet
  const footZ = cam.pos[2];
  function near(p){ return Math.abs(footX-(p.x+0.5))<0.5 && Math.abs(footY-(p.y+0.5))<1.0 && Math.abs(footZ-(p.z+0.5))<0.5; }
  let target=null;
  if (near(portalA)) target = portalB; else if (near(portalB)) target = portalA;
  if (target){
    cam.pos[0] = target.x + 0.5;
    cam.pos[1] = target.y + 1.6 + 0.01; // avoid re-trigger
    cam.pos[2] = target.z + 0.5;
  }
}

function placeOrRemove(type){
  const res = raycast(8);
  if (!res.hit) return;
  if (type==='remove'){
    const prev = getVoxelWorld(res.x, res.y, res.z);
    setVoxel(res.x, res.y, res.z, AIR);
    // If removing a portal, forget it if stored
    if (prev===PORTAL){
      if (portalA && portalA.x===res.x && portalA.y===res.y && portalA.z===res.z) portalA=null;
      if (portalB && portalB.x===res.x && portalB.y===res.y && portalB.z===res.z) portalB=null;
    }
  } else if (type==='place'){
    const wx = res.x + res.face[0];
    const wy = res.y + res.face[1];
    const wz = res.z + res.face[2];
    if (wy>=0 && wy<WORLD_HEIGHT){
      if (selectedBlock===PORTAL){ placePortal(wx, wy, wz); }
      else { setVoxel(wx, wy, wz, selectedBlock); }
    }
  }
}

canvas.addEventListener('mousedown', (e)=>{
  if (document.pointerLockElement!==canvas) return;
  if (e.button===0) placeOrRemove('remove');
  if (e.button===2) placeOrRemove('place');
});

// Middle click to pick block; wheel selects next/prev block id
canvas.addEventListener('mousedown', (e)=>{
  if (document.pointerLockElement!==canvas && e.button!==1) return;
  if (e.button===1){
    const hit = raycast(8);
    if (hit.hit){
      const id = getVoxelWorld(hit.x, hit.y, hit.z);
      if (id!==AIR) { selectedBlock = id; updateHotbarActive(); }
    }
  }
});

// Undo/Redo shortcuts: Ctrl/Cmd+Z to undo; Ctrl+Y or Shift+Cmd+Z to redo
window.addEventListener('keydown', (e)=>{
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key==='z' && !e.shiftKey){ e.preventDefault(); undoEdit(); }
  else if ((e.ctrlKey && key==='y') || (e.metaKey && e.shiftKey && key==='z')){ e.preventDefault(); redoEdit(); }
});

let last=performance.now();
let timeSec = 0;
let timePaused = false;
let timeSpeed = 1.0; // 1.0 == normal, can be sped up/down
let lastProj = mat4_identity();
let lastView = mat4_identity();
let highlight = null;
// Fallback no-op; multiplayer init will overwrite this at runtime
let mpMaybeSend = function(){/* noop until MP connects */};
// Multiplayer (SSE-like) client state (may be pre-created earlier)
if (typeof MP === 'undefined') {
  window.MP = { url:null, clientId:Math.random().toString(36).slice(2,10), peers:new Map(), connected:false, lastSend:0 };
}
function loop(t){
  const dt=Math.min(0.05, (t-last)/1000); last=t;
  if (!timePaused) timeSec += dt * timeSpeed;
  move(dt);
  bio.update(dt);
  nca.update(dt);
  mpMaybeSend(t);
  tryTeleport();
  updateMinimap();
  updateMinimap();
  updateViewProj();
  updateVisibleChunks();
  processBuildQueue(4);
  if ((t|0)%1000<16) pruneChunks();

  // Update lighting (day-night cycle)
  // cycle ~60 seconds per full day
  const theta = (timeSec / 60) * Math.PI * 2;
  const sunDir = [0.3, Math.sin(theta), Math.cos(theta)];
  const len = Math.hypot(sunDir[0], sunDir[1], sunDir[2]) || 1;
  const Lx = sunDir[0]/len, Ly = sunDir[1]/len, Lz = sunDir[2]/len;
  // Ambient and light color vary by elevation
  const elev = Math.max(0.0, Ly);
  const ambient = 0.25 + 0.25 * elev; // 0.25..0.5
  const lightColor = [1.0, 0.95 - 0.3*(1.0-elev), 0.85 - 0.5*(1.0-elev)];

  // Sky/fog color based on time (blend day and night)
  const daySky=[0.53,0.69,1.0], nightSky=[0.02,0.04,0.08];
  const skyMix = Math.max(0.0, Math.min(1.0, elev*1.2));
  const sky = [
    nightSky[0]*(1-skyMix)+daySky[0]*skyMix,
    nightSky[1]*(1-skyMix)+daySky[1]*skyMix,
    nightSky[2]*(1-skyMix)+daySky[2]*skyMix,
  ];
  currentSky = sky;
  gl.clearColor(currentSky[0], currentSky[1], currentSky[2], 1);
  gl.useProgram(prog);
  gl.uniform3f(uLightDir, Lx, Ly, Lz);
  gl.uniform3f(uLightColor, lightColor[0], lightColor[1], lightColor[2]);
  gl.uniform3f(uAmbient, ambient, ambient, ambient);
  gl.uniform3f(uFogCol, currentSky[0], currentSky[1], currentSky[2]);

  draw();
  const dbg = document.getElementById('debug');
  const blockNames = ['AIR','GRASS','DIRT','STONE','SAND'];
  // FPS calc
  fpsCounter.frame(t);
  const tod = ((theta%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  const hour = (tod/(2*Math.PI))*24; // rough mapping
  const h = Math.floor(hour), m = Math.floor((hour-h)*60);
  if (dbg) {
    dbg.textContent = `pos ${cam.pos.map(v=>v.toFixed(1)).join(', ')} chunks ${chunks.size} fog ${fogDistance} sel ${blockNames[selectedBlock]}  fps ${fpsCounter.fps.toFixed(0)}  time ${(''+h).padStart(2,'0')}:${(''+m).padStart(2,'0')} x${timeSpeed}${timePaused?' (paused)':''}${cam.walk?' WALK':' FLY'}  bio:${bio.enabled?'on':'off'}${bio.running?'':'(paused)'} S=${bio.states} T=${bio.threshold}  nca:${nca.enabled?'on':'off'}${nca.running?'':'(paused)'} C=${nca.C}`;
  }
  // Update hotbar UI
  updateHotbar(selectedBlock);
  // Peers
  drawPeers();
  // Update players overlay, if visible
  updatePlayersOverlay(t);
  requestAnimationFrame(loop);
}
updateVisibleChunks();
requestAnimationFrame(loop);

// Keep last matrices for lines pass
function captureViewProj(){
  const aspect = canvas.width / canvas.height;
  lastProj = mat4_perspective((fovDeg*Math.PI/180), aspect, 0.1, 2000);
  const cp=Math.cos(cam.rot[0]), sp=Math.sin(cam.rot[0]);
  const cy=Math.cos(cam.rot[1]), sy=Math.sin(cam.rot[1]);
  const fwd = [sy*cp, -sp, cy*cp];
  const center = [cam.pos[0]+fwd[0], cam.pos[1]+fwd[1], cam.pos[2]+fwd[2]];
  lastView = mat4_lookAt(cam.pos, center, [0,1,0]);
}
const _oldUpdateViewProj = updateViewProj;
updateViewProj = function(){ _oldUpdateViewProj(); captureViewProj();
  // Also update highlight buffer based on current ray
  const hit = raycast(8);
  if (hit.hit){
    const hx=hit.x, hy=hit.y, hz=hit.z;
    if (!highlight || highlight.x!==hx || highlight.y!==hy || highlight.z!==hz){
      const lines = buildWireCube(hx, hy, hz);
      if (!highlight) highlight = {};
      if (highlight.vbo) gl.deleteBuffer(highlight.vbo);
      highlight.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, highlight.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
      highlight.count = lines.length/3;
      highlight.x=hx; highlight.y=hy; highlight.z=hz;
    }
  } else {
    if (highlight && highlight.vbo){ gl.deleteBuffer(highlight.vbo); }
    highlight = null;
  }
};

function buildWireCube(x,y,z){
  const p = [
    [x,y,z],[x+1,y,z],[x+1,y,z+1],[x,y,z+1], // bottom square
    [x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1] // top square
  ];
  const E = [
    [0,1],[1,2],[2,3],[3,0], // bottom edges
    [4,5],[5,6],[6,7],[7,4], // top edges
    [0,4],[1,5],[2,6],[3,7]  // vertical edges
  ];
  const out = [];
  for (const [a,b] of E){ out.push(...p[a], ...p[b]); }
  return out;
}

// Simple FPS counter with exponential smoothing
// Minimap rendering (top-down height/biome map around player)
function updateMinimap(){
  if (!minimapCtx || !minimapVisible) return;
  const W = minimapCanvas.width, H = minimapCanvas.height;
  const centerX = Math.floor(cam.pos[0]);
  const centerZ = Math.floor(cam.pos[2]);
  const half = 40; // covers ~80x80 area
  const scale = Math.min(W, H) / (half*2);
  const img = minimapCtx.createImageData(W, H);
  let p=0;
  for (let y=0; y<H; y++){
    for (let x=0; x<W; x++){
      const wx = centerX + Math.floor((x - W/2)/scale);
      const wz = centerZ + Math.floor((y - H/2)/scale);
      const hh = heightAt(wx, wz);
      let r=90,g=140,b=200; // sky default
      if (hh<12) { r=60; g=110; b=200; }
      else if (hh<18) { r=219; g=211; b=160; }
      else if (hh>36) { r=235; g=240; b=245; }
      else { r=95; g=159; b=53; }
      img.data[p++] = r; img.data[p++] = g; img.data[p++] = b; img.data[p++] = 255;
    }
  }
  minimapCtx.putImageData(img, 0, 0);
  // Draw player marker
  minimapCtx.fillStyle = '#fff';
  minimapCtx.beginPath();
  minimapCtx.arc(W/2, H/2, 2.5, 0, Math.PI*2);
  minimapCtx.fill();
}

const fpsCounter = (()=>{
  let fps=60, lastT=0;
  return {
    get fps(){ return fps; },
    frame(t){ if (!lastT) { lastT=t; return; } const dt=(t-lastT)/1000; lastT=t; const inst=1/Math.max(1e-6,dt); fps = fps*0.9 + inst*0.1; }
  };
})();

// drawMinimap is implemented earlier and called from updateVisibleChunks/draw

// Time controls: [ and ] to change speed, T to toggle pause, ; and ' to set noon/midnight
window.addEventListener('keydown', (e)=>{
  if (e.key === '[') timeSpeed = Math.max(0.1, Math.round((timeSpeed-0.1)*10)/10);
  if (e.key === ']') timeSpeed = Math.min(10, Math.round((timeSpeed+0.1)*10)/10);
  if (e.key.toLowerCase() === 't') timePaused = !timePaused;
  if (e.key === ';') { const thetaNoon = Math.PI/2; timeSec = (thetaNoon/(Math.PI*2))*60; }
  if (e.key === "'") { const thetaMid = 3*Math.PI/2; timeSec = (thetaMid/(Math.PI*2))*60; }
  // Undo/Redo shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undoEdit(); }
  if (((e.ctrlKey && e.key.toLowerCase()==='y')) || (e.metaKey && e.shiftKey && e.key.toLowerCase()==='z')){ e.preventDefault(); redoEdit(); }
});

// Remove older duplicate hotbar implementation; unified hotbar is defined earlier.

// Remove duplicate toolbar handlers (export/import/clear/screenshot) defined earlier.
