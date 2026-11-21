// The rack fronts have a texture at aisle distances. The service aisle, reader,
// and open GPU blades add physical hardware where the camera comes within reach.
import * as THREE from 'three';
import {rigidParts} from './rigid-parts.js';
import { dieSurface } from './silicon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const steel = (color, roughness = .52, metalness = .45) =>
  new THREE.MeshStandardMaterial({color, roughness, metalness, envMapIntensity: .85});

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function paint(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  return texture(c);
}

// Shadows inside perforations, recessed drive sleds, slot catches, and port lights
// are baked at full rack scale so a thousand distant units need no extra draws.
export function rackFront() {
  const width = 384, height = 1024;
  const atlas = (emission) => paint(width, height, g => {
    const fill = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    fill(0, 0, width, height, emission ? '#000' : '#131c24');
    function screw(x, y) {
      g.fillStyle = '#bac0c1'; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
      fill(x - 1.4, y - .6, 2.8, 1.2, '#3a4044');
    }
    if (!emission) {
      const rail = g.createLinearGradient(0, 0, 18, 0);
      rail.addColorStop(0, '#19252a'); rail.addColorStop(.42, '#789198'); rail.addColorStop(.7, '#4c6067'); rail.addColorStop(1, '#131c22');
      fill(0, 0, 18, height, rail); fill(368, 0, 16, height, '#42565c');
    }
    for (let row = 0; row < 16; row++) {
      const y = 14 + row * 62;
      const isSwitch = row < 2 || row === 9;
      if (!emission) {
        const face = g.createLinearGradient(0, y, 0, y + 58);
        face.addColorStop(0, isSwitch ? '#c4c8c6' : '#75868b'); face.addColorStop(.08, isSwitch ? '#7b898b' : '#4e626b'); face.addColorStop(1, isSwitch ? '#39494f' : '#273942');
        fill(18,y,348,58,face);
        for (let side of [10,374]) { screw(side,y+10); screw(side,y+47); }
        for (let side of [24,351]) {
          fill(side,y+6,8,44,'#222d35');fill(side+2,y+8,3,35,'#a7b7b5');
        }
        if (isSwitch) {
          for (let i=0;i<12;i++) {
            const x=42+i*23;fill(x,y+11,19,32,'#b6b8a7');fill(x+1,y+12,17,13,'#18252a');fill(x+1,y+29,17,13,'#1a282d');
            for(let p=0;p<4;p++){fill(x+3+p*3,y+20,1.5,4,'#b1976b');fill(x+3+p*3,y+37,1.5,4,'#b1976b');}
          }
        } else {
          for(let i=0;i<4;i++) {
            const x=39+49*i;fill(x,y+7,46,43,'#101d24');fill(x+3,y+9,40,37,'#445862');
            for(let k=0;k<5;k++)for(let j=0;j<4;j++) fill(x+6+6*k,y+15+6*j,3,2,'#101a20');
            fill(x+5,y+40,31,3,'#8d9ca0');fill(x+36,y+13,4,21,'#242c2d');
          }
          for (let j=0;j<6;j++)for(let k=0;k<12;k++) {
            const x=244+k*6+(j%2)*2;fill(x,y+12+j*6,3,2.5,'#182a31');
          }
        }
        fill(326,y+5,15,7,'#bec5bc');
      }
      const stateColor = emission ? '#89d4a1' : '#b4e7aa';
      if(isSwitch) {
        for(let i=0;i<12;i++)if((row+i*7)%5<3)fill(43+i*23,y+6,4,2.8,stateColor);
      } else {
        fill(329,y+24,4,6,stateColor);
        if(row%3===1)fill(329,y+35,4,4,emission?'#d79b57':'#e6b067');
      }
    }
  });
  return new THREE.MeshStandardMaterial({map:atlas(false),emissiveMap:atlas(true),emissive:0xffffff,emissiveIntensity:1.15,roughness:.54,metalness:.35,envMapIntensity:.8});
}

