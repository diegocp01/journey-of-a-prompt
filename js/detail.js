/* Extra detail for three places: the sea floor, the inside of the data center, and the inside of the AI.
   Each function takes the shared helpers from main.js (h) and returns a function to call every frame, or nothing. */
import * as THREE from 'three';
import {createOceanHabitat} from './seafloor.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
/* many copies of one shape: list is [{x, y, z, sx, sy, sz, rx, ry, rz}] */
function copies(parent, geo, mat, list, {cast = false} = {}) {
  const m = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D();
  list.forEach((p, i) => {
    d.position.set(p.x || 0, p.y || 0, p.z || 0); d.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    d.scale.set(p.sx ?? p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
  });
  m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; parent.add(m);
  return m;
}

/* ====================================================================== the sea floor */
export function seaDetail(h) {
  const {scene, model, scatter, seaY, bedHeight, seaCurves, seaRepeaterStops, M, GLOW} = h, R = rng(31);
  const depth = x => -seaY(x);
  /* seagrass, but only in the shallow water near each shore: nothing green grows 13,000 feet down */
  const blade = new THREE.PlaneGeometry(.1, 1, 1, 6); blade.translate(0, .5, 0);
  const grassMat = new THREE.MeshStandardMaterial({color: 0x3f9a5c, roughness: .8, side: THREE.DoubleSide, envMapIntensity: .1, emissive: 0x1a6a3e, emissiveIntensity: .7});
  const sway = {value: 0};
  grassMat.onBeforeCompile = sh => {
    sh.uniforms.uT = sway;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;
        transformed.x += sin(uT * 1.6 + ph + position.y * 2.2) * .22 * position.y * position.y;`);
  };
  const grass = [];
  while (grass.length < 700) {
    const x = R() < .5 ? 131 + R() * 13 : 236 + R() * 13, z = (R() - .5) * 22;
    if (depth(x) > 6.5 || Math.abs(z) < .5) continue;
    grass.push({x, y: bedHeight(x,z) - .02, z, ry: R() * 6.28, sx: .8 + R() * .8, sy: .5 + R() * 1.5, sz: 1});
  }
  copies(scene, blade, grassMat, grass);
  /* real scanned rocks and shells (Poly Haven) near the cables */
  const close = (n, lo, hi, s0, s1) => Array.from({length:n}, () => {
    const x=lo+R()*(hi-lo), z=(R()<.5?-1:1)*(1.65+R()*4.8);
    return {x,z,y:bedHeight(x,z)-.06,rot:R()*6.28,s:s0+R()*(s1-s0)};
  });
  model('rock_09', m => scatter(scene, m, close(14, 140, 242, .6, 1.7), {cast: false}));
  model('rock_07', m => scatter(scene, m, close(10, 140, 242, .5, 1.4), {cast: false}));
  model('lambis_shell', m => scatter(scene, m, [...close(4, 131, 146, 1.2, 2.2), ...close(4, 234, 249, 1.2, 2.2)].map(p => ({...p, y: p.y + .1})), {cast: false}));
  /* repeaters: the thick metal sleeves along a real sea cable that boost the light every 50 miles or so */
  const body = new THREE.CylinderGeometry(.3, .3, 1.7, 18), cone = new THREE.CylinderGeometry(.16, .3, .55, 18), band = new THREE.TorusGeometry(.31, .035, 8, 20);
  const steel = M(0x4c595a, {m: .8, r: .35, env: .9}), bands = M(0x9aa8a6, {m: .9, r: .3, env: 1});
  const up = V(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  const sleeves = [], ends = [], rings = [];
  seaCurves.forEach((c, ci) => seaRepeaterStops.forEach(u => {
    const p = c.getPointAt(u + ci * .03 - .03), t = c.getTangentAt(u + ci * .03 - .03);
    q.setFromUnitVectors(up, t); e.setFromQuaternion(q);
    const at = (d, list, flip) => { const o = p.clone().addScaledVector(t, d); if (flip) { const q2 = new THREE.Quaternion().setFromUnitVectors(up, t.clone().negate()), e2 = new THREE.Euler().setFromQuaternion(q2); list.push({x: o.x, y: o.y, z: o.z, rx: e2.x, ry: e2.y, rz: e2.z}); } else list.push({x: o.x, y: o.y, z: o.z, rx: e.x, ry: e.y, rz: e.z}); };
    at(0, sleeves); at(1.12, ends); at(-1.12, ends, true);
    [-.6, 0, .6].forEach(d => { const o = p.clone().addScaledVector(t, d), qr = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)), er = new THREE.Euler().setFromQuaternion(qr); rings.push({x: o.x, y: o.y, z: o.z, rx: er.x, ry: er.y, rz: er.z}); });
  }));
  copies(scene, body, steel, sleeves); copies(scene, cone, steel, ends); copies(scene, band, bands, rings);
  const habitatTick=createOceanHabitat(scene,R,copies,GLOW);
  return (t,cameraX)=>{sway.value=t;habitatTick(t,cameraX);};
}

/* ====================================================================== inside the data center */
export function hallDetail(h) {
  const {scene, model, M, E, bx, cyl, canvasTex} = h;
  const X0 = 322.1, X1 = 396.4, LEN = X1 - X0, XC = (X0 + X1) / 2, rowZ = r => -21.4 + 3.2 * r;
  const tray = M(0x2b303b, {m: .8, r: .4, env: .8}), duct = M(0xa9b1bd, {m: .85, r: .32, env: 1.1}), red = M(0xb5382c, {m: .4, r: .5, env: .5});
  /* raised floor: the seams between tiles, and grilles in the aisles where the cold air comes up */
  const seams = canvasTex(64, 64, (g, w, hh) => { g.clearRect(0, 0, w, hh); g.strokeStyle = 'rgba(150,170,210,.2)'; g.lineWidth = 2; g.strokeRect(0, 0, w, hh); });
  seams.redraw(); seams.tex.wrapS = seams.tex.wrapT = THREE.RepeatWrapping; seams.tex.repeat.set(82 / .6, 50 / .6);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(82, 50), new THREE.MeshBasicMaterial({map: seams.tex, transparent: true, depthWrite: false}));
  grid.rotation.x = -Math.PI / 2; grid.position.set(359, .012, 0); scene.add(grid);
  const vent = canvasTex(64, 64, (g, w, hh) => { g.fillStyle = '#10141d'; g.fillRect(0, 0, w, hh); g.fillStyle = '#39445a'; for (let y = 6; y < hh; y += 8) for (let x = 6; x < w; x += 8) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } g.strokeStyle = '#4b5873'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, hh - 2); });
  vent.redraw();
  const vg = new THREE.PlaneGeometry(.58, .58); vg.rotateX(-Math.PI / 2);
  const vents = [];
  for (let k = 0; k < 14; k += 2) for (let x = X0 + 2; x < X1; x += 2.4) vents.push({x, y: .016, z: rowZ(k) + 1.6});
  copies(scene, vg, new THREE.MeshStandardMaterial({map: vent.tex, roughness: .5, metalness: .6, envMapIntensity: .6}), vents);
  /* cable trays above every row of racks, carrying the yellow fibre and the power cables */
  const rows = Array.from({length: 15}, (_, r) => rowZ(r));
  copies(scene, new THREE.BoxGeometry(LEN, .045, .56), tray, rows.map(z => ({x: XC, y: 2.52, z})));
  copies(scene, new THREE.BoxGeometry(LEN, .12, .03), tray, rows.flatMap(z => [{x: XC, y: 2.58, z: z - .28}, {x: XC, y: 2.58, z: z + .28}]));
  const run = new THREE.CylinderGeometry(.038, .038, LEN, 8); run.rotateZ(Math.PI / 2);
  [[0xf2c230, -.17], [0xf2c230, -.07], [0x2fb6d6, .04], [0xe5772e, .15]].forEach(([c, dz]) =>
    copies(scene, run, M(c, {r: .55, env: .3}), rows.map(z => ({x: XC, y: 2.585, z: z + dz}))));
  /* trays that cross the hall, tying the rows together */
  const crossX = [330, 345, 360, 375, 390];
  copies(scene, new THREE.BoxGeometry(.5, .045, 46), tray, crossX.map(x => ({x, y: 3.05, z: 0})));
  const cross = new THREE.CylinderGeometry(.045, .045, 46, 8); cross.rotateX(Math.PI / 2);
  copies(scene, cross, M(0xf2c230, {r: .55, env: .3}), crossX.flatMap(x => [{x: x - .12, y: 3.12, z: 0}, {x: x + .1, y: 3.12, z: 0}]));
  copies(scene, new THREE.CylinderGeometry(.012, .012, 1.9, 5), tray, crossX.flatMap(x => [-18, -9, 0, 9, 18].flatMap(z => [{x: x - .22, y: 4, z}, {x: x + .22, y: 4, z}])));
  /* air ducts and red sprinkler pipes under the ceiling */
  const pipe = new THREE.CylinderGeometry(1, 1, LEN, 20); pipe.rotateZ(Math.PI / 2);
  copies(scene, pipe, duct, [-12.8, 0, 12.8].map(z => ({x: XC, y: 4.32, z, sx: 1, sy: .4, sz: .4})));
  copies(scene, new THREE.BoxGeometry(.9, .14, .9), duct, [-12.8, 0, 12.8].flatMap(z => Array.from({length: 12}, (_, i) => ({x: X0 + 4 + i * 6.2, y: 3.86, z}))));
  copies(scene, pipe, red, Array.from({length: 14}, (_, k) => ({x: XC, y: 4.72, z: rowZ(k) + 1.6 + .45, sx: 1, sy: .035, sz: .035})));
  copies(scene, new THREE.CylinderGeometry(.03, .05, .12, 8), red, Array.from({length: 14}, (_, k) => k).flatMap(k => Array.from({length: 10}, (_, i) => ({x: X0 + 3 + i * 7.6, y: 4.64, z: rowZ(k) + 2.05}))));
  /* a lit name plate on the end of every row */
  rows.forEach((z, r) => {
    const t = canvasTex(128, 64, (g, w, hh) => { g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#35d6ff'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, hh - 6); g.fillStyle = '#9ff0ff'; g.font = '800 40px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A' + String(r + 1).padStart(2, '0'), w / 2, hh / 2 + 2); });
    t.redraw();
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.5, .25), new THREE.MeshBasicMaterial({map: t.tex, toneMapped: false}));
    p.rotation.y = -Math.PI / 2; p.position.set(X0 - .01, 2.02, z); scene.add(p);
  });
  /* the lobby: status screens on both walls, a badge reader by the arch, fire extinguishers */
  const dash = canvasTex(256, 144, (g, w, hh) => {
    g.fillStyle = '#070b16'; g.fillRect(0, 0, w, hh);
    g.fillStyle = '#35d6ff'; for (let i = 0; i < 22; i++) { const v = 14 + 60 * Math.abs(Math.sin(i * 1.7)); g.fillRect(14 + i * 6, 96 - v, 4, v); }
    g.strokeStyle = '#4ade80'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 20; i++) g.lineTo(160 + i * 4.3, 62 - 26 * Math.sin(i * .7) * Math.cos(i * .23)); g.stroke();
    g.fillStyle = '#ffb545'; g.beginPath(); g.arc(205, 108, 16, -1.57, 2.6); g.lineTo(205, 108); g.fill();
    g.fillStyle = '#263454'; for (let i = 0; i < 3; i++) g.fillRect(14, 108 + i * 10, 120, 5);
  });
  dash.redraw();
  [[-5.93, 0], [5.93, Math.PI]].forEach(([z, ry]) => [305.5, 312.2].forEach(x => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({map: dash.tex, toneMapped: false, color: 0xbfc8d8}));
    p.position.set(x, 2.5, z); p.rotation.y = ry; scene.add(p);
    bx(x - 1.2, x + 1.2, 1.8, 3.2, z < 0 ? z - .04 : z + .02, z < 0 ? z - .02 : z + .04, tray, {cast: false});
  }));
  bx(309.3, 309.46, 0, 1.15, 1.72, 1.9, tray); bx(309.28, 309.3, .85, 1.1, 1.75, 1.87, E(0x4ade80, 2.2), {cast: false});
  model('korean_fire_extinguisher_01', m => {
    [[303.2, -5.7, 0], [316.4, 5.7, Math.PI], [320.6, -1.3, 1.57], [320.6, 4.5, 1.57]].forEach(([x, z, r]) => { const c = m.clone(); c.position.set(x, 0, z); c.rotation.y = r; scene.add(c); });
  });
  void cyl;
}

/* ====================================================================== inside the AI */
export function modelDetail(h) {
  const {ms, GLOW, E} = h, R = rng(7);
  /* a dark glossy floor under the grid */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({color: 0x0b0824, roughness: .4, metalness: .6, envMapIntensity: .3}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.02, -10); ms.add(floor);
  /* far away, soft clouds of colour, so the space is not flat black */
  [[-26, 9, -44, 46, 0x5a3df0, .15], [22, 12, -48, 52, 0x2a6cff, .11], [0, 4, -52, 60, 0x8a3dd8, .09], [-8, 15, -40, 30, 0x3dd6ff, .06]].forEach(([x, y, z, s, c, o]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: GLOW, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false}));
    sp.position.set(x, y, z); sp.scale.set(s, s * .7, 1); ms.add(sp);
  });
  /* more layers of the network, fading into the distance */
  const far = [], lines = [];
  const cols = [-34, -24, -14, -4, 6, 16, 26, 36];
  cols.forEach((x, c) => { for (let k = 0; k < 9; k++) { far.push({x, y: .6 + k * 1.9, z: -30, s: .7}); if (c < cols.length - 1) for (let j = 0; j < 9; j += 2) lines.push(x, .6 + k * 1.9, -30, cols[c + 1], .6 + ((j + k) % 9) * 1.9, -30); } });
  copies(ms, new THREE.SphereGeometry(.2, 10, 10), E(0x4a39b8, .5), far);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  ms.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color: 0x4a39b8, transparent: true, opacity: .12})));
  /* tall thin columns of light behind everything */
  const beams = [];
  for (let i = 0; i < 26; i++) beams.push({x: (R() - .5) * 90, y: 9, z: -34 - R() * 10, sx: .05 + R() * .08, sy: 18, sz: 1});
  copies(ms, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({color: 0x6f58ff, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending}), beams);
  /* signals running along the connections of the nearer network, layer to layer */
  const LX = [-15, -5, 5, 15], N = 150, node = (c, k) => V(LX[c], 1.2 + k * 1.5, -16);
  const pulses = Array.from({length: N}, () => { const c = Math.floor(R() * 3); return {a: node(c, Math.floor(R() * 7)), b: node(c + 1, Math.floor(R() * 7)), ph: R(), sp: .25 + R() * .35}; });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({map: GLOW, color: 0xc9b8ff, size: .34, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending}));
  pts.frustumCulled = false; ms.add(pts);
  const p = V(0, 0, 0);
  return t => {
    const a = pg.attributes.position;
    pulses.forEach((u, i) => { p.lerpVectors(u.a, u.b, (t * u.sp + u.ph) % 1); a.setXYZ(i, p.x, p.y, p.z + .05); });
    a.needsUpdate = true;
  };
}
