import {updateScans} from './scan-lod.js';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {coastalWater} from './coastal-water.js';
import {appCopy} from './copy.js';
import {createNarration} from './narration.js';
import {createHand,HP} from './hand.js';
import {addPhoneHardware} from './handset.js';
import {createPhotoGrip} from './phone-grip.js';
import {paintPhone,phoneLayout} from './phone-screen.js';
import {createForest,scatter,createClouds,tickNature,landGround,distantRidges} from './nature.js';
import {createCity} from './city.js';
import {byteHardware} from './byte-stage.js';
import {makeEnvelope} from './envelope.js';
import {addEarth} from './earth.js';
import {createIntro,INTRO_AT} from './intro.js';
import {createTunnel,TUNNEL_AT} from './tunnel.js';
import {seaDetail,hallDetail,modelDetail} from './detail.js';
import {createWritingDesk} from './writing-desk.js';
import {cableCorridor} from './right-of-way.js';
import {buildTowerHardware, dressTowerCabinet, dressRoadsideNode, dressLandingStation} from './field-equipment.js';
import {createHomeDetails,inCottageParcel} from './home.js';

import {seaY,bedHeight} from './seafloor.js';
import {armouredCableMaterial} from './subsea-hardware.js';
import {showChipLesson, hideChipLesson} from './chip-lesson.js';
import {rackFront, rackRear, acceleratorRack, securityVestibule, serviceAisle, chillerGuards, facilityEntrance} from './data-center.js';
import {tokenHousing, fingerprintSockets, scoreTracks, patternBoard, displayCell} from './model-pieces.js';

/* =====================================================================
   COPY
   ===================================================================== */
/* all on-screen text lives in copy.js */
const DNS_ROWS=[["maps.example","203.0.113.20"],["mail.example","198.51.100.7"],["video.example","203.0.113.88"],["chatgpt.com","104.18.32.47"],["news.example","198.51.100.42"],["shop.example","192.0.2.61"]];

/* =====================================================================
   STATE + SMALL HELPERS
   ===================================================================== */
let lang=new URLSearchParams(location.search).get("lang")==="es"?"es":"en",ui=appCopy[lang];
let current=0,sub=0,done=false,busy=false,replayed=false,subNote="",beat=-1,item=0,fin=0;
const MODEL=4,HOME=5;
const BEATS=[[0,6.2],[0],[0,6],[0,5],null,[0]];
/* when the next short line of a step appears (story seconds from the start of the action) */
/* story time in each beat when its picture is done and the main button turns on */
const READY=[[2,10.9],[8.6],[2,12.4],[3.8,13.3],null,[1.2]];
const ITEMS=[[[3,5.3],[8.7,10.9]],[[3.5,5.8]],[[3.5],[9.2,11.8]],[[3],[9.6,11.8]],null,[[1.6]]];
const beatTimes=i=>BEATS[i];
const $=id=>document.getElementById(id);
const narration=createNarration($("voiceStatus"));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const v3=a=>new THREE.Vector3(a[0],a[1],a[2]);
const clamp01=x=>Math.min(1,Math.max(0,x));
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const outBack=t=>1+2.7*Math.pow(t-1,3)+1.7*Math.pow(t-1,2);
const UP=V(0,1,0);
const GX=340.56,MX=1000,ROW_Y=2.6;
/* seconds since Send when each stop is reached: the network legs take hundredths of a second, the AI takes almost all of the 20 */
const T=[0,.002,.01,.05,.1,19.9];
const TMS=[[0,.001,.002],[.003,.01],[.012,.03,.05],[.06,.08,.1],null,[19.95,20]];

/* clock-driven task list (cancellable, pauses with the render loop) */
let clock=0,tasks=[],temps=[];
/* pacing: the story clock runs slowly and stops at every gate until the viewer taps Continue */
let amb=0,rate=.6,boost=1,realSpeed=false,gates=[],waiting=false,stepping=false,softs=[],readUntil=0,openAt=Infinity,endAt=0;
function gate(delay,fn,label){gates.push({t:clock+delay-.001,fn,label});gates.sort((a,b)=>a.t-b.t);}
function release(){if(!waiting) return;waiting=false;const g=gates.shift();if(g.fn) g.fn();renderHUD();}
function at(delay,fn){tasks.push({start:clock+delay,dur:0,fn});}
function tween(delay,dur,fn,easing){tasks.push({start:clock+delay,dur,fn,easing});}
function clearTasks(){hideChipLesson();tasks.forEach(t=>t.dead=true);tasks=[];temps.forEach(o=>o.parent&&o.parent.remove(o));temps=[];liveTimer=null;gates=[];waiting=false;stepping=false;realSpeed=false;if(typeof speedLabel!=="undefined"&&speedLabel){speedLabel.visible=false;speedLabel.material.opacity=0;}stageGoal=0;waveOn=0;softs=[];readUntil=0;openAt=Infinity;setLegend(false);}
/* the small "hair next to a glass thread" panel above the bottom bar */
function setLegend(on){$("sizeLegend").classList.toggle("on",on);}
function runTasks(){
  for(const t of tasks.slice()){
    if(t.dead||clock<t.start) continue;
    const p=t.dur?Math.min(1,(clock-t.start)/t.dur):1;
    t.fn(t.easing?t.easing(p):p);
    if(p>=1) t.dead=true;
  }
  tasks=tasks.filter(t=>!t.dead);
}
/* the main button turns on as soon as the picture is done (openAt), even if lines of text are still to come.
   Lines keep appearing on their own while you wait; a tap moves straight on to the next screen. */
const lineLimit=()=>gates.length?gates[0].t:endAt;
const pendingLine=()=>softs.length>0&&softs[0]<=lineLimit()+.002;
function jumpTo(t){while(clock<t){clock=Math.min(t,clock+.05);runTasks();}}
/* one tap always moves on to the next screen, even if some lines of text have not come up yet */
function skipAhead(){
  readUntil=0;
  if(gates.length){const t=gates[0].t;softs=softs.filter(x=>x>t);jumpTo(t);waiting=true;release();return;}
  const wasStep=stepping;
  softs=[];jumpTo(endAt+.001);
  if(!busy&&wasStep) mainAction(); else renderHUD();
}

/* =====================================================================
   RENDERER
   ===================================================================== */
const canvas=$("gl");
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();
const world=new THREE.Group(),landscape=new THREE.Group();
world.name='Physical journey';landscape.name='Terrestrial landscape';
world.add(landscape);scene.add(world);
scene.fog=new THREE.FogExp2(0xb9d3ea,.0026);
const camera=new THREE.PerspectiveCamera(45,1,.05,1700);
const pmrem=new THREE.PMREMGenerator(renderer);
const roomEnv=pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.environment=roomEnv;
let skyEnv=null,skyMesh=null,skyInfo=null;
const bgColor=new THREE.Color(0xb9d3ea);
scene.background=bgColor;
/* the opening screen's backdrop: light sky colour behind the title in the top half, dark below where the model sits */
const introBg=(()=>{
  const c=document.createElement("canvas");c.width=4;c.height=512;
  const g=c.getContext("2d"),gr=g.createLinearGradient(0,0,0,512);
  [[0,"#c6dcf0"],[.3,"#b9d3ea"],[.42,"#7f9fcb"],[.5,"#2c3c6e"],[.57,"#0a1030"],[1,"#060a1c"]].forEach(([t,col])=>gr.addColorStop(t,col));
  g.fillStyle=gr;g.fillRect(0,0,4,512);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
})();

/* real-world assets (all CC0 from polyhaven.com, loaded at runtime; everything has a built-in fallback) */
const PH="https://dl.polyhaven.org/file/ph-assets";
const texLoader=new THREE.TextureLoader();
function pbr(mat,id,o={}){
  const base=`${PH}/Textures/jpg/1k/${id}/${id}_`;
  const prep=t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(o.repeat) t.repeat.set(o.repeat[0],o.repeat[1]);};
  texLoader.load(base+"diff_1k.jpg",t=>{t.colorSpace=THREE.SRGBColorSpace;prep(t);mat.map=t;mat.color.set(o.tint??0xffffff);mat.needsUpdate=true;});
  texLoader.load(base+"nor_gl_1k.jpg",t=>{prep(t);mat.normalMap=t;mat.needsUpdate=true;});
  if(o.rough) texLoader.load(base+"rough_1k.jpg",t=>{prep(t);mat.roughnessMap=t;mat.roughness=1;mat.needsUpdate=true;});
  return mat;
}
/* a model's shape file sits in the folder of its largest size; most go up to 8k, these stop at 4k */
const BIN_RES={grass_medium_02:"4k",shrub_03:"4k",stationery_supplies:"4k"};
const assetManager=new THREE.LoadingManager();
assetManager.setURLModifier(url=>{
  let m=url.match(/Models\/gltf\/1k\/([^/]+)\/textures\/(.+)$/);if(m) return `${PH}/Models/jpg/1k/${m[1]}/${m[2]}`;
  m=url.match(/Models\/gltf\/1k\/([^/]+)\/([^/]+\.bin)$/);if(m) return `${PH}/Models/gltf/${BIN_RES[m[1]]||"8k"}/${m[1]}/${m[2]}`;
  return url;
});
const gltfLoader=new GLTFLoader(assetManager),modelInfo={};
function model(id,cb,sizes=["8k","4k","2k","1k"]){
  /* a model's shape file sits in the folder of its largest size, which differs from model to model: try them in turn */
  if(!BIN_RES[id]||sizes.length<4) BIN_RES[id]=sizes[0];
  gltfLoader.load(`${PH}/Models/gltf/1k/${id}/${id}_1k.gltf`,g=>{
    g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const b=new THREE.Box3().setFromObject(g.scene);
    modelInfo[id]={min:b.min.toArray().map(v=>+v.toFixed(3)),max:b.max.toArray().map(v=>+v.toFixed(3))};
    cb(g.scene);
  },undefined,()=>{if(sizes.length>1) model(id,cb,sizes.slice(1)); else console.warn("model not loaded:",id);});
}
/* plants: their leaves are flat cards, cut to shape by a separate black-and-white cut-out picture */
function plant(id,cb){
  model(id,m=>{
    texLoader.load(`${PH}/Models/jpg/1k/${id}/${id}_alpha_1k.jpg`,a=>{
      a.flipY=false;
      m.traverse(o=>{if(o.isMesh){const mt=o.material;mt.alphaMap=a;mt.alphaTest=.35;mt.transparent=false;mt.depthWrite=true;mt.side=THREE.DoubleSide;mt.alphaToCoverage=true;mt.needsUpdate=true;}});
      cb(m);
    });
  });
}
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:4}));
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(4,4),.26,.45,1.15));
composer.addPass(new OutputPass());
const VOFF=()=>camera.aspect<1?.1:.075;
let writingDesk,deskLight;
function resize(){
  const w=window.innerWidth,h=window.innerHeight;
  if(!w||!h) return;
  renderer.setSize(w,h,false);composer.setSize(w,h);
  camera.aspect=w/h;camera.fov=camera.aspect<1?60:45;camera.setViewOffset(w,h,0,-Math.round(h*VOFF()),w,h);camera.updateProjectionMatrix();
  writingDesk?.frame(camera.aspect);
}
window.addEventListener("resize",resize);resize();

/* =====================================================================
   BUILDING BLOCKS
   ===================================================================== */
const M=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:o.r??.8,metalness:o.m??0,envMapIntensity:o.env??.25,emissive:o.e??0,emissiveIntensity:o.ei??1});
const E=(color,ei=1.5)=>new THREE.MeshStandardMaterial({color:0,emissive:color,emissiveIntensity:ei,roughness:1,envMapIntensity:0});
function bx(x0,x1,y0,y1,z0,z1,mat,o={}){
  const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),mat);
  m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  m.castShadow=o.cast!==false;m.receiveShadow=o.recv!==false;
  if(o.tile){
    const uv=m.geometry.attributes.uv,w=x1-x0,h=y1-y0,d=z1-z0,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let i=0;i<24;i++){const f=dims[i>>2];uv.setXY(i,uv.getX(i)*f[0]/o.tile,uv.getY(i)*f[1]/o.tile);}
  }
  (o.parent||world).add(m);return m;
}
function cyl(r0,r1,h,mat,x,y,z,seg=20,parent=world){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function beam(p0,p1,r,mat,parent=world){
  const d=p1.clone().sub(p0),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),mat);
  m.position.copy(p0).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(UP,d.normalize());m.castShadow=true;parent.add(m);return m;
}
function rr(g,x,y,w,h,r,fill,stroke){
  g.beginPath();
  if(g.roundRect) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h);
  if(fill){g.fillStyle=fill;g.fill();}
  if(stroke){g.strokeStyle=stroke;g.lineWidth=3;g.stroke();}
}
function canvasTex(w,h,draw){
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const g=c.getContext("2d"),tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  return {tex,c,g,redraw:()=>{draw(g,w,h);tex.needsUpdate=true;}};
}
const FONT="system-ui,-apple-system,'Segoe UI',sans-serif",MONO="ui-monospace,Menlo,Consolas,monospace";
const measure=document.createElement("canvas").getContext("2d");
/* text sprite: dark pill with text, always faces the camera */
function textSprite(text,size,o={}){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,depthTest:o.depthTest!==false}));
  sp.userData.set=txt=>{
    if(o.plain){
      const [main,subt]=String(txt).split("|");
      measure.font=`800 60px ${FONT}`;const w1=measure.measureText(main).width;
      measure.font=`700 38px ${FONT}`;const w2=subt?measure.measureText(subt).width:0;
      const W=Math.ceil(Math.max(w1,w2))+90,H=subt?172:116;
      const ct=canvasTex(W,H,g=>{
        g.clearRect(0,0,W,H);g.textAlign="center";g.textBaseline="middle";
        g.font=`800 60px ${FONT}`;g.lineJoin="round";g.strokeStyle="rgba(8,26,60,.9)";g.lineWidth=10;g.strokeText(main,W/2,60);
        g.shadowColor="rgba(8,26,60,.9)";g.shadowBlur=18;g.fillStyle="#fff";
        g.fillText(main,W/2,60);g.shadowBlur=8;g.fillText(main,W/2,60);
        if(subt){g.font=`700 38px ${FONT}`;g.lineWidth=8;g.strokeText(subt,W/2,128);g.fillStyle="#bfe9ff";g.fillText(subt,W/2,128);}
      });
      ct.redraw();
      if(sp.material.map) sp.material.map.dispose();
      sp.material.map=ct.tex;sp.material.needsUpdate=true;sp.scale.set(size*W/104,size*H/104,1);
      return;
    }
    measure.font=`800 60px ${FONT}`;
    const W=Math.ceil(measure.measureText(txt).width)+64,H=104;
    const ct=canvasTex(W,H,(g)=>{
      g.clearRect(0,0,W,H);
      rr(g,3,3,W-6,H-6,34,o.bg||"rgba(8,12,26,.82)",o.border||"rgba(255,255,255,.28)");
      g.fillStyle=o.color||"#e6ecff";g.font=`800 60px ${FONT}`;g.textAlign="center";g.textBaseline="middle";g.fillText(txt,W/2,H/2+3);
    });
    ct.redraw();
    if(sp.material.map) sp.material.map.dispose();
    sp.material.map=ct.tex;sp.material.needsUpdate=true;sp.scale.set(size*W/H,size,1);
  };
  sp.userData.set(text);
  return sp;
}
const labels=[];
function label(key,x,y,z,size,o={plain:true}){
  const sp=textSprite(ui.labels[key],size,o);sp.position.set(x,y,z);world.add(sp);labels.push({sp,key});return sp;
}
function glowTex(){
  const ct=canvasTex(128,128,(g)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.35,"rgba(255,255,255,.35)");gr.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=gr;g.fillRect(0,0,128,128);});
  ct.redraw();return ct.tex;
}
const GLOW=glowTex();
/* the opening screen's little 3D model of the whole trip (see intro.js) */
const introFx=createIntro(scene,GLOW,ui);
let introOn=true;
/* the ride inside the cable (see tunnel.js): it shows whenever the camera is there */
const tunnelFx=createTunnel(scene,GLOW);
let tunnelFov=0,tunnelSpeed=1,dayK=1;
const tappables=[],placed={};
function tap(obj,can,fn){obj.traverse(o=>{if(o.isMesh){o.userData.can=can;o.userData.tap=fn;tappables.push(o);}});}
const stopTap=i=>[()=>current===i&&!done&&!busy,()=>mainAction()];

/* =====================================================================
   SKY + LIGHT
   ===================================================================== */
