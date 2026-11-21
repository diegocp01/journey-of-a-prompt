import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createOceanFish} from './ocean-fish.js';

const TAU=Math.PI*2;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
export const seaY=x=>(x<=130||x>=250)?0:-14*Math.sin(Math.PI*(x-130)/120)**.7;
const smooth=THREE.MathUtils.smoothstep;

function cableDistance(x,z){
  const side=7*(.15+.85*Math.sin(Math.PI*(x-130)/120));
  return Math.min(Math.abs(z),Math.abs(Math.abs(z)-side));
}

export function bedHeight(x,z) {
  // Low sediment shoulders flank the three surveyed cable routes. Keep a
  // continuous contact strip for the armour, including on the coastal slopes.
  const clear=smooth(cableDistance(x,z),.58,2.6);
  const shore=smooth(Math.min(x-130,250-x),0,9);
  const folds=.19*Math.sin(x*.24+z*.42)+.12*Math.sin(z*.79-x*.13)+.052*Math.sin(.76*x+.55*z);
  const ridge=smooth(Math.abs(z),8,19)*(.52+.49*Math.sin(x*.13+z*.23))**2*2.9;
  return seaY(x)-.019+clear*shore*(folds+ridge);
}

function sediment(scene) {
  const geometry=new THREE.PlaneGeometry(120,1,192,104);geometry.rotateX(-Math.PI/2);
  const pos=geometry.attributes.position, uv=geometry.attributes.uv, colors=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+190,t=pos.getZ(i)*2;
    // Use most of the triangles within reach of the dive camera.
    const z=Math.sign(t)*(Math.abs(t)*22+328*Math.abs(t)**5);
    pos.setXYZ(i,x,bedHeight(x,z),z);uv.setXY(i,(x+.07*Math.sin(.4*z))/2.15,z/2.15);
    const patch=.86+.08*Math.sin(x*.42+z*.33)+.06*Math.sin(z*.91-x*.15);
    const trench=.70+.30*smooth(cableDistance(x,z),.10,.48);
    colors.push(patch*trench,patch*trench,patch*trench);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const load=(filename,color)=>{
    const tex=new THREE.TextureLoader().load(new URL('../assets/ocean/'+filename,import.meta.url).href);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=6;
    if(color)tex.colorSpace=THREE.SRGBColorSpace;return tex;
  };
  const material=new THREE.MeshStandardMaterial({color:0xb3c4c0,map:load('gravelly-sand.jpg',true),
    normalMap:load('gravelly-sand-normal.jpg',false),normalScale:new THREE.Vector2(.54,.54),
    roughness:.99,vertexColors:true,envMapIntensity:.12});
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.name='Sediment and cable beds';scene.add(mesh);
}

