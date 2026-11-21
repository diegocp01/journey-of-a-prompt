import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createOceanFish } from './ocean-fish.js';
import { createBenthicSkates } from './benthic-skate.js';

const TAU = Math.PI * 2;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
export const seaY = (x) => (x <= 130 || x >= 250 ? 0 : -14 * Math.sin((Math.PI * (x - 130)) / 120) ** 0.7);
const smooth = THREE.MathUtils.smoothstep;

function cableDistance(x, z) {
  const side = 7 * (0.15 + 0.85 * Math.sin((Math.PI * (x - 130)) / 120));
  return Math.min(Math.abs(z), Math.abs(Math.abs(z) - side));
}

export function bedHeight(x, z) {
  // Low sediment shoulders flank the three surveyed cable routes. Keep a
  // continuous contact strip for the armour, including on the coastal slopes.
  const clear = smooth(cableDistance(x, z), 0.58, 2.6);
  const shore = smooth(Math.min(x - 130, 250 - x), 0, 9);
  const folds =
    0.19 * Math.sin(x * 0.24 + z * 0.42) + 0.12 * Math.sin(z * 0.79 - x * 0.13) + 0.052 * Math.sin(0.76 * x + 0.55 * z);
  const ridge = smooth(Math.abs(z), 8, 19) * (0.52 + 0.49 * Math.sin(x * 0.13 + z * 0.23)) ** 2 * 2.9;
  const shelf = 0.036 * Math.cos(x * 3.25 + z * 1.2 + 0.9 * Math.sin(z * 0.75));
  return seaY(x) - 0.019 + clear * shore * (folds + ridge + shelf);
}

