// Surface cutaway along the buried route. Sleeper saddles and maintenance
// covers support the luminous glass line without hiding the travelling packet.
import * as THREE from 'three';
import { batch } from './static-details.js';

function ballastTexture() {
  let seed = 901;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a907e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const x = random() * 256,
      y = random() * 256,
      r = 0.4 + random() ** 2 * 3.2,
      value = 97 + random() * 89;
    g.fillStyle = `rgb(${value + 8} ${value + 2} ${value - 9})`;
    g.beginPath();
    g.moveTo(x - r, y);
    g.lineTo(x - r * 0.31, y - r * 0.62);
    g.lineTo(x + r * 0.83, y - r * 0.35);
    g.lineTo(x + r, y + r * 0.3);
    g.lineTo(x + r * 0.19, y + r * 0.7);
    g.closePath();
    g.fill();
  }
  for (let i = 0; i < 64; i++) {
    const x = random() * 256,
      y = random() * 256,
      r = 7 + random() * 27;
    const patch = g.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, i % 3 ? 'rgba(103,98,69,.24)' : 'rgba(203,191,161,.29)');
    patch.addColorStop(1, 'rgba(148,146,115,0)');
    g.fillStyle = patch;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 81; i++) {
    const x = random() * 256,
      y = random() * 256,
      r = 0.9 + random() * 1.6;
    g.fillStyle = 'rgba(63,63,53,.56)';
    g.fillRect(x + 0.5, y + 0.7, r * 2, r);
    g.fillStyle = i % 2 ? '#afa797' : '#8e8c7b';
    g.fillRect(x, y, r * 2, r * 0.91);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
let ballast;
export function cableCorridor(scene, curve, exposedLength = Infinity) {
  ballast ??= ballastTexture();
  const root = new THREE.Group();
  root.name = 'Fiber maintenance right of way';
  scene.add(root);
  const cableLength = curve.getLength(),
    length = Math.min(cableLength, exposedLength),
    steps = Math.ceil(length / 0.66);
  const pos = [],
    uv = [],
    colors = [],
    index = [],
    sprigs = [],
    normals = [],
    leafColor = [];
  const point = new THREE.Vector3(),
    tangent = new THREE.Vector3(),
    baseColor = new THREE.Color();
  const sleeper = new THREE.MeshStandardMaterial({ color: 0x92918a, roughness: 0.91 });
  const band = new THREE.MeshStandardMaterial({ color: 0x777c78, metalness: 0.48, roughness: 0.59 });
  const sand = new THREE.MeshStandardMaterial({
    map: ballast,
    vertexColors: true,
    roughness: 0.97,
    transparent: true,
    depthWrite: false,
  });
  const blade = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 });
  function geometry(positions, attributeColors, channels = 3) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(attributeColors, channels));
    return geo;
  }
  let state = 1793;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  // Alpha feathers the shoulders over the underlying meadow. The narrow
  // tyre ruts vary in color and the green center strip breaks up the ballast.
  const lanes = [
    [-0.66, 0.003, 0xa49c85, 0],
    [-0.35, 0.026, 0xbfaf94, 0.58],
    [-0.2, 0.052, 0xdaceb3, 1],
    [0.18, 0.053, 0xdaceb3, 1],
    [0.37, 0.031, 0xc1b497, 0.98],
    [0.7, 0.023, 0xb8ab8d, 0.88],
    [0.96, 0.017, 0xb0a48a, 0.85],
    [1.25, 0.013, 0xa5a07c, 0.61],
    [1.54, 0.02, 0xb2a88b, 0.83],
    [1.83, 0.025, 0xbfb39a, 0.9],
    [2.07, 0.011, 0xb4ac8b, 0.56],
    [2.43, 0.003, 0xaaa184, 0],
  ];
  const N = lanes.length;
  const stoneGeometry = new THREE.IcosahedronGeometry(1, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ roughness: 0.94 });
  const stonesPerSection = 32 * 14;
  const sections = [];
  let stones;
  const stonePose = new THREE.Object3D();

  for (let i = 0; i <= steps; i++) {
    const u = i / steps,
      along = (u * length) / cableLength;
    curve.getPointAt(along, point);
    curve.getTangentAt(along, tangent);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (let lane = 0; lane < N; lane++) {
      const [offset, y, tint, alpha] = lanes[lane],
        edge = lane === 0 || lane === N - 1;
      const d = offset + 0.08 * Math.sin(u * length * 0.83 + lane * 0.31) + (edge ? random() * 0.29 : 0);
      pos.push(point.x + side.x * d, y, point.z + side.z * d);
      uv.push(d * 1.4, u * length * 1.4);
      baseColor.setHex(tint).multiplyScalar(0.91 + 0.14 * random());
      colors.push(baseColor.r, baseColor.g, baseColor.b, alpha * (0.87 + 0.13 * random()));
      if (i < steps && lane < N - 1) {
        const a = i * N + lane;
        index.push(a, a + 1, a + N, a + 1, a + N + 1, a + N);
      }
    }
    // The grader pushes larger chips to the shoulders. Flatten them into the
    // soil so a grazing view catches their relief without a costly shadow pass.
    if (i % 32 === 0) {
      stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, stonesPerSection);
      stones.count = 0;
      sections.push(stones);
    }
    for (let j = 0; j < 14; j++) {
      const edge = j < 7,
        d = edge ? (j % 2 ? -0.28 : 2.03) + (random() - 0.5) * 0.49 : 0.31 + random() * 1.54;
      const drift = (random() - 0.5) * 0.67,
        stone = (edge ? 0.019 : 0.01) + random() ** 2 * (edge ? 0.041 : 0.024);
      stonePose.position.set(
        point.x + side.x * d + tangent.x * drift,
        d < 0.05 ? 0.048 : 0.022,
        point.z + side.z * d + tangent.z * drift,
      );
      stonePose.rotation.set(random() * 0.33, random() * Math.PI, random() * 0.29);
      stonePose.scale.set(stone * (1 + 0.47 * random()), stone * 0.45, stone * 0.86);
      stonePose.updateMatrix();
      stones.setMatrixAt(stones.count, stonePose.matrix);
      baseColor
        .setHex([0x9d9686, 0x878574, 0xb2a797, 0xada994, 0x7f7c71][j % 5])
        .multiplyScalar(0.89 + 0.19 * random());
      stones.setColorAt(stones.count++, baseColor);
    }
    if (i % 6 === 2) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.072, 0.46), sleeper);
      foot.position.copy(point);
      foot.position.y = 0.055;
      foot.rotation.y = -Math.atan2(tangent.z, tangent.x);
      root.add(foot);
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 6, 12, Math.PI), band);
      clamp.position.copy(point);
      clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      root.add(clamp);
    }
    for (const edge of [-1, 1]) {
      if (random() < 0.35) continue;
      const d = (edge < 0 ? -0.46 : 2.16) + edge * random() * 0.75;
      const cx = point.x + side.x * d,
        cz = point.z + side.z * d;
      for (let k = 0; k < 14; k++) {
        const a = random() * 6.283,
          r = random() * 0.16,
          x = cx + r * Math.cos(a),
          z = cz + r * Math.sin(a);
        const w = 0.009 + random() * 0.014,
          h = 0.07 + random() ** 2 * 0.21,
          reach = 0.04 + random() * 0.12;
        const dx = Math.cos(a),
          dz = Math.sin(a);
        sprigs.push(
          x - w * dz,
          0.012,
          z + w * dx,
          x + w * dz,
          0.012,
          z - w * dx,
          x + dx * reach,
          h,
          z + dz * reach,
        );
        for (let j = 0; j < 3; j++) {
          baseColor.setHex(j === 2 ? (k % 3 ? 0x9da26b : 0xb0a376) : 0x596742);
          leafColor.push(baseColor.r, baseColor.g, baseColor.b);
          normals.push(dx * 0.35, 0.87, dz * 0.35);
        }
      }
    }
  }
  batch(root);
  // At this distance even the largest chip covers roughly one pixel. The
  // ballast texture underneath provides the distant grain along the road.
  for (const section of sections) {
    section.receiveShadow = true;
    section.computeBoundingSphere();
    const chips = new THREE.LOD();
    chips.position.copy(section.boundingSphere.center);
    section.position.copy(chips.position).negate();
    chips.addLevel(section, 0);
    chips.addLevel(new THREE.Group(), 65 + section.boundingSphere.radius, 0.08);
    root.add(chips);
  }
  const geo = geometry(pos, colors, 4);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const path = new THREE.Mesh(geo, sand);
  path.receiveShadow = true;
  path.renderOrder = -1;
  root.add(path);
  const herbs = geometry(sprigs, leafColor);
  herbs.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const verge = new THREE.Mesh(herbs, blade);
  verge.receiveShadow = true;
  root.add(verge);
}