const skyGroup=new THREE.Group();scene.add(skyGroup);
{
  const st=canvasTex(8,512,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h);
    [[0,"#1554c0"],[.25,"#2b78e0"],[.42,"#5aa2ef"],[.497,"#c4e2fb"],[.503,"#bcd9f3"],[.514,"#b9d3ea"],[1,"#b9d3ea"]].forEach(s=>gr.addColorStop(s[0],s[1]));
    g.fillStyle=gr;g.fillRect(0,0,w,h);
  });st.redraw();
  const horizon=new THREE.Mesh(new THREE.SphereGeometry(1300,32,24),new THREE.MeshBasicMaterial({map:st.tex,side:THREE.BackSide,fog:false,depthWrite:false}));
  horizon.renderOrder=-101;skyGroup.add(horizon);
  const pos=[];
  for(let i=0;i<900;i++){const a=Math.random()*Math.PI*2,e=.12+Math.random()*1.4;pos.push(Math.cos(a)*Math.cos(e)*1200,Math.sin(e)*1200,Math.sin(a)*Math.cos(e)*1200);}
  const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  skyGroup.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,fog:false,transparent:true,opacity:0,depthWrite:false})));
  createClouds(skyGroup);
}

const hemi=new THREE.HemisphereLight(0xcfe3ff,0x7d8a66,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3df,3);
const SUN_DIR=V(1,.32,-.25).normalize();
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
sun.shadow.camera.near=1;sun.shadow.camera.far=320;
scene.add(sun,sun.target);
let shadowExt=0;
function setShadowExt(e){if(e===shadowExt) return;shadowExt=e;const c=sun.shadow.camera;c.left=c.bottom=-e;c.right=c.top=e;c.updateProjectionMatrix();}
const fill=new THREE.PointLight(0xcfe0ff,0,60,1.6);scene.add(fill);

const ZONES={
  tunnel:{fog:0x04123f,den:0,sun:0,hemi:.4,fill:0,exp:1.05,env:.2},
  intro:{fog:0x060a1c,den:.014,sun:1.1,hemi:.75,fill:0,exp:1.02,env:.55},
  out:{fog:0xb9d3ea,den:.0026,sun:1.9,hemi:1.5,fill:0,exp:.95,env:.6},
  room:{fog:0xb9d3ea,den:.0026,sun:.55,hemi:1.25,fill:0,exp:.92,env:.5},
  sea:{fog:0x10313d,den:.064,sun:.16,hemi:.80,fill:30,exp:1.10,env:.29},
  dc:{fog:0x070a12,den:.011,sun:0,hemi:.6,fill:34,exp:1.05,env:.32},
  model:{fog:0x07061c,den:.009,sun:0,hemi:.7,fill:26,exp:1.05,env:.3},
  space:{fog:0x020617,den:0,sun:2.6,hemi:.5,fill:0,exp:1.05,env:.08}
};
const zoneCur={fog:new THREE.Color(0xb9d3ea),den:.0026,sun:.55,hemi:1.25,fill:0,exp:.92,env:.5};
const zoneCol=new THREE.Color();
function zoneOf(p){
  if(p.x<-2500) return "tunnel";
  if(p.x<-900) return "intro";
  if(p.x>1900) return "space";
  if(p.x>900) return "model";
  if(p.x>300.3&&p.x<400&&Math.abs(p.z)<25&&p.y<5) return "dc";
  if(p.y<-.15&&p.x>130&&p.x<250) return "sea";
  if(Math.abs(p.x)<2.05&&Math.abs(p.z)<2.05&&p.y<2.6) return "room";
  return "out";
}

/* =====================================================================
   WORLD: ground, sea, house
   ===================================================================== */
const updateWater=coastalWater(world,SUN_DIR);
const inlandFiberPoints=[[43,.1,-7],[55,.1,-3.2],[70,.1,-1.6],[80,.1,-3.6],[90,.1,-3.4],[100,.1,0],[112,.1,0],[120,.12,0]];
{
  landGround(landscape,[[-85,430],[475,450]]);
  /* trees + far hills */
  /* fir trees built from real twig and bark photos (see nature.js) */
  const spots=[];
  let forestSeed=3099;
  const forestRand=()=>((forestSeed=(Math.imul(forestSeed,1664525)+1013904223)>>>0)/4294967296);
  while(spots.length<300){
    const land2=forestRand()<.3,x=land2?252+forestRand()*190:-60+forestRand()*186,z=(forestRand()-.5)*190,s=.7+forestRand()*.9;
    if(Math.abs(z)<11||Math.abs(z)>55) continue;
    if(x>296&&x<404&&Math.abs(z)<31) continue;
    if(inCottageParcel(x,z)) continue;
    if(Math.hypot(x-42,z+8)<11) continue;           /* keep the cell tower's fenced yard clear */
    spots.push({x,z,s,rot:forestRand()*6.28});
  }
  createForest(landscape,spots);
  /* undergrowth: real grass, ferns, shrubs and mossy rocks (Poly Haven, CC0), scattered where the camera goes */
  {
    let seed=99;const R=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    const serviceRoute=new THREE.CatmullRomCurve3(inlandFiberPoints.map(v3),false,"catmullrom",.4).getSpacedPoints(78);
    const clear=(x,z)=>!inCottageParcel(x,z)&&!serviceRoute.some(p=>Math.abs(x-p.x)<2 && z>p.z-1.15 && z<p.z+3.1)&&!(x>34.4&&x<49.6&&z>-16.6&&z<-3)&&!(x>260&&x<302&&Math.abs(z)<15.5)&&!(Math.abs(x)<2.5&&Math.abs(z)<2.5)&&!(x>296&&x<404&&Math.abs(z)<31)&&!(x>127&&x<253);
    const ring=(n,cx,cz,r0,r1)=>{const out=[];let tries=0;while(out.length<n&&tries++<n*30){const a=R()*6.283,r=r0+(r1-r0)*Math.sqrt(R()),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(clear(x,z)) out.push({x,z,rot:R()*6.28});}return out;};
    const spread=(n,lo,hi)=>[...ring(n*.5,42,-8,1.2,26),...ring(n*.28,14,0,3.5,24),...ring(n*.22,280,2,3,20)].map(q=>({...q,s:lo+R()*(hi-lo)}));
    plant("grass_medium_02",m=>scatter(landscape,m,spread(380,1.5,2.8),{cast:false,maxTris:1800}));
    plant("fern_02",m=>scatter(landscape,m,spread(90,1.1,2)));
    plant("shrub_03",m=>scatter(landscape,m,spread(60,1.2,2.2)));
    /* mossy rocks, one at each spot */
    model("rock_moss_set_01",m=>scatter(landscape,m,[[24,-22],[60,-19],[58,9],[26,12],[12,-17],[-9,14],[254,-19],[256,20],[84,-24],[100,13],[33,-2],[51,-12],[70,6],[18,-9],[8,12],[90,-9]].map(([x,z])=>({x,z,rot:R()*6.28,s:.6+R()*.7,y:-.12})),{maxTris:11500}));
    /* gravel inside the fenced yard */
    const gv=canvasTex(256,256,(g,w,h)=>{g.fillStyle="#8d8a84";g.fillRect(0,0,w,h);for(let i=0;i<5200;i++){const v=90+Math.floor(R()*110);g.fillStyle=`rgb(${v},${v-3},${v-8})`;const r=1+R()*2.6;g.beginPath();g.ellipse(R()*w,R()*h,r,r*(.6+R()*.4),R()*3,0,7);g.fill();}});
    gv.redraw();gv.tex.wrapS=gv.tex.wrapT=THREE.RepeatWrapping;gv.tex.repeat.set(9,8);
    const yard=new THREE.Mesh(new THREE.PlaneGeometry(14,12.4),new THREE.MeshStandardMaterial({map:gv.tex,bumpMap:gv.tex,bumpScale:.6,roughness:.97,envMapIntensity:.08}));
    yard.rotation.x=-Math.PI/2;yard.position.set(42,.012,-9.8);yard.receiveShadow=true;landscape.add(yard);
  }
  distantRidges(landscape,[[-40,-190,90,26],[70,210,110,30],[180,-240,120,34],[330,230,130,30],[430,-210,120,28],[-120,160,100,24]]);
}

/* a town at each end of the trip (see city.js) */
createCity(landscape,[[-70,112,-150,-58],[-70,112,58,150],[256,440,-160,-64],[256,440,64,160]]);

/* phone screen */
let phoneState={mode:"draft",bits:null,words:[]};
let thumbPress=0,tapFx=0;
function drawPhone(g,w,h,photo=false,press=thumbPress){
  paintPhone(g,w,h,ui,phoneState,photo,press,tapFx);
}
const phoneTex=canvasTex(phoneLayout.width*2,phoneLayout.height*2,drawPhone);
let photoGrip,hand,wifiLabel;
function redrawPhone(){
  if(photoGrip?.ready) photoGrip.redraw(thumbPress);
  else phoneTex.redraw();
}
function setThumb(p){
  thumbPress=p;
  if(photoGrip?.ready) photoGrip.redraw(p);
  else { hand?.pose(p); phoneTex.redraw(); }
}
{
  const wall=pbr(M(0xd8d0c2,{r:.95}),"beige_wall_001",{tint:0xe6ddcf});
  const floorM=pbr(M(0x8a6748,{r:.85,env:.15}),"laminate_floor_02");
  const WT={tile:2};
  bx(-2.15,2.15,-.12,0,-2.15,2.15,floorM,{tile:1.6});
  bx(-2.15,2.15,2.6,2.75,-2.15,2.15,wall,WT);
  bx(-2.15,-2,0,2.6,-2.15,2.15,wall,WT);
  bx(-2,2,0,2.6,-2.15,-2,wall,WT);bx(-2,2,0,2.6,2,2.15,wall,WT);
  bx(2,2.15,0,1,-2.15,2.15,wall,WT);bx(2,2.15,2.1,2.6,-2.15,2.15,wall,WT);
  /* the opening in that wall is a window: sill, frame, bars and glass, so it reads as a room looking out at the tower */
  {
    const fr=M(0xf1efe9,{r:.55,env:.3}),glass=new THREE.MeshStandardMaterial({color:0xd6ecff,transparent:true,opacity:.1,roughness:.04,metalness:0,envMapIntensity:1.4,depthWrite:false});
    bx(2.04,2.1,1.02,1.06,-2,2,fr,{cast:false});bx(2.04,2.1,2.06,2.1,-2,2,fr,{cast:false});
    [-2,-1,-.33,.33,1,2].forEach(z=>bx(2.04,2.1,1.02,2.1,z-.022,z+.022,fr,{cast:false}));
    bx(2.055,2.085,1.72,1.75,-2,2,fr,{cast:false});                     /* cross bar */
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(4,1.04),glass);pane.rotation.y=-Math.PI/2;pane.position.set(2.07,1.56,0);pane.renderOrder=2;world.add(pane);
  }
  bx(2,2.15,1,2.1,-2.15,-.75,wall,WT);bx(2,2.15,1,2.1,.75,2.15,wall,WT);
  writingDesk=createWritingDesk(world,pmrem);
  const roofTile=pbr(M(0x9e6349,{r:.91}),"clay_roof_tiles_02",{tint:0xcdb89f});
  createHomeDetails(world,roofTile,writingDesk.woodMap);
  writingDesk.frame(camera.aspect);
  /* Warm window-side fill shapes the stoneware and casts the desk objects' shadows. */
  const key=new THREE.SpotLight(0xffd9b0,1.7,6,.82,.94,2);key.position.set(1.45,1.57,-.94);key.target.position.set(1.84,.84,.015);
  key.castShadow=true;key.shadow.intensity=.38;key.shadow.mapSize.set(2048,2048);key.shadow.camera.near=.4;key.shadow.camera.far=4.5;key.shadow.bias=-.0002;key.shadow.normalBias=.0012;
  world.add(key,key.target);deskLight=key;
  wifiLabel=label("wifi",1.87,.95,.27,.034);
  /* phone */
  const outer=new THREE.Group();outer.position.set(1.5,.88,0);outer.rotation.y=-Math.PI/2;world.add(outer);
  const inner=new THREE.Group();inner.position.y=.08;inner.rotation.x=-.2;outer.add(inner);
  const phoneBody=new THREE.Group();inner.add(phoneBody);
  const slabShape=(W,H,R)=>{const sh=new THREE.Shape(),x=W/2,y=H/2;sh.moveTo(-x+R,-y);sh.lineTo(x-R,-y);sh.absarc(x-R,-y+R,R,-Math.PI/2,0);sh.lineTo(x,y-R);sh.absarc(x-R,y-R,R,0,Math.PI/2);sh.lineTo(-x+R,y);sh.absarc(-x+R,y-R,R,Math.PI/2,Math.PI);sh.lineTo(-x,-y+R);sh.absarc(-x+R,-y+R,R,Math.PI,Math.PI*1.5);return sh;};
  const frame=M(0xc4c2bd,{m:1,r:.16,env:1.7}); /* polished steel band */
  const bodyG=new THREE.ExtrudeGeometry(slabShape(.0738,.156,.0118),{depth:.0066,bevelEnabled:true,bevelThickness:.0014,bevelSize:.0012,bevelSegments:8,curveSegments:28});bodyG.translate(0,0,-.0033);
  const body=new THREE.Mesh(bodyG,frame);body.castShadow=true;phoneBody.add(body);
  [[.0379,.014,.036],[-.0379,.044,.051],[-.0379,.022,.036],[-.0379,.004,.018]].forEach(([x,y0,y1])=>bx(x-.0006,x+.0006,y0,y1,-.0015,.0015,frame,{parent:phoneBody,cast:false}));
  const SW=.0722,SH=.1544,scrG=new THREE.ShapeGeometry(slabShape(SW,SH,.0106),20),uv=scrG.attributes.uv,ps=scrG.attributes.position;
  for(let i=0;i<uv.count;i++) uv.setXY(i,ps.getX(i)/SW+.5,ps.getY(i)/SH+.5);
  const phoneScreen=new THREE.Mesh(scrG,new THREE.MeshBasicMaterial({map:phoneTex.tex,color:0xf0f0f0,toneMapped:false}));
  phoneScreen.position.z=.00485;phoneBody.add(phoneScreen);
  addPhoneHardware(phoneBody,frame);
  photoGrip=createPhotoGrip(inner,drawPhone,{onReady:()=>{
    phoneScreen.visible=false;
    // Fit the physical rear and side rails just inside the photographed bezel.
    phoneBody.scale.set(1.085,.995,1);
    phoneBody.position.z=-.0015;
    redrawPhone();
  },onError:()=>{
    const grip=new THREE.Group();
    grip.position.set((phoneLayout.send.x/phoneLayout.width-.5)*SW-HP.thumbDown[0],
      (.5-phoneLayout.send.y/phoneLayout.height)*SH-HP.thumbDown[1],0);
    inner.add(grip);
    hand=createHand(grip);
    hand.pose(thumbPress);
  }});
  function canTapPhone(uv){
    if(done || busy || (current!==0 && current!==HOME)) return false;
    if(current===HOME) return true;
    const {width,height,send}=phoneLayout;
    return Math.hypot(uv.x*width-send.x,(1-uv.y)*height-send.y)<=send.radius+15;
  }
  tap(phoneScreen,uv=>!photoGrip.ready && canTapPhone(uv),mainAction);
  tap(photoGrip.screen,uv=>photoGrip.ready && canTapPhone(uv),mainAction);
}

/* =====================================================================
   WORLD: tower, cables, DNS, routers
   ===================================================================== */