function sediment(scene) {
  const geometry = new THREE.PlaneGeometry(120, 1, 192, 104);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position,
    uv = geometry.attributes.uv,
    colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 190,
      t = pos.getZ(i) * 2;
    // Use most of the triangles within reach of the dive camera.
    const z = Math.sign(t) * (Math.abs(t) * 22 + 328 * Math.abs(t) ** 5);
    pos.setXYZ(i, x, bedHeight(x, z), z);
    uv.setXY(i, (x + 0.07 * Math.sin(0.4 * z)) / 2.15, z / 2.15);
    const patch = 0.86 + 0.08 * Math.sin(x * 0.42 + z * 0.33) + 0.06 * Math.sin(z * 0.91 - x * 0.15);
    const trench = 0.7 + 0.3 * smooth(cableDistance(x, z), 0.1, 0.48);
    colors.push(patch * trench, patch * trench, patch * trench);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const load = (filename, color) => {
    const tex = new THREE.TextureLoader().load(new URL('../assets/ocean/' + filename, import.meta.url).href);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 6;
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const material = new THREE.MeshStandardMaterial({
    color: 0xb3c4c0,
    map: load('gravelly-sand.jpg', true),
    normalMap: load('gravelly-sand-normal.jpg', false),
    normalScale: new THREE.Vector2(0.54, 0.54),
    roughness: 0.99,
    vertexColors: true,
    envMapIntensity: 0.12,
  });
  // Fine silt retains little of the source sand’s ochre at this depth.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 bedPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nbedPoint=position.xz;');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec2 bedPoint;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float silt=dot(diffuseColor.rgb,vec3(.30,.59,.11));
      diffuseColor.rgb=mix(vec3(silt*.83,silt*1.06,silt*1.08),diffuseColor.rgb,.32);
      float flow=bedPoint.x*17.+bedPoint.y*5.2+2.35*sin(bedPoint.y*.85+bedPoint.x*.22)+1.7*sin(bedPoint.x*.72-bedPoint.y*.94);
      float drift=.5+.5*sin(bedPoint.x*.48+bedPoint.y*.91+sin(bedPoint.x*.19));
      float ripple=sin(flow)*.64+sin(2.*flow-.55)*.23;
      diffuseColor.rgb*=1.+(.025+.16*drift)*ripple*(1.-smoothstep(.8,2.6,fwidth(flow)));`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'Sediment and cable beds';
  scene.add(mesh);
  return mesh;
}

function layeredRock(random, lithology) {
  const pos = [],
    colors = [],
    idx = [],
    n = 16;
  const rim = Array.from({ length: n }, () => 0.76 + random() * 0.32);
  // Bedded slabs retreat at the softer seams, while larger erratics split
  // across a diagonal face. Pebbles retain the rounder third profile.
  const strata = [
    [
      [0, 0.86],
      [0.13, 0.99],
      [0.29, 0.99],
      [0.32, 0.91],
      [0.41, 0.96],
      [0.57, 0.93],
      [0.6, 0.83],
      [0.67, 0.87],
      [0.87, 0.71],
      [0.94, 0.65],
      [1, 0.34],
    ],
    [
      [0, 0.76],
      [0.15, 1],
      [0.38, 0.98],
      [0.51, 0.89],
      [0.55, 0.93],
      [0.71, 0.88],
      [0.87, 0.64],
      [0.96, 0.39],
      [1, 0.15],
    ],
    [
      [0, 0.72],
      [0.16, 0.96],
      [0.38, 0.99],
      [0.58, 0.88],
      [0.73, 0.78],
      [0.87, 0.58],
      [0.96, 0.36],
      [1, 0.14],
    ],
  ][lithology];
  const offsets = rim.map(() => random() * 0.12 - 0.06);
  const lean = 0.11 + random() * 0.21;
  const base = new THREE.Color([0xb8b3a1, 0xaeb7b3, 0xc3c7c3][lithology]),
    seam = new THREE.Color(0x909d9d);
  strata.forEach(([h, r], k) => {
    for (let j = 0; j < n; j++) {
      const a = (j * TAU) / n;
      const scallop = 1 + 0.04 * Math.sin(3 * a + h * 3.8);
      const shear = lithology === 1 ? 0.14 * Math.max(0, Math.cos(a - 0.7)) * (1 - h) : 0;
      const x = Math.cos(a) * rim[j] * r * scallop + lean * h + shear,
        z = Math.sin(a) * rim[j] * r;
      pos.push(
        x,
        h + (0.13 * Math.sin(2 * a + 0.7) + offsets[j]) * r + (lithology === 0 ? 0.28 : 0.16) * x - 0.16 * z,
        z,
      );
      const c = base
        .clone()
        .lerp(seam, k === 3 || (lithology === 0 && k === 6) ? 0.76 : 0.12 + random() * 0.24)
        .multiplyScalar(0.76 + h * 0.34);
      colors.push(c.r, c.g, c.b);
      if (k > 0) {
        const i = k * n + j,
          next = k * n + ((j + 1) % n);
        idx.push(i - n, i, next - n, next - n, i, next);
      }
    }
  });
  for (let i = 1; i < n - 1; i++)
    idx.push((strata.length - 1) * n, (strata.length - 1) * n + i + 1, (strata.length - 1) * n + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Project each cleaved face along its dominant axis. Granite fissures then
  // run down the sides as well as across the crowns of the outcrops.
  const face = g.toNonIndexed(),
    points = face.attributes.position,
    uv = [];
  const a = v(0, 0, 0),
    b = v(0, 0, 0),
    c = v(0, 0, 0);
  for (let i = 0; i < points.count; i += 3) {
    a.fromBufferAttribute(points, i);
    b.fromBufferAttribute(points, i + 1);
    c.fromBufferAttribute(points, i + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    const top = Math.abs(n.y) > 0.55,
      side = Math.abs(n.x) > Math.abs(n.z);
    for (let j = i; j < i + 3; j++) {
      const x = points.getX(j),
        y = points.getY(j),
        z = points.getZ(j);
      uv.push((top ? x : side ? z : x) * 0.68, (top ? z : y) * 0.68);
      a.fromBufferAttribute(face.attributes.normal, j).lerp(n, 0.53).normalize();
      face.attributes.normal.setXYZ(j, a.x, a.y, a.z);
    }
  }
  face.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.dispose();
  return face;
}

function tinted(g, color) {
  const geom = g.index ? g.toNonIndexed() : g;
  if (g !== geom) g.dispose();
  geom.deleteAttribute('uv');
  const c = new THREE.Color(color),
    a = [];
  for (let i = 0; i < geom.attributes.position.count; i++) a.push(c.r, c.g, c.b);
  geom.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
  return geom;
}
function combine(parts) {
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

export function eelgrassTuft() {
  const p = [],
    color = [],
    tri = [];
  const root = new THREE.Color(0x796f45),
    leaf = new THREE.Color(0x758e55),
    tip = new THREE.Color(0x908a52);
  // Blades emerge in pairs from buried rhizomes. The midrib bows forward
  // before the thin end of each blade starts following the current.
  for (let k = 0; k < 5; k++) {
    const yaw = k * 2.39,
      dx = Math.cos(yaw),
      dz = Math.sin(yaw),
      h = 0.46 + 0.1 * (k % 4);
    const start = p.length / 3;
    for (let j = 0; j <= 10; j++) {
      const t = j / 10,
        center = 0.04 + 0.27 * t * t + 0.025 * Math.sin(5 * t + k);
      const width = 0.014 * (1 + 0.29 * Math.sin(t * Math.PI)) * (1 - t ** 5 * 0.94);
      for (let r = -1; r <= 1; r++) {
        const rib = r === 0 ? 0.0053 * Math.sin(t * Math.PI) : 0;
        p.push(dx * (center + rib) - dz * r * width, h * t - 0.06 * t ** 3, dz * (center + rib) + dx * r * width);
        const c = root
          .clone()
          .lerp(leaf, Math.min(1, t * 3))
          .lerp(tip, t ** 4 * 0.78)
          .multiplyScalar(r === 0 ? 1.09 : 0.94);
        color.push(c.r, c.g, c.b);
      }
      if (j < 10)
        for (let r = 0; r < 2; r++) {
          const n = start + j * 3 + r;
          tri.push(n, n + 1, n + 3, n + 1, n + 4, n + 3);
        }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  return geo;
}

function sponge() {
  const n = 26,
    rows = 18,
    pos = [],
    uv = [],
    idx = [];
  // Open flared funnels, with a folded lip and a shaded interior.
  const colors = [];
  for (let k = 0; k <= rows + 7; k++) {
    for (let j = 0; j <= n; j++) {
      const inner = k > rows;
      const t = inner ? 1 - ((k - rows - 1) / 6) * 0.85 : k / rows,
        a = (j / n) * TAU;
      const lipWeight = inner ? 0.85 : 0.99;
      const r =
        (0.067 + 0.112 * t ** 1.4 + 0.013 * Math.sin(t * 9)) * (1 + 0.085 * Math.cos(6 * a + t * 4)) * lipWeight;
      pos.push(0.069 * t * t + Math.cos(a) * r, t * 0.53 + 0.024 * t * t * Math.sin(a * 3 + 0.6), Math.sin(a) * r);
      uv.push(j / n, t);
      const tint = inner ? 0.24 + 0.61 * t * t : 0.72 + 0.28 * t;
      colors.push(tint, tint * 0.98, tint * 0.93);
      if (k < rows + 7 && j < n) {
        const i = k * (n + 1) + j;
        idx.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function spongeSkin() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b6a894';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 4703;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  // Minute openings vary in size and follow the oblique siliceous lattice.
  for (let i = 0; i < 1350; i++) {
    const x = rand() * c.width,
      y = rand() * c.height,
      r = 0.35 + rand() ** 2 * 1.8;
    for (const dx of [-c.width, 0, c.width]) {
      g.fillStyle = 'rgba(73,63,49,.57)';
      g.beginPath();
      g.ellipse(x + dx, y, r * 0.78, r * 1.2, 0.36, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(235,222,188,.55)';
      g.lineWidth = 0.68;
      g.beginPath();
      g.ellipse(x + dx + 0.25, y, r * 0.91, r * 1.28, 0.36, 0, Math.PI);
      g.stroke();
    }
  }
  for (const dir of [-1, 1])
    for (let x = -c.height; x < c.width + c.height; x += 10.7) {
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + dir * 48, 92, x + dir * 111, 181, x + dir * 156, 256);
      g.lineWidth = 1.0;
      g.strokeStyle = 'rgba(240,224,186,.34)';
      g.stroke();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function seaPen() {
  const parts = [];
  const stem = new THREE.ConeGeometry(0.022, 0.72, 9);
  stem.translate(0, 0.36, 0);
  parts.push(tinted(stem, 0xb18b66));
  for (let i = 0; i < 19; i++) {
    const t = i / 19,
      y = 0.15 + t * 0.55,
      span = 0.02 + 0.13 * Math.sin(Math.PI * t) ** 0.77;
    for (const side of [-1, 1]) {
      const end = v(side * span, y + 0.083, 0.021 * Math.sin(4 * t));
      const curve = new THREE.QuadraticBezierCurve3(v(0, y, 0), v(side * span * 0.66, y + 0.012, 0), end);
      parts.push(tinted(new THREE.TubeGeometry(curve, 6, 0.0065 * (1 - 0.28 * t), 4, false), 0xcb926d));
      for (let k = 1; k < 5; k++) {
        const a = curve.getPoint(k / 5),
          leaf = new THREE.SphereGeometry(1, 5, 4);
        leaf.scale(0.004, 0.018 * (1 - 0.1 * k), 0.005);
        leaf.rotateZ(-side * 0.36);
        leaf.translate(a.x, a.y + 0.009, a.z);
        parts.push(tinted(leaf, 0xe0b297));
      }
    }
  }
  return combine(parts);
}

function brittleStar() {
  const parts = [],
    disc = new THREE.SphereGeometry(1, 14, 8);
  disc.scale(0.066, 0.026, 0.064);
  disc.translate(0, 0.022, 0);
  parts.push(tinted(disc, 0xbc8e69));
  for (let j = 0; j < 5; j++) {
    const a = (j * TAU) / 5,
      points = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11,
        r = 0.045 + 0.27 * t,
        phi = a + 0.36 * Math.sin(t * 5.3 + j * 0.8) * t;
      points.push(v(Math.cos(phi) * r, 0.017 + 0.012 * Math.sin(t * 4.4 + j) ** 2, Math.sin(phi) * r));
    }
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i],
        to = points[i + 1],
        delta = to.clone().sub(from);
      const g = new THREE.CylinderGeometry(0.017 * (1 - (i + 1) / 12), 0.017 * (1 - i / 12), delta.length() + 0.002, 5);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), delta.normalize()));
      const p = from.clone().lerp(to, 0.5);
      g.translate(p.x, p.y, p.z);
      parts.push(tinted(g, i % 3 === 1 ? 0xcaa17b : 0x95795f));
    }
  }
  return combine(parts);
}

// A half-buried valve has a hinge, a cupped profile and fine growth rings.
// The ribs meet at the hinge and widen toward the slightly chipped margin.
function shellValve(chipped) {
  const pos = [],
    colors = [],
    ids = [];
  const cols = 48,
    rows = 16;
  const mantle = new THREE.Color(0xab9f88),
    rib = new THREE.Color(0x887969);
  for (let k = 0; k <= rows; k++)
    for (let j = 0; j <= cols; j++) {
      const t = k / rows,
        a = (j / cols - 0.5) * Math.PI * 1.34;
      const notch = chipped ? 0.14 * Math.exp(-((a - 0.52) ** 2) / 0.009) : 0;
      const r = 0.008 + 0.107 * t * (1 - notch) * (1 + 0.016 * Math.cos(a * 27));
      const bow = 0.047 * (1 - t * t) * Math.sin(Math.PI * t) ** 0.45;
      pos.push(r * Math.sin(a) * 0.9, bow + 0.008 * t + 0.0037 * Math.cos(a * 27) * (0.25 + 0.75 * t), r * Math.cos(a));
      const band = 0.5 + 0.5 * Math.cos(47 * t - 0.3 * Math.sin(3 * a));
      const tint = mantle.clone().lerp(rib, 0.36 * band + 0.12 * (1 + Math.sin(a * 27)));
      colors.push(tint.r, tint.g, tint.b);
      if (k < rows && j < cols) {
        const h = k * (cols + 1) + j;
        ids.push(h, h + cols + 1, h + 1, h + 1, h + cols + 1, h + cols + 2);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}

// A fan grows mostly in one plane, with smaller branchlets curving up into the flow.
function coralFan(random) {
  const parts = [];
  function branch(start, length, angle, radius, order) {
    const tip = start
      .clone()
      .add(v(Math.sin(angle) * length, Math.cos(angle) * length, (random() - 0.5) * length * 0.34));
    const mid = start
      .clone()
      .lerp(tip, 0.5)
      .add(v((random() - 0.5) * length * 0.23, 0, length * 0.06));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, tip);
    const tube = new THREE.TubeGeometry(curve, 6, radius, 5, false);
    const p = tube.attributes.position,
      centre = v(0, 0, 0),
      point = v(0, 0, 0);
    for (let row = 0; row <= 6; row++) {
      curve.getPointAt(row / 6, centre);
      for (let j = 0; j <= 5; j++) {
        const i = row * 6 + j;
        point
          .fromBufferAttribute(p, i)
          .sub(centre)
          .multiplyScalar(1 - (0.39 * row) / 6)
          .add(centre);
        p.setXYZ(i, point.x, point.y, point.z);
      }
    }
    parts.push(tinted(tube, order === 0 ? 0xe0b195 : order === 1 ? 0xd4947d : 0xb78370));
    if (!order) return;
    branch(tip, length * (0.66 + random() * 0.18), angle * 0.63 + (random() - 0.5) * 0.55, radius * 0.72, order - 1);
    const sign = random() < 0.5 ? -1 : 1;
    for (const side of [-sign, sign]) {
      const at = curve.getPoint(0.38 + random() * 0.38);
      branch(
        at,
        length * (0.5 + random() * 0.3),
        angle * 0.59 + side * (0.48 + random() * 0.38),
        radius * 0.58,
        order - 1,
      );
    }
  }
  branch(v(0, 0, 0), 0.34, 0.1, 0.025, 4);
  return combine(parts);
}

// Ground the clusters against the same relief used by the mesh. Keep rock
// ledges alongside the route and the water in front of the lens unobstructed.
export function createOceanHabitat(scene, random, instances, glow) {
  const bed = sediment(scene);
  const root = new THREE.Group();
  root.name = 'Continental slope and abyssal plain';
  scene.add(root);
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, envMapIntensity: 0.08 });
  const rockMap = new THREE.TextureLoader().load(new URL('../assets/ocean/fractured-rock.jpg', import.meta.url).href);
  rockMap.wrapS = rockMap.wrapT = THREE.RepeatWrapping;
  rockMap.colorSpace = THREE.SRGBColorSpace;
  rockMap.anisotropy = 6;
  const rockMat = stoneMat.clone();
  rockMat.map = rockMat.bumpMap = rockMap;
  rockMat.bumpScale = 0.032;
  rockMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
    float mineral=dot(diffuseColor.rgb,vec3(.26,.58,.16));
    diffuseColor.rgb=mix(vec3(mineral*.68,mineral*.83,mineral*.83),diffuseColor.rgb,.20);`,
    );
  };
  const rocks = [[], [], []],
    cups = [],
    pens = [],
    stars = [],
    contact = [];
  const place = (x, z, s) => ({ x, z, y: bedHeight(x, z), s, ry: random() * TAU });
  function rock(x, z, size) {
    const p = place(x, z, size),
      kind = Math.floor(random() * rocks.length),
      width = size * (0.75 + random() * 0.55);
    if (cableDistance(x, z) < width + 0.24) return;
    const height = size * (0.46 + random() * 0.46);
    rocks[kind].push({
      ...p,
      y: p.y - height * 0.2,
      sx: width,
      sy: height,
      sz: size * (0.57 + random() * 0.29),
      rz: (random() - 0.5) * 0.17,
    });
    if (size > 0.22) contact.push({ ...p, y: p.y + 0.014, sx: width * 2.5, sz: size * 2.0, sy: 1 });
  }
  for (let i = 0; i < 57; i++) {
    const x = 135 + i * 2.02 + random() * 1.4;
    // The far shoulder carries the larger fractured outcrops.
    const z = i % 3 === 0 ? 4.9 + random() * 6 : -3.4 - random() * 11;
    const size = 0.6 + random() * 1.55;
    rock(x, z, size);
    for (let j = 0; j < 10; j++)
      rock(x + (random() - 0.5) * 5, z + (random() - 0.5) * 2.4, 0.11 + random() ** 2 * size * 0.8);
  }
  for (let i = 0; i < 850; i++) rock(133 + random() * 113, (random() - 0.5) * 32, 0.034 + random() ** 3 * 0.27);
  for (let i = 0; i < 58; i++) {
    const x = 143 + random() * 93,
      z = (random() < 0.55 ? -1 : 1) * (1.1 + random() * 8.9);
    if (cableDistance(x, z) < 0.65) continue;
    const count = 2 + Math.floor(random() * 4);
    for (let j = 0; j < count; j++) {
      const p = place(x + (random() - 0.5) * 0.47, z + (random() - 0.5) * 0.41, 0.34 + random() * 0.8);
      cups.push({ ...p, rx: (random() - 0.5) * 0.24, rz: (random() - 0.5) * 0.26 });
    }
    if (i % 2 === 0) pens.push({ ...place(x + 0.58, z - 0.22, 0.64 + random() * 0.68), rz: (random() - 0.5) * 0.3 });
  }
  for (let i = 0; i < 81; i++) {
    const x = 144 + random() * 89,
      z = (random() - 0.5) * 15;
    if (cableDistance(x, z) > 0.4) stars.push({ ...place(x, z, 0.58 + random() * 0.65), y: bedHeight(x, z) + 0.023 });
  }
  // Static survey bands cover only a few dozen metres. Instancing by band
  // lets the renderer drop the terrain dressing once it disappears into fog.
  const bandWidth = 24;
  const bands = Array.from({ length: 5 }, (_, i) => {
    const group = new THREE.Group();
    root.add(group);
    return { group, x: 130 + (i + 0.5) * bandWidth };
  });
  function batchInstances(geometry, material, placements) {
    const batches = bands.map(() => []);
    for (const p of placements) {
      const i = THREE.MathUtils.clamp(Math.floor((p.x - 130) / bandWidth), 0, bands.length - 1);
      batches[i].push(p);
    }
    batches.forEach((batch, i) => {
      if (batch.length) instances(bands[i].group, geometry, material, batch);
    });
  }
  rocks.forEach((batch, i) => batchInstances(layeredRock(random, i), rockMat, batch));
  const skin = spongeSkin();
  batchInstances(
    sponge(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: skin,
      bumpMap: skin,
      bumpScale: 0.009,
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),
    cups,
  );
  batchInstances(seaPen(), stoneMat, pens);
  batchInstances(brittleStar(), stoneMat, stars);
  const fans = [];
  for (const [x, z, size] of [
    [155, -2.1, 0.86],
    [165, -4.4, 1.3],
    [176, 2.4, 0.96],
    [180, -3.6, 1.65],
    [185, -1.8, 0.84],
    [194, -3.6, 1.46],
    [201, 2.2, 1.16],
    [207, -2.8, 1.44],
    [216, -3.4, 1.22],
    [224, 2.7, 1.34],
    [233, -3.4, 0.8],
  ]) {
    fans.push({ ...place(x, z, size), ry: 1.18 + (random() - 0.5) * 1.23, rz: (random() - 0.5) * 0.24 });
    fans.push({ ...place(x + 0.48, z + 0.31, size * 0.48), ry: 0.72 + random(), rz: -0.22 });
  }
  batchInstances(coralFan(random), stoneMat, fans);
  const valves = [[], []];
  for (let i = 0; i < 48; i++) {
    const x = 136 + random() * 106,
      z = (random() - 0.5) * 13;
    for (let j = 0; j < 3 + Math.floor(random() * 4); j++) {
      const xx = x + (random() - 0.5) * 0.84,
        zz = z + (random() - 0.5) * 0.72;
      if (cableDistance(xx, zz) < 0.48) continue;
      const p = place(xx, zz, 0.62 + random() * 1.16);
      valves[(i + j) % 2].push({ ...p, y: p.y + 0.008, rx: (random() - 0.5) * 0.31, rz: (random() - 0.5) * 0.28 });
    }
  }
  const carbonate = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.78 });
  valves.forEach((arr, i) => batchInstances(shellValve(i === 1), carbonate, arr));
  const shadowQuad = new THREE.PlaneGeometry(1, 1);
  shadowQuad.rotateX(-Math.PI / 2);
  batchInstances(
    shadowQuad,
    new THREE.MeshBasicMaterial({
      color: 0x152d2b,
      map: glow,
      opacity: 0.46,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    contact,
  );

  const fishRoot = new THREE.Group();
  scene.add(fishRoot);
  const swim = createOceanFish(fishRoot, bedHeight, random);
  const glide = createBenthicSkates(fishRoot, bedHeight);
  const positions = [];
  for (let i = 0; i < 2300; i++) {
    const x = 132 + random() * 116,
      z = (random() - 0.5) * 29;
    positions.push(x, bedHeight(x, z) + random() * Math.min(8, -seaY(x)), z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const time = { value: 0 },
    snowMaterial = new THREE.PointsMaterial({
      map: glow,
      color: 0xb7d5d4,
      size: 0.036,
      opacity: 0.54,
      transparent: true,
      depthWrite: false,
    });
  snowMaterial.onBeforeCompile = (sh) => {
    sh.uniforms.seaTime = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float seaTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
    transformed.x+=.19*sin(seaTime*.32+position.z);transformed.y+=.18*sin(seaTime*.19+position.x*2.7);
    transformed.z+=.12*cos(seaTime*.27+position.y);`,
    );
  };
  const snow = new THREE.Points(g, snowMaterial);
  fishRoot.add(snow);
  return (t, cameraX) => {
    bed.visible = cameraX > 90 && cameraX < 295;
    root.visible = fishRoot.visible = cameraX > 110 && cameraX < 270;
    if (fishRoot.visible) {
      for (const band of bands) band.group.visible = Math.abs(band.x - cameraX) < 47;
      swim(t, cameraX);
      glide(t, cameraX);
      time.value = t;
    }
  };
}
