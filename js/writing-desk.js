/* The writing desk faces the window. In its local coordinates x runs along the
   sill, y is height above the tabletop, and positive z points into the room. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const material = (color, roughness, other = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...other });

function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function turned(parent, points, mat, x = 0, y = 0, z = 0) {
  return mesh(
    parent,
    new THREE.LatheGeometry(
      points.map(([r, h]) => new THREE.Vector2(r, h)),
      72,
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

function lamp(parent, brass) {
  const marble = surface(512, 192, (x, y, rand) => {
    const wave =
      x * 0.038 +
      y * 0.019 +
      0.85 * Math.sin(y * 0.064) +
      0.58 * Math.sin(x * 0.049 + y * 0.073) +
      0.17 * Math.sin(x * 0.19 - y * 0.13);
    const vein = Math.exp(-Math.abs(Math.sin(wave)) * 19);
    const cloudy = 5 * Math.sin(wave * 1.7) + 4 * Math.sin(0.027 * x + 0.052 * y);
    const shade = cloudy + (rand() - 0.5) * 12 - vein * (24 + 27 * Math.cos(y * 0.038) ** 2);
    return [224 + shade, 211 + shade, 191 + shade];
  });
  turned(
    parent,
    [
      [0, 0],
      [0.038, 0],
      [0.041, 0.002],
      [0.041, 0.031],
      [0.039, 0.034],
      [0, 0.034],
    ],
    material(0xffffff, 0.34, { map: marble }),
  );
  const pole = new THREE.CurvePath();
  pole.add(new THREE.LineCurve3(V(0, 0.033, 0), V(0, 0.269, 0)));
  pole.add(new THREE.QuadraticBezierCurve3(V(0, 0.269, 0), V(0, 0.304, 0), V(0.032, 0.304, 0)));
  pole.add(new THREE.LineCurve3(V(0.032, 0.304, 0), V(0.111, 0.304, 0)));
  mesh(parent, new THREE.TubeGeometry(pole, 48, 0.0037, 12, false), brass);
  const shadeX = 0.112;
  turned(
    parent,
    [
      [0.003, 0.033],
      [0.007, 0.033],
      [0.007, 0.035],
      [0.004, 0.036],
    ],
    brass,
  );
  turned(
    parent,
    [
      [0, 0.285],
      [0.008, 0.285],
      [0.008, 0.305],
      [0.006, 0.309],
      [0, 0.309],
    ],
    brass,
    shadeX,
  );
  turned(
    parent,
    [
      [0.086, 0.256],
      [0.0865, 0.258],
      [0.084, 0.265],
      [0.077, 0.273],
      [0.067, 0.28],
      [0.052, 0.287],
      [0.034, 0.292],
      [0.015, 0.294],
      [0, 0.294],
    ],
    brass,
    shadeX,
  );
  const diffuser = mesh(
    parent,
    new THREE.CircleGeometry(0.085, 72),
    new THREE.MeshStandardMaterial({
      color: 0xffe7bd,
      emissive: 0xffbd6c,
      emissiveIntensity: 2.35,
      side: THREE.DoubleSide,
    }),
    shadeX,
    0.2562,
  );
  diffuser.rotation.x = Math.PI / 2;
  diffuser.castShadow = false;
  // The frosted underside is a broad light source. Its reflection spreads across the lacquer.
  const light = new THREE.RectAreaLight(0xffc68c, 11, 0.13, 0.12);
  light.position.set(shadeX, 0.255, 0);
  light.rotation.x = -Math.PI / 2;
  parent.add(light);
  return light;
}

function linenBook(parent) {
  const coverMap = surface(512, 128, (x, y, rand) => {
    const weave = (x % 3 === 0 ? 5 : 0) - (y % 3 === 0 ? 7 : 0) + (rand() - 0.5) * 12;
    return [163 + weave, 135 + weave, 102 + weave];
  });
  const cloth = material(0xffffff, 0.94, { map: coverMap, bumpMap: coverMap, bumpScale: 0.00035 });
  const cover = new THREE.BoxGeometry(0.222, 0.0026, 0.116);
  mesh(parent, cover, cloth, 0, 0.0015);
  mesh(parent, cover, cloth, 0, 0.033);
  const pages = surface(96, 192, (x, y, rand) => {
    const k = 13 * Math.sin(y * 2.25) + 5 * Math.sin(y * 0.33) + rand() * 4;
    return [209 + k, 193 + k, 163 + k];
  });
  mesh(parent, new THREE.BoxGeometry(0.217, 0.0295, 0.111), material(0xffffff, 0.91, { map: pages }), 0, 0.017);
  const spine = surface(
    1024,
    144,
    (x, y, rand) => {
      const fold = x < 9 || x > 1013 ? -16 : 0;
      const n = fold + (x % 3 === 0 ? 5 : 0) - (y % 3 === 0 ? 7 : 0) + rand() * 10;
      return [151 + n, 123 + n, 92 + n];
    },
    (g, w, h) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#e6bc84';
      g.font = '45px Georgia,serif';
      g.fillText('I N T E R I O R   D E S I G N', w / 2, h * 0.5);
      g.fillStyle = 'rgba(65,43,31,.42)';
      g.fillRect(43, 8, 3, h - 16);
      g.fillRect(w - 46, 8, 3, h - 16);
    },
  );
  const spineBody = mesh(parent, new THREE.BoxGeometry(0.222, 0.032, 0.004), cloth, 0, 0.017, 0.056);
  mesh(spineBody, new THREE.PlaneGeometry(0.221, 0.0317), material(0xffffff, 0.77, { map: spine }), 0, 0, 0.0021);
}

function oliveVase(parent) {
  const clay = surface(384, 192, (x, y, rand) => {
    const fleck = rand() < 0.019 ? 21 + rand() * 33 : 0;
    const n = (rand() - 0.5) * 14 + 2 * Math.sin(y * 0.8) - fleck;
    return [218 + n, 202 + n, 177 + n];
  });
  const pot = material(0xffffff, 0.7, { map: clay, bumpMap: clay, bumpScale: 0.00065, side: THREE.DoubleSide });
  turned(
    parent,
    [
      [0, 0],
      [0.03, 0],
      [0.036, 0.002],
      [0.044, 0.008],
      [0.051, 0.02],
      [0.054, 0.034],
      [0.053, 0.048],
      [0.048, 0.061],
      [0.04, 0.073],
      [0.029, 0.082],
      [0.023, 0.085],
      [0.022, 0.091],
      [0.023, 0.093],
      [0.019, 0.093],
      [0.018, 0.085],
    ],
    pot,
  );
  mesh(parent, new THREE.CircleGeometry(0.019, 40), material(0x453d29, 0.95), 0, 0.089).rotation.x = -Math.PI / 2;
  const rand = seeded(807),
    bark = material(0x61543c, 0.88);
  const leafGeometry = new THREE.BufferGeometry(),
    pos = [],
    uv = [],
    triangles = [];
  // A folded blade with a raised midrib and a gently drooping tip.
  for (let j = 0; j <= 10; j++) {
    const t = j / 10,
      width = 0.19 * Math.sin(Math.PI * t) ** 0.8,
      bend = 0.11 * Math.sin(t * Math.PI) - 0.09 * t * t;
    pos.push(-width, t, bend, 0, t, bend + width * 0.32, width, t, bend);
    uv.push(0, t, 0.5, t, 1, t);
    if (j < 10) {
      const i = j * 3;
      triangles.push(i, i + 1, i + 3, i + 1, i + 4, i + 3, i + 1, i + 2, i + 4, i + 2, i + 5, i + 4);
    }
  }
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  leafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  leafGeometry.setIndex(triangles);
  leafGeometry.computeVertexNormals();
  const leafMap = surface(96, 192, (x, y, random) => {
    const t = 1 - y / 191,
      u = x / 95 - 0.5;
    const vein =
      Math.exp(-Math.abs(u) * 80) * 29 + Math.pow(Math.max(0, Math.cos((t + Math.abs(u) * 0.32) * 80)), 14) * 5;
    const n = vein + random() * 6;
    return [165 + n, 177 + n, 130 + n];
  });
  const leaves = [],
    colors = [];
  const addLeaf = (at, direction, length) => {
    const d = new THREE.Object3D();
    d.position.copy(at);
    d.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
    d.rotateY((rand() - 0.5) * 1.65);
    d.scale.setScalar(length);
    d.updateMatrix();
    leaves.push(d.matrix.clone());
    colors.push(new THREE.Color().setHSL(0.19 + rand() * 0.035, 0.29 + rand() * 0.1, 0.14 + rand() * 0.12));
  };
  const twigs = [];
  const stem = (a, b, c, r) =>
    twigs.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, b, c), 8, r, 5, false));
  for (const [x, y, z] of [
    [-0.095, 0.159, 0.012],
    [-0.078, 0.172, -0.025],
    [-0.056, 0.19, 0.025],
    [-0.029, 0.189, -0.018],
    [0.019, 0.211, -0.011],
    [0.049, 0.226, -0.021],
    [0.074, 0.166, 0.028],
    [0.106, 0.157, -0.006],
    [0.061, 0.172, -0.032],
  ]) {
    const a = V((rand() - 0.5) * 0.022, 0.088, (rand() - 0.5) * 0.016),
      end = V(x, y - 0.014, z);
    const mid = V(x * 0.36, y - 0.045, z * 0.42);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, end);
    stem(a, mid, end, 0.00115);
    for (let j = 0; j < 5; j++) {
      const t = 0.17 + j * 0.16,
        at = curve.getPoint(t),
        side = j % 2 ? 1 : -1;
      const dest = at
        .clone()
        .add(V(side * (0.01 + rand() * 0.014), 0.012 + rand() * 0.012, (rand() - 0.5) * 0.032));
      stem(
        at,
        at
          .clone()
          .lerp(dest, 0.56)
          .add(V(0, 0.003, 0)),
        dest,
        0.00055,
      );
      addLeaf(dest, V(side * (0.5 + rand()), 0.4 + rand() * 0.8, (rand() - 0.5) * 1.5), 0.026 + rand() * 0.012);
      const other = at.clone().lerp(dest, 0.65);
      addLeaf(other, V(-side * 0.45, 0.65 + rand(), (rand() - 0.5) * 1.4), 0.016 + rand() * 0.011);
    }
    addLeaf(end, curve.getTangent(1), 0.028);
  }
  mesh(parent, mergeGeometries(twigs), bark);
  twigs.forEach((g) => g.dispose());
  const foliage = new THREE.InstancedMesh(
    leafGeometry,
    material(0xffffff, 0.67, { map: leafMap, side: THREE.DoubleSide }),
    leaves.length,
  );
  leaves.forEach((m, i) => {
    foliage.setMatrixAt(i, m);
    foliage.setColorAt(i, colors[i]);
  });
  foliage.castShadow = foliage.receiveShadow = true;
  parent.add(foliage);
}

function router(parent, brass) {
  const shell = material(0xe9dfcf, 0.39),
    seam = material(0x66513c, 0.7);
  const housing = (width, height, depth, r, y, mat) =>
    mesh(parent, new RoundedBoxGeometry(width, height, depth, 4, r), mat, 0, y);
  housing(0.204, 0.01, 0.092, 0.004, 0.006, brass);
  housing(0.207, 0.004, 0.094, 0.002, 0.011, seam);
  housing(0.212, 0.035, 0.099, 0.009, 0.029, shell);
  for (const x of [-0.082, 0.082]) {
    turned(
      parent,
      [
        [0.0042, 0.042],
        [0.005, 0.047],
        [0.0045, 0.126],
        [0.0039, 0.143],
        [0.003, 0.144],
        [0, 0.144],
      ],
      shell,
      x,
      0,
      -0.035,
    );
    turned(
      parent,
      [
        [0.0063, 0.045],
        [0.0063, 0.049],
        [0.005, 0.05],
      ],
      shell,
      x,
      0,
      -0.035,
    );
  }
  const light = material(0xfff3c9, 0.4, { emissive: 0xffbf70, emissiveIntensity: 2.8 });
  mesh(parent, new RoundedBoxGeometry(0.014, 0.0019, 0.00075, 3, 0.00035), light, 0, 0.027, 0.0497);
}

export function createWritingDesk(scene, studio) {
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
  const walnut = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.53, 3.2, 3.1),
    roughness: 0.55,
    specularIntensity: 0.18,
    map: woodMap,
    bumpMap: woodMap,
    bumpScale: 0.00032,
    envMapIntensity: 0.21,
  });
  // Diffuse light bounced by the shade and plaster. Project it in tabletop
  // coordinates so it follows the lamp independently of the grain direction.
  const bouncedLight = surface(256, 128, (x, y) => {
    const dx = (x / 255 - 0.5) * 1.91;
    const dz = (y / 127) * 0.77 - 0.18;
    const falloff = Math.exp(-((dx / 0.2) ** 2 + (dz / 0.31) ** 2) / 2);
    return [242 * falloff, 202 * falloff, 148 * falloff];
  });
  bouncedLight.channel = 1;
  const top = new RoundedBoxGeometry(1.91, 0.041, 0.77, 3, 0.004);
  const vertices = top.getAttribute('position'),
    lightUV = [];
  for (let i = 0; i < vertices.count; i++) {
    lightUV.push(vertices.getX(i) / 1.91 + 0.5, 0.5 - vertices.getZ(i) / 0.77);
  }
  top.setAttribute('uv1', new THREE.Float32BufferAttribute(lightUV, 2));
  const tabletop = walnut.clone();
  tabletop.lightMap = bouncedLight;
  tabletop.lightMapIntensity = 6;
  mesh(desk, top, tabletop, 0, -0.0205, 0.375);
  for (const x of [-0.9, 0.9])
    for (const z of [0.05, 0.7]) mesh(desk, new THREE.BoxGeometry(0.05, 0.71, 0.05), walnut, x, -0.395, z);

  const brass = material(0xb68347, 0.35, { metalness: 0.89, envMap: studio, envMapIntensity: 1.12 });
  const group = (name, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.z = z;
    desk.add(g);
    return g;
  };
  const taskLamp = group('Brass reading lamp', 0.095),
    lampLight = lamp(taskLamp, brass);
  const book = group('Linen design book', 0.087);
  book.rotation.y = -0.045;
  linenBook(book);
  const vase = new THREE.Group();
  vase.name = 'Olive branches in stoneware';
  vase.position.set(-0.012, 0.0345, 0);
  book.add(vase);
  oliveVase(vase);
  const wifi = group('Ceramic white Wi-Fi router', 0.084);
  router(wifi, brass);

  // Indirect light from the concealed LED grazes the plaster most strongly at its top.
  const plaster = surface(1024, 256, (x, y, rand) => {
    const t = y / 255,
      strip = Math.exp(-t * 8),
      side = (x / 1023 - 0.28) * 3.7;
    const pool = Math.exp(-side * side * 3.6 - (t - 0.47) ** 2 * 4.1);
    const n = (rand() - 0.5) * 9 + 1.6 * Math.sin(x * 0.18 + y * 0.31);
    return [184 + 40 * strip + 20 * pool + n, 157 + 24 * strip + 6 * pool + n, 128 - 3 * strip - 8 * pool + n];
  });
  const spill = surface(16, 128, (x, y) => {
    const n = Math.exp(-y / 17);
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
      emissiveIntensity: 0.61,
      emissiveMap: spill,
    }),
    0,
    0.126,
    -0.01,
  );
  wall.castShadow = false;
  const trim = material(0xe4d7c6, 0.48);
  mesh(desk, new THREE.BoxGeometry(1.96, 0.034, 0.055), trim, 0, 0.28, -0.068);
  mesh(desk, new RoundedBoxGeometry(1.96, 0.02, 0.087, 3, 0.003), trim, 0, 0.257, -0.009);
  const led = material(0xffe2ad, 0.45, { emissive: 0xffc27b, emissiveIntensity: 1.35 });
  mesh(desk, new THREE.BoxGeometry(1.91, 0.0019, 0.004), led, 0, 0.247, 0.018);

  // Soft contact at the feet catches small-scale occlusion below the shadow-map resolution.
  const shadeCanvas = document.createElement('canvas');
  shadeCanvas.width = shadeCanvas.height = 128;
  const ctx = shadeCanvas.getContext('2d'),
    fade = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  fade.addColorStop(0, 'rgba(48,29,16,.66)');
  fade.addColorStop(0.58, 'rgba(48,29,16,.33)');
  fade.addColorStop(1, 'rgba(48,29,16,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 128);
  const contact = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadeCanvas),
    transparent: true,
    depthWrite: false,
  });
  for (const [p, w, d] of [
    [taskLamp, 0.126, 0.096],
    [book, 0.277, 0.163],
    [wifi, 0.265, 0.139],
    [vase, 0.091, 0.078],
  ]) {
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(w, d), contact);
    shade.position.set(0.006, 0.0006, -0.004);
    shade.rotation.x = -Math.PI / 2;
    p.add(shade);
  }
  return {
    lampLight,
    frame(aspect) {
      // Allow for the wider portrait camera lens and preserve the props' proportions.
      const spread = THREE.MathUtils.clamp(aspect * (aspect < 1 ? 0.94 : 0.6), 0.35, 1);
      for (const [prop, x] of [
        [taskLamp, -0.464],
        [book, -0.301],
        [wifi, 0.308],
      ]) {
        prop.position.x = x * spread;
        prop.scale.setScalar(0.4 + 0.6 * spread);
      }
      bouncedLight.offset.x = -(taskLamp.position.x + 0.112 * taskLamp.scale.x) / 1.91;
    },
  };
}
