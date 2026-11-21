import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rigidParts } from './rigid-parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function fitDesk(desk, wood, finish) {
  const parts = rigidParts(desk);
  const woodFace = wood.clone();
  woodFace.map = wood.map.clone();
  woodFace.map.rotation = 0;
  woodFace.map.repeat.set(1.25, 0.16);
  woodFace.bumpMap = null;
  const reveal = new THREE.MeshStandardMaterial({ color: 0x40372e, roughness: 0.86 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xaf8e58,
    metalness: 0.72,
    roughness: 0.43,
    envMap: finish.envMap,
  });
  const box = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);
  parts.add(box(1.85, 0.079, 0.62, 0.004), woodFace, 0, -0.078, 0.375);
  parts.add(box(1.76, 0.067, 0.012, 0.002), reveal, 0, -0.082, 0.692);
  for (const x of [-0.438, 0.438]) {
    parts.add(box(0.866, 0.059, 0.016, 0.003), woodFace, x, -0.081, 0.701);
    for (const dx of [-0.054, 0.054])
      parts.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.016, 16), brass, x + dx, -0.078, 0.715, Math.PI / 2);
    parts.add(box(0.12, 0.006, 0.009, 0.0028), brass, x, -0.078, 0.724);
  }
  // Glazing beads and the rubber gasket form concentric steps in the existing sash.
  const rubber = new THREE.MeshStandardMaterial({ color: 0x5f5c53, roughness: 0.79 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0xe9dfce, roughness: 0.44 });
  for (const x of [-0.33, 0.33]) {
    for (const side of [-1, 1]) {
      parts.add(new THREE.BoxGeometry(0.005, 0.985, 0.009), rubber, x + side * 0.026, 0.816, -0.076);
      parts.add(box(0.009, 0.985, 0.014, 0.002), lacquer, x + side * 0.016, 0.816, -0.068);
    }
  }
  parts.add(box(1.54, 0.008, 0.012, 0.002), rubber, 0, 0.313, -0.077);
  // Compact sash cam below the sight line, on the room side of the frame.
  parts.add(box(0.054, 0.012, 0.018, 0.004), brass, 0.325, 0.325, -0.062);
  parts.add(new THREE.CylinderGeometry(0.006, 0.007, 0.018, 20), brass, 0.324, 0.339, -0.059);
  parts.add(box(0.034, 0.005, 0.011, 0.002), brass, 0.338, 0.349, -0.055, 0, -0.37);
  parts.finish();
}

export function addDimmer(parent, brass) {
  const parts = rigidParts(parent);
  const antique = new THREE.MeshStandardMaterial({
    color: 0xb29362,
    metalness: 0.76,
    roughness: 0.46,
    envMap: brass.envMap,
  });
  const seam = new THREE.MeshStandardMaterial({ color: 0x685842, metalness: 0.44, roughness: 0.54 });
  parts.add(new THREE.CylinderGeometry(0.0085, 0.009, 0.0019, 32), seam, 0.02, 0.0364, 0.009);
  // The dimmer wheel is knurled around its circumference, with a position mark on its face.
  const segments = 96,
    points = [],
    indices = [];
  for (const [h, r] of [
    [0, 0.0064],
    [0.0008, 0.0078],
    [0.006, 0.0078],
    [0.007, 0.0067],
  ]) {
    for (let i = 0; i <= segments; i++) {
      const a = (i * 2 * Math.PI) / segments,
        rad = r * (i % 2 ? 0.958 : 1);
      points.push(rad * Math.cos(a), h, rad * Math.sin(a));
    }
  }
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < segments; i++) {
      const k = j * (segments + 1) + i;
      indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
    }
  const wheel = new THREE.BufferGeometry();
  wheel.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  wheel.setIndex(indices);
  wheel.computeVertexNormals();
  const knob = new THREE.Mesh(wheel, antique);
  knob.position.set(0.02, 0.037, 0.009);
  parent.add(knob);
  parts.add(new THREE.CylinderGeometry(0.0067, 0.0067, 0.0006, 48), antique, 0.02, 0.044, 0.009);
  parts.add(new THREE.BoxGeometry(0.0008, 0.00035, 0.0032), seam, 0.02, 0.0444, 0.0128);
  parts.finish();
}

export function addBookmark(book) {
  // The bookmark exits the paper fore-edge, bends down the book and rests on the table.
  const path = new THREE.CatmullRomCurve3([
    V(0.1, 0.0145, 0.013),
    V(0.11, 0.0144, 0.014),
    V(0.116, 0.012, 0.0147),
    V(0.12, 0.004, 0.016),
    V(0.127, 0.0008, 0.018),
    V(0.137, 0.0007, 0.02),
  ]);
  const pos = [],
    uv = [],
    index = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30,
      p = path.getPoint(t);
    for (let j = 0; j < 3; j++) {
      pos.push(p.x - (j === 1 && i === 30 ? 0.0027 : 0), p.y + (j === 1 ? 0.0004 : 0), p.z + (j - 1) * 0.0038);
      uv.push(t, j / 2);
    }
    if (i < 30)
      for (let j = 0; j < 2; j++) {
        const k = i * 3 + j;
        index.push(k, k + 1, k + 3, k + 1, k + 4, k + 3);
      }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const ribbon = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color: 0x75634d,
      roughness: 0.76,
      sheen: 0.66,
      sheenColor: 0xd8b886,
      sheenRoughness: 0.59,
      side: THREE.DoubleSide,
    }),
  );
  ribbon.castShadow = ribbon.receiveShadow = true;
  book.add(ribbon);
}
