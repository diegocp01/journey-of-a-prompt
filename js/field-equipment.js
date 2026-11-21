// Dimensions are in metres. Rigid parts in each installation share a draw call by finish.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batch } from './static-details.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const finish = (color, roughness, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const zinc = finish(0x9babae, 0.55, 0.58),
  alloy = finish(0x5b666a, 0.63, 0.45),
  porcelain = finish(0xe3e1d3, 0.49),
  gasket = finish(0x282f31, 0.83),
  jacket = finish(0x32383b, 0.77),
  enamel = finish(0x9dafa6, 0.68, 0.16),
  foundation = finish(0xaaa397, 0.96),
  brass = finish(0xb29b64, 0.64, 0.45),
  marking = finish(0xd8ad58, 0.71);

function group(p, x = 0, y = 0, z = 0, angle = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  p.add(g);
  return g;
}
function part(p, geo, mat, x, y, z) {
  const obj = new THREE.Mesh(geo, mat);
  obj.position.set(x, y, z);
  p.add(obj);
  return obj;
}
function box(p, x, y, z, w, h, d, mat, r = 0) {
  const geo = r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  return part(p, geo, mat, x, y, z);
}
function rod(p, a, b, r, mat, sides = 8, tip = r) {
  const delta = b.clone().sub(a);
  const obj = part(
    p,
    new THREE.CylinderGeometry(tip, r, delta.length(), sides),
    mat,
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    (a.z + b.z) / 2,
  );
  obj.quaternion.setFromUnitVectors(v(0, 1, 0), delta.normalize());
  return obj;
}
function pipe(p, points, r, mat) {
  const path = new THREE.CatmullRomCurve3(
    points.map((a) => v(...a)),
    false,
    'centripetal',
  );
  return part(p, new THREE.TubeGeometry(path, points.length * 4, r, 6, false), mat, 0, 0, 0);
}
function ring(p, x, y, z, r, gauge, mat, arc = Math.PI * 2) {
  return part(p, new THREE.TorusGeometry(r, gauge, 6, 32, arc), mat, x, y, z);
}

