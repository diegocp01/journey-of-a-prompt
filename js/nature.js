/* Trees, plants, rocks and clouds.
   The fir trees are built here from real photographed fir twigs and bark (Poly Haven "fir_tree_01" textures, CC0):
   a trunk, then rings of drooping boughs, each bough a pair of crossed cards showing a twig photo.
   The full scanned tree model is hundreds of megabytes, so only its small textures are used. */
import * as THREE from 'three';

const PH = 'https://dl.polyhaven.org/file/ph-assets';
const FIR = `${PH}/Models/jpg/1k/fir_tree_01/fir_tree_01_`;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* where each twig sits in the twig photo sheet: [u0, u1, v at the stem, v at the tip] */
const TWIGS = [
  [.31, .63, .23, .60],
  [.64, .955, .18, .53],
  [.66, .94, .645, .95],
  [.20, .42, .70, .95]
];

/* small repeatable random numbers, so the forest looks the same on every visit */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const wind = {value: 0};

/* one fir tree, about 7.5 units tall, as two geometries: the needles and the trunk */
function firGeometry(seed) {
  const rand = rng(seed), pos = [], uv = [], nor = [], col = [], idx = [];
  const H = 7.2 + rand() * .8, R = 1.55 + rand() * .45, rings = 17;
  function card(base, along, across, twig, shade, outward) {
    const [u0, u1, vb, vt] = TWIGS[twig], n = outward.clone().normalize(), i0 = pos.length / 3;
    const a = base.clone().addScaledVector(across, -.5), b = base.clone().addScaledVector(across, .5);
    const c = b.clone().add(along), d = a.clone().add(along);
    [[a, u0, vb, shade * .62], [b, u1, vb, shade * .62], [c, u1, vt, shade], [d, u0, vt, shade]].forEach(([p, u, v, s]) => {
      pos.push(p.x, p.y, p.z); uv.push(u, v); nor.push(n.x, n.y, n.z);
      /* tips are a touch lighter and yellower than the needles near the trunk */
      col.push(s * .96, s * 1.04, s * .86);
    });
    /* both faces, with the same outward normal, so the underside of a bough is not black */
    idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1), y = .75 + (H - 1.5) * Math.pow(t, .92);
    const len = (R * Math.pow(1 - t, .8) + .26) * (.86 + rand() * .26);
    const count = t < .6 ? 7 : t < .85 ? 6 : 5, droop = .5 - .75 * t, spin = rand() * 6.28;
    for (let k = 0; k < count; k++) {
      const az = spin + k / count * 6.283 + (rand() - .5) * .45, L = len * (.8 + rand() * .35);
      const out = V(Math.cos(az), 0, Math.sin(az)), side = V(-out.z, 0, out.x);
      const dir = out.clone().multiplyScalar(Math.cos(droop)).add(V(0, -Math.sin(droop), 0));
      const lift = dir.clone().cross(side).normalize();
      const base = V(0, y + (rand() - .5) * .12, 0).addScaledVector(out, .04);
      const shade = (.7 + .3 * t) * (.86 + rand() * .22), normal = out.clone().add(V(0, .75, 0));
      const twig = Math.floor(rand() * 3);
      card(base, dir.clone().multiplyScalar(L), side.clone().multiplyScalar(L * .82), twig, shade, normal);
      card(base.clone().addScaledVector(lift, -L * .1), dir.clone().multiplyScalar(L * .94), lift.clone().multiplyScalar(L * .5), (twig + 1) % 3, shade * .9, normal);
    }
  }
  /* the tip of the tree */
  for (let k = 0; k < 3; k++) {
    const az = k * 2.094 + rand(), out = V(Math.cos(az), 0, Math.sin(az));
    card(V(0, H - 1.25, 0), V(0, 1.4, 0), out.clone().multiplyScalar(.75), 3, 1.05, out.clone().add(V(0, 1, 0)));
  }
  const needles = new THREE.BufferGeometry();
  needles.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  needles.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  needles.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  needles.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  needles.setIndex(idx);
  const trunk = new THREE.CylinderGeometry(.035, .21, H - .4, 8, 6);
  trunk.translate(0, (H - .4) / 2, 0);
  /* a dark, soft-edged body inside the boughs, so far trees do not look see-through */
  const core = new THREE.ConeGeometry(R * .5, H * .86, 9, 1, true);
  core.translate(0, .8 + H * .43, 0);
  return {needles, trunk, core};
}

