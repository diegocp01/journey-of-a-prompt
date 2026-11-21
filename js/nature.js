/* Trees, plants, rocks and clouds.
   The fir trees are built here from real photographed fir twigs and bark (Poly Haven "fir_tree_01" textures, CC0):
   a trunk, then rings of drooping boughs, each bough a pair of crossed cards showing a twig photo.
   The full scanned tree model is hundreds of megabytes, so only its small textures are used. */
import * as THREE from 'three';
import {registerScan} from './scan-lod.js';

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
  return {needles, trunk};
}

/* Plant a forest. spots: [{x, z, s, rot}] */
export function createForest(scene, spots) {
  const loader = new THREE.TextureLoader(), group = new THREE.Group();
  group.name = 'Forest';
  scene.add(group);
  const texture = (name, srgb) => {
    const map = loader.load(new URL('../assets/land/' + name, import.meta.url).href);
    if (srgb) map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return map;
  };
  // The photographed needles and their cutout share a single local atlas, so
  // the forest never briefly shows opaque rectangles while a second map loads.
  const needleMat = new THREE.MeshStandardMaterial({map: texture('fir-bough.webp', true),
    color: 0xd6e6c4, vertexColors: true, roughness: .82, envMapIntensity: .3, alphaTest: .3});
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
  barkMat.color.set(0xb9ab9c);
  barkMat.map = texture('fir-bark.webp', true);
  barkMat.normalMap = texture('fir-bark-normal.webp', false);
  for (const map of [barkMat.map, barkMat.normalMap]) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 5);
  }

  const dummy=new THREE.Object3D();
  const silhouette = new THREE.MeshBasicMaterial({map:texture('distant-firs.webp', true),alphaTest:.24});
  silhouette.alphaToCoverage=true;
  // The atlas was rendered from these same four firs. Face the distant image
  // toward the viewer around its trunk; the height and footprint stay fixed.
  silhouette.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 localEye=(inverse(modelMatrix*instanceMatrix)*vec4(cameraPosition,1.)).xyz;
        vec2 horizontal=normalize(localEye.xz+vec2(1e-6));
        transformed.xz=position.x*vec2(horizontal.y,-horizontal.x);
      #endif`);
  };
  const kinds=Array.from({length:4},(_,i)=>{
    const tree=firGeometry(1234+i*977);
    const airy=tree.needles.clone(),faces=[],source=tree.needles.index.array;
    // Keep the original placement of the large boughs in the middle tier;
    // only the narrow crossed cards and every third branch drop away.
    for(let k=0;k<source.length;k+=12){
      const card=k/12;
      if(k<source.length-36&&(card%2===1||Math.floor(card/2)%3===1))continue;
      for(let j=0;j<12;j++)faces.push(source[k+j]);
    }
    airy.setIndex(faces);
    const distant=[0,1].map(view=>{
      const geo=new THREE.PlaneGeometry(5.3,9.5);geo.translate(0,4.30,0);
      const uv=geo.attributes.uv;
      for(let n=0;n<uv.count;n++)uv.setXY(n,(i+uv.getX(n))/4,(1-view+uv.getY(n))/2);
      return geo;
    });
    return {tree,airy,distant};
  });
  const stands=new Map(),cellSize=22;
  spots.forEach(sp=>{
    const gx=Math.floor(sp.x/cellSize),gz=Math.floor(sp.z/cellSize),key=gx+','+gz;
    if(!stands.has(key))stands.set(key,{gx,gz,trees:[]});
    stands.get(key).trees.push(sp);
  });
  for(const {gx,gz,trees} of stands.values()){
    const kind=kinds[Math.abs(gx*17+gz*11)%4],lod=new THREE.LOD();
    const cx=(gx+.5)*cellSize,cz=(gz+.5)*cellSize;
    lod.position.set(cx,3.8,cz);group.add(lod);
    function tier(distance,parts){
      const crown=new THREE.Group();lod.addLevel(crown,distance,.08);
      for(const [geo,mat,cast] of parts){
        const inst=new THREE.InstancedMesh(geo,mat,trees.length);
        trees.forEach((sp,i)=>{
          dummy.position.set(sp.x-cx,-3.8,sp.z-cz);
          dummy.rotation.set(0,sp.rot,0);dummy.scale.setScalar(sp.s*.92);dummy.updateMatrix();
          inst.setMatrixAt(i,dummy.matrix);
        });
        inst.castShadow=cast;inst.receiveShadow=mat!==silhouette;
        inst.computeBoundingSphere();inst.boundingSphere.radius+=.15;
        crown.add(inst);
      }
    }
    tier(0,[[kind.tree.needles,needleMat,true],[kind.tree.trunk,barkMat,true]]);
    // Fill the sparse mid-distance branches with the matching photographed
    // fir, so gaps reveal the layers of needles inside the crown.
    tier(22,[[kind.airy,needleMat,true],[kind.distant[Math.abs(gx+gz)%2],silhouette,false]]);
    tier(45,[[kind.distant[Math.abs(gx+gz)%2],silhouette,false]]);
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
    kinds.push({o,diameter:box.getSize(new THREE.Vector3()).length(), home: new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2), spots: []});
  });
  if (!kinds.length) return [];
  places.forEach((p, i) => kinds[i % kinds.length].spots.push(p));
  const dummy = new THREE.Object3D(), m4 = new THREE.Matrix4(), out = [];
  kinds.forEach(({o,home,spots,diameter}) => {
    if (!spots.length) return;
    // One bounding sphere spanning two coasts would intersect nearly every
    // camera and shadow frustum. Keep each species in small, local stands.
    const stands = new Map();
    for(const spot of spots){
      const key=Math.floor(spot.x/16)+','+Math.floor(spot.z/16);
      if(!stands.has(key)) stands.set(key,[]);
      stands.get(key).push(spot);
    }
    const batches=[];
    for(const stand of stands.values()){
      const inst = new THREE.InstancedMesh(o.geometry, o.material, stand.length);
      inst.name=o.name;inst.castShadow=cast;inst.receiveShadow=true;
      stand.forEach((p,i)=>{
        dummy.position.set(p.x,p.y||0,p.z);dummy.rotation.set(0,p.rot||0,0);dummy.scale.setScalar(p.s||1);
        dummy.updateMatrix();
        inst.setMatrixAt(i,m4.copy(dummy.matrix).multiply(home).multiply(o.matrixWorld));
      });
      inst.computeBoundingSphere();scene.add(inst);out.push(inst);
      batches.push({mesh:inst,diameter:diameter*Math.max(...stand.map(p=>p.s||1))});
    }
    registerScan(o.name,o.geometry,batches);
  });
  return out;
}