// Hot aisles expose fan trays, redundant power supplies and their IEC
// sockets. Cold aisles face pairs of front doors over the air grilles.
export function rackRear() {
  const map=paint(240,640,g=>{
    g.fillStyle='#172027';g.fillRect(0,0,240,640);
    for(let row=0;row<14;row++){
      const y=8+row*45;
      const finish=g.createLinearGradient(0,y,0,y+43);
      finish.addColorStop(0,'#9da7aa');finish.addColorStop(.12,'#5e6c72');finish.addColorStop(1,'#37464c');
      g.fillStyle=finish;g.fillRect(7,y,226,42);
      for(let fan=0;fan<4;fan++){
        const x=28+fan*38,cy=y+21;
        g.fillStyle='#162026';g.beginPath();g.arc(x,cy,16,0,2*Math.PI);g.fill();
        g.strokeStyle='#657376';g.lineWidth=1.4;
        for(let r of [6,10,14]){g.beginPath();g.arc(x,cy,r,0,2*Math.PI);g.stroke();}
        for(let spoke=0;spoke<5;spoke++){
          const a=spoke*2*Math.PI/5;g.beginPath();g.moveTo(x,cy);g.lineTo(x+Math.cos(a)*15,cy+Math.sin(a)*15);g.stroke();
        }
      }
      for(let k=0;k<2;k++){
        const x=167+k*32;g.fillStyle='#93a1a1';g.fillRect(x,y+5,29,32);
        g.fillStyle='#243139';g.fillRect(x+2,y+7,25,27);
        g.fillStyle='#0d181d';g.fillRect(x+7,y+15,15,11);
        g.fillStyle='#b0baba';g.fillRect(x+3,y+9,22,2);
        g.fillStyle='#8bc59b';g.fillRect(x+4,y+28,3,2);
      }
    }
  });
  return new THREE.MeshStandardMaterial({map,roughness:.60,metalness:.36,envMapIntensity:.75});
}

// Batch static details in their local frame, partitioned by surface finish.
function hardware(parent) {
  const parts = rigidParts(parent);
  return {
    box(mat,x,y,z,w,h,d) { parts.add(new THREE.BoxGeometry(w,h,d),mat,x,y,z); },
    pin(mat,x,y,z,r,depth) { parts.add(new THREE.CylinderGeometry(r,r,depth,8),mat,x,y,z,Math.PI/2); },
    tube(mat,coords,r,steps=16) {
      const curve=new THREE.CatmullRomCurve3(coords.map(v=>V(...v)));
      parts.add(new THREE.TubeGeometry(curve,steps,r,6,false),mat);
    },
    finish() {
      parts.finish();
      for(const part of parent.children) if(part.isMesh) part.castShadow=false;
    }
  };
}

function boardSurface() {
  return paint(512,384,g=>{
    g.fillStyle='#1a5651';g.fillRect(0,0,512,384);
    // Matched copper tracks fan out from the package through vias to the memory.
    for(let side of [-1,1])for(let lane=0;lane<31;lane++){
      const x=256+side*(36+lane*2.1), y=32+lane*10;
      g.strokeStyle=lane%3?'#38756a':'#65927b';g.lineWidth=1.6;
      g.beginPath();g.moveTo(256+side*42,143+lane*3);
      g.lineTo(x,143+lane*3);g.lineTo(x+side*26,143+lane*3-26);
      g.lineTo(x+side*26,y);g.lineTo(x+side*(52+lane),y);g.stroke();
      g.beginPath();g.arc(x+side*(52+lane),y,2,0,Math.PI*2);g.fillStyle='#c2aa72';g.fill();
    }
    g.strokeStyle='#b3c7af';g.lineWidth=2;g.strokeRect(9,9,494,366);
    for(let k=0;k<28;k++){g.fillStyle='#c5a967';g.fillRect(70+k*13,360,7,14);}
  });
}