function panel(p, x, y, z, h, w) {
  // Molded fiberglass face wraps around a gasket and a pressed aluminum back.
  const module = group(p, x, y, z);
  module.rotation.z = 0.035;
  box(module, 0, 0, 0, 0.105, h, w, gasket, 0.037);
  box(module, 0.034, 0, 0, 0.145, h - 0.018, w - 0.012, porcelain, 0.055);
  box(module, -0.064, 0, 0, 0.03, h - 0.13, w - 0.064, zinc, 0.012);
  // Crimped return edges and the narrow side seam distinguish the molded
  // radome from the extrusion carrying the radio behind it.
  for (const sign of [-1, 1]) {
    box(module, -0.029, 0, sign * (w * 0.5 - 0.008), 0.025, h - 0.14, 0.014, zinc, 0.003);
    for (const y of [-0.38, -0.12, 0.13, 0.38]) {
      rod(module, v(-0.078, y * h, sign * w * 0.335), v(-0.092, y * h, sign * w * 0.335), 0.016, alloy, 6);
    }
  }
  for (const side of [-1, 1]) {
    box(module, -0.16, side * h * 0.32, 0, 0.21, 0.065, w * 0.68, alloy, 0.014);
    rod(module, v(-0.28, side * h * 0.32 - 0.05, 0), v(-0.28, side * h * 0.32 + 0.05, 0), 0.064, zinc, 10);
    const zoff = side * w * 0.23;
    rod(module, v(0, -h / 2 - 0.075, zoff), v(0, -h / 2, zoff), 0.036, brass, 6);
    pipe(
      module,
      [
        [0, -h / 2 - 0.06, zoff],
        [-0.02, -h / 2 - 0.24, zoff],
        [-0.19, -h / 2 - 0.33, zoff],
        [-0.28, -h / 2 + 0.04, zoff],
      ],
      0.025,
      jacket,
    );
  }
  const radio = group(module, -0.39, -0.12, 0);
  box(radio, 0, 0, 0, 0.19, 0.66, w * 0.95, alloy, 0.026);
  for (let i = 0; i < 9; i++) box(radio, -0.115, 0, (i / 8 - 0.5) * w * 0.84, 0.072, 0.59, 0.015, zinc);
  for (const sign of [-1, 1]) {
    box(radio, 0, 0, sign * (w * 0.475), 0.132, 0.53, 0.019, zinc, 0.011);
    for (const cy of [-0.21, 0.17])
      rod(radio, v(0, cy, sign * w * 0.46), v(0, cy, sign * (w * 0.475 + 0.017)), 0.016, alloy, 6);
    box(radio, 0, 0.07, sign * (w * 0.475 + 0.013), 0.084, 0.105, 0.008, porcelain);
    box(radio, 0, 0.113, sign * (w * 0.475 + 0.02), 0.084, 0.016, 0.005, marking);
    for (let i = 0; i < 5; i++)
      box(radio, -0.028 + i * 0.014, 0.055, sign * (w * 0.475 + 0.02), 0.005, 0.034, 0.004, gasket);
  }
}
function dish(p, y, angle) {
  const arm = group(p, 0, y, 0, angle),
    x = 2.2 - (1.7 * y) / 28 + 0.65;
  rod(arm, v(x - 0.88, -0.39, 0), v(x - 0.2, -0.04, 0), 0.044, zinc);
  rod(arm, v(x - 0.88, 0.15, 0), v(x - 0.22, 0.02, 0), 0.055, alloy);
  const dish = group(arm, x, 0, 0);
  dish.rotation.z = -Math.PI / 2;
  const profile = [
    [0.014, -0.29],
    [0.22, -0.24],
    [0.43, -0.14],
    [0.61, 0.005],
    [0.645, 0.025],
    [0.646, 0.062],
    [0.62, 0.075],
    [0.42, -0.055],
    [0.22, -0.149],
    [0.012, -0.174],
  ];
  part(
    dish,
    new THREE.LatheGeometry(
      profile.map((a) => new THREE.Vector2(...a)),
      40,
    ),
    porcelain,
    0,
    0,
    0,
  );
  ring(dish, 0, 0.048, 0, 0.637, 0.015, zinc).rotation.x = Math.PI / 2;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + 0.25;
    rod(dish, v(0.58 * Math.cos(a), 0.043, 0.58 * Math.sin(a)), v(0, 0.31, 0), 0.013, zinc);
  }
  rod(dish, v(0, 0.25, 0), v(0, 0.405, 0), 0.065, gasket, 16, 0.045);
}
export function buildTowerHardware(tower) {
  const head = group(tower);
  head.name = 'Radio sectors, feeders and climbing equipment';
  // Pressed open steel grating spans the crown. The openings reveal the
  // supporting cross beams when the radio camera tilts down the tower.
  for (let i = -14; i <= 14; i++) {
    const offset = i * 0.073,
      chord = 2 * Math.sqrt(1.07 ** 2 - offset ** 2);
    box(head, offset, 26.208, 0, 0.022, 0.082, chord, zinc);
    if (i % 2 === 0) box(head, 0, 26.197, offset, chord, 0.056, 0.019, alloy);
  }
  const flangeProfile = [
    [1.055, 26.145],
    [1.091, 26.145],
    [1.091, 26.255],
    [1.055, 26.255],
    [1.055, 26.145],
  ];
  part(
    head,
    new THREE.LatheGeometry(
      flangeProfile.map((a) => new THREE.Vector2(...a)),
      48,
    ),
    zinc,
    0,
    0,
    0,
  );
  for (let i = 0; i < 8; i++) {
    const spoke = group(head, 0, 0, 0, (i * Math.PI) / 4);
    box(spoke, 0.61, 26.135, 0, 1.03, 0.073, 0.062, alloy);
    rod(spoke, v(0.54, 25.88, 0), v(1.03, 26.14, 0), 0.026, alloy);
    rod(spoke, v(0.88, 26.24, -0.041), v(0.88, 26.28, -0.041), 0.033, zinc, 6);
  }
  for (let sector = 0; sector < 3; sector++) {
    const face = group(head, 0, 22.9, 0, (sector * Math.PI * 2) / 3 + 0.5);
    for (const y of [0.19, 2.19]) {
      rod(face, v(0.3, y, 0), v(1.7, y, 0), 0.058, zinc);
      rod(face, v(1.66, y, -0.86), v(1.66, y, 0.86), 0.051, zinc);
    }
    for (const z of [-0.59, 0.59]) {
      rod(face, v(0.42, 0.19, 0), v(1.66, 2.19, z), 0.032, alloy);
      rod(face, v(1.66, -0.2, z), v(1.66, 2.65, z), 0.047, zinc);
      panel(face, 1.94, 1.18, z, 2.66, 0.42);
      pipe(
        face,
        [
          [1.54, 0.65, z],
          [1.48, -0.15, z],
          [1.29, -0.38, z],
          [0.47, -0.53, z * 0.55],
          [0.42, -1.02, z * 0.52],
        ],
        0.032,
        jacket,
      );
    }
    const top = group(head, 0, 0, 0, (sector * Math.PI * 2) / 3 + 0.5);
    rod(top, v(0.17, 27.01, 0), v(0.92, 27.01, 0), 0.04, zinc);
    rod(top, v(0.17, 28.04, 0), v(0.92, 28.04, 0), 0.04, zinc);
    panel(top, 1.02, 27.56, 0, 1.69, 0.38);
  }
  for (const [y, angle] of [
    [19.2, 0.2],
    [15.4, 2.5],
  ])
    dish(head, y, angle);
  // The ladder follows the taper of the front face. Open guard hoops face out.
  const faceAt = (y) => 2.2 - (1.7 * y) / 28 + 0.11;
  for (const x of [-0.23, 0.23]) rod(head, v(x, 0.33, faceAt(0.33)), v(x, 26.64, faceAt(26.64)), 0.032, zinc);
  for (let y = 0.58; y < 26.6; y += 0.31) rod(head, v(-0.23, y, faceAt(y)), v(0.23, y, faceAt(y)), 0.018, alloy);
  for (let y = 3; y < 26.2; y += 1.6) {
    const hoop = ring(head, 0, y, faceAt(y) - 0.015, 0.37, 0.018, zinc, Math.PI);
    hoop.rotation.x = Math.PI / 2;
  }
  for (const a of [0.57, 1.57, 2.57]) {
    const x = 0.37 * Math.cos(a),
      z = 0.37 * Math.sin(a);
    rod(head, v(x, 3, faceAt(3) + z), v(x, 25.5, faceAt(25.5) + z), 0.017, alloy);
  }
  for (let level = 0; level < 7; level++)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2,
        face = group(head, 0, level * 4, 0, a);
      const foot = 2.2 - (1.7 * level * 4) / 28,
        top = foot - (1.7 * 4) / 28;
      rod(face, v(foot, 0, foot), v(-top, 4, top), 0.029, alloy);
      for (const x of [-1, 1]) {
        box(face, x * top, 3.99, top + 0.025, 0.27, 0.245, 0.036, zinc);
        for (const dx of [-0.073, 0.073])
          rod(face, v(x * top + dx, 4, top + 0.036), v(x * top + dx, 4, top + 0.076), 0.03, alloy, 6);
      }
    }
  // Cast-in anchor bolts and their washers around each sole plate.
  for (const x of [-2.2, 2.2])
    for (const z of [-2.2, 2.2])
      for (const dx of [-0.145, 0.145])
        for (const dz of [-0.145, 0.145])
          rod(head, v(x + dx, 0.39, z + dz), v(x + dx, 0.475, z + dz), 0.047, zinc, 6);
  rod(head, v(0, 31.27, 0), v(0, 31.43, 0), 0.21, alloy, 16);
  for (const y of [31.42, 31.56]) ring(head, 0, y, 0, 0.19, 0.018, zinc).rotation.x = Math.PI / 2;
  batch(head);
  // Keep the clean panel and dish silhouettes at long range. At that distance
  // individual ladder rungs, wires and heat-sink fins occupy less than one pixel.
  const distant = group(tower);
  for (let i = 0; i < 3; i++) {
    const face = group(distant, 0, 0, 0, (i * Math.PI * 2) / 3 + 0.5);
    for (const z of [-0.59, 0.59]) box(face, 1.94, 24.08, z, 0.18, 2.66, 0.42, porcelain);
    box(face, 1.02, 27.56, 0, 0.18, 1.69, 0.38, porcelain);
  }
  for (const [y, az] of [
    [19.2, 0.2],
    [15.4, 2.5],
  ]) {
    const side = group(distant, 0, y, 0, az),
      x = 2.2 - (1.7 * y) / 28 + 0.65;
    rod(side, v(x - 0.24, 0, 0), v(x, 0, 0), 0.59, porcelain, 14);
  }
  for (const x of [-0.23, 0.23]) rod(distant, v(x, 0.33, 2.29), v(x, 26.64, 0.69), 0.033, zinc, 6);
  batch(distant);
  const lod = new THREE.LOD();
  lod.position.y = 20;
  tower.add(lod);
  head.position.y = distant.position.y = -20;
  lod.addLevel(head, 0);
  lod.addLevel(distant, 67, 0.09);
}

