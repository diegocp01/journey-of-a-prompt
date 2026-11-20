/* The towns at each end of the trip: office towers, apartment blocks and brick buildings,
   each with floors of windows, a roof, and rooftop machinery. */
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* one facade tile is 4 windows wide and 4 floors tall */
const BAY = 3.1, FLOOR = 3.3;

function facade(style, seed) {
  const rand = rng(seed), S = 256, C = 64;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const col = mk(), lit = mk(), g = col.getContext('2d'), e = lit.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  if (style === 'glass') {
    g.fillStyle = '#31475d'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const gr = g.createLinearGradient(0, y * C, 0, y * C + C), k = rand();
      gr.addColorStop(0, k > .7 ? '#8fb6d6' : '#5d86ab'); gr.addColorStop(1, k > .7 ? '#5f8db3' : '#2f4d69');
      g.fillStyle = gr; g.fillRect(x * C + 3, y * C + 3, C - 6, C - 12);
      g.fillStyle = '#1f2f40'; g.fillRect(x * C + 3, y * C + C - 9, C - 6, 7);   /* floor slab behind the glass */
      if (rand() < .1) { e.fillStyle = '#ffe2ad'; e.fillRect(x * C + 5, y * C + 5, C - 10, C - 16); }
    }
    g.fillStyle = '#c9d3dd';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * C - 2, 0, 4, S); g.fillRect(0, k * C - 2, S, 3); }
  } else {
    const brick = style === 'brick';
    g.fillStyle = brick ? '#96563f' : '#bdb6a9'; g.fillRect(0, 0, S, S);
    if (brick) {
      g.strokeStyle = 'rgba(60,30,22,.45)'; g.lineWidth = 1;
      for (let y = 0; y < S; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 8 % 2) * 8; x < S; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
    } else {
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() < .5 ? '255,255,255' : '60,55,48'},.05)`; g.fillRect(rand() * S, rand() * S, 3, 3); }
      g.fillStyle = 'rgba(70,66,60,.5)'; for (let k = 0; k <= 4; k++) g.fillRect(0, k * C - 2, S, 3);
    }
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const wx = x * C + 13, wy = y * C + 11, ww = C - 26, wh = C - 24;
      g.fillStyle = brick ? '#efe9dd' : '#e2ded4'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const gr = g.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, '#6e8ea8'); gr.addColorStop(1, '#27394a');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = brick ? '#efe9dd' : '#e2ded4'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh * .45, ww, 2);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(wx - 4, wy + wh + 3, ww + 8, 3);                       /* sill shadow */
      if (rand() < .14) { e.fillStyle = rand() < .7 ? '#ffd9a0' : '#d6e6ff'; e.fillRect(wx, wy, ww, wh); }
    }
  }
  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const map = tex(col); map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = tex(lit); emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map, emissiveMap, emissive: 0xffffff, emissiveIntensity: .5,
    roughness: style === 'glass' ? .22 : .88, metalness: style === 'glass' ? .55 : .04, envMapIntensity: style === 'glass' ? 1.1 : .25});
}

/* a box whose four walls repeat the facade tile by real size, with a plain roof */
function block(w, h, d, wall, roof) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < 24; i++) {
    const [a, b] = size[i >> 2];
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(a / BAY)) / 4, uv.getY(i) * Math.max(1, Math.round(b / FLOOR)) / 4);
  }
  return new THREE.Mesh(geo, [wall, wall, roof, roof, wall, wall]);
}

/* zones: [[x0, x1, z0, z1], ...]; perZone buildings in each */
export function createCity(scene, zones, perZone = 14) {
  const rand = rng(4242), rnd = (a, b) => a + rand() * (b - a), group = new THREE.Group();
  group.name = 'City';
  const walls = [facade('glass', 1), facade('glass', 2), facade('concrete', 3), facade('concrete', 4), facade('brick', 5)];
  const roof = new THREE.MeshStandardMaterial({color: 0x4b4f55, roughness: .95, envMapIntensity: .1});
  const metal = new THREE.MeshStandardMaterial({color: 0x9aa1aa, roughness: .6, metalness: .5, envMapIntensity: .5});
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = false; group.add(m); return m; };
  zones.forEach(([x0, x1, z0, z1]) => {
    for (let i = 0; i < perZone; i++) {
      const x = rnd(x0, x1), z = rnd(z0, z1), w = rnd(8, 16), d = rnd(8, 16), k = Math.floor(rand() * walls.length), wall = walls[k];
      const h = k < 2 ? rnd(26, 58) : rnd(10, 30);
      add(block(w, h, d, wall, roof), x, h / 2, z);
      let top = h, tw = w, td = d;
      /* tall towers step in near the top */
      if (k < 2 && rand() < .6) { const h2 = rnd(5, 12); tw = w * .68; td = d * .68; add(block(tw, h2, td, wall, roof), x, h + h2 / 2, z); top = h + h2; }
      /* parapet, air-conditioning units, and sometimes a mast or a water tank */
      add(new THREE.Mesh(new THREE.BoxGeometry(tw + .3, .5, td + .3), roof), x, top + .1, z);
      const units = 1 + Math.floor(rand() * 3);
      for (let u = 0; u < units; u++) add(new THREE.Mesh(new THREE.BoxGeometry(rnd(1.4, 3), rnd(.9, 1.8), rnd(1.4, 2.6)), metal), x + rnd(-tw * .3, tw * .3), top + 1, z + rnd(-td * .3, td * .3));
      const extra = rand();
      if (extra < .3) add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, rnd(5, 10), 6), metal), x + tw * .25, top + 3.5, z - td * .2);
      else if (extra < .5) { add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 14), metal), x - tw * .2, top + 2.4, z + td * .2); add(new THREE.Mesh(new THREE.ConeGeometry(1.3, .7, 14), roof), x - tw * .2, top + 3.85, z + td * .2); }
    }
  });
  scene.add(group);
  return group;
}