export function acceleratorRack(parent, rackX, chips) {
  const frame = new THREE.Group();frame.position.set(rackX,0,3.6);frame.name='Accelerator service rack';parent.add(frame);
  const p=hardware(frame), gunmetal=steel(0x44525c), rails=steel(0xa4a9a9,.39,.6), graphite=steel(0x252e34,.62,.23),
    copper=steel(0xcb8a50,.33,.68), nickel=steel(0xc9c0a1,.4,.53), silicon=steel(0x293038,.45,.25), black=steel(0x121a20,.75,.12);
  const substrate=steel(0xffffff,.52,.2);substrate.map=boardSurface();
  const die=texture(dieSurface());
  const face=new THREE.PlaneGeometry(.099,.092);
  for(const side of [-1,1]){
    p.box(rails,side*.375,1.16,-.018,.033,2.28,.052);
    for(let i=0;i<31;i++)p.box(black,side*.376,.075+i*.072,-.047,.012,.027,.004);
  }
  for(let k=0;k<5;k++) {
    const y=.3+k*.4;
    p.box(gunmetal,0,y+.173,.011,.71,.36,.045);
    p.box(rails,0,y+.011,-.036,.71,.023,.095);
    for(let side of [-1,1]){
      const x=side*.177;
      p.box(substrate,x,y+.176,-.023,.316,.293,.016);
      p.box(nickel,x,y+.177,-.039,.126,.123,.017);
      const dieMaterial=new THREE.MeshStandardMaterial({map:die,roughness:.37,metalness:.42,envMapIntensity:1.1,emissive:0xffac48,emissiveMap:die,emissiveIntensity:0});
      const active=new THREE.Mesh(face,dieMaterial);
      active.position.set(x,y+.177,-.05);active.rotation.y=Math.PI;frame.add(active);chips.push(active);
      for(const flank of [-1,1]) {
        for(let bank=0;bank<3;bank++){
          const mx=x+flank*.093,my=y+.108+bank*.069;
          p.box(silicon,mx,my,-.039,.045,.046,.015);
          p.box(rails,mx+.003,my+.006,-.048,.023,.002,.001);
        }
        p.pin(nickel,x+flank*.139,y+.053,-.039,.007,.012);
        p.pin(nickel,x+flank*.139,y+.298,-.039,.007,.012);
      }
      // A copper vapor chamber along each sled edge ends in pressed cooling fins.
      p.tube(copper,[[x-.117,y+.262,-.039],[x-.114,y+.29,-.054],[x-.085,y+.303,-.054],[x+.057,y+.303,-.054],[x+.074,y+.278,-.05]],.006);
      for(let f=0;f<11;f++)p.box(rails,x-.055+f*.01,y+.281,-.042,.004,.042,.021);
      for(let f=0;f<9;f++)p.box(graphite,x-.077+f*.018,y+.053,-.04,.013,.016,.013);
    }
  }
  p.finish();
}

