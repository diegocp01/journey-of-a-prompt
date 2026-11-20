/* The opening screen: a small 3D model of the whole trip.
   A phone on the left, a cell tower, a cable through the sea, a data center on the right,
   and points of light flowing from the phone to the data center (gold) and back (blue).
   It sits far away from the rest of the world, so nothing else is in view. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const INTRO_AT = new THREE.Vector3(-2000, 0, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createIntro(scene, glow) {
  const root = new THREE.Group();
  root.name = 'Intro';
  root.position.copy(INTRO_AT);
  scene.add(root);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: o.r ?? .5, metalness: o.m ?? .2, envMapIntensity: o.env ?? .7,
    emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1});
  const add = (mesh, x, y, z, parent = root) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };

  /* a dark glossy floor with a faint grid, fading into the background */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(46, 72), mat(0x0a1024, {r: .32, m: .65, env: .9}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  const grid = new THREE.GridHelper(72, 72, 0x2a3f7a, 0x16224a);
  grid.position.y = .012; grid.material.transparent = true; grid.material.opacity = .55; root.add(grid);

  /* ---- the phone ---- */
  const phone = new THREE.Group();
  phone.position.set(-6.3, 2.05, 0); phone.rotation.set(-.08, .5, .04); root.add(phone);
  add(new THREE.Mesh(new RoundedBoxGeometry(1.6, 3.2, .2, 5, .12), mat(0x16181d, {r: .25, m: .9, env: 1.3})), 0, 0, 0, phone);
  const screenTex = canvasTex(256, 520, (g, w, h) => {
    g.fillStyle = '#f5f7fb'; g.beginPath(); g.roundRect(0, 0, w, h, 34); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.roundRect(w / 2 - 38, 16, 76, 22, 11); g.fill();
    g.fillStyle = '#0a84ff'; g.beginPath(); g.roundRect(66, 110, 170, 74, 24); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(88, 132, 124, 9); g.fillRect(88, 152, 84, 9);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 2; g.beginPath(); g.roundRect(16, 386, w - 32, 104, 26); g.fill(); g.stroke();
    g.fillStyle = '#c9ced8'; g.fillRect(36, 412, 110, 9);
    g.fillStyle = '#0a84ff'; g.beginPath(); g.arc(w - 58, 448, 26, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(w - 58, 461); g.lineTo(w - 58, 436); g.moveTo(w - 70, 447); g.lineTo(w - 58, 435); g.lineTo(w - 46, 447); g.stroke();
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 2.98), new THREE.MeshBasicMaterial({map: screenTex, transparent: true, toneMapped: false, color: 0xe6e6e6}));
  screen.position.z = .104; phone.add(screen);
  const phoneLight = new THREE.PointLight(0xbfd6ff, 5, 9, 2); phoneLight.position.set(-5.4, 2.2, 1.6); root.add(phoneLight);

  /* ---- the cell tower, with radio rings spreading from its top ---- */
  const steel = mat(0x9aa3b0, {r: .4, m: .8, env: 1.1}), tower = new THREE.Group();
  tower.position.set(-2.4, 0, 0); root.add(tower);
  const beam = (a, b, r) => {
    const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), steel);
    m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = true; tower.add(m);
  };
  const half = h => .62 - .5 * h / 3.7, corner = (h, i) => V([1, 1, -1, -1][i] * half(h), h, [1, -1, -1, 1][i] * half(h));
  for (let i = 0; i < 4; i++) {
    beam(corner(0, i), corner(3.7, i), .035);
    for (let l = 0; l < 4; l++) { beam(corner(l * .92 + .92, i), corner(l * .92 + .92, (i + 1) % 4), .018); beam(corner(l * .92, i), corner(l * .92 + .92, (i + 1) % 4), .016); }
  }
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + .4; add(new THREE.Mesh(new THREE.BoxGeometry(.1, .62, .22), mat(0xeef0f3, {r: .5})), Math.cos(a) * .3, 3.55, Math.sin(a) * .3, tower).rotation.y = -a; }
  add(new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .6, 6), steel), 0, 4.0, 0, tower);
  const beacon = add(new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 12), mat(0, {e: 0xff4040, ei: 4})), 0, 4.32, 0, tower);
  const rings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, .022, 6, 64), new THREE.MeshBasicMaterial({color: 0xffa23a, transparent: true, opacity: 0, depthWrite: false}));
    r.position.set(0, 3.75, 0); tower.add(r); return r;
  });

  /* ---- the sea, as a block of water the cable runs through ---- */
  const water = new THREE.Mesh(new RoundedBoxGeometry(3.4, .62, 3, 4, .12),
    new THREE.MeshStandardMaterial({color: 0x2a86d8, transparent: true, opacity: .34, roughness: .08, metalness: .1, envMapIntensity: 1.3, depthWrite: false}));
  water.position.set(1.05, .32, 0); root.add(water);

  /* ---- the data center ---- */
  const dc = new THREE.Group();
  dc.position.set(6.3, 0, 0); root.add(dc);
  add(new THREE.Mesh(new RoundedBoxGeometry(3.6, 2.4, 2.8, 3, .06), mat(0x182036, {r: .45, m: .5, env: 1})), 0, 1.2, 0, dc);
  const rackTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#0c1222'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 7; y++) {
      const r = Math.sin(x * 12.9 + y * 78.2) * 43758.5; const k = r - Math.floor(r);
      g.fillStyle = k < .16 ? '#ffb84a' : k < .7 ? '#35d6ff' : '#17233f';
      g.fillRect(14 + x * 29, 12 + y * 15, 20, 5);
    }
  });
  const racks = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.55), new THREE.MeshBasicMaterial({map: rackTex, toneMapped: false}));
  racks.position.set(0, 1.15, 1.405); dc.add(racks);
  const cyan = mat(0, {e: 0x35d6ff, ei: 2.4});
  add(new THREE.Mesh(new THREE.BoxGeometry(3.64, .05, .05), cyan), 0, 2.25, 1.41, dc);
  add(new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 2.84), cyan), -1.81, 2.25, 0, dc);
  /* glowing doorway on the side the light arrives at */
  [[0, 1.0, .46], [0, 1.0, -.46]].forEach(([x, y, z]) => add(new THREE.Mesh(new THREE.BoxGeometry(.05, 1.0, .05), cyan), -1.82 + x, y - .5, z, dc));
  add(new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .97), cyan), -1.82, 1.0, 0, dc);
  [[-.9, -.6], [.2, .5], [1.1, -.5]].forEach(([x, z]) => add(new THREE.Mesh(new THREE.BoxGeometry(.7, .32, .7), mat(0x3a4560, {r: .5, m: .5})), x, 2.56, z, dc));
  const dcLight = new THREE.PointLight(0x35d6ff, 6, 10, 2); dcLight.position.set(5.2, 2.4, 2.4); root.add(dcLight);

  /* ---- the road the message takes ---- */
  const air = new THREE.CatmullRomCurve3([V(-6.0, 3.75, .25), V(-4.9, 4.75, .12), V(-3.4, 4.7, .03), V(-2.4, 3.9, 0)], false, 'centripetal');
  const ground = new THREE.CatmullRomCurve3([V(-2.4, 3.9, 0), V(-2.4, 2, 0), V(-2.36, .3, .05), V(-1.9, .13, .25), V(-.5, .13, 1.0), V(1.0, .13, .15), V(2.5, .13, -.85), V(3.7, .13, -.25), V(4.3, .3, 0), V(4.5, .52, 0)], false, 'centripetal');
  const cablePts = ground.getPoints(120).filter(p => p.y < .2 || p.x > 3.9);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 140, .055, 8), mat(0, {e: 0x35d6ff, ei: 1.5}));
  root.add(cable);
  const path = new THREE.CurvePath(); path.add(air); path.add(ground);
  const dots = (count, color, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({map: glow, color, size, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending}));
    pts.frustumCulled = false; root.add(pts); return pts;
  };
  const out = dots(84, 0xffc24d, .5), back = dots(36, 0x7fd4ff, .4), p = V(0, 0, 0);

  function tick(t) {
    /* packets of gold light leave the phone one after another; blue ones come back */
    const a = out.geometry.attributes.position, b = back.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const u = (t * .085 + Math.floor(i / 7) / 12 - (i % 7) * .0075 + 10) % 1;
      path.getPointAt(u, p); a.setXYZ(i, p.x, p.y, p.z);
    }
    for (let i = 0; i < b.count; i++) {
      const u = 1 - ((t * .085 + Math.floor(i / 6) / 6 - (i % 6) * .0075 + .04 + 10) % 1);
      path.getPointAt(u, p); b.setXYZ(i, p.x, p.y + .2, p.z - .12);
    }
    a.needsUpdate = b.needsUpdate = true;
    rings.forEach((r, i) => { const k = (t * .45 + i / 3) % 1; r.scale.setScalar(.25 + 1.5 * k); r.material.opacity = .7 * (1 - k); });
    phone.position.y = 2.05 + Math.sin(t * 1.1) * .07; phone.rotation.y = .5 + Math.sin(t * .6) * .06;
    beacon.material.emissiveIntensity = Math.sin(t * 4) > 0 ? 4.5 : .6;
    dcLight.intensity = 6 + Math.sin(t * 2.3) * 1.2;
    /* a slow turn of the whole model, so its depth shows */
    root.rotation.y = Math.sin(t * .22) * .13;
  }
  return {root, tick};
}
