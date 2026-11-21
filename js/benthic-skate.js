import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = 2 * Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The disc is continuous from the rostrum to the wing tips. The paired
// spiracles sit behind the eyes, on top of the animal where it draws water.
function skateMesh() {
  const outline = new THREE.SplineCurve(
    [
      [-0.52, 0.035],
      [-0.42, 0.18],
      [-0.26, 0.31],
      [-0.14, 0.54],
      [-0.025, 0.76],
      [0.1, 0.65],
      [0.22, 0.46],
      [0.36, 0.3],
      [0.47, 0.14],
      [0.57, 0.014],
    ].map(([x, w]) => new THREE.Vector2(x, w)),
  );
  const pos = [],
    uv = [],
    ids = [],
    cols = [];
  const back = new THREE.Color(0x827158),
    side = new THREE.Color(0xa39773),
    belly = new THREE.Color(0xc1bd9f);
  const nx = 38,
    nz = 38;
  for (let face = 0; face < 2; face++) {
    for (let i = 0; i <= nx; i++) {
      const t = i / nx,
        p = outline.getPoint(t);
      for (let j = 0; j <= nz; j++) {
        const s = (j / nz) * 2 - 1,
          edge = 1 - s * s,
          z = p.y * s;
        const flesh = 0.013 + 0.097 * Math.sin(Math.PI * t) ** 0.61 * edge * Math.exp(-z * z * 11);
        const y = 0.03 * s * s * Math.sin(t * Math.PI * 2 + 0.2) + (face ? -flesh * 0.46 : flesh);
        pos.push(p.x, y, z);
        uv.push(0.04 + t * 0.92, 0.04 + (j / nz) * 0.92);
        const c = (face ? belly : back).clone().lerp(side, face ? 0.18 : Math.abs(s) ** 2 * 0.68);
        cols.push(c.r, c.g, c.b);
      }
    }
  }
  const count = (nx + 1) * (nz + 1);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const k = i * (nz + 1) + j,
        n = k + nz + 1;
      ids.push(
        k,
        k + 1,
        n,
        k + 1,
        n + 1,
        n,
        count + k,
        count + n,
        count + k + 1,
        count + k + 1,
        count + n,
        count + n + 1,
      );
    }
  for (let i = 0; i < nx; i++)
    for (const j of [0, nz]) {
      const a = i * (nz + 1) + j,
        b = a + nz + 1;
      ids.push(a, b, b + count, a, b + count, a + count);
    }
  const disc = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  disc.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  disc.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  disc.setIndex(ids);
  disc.computeVertexNormals();
  const parts = [disc.toNonIndexed()];
  disc.dispose();
  function oval(x, y, z, a, b, c, col) {
    const g = new THREE.SphereGeometry(1, 12, 8);
    g.scale(a, b, c);
    g.translate(x, y, z);
    tint(g, col);
  }
  function tint(g, col) {
    const f = g.toNonIndexed();
    g.dispose();
    const colors = [],
      rgb = new THREE.Color(col);
    for (let i = 0; i < f.attributes.position.count; i++) {
      colors.push(rgb.r, rgb.g, rgb.b);
      f.attributes.uv.setXY(i, 0, 0);
    }
    f.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    parts.push(f);
  }
  for (const s of [-1, 1]) {
    oval(0.269, 0.087, 0.072 * s, 0.059, 0.043, 0.034, 0x8a7959);
    oval(0.278, 0.119, 0.079 * s, 0.031, 0.018, 0.023, 0xa5965e);
    oval(0.282, 0.132, 0.079 * s, 0.022, 0.006, 0.008, 0x273734);
    oval(0.179, 0.11, 0.089 * s, 0.043, 0.009, 0.025, 0x5e5846);
    oval(0.179, 0.117, 0.089 * s, 0.035, 0.005, 0.014, 0x373a30);
    oval(-0.492, 0.002, 0.079 * s, 0.13, 0.022, 0.046, 0x82765e);
  }
  const path = new THREE.CatmullRomCurve3([
    V(-0.39, 0.008, 0),
    V(-0.56, 0.014, 0),
    V(-0.8, 0.035, -0.03),
    V(-1.06, 0.058, -0.085),
    V(-1.28, 0.08, -0.07),
  ]);
  const tail = new THREE.TubeGeometry(path, 32, 0.043, 10, false),
    tp = tail.attributes.position;
  for (let i = 0; i <= 32; i++) {
    const c = path.getPointAt(i / 32);
    for (let j = 0; j <= 10; j++) {
      const k = i * 11 + j,
        p = new THREE.Vector3()
          .fromBufferAttribute(tp, k)
          .sub(c)
          .multiplyScalar(1 - (i / 32) * 0.93)
          .add(c);
      tp.setXYZ(k, p.x, p.y, p.z);
    }
  }
  tail.computeVertexNormals();
  tint(tail, 0x7e765a);
  for (const t of [0.68, 0.88]) {
    const p = path.getPointAt(t);
    oval(p.x, p.y + 0.024, p.z, 0.045, 0.035, 0.007, 0x81775f);
  }
  for (let k = 0; k < 18; k++) {
    const t = k / 20,
      p = path.getPointAt(t);
    const thorn = new THREE.ConeGeometry(0.012 * (1 - t * 0.7), 0.025 * (1 - t * 0.65), 5);
    thorn.rotateZ(0.5);
    thorn.translate(p.x, p.y + 0.043 * (1 - t) + 0.008, p.z);
    tint(thorn, 0xc0b691);
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

function fleckedSkin() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 512, 512);
  let seed = 923;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 2100; i++) {
    const x = 21 + rand() * 470,
      y = 22 + rand() * 468,
      r = 0.6 + rand() ** 2 * 2.6;
    g.beginPath();
    g.fillStyle = i % 6 ? 'rgba(65,60,44,.34)' : 'rgba(104,83,48,.49)';
    g.ellipse(x, y, r * (0.7 + rand()), r, rand() * TAU, 0, TAU);
    g.fill();
  }
  // Dark eyespots with a pale border on each pectoral fin.
  for (const y of [103, 409]) {
    const mark = g.createRadialGradient(277, y, 0, 277, y, 15);
    mark.addColorStop(0, '#727568');
    mark.addColorStop(0.4, '#363d39');
    mark.addColorStop(0.67, '#74684d');
    mark.addColorStop(0.79, '#e5dabc');
    mark.addColorStop(0.87, '#a89676');
    mark.addColorStop(1, 'rgba(135,125,98,0)');
    g.fillStyle = mark;
    g.fillRect(261, y - 16, 32, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createBenthicSkates(parent, bedHeight) {
  const time = { value: 0 },
    mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: fleckedSkin(),
      roughness: 0.73,
      side: THREE.DoubleSide,
    });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.skateTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float skateTime;')
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float phase=skateTime*2.4+instanceMatrix[3].x*.17+5.6*position.x;
        float wing=clamp(abs(position.z)/.76,0.,1.);
        float dy=.19*wing*wing*sin(phase);
        objectNormal.x-=1.064*wing*wing*cos(phase)*objectNormal.y;
        objectNormal.z-=.50*wing*sign(position.z)*sin(phase)*objectNormal.y;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y+=dy;
        transformed.z+=.1*pow(max(0.,-.39-position.x),2.)*sin(phase);`,
      );
  };
  const sites = [
    [160, -2.1, 0.86],
    [181, 2.3, 0.81],
    [195, -1.22, 0.93],
    [205, -2.3, 1],
    [229, 1.6, 0.76],
  ];
  const m = new THREE.InstancedMesh(skateMesh(), mat, sites.length);
  m.frustumCulled = false;
  m.name = 'Skates gliding above the sediment';
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(m);
  const d = new THREE.Object3D();
  return (t, cameraX) => {
    time.value = t;
    let k = 0;
    for (const [cx, cz, scale] of sites) {
      if (Math.abs(cx - cameraX) > 26) continue;
      const a = t * 0.15 + cx * 0.33,
        x = cx + Math.sin(a) * 1.37,
        z = cz + 0.48 * Math.cos(a);
      d.position.set(x, bedHeight(x, z) + 0.42 + 0.05 * Math.sin(2 * a), z);
      d.rotation.set(0.025 * Math.cos(a), Math.atan2(0.48 * Math.sin(a), 1.37 * Math.cos(a)), 0.017 * Math.sin(a));
      d.scale.setScalar(scale);
      d.updateMatrix();
      m.setMatrixAt(k++, d.matrix);
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
  };
}