export function securityVestibule(scene, routeLight) {
  const arch=new THREE.Group();arch.name='Security vestibule and optical gate';arch.position.x=310;scene.add(arch);
  const p=hardware(arch);
  const shell=steel(0x819093,.39,.55),rubber=steel(0x182326,.76,.15),satin=steel(0x47565e,.47,.42),
    brass=steel(0xbaa477,.48,.45),lens=steel(0x132d39,.18,.35);
  const sides=[-1,1];
  for (const sign of sides) {
    const z=sign*1.4;
    p.box(satin,0,.06,z,.64,.12,.54);
    p.box(shell,-.012,.125,z,.55,.023,.47);
    p.box(shell,-.21,1.64,z,.06,2.99,.22);
    p.box(rubber,-.246,1.65,z,.018,2.78,.082);
    for(let j=0;j<7;j++) {
      p.box(lens,-.261,.44+.37*j,z,.031,.105,.065);
      p.box(shell,-.279,.504+.37*j,z,.036,.013,.09);
    }
    p.box(rubber,-.214,2.93,z,.042,.22,.19);
    for(let i=0;i<5;i++)p.box(shell,-.24,2.86+i*.028,z,.014,.009,.125);
    p.box(satin,-.042,2.97,sign*1.63,.11,.115,.15);
    p.box(shell,.06,.45,sign*1.61,.07,.57,.08);
    p.box(brass,-.236,.32,z,.016,.06,.15);
    for(let i of [-1,1]){
      p.pin(rubber,-.237,.075,z+i*.21,.026,.018);
      p.box(shell,-.1,3.36,sign*(.68+i*.135),.12,.08,.16);
    }
  }
  // Three output contacts match the three marked lanes beyond the gate. The
  // green trace shares the actual material that the route-selection cue lights.
  p.box(satin,3.91,.078,0,.57,.018,.49);
  p.box(rubber,3.91,.093,0,.43,.023,.38);
  for(let i=0;i<6;i++){
    for(const sign of sides)p.box(brass,3.73+i*.069,.096,sign*.227,.029,.016,.055);
  }
  for(const lane of [-3.8,-.6,2.6]){
    const end=V(4.2,0,lane).normalize().multiplyScalar(.88);
    const dz=lane/30,finish=lane>0?routeLight:shell;
    p.tube(finish,[[4.13,.083,dz],[4.30,.083,dz],[4.41,.083,end.z*.64],[4+end.x,.083,end.z]],.018,10);
  }
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    p.box(shell,4+Math.cos(a)*.79,.078,Math.sin(a)*.79,.036,.016,.036);
  }
  // Recessed luminaires have return lips and a shallow prism grille. The
  // original broad luminous surfaces are still the source of illumination.
  for (const x of [-6,-1,4]) {
    for (const sign of sides) {
      p.box(shell,x+sign*1.01,4.95,0,.042,.055,2.45);
      p.box(shell,x,4.95,sign*1.211,2.06,.055,.043);
    }
    for(let j=-3;j<=3;j++) p.box(satin,x,4.949,j*.32,1.96,.015,.014);
  }
  p.box(satin,0,3.44,0,.43,.11,3.1);
  p.box(rubber,-.225,3.29,0,.031,.11,2.24);
  for(let i=0;i<36;i++)p.box(shell,-.245,3.29,-1.06+i*.061,.025,.076,.014);
  // The sign is a mounted enclosure above the arch, standing clear of its face.
  p.box(satin,-.13,3.95,0,.12,.77,3.04);
  for(let sign of sides)p.box(shell,-.10,3.55,sign*.97,.12,.38,.075);
  // Wall access panels, continuous skirtings and a door reveal provide scale
  // without adding signage that would compete with the educational labels.
  for(let side of sides){
    const z=side*5.91;
    p.box(satin,-.8,.14,z,16.8,.25,.09);
    p.box(shell,-.8,.275,z,16.8,.025,.065);
    for(let bay=0;bay<10;bay++){
      const x=-8.8+bay*1.67;
      p.box(rubber,x,2.49,z+side*.027,.027,4.82,.022);
      p.box(shell,x+.021,2.49,z+side*.018,.012,4.82,.015);
    }
    for (let laneZ of [.2, 3.4]) p.box(satin,7.93,1.5,side*laneZ,.08,2.97,.05);
  }
  p.finish();
  const glass=new THREE.MeshPhysicalMaterial({color:0x9dc8cb,metalness:.08,roughness:.18,clearcoat:.75,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
  const stripe=new THREE.MeshBasicMaterial({color:0xaec6c6,transparent:true,opacity:.41,depthWrite:false});
  const leaves=sides.map(sign=>{
    const leaf=new THREE.Group();arch.add(leaf);
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.22,2.88),glass);
    pane.rotation.y=-Math.PI/2;pane.position.set(.065,1.58,0);leaf.add(pane);
    const frame=hardware(leaf);
    frame.box(satin,.069,.169,0,.07,.048,1.225);
    frame.box(shell,.069,3.008,0,.054,.06,1.225);
    frame.box(satin,.068,1.592,-sign*.601,.041,2.87,.024);
    for(let j=0;j<9;j++)frame.box(stripe,.039,1.27,-.525+j*.129,.002,.032,.086);
    frame.finish();
    return leaf;
  });
  let open=0;
  return (cleared, dt)=>{
    open+=(Number(cleared)-open)*(1-Math.exp(-dt*4.4));
    leaves.forEach((leaf,i)=>{leaf.position.z=sides[i]*(.615+1.24*open);});
  };
}

