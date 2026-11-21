// The pressure housing and bend limiters are turned along the cable axis.
// All nine housings reuse the same mesh and the message still follows the outer seals.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tau = Math.PI * 2;

export function armouredCableMaterial() {
  const n = 256,
    pigment = new Uint8Array(n * n * 4),
    normals = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / n,
        v = y / n,
        angle = tau * (15 * v - u);
      const groove = (0.5 - 0.5 * Math.cos(angle)) ** 3;
      const breakUp = Math.sin(tau * (3 * u + 2 * v)) * 0.5 + Math.cos(tau * (u - 4 * v)) * 0.5;
      const wear = (1 - groove) * (0.58 + 0.4 * breakUp);
      const tint = 75 + 32 * wear - 24 * groove,
        k = (y * n + x) * 4;
      pigment.set([tint * 0.94 + wear * 4, tint, tint * 1.01, 255], k);
      // The broad, rounded wire crown slopes into a much narrower tarred seam.
      const slope = 0.79 * Math.sin(angle) * (0.52 + 0.48 * (0.5 - 0.5 * Math.cos(angle)));
      const length = Math.hypot(1, slope, slope * 0.29);
      normals.set(
        [(1 - (slope * 0.29) / length) * 127.5, (1 + slope / length) * 127.5, (1 + 1 / length) * 127.5, 255],
        k,
      );
    }
  function map(data, color) {
    const t = new THREE.DataTexture(data, n, n);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(71, 1);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  return new THREE.MeshStandardMaterial({
    map: map(pigment, true),
    normalMap: map(normals, false),
    normalScale: new THREE.Vector2(0.76, 0.76),
    color: 0xb4c1ba,
    roughness: 0.7,
    metalness: 0.26,
    envMapIntensity: 0.44,
  });
}

function jacketTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efefed';
  ctx.fillRect(0, 0, c.width, c.height);
  // Faint circumferential lathe marks on bare metal.
  for (let y = 0; y < 512; y += 2) {
    ctx.fillStyle = 'rgba(38,44,41,' + (0.025 + 0.04 * Math.sin(y * 4.7) ** 2) + ')';
    ctx.fillRect(0, y, 512, 0.7);
  }
  for (const y of [160, 349]) {
    ctx.fillStyle = '#9e823f';
    ctx.fillRect(0, y, 512, 5);
    ctx.fillStyle = '#534e38';
    ctx.fillRect(0, y + 5, 512, 1);
  }
  for (const x of [23, 279]) {
    ctx.fillStyle = '#343a38';
    ctx.fillRect(x, 215, 116, 2);
    ctx.font = 'bold 14px monospace';
    ctx.fillText('OPTICAL  03', x, 239);
    for (let i = 0; i < 30; i++) ctx.fillRect(x + i * 4, 244, i % 3 ? 1 : 2, 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function subseaRepeaters(parent, curves, stops) {
  const parts = [];
  function add(g, color) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([rgb.r, rgb.g, rgb.b], i);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geo);
  }
  function turn(profile, color) {
    const g = new THREE.LatheGeometry(
      profile.map(([y, r]) => new THREE.Vector2(r, y)),
      40,
    );
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (g.attributes.position.getY(i) + 1.42) / 2.84);
    add(g, color);
  }
  turn(
    [
      [-0.86, 0.281],
      [-0.846, 0.296],
      [-0.825, 0.3],
      [0.825, 0.3],
      [0.846, 0.296],
      [0.86, 0.281],
    ],
    0xb3a58c,
  );
  for (const sign of [-1, 1]) {
    function shoulder(points, color) {
      const profile = points.map(([y, r]) => [sign * y, r]);
      if (sign < 0) profile.reverse();
      turn(profile, color);
    }
    shoulder(
      [
        [0.84, 0.288],
        [0.864, 0.295],
        [0.886, 0.29],
        [0.91, 0.28],
        [0.94, 0.267],
        [1.07, 0.242],
        [1.24, 0.185],
        [1.38, 0.157],
        [1.415, 0.15],
      ],
      0x485454,
    );
    for (let i = 0; i < 6; i++) {
      const y = 0.916 + i * 0.078,
        r = 0.282 - i * 0.023;
      shoulder(
        [
          [y - 0.016, r - 0.008],
          [y - 0.009, r],
          [y + 0.008, r - 0.001],
          [y + 0.015, r - 0.01],
        ],
        0x697670,
      );
    }
    shoulder(
      [
        [0.804, 0.297],
        [0.808, 0.302],
        [0.831, 0.302],
        [0.835, 0.297],
      ],
      0x705e46,
    );
  }
  for (const y of [-0.6, 0, 0.6]) {
    turn(
      [
        [y - 0.064, 0.298],
        [y - 0.057, 0.312],
        [y - 0.046, 0.315],
        [y - 0.035, 0.313],
        [y - 0.022, 0.334],
        [y - 0.014, 0.341],
        [y + 0.014, 0.341],
        [y + 0.024, 0.333],
        [y + 0.036, 0.313],
        [y + 0.047, 0.315],
        [y + 0.058, 0.312],
        [y + 0.065, 0.298],
      ],
      0x9ca69d,
    );
    for (let i = 0; i < 12; i++) {
      const a = (tau * i) / 12,
        bolt = new THREE.CylinderGeometry(0.016, 0.017, 0.007, 6);
      bolt.rotateX(Math.PI / 2);
      bolt.rotateY(a);
      bolt.translate(0.341 * Math.sin(a), y, 0.341 * Math.cos(a));
      add(bolt, 0x64716a);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  const hull = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: jacketTexture(),
      vertexColors: true,
      roughness: 0.43,
      metalness: 0.59,
      envMapIntensity: 0.65,
    }),
    curves.length * stops.length,
  );
  hull.name = 'Subsea optical repeater pressure housings';
  const axis = new THREE.Vector3(0, 1, 0),
    object = new THREE.Object3D();
  let index = 0;
  curves.forEach((curve, i) =>
    stops.forEach((stop) => {
      const u = stop + (i - 1) * 0.03;
      curve.getPointAt(u, object.position);
      object.quaternion.setFromUnitVectors(axis, curve.getTangentAt(u));
      object.updateMatrix();
      hull.setMatrixAt(index++, object.matrix);
    }),
  );
  hull.computeBoundingSphere();
  parent.add(hull);
}

