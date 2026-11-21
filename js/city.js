/* The towns at each end of the trip: office towers, apartment blocks and brick buildings,
   each with floors of windows, a roof, and rooftop machinery. */
import * as THREE from 'three';
import { batch } from './static-details.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* one facade tile is 4 windows wide and 4 floors tall */
const BAY = 3.1, FLOOR = 3.3;

function facade(style, seed) {
  const rand = rng(seed), S = 256, C = 64;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const col = mk(), lit = mk(), g = col.getContext('2d'), e = lit.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  if (style === 'glass') {
    g.fillStyle = '#31475d'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const gr = g.createLinearGradient(0, y * C, 0, y * C + C), k = rand();
      gr.addColorStop(0, k > .7 ? '#8fb6d6' : '#5d86ab'); gr.addColorStop(1, k > .7 ? '#5f8db3' : '#2f4d69');
      g.fillStyle = gr; g.fillRect(x * C + 3, y * C + 3, C - 6, C - 12);
      // Narrow blinds and the dark soffit sit behind the reflected sky.
      g.fillStyle = 'rgba(20,38,57,.30)';g.fillRect(x*C+3,y*C+3,C-6,5);
      if (k > .56) {
        const drop=5+Math.floor(rand()*24);
        g.fillStyle='rgba(180,192,189,.43)';g.fillRect(x*C+6,y*C+6,C-12,drop);
        g.fillStyle='rgba(56,73,80,.43)';
        for(let j=5;j<drop;j+=5)g.fillRect(x*C+6,y*C+6+j,C-12,1);
      }
      g.fillStyle='rgba(209,225,235,.18)';g.fillRect(x*C+4,y*C+4,2,C-16);
      g.fillStyle = '#1f2f40'; g.fillRect(x * C + 3, y * C + C - 9, C - 6, 7);   /* floor slab behind the glass */
      if (rand() < .1) { e.fillStyle = '#ffe2ad'; e.fillRect(x * C + 5, y * C + 5, C - 10, C - 16); }
    }
    g.fillStyle = '#c9d3dd';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * C - 2, 0, 4, S); g.fillRect(0, k * C - 2, S, 3); }
  } else {
    const brick = style === 'brick';
    g.fillStyle = brick ? '#96563f' : '#bdb6a9'; g.fillRect(0, 0, S, S);
    if (brick) {
      g.strokeStyle = 'rgba(60,30,22,.45)'; g.lineWidth = 1;
      for (let y = 0; y < S; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); for (let x = (y / 8 % 2) * 8; x < S; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
    } else {
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() < .5 ? '255,255,255' : '60,55,48'},.05)`; g.fillRect(rand() * S, rand() * S, 3, 3); }
      g.fillStyle = 'rgba(70,66,60,.5)'; for (let k = 0; k <= 4; k++) g.fillRect(0, k * C - 2, S, 3);
    }
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const wx = x * C + 13, wy = y * C + 11, ww = C - 26, wh = C - 24;
      g.fillStyle = brick ? '#efe9dd' : '#e2ded4'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const gr = g.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, '#6e8ea8'); gr.addColorStop(1, '#27394a');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      const shade=rand();
      if(shade>.42){
        const drop=4+Math.floor(rand()*18);
        g.fillStyle=shade>.72?'#a99d82':'#849297';g.fillRect(wx,wy,ww,drop);
        g.fillStyle='rgba(50,57,52,.33)';g.fillRect(wx,wy+drop-2,ww,2);
      }
      g.fillStyle='rgba(26,31,35,.38)';g.fillRect(wx,wy,3,wh);
      g.fillStyle='rgba(255,244,217,.48)';g.fillRect(wx-5,wy+wh+1,ww+10,3);
      g.fillStyle = brick ? '#efe9dd' : '#e2ded4'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh * .45, ww, 2);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(wx - 4, wy + wh + 3, ww + 8, 3);                       /* sill shadow */
      if (rand() < .14) { e.fillStyle = rand() < .7 ? '#ffd9a0' : '#d6e6ff'; e.fillRect(wx, wy, ww, wh); }
    }
  }
  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const map = tex(col); map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = tex(lit); emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({map, emissiveMap, emissive: 0xffffff, emissiveIntensity: .5,
    roughness: style === 'glass' ? .22 : .88, metalness: style === 'glass' ? .55 : .04, envMapIntensity: style === 'glass' ? 1.1 : .25});
}

/* a box whose four walls repeat the facade tile by real size, with a plain roof */
function block(w, h, d, wall) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < 24; i++) {
    const [a, b] = size[i >> 2];
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(a / BAY)) / 4, uv.getY(i) * Math.max(1, Math.round(b / FLOOR)) / 4);
  }
  // A separate coping and roof deck cover the top. Keep one draw material
  // across all wall directions so the district can be batched by finish.
  const faces=Array.from(geo.index.array);geo.setIndex([...faces.slice(0,12),...faces.slice(24)]);
  return new THREE.Mesh(geo,wall);
}

/* zones: [[x0, x1, z0, z1], ...]; perZone buildings in each */
export function createCity(scene, zones, perZone = 14) {
  const rand = rng(4242), rnd = (a, b) => a + rand() * (b - a), group = new THREE.Group();
  group.name = 'City';
  const walls = [facade('glass', 1), facade('glass', 2), facade('concrete', 3), facade('concrete', 4), facade('brick', 5)];
  const roof = new THREE.MeshStandardMaterial({color: 0x4b4f55, roughness: .95, envMapIntensity: .1});
  const metal = new THREE.MeshStandardMaterial({color: 0x9aa1aa, roughness: .6, metalness: .5, envMapIntensity: .5});
  const stone = new THREE.MeshStandardMaterial({color:0xb7b3a6,roughness:.91});
  const sill = new THREE.MeshStandardMaterial({color:0xd8d6c7,roughness:.72});
  const iron = new THREE.MeshStandardMaterial({color:0x455052,roughness:.67,metalness:.37});
  const pavement = new THREE.MeshStandardMaterial({color:0x575b59,roughness:.96});
  const copper = new THREE.MeshStandardMaterial({color:0x8c7564,roughness:.74,metalness:.29});
  zones.forEach(([x0,x1,z0,z1])=>{
    const district=new THREE.Group();group.add(district);
    const put=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);district.add(o);return o;};
    const box=(x,y,z,w,h,d,mat)=>put(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
    const cyl=(x,y,z,rt,rb,h,mat,n=12)=>put(new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
    const shell=(x,y,z,w,h,d,mat)=>{const m=block(w,h,d,mat);m.position.set(x,y,z);district.add(m);};
    // Each occupied lot has street frontage; the grid leaves actual sightlines
    // through the neighborhood instead of interpenetrating random façades.
    const cols=Math.ceil(Math.sqrt(perZone*(x1-x0)/(z1-z0))),rows=Math.ceil(perZone/cols);
    const lx=(x1-x0)/cols,lz=(z1-z0)/rows;
    for(let c=1;c<cols;c++)box(x0+lx*c,.004,(z0+z1)/2,5.6,.025,z1-z0,pavement);
    for(let r=1;r<rows;r++)box((x0+x1)/2,.018,z0+lz*r,x1-x0,.025,5.6,pavement);
    for(let i=0;i<perZone;i++){
      const x=x0+(i%cols+.5)*lx+rnd(-1.65,1.65),z=z0+(Math.floor(i/cols)+.5)*lz+rnd(-1.65,1.65);
      const w=rnd(9,15),d=rnd(9,15),k=Math.floor(rand()*walls.length),wall=walls[k];
      const floors=k<2?Math.floor(rnd(9,18)):Math.floor(rnd(4,9)),h=floors*FLOOR;
      shell(x,h/2,z,w,h,d,wall);
      box(x,.09,z,w+2.4,.21,d+2.8,stone);
      box(x,2.96,z,w+.32,.26,d+.32,sill);
      for(const side of [-1,1]){
        const front=z+side*(d/2+.06);
        box(x,.98,front,1.62,1.96,.15,iron);
        box(x,2.13,front+side*.44,2.53,.16,1.08,k<2?metal:sill);
        if(k===2||k===3){
          // Projecting apartment balconies with parapet corners and railings.
          const bx=x+w*.22;
          for(let floor=1;floor<floors;floor++){
            const y=floor*FLOOR+.15,railZ=front+side*.97;
            box(bx,y,front+side*.49,3.24,.23,1.15,stone);
            box(bx,y+.88,railZ,3.14,.084,.071,iron);
            for(const dx of [-1.5,-.75,0,.75,1.5])box(bx+dx,y+.47,railZ,.047,.80,.049,iron);
            for(const dx of [-1.53,1.53])box(bx+dx,y+.4,front+side*.49,.13,.66,.99,sill);
          }
        }
        if(k===4){
          box(x,h-.35,front,w+.38,.21,.42,stone);
        }
      }
      if(k===4)for(let floor=2;floor<floors;floor+=3)box(x,floor*FLOOR+.02,z,w+.19,.19,d+.19,sill);
      let top=h,tw=w,td=d;
      if(k<2){
        for(const xx of [-1,1])for(const zz of [-1,1])box(x+xx*w/2,h/2,z+zz*d/2,.17,h,.17,metal);
        if(rand()<.65){const h2=FLOOR*Math.floor(rnd(2,4));tw=w*.70;td=d*.73;
          box(x,h,z,w+.24,.25,d+.24,metal);shell(x,h+h2/2,z,tw,h2,td,wall);top+=h2;}
      }
      box(x,top,z,tw+.22,.27,td+.22,roof);
      for(const s of [-1,1]){
        box(x,top+.26,z+s*td/2,tw+.25,.49,.17,stone);
        box(x+s*tw/2,top+.26,z,.17,.49,td,stone);
      }
      const plantX=x+tw*.19,plantZ=z-td*.20;
      box(plantX,top+.81,plantZ,2.71,1.18,1.68,metal);
      for(const dx of [-.66,.66]){
        cyl(plantX+dx,top+1.42,plantZ,.48,.48,.1,iron,16);
        cyl(plantX+dx,top+1.49,plantZ,.16,.18,.1,metal);
      }
      for(let q=0;q<6;q++)box(plantX-1.05+q*.42,top+.82,plantZ+.853,.20,.7,.04,iron);
      if(k===4||k===2&&rand()<.5){
        const tx=x-tw*.23,tz=z+td*.18;
        for(const dx of [-.78,.78])for(const dz of [-.78,.78])box(tx+dx,top+1.02,tz+dz,.14,1.85,.14,iron);
        cyl(tx,top+2.79,tz,1.36,1.36,2.1,copper,18);
        for(let j=0;j<3;j++)cyl(tx,top+2.06+j*.7,tz,1.39,1.39,.064,iron,18);
        cyl(tx,top+4.18,tz,0,1.46,.74,iron,18);
      }else{
        cyl(x-tw*.22,top+1.03,z+td*.19,.28,.34,1.8,metal);
        cyl(x-tw*.22,top+1.99,z+td*.19,.43,.43,.16,iron);
      }
    }
    batch(district);
    // Skyline detail extends well beyond the camera-centered shadow map.
    for(const mesh of district.children)mesh.castShadow=mesh.receiveShadow=false;
  });
  scene.add(group);
  return group;
}