export function serviceAisle(scene) {
  const aisle=new THREE.Group();aisle.position.x=322.5;aisle.name='Network and power service aisle';scene.add(aisle);
  const p=hardware(aisle),steelMat=steel(0x8a989e,.37,.62),powder=steel(0x47555a,.65,.29),rubber=steel(0x202b32,.65,.15),
    yellow=steel(0xddb857,.59,.12), aqua=steel(0x679faa,.56,.1), orange=steel(0xbc735a,.58,.12);
  for(const sign of [-1,1]) {
    const z=2.6+sign*1.6, front=z-sign*.6;
    // A few front-facing switches with real patch leads sit at the ends of
    // the aisle and beside the accelerator. Other cabinets share the atlas.
    for(const c of [0,1,8,15,19,22,25,30]){
      const x=c*.86;
      for(const sx of [-1,1]) {
        p.box(steelMat,x+sx*.373,1.16,front-sign*.005,.017,2.28,.022);
        p.box(rubber,x+sx*.372,.065,front-sign*.018,.052,.068,.04);
      }
      for(const sy of [.34,1.12,1.81]){
        p.box(rubber,x+.329,sy,front-sign*.018,.034,.154,.035);
        p.box(steelMat,x+.329,sy,front-sign*.046,.022,.118,.023);
      }
      p.box(powder,x,2.085,front-sign*.03,.68,.145,.052);
      for(const edge of [-1,1]){
        p.box(rubber,x+edge*.32,1.928,front-sign*.035,.073,.24,.053);
        for(let n=0;n<3;n++)p.box(powder,x+edge*.32,1.862+n*.054,front-sign*.061,.055,.029,.024);
      }
      for(let k=0;k<6;k++){
        const px=x-.248+.085*k,side=k%2===0?-1:1,depth=front-sign*.085;
        p.box(rubber,px,2.095,depth+sign*.026,.061,.040,.05);
        p.box(steelMat,px,2.098,depth,.036,.026,.024);
        const end=x+side*.32, drop=.10+(k%3)*.055;
        const jacket=[yellow,aqua,orange][Math.floor(k/2)];
        p.tube(jacket,[[px,2.092,depth],[px,2.071,depth-sign*.031],[px+side*.035,2.03-drop,depth-sign*.055],
          [end-side*.025,2.02-drop,depth-sign*.052],[end,2.06-drop,front-sign*.029]],.0063,13);
      }
    }
    // A small number of physically distinct hanging combs organize the power and fiber.
    for(let i=0;i<9;i++){
      const x=1.3+i*3.1;
      p.box(steelMat,x,2.64,z,.036,.031,.59);
      p.box(powder,x,2.61,z-sign*.29,.045,.093,.044);
      p.box(powder,x,2.61,z+sign*.29,.045,.093,.044);
      if(i%2===0){
        for(const side of [-1,1])p.box(steelMat,x,3.76,z+side*.22,.02,2.36,.02);
      }
    }
  }
  p.finish();
}

export function chillerGuards(scene) {
  // Reuse one rooftop assembly across the cooling plant. Side louvers stand
  // proud of the enclosure; the axial impeller sits below the safety cage.
  const template=new THREE.Group(),guard=steel(0xa4aeb1,.53,.65),blade=steel(0x59676b,.58,.43),
    gasket=steel(0x2f393c,.67,.27);
  const pieces=rigidParts(template);
  for(let i=0;i<4;i++){
    pieces.add(new THREE.TorusGeometry(.42+i*.315,.024,5,36),guard,0,.145,0,Math.PI/2);
  }
  for(let i=0;i<8;i++){
    pieces.add(new THREE.BoxGeometry(.028,.035,2.91),guard,0,.18,0,0,i*Math.PI/8);
    const a=i*Math.PI/4;
    pieces.add(new THREE.SphereGeometry(1,10,5).scale(.18,.038,.62),blade,Math.sin(a)*.79,.082,Math.cos(a)*.79,0,a+.39,.18);
  }
  for(const side of [-1,1]){
    for(let row=0;row<6;row++) {
      pieces.add(new THREE.BoxGeometry(3.61,.063,.11),guard,0,-1.28+row*.173,side*2.025,side*.43);
      pieces.add(new THREE.BoxGeometry(.11,.063,3.61),guard,side*2.025,-1.28+row*.173,0,0,0,-side*.43);
    }
    for(let dx of [-1.55,1.55])pieces.add(new THREE.BoxGeometry(.12,.13,.3),gasket,dx,-1.72,side*1.55);
  }
  pieces.finish();
  const pose=new THREE.Object3D();
  for(const assembly of template.children){
    const instances=new THREE.InstancedMesh(assembly.geometry,assembly.material,27);
    let index=0;
    for(let x=312;x<=392;x+=10)for(let z=-14;z<=14;z+=14){
      pose.position.set(x,14.13,z);pose.updateMatrix();instances.setMatrixAt(index++,pose.matrix);
    }
    scene.add(instances);
  }
}