let beacon,towerCab;
{
  const steel=M(0x8b929c,{m:.7,r:.5,env:.7}),tw=new THREE.Group();tw.position.set(42,0,-8);world.add(tw);
  const hw=h=>2.2-1.7*h/28,corner=(h,i)=>V([1,1,-1,-1][i]*hw(h),h,[1,-1,-1,1][i]*hw(h));
  for(let i=0;i<4;i++){
    beam(corner(0,i),corner(28,i),.09,steel,tw);
    for(let l=0;l<7;l++){beam(corner(l*4+4,i),corner(l*4+4,(i+1)%4),.04,steel,tw);beam(corner(l*4,i),corner(l*4+4,(i+1)%4),.035,steel,tw);}
  }
  cyl(.09,.09,5.4,steel,0,28.6,0,16,tw);
  buildTowerHardware(tw);
  beacon=new THREE.Mesh(new THREE.SphereGeometry(.2,12,12),E(0xff3b3b,4));beacon.position.set(0,31.5,0);tw.add(beacon);
  const vent=E(0xffb84a,.1),cl=new THREE.PointLight(0xffb84a,0,9,2);cl.position.set(44.9,1.3,-4.2);world.add(cl);
  bx(44.3,45.5,0,1.8,-5.9,-5,M(0x7c848e,{r:.7,m:.25,env:.3}));bx(45.7,46.5,0,1.3,-5.8,-5.1,M(0x727a85,{r:.7,m:.25,env:.3}));
  [.45,.7,.95,1.2,1.45].forEach(y=>bx(44.42,45.38,y,y+.11,-5.0,-4.985,vent,{cast:false}));
  towerCab={m:vent,l:cl};
  /* ---- the tower's working parts: footings, antennas, dishes, ladder, cables, railing ---- */
  {
    const grey=M(0x6f7780,{m:.6,r:.5,env:.6}),blk=M(0x15171b,{r:.7,env:.2}),conc=M(0x9b9a95,{r:.96,env:.05});
    for(let i=0;i<4;i++){const c=corner(0,i);bx(c.x-.5,c.x+.5,0,.32,c.z-.5,c.z+.5,conc,{parent:tw});bx(c.x-.2,c.x+.2,.32,.4,c.z-.2,c.z+.2,grey,{parent:tw,cast:false});}
    [-.42,-.5,-.58].forEach(x=>beam(V(x,.1,2.16),V(x*.5,25.6,.66),.028,blk,tw));
    /* safety railing round the top platform */
    [.55,1.05].forEach(h=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(1.08,.028,6,32),grey);ring.rotation.x=Math.PI/2;ring.position.y=26.26+h;tw.add(ring);});
    for(let k=0;k<8;k++){const a=k*.785;cyl(.024,.024,1.05,grey,Math.cos(a)*1.08,26.78,Math.sin(a)*1.08,6,tw);}
  }
  /* ---- the equipment cabinet at the foot of the tower ---- */
  {
    const conc=M(0x9b9a95,{r:.96,env:.05}),grey=M(0x5d646d,{m:.6,r:.5,env:.5}),cap=M(0xc4cad3,{r:.7,env:.2}),blk=M(0x15171b,{r:.7,env:.2});
    bx(43.85,46.85,0,.1,-6.3,-4.55,conc);
    bx(44.24,45.56,1.8,1.87,-5.96,-4.93,cap);bx(45.65,46.55,1.3,1.36,-5.86,-5.03,cap);
    /* double doors: seam, frame, hinges, handle */
    bx(44.893,44.907,.16,1.74,-5.0,-4.993,blk,{cast:false});
    [[44.34,44.36,.14,1.76],[45.44,45.46,.14,1.76],[44.34,45.46,.14,.16],[44.34,45.46,1.74,1.76]].forEach(([x0,x1,y0,y1])=>bx(x0,x1,y0,y1,-5.0,-4.992,grey,{cast:false}));
    [.35,.95,1.55].forEach(y=>{cyl(.018,.018,.11,grey,44.33,y,-4.985,8);cyl(.018,.018,.11,grey,45.47,y,-4.985,8);});
    bx(44.93,44.96,.82,1.08,-4.99,-4.95,grey);bx(44.84,44.87,.82,1.08,-4.99,-4.95,grey);
    /* warning sign and status lights */
    const sign=canvasTex(128,96,(g,w,h)=>{g.fillStyle="#f6c61c";g.fillRect(0,0,w,h);g.strokeStyle="#111";g.lineWidth=6;g.strokeRect(4,4,w-8,h-8);g.beginPath();g.moveTo(64,16);g.lineTo(102,78);g.lineTo(26,78);g.closePath();g.lineWidth=7;g.lineJoin="round";g.stroke();g.fillStyle="#111";g.fillRect(60,36,8,24);g.fillRect(60,65,8,8);});
    sign.redraw();
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(.24,.18),new THREE.MeshStandardMaterial({map:sign.tex,roughness:.6,envMapIntensity:.2}));sg.position.set(45.18,1.52,-4.981);world.add(sg);
    [0x4ade80,0x4ade80,0xffb84a].forEach((c,k)=>{const l=bx(44.46+k*.07,44.5+k*.07,1.6,1.64,-4.992,-4.98,E(c,3),{cast:false});l.userData.blink=k+7;});
    /* the smaller box: a fan grille on its front */
    const fan=canvasTex(128,128,(g,w,h)=>{g.fillStyle="#8d95a1";g.fillRect(0,0,w,h);g.fillStyle="#1b1e24";g.beginPath();g.arc(64,64,52,0,7);g.fill();g.strokeStyle="#8d95a1";g.lineWidth=5;for(let r=10;r<52;r+=10){g.beginPath();g.arc(64,64,r,0,7);g.stroke();}g.lineWidth=6;g.beginPath();g.moveTo(8,64);g.lineTo(120,64);g.moveTo(64,8);g.lineTo(64,120);g.stroke();});
    fan.redraw();
    const fg=new THREE.Mesh(new THREE.PlaneGeometry(.52,.52),new THREE.MeshStandardMaterial({map:fan.tex,roughness:.7,metalness:.3,envMapIntensity:.3}));fg.position.set(46.1,.78,-5.095);world.add(fg);
    /* conduits: cabinet to cabinet, cabinet to the tower leg, and down into the ground */
    beam(V(45.5,.45,-5.5),V(45.7,.45,-5.5),.05,grey);beam(V(45.5,.95,-5.5),V(45.7,.95,-5.5),.035,blk);
    [-5.72,-5.62,-5.52].forEach(z=>beam(V(44.3,1.45,z),V(44.14,2.2,z-.18),.028,blk));
    cyl(.06,.06,.5,grey,46.62,.25,-5.45,10);beam(V(46.5,.5,-5.45),V(46.62,.5,-5.45),.06,grey);
  }
  dressTowerCabinet(world);
  /* ---- chain-link fence round the back and sides of the yard ---- */
  {
    const link=canvasTex(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle="#b9bec6";g.lineWidth=3.2;g.beginPath();for(let k=-64;k<=64;k+=32){g.moveTo(k,0);g.lineTo(k+64,64);g.moveTo(k+64,0);g.lineTo(k,64);}g.stroke();});
    link.redraw();link.tex.wrapS=link.tex.wrapT=THREE.RepeatWrapping;
    const post=M(0x8f969f,{m:.7,r:.45,env:.6});
    const run=(x0,z0,x1,z1)=>{
      const len=Math.hypot(x1-x0,z1-z0),t=link.tex.clone();t.needsUpdate=true;t.repeat.set(len/.22,2/.22);
      const mat=new THREE.MeshStandardMaterial({map:t,alphaTest:.3,side:THREE.DoubleSide,metalness:.7,roughness:.4,envMapIntensity:.7});mat.alphaToCoverage=true;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(len,2),mat);m.position.set((x0+x1)/2,1.02,(z0+z1)/2);m.rotation.y=-Math.atan2(z1-z0,x1-x0);m.castShadow=true;world.add(m);
      const n=Math.round(len/2.4);for(let k=0;k<=n;k++){const u=k/n;cyl(.045,.045,2.2,post,x0+(x1-x0)*u,1.1,z0+(z1-z0)*u,8);}
      beam(V(x0,2.05,z0),V(x1,2.05,z1),.03,post);
    };
    run(35,-16,49,-16);run(35,-16,35,-3.6);run(49,-16,49,-3.6);
  }
  label("tower",42,33.4,-8,1.5);
  tap(tw,...stopTap(1));
}
/* a real cable with light inside: it has a body that takes the daylight, and only glows strongly in the dark */
const cableMat=new THREE.MeshStandardMaterial({color:0x16384a,emissive:0x35d6ff,emissiveIntensity:1.5,roughness:.45,metalness:.2,envMapIntensity:.5});
const curves=[];
const seaCableMat=armouredCableMaterial();
function cable(points,r=.07,mat=cableMat,rad=6){
  const c=new THREE.CatmullRomCurve3(points.map(v3),false,"catmullrom",.4);
  const geometry=new THREE.TubeGeometry(c,Math.max(40,points.length*14),r,rad);
  if(mat===seaCableMat) geometry.computeTangents();
  const m=new THREE.Mesh(geometry,mat);world.add(m);curves.push(c);return c;
}
cableCorridor(world,cable(inlandFiberPoints));
const seaCableRadius=.15, seaRepeaterStops=[.3,.5,.7];
const seaCurves=[-7,0,7].map(zk=>{
  const pts=[[120,.12,0],[126,.12,zk*.08]];
  for(let x=130;x<=250;x+=6){const s=Math.sin(Math.PI*(x-130)/120);pts.push([x,seaY(x)+.13,zk*(.15+.85*s)]);}
  pts.push([256,.12,zk*.08],[262,.12,0]);
  return cable(pts,seaCableRadius,seaCableMat,14);
});
// The exposed verge ends at the paved campus entrance.
cableCorridor(world,cable([[262,.12,0],[280,.1,0],[300,.08,0],[313.2,.06,0]]),6);
const pulses=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,8,8),E(0xffd27a,3.6),curves.length*7);world.add(pulses);
label("fiber",108,1.5,-.4,.7);
let seaLabel,speedLabel;
{
  const cab=M(0x55606a,{r:.6,m:.3,env:.5}),routerGroups=[];
  [[62,-3.4],[104,1.6],[278,1.8]].forEach(([x,z],i)=>{
    const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
    bx(-.5,.5,0,1.4,-.32,.32,cab,{parent:g});bx(-.56,.56,1.4,1.46,-.38,.38,cab,{parent:g});
    const sp=textSprite(ui.labels.router,.6,{plain:true});sp.position.set(x,2.2,z);world.add(sp);labels.push({sp,key:"router"});
    if(i===1) tap(g,...stopTap(2));
    dressRoadsideNode(world,x,z);
    routerGroups.push(g);
  });
  model("utility_box_01",m=>{routerGroups.forEach(g=>{g.children.forEach(c=>{c.visible=false;});const c=m.clone();g.add(c);});placed.box=m;});
  const bunkerM=pbr(M(0x767b82,{r:.9}),"concrete_wall_008");
  [[121,-5.5],[262,-5.5]].forEach(([x,z])=>{bx(x-2.2,x+2.2,0,2.2,z-2.6,z+2.6,bunkerM,{tile:3});dressLandingStation(world,x,z);bx(x-2.21,x+2.21,1.7,1.8,z-2.61,z+2.61,E(0x35d6ff,1.6),{cast:false});});
}
/* DNS directory */
let dnsState={phase:"idle",row:-1};
const dnsTex=canvasTex(1024,683,(g,w,h)=>{
  const s=dnsState,gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,"#06122a");gr.addColorStop(1,"#0a2140");
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  g.textBaseline="middle";g.textAlign="left";
  g.fillStyle="#5fe0ff";g.font=`800 40px ${FONT}`;g.fillText(ui.labels.dnsTitle,48,58);
  g.fillStyle="rgba(95,224,255,.35)";g.fillRect(48,92,w-96,3);
  const found=s.phase==="found";
  g.font=`800 58px ${MONO}`;g.fillStyle=found?"#7dffb0":"#fff";
  g.fillText(s.phase==="idle"?"···":`chatgpt.com → ${found?DNS_ROWS[3][1]:"?"}`,48,160);
  DNS_ROWS.forEach((r,i)=>{
    const y=250+i*68,hot=s.row===i;
    if(hot) rr(g,36,y-30,w-72,60,12,found?"rgba(74,222,128,.28)":"rgba(95,224,255,.22)");
    g.font=`700 36px ${MONO}`;g.fillStyle=hot?(found?"#9dffc4":"#e8f8ff"):"#5c7ba6";
    g.fillText(r[0],60,y);g.fillText("→",520,y);g.fillText(r[1],600,y);
  });
});

/* =====================================================================
   WORLD: data center
   ===================================================================== */
