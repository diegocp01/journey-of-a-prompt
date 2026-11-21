import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// All parts share a single animated mesh. The snout is +X; bending increases
// from the trunk to the tail, so the skull, gill covers and eyes remain stable.
function fishShape(deep) {
  const parts = [];
  function add(geometry, color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== g) geometry.dispose();
    if (!g.attributes.uv)
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) {
      // Fins and eyes sample a neutral texel outside the scale field.
      const uv = g.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, 0, 1);
    }
    if (!g.attributes.color) {
      const c = new THREE.Color(color),
        colors = [];
      for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    parts.push(g);
  }
  function oval(x, y, z, a, b, c, color) {
    const g = new THREE.SphereGeometry(1, 12, 8);
    g.scale(a, b, c);
    g.translate(x, y, z);
    add(g, color);
  }
  function line(points, r, color) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => v(...p))), 10, r, 5, false), color);
  }

  // Cross sections run from the caudal tip to the nose, with separate back,
  // belly and cheek profiles. The grenadier has a long, tapering tail.
  const rings = deep
    ? [
        [-0.94, 0.003, 0.004, -0.025],
        [-0.76, 0.02, 0.009, -0.025],
        [-0.55, 0.051, 0.024, -0.023],
        [-0.3, 0.1, 0.046, -0.01],
        [-0.06, 0.145, 0.082, 0.012],
        [0.15, 0.177, 0.106, 0.02],
        [0.32, 0.147, 0.105, 0.014],
        [0.42, 0.101, 0.081, 0.01],
        [0.51, 0.048, 0.048, 0.002],
        [0.55, 0.003, 0.004, -0.006],
      ]
    : [
        [-0.46, 0.025, 0.017, 0.012],
        [-0.37, 0.052, 0.036, 0.01],
        [-0.24, 0.118, 0.059, 0],
        [-0.05, 0.158, 0.079, 0.005],
        [0.14, 0.154, 0.077, 0.007],
        [0.27, 0.116, 0.071, 0.005],
        [0.365, 0.063, 0.048, 0.003],
        [0.405, 0.009, 0.009, 0.006],
      ];
  const sections = new THREE.CatmullRomCurve3(
    rings.map(([x, h, w]) => v(x, h, w)),
    false,
    'catmullrom',
    0.27,
  );
  const pos = [],
    colors = [],
    bodyUV = [],
    index = [],
    segments = 36,
    sides = 32;
  const belly = new THREE.Color(deep ? 0xcdc5aa : 0xc4d5cf),
    flank = new THREE.Color(deep ? 0x938976 : 0x8da6a2),
    back = new THREE.Color(deep ? 0x625e54 : 0x386067);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = sections.getPoint(t),
      ring = t * (rings.length - 1),
      k = Math.min(Math.floor(ring), rings.length - 2);
    const cy = THREE.MathUtils.lerp(rings[k][3], rings[k + 1][3], ring - k);
    for (let j = 0; j < sides; j++) {
      const angle = (TAU * j) / sides,
        y = Math.cos(angle),
        z = Math.sin(angle);
      pos.push(p.x, cy + p.y * y, p.z * z);
      bodyUV.push(0.03 + t * 0.94, 0.04 + (y * 0.5 + 0.5) * 0.91);
      const col = flank.clone().lerp(y > 0 ? back : belly, Math.abs(y) ** 0.78);
      const scales = (Math.sin(i * 3.7 + j * 0.77) * 0.5 + 0.5) * 0.08;
      const lateralLine = Math.exp(-Math.abs(y - 0.1) * 28) * 0.19;
      // Countershading and reflective opercula read at school distance.
      const cheek = Math.exp(-((p.x - (deep ? 0.31 : 0.245)) ** 2) / 0.005) * Math.max(0, 1 - y * y);
      col.lerp(new THREE.Color(deep ? 0xa8a084 : 0xc9d6c1), cheek * 0.37);
      col.multiplyScalar(1 + scales - lateralLine);
      colors.push(col.r, col.g, col.b);
      if (i < segments) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides);
        index.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  skin.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  skin.setAttribute('uv', new THREE.Float32BufferAttribute(bodyUV, 2));
  skin.setIndex(index);
  skin.computeVertexNormals();
  add(skin);

  // A membrane stretched over a fan of rays, with a scalloped outer edge.
  function fin(base, edge, shade) {
    const a = new THREE.CatmullRomCurve3(base.map((p) => v(...p))),
      b = new THREE.CatmullRomCurve3(edge.map((p) => v(...p)));
    const positions = [],
      tints = [],
      indices = [],
      n = 20;
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        root = a.getPoint(t),
        tip = b.getPoint(t);
      tip.lerp(root, 0.04 * Math.sin((Math.PI * i) / 2) ** 2);
      for (const [j, f] of [0, 0.52, 1].entries()) {
        const p = root.clone().lerp(tip, f);
        p.z += 0.014 * Math.sin(Math.PI * f) * Math.sin(Math.PI * t);
        positions.push(p.x, p.y, p.z);
        const c = new THREE.Color(shade).multiplyScalar((0.78 + f * 0.2) * (i % 2 ? 0.85 : 1.19));
        tints.push(c.r, c.g, c.b);
        if (i < n && j < 2) {
          const k = i * 3 + j;
          indices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    add(g);
  }
  if (deep) {
    fin(
      [
        [-0.23, 0.1, 0],
        [0.02, 0.15, 0],
        [0.18, 0.175, 0],
      ],
      [
        [-0.26, 0.12, 0],
        [-0.025, 0.24, 0],
        [0.109, 0.324, 0],
        [0.18, 0.179, 0],
      ],
      0x788789,
    );
    fin(
      [
        [-0.91, -0.015, 0],
        [-0.51, 0.033, 0],
        [-0.27, 0.085, 0],
      ],
      [
        [-0.93, 0.006, 0],
        [-0.65, 0.062, 0],
        [-0.29, 0.119, 0],
      ],
      0x778486,
    );
    fin(
      [
        [-0.91, -0.027, 0],
        [-0.52, -0.067, 0],
        [0.01, -0.13, 0],
      ],
      [
        [-0.925, -0.041, 0],
        [-0.48, -0.113, 0],
        [0.005, -0.163, 0],
      ],
      0xb1a596,
    );
    line(
      [
        [0.386, -0.068, 0],
        [0.368, -0.115, 0.006],
        [0.342, -0.137, 0.012],
      ],
      0.003,
      0xc7c3b3,
    );
  } else {
    fin(
      [
        [-0.45, -0.024, 0],
        [-0.45, 0.01, 0],
        [-0.45, 0.039, 0],
      ],
      [
        [-0.63, -0.151, 0],
        [-0.535, -0.052, 0],
        [-0.515, 0.005, 0],
        [-0.55, 0.075, 0],
        [-0.635, 0.169, 0],
      ],
      0x627d80,
    );
    fin(
      [
        [-0.23, 0.095, 0],
        [-0.05, 0.154, 0],
        [0.1, 0.156, 0],
      ],
      [
        [-0.25, 0.108, 0],
        [-0.128, 0.235, 0],
        [0.018, 0.253, 0],
        [0.1, 0.156, 0],
      ],
      0x6b8383,
    );
    fin(
      [
        [-0.34, -0.05, 0],
        [-0.19, -0.123, 0],
        [-0.07, -0.147, 0],
      ],
      [
        [-0.37, -0.105, 0],
        [-0.225, -0.183, 0],
        [-0.07, -0.147, 0],
      ],
      0x9eafac,
    );
  }
  if (!deep) {
    // The narrow caudal peduncle carries small finlets ahead of the fork.
    for (let i = 0; i < 4; i++) {
      const x = -0.393 + i * 0.038,
        y = 0.043 + i * 0.014;
      for (const side of [-1, 1]) {
        const base = [
          [x - 0.012, side * y, 0],
          [x, side * (y + 0.002), 0],
          [x + 0.025, side * (y + 0.008), 0],
        ];
        fin(
          base,
          [
            [x - 0.012, side * y, 0],
            [x - 0.006, side * (y + 0.035), 0],
            [x + 0.025, side * (y + 0.008), 0],
          ],
          0x667d78,
        );
      }
    }
  }
  for (const side of [-1, 1]) {
    const eyeX = deep ? 0.325 : 0.268,
      eyeY = deep ? 0.067 : 0.05,
      eyeZ = deep ? 0.09 : 0.065,
      r = deep ? 0.033 : 0.024;
    oval(eyeX, eyeY, side * eyeZ, r * 1.23, r * 1.13, r * 0.56, 0x4f5753);
    oval(eyeX, eyeY, side * (eyeZ + 0.008), r, r, r * 0.62, 0xc2ac6e);
    oval(eyeX + 0.003, eyeY, side * (eyeZ + 0.016), r * 0.79, r * 0.82, r * 0.58, 0x101b22);
    oval(eyeX + 0.009, eyeY + r * 0.3, side * (eyeZ + 0.016 + r * 0.48), r * 0.16, r * 0.14, r * 0.11, 0xf3ede0);
    const x = deep ? 0.234 : 0.185,
      z = deep ? 0.104 : 0.075;
    line(
      [
        [x + 0.018, 0.096, side * z * 0.71],
        [x - 0.009, 0.032, side * z],
        [x - 0.018, -0.028, side * z],
        [x + 0.018, -0.081, side * z * 0.72],
      ],
      0.004,
      0x56615e,
    );
    fin(
      [
        [x, -0.024, side * z],
        [x + 0.008, -0.045, side * z],
        [x + 0.028, -0.059, side * z * 0.85],
      ],
      [
        [x, -0.022, side * z],
        [x - 0.11, -0.068, side * (z + 0.08)],
        [x - 0.21, -0.113, side * (z + 0.104)],
        [x + 0.023, -0.06, side * z],
      ],
      0x83928d,
    );
    const mouthX = deep ? 0.544 : 0.4;
    line(
      [
        [mouthX, -0.006, side * 0.006],
        [mouthX - 0.045, -0.025, side * 0.036],
        [mouthX - 0.082, -0.026, side * 0.056],
      ],
      0.0033,
      0x545951,
    );
  }
  const result = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!deep) result.scale(1, 0.82, 0.95);
  return result;
}