export function facilityEntrance(world) {
  const facade=new THREE.Group();
  facade.name='Panelized facade and service court';facade.position.x=300;world.add(facade);
  const p=hardware(facade),aluminum=steel(0x93a3a9,.55,.44), graphite=steel(0x313f48,.59,.33),
    concrete=steel(0x9d9f99,.88,.04), rubber=steel(0x222e33,.76,.10), bronze=steel(0x9b7c58,.52,.49);
  const lens=new THREE.MeshStandardMaterial({color:0xf4e8c4,emissive:0xffe1ad,emissiveIntensity:1.35,roughness:.36});
  for(const s of [-1,1]){
    // Pressed maintenance louver cassettes break up the tall blind elevation.
    for(const bay of [7.4,11.9,21.9]){
      const z=s*bay;
      p.box(graphite,-.094,2.38,z,.14,2.63,3.40);
      for(let edge of [-1,1]) {
        p.box(aluminum,-.194,2.38+edge*1.32,z,.12,.073,3.54);
        p.box(aluminum,-.194,2.38,z+edge*1.728,.12,2.69,.066);
      }
      for(let slat=0;slat<15;slat++) {
        const y=1.16+slat*.173;
        p.box(graphite,-.161,y+.061,z,.112,.103,3.35);
        p.box(aluminum,-.23,y,z,.13,.049,3.36);
      }
      p.box(graphite,-.246,2.38,z,.037,2.54,.057);
    }
    for(const [lo,hi] of [[2.35,13.55],[18.45,24.95]]){
      p.box(aluminum,-.058,.65,s*(lo+hi)/2,.15,.026,hi-lo);
      p.box(concrete,-.12,.165,s*(lo+hi)/2,.32,.33,hi-lo);
    }
    for(const y of [4.86,7.74])p.box(aluminum,-.058,y,s*12.5,.15,.026,25);
    // Satin reveal surrounds the entry canopy; a warm recessed ribbon and
    // transverse seams give its underside a depth cue on the fast approach.
    p.box(aluminum,-.85,4.50,s*3.22,1.65,.245,.086);
    p.box(bronze,-.84,4.281,s*2.53,1.43,.041,.083);
    p.box(lens,-.84,4.255,s*2.53,1.34,.015,.053);
    p.box(aluminum,-.16,2.13,s*2.27,.28,4.26,.084);
    for(const x of [-4.1,-1.9]){
      const z=s*2.58;
      p.box(concrete,x,.065,z,.39,.13,.39);
      p.box(graphite,x,.51,z,.163,.88,.164);
      p.box(aluminum,x,.867,z,.173,.075,.174);
    }
    for(const x of [-32,-22,-12,-3]){
      const z=s*5.5;
      p.box(concrete,x,.103,z,.46,.206,.46);
      p.box(graphite,x,2.17,z,.135,4.07,.138);
      p.box(aluminum,x,4.18,z-s*.24,.125,.113,.61);
      p.box(graphite,x,4.162,z-s*.548,.45,.106,.52);
      p.box(lens,x,4.098,z-s*.548,.36,.025,.39);
      for(let j=0;j<4;j++)p.box(aluminum,x,4.081,z-s*.548+(j-1.5)*.08,.36,.015,.012);
    }
  }
  for(let i=0;i<9;i++)p.box(graphite,-1.66+i*.19,4.281,0,.017,.033,6.28);
  p.box(aluminum,-1.62,4.41,0,.094,.245,6.48);
  p.finish();
}
