// Minimal voxel engine with long horizon fog and color jitter per block
// No external deps; WebGL1 for broad compatibility

const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl', { antialias: false });
if (!gl) alert('WebGL not supported');

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

// Simple RNG for per-block color jitter (deterministic by block position)
function hash3i(x, y, z) {
  let h = x * 374761393 + y * 668265263 ^ z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Matrices
function mat4_perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}
function mat4_identity() { const m = new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; }
function mat4_mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++){for(let j=0;j<4;j++){o[i*4+j]=a[i*4+0]*b[0*4+j]+a[i*4+1]*b[1*4+j]+a[i*4+2]*b[2*4+j]+a[i*4+3]*b[3*4+j];}}return o;}
function mat4_translate(m, v){const [x,y,z]=v;const o=m.slice(0);o[12]+=x*o[0]+y*o[4]+z*o[8];o[13]+=x*o[1]+y*o[5]+z*o[9];o[14]+=x*o[2]+y*o[6]+z*o[10];o[15]+=x*o[3]+y*o[7]+z*o[11];return o;}
function mat4_fromRot(rot){const [pitch,yaw]=rot;const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);const m=mat4_identity();m[0]=cy;m[2]=-sy;m[5]=cp;m[6]=sp*cy;m[8]=sy;m[10]=cy*cp;m[9]=-sp;return m;}

// Camera and controls
const cam = { pos:[0, 16, 0], rot:[-0.2, 0.6] };
let key = {}; window.addEventListener('keydown', e=> key[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e=> key[e.key.toLowerCase()] = false);
const lockBtn = document.getElementById('lock');
lockBtn.addEventListener('click', ()=> canvas.requestPointerLock());
document.addEventListener('pointerlockchange', ()=> { if (document.pointerLockElement===canvas) lockBtn.textContent='Pointer Locked'; else lockBtn.textContent='Click to Lock Pointer'; });
document.addEventListener('mousemove', e=>{ if (document.pointerLockElement===canvas){ cam.rot[1] -= e.movementX*0.0025; cam.rot[0] -= e.movementY*0.0025; cam.rot[0]=Math.max(-Math.PI/2+0.001, Math.min(Math.PI/2-0.001, cam.rot[0])); }});

// World/chunks
const CHUNK = 32; // larger chunk to reduce overhead
const WORLD_HEIGHT = 64;
const viewDistance = { chunks: 8 }; // long horizon; tune if needed
let fogDistance = 600; // can be tweaked with +/-
window.addEventListener('keydown', (e)=>{
  if (e.key === '+') fogDistance = Math.min(2000, fogDistance + 50);
  if (e.key === '-') fogDistance = Math.max(100, fogDistance - 50);
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

// Block IDs and base colors
const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, WATER=5;
const BASE_COLOR = {
  [GRASS]: [95, 159, 53],
  [DIRT]: [134, 96, 67],
  [STONE]: [112, 112, 112],
  [SAND]: [219, 211, 160],
  [WATER]: [64, 96, 255],
};

// Chunk storage and meshing
const chunks = new Map(); // key "cx,cz" -> {voxels, vbo, count}
const scheduled = new Set();
const buildQueue = []; // [{cx,cz}]

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
          if (hh<18) id = SAND;
          else if (y===hh) id = GRASS;
          else if (y>hh-3) id = DIRT;
          else id = STONE;
        } else if (y<12 && y>hh) {
          id = WATER;
        }
        voxels[(y*CHUNK + z)*CHUNK + x] = id;
      }
    }
  }
  return voxels;
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
  const verts=[]; // position (3) + color (3) + dist (1)
  for (let x=0;x<CHUNK;x++){
    for (let y=0;y<WORLD_HEIGHT;y++){
      for (let z=0;z<CHUNK;z++){
        const id = getVoxel(voxels, x,y,z);
        if (id===AIR) continue;
        const base = BASE_COLOR[id];
        const wx = cx*CHUNK + x, wy=y, wz = cz*CHUNK + z;
        const col = jitterColor(base, wx, wy, wz);
        // Skip rendering blocks far below water if water on top to reduce overdraw
        if (id!==WATER && wy<12 && getVoxel(voxels, x,wy+1,z)===WATER) continue;
        for (const f of faces){
          const nx=x+f.dir[0], ny=y+f.dir[1], nz=z+f.dir[2];
          const neighbor = getVoxel(voxels, nx,ny,nz);
          if (neighbor!==AIR && !(id===WATER && neighbor===WATER)) continue;
          // Create two tris
          const v=f.verts;
          const p0=[wx+v[0][0], wy+v[0][1], wz+v[0][2]];
          const p1=[wx+v[1][0], wy+v[1][1], wz+v[1][2]];
          const p2=[wx+v[2][0], wy+v[2][1], wz+v[2][2]];
          const p3=[wx+v[3][0], wy+v[3][1], wz+v[3][2]];
          // Slight shade by normal
          const shade = 0.85 + 0.15*Math.max(0, f.norm[1]);
          const c=[col[0]*shade, col[1]*shade, col[2]*shade];
          verts.push(...p0, ...c, 0,  ...p1, ...c, 0,  ...p2, ...c, 0);
          verts.push(...p0, ...c, 0,  ...p2, ...c, 0,  ...p3, ...c, 0);
        }
      }
    }
  }
  const vbuf = new Float32Array(verts);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vbuf, gl.STATIC_DRAW);
  return { vbo, count: vbuf.length / 7 };
}

