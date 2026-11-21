/* The ride inside the cable: a first-person view from the message itself,
   racing down a thread of glass under the ocean. Streaks of light rush past on the glass wall,
   the dark blue water shows through it, and rings (the cable's repeaters) flash by.
   It sits far away from the rest of the world, in its own spot. */
import * as THREE from 'three';

export const TUNNEL_AT = new THREE.Vector3(-3000, 0, 0);
const LENGTH = 420;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createTunnel(scene, glow) {
  const R = rng(5), root = new THREE.Group();
  root.name = 'Cable ride';
  root.position.copy(TUNNEL_AT);
  root.visible = false;
  scene.add(root);
  const spin = new THREE.Group();   /* everything that turns round the cable's own line */
  root.add(spin);

  /* streaks of light that run along the glass: tall thin strokes on a see-through picture, wrapped round a tube */
  const streakTex = (count, colours, seed) => {
    const rr = rng(seed), c = document.createElement('canvas');
    c.width = 512; c.height = 1024;
    const g = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = rr() * 512, len = 90 + rr() * 520, y = rr() * 1024, w = 1 + rr() * 3.2, col = colours[Math.floor(rr() * colours.length)];
      /* drawn twice, one picture-height apart, so the pattern repeats without a seam */
      [0, -1024].forEach(dy => {
        const gr = g.createLinearGradient(0, y + dy, 0, y + dy + len);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.75, col); gr.addColorStop(1, 'rgba(255,255,255,.95)');
        g.fillStyle = gr; g.fillRect(x, y + dy, w, len);
      });
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const tube = (radius, tex, repeat, opacity) => {
    tex.repeat.set(repeat[0], repeat[1]);
    const geo = new THREE.CylinderGeometry(radius, radius, LENGTH, 56, 1, true);
    geo.rotateZ(-Math.PI / 2); geo.translate(LENGTH / 2 - 12, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, opacity, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false}));
    m.frustumCulled = false; spin.add(m);
    return m;
  };
  const inner = tube(1.05, streakTex(70, ['rgba(120,220,255,.75)', 'rgba(255,214,120,.8)', 'rgba(255,255,255,.7)'], 11), [2, 5], 1);
  const mid = tube(1.7, streakTex(46, ['rgba(70,150,255,.6)', 'rgba(120,220,255,.5)'], 23), [3, 4], .8);

  /* the ocean outside the glass: dark blue with soft lighter patches drifting by */
  const sea = document.createElement('canvas'); sea.width = 256; sea.height = 512;
  {
    const g = sea.getContext('2d'); g.fillStyle = '#04123f'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 70; i++) {
      const x = R() * 256, y = R() * 512, r = 14 + R() * 46;
      [[0, 0], [0, -512], [0, 512], [-256, 0], [256, 0]].forEach(([dx, dy]) => {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, 'rgba(60,130,235,.34)'); gr.addColorStop(1, 'rgba(60,130,235,0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      });
    }
  }
  const seaTex = new THREE.CanvasTexture(sea);
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.colorSpace = THREE.SRGBColorSpace; seaTex.repeat.set(4, 3);
  const oceanGeo = new THREE.CylinderGeometry(6, 6, LENGTH, 40, 1, true);
  oceanGeo.rotateZ(-Math.PI / 2); oceanGeo.translate(LENGTH / 2 - 12, 0, 0);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshBasicMaterial({map: seaTex, side: THREE.BackSide, fog: false}));
  ocean.frustumCulled = false; spin.add(ocean);

  /* rings that flash past: the repeaters built into a real sea cable */
  const RINGS = 14, GAP = LENGTH / RINGS;
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.08, .045, 8, 48),
    new THREE.MeshBasicMaterial({color: 0x7fe3ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}), RINGS);
  rings.frustumCulled = false; spin.add(rings);
  const d = new THREE.Object3D();

  /* the far end of the thread: a bright point the message is racing toward */
  const far = new THREE.Sprite(new THREE.SpriteMaterial({map: glow, color: 0xcfeaff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  far.position.set(150, 0, 0); far.scale.set(26, 26, 1); root.add(far);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({map: glow, color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  core.position.set(150, 0, 0); core.scale.set(7, 7, 1); root.add(core);

  let travelled = 0;
  function tick(t, dt, speed = 1) {
    if (!root.visible) return;
    travelled += dt * 150 * speed;
    inner.material.map.offset.y = travelled / (LENGTH / 5);
    mid.material.map.offset.y = travelled * .62 / (LENGTH / 4);
    seaTex.offset.y = travelled * .16 / (LENGTH / 3);
    for (let i = 0; i < RINGS; i++) {
      const x = ((i * GAP - travelled) % LENGTH + LENGTH) % LENGTH - 12;
      d.position.set(x, 0, 0); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); rings.setMatrixAt(i, d.matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
    /* the thread is not perfectly straight: it turns slowly and sways */
    spin.rotation.x = t * .32;
    root.rotation.y = Math.sin(t * .55) * .05; root.rotation.z = Math.sin(t * .4) * .04;
    far.material.opacity = .8 + .15 * Math.sin(t * 9);
  }
  return {root, tick, show: v => { root.visible = v; }};
}
