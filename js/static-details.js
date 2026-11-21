import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake rigid detail into area-local meshes, one draw per finish. Geometry passed
// here belongs to the assembly; moving and interactive parts stay outside it.
export function batch(part) {
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
    const m = new THREE.Mesh(merged, mat);
    part.add(m);
    m.castShadow = !mat.transparent;
    m.receiveShadow = true;
    geos.forEach((g) => g.dispose());
  }
}