function updateChunk(cx, cz){
  const key = chunkKey(cx, cz);
  let ent = chunks.get(key);
  if (!ent){ ent = {}; chunks.set(key, ent); }
  if (!ent.voxels){ ent.voxels = genChunk(cx, cz); }
  if (ent.vbo) { gl.deleteBuffer(ent.vbo); }
  const mesh = buildMesh(cx, cz, ent.voxels);
  ent.vbo = mesh.vbo; ent.count = mesh.count; ent.cx=cx; ent.cz=cz;
}

// Shader program with fog
const vs = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aDummy;
uniform mat4 uProj, uView; varying vec3 vCol; varying float vDist;
void main(){
  vec4 wp = uView * vec4(aPos, 1.0);
  vDist = length(wp.xyz);
  vCol = aCol;
  gl_Position = uProj * wp;
}`;
const fs = `
precision mediump float; varying vec3 vCol; varying float vDist;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
void main(){
  float f = smoothstep(uFogNear, uFogFar, vDist);
  vec3 col = mix(vCol, uFogCol, f);
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(type, src){ const s=gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
function program(vsSrc, fsSrc){ const p=gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc)); gl.linkProgram(p); if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p; }
const prog = program(vs, fs);
gl.useProgram(prog);
const aPos = gl.getAttribLocation(prog, 'aPos');
const aCol = gl.getAttribLocation(prog, 'aCol');
const aDummy = gl.getAttribLocation(prog, 'aDummy');
const uProj = gl.getUniformLocation(prog, 'uProj');
const uView = gl.getUniformLocation(prog, 'uView');
const uFogCol = gl.getUniformLocation(prog, 'uFogCol');
const uFogNear = gl.getUniformLocation(prog, 'uFogNear');
const uFogFar = gl.getUniformLocation(prog, 'uFogFar');

gl.enableVertexAttribArray(aPos);
gl.enableVertexAttribArray(aCol);
gl.enableVertexAttribArray(aDummy);

// Render loop
function updateViewProj(){
  const aspect = canvas.width / canvas.height;
  const proj = mat4_perspective(Math.PI/3, aspect, 0.1, 2000);
  // Build view matrix from camera rot/pos (inverse transform)
  const rot = mat4_fromRot(cam.rot);
  // Inverse of rotation matrix is transpose for orthonormal, so transpose rot
  const rT = new Float32Array(16);
  rT[0]=rot[0]; rT[1]=rot[4]; rT[2]=rot[8];  rT[3]=0;
  rT[4]=rot[1]; rT[5]=rot[5]; rT[6]=rot[9];  rT[7]=0;
  rT[8]=rot[2]; rT[9]=rot[6]; rT[10]=rot[10]; rT[11]=0;
  rT[12]=0; rT[13]=0; rT[14]=0; rT[15]=1;
  const trans = mat4_identity(); trans[12]=-cam.pos[0]; trans[13]=-cam.pos[1]; trans[14]=-cam.pos[2];
  const view = mat4_mul(rT, trans);
  gl.uniformMatrix4fv(uProj, false, proj);
  gl.uniformMatrix4fv(uView, false, view);
}

// Movement
function move(dt){
  const speed = key['shift'] ? 40 : 18;
  const forward = [Math.sin(cam.rot[1]), 0, Math.cos(cam.rot[1])];
  const right = [Math.cos(cam.rot[1]), 0,-Math.sin(cam.rot[1])];
  if (key['w']) { cam.pos[0]+=forward[0]*dt*speed; cam.pos[2]+=forward[2]*dt*speed; }
  if (key['s']) { cam.pos[0]-=forward[0]*dt*speed; cam.pos[2]-=forward[2]*dt*speed; }
  if (key['a']) { cam.pos[0]-=right[0]*dt*speed; cam.pos[2]-=right[2]*dt*speed; }
  if (key['d']) { cam.pos[0]+=right[0]*dt*speed; cam.pos[2]+=right[2]*dt*speed; }
  if (key[' ']) cam.pos[1]+=dt*speed; // Space
  if (key['shift']) cam.pos[1]-=dt*speed*0.5; // descend while boosting
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
      if (ent.vbo) gl.deleteBuffer(ent.vbo);
      chunks.delete(key);
    }
  }
}

function draw(){
  gl.clearColor(0.53, 0.69, 1.0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  gl.uniform3f(uFogCol, 0.53, 0.69, 1.0);
  gl.uniform1f(uFogNear, fogDistance*0.35);
  gl.uniform1f(uFogFar, fogDistance);

  for (const ent of chunks.values()){
    if (!ent.vbo) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, ent.vbo);
    // stride = 7 floats
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 7*4, 0);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 7*4, 3*4);
    gl.vertexAttribPointer(aDummy, 1, gl.FLOAT, false, 7*4, 6*4);
    gl.drawArrays(gl.TRIANGLES, 0, ent.count);
  }
}

let last=performance.now();
function loop(t){
  const dt=Math.min(0.05, (t-last)/1000); last=t;
  move(dt);
  updateViewProj();
  updateVisibleChunks();
  processBuildQueue(4);
  if ((t|0)%1000<16) pruneChunks();
  draw();
  const dbg = document.getElementById('debug');
  dbg.textContent = `pos ${cam.pos.map(v=>v.toFixed(1)).join(', ')} chunks ${chunks.size} fog ${fogDistance}`;
  requestAnimationFrame(loop);
}
updateVisibleChunks();
requestAnimationFrame(loop);
