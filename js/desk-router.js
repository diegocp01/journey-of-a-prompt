import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Horizontal outlines let the injection-moulded case have broad corner radii,
// a small edge bevel and a shallow domed shoulder, independently of its height.
function outline(w, d, r) {
  const ring = [];
  for (const [sx, sz, quadrant] of [
    [1, 1, 0],
    [-1, 1, 1],
    [-1, -1, 2],
    [1, -1, 3],
  ]) {
    for (let i = 0; i <= 10; i++) {
      const a = (Math.PI / 2) * (quadrant + i / 10);
      ring.push(new THREE.Vector2(sx * (w / 2 - r) + Math.cos(a) * r, sz * (d / 2 - r) + Math.sin(a) * r));
    }
  }
  return ring;
}

function shell(rings) {
  const positions = [],
    uvs = [],
    faces = [];
  for (const [j, [w, d, r, y]] of rings.entries()) {
    const ring = outline(w, d, r),
      n = ring.length;
    ring.forEach((p, i) => {
      positions.push(p.x, y, p.y);
      uvs.push(i / n, y / 0.05);
      if (!j) return;
      const lo = (j - 1) * n,
        a = lo + i,
        b = lo + ((i + 1) % n);
      faces.push(a, a + n, b, a + n, b + n, b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(faces);
  g.computeVertexNormals();
  return g;
}

export function buildRouter(parent, brass) {
  const satin = new THREE.MeshPhysicalMaterial({
    color: 0xeddbc5,
    roughness: 0.38,
    clearcoat: 0.19,
    clearcoatRoughness: 0.3,
    specularIntensity: 0.64,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x443d36, roughness: 0.86 });
  const socket = new THREE.MeshStandardMaterial({ color: 0x908173, roughness: 0.46, metalness: 0.44 });
  const opal = new THREE.MeshPhysicalMaterial({
    color: 0xfff0d0,
    emissive: 0xffc478,
    emissiveIntensity: 3.2,
    roughness: 0.22,
    clearcoat: 0.4,
  });
  const byMaterial = new Map();
  // All fittings are rigid. Bake into one draw per finish, including the RJ45
  // contacts and the captive antenna pivots on the side facing the window.
  function part(g, mat, x = 0, y = 0, z = 0) {
    const shape = g.index ? g.toNonIndexed() : g;
    shape.translate(x, y, z);
    if (!byMaterial.has(mat)) byMaterial.set(mat, []);
    byMaterial.get(mat).push(shape);
    if (shape !== g) g.dispose();
  }
  const block = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);
  for (const x of [-0.081, 0.081])
    for (const z of [-0.033, 0.033]) part(new THREE.CylinderGeometry(0.007, 0.0064, 0.003, 16), rubber, x, 0.0015, z);
  part(
    shell([
      [0.188, 0.079, 0.014, 0.0025],
      [0.196, 0.087, 0.016, 0.0043],
      [0.197, 0.088, 0.016, 0.0066],
    ]),
    rubber,
  );
  part(
    shell([
      [0.195, 0.085, 0.015, 0.005],
      [0.204, 0.094, 0.018, 0.007],
      [0.205, 0.095, 0.018, 0.0102],
      [0.203, 0.093, 0.018, 0.0109],
    ]),
    brass,
  );
  part(
    shell([
      [0.201, 0.091, 0.017, 0.0099],
      [0.205, 0.095, 0.018, 0.0106],
      [0.205, 0.095, 0.018, 0.0126],
    ]),
    rubber,
  );
  const crown = [
    [0.204, 0.093, 0.017, 0.0116],
    [0.211, 0.099, 0.018, 0.0128],
    [0.214, 0.101, 0.019, 0.0158],
    [0.2145, 0.1015, 0.019, 0.0265],
    [0.214, 0.101, 0.019, 0.03],
    [0.212, 0.099, 0.019, 0.032],
    [0.201, 0.088, 0.017, 0.0418],
    [0.195, 0.082, 0.016, 0.0442],
    [0.186, 0.073, 0.014, 0.0448],
  ];
  part(shell(crown), satin);
  const [w, d, r, top] = crown[crown.length - 1];
  const lid = new THREE.Shape(outline(w, d, r).map((p) => new THREE.Vector2(p.x, -p.y)));
  // Through-slots have a lip, real depth and a dark internal baffle underneath.
  for (let i = -7; i <= 7; i++) {
    const x = i * 0.0063,
      cy = 0.025,
      h = 0.0042,
      a = 0.00068,
      cut = new THREE.Path();
    cut.absarc(x, cy + h, a, 0, Math.PI);
    cut.absarc(x, cy - h, a, Math.PI, 2 * Math.PI);
    cut.closePath();
    lid.holes.push(cut);
  }
  const grille = new THREE.ExtrudeGeometry(lid, { depth: 0.0009, bevelEnabled: false, curveSegments: 5 });
  grille.rotateX(-Math.PI / 2);
  part(grille, satin, 0, top - 0.0009);
  part(block(0.112, 0.001, 0.019, 0.0004), rubber, 0, top - 0.0036, -0.025);

  for (const side of [-1, 1]) {
    const x = side * 0.083,
      z = -0.0285;
    part(new THREE.CylinderGeometry(0.0061, 0.0069, 0.0022, 32), satin, x, 0.044, z);
    part(new THREE.CylinderGeometry(0.006, 0.0065, 0.004, 32), satin, x, 0.0466, z);
    const axle = new THREE.CylinderGeometry(0.0035, 0.0035, 0.0102, 24).rotateZ(Math.PI / 2);
    part(axle, socket, x, 0.0503, z);
    const antenna = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.0047, 0],
        [0.0052, 0.002],
        [0.005, 0.008],
        [0.00455, 0.0095],
        [0.00445, 0.073],
        [0.00425, 0.096],
        [0.00415, 0.0984],
        [0.0035, 0.0992],
        [0, 0.0994],
      ].map(([radius, y]) => new THREE.Vector2(radius, y)),
      36,
    );
    antenna.rotateX(-0.028).rotateZ(0.046 - side * 0.008);
    part(antenna, satin, x, 0.0505, z);
  }
  part(block(0.0178, 0.0028, 0.0012, 0.0005), socket, 0, 0.0235, 0.05083);
  part(block(0.0168, 0.0021, 0.0014, 0.00068), opal, 0, 0.0235, 0.05125);
  // Rear network sockets, pin contacts, and the strain relief on the power lead.
  for (const x of [-0.03, -0.011]) {
    part(block(0.0168, 0.0112, 0.0021, 0.0008), socket, x, 0.023, -0.0507);
    part(new THREE.BoxGeometry(0.0135, 0.0074, 0.0011), rubber, x, 0.0238, -0.0515);
    for (let i = 0; i < 8; i++)
      part(new THREE.BoxGeometry(0.00048, 0.0022, 0.0009), brass, x + (i - 3.5) * 0.0013, 0.022, -0.052);
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lead = new THREE.CatmullRomCurve3([
    V(0.045, 0.022, -0.052),
    V(0.045, 0.02, -0.062),
    V(0.052, 0.009, -0.069),
    V(0.081, 0.002, -0.071),
    V(0.151, 0.0018, -0.11),
    V(0.155, -0.004, -0.127),
  ]);
  part(new THREE.TubeGeometry(lead, 20, 0.00165, 8, false), rubber);
  part(new THREE.CylinderGeometry(0.0031, 0.0034, 0.0095, 16).rotateX(Math.PI / 2), rubber, 0.045, 0.022, -0.054);
  // Light inside the opal lens diffuses slightly into the surrounding case.
  const glow = document.createElement('canvas');
  glow.width = 96;
  glow.height = 40;
  const ctx = glow.getContext('2d'),
    img = ctx.createImageData(96, 40);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 96; x++) {
      const dx = Math.max(0, Math.abs(x - 47.5) - 17) / 12,
        dy = (y - 19.5) / 7;
      const i = (y * 96 + x) * 4;
      img.data.set([255, 179, 92, 110 * Math.exp(-dx * dx - dy * dy)], i);
    }
  ctx.putImageData(img, 0, 0);
  const lightSpill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.036, 0.013),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(glow),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  lightSpill.position.set(0, 0.0235, 0.052);
  parent.add(lightSpill);
  for (const [mat, geometries] of byMaterial) {
    const m = new THREE.Mesh(mergeGeometries(geometries), mat);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    geometries.forEach((g) => g.dispose());
  }
}
