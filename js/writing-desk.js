/* The writing desk faces the window. In its local coordinates x runs along the
   sill, y is height above the tabletop, and positive z points into the room. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {fitDesk, addDimmer, addBookmark} from './desk-joinery.js';
import { oliveBranches } from './desk-olive.js';
import { buildRouter } from './desk-router.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const material = (color, roughness, other = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...other });

function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  // Keep the direction of the brushed brass attached to the curved metal
  // as the camera moves. The shade and stem both have indexed UVs.
  if (mat.anisotropy > 0 && geometry.index) geometry.computeTangents();
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function turned(parent, points, mat, x = 0, y = 0, z = 0, segments = 72) {
  return mesh(
    parent,
    new THREE.LatheGeometry(
      points.map(([r, h]) => new THREE.Vector2(r, h)),
      segments,
    ),
    mat,
    x,
    y,
    z,
  );
}

function seeded(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
}

function surface(width, height, pixel, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d'),
    image = ctx.createImageData(width, height);
  const random = seeded(942);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = pixel(x, y, random),
        i = (y * width + x) * 4;
      image.data[i] = rgb[0];
      image.data[i + 1] = rgb[1];
      image.data[i + 2] = rgb[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (draw) draw(ctx, width, height, random);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function colorMap(name) {
  const tex = new THREE.TextureLoader().load(new URL(`../assets/desk/${name}.jpg`, import.meta.url).href);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// The shade reflects a broad window, a dark wall and the warm desk beneath
// it. These radiance cards are convolved once, outside the tour's render loop.
function windowReflections(pmrem) {
  const room = new THREE.Scene(),
    center = V(0, 0, 0);
  room.background = new THREE.Color(0x827466).multiplyScalar(0.52);
  function card(x, y, z, w, h, radiance) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...radiance), side: THREE.DoubleSide });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    card.position.set(x, y, z);
    card.lookAt(center);
    room.add(card);
  }
  // A wall opposite the glazing returns a broad, warm reflection. Its solid
  // angle matters on the narrow stem, where a small bright card looks like a spark.
  card(-2.5, 1.0, -0.6, 1.35, 3.5, [2.65, 2.12, 1.64]);
  card(-1.4, 2.7, 0.8, 2.4, 2.0, [0.69, 0.61, 0.51]);
  card(0.1, -2.0, 0.1, 6, 5, [0.22, 0.135, 0.082]);
  for (const z of [-1.38, 0, 1.38]) card(2.5, 0.83, z, 1.3, 2, [1.0, 1.08, 1.2]);
  const env = pmrem.fromScene(room, 0.028).texture;
  room.children.forEach((m) => {
    m.geometry.dispose();
    m.material.dispose();
  });
  return env;
}

function lamp(parent, brass) {
  const trim = material(0x6e4f2a, 0.39, { metalness: 0.82, envMap: brass.envMap });
  const felt = material(0x504439, 0.94);
  turned(
    parent,
    [
      [0, 0],
      [0.038, 0],
      [0.0396, 0.0009],
      [0.0396, 0.0019],
    ],
    felt,
  );
  const stoneMap = colorMap('ivory-marble');
  const plinth = turned(
    parent,
    [
      [0, 0.0017],
      [0.039, 0.0017],
      [0.041, 0.0023],
      [0.0422, 0.0037],
      [0.0424, 0.0054],
      [0.0424, 0.0326],
      [0.0421, 0.0341],
      [0.0414, 0.0352],
      [0.04, 0.0358],
      [0, 0.0358],
    ],
    new THREE.MeshPhysicalMaterial({
      color: 0xd8c7b4,
      map: stoneMap,
      roughness: 0.43,
      clearcoat: 0.13,
      clearcoatRoughness: 0.32,
    }),
  );
  // A tilted slice through the same stone runs across the top, bevel and
  // cylindrical side without a stretched radial cap or a seam in the veins.
  const pos = plinth.geometry.attributes.position,
    uv = plinth.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    uv.setXY(i, 0.49 + (x + 0.26 * z) / 0.105, 0.4 + (y - 0.014 + z * 0.75) / 0.116);
  }
  turned(
    parent,
    [
      [0.004, 0.0357],
      [0.0088, 0.0357],
      [0.0088, 0.0365],
      [0.0081, 0.0373],
      [0.0061, 0.0375],
      [0.0058, 0.0396],
      [0.0043, 0.0401],
    ],
    brass,
  );
  const pole = new THREE.CurvePath();
  pole.add(new THREE.LineCurve3(V(0, 0.038, 0), V(0, 0.331, 0)));
  pole.add(new THREE.QuadraticBezierCurve3(V(0, 0.331, 0), V(0, 0.367, 0), V(0.033, 0.367, 0)));
  pole.add(new THREE.LineCurve3(V(0.033, 0.367, 0), V(0.151, 0.367, 0)));
  mesh(parent, new THREE.TubeGeometry(pole, 72, 0.0039, 32, false), brass);
  const shadeX = 0.151;
  const head = new THREE.Group();
  head.position.y = 0.033;
  parent.add(head);
  turned(
    head,
    [
      [0.004, 0.315],
      [0.0083, 0.315],
      [0.0088, 0.317],
      [0.0088, 0.3366],
      [0.008, 0.338],
      [0, 0.338],
    ],
    brass,
    shadeX,
  );
  turned(
    head,
    [
      [0.00875, 0.3298],
      [0.0091, 0.33],
      [0.0091, 0.3308],
      [0.00875, 0.331],
    ],
    trim,
    shadeX,
  );
  // Spun brass has a continuously curved crown and a rolled outer rim. The
  // opal glass below is slightly convex, so it stays luminous from the side.
  const profile = new THREE.SplineCurve(
    [
      [0.0925, 0.2799],
      [0.0911, 0.2868],
      [0.0856, 0.2962],
      [0.0742, 0.3075],
      [0.0552, 0.3161],
      [0.032, 0.3226],
      [0.015, 0.3249],
      [0, 0.3253],
    ].map(([r, h]) => new THREE.Vector2(r, h)),
  )
    .getPoints(30)
    .map((p) => [p.x, p.y]);
  const spunShade = turned(
    head, [[0.0905, 0.2788], [0.0917, 0.2783], [0.0924, 0.2788], ...profile], brass, shadeX, 0, 0, 144,
  );
  // The thin folded rim sits inside the shadow bias at this scale.
  spunShade.receiveShadow = false;
  turned(
    head,
    [
      [0.088, 0.2793],
      [0.0895, 0.2783],
      [0.091, 0.2786],
      [0.091, 0.2797],
    ],
    trim,
    shadeX,
  );
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffe9cc,
    emissive: 0xffd29a,
    emissiveIntensity: 3.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  const diffuser = turned(
    head,
    [
      [0, 0.2722],
      [0.035, 0.2728],
      [0.066, 0.2744],
      [0.085, 0.2771],
      [0.0893, 0.2785],
      [0.09, 0.28],
    ],
    glass,
    shadeX,
  );
  diffuser.castShadow = false;
  const cord = new THREE.CatmullRomCurve3([
    V(-0.011, 0.008, -0.038),
    V(-0.012, 0.006, -0.046),
    V(-0.021, 0.0017, -0.059),
    V(-0.05, 0.0016, -0.083),
    V(-0.064, 0.0005, -0.107),
  ]);
  mesh(parent, new THREE.TubeGeometry(cord, 22, 0.00155, 8, false), felt);
  const light = new THREE.RectAreaLight(0xffd09c, 9, 0.143, 0.131);
  light.position.set(shadeX, 0.303, 0);
  light.rotation.x = -Math.PI / 2;
  parent.add(light);
  return light;
}

function linenBook(parent) {
  const weave = (x, y, rand) => {
    const warp = 5.2 * Math.sin(x * 1.37 + 0.36 * Math.sin(y * 0.31));
    const weft = 4.6 * Math.cos(y * 1.32 + 0.38 * Math.sin(x * 0.39));
    const knots = Math.max(0, warp * weft) * 0.24;
    const n = warp + weft + knots + (rand() - 0.5) * 12;
    return [158 + n, 132 + n, 106 + n];
  };
  const textile = surface(768, 384, weave);
  // The weave is visible in the color map. Bump mapping the thin cover bevel
  // at grazing angles produces isolated highlights that bloom over the lamp.
  const cloth = material(0xefddca, 0.86, { map: textile });
  const cover = new RoundedBoxGeometry(0.224, 0.0028, 0.118, 3, 0.0011);
  mesh(parent, cover, cloth, 0, 0.0016);
  mesh(parent, cover, cloth, 0, 0.0331);
  const pages = surface(384, 256, (x, y, rand) => {
    const signature = y % 29 < 2 ? -11 : 0;
    const paper = 7 * Math.sin(y * 2.05 + 0.45 * Math.sin(x * 0.025)) + 3 * Math.sin(y * 0.65);
    const v = paper + signature + (rand() - 0.5) * 5;
    return [201 + v, 185 + v, 162 + v];
  });
  const paper = new RoundedBoxGeometry(0.2183, 0.0286, 0.1117, 2, 0.0012);
  const paperPos = paper.attributes.position,
    paperUV = paper.attributes.uv;
  for (let i = 0; i < paperPos.count; i++) {
    const x = paperPos.getX(i),
      y = paperPos.getY(i),
      z = paperPos.getZ(i);
    paperUV.setXY(i, (x + z) / 0.18 + 0.5, y / 0.0286 + 0.5);
  }
  mesh(parent, paper, material(0xf9f1e1, 0.89, { map: pages }), 0.0006, 0.0172);
  const endpaper = material(0x8b765b, 0.78);
  for (const h of [0.0032, 0.0312]) mesh(parent, new THREE.BoxGeometry(0.219, 0.0006, 0.1122), endpaper, 0, h);
  const title = (g, w, h, color) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.font = '49px Georgia,serif';
    g.fillText('I N T E R I O R   D E S I G N', w / 2, h * 0.52);
  };
  const spineMap = surface(1024, 144, weave, (g, w, h) => title(g, w, h, '#f3c684'));
  const foil = surface(
    1024,
    144,
    () => [0, 0, 0],
    (g, w, h) => title(g, w, h, 'white'),
  );
  foil.colorSpace = THREE.NoColorSpace;
  const spine = new THREE.PlaneGeometry(0.222, 0.0326, 66, 8);
  const v = spine.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const x = v.getX(i),
      y = v.getY(i);
    const hinge = Math.exp(-((Math.abs(x) - 0.105) ** 2) / 0.000006);
    v.setZ(i, 0.0023 * (1 - (y / 0.0163) ** 2) - 0.0012 * hinge);
  }
  spine.computeVertexNormals();
  mesh(
    parent,
    spine,
    material(0xffffff, 0.77, {
      map: spineMap,
      bumpMap: spineMap,
      bumpScale: 0.0001,
      metalness: 0.23,
      metalnessMap: foil,
    }),
    0,
    0.0171,
    0.0575,
  );
}

function oliveVase(parent) {
  const clayMap = colorMap('speckled-stoneware');
  clayMap.wrapS = THREE.RepeatWrapping;
  const clay = new THREE.MeshPhysicalMaterial({
    color: 0xe0cbb4,
    map: clayMap,
    roughness: 0.68,
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
    bumpMap: clayMap,
    bumpScale: 0.00021,
    side: THREE.DoubleSide,
  });
  const belly = new THREE.SplineCurve(
    [
      [0.029, 0.0038],
      [0.037, 0.0069],
      [0.047, 0.0175],
      [0.0534, 0.0334],
      [0.0544, 0.046],
      [0.0513, 0.0607],
      [0.0438, 0.0734],
      [0.032, 0.0824],
      [0.0241, 0.0862],
      [0.0225, 0.0893],
    ].map(([r, h]) => new THREE.Vector2(r, h)),
  )
    .getPoints(34)
    .map((p) => [p.x, p.y]);
  const body = turned(
    parent,
    [
      [0, 0.0015],
      [0.0248, 0.0015],
      [0.0257, 0.0002],
      [0.0285, 0.0002],
      [0.029, 0.0009],
      ...belly,
      [0.0225, 0.0914],
      [0.0232, 0.0927],
      [0.023, 0.0937],
      [0.0221, 0.0942],
      [0.0206, 0.094],
      [0.0199, 0.093],
      [0.0198, 0.0908],
      [0.0206, 0.086],
      [0.027, 0.0808],
    ],
    clay,
  );
  const pos = body.geometry.attributes.position,
    uv = body.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      a = Math.atan2(x, z);
    const throwingRings = .0028 * Math.sin(y * 1450 + .35 * Math.sin(a)) + .0022 * Math.sin(y * 730 + a * .8);
    const wobble = 1 + throwingRings + 0.006 * Math.sin(3 * a + y * 25) + 0.003 * Math.cos(5 * a - y * 14);
    pos.setXYZ(i, x * wobble, y, z * wobble);
    uv.setXY(i, uv.getX(i), 0.18 + y / 0.2);
  }
  body.geometry.computeVertexNormals();
  const interior = mesh(parent, new THREE.CircleGeometry(0.024, 40), material(0x4c4032, 0.94), 0, 0.081);
  interior.rotation.x = -Math.PI / 2;
  oliveBranches(parent, colorMap('olive-leaf'), seeded(807));
}

export function createWritingDesk(scene, pmrem) {
  RectAreaLightUniformsLib.init();
  const desk = new THREE.Group();
  desk.name = 'Window writing desk';
  desk.position.set(1.985, 0.75, 0);
  desk.rotation.y = -Math.PI / 2;
  scene.add(desk);
  const woodMap = new THREE.TextureLoader().load(new URL('../assets/desk/walnut.jpg', import.meta.url).href);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.center.set(0.5, 0.5);
  woodMap.rotation = Math.PI / 2;
  woodMap.repeat.set(0.83, 1.9);
  woodMap.anisotropy = 8;
  const reflections = windowReflections(pmrem);
  const walnut = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.72, 2.78, 2.34),
    roughness: 0.49,
    clearcoat: 0.3,
    clearcoatRoughness: 0.31,
    specularIntensity: 0.18,
    map: woodMap,
    bumpMap: woodMap,
    bumpScale: 0.0001,
    envMapIntensity: 0.21,
  });
  // Diffuse light bounced by the shade and plaster. Project it in tabletop
  // coordinates so it follows the lamp independently of the grain direction.
  const bouncedLight = surface(256, 128, (x, y) => {
    const dx = (x / 255 - 0.5) * 1.91;
    const dz = (y / 127) * 0.77 - 0.18;
    const falloff = Math.exp(-((dx / 0.164) ** 2 + (dz / 0.33) ** 2) / 2);
    return [248 * falloff, 214 * falloff, 167 * falloff];
  });
  bouncedLight.channel = 1;
  const top = new RoundedBoxGeometry(1.91, 0.041, 0.77, 3, 0.004);
  const vertices = top.getAttribute('position'),
    lightUV = [];
  for (let i = 0; i < vertices.count; i++) {
    const u = vertices.getX(i) / 1.91 + 0.5,
      v = 0.5 - vertices.getZ(i) / 0.77;
    lightUV.push(u, v);
    if (top.attributes.normal.getY(i) > 0.7) top.attributes.uv.setXY(i, u, 0.04 + 0.38 * v);
  }
  top.setAttribute('uv1', new THREE.Float32BufferAttribute(lightUV, 2));
  const tabletop = walnut.clone();
  tabletop.envMap = reflections;
  tabletop.envMapIntensity = 0.34;
  tabletop.lightMap = bouncedLight;
  tabletop.lightMapIntensity = 11;
  mesh(desk, top, tabletop, 0, -0.0205, 0.375);
  for (const x of [-0.9, 0.9])
    for (const z of [0.05, 0.7]) mesh(desk, new THREE.BoxGeometry(0.05, 0.71, 0.05), walnut, x, -0.395, z);

  const brushed = surface(256, 192, (x, y, rand) => {
    const grit = 201 + Math.sin(y * 2.3) * 3 + Math.sin(y * 0.63) * 3 + rand() * 7;
    return [grit, grit, grit];
  });
  brushed.colorSpace = THREE.NoColorSpace;
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xb68b53,
    metalness: 0.89,
    roughness: 0.54,
    roughnessMap: brushed,
    anisotropy: 0.12,
    envMap: reflections,
    envMapIntensity: 1.0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.36,
  });
  const group = (name, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.z = z;
    desk.add(g);
    return g;
  };
  const taskLamp = group('Brass reading lamp', 0.095),
    lampLight = lamp(taskLamp, brass);
  addDimmer(taskLamp, brass);
  fitDesk(desk, walnut, brass);
  // The broad bounce from the window-side wall lights the vase from the
  // left and gives the satin router shell a grazing highlight.
  const windowFill = new THREE.RectAreaLight(0xffdab5, 2.3, 0.56, 0.46);
  windowFill.position.set(-0.62, 0.38, 0.5);
  windowFill.lookAt(0.08, 0.075, 0.09);
  desk.add(windowFill);
  const book = group('Linen design book', 0.115);
  book.rotation.y = -0.045;
  linenBook(book);
  addBookmark(book);
  const vase = new THREE.Group();
  vase.name = 'Olive branches in stoneware';
  vase.position.set(-0.012, 0.0345, 0);
  book.add(vase);
  oliveVase(vase);
  const wifi = group('Ceramic white Wi-Fi router', 0.115);
  buildRouter(wifi, brass);

  // Indirect light from the concealed LED grazes the plaster most strongly at its top.
  const plaster = surface(1024, 256, (x, y, rand) => {
    const t = y / 255,
      strip = Math.exp(-t * 8),
      side = (x / 1023 - 0.28) * 3.7;
    const pool = Math.exp(-side * side * 3.6 - (t - 0.47) ** 2 * 4.1);
    const n = (rand() - 0.5) * 9 + 1.6 * Math.sin(x * 0.18 + y * 0.31);
    return [184 + 41 * strip + 26 * pool + n, 151 + 29 * strip + 7 * pool + n, 122 + 5 * strip - 10 * pool + n];
  });
  const spill = surface(16, 128, (x, y) => {
    const n = Math.exp(-y / 23);
    return [225 * n, 161 * n, 75 * n];
  });
  const wall = mesh(
    desk,
    new THREE.PlaneGeometry(1.91, 0.252),
    material(0xffffff, 0.94, {
      map: plaster,
      bumpMap: plaster,
      bumpScale: 0.00016,
      emissive: 0xffd8a8,
      emissiveIntensity: 0.7,
      emissiveMap: spill,
    }),
    0,
    0.126,
    -0.01,
  );
  wall.castShadow = false;
  const trim = material(0xddcdb8, 0.52);
  mesh(desk, new RoundedBoxGeometry(1.954, 0.006, 0.041, 2, 0.002), trim, 0, 0.297, -0.058);
  mesh(desk, new RoundedBoxGeometry(1.953, 0.006, 0.035, 2, 0.0019), trim, 0, 0.247, -0.011);
  mesh(desk, new THREE.BoxGeometry(1.96, 0.034, 0.055), trim, 0, 0.28, -0.068);
  mesh(desk, new RoundedBoxGeometry(1.96, 0.02, 0.087, 3, 0.003), trim, 0, 0.257, -0.009);
  const led = material(0xffe2ad, 0.45, { emissive: 0xffc27b, emissiveIntensity: 1.35 });
  mesh(desk, new THREE.BoxGeometry(1.91, 0.0019, 0.004), led, 0, 0.247, 0.018);

  // Match the soft shadow to each actual footprint, including the corners
  // of the router and book. Real light still supplies their cast shadows.
  for (const [p, w, d, radius, penumbra] of [
    [taskLamp, 0.08, 0.08, 0.04, 0.009],
    [book, 0.22, 0.112, 0.003, 0.008],
    [wifi, 0.198, 0.087, 0.017, 0.011],
    [vase, 0.081, 0.074, 0.036, 0.011],
  ]) {
    const sw = w + 6 * penumbra,
      sd = d + 6 * penumbra;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 112;
    const ctx = canvas.getContext('2d'),
      data = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const dx = Math.abs((x / (canvas.width - 1) - 0.5) * sw) - w / 2 + radius;
        const dz = Math.abs((y / (canvas.height - 1) - 0.5) * sd) - d / 2 + radius;
        const dist = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - radius;
        const alpha = 0.62 * Math.exp(-((Math.max(0, dist + penumbra * 0.3) / penumbra) ** 2));
        data.data[(y * canvas.width + x) * 4 + 3] = Math.round(alpha * 255);
      }
    ctx.putImageData(data, 0, 0);
    const contact = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), contact);
    shadow.position.set(p === vase ? 0.009 : 0.0014, 0.00025, -0.0018);
    shadow.rotation.x = -Math.PI / 2;
    p.add(shadow);
  }
  return {
    woodMap,
    updateView(camera, inRoom) {
      desk.visible = camera.position.distanceToSquared(desk.position) < 36 * 36;
      lampLight.visible = windowFill.visible = inRoom;
    },
    frame(aspect) {
      // Allow for the wider portrait camera lens and preserve the props' proportions.
      const compact = 1 - THREE.MathUtils.smoothstep(aspect, 0.48, 0.87);
      const spacing = 0.94 - 0.34 * THREE.MathUtils.smoothstep(aspect, 0.6, 1.2);
      const spread = THREE.MathUtils.clamp(aspect * spacing, 0.35, 1.24);
      const size = (0.4 + 0.6 * Math.min(1, spread)) * (1 - 0.17 * compact);
      for (const [prop, x] of [
        [taskLamp, -0.451],
        [book, -0.259 - 0.07 * compact],
        [wifi, 0.35 + 0.01 * compact],
      ]) {
        prop.position.x = x * spread;
        prop.scale.setScalar(size);
      }
      lampLight.width = 0.143 * size;
      lampLight.height = 0.131 * size;
      bouncedLight.offset.x = -(taskLamp.position.x + 0.151 * size) / 1.91;
    },
  };
}
