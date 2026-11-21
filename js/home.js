// Local +z is the outside of the office window, facing the returning camera.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rugMap, landscapePrint, brickMap, gardenMask, contactShadow } from './home-textiles.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const matte = (color, roughness = 0.82, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...options });
const halfPi = Math.PI / 2;
function group(parent, x = 0, y = 0, z = 0, angle = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  parent.add(g);
  return g;
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function box(p, x, y, z, w, h, d, mat, r = 0) {
  return mesh(p, r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
function turned(p, x, y, z, top, bottom, height, mat, n = 16) {
  return mesh(p, new THREE.CylinderGeometry(top, bottom, height, n), mat, x, y, z);
}
function rod(p, a, b, r, mat, tip = r, n = 10) {
  const v = V(...a),
    d = V(...b).sub(v),
    c = v.addScaledVector(d, 0.5);
  const m = turned(p, c.x, c.y, c.z, tip, r, d.length(), mat, n);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}
function seed(value) {
  return () => (value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function flat(p, x, y, z, w, h, mat) {
  return mesh(p, new THREE.PlaneGeometry(w, h), mat, x, y, z);
}

// The cottage is static. Batch by finish within each area so books, boards and
// planting do not add a draw call apiece during the fast return.
function batch(part) {
  part.updateWorldMatrix(true, true);
  const inv = part.matrixWorld.clone().invert(),
    transform = new THREE.Matrix4(),
    sets = new Map();
  part.traverse((m) => {
    if (!m.isMesh) return;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    geo.applyMatrix4(transform.multiplyMatrices(inv, m.matrixWorld));
    if (!sets.has(m.material)) sets.set(m.material, []);
    sets.get(m.material).push(geo);
    if (geo !== m.geometry) m.geometry.dispose();
  });
  part.clear();
  for (const [mat, geos] of sets) {
    const merged = mergeGeometries(geos);
    merged.computeBoundingSphere();
    const m = mesh(part, merged, mat);
    m.castShadow = !mat.transparent;
    m.receiveShadow = true;
    geos.forEach((g) => g.dispose());
  }
}

function frame(p, x, y, z, w, h, t, d, mat) {
  box(p, x, y + (h - t) / 2, z, w, t, d, mat);
  box(p, x, y - (h - t) / 2, z, w, t, d, mat);
  for (const sign of [-1, 1]) box(p, x + (sign * (w - t)) / 2, y, z, t, h - 2 * t, d, mat);
}

function gable(p, width, base, peak, depth, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, peak - base);
  shape.closePath();
  mesh(p, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat, 0, base, -depth / 2);
}

// Front and back rake boards follow the roof pitch, with a separate tiled top surface.
function roof(p, m, width, wallBase, peak, depth, overhang, capSpacing = 0.31) {
  const pitch = (peak - wallBase) / (width / 2),
    angle = Math.atan(pitch);
  const run = width / 2 + overhang,
    rise = run * pitch,
    span = Math.hypot(run, rise),
    length = depth + overhang * 2;
  gable(p, width, wallBase - 0.025, peak, depth, m.gable);
  for (const side of [-1, 1]) {
    const slope = group(p, (side * run) / 2, peak - rise / 2, 0);
    slope.rotation.z = -side * angle;
    box(slope, 0, -0.035, 0, span, 0.07, length, m.cream);
    const top = flat(slope, 0, 0.002, 0, length, span, m.tile);
    top.rotation.order = 'YXZ';
    top.rotation.set(-halfPi, side > 0 ? -halfPi : halfPi, 0, 'YXZ');
    const uv = top.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * length) / 2, (uv.getY(i) * span) / 2);
    for (const end of [-1, 1]) box(slope, 0, -0.037, (end * length) / 2, span + 0.045, 0.096, 0.047, m.cream);
    box(p, side * run, peak - rise - 0.06, 0, 0.062, 0.105, length, m.cream);
  }
  for (let d = -length / 2 + capSpacing / 2; d < length / 2; d += capSpacing) {
    const cap = turned(p, 0, peak + 0.008, d, 0.081, 0.096, capSpacing + 0.022, m.clay, 12);
    cap.rotation.x = halfPi;
  }
}

function frontWindow(p, m, x, y, z, w, h, glass = true) {
  frame(p, x, y, z, w + 0.15, h + 0.16, 0.079, 0.082, m.cream);
  box(p, x, y - h / 2 - 0.058, z + 0.034, w + 0.26, 0.073, 0.15, m.cream);
  box(p, x, y + h / 2 + 0.07, z + 0.015, w + 0.22, 0.064, 0.12, m.cream);
  if (glass) {
    flat(p, x, y, z - 0.04, w, h, m.window);
    box(p, x, y, z + 0.004, 0.036, h, 0.038, m.cream);
    box(p, x, y + 0.04, z + 0.004, w, 0.031, 0.038, m.cream);
  }
}
function siding(p, m, width, z, top, opening) {
  for (let row = 0; row < Math.ceil(top / 0.147); row++) {
    const bottom = row * 0.147,
      height = Math.min(0.147, top - bottom);
    const cuts =
      opening && bottom + height > opening.bottom && bottom < opening.top
        ? [
            [-width / 2, opening.left],
            [opening.right, width / 2],
          ]
        : [[-width / 2, width / 2]];
    for (const [a, b] of cuts) {
      const plank = box(p, (a + b) / 2, bottom + height / 2, z, b - a, height + 0.005, 0.031, m.boards[row % 3]);
      plank.rotation.x = -0.082;
    }
  }
}
function cedarShakes(p, m) {
  const halfWidth = 2.15,
    height = 1.37,
    base = 2.75,
    course = 0.155;
  const rnd = seed(623);
  for (let bottom = 0; bottom < height; bottom += course) {
    const top = Math.min(height, bottom + course);
    const lo = halfWidth * (1 - bottom / height),
      hi = halfWidth * (1 - top / height);
    let x = -lo;
    while (x < lo) {
      const end = Math.min(lo, x + 0.18 + rnd() * 0.1);
      const a = Math.max(-hi, Math.min(hi, x)),
        b = Math.max(-hi, Math.min(hi, end));
      const vertices = [
        x,
        base + bottom,
        2.174,
        end,
        base + bottom,
        2.174,
        b,
        base + top,
        2.157,
        a,
        base + top,
        2.157,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      mesh(p, geo, m.shakes[Math.floor(rnd() * m.shakes.length)]);
      x = end + 0.005;
    }
  }
}
function entryDoor(p, m, x, z) {
  box(p, x, 1.14, z, 0.88, 1.98, 0.064, m.door);
  frame(p, x, 1.15, z + 0.013, 1.04, 2.12, 0.079, 0.105, m.cream);
  frame(p, x, 0.72, z + 0.038, 0.66, 0.8, 0.039, 0.026, m.raised);
  flat(p, x, 1.63, z + 0.034, 0.59, 0.53, m.window);
  frame(p, x, 1.63, z + 0.044, 0.66, 0.61, 0.045, 0.035, m.raised);
  box(p, x, 1.63, z + 0.051, 0.027, 0.54, 0.024, m.raised);
  box(p, x, 1.63, z + 0.051, 0.6, 0.024, 0.024, m.raised);
  box(p, x + 0.315, 1.07, z + 0.05, 0.046, 0.153, 0.023, m.brass, 0.005);
  rod(p, [x + 0.315, 1.075, z + 0.057], [x + 0.315, 1.075, z + 0.103], 0.012, m.brass);
  rod(p, [x + 0.315, 1.075, z + 0.103], [x + 0.225, 1.075, z + 0.103], 0.011, m.brass);
}
function lantern(p, m, x, y, z) {
  box(p, x, y, z, 0.104, 0.22, 0.04, m.iron);
  rod(p, [x, y + 0.085, z], [x, y + 0.14, z + 0.12], 0.013, m.iron);
  turned(p, x, y + 0.085, z + 0.13, 0, 0.09, 0.09, m.iron, 4).rotation.y = Math.PI / 4;
  box(p, x, y - 0.033, z + 0.13, 0.105, 0.16, 0.105, m.warm);
  for (const s of [-1, 1])
    for (const t of [-1, 1]) box(p, x + s * 0.059, y - 0.03, z + 0.13 + t * 0.059, 0.011, 0.17, 0.011, m.iron);
  box(p, x, y - 0.13, z + 0.13, 0.15, 0.025, 0.15, m.iron);
}
function exterior(p, m) {
  // Main office gable, open window and two louvered shutters.
  roof(p, m, 4.3, 2.75, 4.12, 4.3, 0.25);
  cedarShakes(p, m);
  siding(p, m, 4.3, 2.166, 2.73, { left: -0.75, right: 0.75, bottom: 1, top: 2.1 });
  for (const sign of [-1, 1]) {
    const side = group(p, sign * 2.164, 0, 0, sign * halfPi);
    siding(side, m, 4.3, 0, 2.72);
    box(p, sign * 2.089, 1.35, 2.193, 0.124, 2.7, 0.056, m.cream);
    box(p, sign * 1.082, 1.55, 2.208, 0.34, 1.17, 0.056, m.door);
    frame(p, sign * 1.082, 1.55, 2.239, 0.34, 1.17, 0.038, 0.029, m.raised);
    for (let i = 0; i < 12; i++)
      box(p, sign * 1.082, 1.055 + i * 0.089, 2.241, 0.265, 0.058, 0.032, m.raised).rotation.x = -0.32;
    const down = sign * 2.2;
    rod(p, [down, 2.47, 1.91], [down, 0.15, 1.91], 0.035, m.iron);
    rod(p, [down, 0.15, 1.91], [down + sign * 0.115, 0.075, 1.91], 0.036, m.iron);
  }
  frontWindow(p, m, 0, 1.55, 2.191, 1.5, 1.1, false);
  box(p, 0, 2.72, 2.19, 4.44, 0.115, 0.065, m.cream);
  box(p, 0, 3.22, 2.169, 0.53, 0.4, 0.035, m.iron);
  frame(p, 0, 3.22, 2.195, 0.58, 0.45, 0.047, 0.047, m.cream);
  for (let i = 0; i < 5; i++) box(p, 0, 3.07 + i * 0.075, 2.197, 0.48, 0.045, 0.052, m.raised).rotation.x = -0.2;

  const chimney = box(p, 0.99, 3.88, -0.9, 0.48, 1.73, 0.57, m.brick);
  chimney.geometry.attributes.uv.array.forEach((v, i, a) => {
    a[i] = v * (i % 2 ? 2.3 : 0.85);
  });
  box(p, 0.99, 4.76, -0.9, 0.58, 0.105, 0.68, m.stone);
  for (const z of [-1.05, -0.76]) {
    turned(p, 0.99, 4.89, z, 0.078, 0.105, 0.25, m.clay);
    turned(p, 0.99, 5.03, z, 0.1, 0.1, 0.06, m.clay);
    turned(p, 0.99, 5.066, z, 0.071, 0.071, 0.013, m.iron);
  }

  // A perpendicular wing and sheltered front door change the roofline and announce the entrance.
  const wing = group(p, -3.18, 0, -0.42);
  box(wing, 0, 1.23, 0, 2.73, 2.46, 3.94, m.gable);
  const crossing = group(wing, 0, 0, 0, halfPi);
  roof(crossing, m, 3.94, 2.46, 3.57, 2.73, 0.17);
  const front = 1.986;
  siding(wing, m, 2.73, front, 2.44, { left: 0.02, right: 0.97, bottom: 0.12, top: 2.15 });
  for (const x of [-1.3, 1.3]) box(wing, x, 1.22, front + 0.03, 0.1, 2.44, 0.06, m.cream);
  frontWindow(wing, m, -0.72, 1.37, front + 0.04, 0.75, 0.94);
  entryDoor(wing, m, 0.5, front + 0.033);
  lantern(wing, m, -0.101, 1.78, front + 0.059);
  const porch = group(wing, 0.48, 0, front + 0.47);
  box(porch, 0, 0.076, 0, 1.74, 0.16, 1.17, m.stone);
  box(porch, 0, 0.04, 0.72, 1.65, 0.08, 0.38, m.pavers[1]);
  roof(porch, m, 1.75, 2.17, 2.63, 1.12, 0.105);
  for (const x of [-0.74, 0.74]) {
    box(porch, x, 1.16, 0.45, 0.088, 2.02, 0.088, m.cream);
    box(porch, x, 0.31, 0.45, 0.15, 0.31, 0.15, m.gable);
    rod(porch, [x, 1.83, 0.45], [x - Math.sign(x) * 0.26, 2.14, 0.45], 0.033, m.cream, 0.033, 4);
  }
}

function shelvedBooks(p, m, x, y, z, width, rnd) {
  let offset = 0.018;
  while (offset < width - 0.055) {
    const spine = 0.035 + rnd() * 0.044,
      h = 0.19 + rnd() * 0.102,
      d = 0.135 + rnd() * 0.049;
    if (offset + spine > width) break;
    const book = group(p, x + offset, y, z + (rnd() - 0.5) * 0.027);
    box(book, spine / 2, h / 2, 0, spine, h, d, m.books[Math.floor(rnd() * m.books.length)]);
    const label = m.bookBand;
    if (rnd() > 0.26) {
      box(book, spine / 2, h * 0.77, d / 2 + 0.001, spine * 0.69, 0.006, 0.003, label);
      box(book, spine / 2, h * 0.7, d / 2 + 0.001, spine * 0.52, 0.005, 0.003, label);
    }
    box(book, spine / 2, h / 2 + 0.001, -0.002, spine * 0.82, h, d * 0.92, m.pages);
    offset += spine + 0.005 + rnd() * 0.007;
  }
}
function bookcase(p, m, rnd) {
  const cabinet = group(p, 0.91, 0, -1.78),
    w = 1.67;
  box(cabinet, 0, 1.04, -0.17, w, 2.08, 0.043, m.door);
  for (const x of [-w / 2, w / 2]) box(cabinet, x, 1.045, 0, 0.046, 2.09, 0.36, m.wood);
  for (const y of [0.085, 0.7, 1.08, 1.48, 1.88, 2.1]) box(cabinet, 0, y, 0, w + 0.045, 0.041, 0.38, m.wood);
  box(cabinet, 0, 0.041, 0, w - 0.052, 0.082, 0.31, m.iron);
  box(cabinet, 0, 0.358, 0.008, w - 0.05, 0.6, 0.31, m.door);
  for (const x of [-0.415, 0.415]) {
    box(cabinet, x, 0.37, 0.175, 0.797, 0.55, 0.035, m.raised);
    frame(cabinet, x, 0.37, 0.2, 0.774, 0.53, 0.039, 0.022, m.door);
    box(cabinet, x - Math.sign(x) * 0.287, 0.53, 0.226, 0.066, 0.012, 0.025, m.brass);
  }
  shelvedBooks(cabinet, m, -0.77, 0.722, 0.067, 0.95, rnd);
  shelvedBooks(cabinet, m, 0.03, 1.101, 0.06, 0.73, rnd);
  shelvedBooks(cabinet, m, -0.76, 1.5, 0.05, 0.78, rnd);
  for (let i = 0; i < 3; i++) {
    const stack = box(
      cabinet,
      0.43,
      0.75 + i * 0.048,
      0.06,
      0.36 - i * 0.025,
      0.045,
      0.19,
      m.books[(i + 2) % m.books.length],
    );
    stack.rotation.y = (i - 1) * 0.07;
  }
  for (let i = 0; i < 2; i++) {
    box(cabinet, -0.48, 1.152 + i * 0.114, 0.042, 0.43, 0.105, 0.255, m.canvas, 0.014);
    box(cabinet, -0.48, 1.16 + i * 0.114, 0.173, 0.095, 0.031, 0.008, m.brass);
  }
  turned(cabinet, 0.43, 1.567, 0.047, 0.075, 0.09, 0.135, m.ceramic, 32);
  turned(cabinet, 0.43, 1.665, 0.047, 0.039, 0.075, 0.064, m.ceramic, 32);
  turned(cabinet, 0.43, 1.705, 0.047, 0.044, 0.038, 0.025, m.ceramic, 32);
}
function readingChair(p, m) {
  const chair = group(p, -0.98, 0, -0.89, 0.3);
  for (const x of [-0.29, 0.29])
    for (const z of [-0.255, 0.26]) {
      rod(chair, [x * 1.21, 0.04, z * 1.18], [x, 0.4, z], 0.035, m.wood, 0.044);
    }
  box(chair, 0, 0.37, 0, 0.67, 0.1, 0.62, m.wood, 0.045);
  box(chair, 0, 0.467, 0.014, 0.66, 0.18, 0.63, m.linen, 0.075);
  box(chair, 0, 0.745, -0.262, 0.67, 0.55, 0.175, m.linen, 0.065).rotation.x = -0.17;
  for (const s of [-1, 1]) {
    rod(chair, [s * 0.348, 0.33, 0.235], [s * 0.348, 0.67, 0.205], 0.021, m.wood);
    rod(chair, [s * 0.348, 0.37, -0.265], [s * 0.348, 0.7, -0.27], 0.026, m.wood);
    box(chair, s * 0.35, 0.68, -0.004, 0.07, 0.048, 0.61, m.wood, 0.023).rotation.x = 0.065;
  }
  box(chair, 0.025, 0.659, -0.129, 0.4, 0.245, 0.12, m.gingham, 0.056).rotation.set(-0.25, 0, 0.06);
}
function deskChair(p, m) {
  // Pulled slightly to one side of the desk. The optical axis to the phone stays clear.
  const chair = group(p, 0.54, 0, 0.71, -0.34);
  turned(chair, 0, 0.29, 0, 0.035, 0.035, 0.3, m.iron);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = 0.275 * Math.cos(a),
      z = 0.275 * Math.sin(a);
    rod(chair, [0, 0.151, 0], [x, 0.079, z], 0.02, m.iron, 0.014);
    const wheel = turned(chair, x, 0.049, z, 0.04, 0.04, 0.045, m.iron);
    wheel.rotation.set(halfPi, a, 0, 'YXZ');
  }
  box(chair, 0, 0.406, -0.002, 0.465, 0.06, 0.467, m.wood, 0.026);
  box(chair, 0, 0.453, 0.004, 0.47, 0.102, 0.475, m.leather, 0.048);
  box(chair, 0, 0.428, 0.004, 0.471, 0.011, 0.476, m.welt, 0.005);
  rod(chair, [0, 0.4, -0.165], [0, 0.7, -0.244], 0.021, m.iron);
  const back = group(chair, 0, 0.749, -0.23);
  back.rotation.x = -0.14;
  box(back, 0, 0, -0.008, 0.442, 0.422, 0.062, m.wood, 0.029);
  box(back, 0, 0, 0.018, 0.436, 0.415, 0.064, m.welt, 0.031);
  for (let i = 0; i < 3; i++) {
    const cy = (i - 1) * 0.128;
    box(back, 0, cy, 0.042, 0.425, 0.132, 0.07, m.leather, 0.031);
    for (let j = 0; j < 24; j++) box(back, (j - 11.5) * 0.015, cy - 0.047, 0.075, 0.008, 0.0017, 0.002, m.stitch);
  }
  for (const s of [-1, 1]) {
    rod(chair, [s * 0.188, 0.412, 0.105], [s * 0.246, 0.61, 0.11], 0.014, m.iron);
    box(chair, s * 0.243, 0.625, 0.017, 0.042, 0.038, 0.245, m.leather, 0.015);
  }
}
function framedPrint(p, m, x, y, z, w, h) {
  box(p, x, y, z, w, h, 0.041, m.wood);
  flat(p, x, y, z + 0.024, w - 0.043, h - 0.043, m.matBoard);
  flat(p, x, y, z + 0.026, w * 0.84, h * 0.8, m.print);
  frame(p, x, y, z + 0.035, w, h, 0.024, 0.032, m.wood);
}
function moldedDoor(p, m) {
  const door = group(p, -1.974, 0, -0.03, halfPi);
  box(door, 0, 1.02, 0, 0.82, 2.04, 0.032, m.door);
  frame(door, 0, 1.055, 0.015, 0.94, 2.13, 0.067, 0.063, m.cream);
  for (const [y, h] of [
    [0.56, 0.72],
    [1.46, 0.85],
  ])
    frame(door, 0, y, 0.027, 0.63, h, 0.03, 0.024, m.raised);
  box(door, 0.302, 1.036, 0.052, 0.044, 0.139, 0.022, m.brass);
  rod(door, [0.302, 1.04, 0.096], [0.204, 1.04, 0.096], 0.012, m.brass);
}
function indoorLamp(p, m) {
  const g = group(p, -1.53, 0, -1.39);
  turned(g, 0, 0.034, 0, 0.149, 0.16, 0.05, m.brass, 32);
  rod(g, [0, 0.054, 0], [0, 1.49, 0], 0.014, m.brass);
  turned(g, 0, 1.415, 0, 0.146, 0.224, 0.255, m.shade, 40);
  turned(g, 0, 1.289, 0, 0.218, 0.218, 0.005, m.warm, 40);
  turned(g, 0, 1.55, 0, 0.029, 0.029, 0.032, m.brass);
}
function office(p, m) {
  for (const s of [-1, 1]) {
    box(p, s * 1.985, 0.067, 0, 0.032, 0.134, 4, m.cream);
    box(p, 0, 0.067, s * 1.985, 4, 0.134, 0.032, m.cream);
    box(p, s * 1.97, 2.555, 0, 0.06, 0.088, 4, m.cream);
    box(p, 0, 2.555, s * 1.97, 4, 0.088, 0.06, m.cream);
  }
  // The return looks down through the window. Give the floor a readable pattern at that steep angle.
  const rug = flat(p, 0, 0.012, -0.015, 2.92, 2.45, m.rug);
  rug.rotation.x = -halfPi;
  const rng = seed(592);
  for (const sign of [-1, 1])
    for (let j = 0; j < 70; j++) {
      const x = -1.445 + (j * 2.89) / 69;
      box(p, x, 0.012, sign * 1.237 - 0.015, 0.011, 0.007, 0.048 + rng() * 0.022, m.pages).rotation.y =
        (rng() - 0.5) * 0.3;
    }
  for (const [x, z, w, d] of [
    [0.54, 0.71, 0.9, 0.78],
    [-0.98, -0.89, 1.09, 1.04],
    [-1.49, -0.43, 0.48, 0.45],
    [1.53, 0.08, 0.51, 0.47],
    [0.91, -1.78, 2.12, 0.74],
  ]) {
    flat(p, x, 0.018, z, w, d, m.shadow).rotation.x = -halfPi;
  }
  framedPrint(p, m, -0.97, 1.65, -1.958, 1.18, 0.85);
  moldedDoor(p, m);
  bookcase(p, m, rng);
  readingChair(p, m);
  deskChair(p, m);
  indoorLamp(p, m);
  const table = group(p, -1.49, 0, -0.43);
  turned(table, 0, 0.5, 0, 0.226, 0.226, 0.037, m.wood, 32);
  turned(table, 0, 0.248, 0, 0.039, 0.066, 0.47, m.wood);
  turned(table, 0, 0.042, 0, 0.147, 0.157, 0.052, m.wood);
  box(table, -0.04, 0.545, 0, 0.198, 0.042, 0.132, m.books[2]).rotation.y = 0.27;
  turned(table, 0.094, 0.574, 0.049, 0.041, 0.033, 0.106, m.ceramic, 20);
  turned(table, 0.094, 0.628, 0.049, 0.034, 0.034, 0.003, m.iron, 20);
  const handle = mesh(table, new THREE.TorusGeometry(0.027, 0.005, 7, 14), m.ceramic, 0.136, 0.587, 0.049);
  handle.scale.x = 0.81;
}

// Fold each blade around a central vein. All the foliage in a bed shares one mesh.
function leaves() {
  const pos = [],
    colors = [],
    index = [];
  return {
    add(base, delta, width, arch, color, twist = 0) {
      const b = V(...base),
        d = V(...delta),
        side = V(-d.z, 0, d.x).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      side.applyAxisAngle(d.clone().normalize(), twist);
      const start = pos.length / 3,
        c = new THREE.Color(color);
      for (let j = 0; j <= 5; j++) {
        const t = j / 5,
          s = Math.sin(Math.PI * t),
          axis = b.clone().addScaledVector(d, t);
        axis.y += arch * s;
        for (const k of [-1, 0, 1]) {
          const point = axis.clone().addScaledVector(side, k * width * s);
          point.y -= Math.abs(k) * width * 0.29 * s;
          const shade = 0.74 + t * 0.24 + (k === 0 ? 0.11 : -0.025);
          pos.push(point.x, point.y, point.z);
          colors.push(c.r * shade, c.g * shade, c.b * shade);
        }
        if (j === 5) break;
        const r = start + j * 3;
        index.push(r, r + 3, r + 1, r + 1, r + 3, r + 4, r + 1, r + 4, r + 2, r + 2, r + 4, r + 5);
      }
    },
    finish(p, mat) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      mesh(p, geo, mat);
    },
  };
}
function floorPlant(p, m) {
  const pot = group(p, 1.53, 0, 0.08),
    l = leaves(),
    r = seed(4772);
  turned(pot, 0, 0.199, 0, 0.155, 0.117, 0.37, m.ceramic, 32);
  turned(pot, 0, 0.386, 0, 0.165, 0.16, 0.041, m.ceramic, 32);
  turned(pot, 0, 0.406, 0, 0.146, 0.146, 0.006, m.soil, 24);
  for (let j = 0; j < 4; j++) {
    const a = j * 2.38,
      dx = Math.cos(a) * 0.106,
      dz = Math.sin(a) * 0.11,
      h = 1.04 + r() * 0.43;
    rod(pot, [0, 0.39, 0], [dx, h, dz], 0.011, m.branch, 0.004);
    for (let k = 0; k < 7; k++) {
      const t = 0.27 + k * 0.105,
        az = k * 2.4 + a,
        L = 0.18 + r() * 0.146;
      l.add(
        [dx * t, 0.4 + (h - 0.4) * t, dz * t],
        [Math.cos(az) * L, 0.075 - t * 0.033, Math.sin(az) * L],
        0.042 + r() * 0.026,
        0.088,
        k % 3 ? 0x466448 : 0x6c825d,
        (r() - 0.5) * 0.85,
      );
    }
  }
  l.finish(pot, m.foliage);
}
function garden(p, m) {
  const rnd = seed(1704),
    l = leaves();
  flat(p, -0.65, -0.011, 0.92, 13.8, 14.1, m.lawn).rotation.x = -halfPi;
  function bed(x, z, w, d) {
    box(p, x, 0.016, z, w, 0.042, d, m.soil);
    for (const s of [-1, 1]) {
      box(p, x + (s * w) / 2, 0.052, z, 0.062, 0.086, d + 0.062, m.edging);
      box(p, x, 0.052, z + (s * d) / 2, w, 0.086, 0.062, m.edging);
    }
  }
  function grass(x, z, size) {
    for (let i = 0; i < 35; i++) {
      const a = rnd() * Math.PI * 2,
        r = 0.08 * rnd() * size,
        reach = (0.08 + rnd() * 0.2) * size;
      l.add(
        [x + r * Math.cos(a), 0.048, z + r * Math.sin(a)],
        [Math.cos(a) * reach, size * (0.1 + rnd() * 0.23), Math.sin(a) * reach],
        size * (0.007 + rnd() * 0.009),
        size * 0.075,
        [0x65754b, 0x8e925d, 0x566b47][i % 3],
        (rnd() - 0.5) * 1.7,
      );
    }
  }
  function lavender(x, z, size) {
    grass(x, z, size * 0.84);
    for (let i = 0; i < 11; i++) {
      const a = rnd() * Math.PI * 2,
        r = size * (0.045 + rnd() * 0.125),
        y = size * (0.28 + rnd() * 0.16);
      const dx = Math.cos(a) * r,
        dz = Math.sin(a) * r;
      rod(p, [x, 0.05, z], [x + dx, y, z + dz], 0.004, m.branch, 0.002, 5);
      rod(
        p,
        [x + dx * 0.95, y - 0.012, z + dz * 0.95],
        [x + dx * 1.19, y + size * 0.085, z + dz * 1.19],
        size * 0.012,
        m.bloom,
        0.003,
        5,
      );
    }
  }
  bed(0, 2.52, 4.23, 0.64);
  bed(2.49, 0.42, 0.52, 4.6);
  for (let i = 0; i < 16; i++) {
    const x = -1.94 + i * 0.252,
      z = 2.51 + (rnd() - 0.5) * 0.22,
      s = 0.65 + rnd() * 0.55;
    if (i % 3 === 0) lavender(x, z, s);
    else grass(x, z, s);
  }
  for (let i = 0; i < 14; i++) grass(2.48 + (rnd() - 0.5) * 0.22, -1.65 + i * 0.3, 0.72 + rnd() * 0.58);
  // An offset stone path leads to the porch and stays out of the office's window view.
  for (let j = 0; j < 11; j++) {
    const z = 3.01 + j * 0.44,
      cx = -2.7 - j * 0.052 - 0.39 * Math.sin(j * 0.26);
    for (let i = 0; i < 2; i++) {
      const slab = box(
        p,
        cx + (i - 0.5) * 0.55,
        0.026,
        z + (i - 0.5) * 0.012,
        0.54,
        0.065,
        0.418,
        m.pavers[(i + j) % 3],
        0.016,
      );
      slab.rotation.y = 0.03 * Math.cos(j * 0.28);
    }
  }
  for (let i = 0; i < 2; i++) {
    const x = -3.91 + i * 2.12,
      z = 2.71;
    turned(p, x, 0.17, z, 0.167, 0.123, 0.32, m.clay, 24);
    turned(p, x, 0.335, z, 0.176, 0.171, 0.045, m.clay, 24);
    turned(p, x, 0.359, z, 0.154, 0.154, 0.005, m.soil);
    for (let j = 0; j < 40; j++) {
      const a = rnd() * Math.PI * 2,
        L = 0.085 + rnd() * 0.166;
      l.add(
        [x, 0.35, z],
        [Math.cos(a) * L, 0.1 + rnd() * 0.26, Math.sin(a) * L],
        0.018 + rnd() * 0.027,
        0.08,
        j % 4 ? 0x677844 : 0x8e9c66,
      );
    }
  }
  // A waist-high timber fence and a compact multi-stem serviceberry frame the right edge of the house.
  const fence = group(p, 3.47, 0, -0.1);
  for (let j = 0; j < 4; j++) {
    const z = -2.1 + j * 1.35;
    box(fence, 0, 0.41, z, 0.083, 0.83, 0.083, m.edging);
    box(fence, 0, 0.842, z, 0.105, 0.052, 0.105, m.cream);
  }
  for (const y of [0.27, 0.61]) box(fence, 0, y, -0.08, 0.062, 0.075, 4.07, m.edging);
  const tx = 3.1,
    tz = 1.09;
  for (let i = 0; i < 8; i++) {
    const a = i * 2.36,
      R = 0.3 + rnd() * 0.26,
      h = 1.53 + rnd() * 0.69;
    const tip = [tx + Math.cos(a) * R, h, tz + Math.sin(a) * R];
    const fork = [tx + Math.cos(a) * 0.13, 0.63 + rnd() * 0.21, tz + Math.sin(a) * 0.13];
    rod(p, [tx, 0.04, tz], fork, 0.028, m.branch, 0.02, 7);
    rod(p, fork, tip, 0.019, m.branch, 0.007, 7);
    for (let k = 0; k < 9; k++) {
      const t = 0.35 + k * 0.075,
        base = V(...fork).lerp(V(...tip), t),
        b = a + k * 2.34,
        L = 0.19 + rnd() * 0.23;
      const end = base.clone().add(V(Math.cos(b) * L, 0.12 + rnd() * 0.1, Math.sin(b) * L));
      rod(p, base.toArray(), end.toArray(), 0.0045, m.branch, 0.002, 5);
      for (let j = 0; j < 6; j++) {
        const at = base.clone().lerp(end, (j + 1) / 6),
          f = b + (j % 2 ? -0.96 : 0.96);
        l.add(
          at.toArray(),
          [0.135 * Math.cos(f), 0.025, 0.135 * Math.sin(f)],
          0.041,
          0.041,
          j % 4 ? 0x6f8249 : 0x8b9358,
        );
      }
    }
  }
  l.finish(p, m.foliage);
}

export function createHomeDetails(scene, tile, woodMap) {
  const loader = new THREE.TextureLoader();
  const texture = (file, color = true) => {
    const t = loader.load(new URL('../assets/' + file, import.meta.url).href);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const hide = texture('home/leather.jpg'),
    grain = texture('home/leather-normal.jpg', false);
  const cloth = texture('home/linen-normal.jpg', false),
    checks = texture('home/gingham.jpg');
  const grass = texture('home/lawn.jpg');
  grass.repeat.set(6, 6);
  const m = {
    shakes: [0xa8977d, 0xa39178, 0x9c8b73, 0xad9c81].map((c) => matte(c, 0.93)),
    lawn: matte(new THREE.Color(1.4, 2.09, 1.3), 0.98, {
      map: grass,
      alphaMap: gardenMask(),
      opacity: 0.78,
      transparent: true,
      depthWrite: false,
    }),
    shadow: new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }),
    tile,
    wood: matte(0xffead1, 0.64, { map: woodMap }),
    boards: [0x869789, 0x89998b, 0x849687].map((c) => matte(c)),
    gable: matte(0xced1bb),
    cream: matte(0xebe1c9, 0.66),
    door: matte(0x405d55, 0.61),
    raised: matte(0x546d61, 0.64),
    clay: matte(0x9c5e40),
    brick: matte(0xe6d4c8, 0.93, { map: brickMap() }),
    stone: matte(0xb3a998),
    window: matte(0x657e80, 0.25, { metalness: 0.29, envMapIntensity: 0.58 }),
    iron: matte(0x373d39, 0.48, { metalness: 0.43 }),
    brass: matte(0xb28a55, 0.38, { metalness: 0.58 }),
    linen: matte(0x879285, 0.96, { normalMap: cloth, normalScale: new THREE.Vector2(0.56, 0.56) }),
    gingham: matte(0xf4d9c6, 0.93, { map: checks, normalMap: cloth, normalScale: new THREE.Vector2(0.35, 0.35) }),
    leather: matte(new THREE.Color(1.84, 1.69, 1.53), 0.59, {
      map: hide,
      normalMap: grain,
      normalScale: new THREE.Vector2(0.6, 0.6),
    }),
    welt: matte(0x513c31, 0.72),
    stitch: matte(0xb08b65),
    shade: matte(0xe9d7ae, 0.86, { emissive: 0x987049, emissiveIntensity: 0.14 }),
    warm: matte(0xffe9bb, 0.6, { emissive: 0xffd298, emissiveIntensity: 0.65 }),
    ceramic: matte(0xc5b295, 0.58),
    canvas: matte(0xbaad90),
    books: [0x506b71, 0xbd8667, 0x67785b, 0xae9b76, 0x854f46, 0xd0bda4, 0x45555b].map((c) => matte(c, 0.91)),
    bookBand: matte(0xcab995),
    pages: matte(0xd9caac),
    matBoard: matte(0xece2c7),
    print: matte(0xffffff, 0.96, { map: landscapePrint() }),
    soil: matte(0x584e3c),
    edging: matte(0x857762),
    pavers: [0xb5ac96, 0xc2b8a3, 0xa69e8e].map((c) => matte(c, 0.96)),
    branch: matte(0x6b6951),
    bloom: matte(0x9286a7),
    foliage: matte(0xffffff, 0.84, { vertexColors: true, side: THREE.DoubleSide }),
  };
  m.brick.map.wrapS = m.brick.map.wrapT = THREE.RepeatWrapping;
  const weave = rugMap();
  m.rug = matte(0xffffff, 0.99, { map: weave, bumpMap: weave, bumpScale: 0.00065 });
  const root = group(scene, 0, 0, 0, halfPi);
  root.name = 'Garden cottage';
  const shell = group(root),
    yard = group(root),
    room = group(root);
  shell.name = 'Cottage exterior';
  yard.name = 'Cottage garden';
  room.name = 'Furnished home office';
  exterior(shell, m);
  garden(yard, m);
  office(room, m);
  floorPlant(room, m);
  for (const part of [shell, yard, room]) batch(part);
  // Keep the silhouette on the horizon. Shelves and individual leaves only resolve close to home.
  for (const [detail, distance] of [
    [room, 36],
    [yard, 90],
  ]) {
    const lod = new THREE.LOD();
    root.add(lod);
    lod.addLevel(detail, 0);
    lod.addLevel(new THREE.Group(), distance, 0.08);
  }
}