export function createOceanFish(parent, bedHeight, random) {
  const clock = { value: 0 },
    d = new THREE.Object3D();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 512, 192);
  for (let row = 0; row < 22; row++)
    for (let col = 0; col < 51; col++) {
      const x = 17 + col * 8.3 + (row % 2) * 4.15,
        y = 9 + row * 8;
      ctx.strokeStyle = 'rgba(43,68,70,.25)';
      ctx.lineWidth = 0.92;
      ctx.beginPath();
      ctx.ellipse(x, y, 5.3, 4.8, 0.12, -1.32, 1.32);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(72,87,84,.10)';
      ctx.beginPath();
      ctx.ellipse(x + 1.1, y + 0.2, 5.4, 4.5, 0.12, -0.9, 0.9);
      ctx.stroke();
    }
  const pelagic = document.createElement('canvas');
  pelagic.width = canvas.width;
  pelagic.height = canvas.height;
  const flankCtx = pelagic.getContext('2d');
  flankCtx.drawImage(canvas, 0, 0);
  // Narrow, irregular dorsal bars fade to silver well above the lateral line.
  flankCtx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const x = 102 + i * 14,
      top = 11 + 3 * Math.sin(i * 3.4),
      bottom = 58 + 19 * Math.sin(i * 2.13) ** 2;
    const fade = flankCtx.createLinearGradient(x, top, x, bottom);
    fade.addColorStop(0, 'rgba(28,48,46,.68)');
    fade.addColorStop(0.65, 'rgba(38,55,51,.55)');
    fade.addColorStop(1, 'rgba(54,72,69,.04)');
    flankCtx.strokeStyle = fade;
    flankCtx.lineWidth = 3.3 + (i % 3) * 0.65;
    flankCtx.beginPath();
    flankCtx.moveTo(x, top);
    flankCtx.bezierCurveTo(x - 15, top + 20, x + 15, bottom - 27, x - 6, bottom);
    flankCtx.stroke();
  }
  const pelagicMap = new THREE.CanvasTexture(pelagic);
  pelagicMap.colorSpace = THREE.SRGBColorSpace;
  pelagicMap.anisotropy = 4;
  const scales = new THREE.CanvasTexture(canvas);
  scales.colorSpace = THREE.SRGBColorSpace;
  scales.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: scales,
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.seaTime = clock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float seaTime;')
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float phase = instanceMatrix[3].x*.63 + instanceMatrix[3].z;
        float hind = clamp((.21-position.x)*.96,0.,1.2);
        float angle = seaTime*4.0 + phase + position.x*4.4;
        float slope = -.41*hind*sin(angle) + .93*hind*hind*cos(angle);
        objectNormal.x -= slope*objectNormal.z;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.z += .21*hind*hind*sin(angle);`,
      );
  };
  const schools = [[], []];
  // Shallow shoals follow shared headings, with individual spacing and phase.
  for (const x of [138, 145, 238, 243]) {
    const phase = random() * TAU;
    for (let i = 0; i < 11; i++)
      schools[0].push({
        x: x + (random() - 0.5) * 3.8,
        z: -2.8 + (random() - 0.5) * 3.5,
        clearance: 1 + random() * 1.1,
        phase: phase + random() * 0.6,
        pace: 0.25,
        radius: 1.1 + random() * 0.55,
        scale: 0.46 + random() * 0.3,
      });
  }
  // Loose groups in the water column, separated from the solitary foragers below them.
  for (const [x, z] of [
    [170, -4.4],
    [187, -3.2],
    [198, -2.6],
    [215, -3.8],
    [228, 1.7],
  ]) {
    const phase = random() * TAU;
    for (let j = 0; j < 5; j++)
      schools[0].push({
        x: x + j * 0.43,
        z: z + Math.sin(j * 2) * 1.0,
        clearance: 1.75 + 0.27 * Math.cos(j * 1.7),
        phase: phase + j * 0.13,
        heading: 1.19,
        pace: 0.17,
        radius: 1.4,
        scale: j === 0 ? 1.05 : 0.59 + random() * 0.31,
      });
  }
  // Slow bottom dwellers, stationed on alternating shoulders of the cable corridor.
  for (const [x, z, h, s] of [
    [152, -2, 1, 0.78],
    [162, 1.6, 0.62, 0.9],
    [173, -2.1, 1.12, 1.1],
    [182, -1.2, 0.95, 0.95],
    [188, 2.2, 0.74, 0.86],
    [194, -2.2, 1.38, 1.2],
    [199, 1.9, 0.95, 1.05],
    [203, -1.25, 1.47, 1.14],
    [213, 1.2, 0.88, 0.93],
    [222, -2.3, 1.12, 1.05],
    [230, 0.8, 0.75, 0.83],
  ]) {
    schools[1].push({
      x,
      z,
      clearance: h,
      phase: random() * TAU,
      heading: (random() < 0.5 ? -1 : 1) * 1.3,
      pace: 0.12 + random() * 0.04,
      radius: 0.95 + random() * 0.65,
      scale: s,
    });
  }
  const meshes = schools.map((fish, i) => {
    let surface = material;
    if (i === 0) {
      surface = material.clone();
      surface.map = pelagicMap;
      surface.roughness = 0.41;
      surface.onBeforeCompile = material.onBeforeCompile;
    }
    const m = new THREE.InstancedMesh(fishShape(i === 1), surface, fish.length);
    m.name = i ? 'Deep-water grenadiers' : 'Silvery coastal shoals';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    parent.add(m);
    return m;
  });
  return (time, cameraX) => {
    clock.value = time;
    schools.forEach((fish, i) => {
      let visible = 0;
      fish.forEach((f) => {
        if (Math.abs(f.x - cameraX) > 36) return;
        const a = f.phase + time * f.pace,
          heading = f.heading || 0,
          c = Math.cos(heading),
          s = Math.sin(heading);
        const u = f.radius * Math.sin(a),
          w = f.radius * 0.4 * Math.sin(2 * a + 0.4);
        const x = f.x + c * u - s * w,
          z = f.z + s * u + c * w;
        const du = Math.cos(a),
          dw = 0.8 * Math.cos(2 * a + 0.4);
        const y = bedHeight(x, z) + f.clearance + 0.091 * Math.sin(a * 1.7 + f.phase);
        d.position.set(x, y, z);
        d.rotation.order = 'YXZ';
        d.rotation.set(
          0.06 * Math.sin(a * 2),
          Math.atan2(-s * du - c * dw, c * du - s * dw),
          0.045 * Math.cos(a * 1.7),
        );
        d.scale.setScalar(f.scale);
        d.updateMatrix();
        meshes[i].setMatrixAt(visible++, d.matrix);
      });
      meshes[i].count = visible;
      meshes[i].instanceMatrix.needsUpdate = true;
    });
  };
}
