import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Stationary fittings can share a draw call while retaining their actual silhouettes.
export function rigidParts(parent) {
  const batches = new Map(),
    pose = new THREE.Object3D();
  function add(geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    pose.position.set(x, y, z);
    pose.rotation.set(rx, ry, rz);
    pose.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.applyMatrix4(pose.matrix);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(g);
  }
  function finish() {
    for (const [material, parts] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(parts), material);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      parts.forEach((g) => g.dispose());
    }
    batches.clear();
  }
  return { add, finish };
}