function louvres(p, x, y, z, w, h, count) {
  box(p, x, y, z, w, h, 0.027, gasket);
  for (let j = 0; j < count; j++)
    box(p, x, y + h * ((j + 0.5) / count - 0.5), z + 0.022, w - 0.03, (h / count) * 0.7, 0.045, zinc).rotation.x =
      -0.35;
}
export function dressTowerCabinet(scene) {
  const site = group(scene, 44.9, 0, -5);
  site.name = 'Cell site cabinet fittings';
  const flash = group(site);
  for (let j = 0; j < 5; j++) {
    // Leave the lower portion of each luminous slot visible under its rain hood.
    box(flash, 0, 0.54 + j * 0.25, 0.032, 0.98, 0.037, 0.089, alloy, 0.01).rotation.x = 0.22;
  }
  for (const side of [-1, 1]) {
    const door = group(site, side * 0.29, 0, 0.045);
    box(door, 0, 0.26, 0, 0.38, 0.12, 0.021, enamel, 0.014);
    for (const x of [-0.15, 0.15]) rod(door, v(x, 0.26, 0.006), v(x, 0.26, 0.025), 0.014, zinc, 6);
  }
  // The feeder bridge leads from the cable glands into the lattice leg.
  const origin = [-0.64, 1.38, -0.62];
  for (let i = 0; i < 4; i++) {
    const z = origin[2] - i * 0.073;
    pipe(
      site,
      [
        [origin[0], 1.4, z],
        [-0.85, 1.42, z],
        [-1.04, 1.78, z],
        [-1.55, 1.83, z],
        [-1.89, 1.83, z - 0.17],
        [-2.08, 1.98, z - 0.43],
      ],
      0.027,
      jacket,
    );
  }
  for (const z of [-0.56, -0.9]) box(site, -1.42, 1.78, z, 1.02, 0.065, 0.056, zinc);
  for (let i = 0; i < 5; i++) box(site, -0.97 - i * 0.21, 1.77, -0.73, 0.049, 0.042, 0.38, zinc);
  rod(site, v(-1.87, 0.04, -0.72), v(-1.87, 1.78, -0.72), 0.04, alloy);
  batch(site);
}
export function dressRoadsideNode(scene, x, z) {
  // A precast vault, service apron and cable risers give the outdoor router a
  // footprint even when the photogrammetric cabinet is loaded asynchronously.
  const site = group(scene, x, 0, z);
  site.name = 'Fiber distribution cabinet site';
  box(site, 0, 0.065, 0, 1.44, 0.15, 1.04, foundation, 0.047);
  for (let i = 0; i < 3; i++) {
    const cx = -0.6 - i * 0.145;
    pipe(
      site,
      [
        [cx, -0.02, 0.02],
        [cx, 0.28, 0.02],
        [cx, 0.4, 0.005],
        [-0.19, 0.41, -0.07],
      ],
      0.046,
      alloy,
    );
    ring(site, cx, 0.15, 0.02, 0.052, 0.011, zinc).rotation.x = Math.PI / 2;
  }
  box(site, -0.83, 0.018, 0.54, 1.18, 0.065, 0.76, foundation, 0.065);
  box(site, -0.83, 0.052, 0.54, 0.96, 0.029, 0.55, alloy, 0.045);
  for (let k = 0; k < 13; k++) box(site, -1.234 + k * 0.067, 0.07, 0.54, 0.019, 0.013, 0.39, zinc);
  // The diagnostic lights belong to the adjacent fiber terminal. This keeps
  // them seated on the face with either the scanned or the fallback cabinet.
  const terminal = group(site, 0.69, 0, 0.04);
  box(terminal, 0, 0.16, 0, 0.37, 0.32, 0.29, foundation, 0.019);
  box(terminal, 0, 0.54, 0, 0.4, 0.62, 0.28, enamel, 0.032);
  box(terminal, 0, 0.62, 0.148, 0.31, 0.27, 0.024, gasket, 0.015);
  box(terminal, 0, 0.865, 0, 0.45, 0.06, 0.33, zinc, 0.021);
  for (let j = 0; j < 4; j++) box(terminal, 0, 0.4 + j * 0.035, 0.154, 0.25, 0.019, 0.028, alloy);
  const lights = [];
  for (let j = 0; j < 4; j++) {
    const lens = new THREE.MeshStandardMaterial({
      color: 0xa4c0a9,
      emissive: j === 3 ? 0xe3a949 : 0x58a985,
      emissiveIntensity: 1.2,
      roughness: 0.36,
    });
    const led = box(terminal, -0.099 + j * 0.066, 0.65, 0.169, 0.034, 0.036, 0.015, lens, 0.005);
    lights.push(led);
  }
  const post = group(site, 1, 0.01, -0.33);
  rod(post, v(0, 0, 0), v(0, 1.17, 0), 0.057, porcelain, 12);
  rod(post, v(0, 0.96, 0), v(0, 1.19, 0), 0.059, marking, 12);
  box(post, 0, 0.88, -0.052, 0.048, 0.13, 0.014, gasket);
  // Keep the four animated lens materials on their actual batched mesh.
  const lenses = lights.map((light) => light.material);
  batch(site);
  for (const child of site.children) {
    const i = lenses.indexOf(child.material);
    if (i !== -1) child.userData.blink = i;
  }
}
export function dressLandingStation(scene, x, z) {
  const station = group(scene, x, 0, z);
  station.name = 'Coastal cable landing station';
  // Folded sheet-metal roof built with a proper edge and raised, standing seams.
  box(station, 0, 2.235, 0, 4.66, 0.115, 5.46, alloy, 0.035);
  for (let i = -4; i <= 4; i++) box(station, i * 0.51, 2.3, 0, 0.043, 0.06, 5.38, zinc);
  const door = group(station, -0.88, 0, 2.61);
  box(door, 0, 1, 0, 1.18, 2.02, 0.065, gasket);
  box(door, 0, 0.99, 0.038, 1.075, 1.94, 0.051, enamel, 0.018);
  box(door, 0.42, 0.94, 0.082, 0.035, 0.27, 0.054, alloy, 0.009);
  for (const y of [0.37, 1.54]) box(door, -0.488, y, 0.078, 0.07, 0.17, 0.048, zinc);
  box(station, -0.89, 0.07, 2.98, 1.53, 0.14, 0.76, foundation, 0.03);
  louvres(station, 0.94, 1.12, 2.63, 1.02, 0.59, 7);
  box(station, -0.07, 1.34, 2.64, 0.23, 0.35, 0.11, alloy, 0.02);
  pipe(
    station,
    [
      [-0.07, 1.16, 2.67],
      [-0.07, 0.4, 2.67],
      [0.05, 0.27, 2.71],
      [0.05, -0.02, 2.71],
    ],
    0.024,
    zinc,
  );
  for (const dx of [-1.56, 1.57]) {
    const foot = group(station, dx, 0, 3.15);
    rod(foot, v(0, 0.04, 0), v(0, 0.76, 0), 0.068, marking, 12);
    rod(foot, v(0, 0.53, 0), v(0, 0.62, 0), 0.069, gasket, 12);
  }
  box(station, 0.31, 2.42, -0.71, 1.38, 0.29, 1.04, alloy, 0.034);
  for (const dx of [-0.33, 0.32]) {
    rod(station, v(0.31 + dx, 2.56, -0.71), v(0.31 + dx, 2.6, -0.71), 0.265, gasket, 24);
    for (const radius of [0.095, 0.17, 0.24])
      ring(station, 0.31 + dx, 2.61, -0.71, radius, 0.009, zinc).rotation.x = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    const at = group(station, side * 2.22, 0, 0, (side * Math.PI) / 2);
    for (const w of [-1.85, -0.63, 0.63, 1.85]) box(at, w, 0.82, 0, 0.057, 1.62, 0.064, foundation);
    louvres(at, 0, 1.28, 0.035, 1.01, 0.42, 6);
  }
  batch(station);
}