const dataHallFittings=new THREE.Group(),roofHardware=new THREE.Group();
world.add(dataHallFittings,roofHardware);
let secState="idle",tickGate,laser,greenMats=[],chips=[],nums=[],archStrips;
const secTex=canvasTex(640,150,(g,w,h)=>{
  const L=ui.labels,ok=secState==="ok";
  g.fillStyle=ok?"#0b2a1a":"#0a0f1a";g.fillRect(0,0,w,h);
  g.textAlign="center";g.textBaseline="middle";g.font=`800 62px ${FONT}`;
  g.fillStyle=ok?"#7dffb0":secState==="checking"?"#ffc95e":"#cfe0ff";
  g.fillText(ok?L.ok:secState==="checking"?L.checking:"🔒 "+L.guard,w/2,h/2+4);
});
const signTex=canvasTex(1024,150,(g,w,h)=>{
  g.clearRect(0,0,w,h);g.fillStyle="#d4eeff";g.textAlign="center";g.textBaseline="middle";g.font=`900 96px ${FONT}`;
  g.fillText(ui.labels.dc.split("").join(" "),w/2,h/2+6);
});
{
  const fac=pbr(M(0x262d3f,{r:.6,m:.2}),"concrete_wall_008",{tint:0x5d6680}),inw=pbr(M(0x1b2233,{r:.75}),"concrete_wall_008",{tint:0x4a5270}),flo=M(0x0f131c,{r:.2,m:.55,env:1.1}),cyan=E(0x35d6ff,2.2);
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(40,30),pbr(M(0x3b3f47,{r:.9}),"asphalt_02",{rough:true,repeat:[10,7.5]}));apron.rotation.x=-Math.PI/2;apron.position.set(281,-.005,0);apron.receiveShadow=true;world.add(apron);
  /* shell */
  bx(300,300.4,0,12,-25,-2,fac,{tile:5});bx(300,300.4,0,12,2,25,fac,{tile:5});bx(300,300.4,4,12,-2,2,fac,{tile:5});
  bx(399.6,400,0,12,-25,25,fac,{tile:5});bx(300,400,0,12,-25.4,-25,fac,{tile:5});bx(300,400,0,12,25,25.4,fac,{tile:5});bx(300,400,12,12.4,-25.4,25.4,fac,{tile:5});
  bx(300.4,399.6,5,5.3,-25,25,inw,{cast:false,tile:5});
  bx(299.92,300,0,4,-2.16,-2,cyan,{cast:false});bx(299.92,300,0,4,2,2.16,cyan,{cast:false});bx(299.92,300,4,4.16,-2.16,2.16,cyan,{cast:false});
  bx(299.92,300,11.3,11.42,-25,25,cyan,{cast:false});bx(299.92,300,8.2,8.26,-25,25,E(0x35d6ff,.9),{cast:false});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(13,1.9),new THREE.MeshBasicMaterial({map:signTex.tex,transparent:true}));
  sign.rotation.y=-Math.PI/2;sign.position.set(299.9,6.2,0);world.add(sign);
  const cool=new THREE.InstancedMesh(new THREE.BoxGeometry(4,1.6,4),M(0x565d68,{r:.7,m:.3}),27),d=new THREE.Object3D();let n=0;
  for(let x=312;x<=392;x+=10) for(let z=-14;z<=14;z+=14){d.position.set(x,13.2,z);d.updateMatrix();cool.setMatrixAt(n++,d.matrix);}
  cool.castShadow=true;world.add(cool);
  /* ---- the outside of the building: wall ribs, a band of windows, loading doors, roof fans, a yard ---- */
  {
    const rib=M(0x1a2030,{m:.5,r:.45,env:.7}),glassM=M(0x27405c,{m:.7,r:.12,env:1.4}),capM=M(0x3a4254,{m:.6,r:.4,env:.6}),yellow=M(0xf2b619,{r:.6,env:.2}),whiteM=M(0xdfe3e8,{r:.6,env:.3}),darkM=M(0x23272e,{m:.5,r:.5,env:.5});
    for(let z=-25;z<=25;z+=5){
      if(Math.abs(z)>1) bx(299.84,300,0,12,z-.14,z+.14,rib,{cast:false});
      if(z<25) bx(299.9,300,9.1,10.5,z+.34,z+4.66,glassM,{cast:false});
    }
    bx(299.7,300.5,12.4,12.75,-25.5,25.5,capM);
    /* canopy over the entrance */
    bx(298.4,300,4.3,4.5,-3.2,3.2,capM);cyl(.06,.06,4.3,capM,298.5,2.15,-3.05,8);cyl(.06,.06,4.3,capM,298.5,2.15,3.05,8);
    /* two loading doors with ribbed shutters, guarded by yellow posts */
    const shut=canvasTex(64,64,(g,w,h)=>{g.fillStyle="#5f6774";g.fillRect(0,0,w,h);for(let y=0;y<h;y+=8){g.fillStyle="#7b8492";g.fillRect(0,y,w,3);g.fillStyle="#3d444f";g.fillRect(0,y+6,w,2);}});
    shut.redraw();shut.tex.wrapS=shut.tex.wrapT=THREE.RepeatWrapping;shut.tex.repeat.set(1,6);
    const shutM=new THREE.MeshStandardMaterial({map:shut.tex,roughness:.5,metalness:.6,envMapIntensity:.6});
    [-16,16].forEach(z=>{
      const dr=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.2),shutM);dr.rotation.y=-Math.PI/2;dr.position.set(299.93,2.1,z);world.add(dr);
      bx(299.8,300,4.2,4.5,z-2.4,z+2.4,capM,{cast:false});bx(299.8,300,0,4.2,z-2.4,z-2.2,capM,{cast:false});bx(299.8,300,0,4.2,z+2.2,z+2.4,capM,{cast:false});
      [-1.9,-.65,.65,1.9].forEach(dz=>{cyl(.1,.1,1,yellow,298.6,.5,z+dz,10);});
    });
    /* a fan on every roof cooling unit */
    const fanG=new THREE.CylinderGeometry(1.5,1.5,.16,24),fans=new THREE.InstancedMesh(fanG,darkM,27),hubs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.3,.3,.3,12),capM,27),o=new THREE.Object3D();let k=0;
    for(let x=312;x<=392;x+=10) for(let z=-14;z<=14;z+=14){o.position.set(x,14.08,z);o.updateMatrix();fans.setMatrixAt(k,o.matrix);hubs.setMatrixAt(k++,o.matrix);}
    world.add(fans,hubs);
    chillerGuards(roofHardware);
    /* outside yard: a fuel tank and generators for when the power fails, and parking lines */
    [[-13],[13]].forEach(([z])=>{
      const tank=new THREE.Mesh(new THREE.CapsuleGeometry(1.1,4.2,8,20),whiteM);tank.rotation.x=Math.PI/2;tank.position.set(291,1.55,z*1.25);tank.castShadow=true;world.add(tank);
      [-1.5,1.5].forEach(dz=>bx(290.4,291.6,0,.5,z*1.25+dz-.15,z*1.25+dz+.15,darkM));
      [0,1].forEach(i=>{const gx=283-i*5.5;bx(gx-2,gx+2,0,2.1,z*1.25-1.1,z*1.25+1.1,M(0x4b6a52,{r:.6,m:.3,env:.4}));bx(gx-1.7,gx+1.7,2.1,2.3,z*1.25-.9,z*1.25+.9,darkM);cyl(.12,.12,1.2,darkM,gx+1.2,2.9,z*1.25,8);});
    });
    const lines=canvasTex(256,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle="rgba(235,235,225,.85)";for(let x=8;x<w;x+=32) g.fillRect(x,0,3,h);});
    lines.redraw();
    [-9.6,9.6].forEach(z=>{const pl=new THREE.Mesh(new THREE.PlaneGeometry(22,4.6),new THREE.MeshStandardMaterial({map:lines.tex,transparent:true,roughness:.9,depthWrite:false}));pl.rotation.x=-Math.PI/2;pl.position.set(275,.012,z);world.add(pl);});
  }
  facilityEntrance(world);
  model("security_camera_01",m=>{[[304.5,-5.95,0],[304.5,5.95,Math.PI]].forEach(([x,z,r])=>{const c=m.clone();c.position.set(x,4.2,z);c.rotation.y=r;dataHallFittings.add(c);});placed.cam=m;});
  const hallBox=(x0,x1,y0,y1,z0,z1,mat,opts)=>bx(x0,x1,y0,y1,z0,z1,mat,{parent:dataHallFittings,...opts});
  /* lobby */
  hallBox(300.4,318,-.1,.02,-6,6,flo,{cast:false});hallBox(318,399.6,-.1,.02,-25,25,M(0x141922,{r:.3,m:.4,env:.9}),{cast:false});
  hallBox(300.4,318,0,5,-6.2,-6,inw,{cast:false,tile:5});hallBox(300.4,318,0,5,6,6.2,inw,{cast:false,tile:5});
  [[-25,-4.6],[-3,-1.4],[.2,1.8],[3.4,25]].forEach(([a,b])=>hallBox(318,318.3,0,5,a,b,inw,{cast:false,tile:5}));
  const lanes=[-3.8,-.6,2.6];
  lanes.forEach((z,i)=>{
    hallBox(318,318.3,3,5,z-.8,z+.8,inw,{cast:false,tile:5});
    const mat=i===2?E(0x4ade80,.4):E(0xff4d5e,1.6);if(i===2) greenMats.push(mat);
    hallBox(317.9,318,3.05,3.2,z-.7,z+.7,mat,{cast:false});
    const s=hallBox(0,1,.02,.045,-.07,.07,mat,{cast:false}),a=V(314,.03,0),b=V(318.2,.03,z),len=a.distanceTo(b);
    s.scale.x=len;s.position.set((a.x+b.x)/2,.035,(a.z+b.z)/2);s.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
    hallBox(318.2,352,.02,.045,z-.07,z+.07,mat,{cast:false});
  });
  [303,307,311,315].forEach(x=>{hallBox(x-.04,x+.04,.3,4.6,-5.99,-5.95,E(0x3b7bff,1.4),{cast:false});hallBox(x-.04,x+.04,.3,4.6,5.95,5.99,E(0x3b7bff,1.4),{cast:false});});
  [304,309,314].forEach(x=>hallBox(x-1,x+1,4.96,5,-1.2,1.2,E(0xe8f0ff,1.3),{cast:false}));
  /* security arch */
  const arch=new THREE.Group();dataHallFittings.add(arch);
  const am=M(0x1a1f2b,{m:.8,r:.3,env:1});
  hallBox(309.8,310.2,0,3.1,-1.55,-1.25,am,{parent:arch});hallBox(309.8,310.2,0,3.1,1.25,1.55,am,{parent:arch});hallBox(309.8,310.2,3.1,3.45,-1.55,1.55,am,{parent:arch});
  archStrips=E(0x35d6ff,2);
  hallBox(309.78,309.8,.1,3.1,-1.3,-1.25,archStrips,{cast:false});hallBox(309.78,309.8,.1,3.1,1.25,1.3,archStrips,{cast:false});
  laser=hallBox(309.98,310.02,0,.025,-1.25,1.25,E(0x4ade80,5),{cast:false});laser.visible=false;
  const ss=new THREE.Mesh(new THREE.PlaneGeometry(2.9,.68),new THREE.MeshBasicMaterial({map:secTex.tex,color:0xdddddd}));
  ss.rotation.y=-Math.PI/2;ss.position.set(309.78,3.95,0);dataHallFittings.add(ss);
  tap(arch,...stopTap(3));tap(ss,...stopTap(3));
  /* traffic director hub */
  cyl(.9,.9,.06,am,314,.04,0,40,dataHallFittings);
  const hub=new THREE.Mesh(new THREE.TorusGeometry(.9,.03,8,48),E(0xf4a62a,2.6));hub.rotation.x=Math.PI/2;hub.position.set(314,.09,0);dataHallFittings.add(hub);
  /* server hall */
  tickGate=securityVestibule(dataHallFittings,greenMats[0]);
  serviceAisle(dataHallFittings);
  const side=M(0x27323a,{r:.53,m:.42,env:.75});
  const front=rackFront();
  const per=Math.floor((396-322.5)/.86)+1,racks=new THREE.InstancedMesh(new THREE.BoxGeometry(.8,2.3,1.2),[side,side,side,side,rackRear(),front],15*per);
  n=0;
  for(let r=0;r<15;r++) for(let c=0;c<per;c++){
    const x=322.5+c*.86,z=-21.4+3.2*r;
    if(Math.abs(x-GX)<.1&&Math.abs(z-4.2)<.1) continue;
    d.position.set(x,1.15,z);d.rotation.y=r%2?Math.PI:0;d.updateMatrix();racks.setMatrixAt(n++,d.matrix);
  }
  racks.count=n;dataHallFittings.add(racks);
  const strips=new THREE.InstancedMesh(new THREE.BoxGeometry(76,.05,.16),E(0xdfeaff,1.7),14);
  for(let k=0;k<14;k++){d.position.set(360,4.95,-19.8+3.2*k);d.updateMatrix();strips.setMatrixAt(k,d.matrix);}
  dataHallFittings.add(strips);
  /* the open GPU rack */
  const gr=new THREE.Group();dataHallFittings.add(gr);
  hallBox(GX-.4,GX+.4,0,2.3,3.63,4.8,side,{parent:gr,cast:false});
  acceleratorRack(dataHallFittings,GX,chips);
  dataHallFittings.add(label("gpu",GX,1.455,3.50,.085,{bg:"#17252c",color:"#e0e8e2",border:"#829491"}));
  for(let i=0;i<8;i++){const s=textSprite(["0.12","−0.87","0.45","0.91","−0.33","0.08","−0.52","0.67"][i],.07,{bg:"rgba(8,12,26,.6)",color:"#7dffb0",border:"rgba(125,255,176,.4)"});s.visible=false;dataHallFittings.add(s);nums.push(s);}
}

/* =====================================================================
   THE HERO: a sealed envelope of light
   ===================================================================== */
