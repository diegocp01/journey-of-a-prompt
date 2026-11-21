import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rigidParts } from './rigid-parts.js';

// The rear and rails remain physical as the camera flies past the hand.
// The two front surfaces (photo or fallback display) keep the same tap target.
export function addPhoneHardware(parent, frame) {
  const parts = rigidParts(parent);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x424743,
    roughness: 0.44,
    clearcoat: 0.52,
    clearcoatRoughness: 0.3,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x232629, roughness: 0.59, metalness: 0.36 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x898e8c, roughness: 0.31, metalness: 0.79 });
  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x101f2b,
    metalness: 0.3,
    roughness: 0.11,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    iridescence: 0.23,
    iridescenceIOR: 1.26,
  });
  const flash = new THREE.MeshPhysicalMaterial({ color: 0xdfd6b9, roughness: 0.37, clearcoat: 0.36 });
  const box = (x, y, z, r) => new RoundedBoxGeometry(x, y, z, 3, r);
  function glassBack(w, h, corner, d) {
    const s = new THREE.Shape(),
      x = w / 2 - corner,
      y = h / 2 - corner;
    s.moveTo(-x, -h / 2);
    s.lineTo(x, -h / 2);
    s.absarc(x, -y, corner, -Math.PI / 2, 0);
    s.lineTo(w / 2, y);
    s.absarc(x, y, corner, 0, Math.PI / 2);
    s.lineTo(-x, h / 2);
    s.absarc(-x, y, corner, Math.PI / 2, Math.PI);
    s.lineTo(-w / 2, -y);
    s.absarc(-x, -y, corner, Math.PI, Math.PI * 1.5);
    return new THREE.ExtrudeGeometry(s, {
      depth: d,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.00032,
      bevelThickness: 0.00032,
      curveSegments: 12,
    });
  }
  parts.add(glassBack(0.0732, 0.1548, 0.0108, 0.0018), glass, 0, 0, -0.0055);
  parts.add(glassBack(0.032, 0.033, 0.0067, 0.0025), glass, 0.0184, 0.054, -0.0078);
  for (const [x, y] of [
    [0.025, 0.063],
    [0.0094, 0.0549],
    [0.0248, 0.0458],
  ]) {
    parts.add(new THREE.CylinderGeometry(0.0068, 0.0071, 0.0022, 40), steel, x, y, -0.0083, Math.PI / 2);
    parts.add(new THREE.CylinderGeometry(0.00635, 0.0065, 0.001, 40), dark, x, y, -0.0098, Math.PI / 2);
    const optic = new THREE.SphereGeometry(1, 28, 14).scale(0.0047, 0.0047, 0.00105);
    parts.add(optic, lens, x, y, -0.01015);
    const ring = new THREE.TorusGeometry(0.00572, 0.00022, 6, 36);
    parts.add(ring, frame, x, y, -0.0102);
  }
  parts.add(new THREE.CylinderGeometry(0.0023, 0.0023, 0.001, 20), flash, 0.0101, 0.0668, -0.0081, Math.PI / 2);
  parts.add(new THREE.CylinderGeometry(0.0021, 0.0021, 0.0008, 20), dark, 0.0103, 0.0425, -0.0081, Math.PI / 2);
  for (const side of [-1, 1]) {
    for (const y of [-0.052, 0.057]) {
      parts.add(box(0.00075, 0.00135, 0.0062, 0.00025), dark, side * 0.0379, y, 0);
    }
    for (let i = 0; i < 5; i++) {
      parts.add(
        new THREE.CylinderGeometry(0.0008, 0.0008, 0.00065, 12),
        dark,
        side * (0.0124 + i * 0.0025),
        -0.079,
        0,
      );
    }
    parts.add(new THREE.CylinderGeometry(0.00075, 0.00075, 0.00065, 8), steel, side * 0.0079, -0.0791, 0);
  }
  parts.add(box(0.0095, 0.001, 0.0031, 0.00045), steel, 0, -0.0789, 0);
  parts.add(box(0.0085, 0.0011, 0.0023, 0.0005), dark, 0, -0.0791, 0);
  parts.finish();
}