function layeredRock(random) {
  const pos=[],colors=[],idx=[],n=13;
  const rim=Array.from({length:n},()=>.76+random()*.32);
  const strata=[[0,.76], [.13,1], [.29,.96], [.32,.88], [.41,.96], [.68,.81], [.73,.69], [.79,.72], [.95,.44], [1,.16]];
  const base=new THREE.Color(0x666a61),seam=new THREE.Color(0x363e3e);
  strata.forEach(([h,r],k)=>{
    for(let j=0;j<n;j++){
      const a=j*TAU/n;
      const x=Math.cos(a)*rim[j]*r+.16*h,z=Math.sin(a)*rim[j]*r;
      pos.push(x,h+.088*Math.sin(2*a+.7)*r+.11*x,z);
      const c=base.clone().lerp(seam,k===3||k===6?.75:.15+random()*.29).multiplyScalar(.76+h*.34);
      colors.push(c.r,c.g,c.b);
      if(k>0){const i=k*n+j,next=k*n+(j+1)%n;idx.push(i-n,i,next-n,next-n,i,next);}
    }
  });
  for(let i=1;i<n-1;i++)idx.push((strata.length-1)*n,(strata.length-1)*n+i+1,(strata.length-1)*n+i);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

function tinted(g,color) {
  const geom=g.index?g.toNonIndexed():g;
  if(g!==geom)g.dispose();geom.deleteAttribute('uv');
  const c=new THREE.Color(color),a=[];
  for(let i=0;i<geom.attributes.position.count;i++)a.push(c.r,c.g,c.b);
  geom.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return geom;
}
function combine(parts){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;}

function sponge() {
  const n=26,rows=18,pos=[],uv=[],idx=[];
  // Open flared funnels, with a folded lip and a shaded interior.
  for(let k=0;k<=rows+1;k++)for(let j=0;j<=n;j++){
    const t=Math.min(k/rows,1),a=j/n*TAU,lip=k===rows+1;
    const r=(.067+.112*t**1.4+.013*Math.sin(t*9))*(1+.085*Math.cos(6*a+t*4))*(lip?.83:1);
    pos.push(.069*t*t+Math.cos(a)*r,(lip?.50:.53)*t+.024*t*t*Math.sin(a*3+.6),Math.sin(a)*r);
    uv.push(j/n,t);
    if(k<=rows&&j<n){const i=k*(n+1)+j;idx.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

function spongeSkin(){
  const c=document.createElement('canvas');c.width=192;c.height=256;const g=c.getContext('2d');
  g.fillStyle='#a89f89';g.fillRect(0,0,c.width,c.height);
  for(let y=-12;y<268;y+=13)for(let x=-12;x<204;x+=12){
    const xx=x+((y+12)/13%2)*6;
    g.fillStyle='#5d6056';g.beginPath();g.ellipse(xx,y,3.4,4.9,.28,0,TAU);g.fill();
    g.strokeStyle='#c7bfae';g.lineWidth=1.3;g.beginPath();g.ellipse(xx+1,y+1,4,5.4,.28,0,TAU);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function seaPen() {
  const parts=[];const stem=new THREE.ConeGeometry(.022,.72,9);stem.translate(0,.36,0);parts.push(tinted(stem,0xb18b66));
  for(let i=0;i<19;i++){
    const t=i/19,y=.15+t*.55,span=.02+.13*Math.sin(Math.PI*t)**.77;
    for(const side of [-1,1]){
      const end=v(side*span,y+.083,.021*Math.sin(4*t));
      const curve=new THREE.QuadraticBezierCurve3(v(0,y,0),v(side*span*.66,y+.012,0),end);
      parts.push(tinted(new THREE.TubeGeometry(curve,6,.0065*(1-.28*t),4,false),0xcb926d));
      for(let k=1;k<5;k++){
        const a=curve.getPoint(k/5),leaf=new THREE.SphereGeometry(1,5,4);
        leaf.scale(.004,.018*(1-.1*k),.005);leaf.rotateZ(-side*.36);leaf.translate(a.x,a.y+.009,a.z);
        parts.push(tinted(leaf,0xe0b297));
      }
    }
  }
  return combine(parts);
}

function brittleStar(){
  const parts=[],disc=new THREE.SphereGeometry(1,14,8);disc.scale(.066,.026,.064);disc.translate(0,.022,0);parts.push(tinted(disc,0xbc8e69));
  for(let j=0;j<5;j++){
    const a=j*TAU/5,points=[];
    for(let i=0;i<12;i++){
      const t=i/11,r=.045+.27*t,phi=a+.36*Math.sin(t*5.3+j*.8)*t;
      points.push(v(Math.cos(phi)*r,.017+.012*Math.sin(t*4.4+j)**2,Math.sin(phi)*r));
    }
    for(let i=0;i<points.length-1;i++){
      const from=points[i],to=points[i+1],delta=to.clone().sub(from);
      const g=new THREE.CylinderGeometry(.017*(1-(i+1)/12),.017*(1-i/12),delta.length()+.002,5);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0,1,0),delta.normalize()));
      const p=from.clone().lerp(to,.5);g.translate(p.x,p.y,p.z);
      parts.push(tinted(g,i%3===1?0xcaa17b:0x95795f));
    }
  }return combine(parts);
}

// Ground the clusters against the same relief used by the mesh. Keep rock
// ledges alongside the route and the water in front of the lens unobstructed.
export function createOceanHabitat(scene,random,instances,glow) {
  sediment(scene);
  const root=new THREE.Group();root.name='Continental slope and abyssal plain';scene.add(root);
  const stoneMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,envMapIntensity:.08});
  const rocks=[[],[],[]],cups=[],pens=[],stars=[],contact=[];
  const place=(x,z,s)=>({x,z,y:bedHeight(x,z),s,ry:random()*TAU});
  function rock(x,z,size){
    const p=place(x,z,size),kind=Math.floor(random()*rocks.length),width=size*(.75+random()*.55);
    if(cableDistance(x,z)<width+.24)return;
    const height=size*(.46+random()*.46);
    rocks[kind].push({...p,y:p.y-height*.20,sx:width,sy:height,sz:size*(.57+random()*.29),rz:(random()-.5)*.17});
    if(size>.22)contact.push({...p,y:p.y+.014,sx:width*2.5,sz:size*2.0,sy:1});
  }
  for(let i=0;i<57;i++){
    const x=135+i*2.02+random()*1.4;
    // The far shoulder carries the larger fractured outcrops.
    const z=i%3===0?4.9+random()*6:-3.4-random()*11;
    const size=.6+random()*1.55;rock(x,z,size);
    for(let j=0;j<10;j++)rock(x+(random()-.5)*5,z+(random()-.5)*2.4,.11+random()**2*size*.8);
  }
  for(let i=0;i<850;i++)rock(133+random()*113,(random()-.5)*32,.034+random()**3*.27);
  for(let i=0;i<58;i++){
    const x=143+random()*93,z=(random()<.55?-1:1)*(1.1+random()*8.9);
    if(cableDistance(x,z)<.65)continue;
    const count=2+Math.floor(random()*4);
    for(let j=0;j<count;j++){
      const p=place(x+(random()-.5)*.47,z+(random()-.5)*.41,.34+random()*.8);
      cups.push({...p,rx:(random()-.5)*.24,rz:(random()-.5)*.26});
    }
    if(i%2===0)pens.push({...place(x+.58,z-.22,.64+random()*.68),rz:(random()-.5)*.3});
  }
  for(let i=0;i<81;i++){
    const x=144+random()*89,z=(random()-.5)*15;
    if(cableDistance(x,z)>.4)stars.push({...place(x,z,.58+random()*.65),y:bedHeight(x,z)+.023});
  }
  for(const batch of rocks)instances(root,layeredRock(random),stoneMat,batch);
  const skin=spongeSkin();
  instances(root,sponge(),new THREE.MeshStandardMaterial({map:skin,bumpMap:skin,bumpScale:.009,roughness:.86,side:THREE.DoubleSide}),cups);
  instances(root,seaPen(),stoneMat,pens);instances(root,brittleStar(),stoneMat,stars);
  const shadowQuad=new THREE.PlaneGeometry(1,1);shadowQuad.rotateX(-Math.PI/2);
  instances(root,shadowQuad,new THREE.MeshBasicMaterial({color:0x152d2b,map:glow,opacity:.46,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),contact);

  const fishRoot=new THREE.Group();scene.add(fishRoot);
  const swim=createOceanFish(fishRoot,bedHeight,random);
  const positions=[];
  for(let i=0;i<2300;i++){
    const x=132+random()*116,z=(random()-.5)*29;
    positions.push(x,bedHeight(x,z)+random()*Math.min(8,-seaY(x)),z);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const time={value:0},snowMaterial=new THREE.PointsMaterial({map:glow,color:0xb7d5d4,size:.036,opacity:.54,transparent:true,depthWrite:false});
  snowMaterial.onBeforeCompile=sh=>{sh.uniforms.seaTime=time;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float seaTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.x+=.19*sin(seaTime*.32+position.z);transformed.y+=.18*sin(seaTime*.19+position.x*2.7);
    transformed.z+=.12*cos(seaTime*.27+position.y);`);};
  const snow=new THREE.Points(g,snowMaterial);fishRoot.add(snow);
  return (t,cameraX)=>{
    fishRoot.visible=cameraX>115&&cameraX<266;
    if(fishRoot.visible){swim(t);time.value=t;}
  };
}