const hero=new THREE.Group(),heroIn=new THREE.Group();hero.add(heroIn);scene.add(hero);
const PAPER_DAY=new THREE.Color(0xb9b09c),PAPER_DARK=new THREE.Color(0xfbf3df);
let heroS=.7,heroVis=0,heroScaleOverride=null,lockOn=0,lockGoal=0,lightOn=0,lightGoal=0,heroDark=0,heroPaper,heroFlap,heroGlow,envelopeHinge;
const lockG=new THREE.Group();
{
  const {body,paper,flap,hinge}=makeEnvelope(heroIn,lockG);
  heroPaper=paper;heroFlap=flap;envelopeHinge=hinge;
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffc04a,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.7}));
  glow.scale.set(.3,.3,1);glow.material.opacity=0;glow.position.z=-.02;heroIn.add(glow);heroGlow=glow;
  tap(body,()=>current!==MODEL&&!done&&!busy,()=>mainAction());
}
const heroLight=new THREE.PointLight(0xffc870,0,0,2);hero.add(heroLight);
const flareT=canvasTex(512,64,(g,w,h)=>{
  g.clearRect(0,0,w,h);const a=g.createLinearGradient(0,0,w,0);a.addColorStop(0,"rgba(255,255,255,0)");a.addColorStop(.5,"rgba(255,255,255,1)");a.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=a;g.fillRect(0,0,w,h);
  const b=g.createLinearGradient(0,0,0,h);b.addColorStop(0,"rgba(0,0,0,1)");b.addColorStop(.5,"rgba(0,0,0,0)");b.addColorStop(1,"rgba(0,0,0,1)");g.globalCompositeOperation="destination-out";g.fillStyle=b;g.fillRect(0,0,w,h);g.globalCompositeOperation="source-over";
});flareT.redraw();
const flare=new THREE.Sprite(new THREE.SpriteMaterial({map:flareT.tex,color:0xffd58a,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));flare.scale.set(.85,.06,1);hero.add(flare);
seaLabel=textSprite(ui.labels.sea,.055,{plain:true});seaLabel.position.set(.5,.2,0);seaLabel.visible=false;hero.add(seaLabel);labels.push({sp:seaLabel,key:"sea"});
speedLabel=textSprite(ui.labels.speed,.07,{plain:true});speedLabel.position.set(-.52,.2,0);speedLabel.material.opacity=0;speedLabel.visible=false;hero.add(speedLabel);labels.push({sp:speedLabel,key:"speed"});
const core=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xfff3d6,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));core.scale.set(.3,.3,1);hero.add(core);
const TRAIL=46,trailPos=new Float32Array(TRAIL*3),trailGeo=new THREE.BufferGeometry();
trailGeo.setAttribute("position",new THREE.BufferAttribute(trailPos,3));
const trail=new THREE.Points(trailGeo,new THREE.PointsMaterial({map:GLOW,color:0xffcf6a,size:.05,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
trail.frustumCulled=false;scene.add(trail);
function heroScaleAt(p){
  if(p.x>900) return 5;
  if(p.x<2.3) return .42;
  if(p.x<9) return .42+5.58*smooth(2.3,9,p.x);
  if(p.x<292) return 6;
  if(p.x<304) return 6-2*smooth(292,304,p.x);
  if(p.x<317) return 4;
  if(p.x<322) return 4-2.4*smooth(317,322,p.x);
  return 1.6;
}
function showHero(v,dur=.45){const a=heroVis;tween(0,dur,p=>{heroVis=a+(v-a)*p;},v?outBack:ease);}

// A radio pulse has a narrow leading crest and fades behind it as it expands.
const radioBand=new THREE.RingGeometry(.94,1.035,112);
function wavefront(color) {
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false});
  material.forceSinglePass=true;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 ringPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nringPoint=position.xy;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 ringPoint;')
      .replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        float r=length(ringPoint);
        float aa=min(.018, fwidth(r));
        float crest=1.-smoothstep(.004,.009+aa,abs(r-1.));
        float wake=smoothstep(.94,.994,r)*(1.-smoothstep(.991,1.021,r));
        diffuseColor.a*=crest+.32*wake;`);
  };
  return new THREE.Mesh(radioBand,material);
}
/* radio rings */
const rings=[];
for(let i=0;i<10;i++){
  const m=wavefront(0x9ddfff);
  m.visible=false;scene.add(m);rings.push({m,life:1,dur:1,max:1});
}
let ringI=0;
function emitRing(pos,dir,max,dur=1.5){const r=rings[ringI++%rings.length];r.m.position.copy(pos);r.m.lookAt(pos.clone().add(dir));r.life=0;r.dur=dur;r.max=max;r.m.visible=true;}

/* radio waves: circles that face the viewer and spread from a glowing point */
const waves=[],waveCore=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd070,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:0}));
waveCore.visible=false;scene.add(waveCore);
for(let i=0;i<10;i++){
  const m=wavefront(0xffa340);
  m.visible=false;scene.add(m);waves.push({m,life:1,dur:1,max:1});
}
let waveI=0,waveOn=0;
function emitWave(pos,max,dur){const r=waves[waveI++%waves.length];r.m.position.copy(pos);r.life=0;r.dur=dur;r.max=max;r.m.visible=true;}

/* packets */
const packets=["#f4a62a","#ff6f91","#4ade80","#b685ff"].map(c=>{
  const g=new THREE.Group(),m=new THREE.Mesh(new RoundedBoxGeometry(.62,.42,.08,2,.04),E(c,2.4));g.add(m);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:c,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.6}));s.scale.set(2.4,2.4,1);g.add(s);
  g.visible=false;scene.add(g);return g;
});

/* =====================================================================
   THE PLANET: shows where the trip goes (its own little scene, far away from the world)
   ===================================================================== */
const GC=V(2000,0,0),GR=10,globe=new THREE.Group();globe.position.copy(GC);globe.visible=false;scene.add(globe);
const ll=(lat,lon,r=GR)=>{const ph=(90-lat)*Math.PI/180,th=(lon+180)*Math.PI/180;return V(-r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph),r*Math.sin(ph)*Math.sin(th));};
function arcPts(a,b,n,lift){
  const A=ll(a[0],a[1],1),B=ll(b[0],b[1],1),ang=A.angleTo(B),sn=Math.sin(ang),out=[];
  for(let i=0;i<=n;i++){const t=i/n;out.push(A.clone().multiplyScalar(Math.sin((1-t)*ang)/sn).addScaledVector(B,Math.sin(t*ang)/sn).multiplyScalar(GR*(1.012+lift*ang*Math.sin(Math.PI*t))));}
  return out;
}
let globeOn=false,webOn=false,gAng=0,routeP=0,webP=0;
const globeLabels=[],gTmp=V(0,0,0),gRight=V(1,0,0);
const HOME_LL=[28.4,-81.5],FAR_LL=[39,-77.5],GDIR=ll(33.5,-75.5,1);
const routeCurve=new THREE.CatmullRomCurve3(arcPts(HOME_LL,FAR_LL,64,.085)),ROUTE_SEG=120;
const routeTube=new THREE.Mesh(new THREE.TubeGeometry(routeCurve,ROUTE_SEG,.05,6),E(0xffc23a,3));
const routePulse=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffe2a0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
let web,spaceStars;
function setRoute(p){routeP=p;routeTube.geometry.setDrawRange(0,Math.floor(ROUTE_SEG*p)*36);}
function setWeb(p){webP=p;web.geometry.setDrawRange(0,Math.floor(web.userData.n*p)*2);}
{
  addEarth(globe,GR);
  routeTube.geometry.setDrawRange(0,0);globe.add(routeTube);
  routePulse.scale.setScalar(1.5);routePulse.visible=false;globe.add(routePulse);
  [[HOME_LL,"you"],[FAR_LL,"dcs"]].forEach(([p,key],i)=>{
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.09,12,12),E(0xffffff,3));dot.position.copy(ll(p[0],p[1],GR*1.014));globe.add(dot);
    const sp=textSprite(ui.labels[key],1.15,{plain:true});sp.material.fog=false;sp.material.depthTest=false;sp.renderOrder=5;sp.userData.anchor=ll(p[0],p[1],GR*1.03);sp.userData.nat=sp.scale.clone();
    const set0=sp.userData.set;sp.userData.set=t=>{set0(t);sp.userData.nat=sp.scale.clone();};
    globe.add(sp);labels.push({sp,key});globeLabels.push(sp);
  });
  const H={ny:[40.7,-74],mia:[25.8,-80.2],hal:[44.6,-63.6],rey:[64.1,-21.9],lon:[50.1,-5.5],lis:[38.7,-9.1],mar:[43.3,5.4],dak:[14.7,-17.4],lag:[6.5,3.4],cpt:[-33.9,18.4],for:[-3.7,-38.5],rio:[-22.9,-43.2],bue:[-34.6,-58.4],pan:[9,-79.5],lim:[-12,-77],la:[34,-118.2],sea:[47.6,-122.3],hon:[21.3,-157.9],tok:[35.6,139.7],hk:[22.3,114.2],sin:[1.35,103.8],syd:[-33.9,151.2],akl:[-36.8,174.8],gum:[13.4,144.8],per:[-32,115.9],mum:[19.1,72.9],che:[13.1,80.3],fuj:[25.1,56.3],dji:[11.6,43.1],mom:[-4,39.7],alx:[31.2,29.9]};
  const L="ny-lon ny-lis hal-lon hal-rey rey-lon ny-mia mia-for mia-pan pan-lim for-rio rio-bue for-lis for-dak dak-lis dak-lag lag-cpt cpt-mom mom-dji dji-alx alx-mar dji-mum fuj-mum mum-che che-sin sin-hk hk-tok sin-per per-syd syd-akl syd-gum gum-tok gum-hon hon-la tok-sea tok-la la-lim akl-hon cpt-for lis-lon lis-lag mia-rio ny-for lon-mar bue-cpt lim-bue sea-la".split(" ");
  const pos=[];
  // Schematic cable paths bend around land and follow straits. Keep their
  // height close to the water, below the highlighted point-to-point journey.
  const via={
    "lon-mar":[[47.9,-7.0],[43.2,-10.4],[36.0,-10.0],[35.9,-5.8],[37.4,1.0]],
    "cpt-mom":[[-35.8,20.4],[-34.9,27.6],[-26.6,35.4],[-15.1,41.2]],
    "mom-dji":[[-1.3,43.2],[8.4,52.8],[12.4,51.9]],
    "dji-alx":[[12.6,43.3],[17.2,40.6],[26.8,34.7],[29.8,32.5],[31.4,32.3]],
    "alx-mar":[[34.7,22.2],[35.7,14.6],[38.9,10.3]],
    "sin-hk":[[1.8,105.1],[8.4,110.1],[16.9,113.2]],
    "fuj-mum":[[24.4,58.2],[20.8,65.8]],
    "la-lim":[[21.4,-111.7],[12.2,-97.2],[4.4,-83.9]],
    "lim-bue":[[-26.4,-75.6],[-46.9,-77.0],[-57.4,-68.3],[-48.8,-61.2]],
    "bue-cpt":[[-38.1,-52.4],[-36.4,-9.0]],
    "akl-hon":[[-27.0,178.4],[-9.0,-171.2]]
  };
  L.forEach(key=>{
    const [a,b]=key.split("-"), waypoints=[H[a],...(via[key]||[]),H[b]];
    for(let leg=1;leg<waypoints.length;leg++){
      const pts=arcPts(waypoints[leg-1],waypoints[leg],26,.003);
      for(let i=0;i<pts.length-1;i++)pos.push(...pts[i].toArray(),...pts[i+1].toArray());
    }
  });
  const wg=new THREE.BufferGeometry();wg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  web=new THREE.LineSegments(wg,new THREE.LineBasicMaterial({color:new THREE.Color(.20,1.35,1.76),transparent:true,opacity:.9,fog:false}));
  web.userData.n=pos.length/6;wg.setDrawRange(0,0);web.visible=false;globe.add(web);
  const ports=new THREE.InstancedMesh(new THREE.SphereGeometry(.041,10,8),E(0x73dce4,1.5),Object.keys(H).length);
  const portPose=new THREE.Matrix4();
  Object.values(H).forEach(([lat,lon],i)=>{portPose.makeTranslation(...ll(lat,lon,GR*1.014).toArray());ports.setMatrixAt(i,portPose);});
  web.add(ports);
  const st=[];for(let i=0;i<700;i++){const v=V(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(300+Math.random()*300);st.push(v.x,v.y,v.z);}
  const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.Float32BufferAttribute(st,3));
  spaceStars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:.85,depthWrite:false}));globe.add(spaceStars);
}
/* cut to the planet ("route" draws the trip, "web" adds every cable) and back to the world */
function showGlobe(mode){
  globeOn=true;webOn=mode==="web";gAng=0;web.visible=webOn;
  if(webOn){setRoute(1);setWeb(0);tween(.3,2.4,p=>setWeb(p));}
  else{setRoute(0);tween(.5,1.8,p=>setRoute(p),ease);}
}
function hideGlobe(){globeOn=false;webOn=false;}

/* =====================================================================
   CENTER STAGE: when the subject is the data itself, the world dims and the data fills the screen
   ===================================================================== */
scene.add(camera);
const veil=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:0x03050c,transparent:true,opacity:0,depthTest:false,depthWrite:false,fog:false}));
veil.position.z=-1;veil.renderOrder=900;veil.visible=false;camera.add(veil);
let stage={text:"",lines:[""],n:0,ghost:1,scr:0,lock:0,seed:0},stageGoal=0,stageOn=0,stageScale=1;
const stageBox={w:1,h:.5,y:0},GIB="x9#Kq7$Zm2&Bv4@Wd8!Rj%Yc5?Hs";
let byteLayout;
const updateByteHardware=byteHardware(camera);
const stageTex=canvasTex(1400,700,g=>{
  const w=g.canvas.width,h=g.canvas.height,s=stage,port=h>=w;
  g.clearRect(0,0,w,h);g.globalAlpha=1;g.shadowBlur=0;
  const N=(s.text||"").length;
  if(!N) return;
  const pad=w*.025,lines=port?s.lines:[s.text],fs=port?54:62,bubH=lines.length*fs*1.25+44;
  g.textBaseline="middle";
  /* the sentence in its chat bubble: the letter being converted lights up */
  if(s.ghost>0){
    g.globalAlpha=s.ghost;g.font=`800 ${fs}px ${FONT}`;
    const bw=Math.max(...lines.map(l=>g.measureText(l).width))+90;
    rr(g,(w-bw)/2,pad,bw,bubH,40,"#214fae");
    g.textAlign="left";
    let idx=0;
    lines.forEach((l,li)=>{
      let x=(w-g.measureText(l).width)/2;const y=pad+22+fs*.62+li*fs*1.25;
      for(const ch of l){g.fillStyle=idx<s.n?"#f1f5ff":idx===s.n?"#ffd166":"#fff";g.fillText(ch,x,y);x+=g.measureText(ch).width;idx++;}
      idx++;
    });
    g.globalAlpha=1;
  }
  /* one tile per letter: its 8 bits, then scrambled */
  const cols=port?6:9,rows=Math.ceil(N/cols),top=pad+bubH+26,cw=(w-pad*2)/cols,chh=Math.min((h-pad-top)/rows,cw*1.25);
  const bf=Math.floor(Math.min((cw-26)/2.45,(chh-25)/2.95)),gy=top+((h-pad-top)-chh*rows)/2;
  byteLayout={cols,cw,chh,gy,pad};
  g.textAlign="center";
  for(let i=0;i<N;i++){
    const r=Math.floor(i/cols),inRow=r===rows-1?N-cols*r:cols;
    const cx=pad+(i%cols+.5)*cw+(cols-inRow)*cw/2,cy=gy+(r+.5)*chh,on=i<s.n,scr=i<s.scr;
    rr(g,cx-cw/2+6,cy-chh/2+6,cw-12,chh-12,16,on?(scr?"rgba(4,20,34,.94)":"rgba(28,19,3,.94)"):"rgba(255,255,255,.05)",on?(scr?"#5fe0ff":"#f4b63a"):"rgba(255,255,255,.16)");
    if(!on) continue;
    const ch=s.text[i];let a,b;
    if(scr){const q=j=>GIB[((i*8+j)*13+s.seed*7)%GIB.length];a=q(0)+q(1)+q(2)+q(3);b=q(4)+q(5)+q(6)+q(7);}
    else{const bits=(ch.charCodeAt(0)&255).toString(2).padStart(8,"0");a=bits.slice(0,4);b=bits.slice(4);}
    const yo=bf*.26;
    if(s.ghost>0&&!scr){g.globalAlpha=s.ghost;g.fillStyle="#ffffff";g.font=`800 ${Math.round(bf*.62)}px ${FONT}`;g.fillText(ch===" "?"␣":ch,cx,cy-bf*1.12);g.globalAlpha=1;}
    g.fillStyle=scr?"#9fe8ff":"#ffd166";g.font=`800 ${bf}px ${MONO}`;
    g.fillText(a,cx,cy-bf*.55+yo);g.fillText(b,cx,cy+bf*.55+yo);
  }
  /* the padlock */
  if(s.lock>0){
    const e=outBack(s.lock),R=Math.min(w,h)*(port?.15:.2)*e,cx=w/2,cy=gy+chh*rows/2+R*.1;
    g.globalAlpha=Math.min(1,s.lock*1.6);
    g.strokeStyle="#f4b63a";g.lineWidth=7;g.beginPath();g.roundRect(pad*.4,gy-pad*.35,w-pad*.8,chh*rows+pad*.7,26);g.stroke();
    g.fillStyle="rgba(3,5,12,.78)";g.beginPath();g.arc(cx,cy,R*1.55,0,7);g.fill();
    g.globalAlpha=1;
  }
});
const stagePlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:stageTex.tex,transparent:true,opacity:0,depthTest:false,depthWrite:false,fog:false}));
stagePlane.position.z=-.99;stagePlane.renderOrder=901;stagePlane.visible=false;camera.add(stagePlane);
/* fit the stage into the free area between the caption and the bottom bar */
function stageFit(){
  const W=window.innerWidth,H=window.innerHeight;if(!W||!H) return;
  const port=camera.aspect<1,cw=port?840:1400,ch=port?840:700;
  if(stageTex.c.width!==cw||stageTex.c.height!==ch){stageTex.c.width=cw;stageTex.c.height=ch;stageTex.tex.dispose();stageTex.redraw();}
  const top=$("caption").getBoundingClientRect().bottom+16,btm=document.querySelector(".bottom").getBoundingClientRect().top-10;
  const lesson=$("chipLesson");
  lesson.style.top=top+"px";lesson.style.bottom=Math.max(0,H-btm)+"px";
  const k=Math.min(W*(port?.95:.88)/cw,Math.max(140,btm-top)/ch),Hu=2*Math.tan(camera.fov*Math.PI/360)*.99,u=Hu/H;
  stageBox.w=cw*k*u;stageBox.h=ch*k*u;stageBox.y=(.5+VOFF()-(top+btm)/2/H)*Hu;
}
window.addEventListener("resize",stageFit);

/* =====================================================================
   INSIDE THE MODEL
   ===================================================================== */
const ms=new THREE.Group();ms.position.set(MX,0,0);scene.add(ms);
{
  const grid=new THREE.GridHelper(120,120,0x4a36a0,0x241a55);grid.material.transparent=true;grid.material.opacity=.55;ms.add(grid);
  const pp=[];for(let i=0;i<1100;i++) pp.push((Math.random()-.5)*70,Math.random()*16,-24+Math.random()*34);
  const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.Float32BufferAttribute(pp,3));
  ms.add(new THREE.Points(pg,new THREE.PointsMaterial({map:GLOW,color:0xa692ff,size:.12,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending})));
  const lx=[-15,-5,5,15],lp=[],nodes=new THREE.InstancedMesh(new THREE.SphereGeometry(.2,12,12),E(0x9b85d3,.58),28),d=new THREE.Object3D();
  lx.forEach((x,c)=>{for(let k=0;k<7;k++){d.position.set(x,1.2+k*1.5,-16);d.updateMatrix();nodes.setMatrixAt(c*7+k,d.matrix);if(c<3) for(let j=0;j<7;j++) lp.push(x,1.2+k*1.5,-16,lx[c+1],1.2+j*1.5,-16);}});
  ms.add(nodes);
  const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.Float32BufferAttribute(lp,3));
  ms.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x8174bd,transparent:true,opacity:.14})));
}
patternBoard(ms);
const words=new THREE.Group();ms.add(words);
let tok=[],ans=[],xs=[],widths=[],stamps=[],cells,cellBase=[],arcGroup,chart,chartBars=[],ring,CX=0,focusTok=4;
function slab(text,color,h=.8,textColor="#141c33",ei=.2){
  const w=(.6+text.length*.24)*h/.8,g=new THREE.Group();
  const body=new THREE.Mesh(new RoundedBoxGeometry(w,h,.3,4,.1*h/.8),new THREE.MeshStandardMaterial({color,roughness:.54,metalness:.09,envMapIntensity:.65,emissive:color,emissiveIntensity:ei}));
  const ct=canvasTex(Math.round(w*240),Math.round(h*240),(c,W,H)=>{c.clearRect(0,0,W,H);c.fillStyle=textColor;c.font=`800 ${Math.round(H*.56)}px ${FONT}`;c.textAlign="center";c.textBaseline="middle";c.fillText(text,W/2,H/2+2);});
  ct.redraw();
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:ct.tex,transparent:true,depthWrite:false}));face.position.z=.157;
  g.add(body,face);tokenHousing(g,w,h,color);g.userData={w,body};return g;
}
function rebuildWords(){
  words.traverse(o=>{if(o.isInstancedMesh) o.dispose();if(o.geometry) o.geometry.dispose();if(o.material){if(o.material.map) o.material.map.dispose();o.material.dispose&&o.material.dispose();}});
  words.clear();
  for(let i=tappables.length-1;i>=0;i--) if(tappables[i].userData.tok!==undefined) tappables.splice(i,1);
  tok=ui.tokens.map(t=>slab(t.word,t.color));
  ans=ui.answer.map(w=>slab(w,"#f4b63a"));
  const all=[...tok,...ans];widths=all.map(s=>s.userData.w);xs=[];
  let x=0;widths.forEach(w=>{xs.push(x+w/2);x+=w+.35;});
  const shift=-(xs[4]+widths[4]/2)/2;xs=xs.map(v=>v+shift);
  all.forEach((s,i)=>{s.position.set(xs[i],ROW_Y,0);words.add(s);});
  tok.forEach((s,i)=>{s.userData.body.userData.tok=i;s.userData.body.userData.can=()=>current===MODEL&&(sub===1||sub===2);s.userData.body.userData.tap=()=>{sub===1?selectFingerprint(i):selectAttention(i);};tappables.push(s.userData.body);});
  stamps=ui.tokens.map((t,i)=>{const s=textSprite(ui.place(i+1),.36,{color:"#ffd27a",border:"rgba(244,166,42,.5)"});s.position.set(xs[i],.2,0);words.add(s);return s;});
  /* fingerprints: 5 x 6 grid of number cells under each word */
  cells=new THREE.InstancedMesh(displayCell(),new THREE.MeshStandardMaterial({roughness:.52,metalness:.16,envMapIntensity:.65}),150);cellBase=[];
  const dark=new THREE.Color(0x141a3c),col=new THREE.Color();
  ui.tokens.forEach((t,ti)=>{
    let v=t.id+17;
    for(let r=0;r<6;r++) for(let c=0;c<5;c++){
      v=(v*9301+49297)%233280;
      cellBase.push({x:xs[ti]+(c-2)*.22,y:1.9-r*.22-.2,delay:ti*.1+r*.05+c*.02});
      cells.setColorAt(cellBase.length-1,col.set(t.color).lerp(dark,1-v/233280));
    }
  });
  cells.instanceColor.needsUpdate=true;fingerprintSockets(cells,xs.slice(0,ui.tokens.length));words.add(cells);
  arcGroup=new THREE.Group();words.add(arcGroup);
  /* next-word chart */
  chart=new THREE.Group();words.add(chart);chartBars=[];
  CX=xs[4]+widths[4]/2+5.2;
  scoreTracks(chart,CX+.3,ui.choices);
  ui.choices.forEach((c,i)=>{
    const y=4.1-i*.75,l=slab(c.word,"#27305a",.55,"#ffffff",.05);l.position.set(CX-l.userData.w/2,y,0);chart.add(l);
    const len=Math.max(.14,c.percent*.045);
    const b=new THREE.Mesh(new RoundedBoxGeometry(1,.41,.22,2,.065),new THREE.MeshStandardMaterial({color:c.color,emissive:c.color,emissiveIntensity:i?.3:.9,roughness:.4}));
    b.position.set(CX+.3,y,0);chart.add(b);
    const p=textSprite(c.percent+"%",.4,{bg:"rgba(8,12,26,.6)"});p.position.set(CX+.3+len+.75,y,0);chart.add(p);
    chartBars.push({b,len,p});
  });
  const link=new THREE.Mesh(new THREE.BoxGeometry(1,.05,.05),E(0x9a7bff,2.4));
  const x0=xs[4]+widths[4]/2+.2,x1=CX-2.6;link.scale.x=x1-x0;link.position.set((x0+x1)/2,ROW_Y,0);chart.add(link);
  ring=new THREE.Mesh(new THREE.TorusGeometry(.78,.04,8,48),E(0x5fe0ff,3));ring.rotation.y=Math.PI/2;ring.visible=false;words.add(ring);
}
const dummy=new THREE.Object3D();
function setCells(fn){cellBase.forEach((c,i)=>{const s=fn(c);dummy.position.set(c.x,c.y,0);dummy.scale.setScalar(Math.max(.0001,s));dummy.updateMatrix();cells.setMatrixAt(i,dummy.matrix);});cells.instanceMatrix.needsUpdate=true;}
function distForWidth(w,minD=9){return Math.max(minD,w/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)*1.1);}
function highlightTok(i){tok.forEach((s,k)=>{s.scale.setScalar(k===i?1.14:1);s.userData.body.material.emissiveIntensity=k===i?.55:.2;});}
function selectFingerprint(i){highlightTok(i);subNote=ui.fpInfo(ui.tokens[i]);renderHUD();}
function selectAttention(f){
  focusTok=f;highlightTok(f);
  arcGroup.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});arcGroup.clear();
  ui.relations[f].lines.forEach((ln,i)=>{
    const a=V(xs[f],ROW_Y+.46,0),b=V(xs[ln.to],ROW_Y+.46,0),h=1.2+Math.abs(a.x-b.x)*.6;
    const curve=new THREE.QuadraticBezierCurve3(a,V((a.x+b.x)/2,a.y+h,0),b);
    const radius=.02+ln.w*.011;
    const geo=new THREE.TubeGeometry(curve,48,radius,8);
    const signal=new THREE.Mesh(new THREE.SphereGeometry(radius*1.9,12,8),new THREE.MeshBasicMaterial({color:0xfff3ce}));
    signal.visible=false;arcGroup.add(signal);
    // A socket anchors each arc to the word it supplies as context.
    const terminal=new THREE.Mesh(new THREE.TorusGeometry(.077,.018,6,20),new THREE.MeshBasicMaterial({color:ui.tokens[ln.to].color}));
    terminal.position.copy(b);arcGroup.add(terminal);
    const total=geo.index.count;geo.setDrawRange(0,0);
    arcGroup.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:ui.tokens[ln.to].color})));
    tween(i*.12,.8,p=>{
      geo.setDrawRange(0,Math.floor(total*p/3)*3);
      signal.visible=p<1;curve.getPointAt(p,signal.position);
    },ease);
  });
  subNote=ui.attention(ui.tokens[f].word,ui.relations[f].label);renderHUD();
}
let modelPan=0;
function modelCam(lookX,lookY,dist,dur){
  const generation=++modelPan;
  const cam=V(MX+lookX,lookY+.5,dist),look=V(MX+lookX,lookY,0);
  if(!dur||camBase.x<900){camBase.copy(cam);lookGoal.copy(look);lookCur.copy(look);return;}
  const start=camBase.clone(),target=lookGoal.clone();
  tween(0,dur,p=>{
    if(generation!==modelPan) return;
    camBase.lerpVectors(start,cam,p);lookGoal.lerpVectors(target,look,p);
  },ease);
}
function fitModelStage(k,dur){
  const compact=camera.aspect<.82;
  const start=xs[0]-widths[0]/2,promptEnd=xs[4]+widths[4]/2,pw=promptEnd-start;
  if(k===0){modelCam(0,ROW_Y-.2,distForWidth(pw+3),dur);return;}
  if(k===1){modelCam(0,1.55,distForWidth(pw+(compact?.5:3),10),dur);return;}
  if(k===2){modelCam(0,3.2,distForWidth(pw+(compact?.55:3),13.5),dur);return;}
  if(k===3){modelCam(CX+(compact?1.55:-1.2),2.7,distForWidth(compact?8.9:13),dur);return;}
  const end=xs.at(-1)+widths.at(-1)/2,answerStart=xs[tok.length]-widths[tok.length]/2;
  const centers=[(start+promptEnd)/2,(answerStart+end)/2];
  // Wrap at the start of the prediction on a phone. Reframing also runs on
  // rotation without restarting the animation or changing which words exist.
  [...tok,...ans].forEach((piece,i)=>{
    const answer=i>=tok.length;
    piece.position.set(xs[i]-(compact?centers[Number(answer)]:0),ROW_Y+(compact?(answer?-.67:.67):0),0);
  });
  modelCam(compact?0:(start+end)/2,ROW_Y-.3,distForWidth(compact?Math.max(pw,end-answerStart)+.65:end-start+3),dur);
}
window.addEventListener("resize",()=>{
  if(current===MODEL&&camBase.x>=900&&tok.length) fitModelStage(sub,0);
});
function setSub(k){
  clearTasks();
  sub=k;subNote="";busy=false;boost=1;heroScaleOverride=5;
  [...tok,...ans].forEach((s,i)=>{s.visible=i<5;s.position.set(xs[i],ROW_Y,0);s.scale.setScalar(1);});
  highlightTok(-1);
  ring.visible=false;chart.visible=k===3;arcGroup.visible=k===2;
  stamps.forEach(s=>s.visible=k===1||k===2);
  cells.visible=k===1||k===2;setCells(()=>1);
  heroVis=0;
  fitModelStage(k,[1.2,1.2,1.2,1.4,1.6][k]);
  if(k===0){
    showChipLesson(ui,"tokens");
  }
  if(k===1){
    setCells(()=>0);
    tween(.2,1.4,p=>setCells(c=>clamp01(p*2.4-c.delay*2)));
    softs.push(clock+2.8);at(2.8,()=>selectFingerprint(3));
  }
  if(k===2){softs.push(clock+2.8);at(2.8,()=>selectAttention(4));}
  if(k===3){
    chartBars.forEach(({b,len,p},i)=>{
      b.scale.x=.001;p.visible=false;
      tween(.5+i*.12,.9,t=>{b.scale.x=Math.max(.001,len*t);b.position.x=CX+.3+len*t/2;},ease);
      at(1.4+i*.12,()=>p.visible=true);
    });
    softs.push(clock+2.8);at(2.8,()=>{subNote=ui.winner;renderHUD();});
  }
  if(k===4){
    const pieces=[...tok,...ans];
    ans.forEach((s,j)=>{
      const t0=1.8+(j?.5+j:0),i=5+j;
      if(j===0) softs.push(clock+t0+.8);
      at(t0,()=>{ring.visible=true;});
      tween(t0,.8,p=>{
        const path=p*i,segment=Math.min(i-1,Math.floor(path));
        ring.position.lerpVectors(pieces[segment].position,pieces[segment+1].position,path-segment);
      },ease);
      at(t0+.8,()=>{ring.visible=false;s.visible=true;subNote=ui.pass(j+1,[ui.prompt,...ui.answer.slice(0,j)].join(" "),ui.answer[j]);renderHUD();});
      tween(t0+.8,.45,p=>s.scale.setScalar(Math.max(.001,p)),outBack);
      if(j===0) gate(t0+1.4,null,ui.again);
    });
    busy=true;stepping=true;
    at(1.8+.5+(ans.length-1)+1.3,()=>{busy=false;stepping=false;renderHUD();});
  }
  setTimer([.3,2,6,12,19.8][k]);
  renderHUD();
}

/* =====================================================================
   CAMERA RIG + TRAVEL
   ===================================================================== */
const camBase=V(1.16,.9,.035),lookGoal=V(1.5,.845,0),lookCur=lookGoal.clone(),lookEff=V(0,0,0);
const GPU_POSE={hero:[339.74,1.52,3.32],cam:[339.25,1.5,2.15],look:[GX,1.3,3.6]};
const POSE=[
  {hero:[1.47,.99,0],cam:[1.19,1.02,.008],look:[1.5,.955,.008]},
  {hero:[7.4,4.5,.9],cam:[3.6,2.9,1.6],look:[22,10,-3.5]},
  {hero:[118,3.5,0],cam:[111,6.2,3.4],look:[140,-1,0]},
  {hero:[306.5,1.8,0],cam:[302.6,2.5,1.3],look:[312,2.6,0]},
  null,
  {hero:[1.475,1.035,-.07],cam:[1.2,1.035,.05],look:[1.5,.975,-.012]}
];
const TRAVEL=[null,
  {env:[[1.9,1.5,0],[2.7,1.7,0]],cam:[[1.3,1.5,.1],[2.3,1.75,.1]],dur:2.4},
  {env:[[55,.9,-3],[70,1,-1.5],[85,1,-3.4],[100,1.1,0]],cam:[[52,3,3],[66,3,2.4],[80,3.4,2.4],[96,4.2,3.2]],dur:5},
  {env:[[285,3,0],[298,2,0]],cam:[[274,4.6,3],[292,3,1.6]],dur:4}
];
const homePath=new THREE.CatmullRomCurve3([[1.5,1.03,-.13],[1.9,1.5,0],[2.7,1.7,0],[8,3.6,0],[40,14,-2],[80,7,0],[118,3.5,0],[130,.8,0],[150,-8,0],[190,-12.3,0],[230,-8,0],[250,.8,0],[263,3,0],[285,3,0],[298,2,0],[306,1.8,0],[313.5,1.6,0],[316,1.6,2.6],[319,1.6,2.6],[339.74,1.52,3.32]].map(v3),false,"catmullrom",.35);
const HOME_LEN=homePath.getLength();
const messageCable=seaCurves[1], messageCableLength=messageCable.getLength();
const cableTangent=V(0,0,0), cablePoint=V(0,0,0);
const onSeabed=x=>smooth(130,138,x)*(1-smooth(242,250,x));

// Put the trail and the envelope's lower edge on the armor, including the thicker repeater sleeves.
function cableSurfaceAt(u,point){
  messageCable.getPointAt(u,point);
  messageCable.getTangentAt(u,cableTangent);
  const distance=Math.min(...seaRepeaterStops.map(stop=>Math.abs(u-stop)*messageCableLength));
  // The sleeve has a straight barrel, conical ends and raised rings at its center and either side.
  const taper=clamp01((1.395-distance)/.55);
  const ringDistance=Math.min(distance,Math.abs(distance-.6));
  const radius=seaCableRadius+.15*taper+.045*(1-smooth(.018,.073,ringDistance));
  // Offset along the normal so the point also tracks the armor on a slope.
  point.x-=(radius+.012)*cableTangent.y;
  point.y+=(radius+.012)*cableTangent.x;
}

function followCableHome(point){
  const weight=onSeabed(point.x);
  if(!weight) return;
  // The return trip uses a different spline. Find the same point on the cable by world X.
  let lo=0,hi=1;
  for(let i=0;i<14;i++){
    const mid=(lo+hi)/2;
    messageCable.getPointAt(mid,cablePoint);
    if(cablePoint.x<point.x) lo=mid; else hi=mid;
  }
  cableSurfaceAt((lo+hi)/2,cablePoint);
  point.lerp(cablePoint,weight);
}

function travel(o){
  at(o.delay||0,()=>{
    const ec=o.env&&new THREE.CatmullRomCurve3([hero.position.clone(),...o.env.map(v3)],false,"catmullrom",.35);
    const cc=o.cam&&new THREE.CatmullRomCurve3([camBase.clone(),...o.cam.map(v3)],false,"catmullrom",.35);
    const l0=lookGoal.clone(),l1=o.look?v3(o.look):null;
    tween(0,o.dur,p=>{
      if(ec) ec.getPointAt(p,hero.position);
      if(cc) cc.getPointAt(p,camBase);
      if(o.follow!==false){lookGoal.copy(hero.position);if(l1) lookGoal.lerp(l1,smooth(.55,1,p));}
      else if(l1) lookGoal.lerpVectors(l0,l1,p);
    },o.easing||ease);
  });
}
/* chase camera along the long route (trip home + real-speed replay) */
function ride(u0,u1,dur,easing,delay=0){
  const dir=Math.sign(u1-u0);
  tween(delay,dur,p=>{
    const u=u0+(u1-u0)*p;
    homePath.getPointAt(u,hero.position);
    followCableHome(hero.position);
    const s=heroScaleAt(hero.position);
    homePath.getPointAt(clamp01(u-dir*(2.6*s+.5)/HOME_LEN),camBase);
    camBase.y+=.3*s;
    lookGoal.copy(hero.position);
    // On the 0.4-second return, an eased target lags behind the camera and points away from home.
    if(realSpeed&&dir<0) lookCur.copy(lookGoal);
  },easing||ease);
}
function placeAt(i,P=POSE[i]){
  envelopeHinge.rotation.x=0;
  heroScaleOverride=null;
  hero.position.set(...P.hero);camBase.set(...P.cam);lookGoal.set(...P.look);lookCur.copy(lookGoal);
  if(i===HOME&&camera.aspect<1) hero.position.set(1.48,1.075,-.012); /* tall screens: the envelope waits above the phone */
  heroS=heroScaleAt(hero.position);heroVis=i===0?0:1;
  lockGoal=lockOn=(i<=3||i===HOME)?1:0;
  for(let k=0;k<TRAIL;k++) hero.position.toArray(trailPos,k*3);
}
function fade(cb){const f=$("fade");f.style.background="#000";f.style.opacity=1;at(.36,()=>{cb();f.style.opacity=0;});}
function flash(cb){const f=$("fade");f.style.background="#e9e2ff";f.style.opacity=1;at(.36,()=>{cb();f.style.opacity=0;});}

/* =====================================================================
   STOP LOGIC
   ===================================================================== */
function resetStop(i){
  if(i===0||i===HOME) thumbPress=tapFx=0;
  if(i===0){phoneState={mode:"draft",bits:null,cipher:null,words:[]};redrawPhone();}
  if(i===1){towerCab.m.emissiveIntensity=.1;towerCab.l.intensity=0;}
  if(i===2) packets.forEach(p=>{p.visible=false;p.scale.setScalar(1);});
  if(i===3){
    secState="idle";secTex.redraw();laser.visible=false;greenMats.forEach(m=>m.emissiveIntensity=.4);archStrips.emissive.set(0x35d6ff);
    chips.forEach(c=>c.material.emissiveIntensity=0);nums.forEach(n=>n.visible=false);
  }
  if(i===HOME){phoneState={mode:"answer",bits:null,words:[]};redrawPhone();}
}
const bits=()=>Array.from({length:11},()=>Math.random()<.5?"0":"1").join("");
const actions=[
  ()=>{ /* send: the words lift off the phone, become numbers, get locked, fold into the envelope */
    phoneState.mode="sent";redrawPhone();
    travel({cam:[[1.3,1.03,.015]],look:[1.5,.998,.005],dur:.9,follow:false});
    const txt=ui.promptLines.join(" "),N=txt.length;
    stage={mode:"bits",text:txt,lines:ui.promptLines,n:0,ghost:1,scr:0,lock:0,seed:0};stageScale=1;stageTex.redraw();
    stageGoal=1;
    for(let i=1;i<=N;i++) at(.4+1.5*i/N,()=>{stage.n=i;stageTex.redraw();});
    at(6.2,()=>{stage.ghost=0;stageTex.redraw();});
    for(let k=1;k<=18;k++) at(6.3+k*.11,()=>{stage.scr=Math.ceil(N*k/18);stage.seed=k;stageTex.redraw();});
    for(let k=1;k<=6;k++) at(8.7+k*.06,()=>{stage.lock=k/6;stage.seed++;stageTex.redraw();});
    tween(9.4,.55,p=>{stageScale=1-p;},ease);
    at(9.7,()=>{stageGoal=0;lockGoal=1;showHero(1,.6);});
    travel({delay:9.4,env:[[1.42,1.03,0]],cam:[[1.1,1.06,.03]],look:[1.42,1.03,0],dur:1.4});
    return 10.95;
  },
  ()=>{ /* the envelope turns into waves, the tower catches them and turns them into light in the cable */
    tween(0,.4,p=>{heroVis=1-p;},ease);
    tween(0,.4,p=>{waveOn=p;});
    for(let n=0;n<12;n++) at(.1+n*.28,()=>emitWave(hero.position,1.5,1.5));
    /* one steady shot: the camera flies right behind the waves, on the same line toward the tower,
       so they stay in the middle of the picture with the tower ahead (it used to swing off to one side) */
    travel({env:[[20,14,-3],[38,26,-7],[40.5,27.6,-6.5]],cam:[[14.4,11.3,-.9],[32.4,23.3,-4.9],[36.2,29,-3.2]],look:[44,26.5,-8],dur:3.4});
    at(3.4,()=>{showHero(1,.7);tween(0,.5,p=>{waveOn=1-p;});[0,.4].forEach(d=>at(d,()=>emitWave(hero.position,2.2,1)));});
    travel({delay:5.8,env:[[42.6,14,-7.4],[44.3,1.7,-4.3]],cam:[[40,16,-2],[40.6,3.6,-.4]],look:[45.4,1,-5.4],dur:1.5});
    tween(7.4,.9,p=>{const e=Math.sin(Math.PI*Math.min(1,p*1.15));towerCab.m.emissiveIntensity=.1+1.1*e+.25*p;towerCab.l.intensity=5*e;});
    travel({delay:7.7,env:[[44.8,.9,-5.5],[47.8,.5,-5.45]],dur:.9,follow:false});
    return 9;
  },
  ()=>{ /* the internet: one second inside the glass thread as the message itself, then the envelope crosses the sea floor in two legs */
    const tmp=V(0,0,0);
    fade(()=>{
      hideGlobe();heroVis=0;hero.position.set(TUNNEL_AT.x+40,0,0);
      camBase.copy(TUNNEL_AT);lookGoal.set(TUNNEL_AT.x+6,0,0);lookCur.copy(lookGoal);
      tunnelFov=.55;tunnelSpeed=1.3;
      tween(0,.5,p=>{tunnelFov=.55+.45*p;},ease);
      setLegend(true);
    });
    let home=null,cc=null;
    const rideTo=p=>{
      cc.getPointAt(p,camBase);
      cableSurfaceAt(clamp01(p*.96+.03),tmp);
      const contact=onSeabed(tmp.x);
      tmp.y+=(1-contact)*.24;
      hero.position.lerpVectors(home,tmp,smooth(0,.07,p));
      lookGoal.copy(hero.position);
      lookGoal.y+=.24*contact;
      lookCur.lerp(lookGoal,.5);
    };
    /* after about one second of that view, a flash of light, and we are outside watching the envelope run along the cable */
    at(1,()=>flash(()=>{
      placeAt(2);heroDark=0;
      home=hero.position.clone();
      cc=new THREE.CatmullRomCurve3([camBase.clone(),...[[124,3.2,2.6],[140,-3.4,2.6],[165,-10.3,3],[190,-11.6,3.4],[215,-10.3,3],[240,-3.4,2.6],[252,2.6,3],[257,4.2,3.6]].map(v3)],false,"catmullrom",.35);
      /* first leg: from the shore down to the deep sea floor, slowing to a stop there */
      tween(.1,4.3,p=>rideTo(.5*p),t=>1-(1-t)*(1-t));
      /* the speed shows next to the light for a moment, then goes away */
      speedLabel.visible=true;tween(1,.5,p=>{speedLabel.material.opacity=p;});tween(3.4,.6,p=>{speedLabel.material.opacity=1-p;});at(4,()=>{speedLabel.visible=false;});
    }));
    /* second leg, on the next tap: up the far slope toward the other shore */
    at(6,()=>{setLegend(false);});
    tween(6.05,5.5,p=>{if(cc) rideTo(.5+.42*p);},t=>t<.3?t*t/.51:(2*t-.3)/1.7);
    at(11.6,()=>fade(()=>showGlobe("web")));
    at(14.4,()=>{hero.position.set(263,3,0);camBase.set(258.2,4.3,3.2);lookGoal.set(263,3,0);lookCur.copy(lookGoal);});
    return 15;
  },
  ()=>{ /* data center: the door checks and unlocks, then through the hall to the chips */
    secState="checking";secTex.redraw();
    travel({env:[[310,1.7,0]],cam:[[303.4,2.6,1.8]],look:[312,2.5,0],dur:1});
    at(1,()=>{laser.visible=true;});
    tween(1,1.8,p=>{laser.position.y=3-2.7*Math.sin(Math.PI*p);});
    let sp=null,pop=0;
    at(3,()=>{
      laser.visible=false;secState="ok";secTex.redraw();archStrips.emissive.set(0x4ade80);lockGoal=0;
      sp=textSprite("“"+ui.prompt+"…”",.34,{bg:"#2f6fed",color:"#fff",border:"rgba(255,255,255,.75)"});scene.add(sp);temps.push(sp);
      const W=sp.scale.x,Hh=sp.scale.y;sp.scale.set(.001,.001,1);
      tween(.15,.5,p=>{pop=Math.max(.001,p);},outBack);
      tween(2.2,.4,p=>{pop=Math.max(.001,1-p);},ease);
      tween(0,8.4,()=>{const k=pop*heroS/4;sp.scale.set(W*k,Hh*k,1);sp.position.copy(hero.position);sp.position.y+=.16*heroS;});
    });
    at(5,()=>greenMats.forEach(m=>m.emissiveIntensity=3));
    travel({delay:5,env:[[313.2,1.7,0],[316,1.6,2.6],[319.5,1.6,2.6],[330,1.7,2.6],GPU_POSE.hero],cam:[[306.5,2.6,-1.2],[310.9,2.4,-.4],[316,2,2.5],[326,2.1,2.5],[336,1.9,2.3],GPU_POSE.cam],look:GPU_POSE.look,dur:4});
    chips.forEach((c,k)=>tween(8.4+k*.07,.35,p=>{c.material.emissiveIntensity=3.2*p;}));
    at(9.6,()=>{if(sp) sp.visible=false;showChipLesson(ui,"gpu");stageFit();});
    return 14.4;
  },
  null,
  ()=>{ /* the envelope is unlocked on the phone and the whole answer lands at once */
    lockGoal=0;
    tween(.09,.52,p=>{envelopeHinge.rotation.x=-1.48*p;},ease);
    const sp=textSprite(ui.answer.join(" "),.015,{bg:"#f4b63a",color:"#2a1c02",border:"rgba(255,255,255,.6)"}),a=hero.position.clone().add(V(0,.04,0)),b=V(1.49,1,0);
    const W=sp.scale.x,H=sp.scale.y;sp.scale.set(.001,.001,1);sp.position.copy(a);scene.add(sp);temps.push(sp);
    tween(.05,.3,p=>sp.scale.set(W*Math.max(.001,p),H*Math.max(.001,p),1),outBack);
    tween(.5,.35,p=>{sp.position.lerpVectors(a,b,p);sp.scale.set(W*(1-.6*p),H*(1-.6*p),1);},ease);
    at(.85,()=>{scene.remove(sp);showHero(0,.28);phoneState.words=[...ui.answer];redrawPhone();});
    return 2.2;
  }
];

function go(i,cut){
  if(i<0||i>HOME) return;
  introOn=false;
  const cinematic=!cut&&i===current+1,wasGlobe=globeOn;
  clearTasks();
  done=false;replayed=false;subNote="";sub=0;busy=true;beat=-1;item=0;fin=0;boost=1.5;
  current=i;
  setTimer(T[i]);renderHUD();
  if(!cinematic){
    fade(()=>{
      hideGlobe();resetStop(i);
      if(i===MODEL){lockGoal=lockOn=0;setSub(0);return;}
      placeAt(i);
      if(i===2) showGlobe("route");
      busy=false;renderHUD();
    });
    return;
  }
  if(wasGlobe) fade(hideGlobe);
  resetStop(i);
  if(i===MODEL){ /* dive into a chip */
    travel({env:[[GX+.02,1.3,3.5]],cam:[[340.15,1.36,2.9],[GX-.12,1.3,3.46]],look:[GX+.1,1.27,3.6],dur:1.7,follow:false});
    tween(.6,1,p=>{heroVis=1-p;});
    at(1.45,()=>flash(()=>setSub(0)));
    return;
  }
  if(i===HOME){ /* back through the chip, then the whole road in reverse */
    flash(()=>{
      placeAt(-1,GPU_POSE);lockGoal=lockOn=1;
      ride(1,0,5.6);
      travel({delay:5.6,cam:[POSE[HOME].cam],look:POSE[HOME].look,dur:1.3,follow:false});
      at(6.9,()=>{busy=false;renderHUD();});
    });
    return;
  }
  const t=TRAVEL[i],P=POSE[i];
  travel({env:[...t.env,P.hero],cam:[...t.cam,P.cam],look:P.look,dur:t.dur});
  if(i===2){at(t.dur+.3,()=>fade(()=>{showGlobe("route");busy=false;renderHUD();}));return;}
  at(t.dur,()=>{busy=false;renderHUD();});
}
function runAction(){
  busy=true;stepping=true;beat=0;item=0;boost=1;
  const tm=TMS[current];
  const rd=READY[current].map(t=>clock+t);openAt=rd[0];
  READY[current].forEach(t=>at(t,()=>renderHUD()));
  beatTimes(current).forEach((t,k)=>{if(k) gate(t,()=>{beat=k;item=0;openAt=rd[k];setTimer(tm[k]);});});
  ITEMS[current].forEach((ts,k)=>ts.forEach((t,j)=>{softs.push(clock+t);at(t,()=>{item=j+1;renderHUD();});}));
  softs.sort((a,b)=>a-b);
  renderHUD();
  const dur=actions[current]();
  endAt=clock+dur;
  setTimer(tm[0]);
  at(dur,()=>{done=true;busy=false;stepping=false;setTimer(tm[tm.length-1]);renderHUD();});
}
function mainAction(){
  if(introOn){if(!busy) narration.startIntro(()=>go(0,true));return;}
  if(waiting){release();return;}
  if(busy){if(clock>=openAt) skipAhead();return;}
  if(current===MODEL){sub<4?setSub(sub+1):go(HOME);return;}
  if(!done){
    if(current===0){busy=true;renderHUD();tween(0,.4,p=>setThumb(p),ease);tween(.3,.42,p=>{tapFx=p;redrawPhone();});at(.74,()=>{tapFx=0;runAction();});tween(.8,.4,p=>setThumb(1-p),ease);return;}
    runAction();return;
  }
  if(current===HOME){if(replayed){busy=true;renderHUD();fade(showIntro);}else replay();return;}
  go(current+1);
}
/* the closing: one second, then the 1858 comparison, then who owns it all */
function finale(){
  busy=true;fin=0;openAt=clock+2;endAt=clock+7.2;renderHUD();
  at(1.2,()=>fade(()=>showGlobe("web")));
  at(2,()=>renderHUD());
  [3.4,7.2].forEach((t,j)=>{softs.push(clock+t);at(t,()=>{fin=j+1;if(j) busy=false;renderHUD();});});
}
let liveTimer=null;
function back(){
  if(introOn) return;
  if(current===MODEL){sub>0?setSub(sub-1):go(3,true);return;}
  if(current===0&&beat<0){busy=true;renderHUD();fade(showIntro);return;}
  go(beat>=0?current:current-1,true);
}
/* the opening screen: only the title, the model of the trip, and Start */
function showIntro(){
  clearTasks();
  introOn=true;current=0;sub=0;subNote="";done=false;replayed=false;busy=false;beat=-1;item=0;fin=0;boost=1;
  hideGlobe();resetStop(0);heroVis=0;heroScaleOverride=null;
  introCam(true);showTimer(0);renderHUD();
  /* start in the intro's own light and colours straight away, with no fade from the last scene */
  const Z=ZONES.intro;zoneCur.fog.set(Z.fog);["den","sun","hemi","fill","exp","env"].forEach(k=>{zoneCur[k]=Z[k];});
}
function introCam(snap){
  const port=camera.aspect<1;
  /* far enough back that the whole model fits, whatever the window's shape */
  const z=port?33:Math.max(18.5,31/camera.aspect);
  camBase.set(INTRO_AT.x+.2,port?10.5:7.2+(z-18.5)*.18,z);lookGoal.set(INTRO_AT.x+.1,port?2.6:2.1,0);
  if(snap) lookCur.copy(lookGoal);
}
function replay(){
  clearTasks();
  busy=true;realSpeed=true;heroVis=1;envelopeHinge.rotation.x=0;renderHUD();
  phoneState.words=[];redrawPhone();
  liveTimer=clock;
  const lin=t=>t*t*(3-2*t);
  ride(0,1,.45,lin);
  // Queue both legs up front so the window approach finishes before the phone camera samples its start.
  ride(1,0,.4,lin,.6);
  at(1,()=>{liveTimer=null;showTimer(20);showHero(0,.25);phoneState.words=[...ui.answer];redrawPhone();});
  travel({delay:1,cam:[POSE[HOME].cam],look:POSE[HOME].look,dur:.6,follow:false});
  at(2,()=>{realSpeed=false;replayed=true;finale();});
}

/* =====================================================================
   HUD
   ===================================================================== */
let timerShown=0;
function showTimer(sec){timerShown=sec;$("timerValue").textContent=sec<1?sec.toFixed(2):sec.toFixed(1);}
function setTimer(target){const from=timerShown;tween(0,.6,p=>showTimer(from+(target-from)*p));}
/* auto-play: moves on by itself once there has been time to read what is on screen */
let auto=false,capKey="",capTitle="",capT0=0,capDur=4,enT0=0,wasEn=false,lastP=-1;
const itemHTML=(it,cls="")=>Array.isArray(it)?`<div class="stat"><b>${it[0]}</b><span>${it[1]}</span></div>`:`<p class="ln ${cls}">${it}</p>`;
/* the caption is a title plus ONE short line (or one big number) at a time */
function renderHUD(){
  $("caption").classList.toggle("intro",introOn);
  document.body.classList.toggle("desk-view",!introOn&&(current===0||current===HOME)&&beat<0);
  wifiLabel.visible=!introOn&&(current===1||(current===0&&beat>=0));
  if(introOn){
    const html=`<h2>${ui.introTitle}</h2>${itemHTML(ui.introSay)}`;
    if(html!==capKey){capKey=html;capTitle=ui.introTitle;$("caption").innerHTML=html;}
    narration.setScreen(lang,1);
    $("chapter").innerHTML=`<b class="scr">1 / ${narration.total}</b><span>${ui.introName}</span>`;
    const mb=$("mainBtn");mb.textContent=ui.start;mb.disabled=busy;mb.classList.toggle("act",!busy);
    $("backBtn").disabled=true;
    document.querySelectorAll(".dot").forEach(d=>{d.classList.remove("active","visited");});
    stageFit();return;
  }
  const n=ui.stops.length,stop=ui.stops[current],isModel=current===MODEL;
  const b=!isModel&&beat>=0?stop.beats[beat]:null;
  const nextName=i=>`${ui.nextStep}: ${ui.stops[i].name} →`;
  let title,body,ticks="",labelTxt,act=false;
  const g=stepping&&gates[0],open=busy&&!waiting&&clock>=openAt,more=open&&pendingLine();
  if(g){labelTxt=(g.label||ui.cont)+" ▸";act=waiting||open;}
  else if(more&&current===HOME&&replayed){labelTxt=ui.cont+" ▸";act=true;}
  else if(isModel) labelTxt=sub<4?`${ui.nextStep}: ${ui.subs[sub+1].name} →`:nextName(HOME);
  else if(!done&&!stepping){labelTxt=stop.action;act=true;}
  else if(current===HOME) labelTxt=replayed?ui.restart:ui.replay;
  else labelTxt=nextName(current+1);
  if(isModel){
    title=ui.subs[sub].title;body=itemHTML(subNote||ui.subs[sub].say,subNote?"note":"");
    ticks=ui.subs.map((x,i)=>`<i class="${i<=sub?"on":""}" data-sub="${i}" title="${x.name}"></i>`).join("");
  }
  else if(current===HOME&&replayed){title=ui.finale[0];body=itemHTML(ui.finale[1][fin]);}
  else if(b){
    title=b[0];
    body=done&&stop.after?itemHTML(stop.after,"note"):itemHTML(b[1][Math.min(item,b[1].length-1)]);
    if(stop.beats.length>1) ticks=stop.beats.map((x,i)=>`<i class="${i<=beat?"on":""}"></i>`).join("");
  }
  else{title=stop.title;body=itemHTML(stop.say);}
  const html=`${ticks?`<div class="beats">${ticks}</div>`:""}<h2 id="lessonHeading">${title}</h2>${body}`;
  if(html!==capKey){
    capKey=html;
    const cap=$("caption");cap.innerHTML=html;
    const words=t=>String(t).replace(/<[^>]+>/g," ").trim().split(/\s+/).length;
    const nw=words((cap.querySelector(".ln,.stat")||cap).textContent)+(title!==capTitle?words(title):0);capTitle=title;
    const need=rate<1?Math.max(3,1+nw/3):Math.max(2.4,.8+nw/3.6);
    capT0=amb;capDur=need+.5;readUntil=amb+need;
  }
  /* screen number: 1 is the opening screen, 2 the phone, and every tap of the main button adds one */
  const SCR0=[0,3,5,8,11,17],scr=SCR0[current]+2+(isModel?sub+(sub===4&&!(stepping&&gates.length)?1:0):beat+1+(current===HOME&&(replayed||realSpeed)?1:0));
  narration.setScreen(lang,scr);
  $("chapter").innerHTML=`<b class="scr">${scr} / ${narration.total}</b><span>${ui.kicker(current+1,n,stop.name)}</span>`;
  const mb=$("mainBtn");mb.textContent=labelTxt;mb.disabled=busy&&!waiting&&!open;mb.classList.toggle("act",act&&!mb.disabled);
  if(!mb.disabled&&!wasEn) enT0=amb;
  wasEn=!mb.disabled;
  $("backBtn").disabled=false;$("backBtn").setAttribute("aria-label",ui.back);
  document.querySelectorAll(".dot").forEach((d,k)=>{d.classList.toggle("active",k===current);d.classList.toggle("visited",k<current);});
  stageFit();
}
function applyLanguage(){
  ui=appCopy[lang];
  document.documentElement.lang=ui.htmlLang;document.title=ui.documentTitle;
  $("brand").textContent=ui.brand;$("timerLabel").textContent=ui.timerLabel;
  document.querySelectorAll("[data-lang]").forEach(b=>b.classList.toggle("active",b.dataset.lang===lang));
  $("dots").innerHTML=ui.stops.map((s,i)=>`<button class="dot" type="button" data-stop="${i}" title="${i+1}. ${s.name}" aria-label="${ui.kicker(i+1,ui.stops.length,s.name)}"></button>`).join("");
  paintSpeed();
  $("lgHair").textContent=ui.labels.hair;$("lgGlass").textContent=ui.labels.glass;
  labels.forEach(l=>l.sp.userData.set(ui.labels[l.key]));
  introFx.setLanguage(ui);redrawPhone();dnsTex.redraw();secTex.redraw();signTex.redraw();
  rebuildWords();
}
$("mainBtn").addEventListener("click",mainAction);
$("backBtn").addEventListener("click",back);
const speedBtns=[...document.querySelectorAll("[data-speed]")];
const paintSpeed=()=>speedBtns.forEach(b=>{b.classList.toggle("active",+b.dataset.speed===rate);const l=+b.dataset.speed<1?ui.slow:ui.fast;b.title=l;b.setAttribute("aria-label",l);});
speedBtns.forEach(b=>b.addEventListener("click",()=>{rate=+b.dataset.speed;paintSpeed();}));
$("dots").addEventListener("click",e=>{const b=e.target.closest("[data-stop]");if(b) go(+b.dataset.stop,true);});
$("caption").addEventListener("click",e=>{const b=e.target.closest("[data-sub]");if(b&&current===MODEL) setSub(+b.dataset.sub);});
document.querySelectorAll("[data-lang]").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.lang===lang) return;
  lang=b.dataset.lang;applyLanguage();
  if(current===MODEL) setSub(sub); else go(current,true);
}));
document.addEventListener("keydown",e=>{
  if(e.target.closest&&e.target.closest("button")) return;
  if(e.key==="ArrowRight"||e.key==="Enter"||e.key===" "){e.preventDefault();mainAction();}
  if(e.key==="ArrowLeft") back();
});

/* pointer: look around a little, tap things in the world */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),mouse={x:0,y:0,sx:0,sy:0};
function pick(e){
  ndc.set(e.clientX/window.innerWidth*2-1,-(e.clientY/window.innerHeight)*2+1);
  ray.setFromCamera(ndc,camera);
  return ray.intersectObjects(tappables,false).find(hit=>hit.object.userData.can(hit.uv))?.object ?? null;
}
let downAt=null;
canvas.addEventListener("pointermove",e=>{
  mouse.x=e.clientX/window.innerWidth*2-1;mouse.y=e.clientY/window.innerHeight*2-1;
  if(e.pointerType==="mouse") canvas.style.cursor=pick(e)?"pointer":"default";
});
canvas.addEventListener("pointerdown",e=>{downAt=[e.clientX,e.clientY];});
canvas.addEventListener("pointerup",e=>{
  if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>8) return;
  const o=pick(e);if(o) o.userData.tap();
});

/* =====================================================================
   FRAME LOOP
   ===================================================================== */
const rclock=new THREE.Clock(),tmpV=V(0,0,0),blinkers=[];
scene.traverse(o=>{if(o.userData.blink!==undefined) blinkers.push(o);});
let towerRing=0,first=true;
function frame(){
  requestAnimationFrame(frame);
  step(Math.min(.1,rclock.getDelta()),true);
}
function step(dt,draw){
  amb+=dt;tickNature(amb);
  if(introOn){introFx.tick(amb);introCam(false);}
  tunnelFx.tick(amb,dt,tunnelSpeed);
  if(typeof seaTick==="function"){seaTick(amb,camBase.x);if(ms.visible) modelTick(amb);}
  if(!waiting){
    let nc=clock+dt*(realSpeed?1:Math.min(1,rate*boost));
    if(softs.length&&nc>=softs[0]){if(amb<readUntil) nc=Math.max(clock,softs[0]-.0005);else softs.shift();}
    if(gates.length&&nc>=gates[0].t){nc=gates[0].t;waiting=true;renderHUD();}
    clock=nc;
  }
  runTasks();
  {
    const mb=$("mainBtn");let pr=0;
    if(auto&&!mb.disabled){
      if(current===HOME&&done&&replayed){auto=false;renderHUD();}
      else{pr=Math.min(1,(amb-capT0)/capDur,(amb-enT0)/1.5);if(pr>=1 && !narration.waitingForEnd){pr=0;mainAction();}}
    }
    if(pr!==lastP){lastP=pr;mb.style.setProperty("--p",pr.toFixed(3));}
  }
  if(liveTimer!==null) showTimer(Math.min(20,(clock-liveTimer)*20));

  /* hero */
  const target=heroScaleOverride??heroScaleAt(hero.position);
  heroS+=(target-heroS)*(1-Math.exp(-dt*6));
  hero.scale.setScalar(Math.max(.0001,heroS*heroVis));
  const contact=onSeabed(hero.position.x);
  lockOn+=(lockGoal-lockOn)*(1-Math.exp(-dt*7));
  lockG.scale.setScalar(Math.max(.0001,lockOn));lockG.rotation.z=(1-lockOn)*1.4;
  lightGoal=hero.position.x>46&&hero.position.x<296?1:0;
  lightOn+=(lightGoal-lightOn)*(1-Math.exp(-dt*5));
  /* in daylight it is a plain paper envelope; it only glows where the scene is dark */
  const hz=zoneOf(hero.position);
  heroDark+=((hz==="out"||hz==="room"?0:1)-heroDark)*(1-Math.exp(-dt*4));
  /* in dark places the paper is only lit enough to be seen; it shines like a light only inside the cables */
  const shine=heroDark*lightOn*(hz==="sea"?.40:1);
  heroPaper.color.lerpColors(PAPER_DAY,PAPER_DARK,heroDark);
  heroPaper.emissiveIntensity=.48*heroDark+.5*shine;heroFlap.emissiveIntensity=.42+.63*heroDark+1.15*shine;heroGlow.material.opacity=.04*heroDark+.46*shine;
  const paperScale=(1-.3*shine)*(1-.12*contact);
  heroIn.scale.setScalar(paperScale);
  heroIn.rotation.set(-.72*contact,0,Math.sin(amb*1.3)*.06*(1-contact));
  // Pivot the tilted paper about its bottom edge so camera billboarding keeps that edge on the cable.
  heroIn.position.set(0,.054*paperScale*contact,0).applyQuaternion(heroIn.quaternion);
  heroIn.position.y+=Math.sin(amb*2.2)*.012*(1-contact);
  flare.material.opacity=shine*.9;core.material.opacity=shine*.4;
  heroLight.intensity=(hz==="sea"?.09:.3)*heroS*heroS*heroVis*(1+1.3*lightOn)*(.05+.3*heroDark+.65*shine);heroLight.distance=7*heroS;
  for(let k=TRAIL-1;k>0;k--){trailPos[k*3]=trailPos[k*3-3];trailPos[k*3+1]=trailPos[k*3-2];trailPos[k*3+2]=trailPos[k*3-1];}
  hero.position.toArray(trailPos,0);trailGeo.attributes.position.needsUpdate=true;
  trail.material.size=.055*heroS;trail.material.opacity=.5*heroVis*(.15+.85*heroDark);

  /* camera */
  lookEff.copy(lookGoal);
  /* on a tall phone screen, step back from the phone in your hand and frame it higher, clear of the buttons */
  const roomPort=camera.aspect<1&&camBase.x<1.4&&camBase.x>-100&&camBase.y<1.2;
  if(camera.aspect<1&&heroVis>.5&&current!==MODEL&&!roomPort) lookEff.lerp(hero.position,.45);
  if(roomPort) lookEff.y-=.045;
  lookCur.lerp(lookEff,1-Math.exp(-dt*10));
  mouse.sx+=(mouse.x-mouse.sx)*(1-Math.exp(-dt*4));mouse.sy+=(mouse.y-mouse.sy)*(1-Math.exp(-dt*4));
  camera.position.copy(camBase);camera.lookAt(lookCur);
  if(roomPort){camera.translateZ(.07);camera.lookAt(lookCur);}
  const a=Math.min(.6,Math.max(.012,camBase.distanceTo(lookCur)*.035));
  camera.translateX(mouse.sx*a);camera.translateY(-mouse.sy*a*.6);camera.lookAt(lookCur);
  hero.quaternion.copy(camera.quaternion);
  globe.visible=globeOn&&stageOn<.6;
  if(globeOn){
    if(webOn) gAng+=dt*.045;
    const gDist=camera.aspect<1?(webOn?45:26):(webOn?34:20),gf=gDist/34;
    tmpV.copy(GDIR).applyAxisAngle(UP,gAng+Math.sin(amb*.22)*.03);
    camera.position.copy(GC).addScaledVector(tmpV,gDist);camera.lookAt(GC);camera.updateMatrixWorld();
    gRight.setFromMatrixColumn(camera.matrixWorld,0);
    globeLabels.forEach(sp=>{
      sp.scale.copy(sp.userData.nat).multiplyScalar(gf);
      sp.position.copy(sp.userData.anchor).addScaledVector(gRight,sp.scale.x/2+.3*gf);
      sp.visible=!webOn&&gTmp.copy(sp.userData.anchor).normalize().dot(tmpV)>.3;
    });
    routePulse.scale.setScalar(.03*gDist);
    routePulse.visible=routeP>.08;
    if(routePulse.visible) routeCurve.getPointAt(((amb*.16)%1)*routeP,routePulse.position);
  }
  const focus=globeOn?GC:lookCur;
  packets.forEach(p=>p.quaternion.copy(camera.quaternion));

  waves.forEach(r=>{
    if(!r.m.visible) return;
    r.life+=dt/r.dur;
    if(r.life>=1){r.m.visible=false;return;}
    r.m.position.copy(hero.position);r.m.quaternion.copy(camera.quaternion);r.m.scale.setScalar(.2+(r.max-.2)*r.life);r.m.material.opacity=(1-r.life)*.9;
  });
  waveCore.visible=waveOn>.01;waveCore.position.copy(hero.position);waveCore.material.opacity=waveOn*.75;waveCore.scale.setScalar(heroS*.3);

  /* center stage */
  stageOn+=(stageGoal-stageOn)*(1-Math.exp(-dt*5));
  veil.visible=stageOn>.01;veil.material.opacity=Math.min(1,1.03*stageOn);
  stagePlane.visible=stageOn>.01&&stageScale>.01;stagePlane.material.opacity=Math.min(1,stageOn*1.4);
  const ssc=stageScale*(.55+.45*stageOn);
  stagePlane.scale.set(stageBox.w*ssc,stageBox.h*ssc,1);
  stagePlane.position.y+=(stageBox.y*stageScale-stagePlane.position.y)*(1-Math.exp(-dt*8));

  if(byteLayout) updateByteHardware(stage,byteLayout,stageTex.c.width,stageTex.c.height,stagePlane);

  /* atmosphere by zone */
  const zn=zoneOf(camera.position),Z=ZONES[zn],k=1-Math.exp(-dt*(zn==="sea"?9:4));
  // Each miniature or explanatory stage has its own lights and scenery.
  // Skip the physical world, including its shadow casters, when it is offstage.
  world.visible=zn==="room"||zn==="out"||zn==="dc"||zn==="sea";
  landscape.visible=zn!=="sea" && (zn!=="dc"||camera.position.x<306);
  introFx.root.visible=zn==="intro";
  deskLight.visible=zn==="room";
  sun.castShadow=world.visible && Z.sun>0 || zn==="intro";
  zoneCur.fog.lerp(zoneCol.set(Z.fog),k);
  ["den","sun","hemi","fill","exp"].forEach(key=>{zoneCur[key]+=(Z[key]-zoneCur[key])*k;});
  ms.visible=zn==="model";
  const openAir=zn==="out"||zn==="room"||zn==="sea";
  zoneCur.env+=(Z.env-zoneCur.env)*k;
  scene.environment=openAir&&skyEnv?skyEnv:roomEnv;scene.environmentIntensity=zoneCur.env;
  updateWater(amb,camera);
  scene.fog.color.copy(zoneCur.fog);bgColor.copy(zoneCur.fog);scene.fog.density=zoneCur.den;
  scene.background=zn==="intro"?introBg:bgColor;
  /* inside the cable: the ride is only there while the camera is, with a much wider view for the feeling of speed */
  const inTube=zn==="tunnel";
  if(inTube!==tunnelFx.root.visible) tunnelFx.show(inTube);
  if(!inTube) tunnelFov=0;
  const fovNow=(camera.aspect<1?60:45)+(camera.aspect<1?38:52)*tunnelFov;
  if(Math.abs(camera.fov-fovNow)>.01){camera.fov=fovNow;camera.updateProjectionMatrix();}
  /* cable lights are strong in the dark and quiet in daylight, where a bright glow looks painted on */
  dayK+=((zn==="out"||zn==="room"?1:0)-dayK)*k;
  cableMat.emissiveIntensity=1.5-1.15*dayK;pulses.material.emissiveIntensity=3.6-2.5*dayK;
  sun.intensity=zoneCur.sun;hemi.intensity=zoneCur.hemi;fill.intensity=zoneCur.fill;renderer.toneMappingExposure=zoneCur.exp;
  skyGroup.visible=zn==="out"||zn==="room";skyGroup.position.copy(camera.position);
  setShadowExt(zn==="room"?6:45);
  writingDesk.updateView(camera,zn==="room");
  sun.target.position.copy(focus);sun.position.copy(focus).addScaledVector(SUN_DIR,140);
  fill.position.copy(focus);
  seaLabel.visible=zn==="sea";fill.position.y+=zn==="model"?5:2.6;fill.position.z+=zn==="model"?7:0;
  if(zn==="sea"){
    // A cool survey light just above the moving camera reveals near-field
    // colour; distance fog absorbs it along the cable.
    fill.position.lerpVectors(camera.position,lookCur,.28);
    fill.position.y+=1.4;fill.position.z+=1.2;
  }

  /* ambient life */
  roofHardware.visible=camera.position.x>240&&camera.position.x<445&&zn!=="dc";
  dataHallFittings.visible=camera.position.x>249&&camera.position.x<410&&Math.abs(camera.position.z)<45&&camera.position.y<14;
  if(dataHallFittings.visible) tickGate(secState==="ok",dt);
  curves.forEach((c,ci)=>{for(let j=0;j<7;j++){c.getPointAt((amb*(.05+ci*.004)+j/7+ci*.13)%1,tmpV);dummy.position.copy(tmpV);dummy.scale.setScalar(1-.45*dayK);dummy.rotation.set(0,0,0);dummy.updateMatrix();pulses.setMatrixAt(ci*7+j,dummy.matrix);}});
  pulses.instanceMatrix.needsUpdate=true;
  beacon.material.emissiveIntensity=Math.sin(amb*4)>0?4.5:.5;
  blinkers.forEach(b=>{b.material.emissiveIntensity=Math.sin(amb*6+b.userData.blink*1.7)>0?3:.4;});
  towerRing-=dt;
  /* the tower's own idle rings pause while the message is on its way, so only its waves are on screen */
  if(towerRing<0&&!globeOn&&!(current===1&&stepping)&&camera.position.x<120&&camera.position.distanceTo(tmpV.set(42,29,-8))>30){towerRing=1.1;emitRing(V(42,29,-8),UP,16,2.6);}
  rings.forEach(r=>{
    if(!r.m.visible) return;
    r.life+=dt/r.dur;
    if(r.life>=1){r.m.visible=false;return;}
    r.m.scale.setScalar(.3+(r.max-.3)*r.life);r.m.material.opacity=(1-r.life)*.75;
  });

  if(!draw) return;
  if(world.visible) updateScans(camera,renderer.domElement.height,zn==="room");
  composer.render();
  if(first){first=false;const l=$("loading");l.style.opacity=0;setTimeout(()=>l.remove(),700);}
}

/* boot */
/* Extra detail for the sea floor, data hall and AI (see detail.js). */
const H={scene:world,model,plant,scatter,M,E,bx,cyl,beam,canvasTex,seaY,bedHeight,seaCurves,seaRepeaterStops,GLOW,ms};
hallDetail({...H,scene:dataHallFittings,bx:(x0,x1,y0,y1,z0,z1,mat,opts)=>bx(x0,x1,y0,y1,z0,z1,mat,{parent:dataHallFittings,...opts})});
const seaTick=seaDetail(H),modelTick=modelDetail(H);
applyLanguage();
placeAt(0);
showIntro();
frame();
window.__journey={intro:()=>introOn,showIntro,setThumb:p=>setThumb(p),tap:p=>{tapFx=p;redrawPhone();},HP,hand:()=>hand?.rig()??photoGrip,showGlobe,hideGlobe,renderer,composer,sky:()=>skyInfo,modelInfo,placed,camBase,lookGoal,lookCur,scene,THREE,go,mainAction,setSub,tick:(sec)=>{for(let t=0;t<sec;t+=.04) step(.04,false);step(.04,true);},state:()=>({auto,capDur,item,fin,globeOn,current,sub,done,busy,replayed,beat,waiting,stepping,gates:gates.length,clock,cam:camBase.toArray(),hero:hero.position.toArray()})};