// Broad land color belongs to the terrain; the local photograph supplies the
// individual stems, needles and exposed earth. Varying these at separate
// scales keeps the wide aerial shot from exposing a repeated square tile.
export function landGround(scene, patches) {
  const load = (name, color) => {
    const map=new THREE.TextureLoader().load(new URL('../assets/land/'+name+'.webp',import.meta.url).href);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
    if(color)map.colorSpace=THREE.SRGBColorSpace;
    return map;
  };
  const mat=new THREE.MeshStandardMaterial({map:load('woodland-floor',true),
    normalMap:load('woodland-floor-normal',false),normalScale:new THREE.Vector2(.42,.42),
    roughnessMap:load('woodland-floor-roughness',false),envMapIntensity:.1,vertexColors:true});
  const base=new THREE.Color();
  for(const [cx,width] of patches){
    const geo=new THREE.PlaneGeometry(width,700,84,110);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,colors=[];
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i)+cx,z=pos.getZ(i);
      const wet=.5+.22*Math.sin(x*.105+Math.sin(z*.076)*1.9)+.22*Math.sin(z*.112+x*.072)+.06*Math.cos(x*.26-z*.19);
      base.setRGB(.76+wet*.21,.81+wet*.26,.65+wet*.19);
      colors.push(base.r,base.g,base.b);
      uv.setXY(i,x/5.4+.21*Math.cos(z*.035),z/5.4+.31*Math.sin(x*.062));
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const field=new THREE.Mesh(geo,mat);field.position.set(cx,-.02,0);field.receiveShadow=true;scene.add(field);
  }
}

export function distantRidges(scene, ranges) {
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:.04});
  ranges.forEach(([x,z,span,height],i)=>{
    const count=72,rings=16,pos=[],colors=[],indices=[],shade=new THREE.Color();
    for(let j=0;j<=rings;j++){
      const r=j/rings;
      for(let k=0;k<=count;k++){
        const a=k/count*Math.PI*2,rad=r*(1+.065*Math.sin(a*5+i)+.038*Math.cos(3*a+i*.7));
        const px=Math.cos(a)*rad,pz=Math.sin(a)*rad;
        const fold=.85+.17*Math.sin(px*6+i)*Math.cos(pz*4.5+i*.4)+.085*Math.cos(8*pz+3*px);
        const h=(1-r*r)**1.6*fold;
        pos.push(px*span,h*height-3,pz*span*.72);
        const d=.5+.28*Math.sin(a*6+i)*r+.19*Math.cos(px*9-pz*5);
        shade.setRGB(.093+.055*d+.017*h,.171+.063*d+.017*h,.119+.036*d+.017*h);
        colors.push(shade.r,shade.g,shade.b);
        if(j<rings&&k<count){const n=j*(count+1)+k;
          indices.push(n,n+1,n+count+1,n+1,n+count+2,n+count+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const ridge=new THREE.Mesh(g,mat);ridge.position.set(x,0,z);ridge.name='Rolling wooded ridge';scene.add(ridge);
  });
}

// One continuous photographed hemisphere preserves the sun-facing cloud rims,
// broad shaded bases and fine, wind-torn edges from every camera bearing.
export function createClouds(skyGroup) {
  const texture=new THREE.TextureLoader().load(new URL('../assets/land/afternoon-sky.webp',import.meta.url).href);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;
  const dome=new THREE.Mesh(
    new THREE.SphereGeometry(1240,64,24,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,fog:false,depthWrite:false})
  );
  dome.name='Afternoon cloudscape';
  dome.rotation.y=-.41;
  // Draw above the fallback gradient, behind every physical object.
  dome.renderOrder=-100;
  skyGroup.add(dome);
  return dome;
}

/* keep the wind moving; call once per frame with the time in seconds */
export function tickNature(t) { wind.value = t; }