// The irregular oxide bloom is broad enough to read on the nearest casting.
function castIronFinish() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d'),
    im = ctx.createImageData(c.width, c.height);
  let seed = 84;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const a = (tau * x) / c.width,
        b = (tau * y) / c.height;
      const oxide = Math.max(
        0,
        0.49 + 0.34 * Math.sin(3 * a + b + 1.8 * Math.sin(2 * b)) + 0.28 * Math.sin(7 * b - 2 * a),
      );
      const grit = 8 * (rand() - 0.5) + 8 * Math.sin(16 * a + 3 * b) * Math.cos(b * 11);
      const k = (y * c.width + x) * 4;
      im.data.set([155 + grit + 24 * oxide, 165 + grit - 12 * oxide, 162 + grit - 29 * oxide, 255], k);
    }
  ctx.putImageData(im, 0, 0);
  for (let i = 0; i < 1100; i++) {
    const x = rand() * 256,
      y = rand() * 192,
      rx = 0.35 + rand() ** 3 * 2.1;
    ctx.fillStyle = 'rgba(78,69,48,.29)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.7, 1.1, 0, tau);
    ctx.fill();
  }
  for (const x of [0, 128]) {
    ctx.fillStyle = '#62615b';
    ctx.fillRect(x, 33, 1.8, 130);
    ctx.fillStyle = '#b9b6a1';
    ctx.fillRect(x + 2, 33, 1.1, 130);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Short cast-iron half shells protect the shore end through the surf zone.
// Their overlapping sockets pivot independently over the slope.
export function shoreEndProtection(parent, curves) {
  const geometry = new THREE.LatheGeometry(
    [
      [0.161, -0.214],
      [0.185, -0.214],
      [0.196, -0.196],
      [0.197, -0.158],
      [0.187, -0.141],
      [0.185, 0.103],
      [0.178, 0.133],
      [0.169, 0.167],
      [0.166, 0.215],
      [0.157, 0.215],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );
  const flange = new THREE.BoxGeometry(0.075, 0.19, 0.052);
  const bolt = new THREE.CylinderGeometry(0.023, 0.023, 0.013, 6);
  const solids = [],
    fasteners = [],
    axis = new THREE.Vector3(0, 1, 0);
  const pose = new THREE.Object3D(),
    part = new THREE.Object3D();
  function progressAtX(curve, x) {
    let lo = 0,
      hi = 1;
    for (let j = 0; j < 20; j++) {
      const mid = (lo + hi) * 0.5;
      if (curve.getPointAt(mid).x < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) * 0.5;
  }
  for (const c of curves)
    for (const start of [130.2, 246.5]) {
      const origin = progressAtX(c, start),
        len = c.getLength();
      for (let k = 0; k < 12; k++) {
        const u = origin + (k * 0.381) / len;
        pose.position.copy(c.getPointAt(u));
        pose.quaternion.setFromUnitVectors(axis, c.getTangentAt(u));
        pose.updateMatrix();
        solids.push(pose.matrix.clone());
        for (const side of [-1, 1]) {
          part.position.set(0.183 * side, -0.041, 0.022);
          part.rotation.set(0, 0, 0);
          part.updateMatrix();
          fasteners.push(pose.matrix.clone().multiply(part.matrix));
        }
      }
    }
  function instance(g, mat, list, name) {
    const group = new THREE.InstancedMesh(g, mat, list.length);
    group.name = name;
    list.forEach((m, i) => group.setMatrixAt(i, m));
    group.computeBoundingSphere();
    parent.add(group);
  }
  const iron = new THREE.MeshStandardMaterial({
    map: castIronFinish(),
    color: 0x949b8e,
    metalness: 0.46,
    roughness: 0.68,
  });
  instance(geometry, iron, solids, 'Articulated shore-end cable protection');
  instance(flange, iron, fasteners, 'Split conduit lugs');
  const heads = fasteners.map((m) => {
    part.position.set(0, -0.047, 0.027);
    part.rotation.set(Math.PI / 2, 0, 0);
    part.updateMatrix();
    return m.clone().multiply(part.matrix);
  });
  instance(
    bolt,
    new THREE.MeshStandardMaterial({ color: 0x989783, metalness: 0.55, roughness: 0.66 }),
    heads,
    'Shore-end locking pins',
  );
}
