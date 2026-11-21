import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A cut olive shoot grows opposite pairs at the nodes. The long shoots keep
// their woody bare bases; smaller shoots carry the leaves out into the light.
export function oliveBranches(vase, leafMap, random) {
  const fruit = [];
  const twigs = [],
    positions = [],
    uvs = [],
    tints = [],
    indices = [];
  const rows = 12,
    cross = [-1, -0.68, -0.17, 0, 0.17, 0.68, 1];

  function stem(curve, radius, tipRadius, segments, young = false) {
    const sides = 6,
      tube = new THREE.TubeGeometry(curve, segments, radius, sides, false);
    const centers = curve.getSpacedPoints(segments);
    const pos = tube.attributes.position,
      colors = [],
      p = V(0, 0, 0);
    const base = new THREE.Color(young ? 0x7c784b : 0x61523c);
    for (let j = 0; j <= segments; j++) {
      const taper = THREE.MathUtils.lerp(1, tipRadius / radius, j / segments);
      for (let k = 0; k <= sides; k++) {
        const i = j * (sides + 1) + k,
          center = centers[j];
        p.fromBufferAttribute(pos, i).sub(center).multiplyScalar(taper).add(center);
        pos.setXYZ(i, p.x, p.y, p.z);
        const grain = 0.85 + 0.22 * Math.cos((k * Math.PI) / 3) + random() * 0.13;
        colors.push(base.r * grain, base.g * grain, base.b * grain);
      }
    }
    tube.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    twigs.push(tube);
  }

  function leaf(start, direction, length, young) {
    const axis = direction.clone().normalize();
    // Adjacent leaves twist around their petioles, exposing both the waxy
    // green upper skin and the distinctly paler, matte silver underside.
    const facing = V(random() - 0.5, 0.26 + random() * 0.7, random() < 0.22 ? -0.55 : 0.8);
    const side = axis.clone().cross(facing).normalize(),
      normal = side.clone().cross(axis);
    const first = positions.length / 3,
      width = length * (0.135 + random() * 0.046);
    const twist = (random() - 0.5) * 1.3,
      droop = 0.11 + random() * 0.13;
    const curl = (random() - 0.28) * length * 0.15,
      skew = (random() - 0.5) * length * 0.09;
    const tone = (young ? 1.22 : 0.89) + random() * 0.32;
    const along = V(0, 0, 0),
      across = V(0, 0, 0),
      up = V(0, 0, 0),
      p = V(0, 0, 0);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows,
        arch = Math.sin(Math.PI * t);
      const half = width * Math.max(0.004, arch ** 0.83) * (1.15 - 0.28 * t);
      along
        .copy(start)
        .addScaledVector(axis, length * t)
        .addScaledVector(side, arch * skew);
      along.addScaledVector(normal, curl * arch);
      along.y -= length * droop * t * t;
      across.copy(side).applyAxisAngle(axis, t * twist);
      up.copy(across).cross(axis);
      for (let k = 0; k < cross.length; k++) {
        const u = cross[k],
          camber = 0.31 * (1 - u * u) + 0.07 * Math.exp(-Math.abs(u) * 18);
        p.copy(along)
          .addScaledVector(across, half * u)
          .addScaledVector(up, half * camber);
        positions.push(p.x, p.y, p.z);
        uvs.push(0.5 + u * 0.5, t);
        tints.push(tone, tone * (young ? 1.01 : 0.98), tone * (young ? 0.83 : 0.96));
        if (j < rows && k + 1 < cross.length) {
          const a = first + j * cross.length + k,
            b = a + cross.length;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
  }

  function dress(curve, count, startAt, size, fruitNode = -1) {
    const spin = random() * Math.PI;
    for (let n = 0; n < count; n++) {
      const t = startAt + ((0.91 - startAt) * n) / (count - 1);
      const node = curve.getPoint(t),
        tangent = curve.getTangent(t);
      const angle = spin + n * 1.56 + (random() - 0.5) * 0.42;
      const lateral = V(Math.cos(angle), 0, Math.sin(angle) * 0.68);
      if (n === fruitNode) {
        const tip = node.clone().addScaledVector(lateral, .0065);
        tip.y -= .009;
        stem(new THREE.QuadraticBezierCurve3(node, node.clone().addScaledVector(lateral,.0055), tip),
          .00046, .00030, 4, true);
        fruit.push(tip.clone().add(V(0,-.005,0)));
      }
      for (const sign of [-1, 1]) {
        const d = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(tangent, 0.42 + random() * 0.58);
        d.y += 0.09 + random() * 0.44;
        d.normalize();
        const petiole = node.clone().addScaledVector(d, 0.003 + random() * 0.0025);
        stem(new THREE.LineCurve3(node, petiole), 0.00047, 0.00025, 1, true);
        leaf(petiole, d, size * (0.78 + random() * 0.43) * (1 - 0.25 * t), t > 0.85);
      }
    }
    leaf(curve.getPoint(1), curve.getTangent(1), size * 0.58, true);
  }

  for (const [x, y, z, forkX, forkY, forkZ] of [
    [-0.112, 0.159, 0.01, -0.075, 0.187, -0.004],
    [-0.056, 0.205, -0.029, -0.085, 0.169, -0.032],
    [-0.021, 0.176, 0.039, -0.043, 0.158, 0.052],
    [0.026, 0.222, 0.006, 0.063, 0.203, 0.02],
    [0.058, 0.174, -0.041, 0.032, 0.193, -0.052],
    [0.012, 0.159, 0.042, -0.024, 0.147, 0.045],
    [0.121, 0.156, 0.017, 0.087, 0.168, 0.041],
  ]) {
    const foot = V((random() - 0.5) * 0.027, 0.079, (random() - 0.5) * 0.021);
    const end = V(x, y, z),
      curve = new THREE.QuadraticBezierCurve3(foot, V(x * 0.3, y - 0.023, z * 0.35), end);
    stem(curve, 0.00127 + random() * 0.00045, 0.00029, 9);
    const fruitNode = x < -.08 || x > .09 ? 2 : z > .03 ? 1 : -1;
    dress(curve, 4, 0.32 + random() * 0.12, 0.04, fruitNode);
    const node = curve.getPoint(0.36 + random() * 0.14),
      fork = V(forkX, forkY, forkZ);
    const joint = node.clone().lerp(fork, 0.45).addScaledVector(curve.getTangent(0.5), 0.007);
    const branch = new THREE.QuadraticBezierCurve3(node, joint, fork);
    stem(branch, 0.00091, 0.00023, 6, true);
    dress(branch, 3, 0.28, 0.036);
  }
  const olives=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,12),
    new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.52,clearcoat:.14,clearcoatRoughness:.47}),fruit.length);
  const pose=new THREE.Object3D();
  fruit.forEach((p,i)=>{
    pose.position.copy(p);pose.rotation.z=.18*Math.sin(i*2);
    pose.scale.set(.0040,.0062,.0039).multiplyScalar(.91+.12*Math.cos(i*1.72));
    pose.updateMatrix();olives.setMatrixAt(i,pose.matrix);
    olives.setColorAt(i,new THREE.Color([0x73814e,0x7b8556,0x565043,0x697242][i%4]));
  });
  olives.castShadow=olives.receiveShadow=true;vase.add(olives);
  const wood = new THREE.Mesh(
    mergeGeometries(twigs),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
    }),
  );
  twigs.forEach((g) => g.dispose());
  wood.castShadow = wood.receiveShadow = true;
  vase.add(wood);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const upper = new THREE.MeshPhysicalMaterial({
    map: leafMap,
    vertexColors: true,
    roughness: 0.52,
    clearcoat: 0.14,
    clearcoatRoughness: 0.43,
    specularIntensity: 0.54,
  });
  upper.shadowSide = THREE.DoubleSide;
  const blades = new THREE.Mesh(geo, upper);
  blades.name = 'Olive leaf blades';
  blades.castShadow = blades.receiveShadow = true;
  const undersides = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x778065,
      bumpMap: leafMap,
      bumpScale: 0.00008,
      roughness: 0.86,
      side: THREE.BackSide,
      vertexColors: true,
    }),
  );
  undersides.receiveShadow = true;
  vase.add(blades, undersides);
}
