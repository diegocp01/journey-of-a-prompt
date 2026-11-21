import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paperStock() {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 432;
  const g = c.getContext('2d'),
    data = g.createImageData(c.width, c.height);
  let seed = 19;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const pulp = 244 + 8 * random() + 2 * Math.sin(y * 0.17 + Math.sin(x * 0.052));
      const i = (y * c.width + x) * 4;
      data.data.set([pulp, pulp - 1, pulp - 3, 255], i);
    }
  g.putImageData(data, 0, 0);
  g.lineWidth = 0.75;
  for (let i = 0; i < 9400; i++) {
    const x = random() * c.width,
      y = random() * c.height;
    g.strokeStyle = i % 3 ? 'rgba(142,123,98,.14)' : 'rgba(255,255,255,.8)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 1 + random() * 4, y + random() * 2 - 1);
    g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

// Folded panels use the same sheet coordinates for continuous paper grain.
// The nose of the flap sits proud of the two creases beneath it.
export function makeEnvelope(parent, lock) {
  const paper = new THREE.MeshStandardMaterial({
    map: paperStock(),
    color: 0xfbf3df,
    emissive: 0xffe9c4,
    emissiveIntensity: 0.1,
    roughness: 0.84,
    envMapIntensity: 0.22,
    vertexColors: true,
  });
  function whiteVertices(g) {
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3),
    );
    return g;
  }
  const body = new THREE.Mesh(whiteVertices(new RoundedBoxGeometry(0.16, 0.108, 0.009, 3, 0.0032)), paper);
  body.name = 'Folded writing paper';
  parent.add(body);
  const panels = [],
    colors = [],
    uvs = [];
  function triangle(a, b, c, t) {
    for (const [x, y, z] of [a, b, c]) {
      panels.push(x, y, z);
      colors.push(t, t, t);
      uvs.push(x / 0.16 + 0.5, y / 0.108 + 0.5);
    }
  }
  const tl = [-0.078, 0.05, 0.0047],
    tr = [0.078, 0.05, 0.0047],
    bl = [-0.078, -0.051, 0.0048],
    br = [0.078, -0.051, 0.0048];
  const nose = [0, -0.0062, 0.009],
    lowerFold = [0, 0.006, 0.007];
  triangle(bl, br, lowerFold, 0.975);
  triangle(bl, lowerFold, tl, 0.9);
  triangle(lowerFold, br, tr, 0.945);

  const folds = new THREE.BufferGeometry();
  for (const [key, values, n] of [
    ['position', panels, 3],
    ['uv', uvs, 2],
    ['color', colors, 3],
  ])
    folds.setAttribute(key, new THREE.Float32BufferAttribute(values, n));
  folds.computeVertexNormals();
  parent.add(new THREE.Mesh(folds, paper));
  const hinge = new THREE.Group();
  hinge.position.set(0, tl[1], tl[2]);
  parent.add(hinge);
  const lid = new THREE.BufferGeometry(),
    lidPts = [tl, nose, tr, tr, nose, tl];
  lid.setAttribute('position', new THREE.Float32BufferAttribute(lidPts.flat(), 3));
  lid.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      lidPts.flatMap(([x, y]) => [x / 0.16 + 0.5, y / 0.108 + 0.5]),
      2,
    ),
  );
  lid.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      lidPts.flatMap((_, i) => (i < 3 ? [1, 1, 1] : [0.85, 0.83, 0.79])),
      3,
    ),
  );
  lid.translate(0, -tl[1], -tl[2]);
  lid.computeVertexNormals();
  hinge.add(new THREE.Mesh(lid, paper));
  const flap = new THREE.MeshStandardMaterial({
    color: 0xda9a41,
    roughness: 0.48,
    metalness: 0.32,
    emissive: 0xe79923,
    emissiveIntensity: 0.42,
  });
  const outline = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.077, 0.049, 0.0054),
    new THREE.Vector3(-0.041, 0.022, 0.0074),
    new THREE.Vector3(-0.004, -0.004, 0.0093),
    new THREE.Vector3(0, -0.0058, 0.0095),
    new THREE.Vector3(0.004, -0.004, 0.0093),
    new THREE.Vector3(0.041, 0.022, 0.0074),
    new THREE.Vector3(0.077, 0.049, 0.0054),
  ]);
  hinge.add(new THREE.Mesh(new THREE.TubeGeometry(outline, 54, 0.00135, 8).translate(0, -tl[1], -tl[2]), flap));

  const silver = new THREE.MeshStandardMaterial({
    color: 0xcad8e5,
    metalness: 0.76,
    roughness: 0.3,
    emissive: 0x526c84,
    emissiveIntensity: 0.34,
  });
  const caseMesh = new THREE.Mesh(new RoundedBoxGeometry(0.033, 0.026, 0.009, 4, 0.0038), silver);
  lock.add(caseMesh);
  const path = new THREE.CurvePath();
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  path.add(new THREE.LineCurve3(V(-0.0105, 0.01), V(-0.0105, 0.019)));
  path.add(new THREE.CubicBezierCurve3(V(-0.0105, 0.019), V(-0.0105, 0.033), V(0.0105, 0.033), V(0.0105, 0.019)));
  path.add(new THREE.LineCurve3(V(0.0105, 0.019), V(0.0105, 0.01)));
  lock.add(new THREE.Mesh(new THREE.TubeGeometry(path, 36, 0.0023, 10), silver));
  const plate = new THREE.Mesh(
    new RoundedBoxGeometry(0.029, 0.021, 0.0018, 3, 0.0032),
    new THREE.MeshStandardMaterial({
      color: 0xb1874e,
      metalness: 0.69,
      roughness: 0.38,
      emissive: 0x68441a,
      emissiveIntensity: 0.36,
    }),
  );
  plate.position.z = 0.0049;
  lock.add(plate);
  const key = new THREE.Shape();
  key.moveTo(-0.0013, -0.0046);
  key.lineTo(0.0013, -0.0046);
  key.lineTo(0.0009, -0.0002);
  key.absarc(0, 0.0018, 0.0023, -1.17, Math.PI + 1.17, false);
  key.closePath();
  const slot = new THREE.ShapeGeometry(key, 14).translate(0, 0, 0.0061);
  const rivets = [];
  for (const x of [-0.0117, 0.0117])
    for (const y of [-0.0077, 0.0077])
      rivets.push(new THREE.SphereGeometry(0.00085, 8, 6).translate(x, y, 0.0059));
  lock.add(new THREE.Mesh(mergeGeometries(rivets), silver));
  rivets.forEach((g) => g.dispose());
  lock.add(new THREE.Mesh(slot, new THREE.MeshBasicMaterial({ color: 0x443c34 })));
  lock.position.set(0.055, -0.027, 0.011);
  parent.add(lock);
  return { body, paper, flap, hinge };
}
