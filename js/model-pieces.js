// Fine details belong directly to the thing the learner is comparing. These
// sockets, contact pads and meter tracks follow their parent through the tour.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const alloy = color => new THREE.MeshStandardMaterial({color,roughness:.49,metalness:.42,envMapIntensity:.75});

function repeat(geometry,material,items) {
  const mesh = new THREE.InstancedMesh(geometry,material,items.length);
  const pose = new THREE.Object3D();
  items.forEach(([x,y,z,w=1,h=1,d=1],i)=>{
    pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();
    mesh.setMatrixAt(i,pose.matrix);
  });
  return mesh;
}

export function tokenHousing(group,w,h,color) {
  const base=new THREE.Mesh(new RoundedBoxGeometry(w+.025,h+.025,.16,1,.075*h),alloy(0x34424e));
  base.position.z=-.105;
  group.add(base);
  const pads=[];
  for(let i=0;i<5;i++) pads.push([(i-2)*.080*h,-h*.395,.148,.049*h,.019*h,.009]);
  const inset=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(.47)});
  group.add(repeat(new THREE.BoxGeometry(),inset,pads));
}

// An octagonal face and a single bevel read at phone size. A tessellated
// rounded box would repeat hundreds of triangles for each little cell.
export function displayCell() {
  const half=.088,corner=.014;
  const corners=[
    [-half+corner,-half],[half-corner,-half],[half,-half+corner],[half,half-corner],
    [half-corner,half],[-half+corner,half],[-half,half-corner],[-half,-half+corner],
  ];
  const outline=new THREE.Shape(corners.map(([x,y])=>new THREE.Vector2(x,y)));
  return new THREE.ExtrudeGeometry(outline,{
    depth:.046,bevelSegments:1,bevelSize:.007,bevelThickness:.009,steps:1,
  }).translate(0,0,-.023);
}

export function fingerprintSockets(cells,xs) {
  const board=repeat(new RoundedBoxGeometry(1.22,1.41,.12,3,.07),alloy(0x353b49),
    xs.map(x=>[x,1.15,-.112]));
  const contacts=[], pins=[];
  for(const x of xs) {
    for(let i=0;i<5;i++) {
      contacts.push([x+(i-2)*.165,1.987,-.1,.039,.28,.029]);
    }
    for(const sx of [-1,1])for(const sy of [-1,1])pins.push([x+sx*.564,1.15+sy*.64,-.036]);
  }
  cells.add(board,repeat(new THREE.BoxGeometry(),alloy(0xbfa477),contacts),
    repeat(new THREE.CylinderGeometry(.023,.023,.01,8).rotateX(Math.PI/2),alloy(0xa7acb3),pins));
}

export function scoreTracks(chart,x,choices) {
  const full=4.5;
  const parts=[],ticks=[];
  choices.forEach((_,i)=>{
    const y=4.1-i*.75;
    parts.push([x+full/2,y,-.145,full,.495,.08]);
    for(let mark=1;mark<10;mark++) ticks.push([x+full*mark/10,y-.198,-.092,.012,.07,.008]);
  });
  chart.add(repeat(new RoundedBoxGeometry(1,1,1,2,.08),alloy(0x283644),parts),
    repeat(new THREE.BoxGeometry(),alloy(0x687e88),ticks));
}

export function patternBoard(ms) {
  // Beneath the projected vectors, bus traces turn through two 45° bends to
  // solder pads. The center stays quiet to keep the tokens visually dominant.
  const sockets=[];
  for (const x of [-15,-5,5,15]) for(let row=0;row<7;row++) sockets.push([x,1.2+row*1.5,-16.1]);
  ms.add(repeat(new THREE.TorusGeometry(.275,.038,6,16),alloy(0x887e9f),sockets));
  const tracks=[],pads=[];
  for (const side of [-1,1]) for(let i=0;i<15;i++){
    const x=side*(3.8+i*.29),z=-2.7-i*.31,end=side*(10.2+(i%6)*1.1);
    const path=[[x,.007,4.8+i*.18],[x,.007,z],[x+side*1.6,.007,z-1.6],[end,.007,z-1.6]];
    for(let j=0;j<path.length-1;j++)tracks.push(...path[j],...path[j+1]);
    pads.push([end,.015,z-1.6]);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(tracks,3));
  ms.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x50477d,transparent:true,opacity:.63})),
    repeat(new THREE.CylinderGeometry(.065,.065,.012,10),alloy(0x696589),pads));
}
