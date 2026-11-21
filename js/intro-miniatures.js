import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rigidParts } from './rigid-parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (w, h, d, r = 0.025) => new RoundedBoxGeometry(w, h, d, 2, r);
const finish = (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function sectionGround(root) {
  const layers = [],
    indices = [],
    color = [];
  const sample = new THREE.Color();
  function vertex(x, y, z, tint, shade) {
    layers.push(x, y, z);
    sample.setHex(tint).multiplyScalar(shade);
    color.push(sample.r, sample.g, sample.b);
  }
  function quad(a, b, c, d, tint, shade) {
    const k = layers.length / 3;
    [a, b, c, d].forEach((p, i) => vertex(...p, tint, shade[i]));
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const shore = (z, left) => (left ? -0.68 + 0.17 * Math.sin(z * 2.1) : 2.72 + 0.24 * Math.cos(z * 1.8));
  const depth = (x, z) => {
    const distance = Math.min(x - shore(z, true), shore(z, false) - x);
    const t = THREE.MathUtils.smoothstep(distance, -0.4, 0.42);
    return 0.015 * (1 - t) - 0.32 * t + 0.035 * t * Math.sin(x * 5 + z * 3);
  };
  const nx = 98,
    nz = 25;
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const x = -8.05 + (16.3 * i) / nx,
        x1 = x + 16.3 / nx,
        z = -1.72 + (3.44 * k) / nz,
        z1 = z + 3.44 / nz;
      const pts = [
        [x, z1],
        [x1, z1],
        [x1, z],
        [x, z],
      ];
      const h = depth((x + x1) / 2, (z + z1) / 2),
        tint = h < -0.16 ? 0x5c9b9b : h < -0.03 ? 0xb9b493 : 0x949577;
      quad(
        ...pts.map(([a, b]) => [a, depth(a, b), b]),
        tint,
        pts.map(([a, b]) => 0.95 + 0.05 * Math.sin(a * 3.2 + b * 0.6) * Math.cos(b * 6.1 + a * 1.9)),
      );
    }
  for (const z of [-1.72, 1.72])
    for (let i = 0; i < nx; i++) {
      const x = -8.05 + (16.3 * i) / nx,
        x1 = x + 16.3 / nx;
      function seams(a) {
        const top = depth(a, z);
        return [
          top,
          top - 0.068,
          -0.41 + 0.036 * Math.sin(a * 2 + z),
          -0.5 + 0.025 * Math.sin(a * 1.6 + z + 0.8),
          -0.59,
        ];
      }
      const a = seams(x),
        b = seams(x1);
      for (let k = 0; k < 4; k++)
        quad(
          [x, a[k], z],
          [x, a[k + 1], z],
          [x1, b[k + 1], z],
          [x1, b[k], z],
          [0x786851, 0x9c896d, 0xb5a990, 0x6b7070][k],
          [0.94, 0.8, 0.8, 0.96],
        );
    }
  for (const x of [-8.05, 8.25])
    quad([x, 0.01, -1.72], [x, -0.59, -1.72], [x, -0.59, 1.72], [x, 0.01, 1.72], 0x928674, [1, 0.82, 0.82, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(layers, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, side: THREE.DoubleSide }),
  );
  mesh.receiveShadow = true;
  root.add(mesh);
  // Cut face of the sea exposes the cable. Little wavelets break the reflection on its upper plane.
  const water = new THREE.PlaneGeometry(1, 3.43, 54, 30).rotateX(-Math.PI / 2);
  const p = water.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i),
      t = p.getX(i) + 0.5,
      x = THREE.MathUtils.lerp(shore(z, true) - 0.16, shore(z, false) + 0.16, t);
    p.setXYZ(i, x, 0.15 + 0.017 * Math.sin(x * 11 - z * 3) + 0.012 * Math.sin(z * 13 + x * 4.5), z);
  }
  water.computeVertexNormals();
  const sea = new THREE.Mesh(
    water,
    new THREE.MeshPhysicalMaterial({
      color: 0x41999c,
      roughness: 0.25,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      clearcoat: 0.45,
    }),
  );
  root.add(sea);
  const face = new THREE.PlaneGeometry(1, 0.47, 48, 1),
    fp = face.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const z = 1.719,
      x = THREE.MathUtils.lerp(shore(z, true) - 0.15, shore(z, false) + 0.15, fp.getX(i) + 0.5);
    fp.setXYZ(
      i,
      x,
      fp.getY(i) > 0 ? 0.15 + 0.017 * Math.sin(x * 11 - z * 3) + 0.012 * Math.sin(z * 13 + x * 4.5) : depth(x, z),
      z,
    );
  }
  face.computeVertexNormals();
  root.add(
    new THREE.Mesh(
      face,
      new THREE.MeshStandardMaterial({
        color: 0x257980,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
}

export function detailMiniatures(root, phone, tower, dc) {
  sectionGround(root);
  const base = rigidParts(root),
    handset = rigidParts(phone),
    site = rigidParts(tower),
    hall = rigidParts(dc);
  const metal = finish(0xa3b3ba, 0.39, 0.67),
    graphite = finish(0x293745, 0.56, 0.52),
    dark = finish(0x14232a, 0.72),
    concrete = finish(0xc4c2aa, 0.91),
    ivory = finish(0xe4dfcd, 0.47),
    bronze = finish(0xc79455, 0.4, 0.72),
    green = finish(0x586c57, 0.9),
    rock = finish(0x788682, 0.91);
  base.add(box(16.44, 0.12, 3.56, 0.055), graphite, 0.1, -0.61, 0);
  base.add(box(16.37, 0.035, 3.5, 0.015), bronze, 0.1, -0.553, 0);
  base.add(box(2.26, 0.09, 1.46), concrete, -6.26, 0.049, 0.05);
  base.add(box(1.82, 0.24, 0.5, 0.06), graphite, -6.29, 0.19, -0.07, 0, 0.44, 0);
  handset.add(box(1.49, 3.08, 0.037, 0.105), graphite, 0, 0, -0.094);
  handset.add(box(0.034, 0.42, 0.069, 0.012), metal, 0.805, 0.35, 0);
  for (const y of [0.61, 0.18]) handset.add(box(0.033, 0.28, 0.071, 0.012), metal, -0.807, y, 0);
  for (const x of [-0.48, -0.34, -0.2, 0.2, 0.34, 0.48])
    handset.add(new THREE.CylinderGeometry(0.033, 0.033, 0.012, 12), dark, x, -1.588, 0);
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) site.add(box(0.35, 0.15, 0.35), concrete, x, 0.075, z);
  site.add(box(0.66, 0.84, 0.49), ivory, 0.95, 0.5, 0.34);
  site.add(box(0.47, 0.41, 0.04), metal, 0.95, 0.5, 0.6);
  for (let i = 0; i < 6; i++) site.add(box(0.34, 0.02, 0.043, 0.005), dark, 0.95, 0.36 + i * 0.05, 0.625);
  for (const x of [-0.13, 0.13]) site.add(new THREE.CylinderGeometry(0.021, 0.021, 3.5, 7), metal, x, 1.78, 0.13);
  for (let i = 0; i < 15; i++) site.add(new THREE.BoxGeometry(0.29, 0.025, 0.03), metal, 0, 0.2 + i * 0.222, 0.14);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + 0.4,
      x = Math.cos(a),
      z = Math.sin(a);
    site.add(box(0.3, 0.77, 0.11, 0.042), ivory, x * 0.32, 3.52, z * 0.32, 0, Math.PI / 2 - a, 0);
    const conduit = new THREE.CatmullRomCurve3([
      V(x * 0.34, 3.24, z * 0.34),
      V(x * 0.39, 3.09, z * 0.39),
      V(x * 0.18, 3.02, z * 0.18),
      V(x * 0.13, 0.25, z * 0.13),
    ]);
    site.add(new THREE.TubeGeometry(conduit, 24, 0.021, 6), dark);
  }
  hall.add(box(3.83, 0.12, 3.02), concrete, 0, 0.065, 0);
  for (const x of [-1.64, -0.55, 0.55, 1.64]) hall.add(box(0.075, 1.69, 0.085), metal, x, 1.16, 1.442);
  for (const y of [0.32, 2.02]) hall.add(box(3.4, 0.073, 0.11), metal, 0, y, 1.44);
  for (const x of [-1.09, 0, 1.1])
    for (let k = 0; k < 6; k++)
      hall.add(new THREE.BoxGeometry(0.96, 0.024, 0.055), graphite, x, 0.49 + k * 0.249, 1.451);
  for (const [x, z] of [
    [-0.9, -0.6],
    [0.2, 0.5],
    [1.1, -0.5],
  ]) {
    hall.add(new THREE.CylinderGeometry(0.303, 0.315, 0.09, 24), metal, x, 2.753, z);
    hall.add(new THREE.CylinderGeometry(0.265, 0.265, 0.013, 24), dark, x, 2.804, z);
    for (let k = 0; k < 4; k++)
      hall.add(box(0.4, 0.018, 0.057, 0.008), graphite, x, 2.816, z, 0, (k * Math.PI) / 4, 0);
  }
  for (let i = 0; i < 10; i++)
    hall.add(new THREE.BoxGeometry(0.055, 1.02, 0.041), metal, -1.835, 1.04, -1.14 + i * 0.099);
  for (const x of [-1.59, 1.58])
    hall.add(new THREE.CylinderGeometry(0.044, 0.044, 2.26, 8), metal, x, 1.19, -1.43);
  // Trees and weathered stones convey the scale of the diorama without obscuring its path.
  for (const [x, z, h] of [
    [-4.7, -1.23, 0.62],
    [-4.3, -1.05, 0.46],
    [-3.8, -1.39, 0.69],
    [3.3, -1.15, 0.52],
    [3.54, -1.36, 0.71],
    [7.82, -1.1, 0.52],
  ]) {
    base.add(new THREE.CylinderGeometry(0.025, 0.042, h * 0.6, 7), bronze, x, h * 0.3, z);
    for (let i = 0; i < 3; i++)
      base.add(
        new THREE.ConeGeometry(h * (0.24 - 0.046 * i), h * 0.6, 9),
        green,
        x,
        h * (0.45 + 0.17 * i),
        z,
        0,
        x + i,
        0,
      );
  }
  for (let i = 0; i < 22; i++) {
    const z = 1.48 * Math.sin(i * 2.41),
      x = (i % 2 ? -0.44 : 2.54) + 0.16 * Math.sin(i * 1.83);
    const g = new THREE.IcosahedronGeometry(0.078 + 0.045 * (0.5 + 0.5 * Math.sin(i * 2)), 0).scale(
      1.4,
      0.62,
      0.86,
    );
    base.add(g, rock, x, -0.026, z, 0, i, 0);
  }
  for (const b of [base, handset, site, hall]) b.finish();
}