/* Plant a forest. spots: [{x, z, s, rot}] */
export function createForest(scene, spots) {
  const loader = new THREE.TextureLoader(), group = new THREE.Group();
  group.name = 'Forest';
  scene.add(group);
  const tex = (name, srgb, cb) => loader.load(FIR + name, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cb(t); });

  const needleMat = new THREE.MeshStandardMaterial({color: 0x6f8a52, vertexColors: true, roughness: .82, metalness: 0, envMapIntensity: .3,
    alphaTest: .3, side: THREE.FrontSide});
  needleMat.alphaToCoverage = true;
  /* the boughs sway a little in the wind */
  needleMat.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * .37 + instanceMatrix[3][2] * .23;
        #else
          float ph = 0.;
        #endif
        float reach = length(position.xz);
        transformed.x += sin(uWind * 1.3 + ph + position.y * .5) * .03 * reach * (position.y / 7.);
        transformed.y += sin(uWind * 2.1 + ph * 1.7 + reach * 2.) * .022 * reach;`);
  };
  const barkMat = new THREE.MeshStandardMaterial({color: 0x5a4636, roughness: .95, metalness: 0, envMapIntensity: .15});
  const coreMat = new THREE.MeshStandardMaterial({color: 0x1d3020, roughness: 1, metalness: 0, envMapIntensity: .05});
  tex('twig_diff_1k.jpg', true, t => { needleMat.map = t; needleMat.color.set(0xd6e6c4); needleMat.needsUpdate = true; });
  tex('twig_alpha_1k.jpg', false, t => { needleMat.alphaMap = t; needleMat.needsUpdate = true; });
  tex('bark_diff_1k.jpg', true, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 5); barkMat.map = t; barkMat.color.set(0xb9ab9c); barkMat.needsUpdate = true; });
  tex('bark_nor_gl_1k.jpg', false, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 5); barkMat.normalMap = t; barkMat.needsUpdate = true; });

  const KINDS = 4, dummy = new THREE.Object3D();
  for (let k = 0; k < KINDS; k++) {
    const mine = spots.filter((_, i) => i % KINDS === k);
    if (!mine.length) continue;
    const g = firGeometry(1234 + k * 977);
    const parts = [[g.needles, needleMat, true], [g.trunk, barkMat, true], [g.core, coreMat, false]].map(([geo, mat, cast]) => {
      const m = new THREE.InstancedMesh(geo, mat, mine.length);
      m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
      group.add(m);
      return m;
    });
    mine.forEach((sp, i) => {
      dummy.position.set(sp.x, 0, sp.z); dummy.rotation.set(0, sp.rot, 0); dummy.scale.setScalar(sp.s * .92);
      dummy.updateMatrix();
      parts.forEach(m => m.setMatrixAt(i, dummy.matrix));
    });
    parts.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }
  return group;
}

/* Scatter plants or rocks over the ground. places: [{x, y, z, s, rot}]
   A Poly Haven plant model holds several different plants laid out side by side.
   Each place gets ONE of them, moved so it stands on its own spot. Very heavy ones can be left out with maxTris. */
export function scatter(scene, modelScene, places, {cast = true, maxTris = Infinity} = {}) {
  modelScene.updateMatrixWorld(true);
  const kinds = [];
  modelScene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (tris > maxTris) return;
    const box = new THREE.Box3().setFromObject(o);
    kinds.push({o, home: new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2), spots: []});
  });
  if (!kinds.length) return [];
  places.forEach((p, i) => kinds[i % kinds.length].spots.push(p));
  const dummy = new THREE.Object3D(), m4 = new THREE.Matrix4(), out = [];
  kinds.forEach(({o, home, spots}) => {
    if (!spots.length) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, spots.length);
    inst.castShadow = cast; inst.receiveShadow = true; inst.frustumCulled = false;
    spots.forEach((p, i) => {
      dummy.position.set(p.x, p.y || 0, p.z); dummy.rotation.set(0, p.rot || 0, 0); dummy.scale.setScalar(p.s || 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, m4.copy(dummy.matrix).multiply(home).multiply(o.matrixWorld));
    });
    scene.add(inst);
    out.push(inst);
  });
  return out;
}

/* soft white clouds, painted once and hung on the sky */
export function createClouds(skyGroup, count = 16) {
  const rand = rng(77), canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const g = canvas.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = 70 + rand() * 372, y = 150 - Math.pow(rand(), 1.6) * 80 + Math.abs(x - 256) * .12, r = 26 + rand() * 46;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(.55, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  /* a flatter, slightly grey underside */
  const shade = g.createLinearGradient(0, 120, 0, 215);
  shade.addColorStop(0, 'rgba(120,140,170,0)'); shade.addColorStop(1, 'rgba(120,140,170,.3)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = shade; g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  group.name = 'Clouds';
  for (let i = 0; i < count; i++) {
    const az = rand() * 6.283, el = .1 + Math.pow(rand(), 1.5) * .55, d = 1150, w = 300 + rand() * 360;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, opacity: .55 + rand() * .35, depthWrite: false, fog: false}));
    sp.position.set(Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(az) * Math.cos(el) * d);
    sp.scale.set(w, w * (.36 + rand() * .14), 1);
    sp.material.rotation = (rand() - .5) * .12;
    group.add(sp);
  }
  skyGroup.add(group);
  return group;
}

/* keep the wind moving; call once per frame with the time in seconds */
export function tickNature(t) { wind.value = t; }
