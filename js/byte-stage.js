import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A neutral studio reflection keeps inset parts readable over the dimmed room.
function studio(color, metal) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'),
    d = g.createImageData(128, 128),
    base = new THREE.Color(color),
    ink = new THREE.Color();
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const nx = (x - 63.5) / 64,
        ny = (63.5 - y) / 64,
        nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const broad = Math.max(0, -nx * 0.46 + ny * 0.77 + nz * 0.43);
      const window = Math.exp(-(((nx + 0.51) / 0.24) ** 2)) * Math.exp(-(((ny - 0.15) / 0.74) ** 2));
      const rim = Math.pow(1 - nz, 2) * 0.28;
      const light = 0.33 + 0.65 * broad + 0.45 * window + rim;
      const col = ink
        .copy(base)
        .multiplyScalar(light)
        .addScalar(metal * 0.34 * window)
        .convertLinearToSRGB();
      const i = (y * 128 + x) * 4;
      d.data.set([col.r * 255, col.g * 255, col.b * 255, 255], i);
    }
  g.putImageData(d, 0, 0);
  const matcap = new THREE.CanvasTexture(c);
  matcap.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshMatcapMaterial({ matcap, transparent: true, depthTest: false, depthWrite: false });
}

export function byteHardware(camera) {
  const root = new THREE.Group(),
    lock = new THREE.Group();
  camera.add(root);
  root.add(lock);
  root.visible = false;
  const shell = studio(0x39434d, 0.27),
    brass = studio(0xdbac5e, 1),
    steel = studio(0xc7d3d9, 1),
    black = studio(0x302d27, 0);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 0.12, 4, 0.085), shell, 64);
  keys.renderOrder = 900.5;
  keys.frustumCulled = false;
  root.add(keys);
  const pose = new THREE.Object3D();
  function part(geometry, material, x, y, z, order) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.renderOrder = order;
    lock.add(mesh);
    return mesh;
  }
  const u = new THREE.CurvePath(),
    v = (x, y) => new THREE.Vector3(x, y, 0);
  u.add(new THREE.LineCurve3(v(-0.4, 0.22), v(-0.4, 0.58)));
  u.add(new THREE.CubicBezierCurve3(v(-0.4, 0.58), v(-0.4, 1.1), v(0.4, 1.1), v(0.4, 0.58)));
  u.add(new THREE.LineCurve3(v(0.4, 0.58), v(0.4, 0.18)));
  const shackle = part(new THREE.TubeGeometry(u, 48, 0.091, 16), steel, 0, 0, 0, 903);
  shackle.name = 'Encryption shackle';
  part(new RoundedBoxGeometry(1.43, 1.01, 0.47, 5, 0.138), brass, 0, -0.17, 0, 904);
  const plug = part(new THREE.CylinderGeometry(0.21, 0.21, 0.075, 36), steel, 0, -0.15, 0.231, 905);
  plug.rotation.x = Math.PI / 2;
  const hole = new THREE.Shape();
  hole.moveTo(-0.036, -0.132);
  hole.lineTo(0.046, -0.132);
  hole.lineTo(0.02, -0.028);
  hole.absarc(0.005, 0.014, 0.057, -1.25, Math.PI + 1.12, false);
  hole.closePath();
  part(new THREE.ShapeGeometry(hole, 16), black, 0, -0.145, 0.273, 906);
  for (const x of [-0.54, 0.54])
    for (const y of [-0.48, 0.13]) part(new THREE.SphereGeometry(0.027, 10, 6), steel, x, y, 0.226, 905);
  let lastLayout = '';
  return function update(state, layout, w, h, plane) {
    root.visible = plane.visible && !!state.text;
    if (!root.visible) return;
    root.position.copy(plane.position);
    root.scale.setScalar(plane.scale.y / h);
    const id = [w, h, state.text, state.lines.length].join('|'),
      n = state.text.length;
    if (id !== lastLayout) {
      const { cols, cw, chh, gy, pad } = layout;
      keys.count = Math.min(n, keys.instanceMatrix.count);
      for (let i = 0; i < keys.count; i++) {
        const row = Math.floor(i / cols),
          inRow = Math.min(cols, n - row * cols);
        pose.position.set(
          pad + ((i % cols) + 0.5 + (cols - inRow) * 0.5) * cw - w * 0.5,
          h * 0.5 - gy - (row + 0.5) * chh - 2,
          -2,
        );
        pose.scale.set(cw - 8, chh - 8, 19);
        pose.updateMatrix();
        keys.setMatrixAt(i, pose.matrix);
      }
      keys.instanceMatrix.needsUpdate = true;
      lastLayout = id;
    }
    shell.opacity = plane.material.opacity;
    lock.visible = state.lock > 0.01;
    if (lock.visible) {
      const { chh, gy, cols } = layout,
        r = Math.min(w, h) * (h >= w ? 0.15 : 0.2);
      lock.position.set(0, h * 0.5 - gy - (chh * Math.ceil(n / cols)) / 2, 9);
      lock.scale.setScalar(r * (0.8 + 0.2 * state.lock));
      lock.rotation.set(-0.1, -0.19 * (1 - state.lock) - 0.13, -0.035 * (1 - state.lock));
      shackle.position.y = (1 - state.lock) * 0.32;
      for (const m of [brass, steel, black]) m.opacity = plane.material.opacity * Math.min(1, state.lock * 2);
    }
  };
}
