import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Water} from 'three/addons/objects/Water.js';
import {appCopy} from './copy.js';
import {createHand,HP} from './hand.js';
import {createPhotoGrip} from './phone-grip.js';
import {createForest,scatter,createClouds,tickNature} from './nature.js';
import {createCity} from './city.js';
import {createIntro,INTRO_AT} from './intro.js';
import {roomDetail,seaDetail,hallDetail,modelDetail} from './detail.js';

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
const BEATS=[[0,6.2],[0],[0,7.4,11],[0,5],null,[0]];
/* when the next short line of a step appears (story seconds from the start of the action) */
/* story time in each beat when its picture is done and the main button turns on */
const READY=[[2,10.9],[8.6],[7.1,8.6,17.4],[3.8,13.3],null,[3.4]];
const ITEMS=[[[3,5.3],[8.7,10.9]],[[3.5,5.8]],[[3.1,5.2],[10.4],[14.2,16.8]],[[3],[9.6,11.8]],null,[[2.6]]];
const beatTimes=i=>BEATS[i];
const $=id=>document.getElementById(id);
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
const TMS=[[0,.001,.002],[.003,.01],[.012,.02,.03,.05],[.06,.08,.1],null,[19.95,20]];

/* clock-driven task list (cancellable, pauses with the render loop) */
let clock=0,tasks=[],temps=[];
/* pacing: the story clock runs slowly and stops at every gate until the viewer taps Continue */
let amb=0,rate=.6,boost=1,realSpeed=false,gates=[],waiting=false,stepping=false,softs=[],readUntil=0,openAt=Infinity,endAt=0;
function gate(delay,fn,label){gates.push({t:clock+delay-.001,fn,label});gates.sort((a,b)=>a.t-b.t);}
function release(){if(!waiting) return;waiting=false;const g=gates.shift();if(g.fn) g.fn();renderHUD();}
function at(delay,fn){tasks.push({start:clock+delay,dur:0,fn});}
function tween(delay,dur,fn,easing){tasks.push({start:clock+delay,dur,fn,easing});}
function clearTasks(){tasks.forEach(t=>t.dead=true);tasks=[];temps.forEach(o=>o.parent&&o.parent.remove(o));temps=[];liveTimer=null;gates=[];waiting=false;stepping=false;realSpeed=false;if(typeof speedLabel!=="undefined"&&speedLabel){speedLabel.visible=false;speedLabel.material.opacity=0;}stageGoal=0;waveOn=0;softs=[];readUntil=0;openAt=Infinity;}
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
scene.fog=new THREE.FogExp2(0xb9d3ea,.0026);
const camera=new THREE.PerspectiveCamera(45,1,.05,1700);
const pmrem=new THREE.PMREMGenerator(renderer);
const roomEnv=pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.environment=roomEnv;
let skyEnv=null,skyMesh=null,skyInfo=null;
const bgColor=new THREE.Color(0xb9d3ea);
scene.background=bgColor;

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
function resize(){
  const w=window.innerWidth,h=window.innerHeight;
  if(!w||!h) return;
  renderer.setSize(w,h,false);composer.setSize(w,h);
  camera.aspect=w/h;camera.fov=camera.aspect<1?60:45;camera.setViewOffset(w,h,0,-Math.round(h*VOFF()),w,h);camera.updateProjectionMatrix();
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
  (o.parent||scene).add(m);return m;
}
function cyl(r0,r1,h,mat,x,y,z,seg=20,parent=scene){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function beam(p0,p1,r,mat,parent=scene){
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
  const sp=textSprite(ui.labels[key],size,o);sp.position.set(x,y,z);scene.add(sp);labels.push({sp,key});return sp;
}
function glowTex(){
  const ct=canvasTex(128,128,(g)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.35,"rgba(255,255,255,.35)");gr.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=gr;g.fillRect(0,0,128,128);});
  ct.redraw();return ct.tex;
}
const GLOW=glowTex();
/* the opening screen's little 3D model of the whole trip (see intro.js) */
const introFx=createIntro(scene,GLOW);
let introOn=true;
const tappables=[],placed={},LAMP_ROT=0;
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
  skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1300,32,24),new THREE.MeshBasicMaterial({map:st.tex,side:THREE.BackSide,fog:false,depthWrite:false})));
  const pos=[];
  for(let i=0;i<900;i++){const a=Math.random()*Math.PI*2,e=.12+Math.random()*1.4;pos.push(Math.cos(a)*Math.cos(e)*1200,Math.sin(e)*1200,Math.sin(a)*Math.cos(e)*1200);}
  const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  skyGroup.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,fog:false,transparent:true,opacity:0,depthWrite:false})));
  const sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xfff2cc,blending:THREE.AdditiveBlending,fog:false,depthWrite:false,opacity:.95}));
  sunGlow.position.set(1018,360,-275);sunGlow.scale.set(420,420,1);skyGroup.add(sunGlow);
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
  intro:{fog:0x060a1c,den:.014,sun:1.1,hemi:.75,fill:0,exp:1.02,env:.55},
  out:{fog:0xb9d3ea,den:.0026,sun:1.9,hemi:1.5,fill:0,exp:.95,env:.6},
  room:{fog:0xb9d3ea,den:.0026,sun:.55,hemi:1.25,fill:0,exp:.92,env:.5},
  sea:{fog:0x050d38,den:.026,sun:.75,hemi:.5,fill:10,exp:1.05,env:.12},
  dc:{fog:0x070a12,den:.011,sun:0,hemi:.6,fill:34,exp:1.05,env:.32},
  model:{fog:0x07061c,den:.009,sun:0,hemi:.7,fill:26,exp:1.05,env:.3},
  space:{fog:0x020617,den:0,sun:2.6,hemi:.5,fill:0,exp:1.05,env:.08}
};
const zoneCur={fog:new THREE.Color(0xb9d3ea),den:.0026,sun:.55,hemi:1.25,fill:0,exp:.92,env:.5};
const zoneCol=new THREE.Color();
function zoneOf(p){
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
let ocean=null,underSea=null;
const seaY=x=>(x<=130||x>=250)?0:-14*Math.pow(Math.sin(Math.PI*(x-130)/120),.7);
{
  const gt=canvasTex(256,256,(g,w,h)=>{
    g.fillStyle="#2c3b2c";g.fillRect(0,0,w,h);
    for(let i=0;i<5000;i++){g.fillStyle=["rgba(70,100,60,.5)","rgba(20,30,20,.5)","rgba(90,90,60,.35)"][i%3];g.fillRect(Math.random()*w,Math.random()*h,2,2);}
  });gt.redraw();gt.tex.wrapS=gt.tex.wrapT=THREE.RepeatWrapping;gt.tex.repeat.set(90,140);
  const gm=M(0xffffff,{r:1,env:.1});gm.map=gt.tex;
  pbr(gm,"forrest_ground_01",{rough:true,repeat:[86,140]});
  [[-85,430],[475,450]].forEach(([cx,w])=>{
    const p=new THREE.Mesh(new THREE.PlaneGeometry(w,700),gm);p.rotation.x=-Math.PI/2;p.position.set(cx,-.02,0);p.receiveShadow=true;scene.add(p);
  });
  const sb=new THREE.PlaneGeometry(120,700,40,1);sb.rotateX(-Math.PI/2);
  const pa=sb.attributes.position;
  for(let i=0;i<pa.count;i++) pa.setY(i,seaY(pa.getX(i)+190)-.02);
  sb.computeVertexNormals();
  const rip=canvasTex(256,256,(g,w,h)=>{
    const im=g.createImageData(w,h),TAU=Math.PI*2;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const v=.5+.5*Math.sin(TAU*8*x/w+.9*Math.sin(TAU*y/h)+.5*Math.sin(TAU*3*y/h+1)),k=(y*w+x)*4,c=125+105*v;
      im.data[k]=c*.62;im.data[k+1]=c*.72;im.data[k+2]=c;im.data[k+3]=255;
    }
    g.putImageData(im,0,0);
  });rip.redraw();rip.tex.wrapS=rip.tex.wrapT=THREE.RepeatWrapping;rip.tex.repeat.set(26,150);
  const sandMat=new THREE.MeshStandardMaterial({color:0x2c3fa8,map:rip.tex,bumpMap:rip.tex,bumpScale:1.6,roughness:.92,metalness:0,envMapIntensity:.05});
  const seabed=new THREE.Mesh(sb,sandMat);seabed.position.x=190;seabed.receiveShadow=true;scene.add(seabed);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(120,700),new THREE.MeshStandardMaterial({color:0x1d5f8f,roughness:.16,metalness:.1,transparent:true,opacity:.82,side:THREE.DoubleSide,envMapIntensity:.6}));
  water.rotation.x=-Math.PI/2;water.position.set(190,-.15,0);scene.add(water);underSea=water;
  texLoader.load("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg",wn=>{
    wn.wrapS=wn.wrapT=THREE.RepeatWrapping;
    ocean=new Water(new THREE.PlaneGeometry(120,700),{textureWidth:512,textureHeight:512,waterNormals:wn,sunDirection:SUN_DIR.clone(),sunColor:0x5f7f95,waterColor:0x0b5c8c,distortionScale:1.2,fog:true});
    ocean.rotation.x=-Math.PI/2;ocean.position.set(190,-.15,0);ocean.material.uniforms.size.value=.5;scene.add(ocean);
  });
  /* rocks + drifting specks under water */
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),M(0x0c1236,{r:.95,env:.05}),420),d=new THREE.Object3D();
  for(let i=0;i<420;i++){const x=134+Math.random()*112,near=i<300,zz=near?.9+Math.random()*9:10+Math.random()*16,sc=near?.07+Math.random()*.3:.4+Math.random()*1.3;d.position.set(x,seaY(x)+sc*.25,(Math.random()<.5?-1:1)*zz);d.scale.set(sc*(.8+Math.random()*.6),sc*(.5+Math.random()*.4),sc*(.8+Math.random()*.6));d.rotation.set(Math.random()*3,Math.random()*3,0);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);}
  scene.add(rocks);
  /* low dark hills at the edge of sight */
  const hills=new THREE.InstancedMesh(new THREE.SphereGeometry(1,18,10),M(0x0a1140,{r:1,env:.03}),16);
  for(let i=0;i<16;i++){const x=136+i*7+Math.random()*4;d.position.set(x,seaY(x)-1,(i%2?-1:1)*(27+Math.random()*12));d.scale.set(11+Math.random()*9,3+Math.random()*4.5,8+Math.random()*6);d.rotation.set(0,Math.random()*3,0);d.updateMatrix();hills.setMatrixAt(i,d.matrix);}
  scene.add(hills);
  const sp=[];for(let i=0;i<1500;i++){const x=132+Math.random()*116;sp.push(x,seaY(x)+Math.random()*(-seaY(x)),(Math.random()-.5)*36);}
  const spg=new THREE.BufferGeometry();spg.setAttribute("position",new THREE.Float32BufferAttribute(sp,3));
  scene.add(new THREE.Points(spg,new THREE.PointsMaterial({map:GLOW,color:0xdfe8ff,size:.13,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending})));
  /* trees + far hills */
  /* fir trees built from real twig and bark photos (see nature.js) */
  const spots=[];
  while(spots.length<300){
    const land2=Math.random()<.3,x=land2?252+Math.random()*190:-60+Math.random()*186,z=(Math.random()-.5)*190,s=.7+Math.random()*.9;
    if(Math.abs(z)<11) continue;
    if(x>296&&x<404&&Math.abs(z)<31) continue;
    if(Math.abs(x)<7&&Math.abs(z)<7) continue;
    if(Math.hypot(x-42,z+8)<11) continue;           /* keep the cell tower's fenced yard clear */
    spots.push({x,z,s,rot:Math.random()*6.28});
  }
  createForest(scene,spots);
  /* undergrowth: real grass, ferns, shrubs and mossy rocks (Poly Haven, CC0), scattered where the camera goes */
  {
    let seed=99;const R=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
    const clear=(x,z)=>!(x>34.4&&x<49.6&&z>-16.6&&z<-3)&&!(x>260&&x<302&&Math.abs(z)<15.5)&&!(Math.abs(x)<2.5&&Math.abs(z)<2.5)&&!(x>296&&x<404&&Math.abs(z)<31)&&!(x>127&&x<253);
    const ring=(n,cx,cz,r0,r1)=>{const out=[];let tries=0;while(out.length<n&&tries++<n*30){const a=R()*6.283,r=r0+(r1-r0)*Math.sqrt(R()),x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(clear(x,z)) out.push({x,z,rot:R()*6.28});}return out;};
    const spread=(n,lo,hi)=>[...ring(n*.5,42,-8,1.2,26),...ring(n*.28,14,0,3.5,24),...ring(n*.22,280,2,3,20)].map(q=>({...q,s:lo+R()*(hi-lo)}));
    plant("grass_medium_02",m=>scatter(scene,m,spread(380,1.5,2.8),{cast:false,maxTris:1800}));
    plant("fern_02",m=>scatter(scene,m,spread(90,1.1,2)));
    plant("shrub_03",m=>scatter(scene,m,spread(60,1.2,2.2)));
    /* mossy rocks, one at each spot */
    model("rock_moss_set_01",m=>scatter(scene,m,[[24,-22],[60,-19],[58,9],[26,12],[12,-17],[-9,14],[254,-19],[256,20],[84,-24],[100,13],[33,-2],[51,-12],[70,6],[18,-9],[8,12],[90,-9]].map(([x,z])=>({x,z,rot:R()*6.28,s:.6+R()*.7,y:-.12})),{maxTris:11500}));
    /* gravel inside the fenced yard */
    const gv=canvasTex(256,256,(g,w,h)=>{g.fillStyle="#8d8a84";g.fillRect(0,0,w,h);for(let i=0;i<5200;i++){const v=90+Math.floor(R()*110);g.fillStyle=`rgb(${v},${v-3},${v-8})`;const r=1+R()*2.6;g.beginPath();g.ellipse(R()*w,R()*h,r,r*(.6+R()*.4),R()*3,0,7);g.fill();}});
    gv.redraw();gv.tex.wrapS=gv.tex.wrapT=THREE.RepeatWrapping;gv.tex.repeat.set(9,8);
    const yard=new THREE.Mesh(new THREE.PlaneGeometry(14,12.4),new THREE.MeshStandardMaterial({map:gv.tex,bumpMap:gv.tex,bumpScale:.6,roughness:.97,envMapIntensity:.08}));
    yard.rotation.x=-Math.PI/2;yard.position.set(42,.012,-9.8);yard.receiveShadow=true;scene.add(yard);
  }
  const hill=M(0x5f8a57,{r:1,env:.05});
  [[-40,-190,90,26],[70,210,110,30],[180,-240,120,34],[330,230,130,30],[430,-210,120,28],[-120,160,100,24]].forEach(([x,z,s,h])=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),hill);m.scale.set(s,h,s*.7);m.position.set(x,-4,z);scene.add(m);
  });
}

/* a town at each end of the trip (see city.js) */
createCity(scene,[[-70,112,-150,-58],[-70,112,58,150],[256,440,-160,-64],[256,440,64,160]]);

/* phone screen */
/* a soft diagonal reflection, as on real glass */
function glare(g,w,h){const gr=g.createLinearGradient(w*.1,0,w*.95,h*.55);gr.addColorStop(0,"rgba(255,255,255,0)");gr.addColorStop(.46,"rgba(255,255,255,0)");gr.addColorStop(.5,"rgba(190,215,255,.16)");gr.addColorStop(.62,"rgba(190,215,255,.05)");gr.addColorStop(.63,"rgba(255,255,255,0)");g.fillStyle=gr;g.fillRect(0,0,w,h);}
let phoneState={mode:"draft",bits:null,words:[]};
function drawPhone(g,w,h,photo=false,press=0){
  const s=phoneState,lines=s.cipher||s.bits||ui.promptLines,L=ui.labels,ink="#0d0d0d",soft="#9a9a9a";
  /* black glass with a rounded display, like a modern phone */
  g.save();
  if(!photo){
    g.fillStyle="#000";g.fillRect(0,0,w,h);
    g.beginPath();g.roundRect(15,15,w-30,h-30,64);g.clip();
    g.fillStyle="#fcfcfc";g.fillRect(0,0,w,h);
  }
  /* status bar: time with the location arrow, pill cut-out, signal, Wi-Fi, battery */
  g.textBaseline="middle";g.textAlign="left";g.fillStyle=ink;g.font=`700 31px ${FONT}`;g.fillText("6:26",58,64);
  g.beginPath();g.moveTo(143,53);g.lineTo(124,62);g.lineTo(134,65);g.lineTo(137,75);g.closePath();g.fill();
  if(!photo){
    rr(g,w/2-78,40,156,46,23,"#000");
    /* front camera lens inside the island */
    {const cx=w/2+52,cy=63,gr=g.createRadialGradient(cx-3,cy-3,1,cx,cy,11);gr.addColorStop(0,"#3a4d7a");gr.addColorStop(.5,"#141b30");gr.addColorStop(1,"#05070d");g.fillStyle=gr;g.beginPath();g.arc(cx,cy,11,0,7);g.fill();g.fillStyle="rgba(140,170,255,.55)";g.beginPath();g.arc(cx-3.5,cy-3.5,2.6,0,7);g.fill();}
  }
  g.fillStyle=ink;[0,1,2,3].forEach(i=>g.fillRect(372+i*11,74-10-i*5,7,10+i*5));
  g.lineWidth=5;g.lineCap="round";g.strokeStyle=ink;
  [9,19,29].forEach(r=>{g.beginPath();g.arc(435,76,r,-Math.PI*.75,-Math.PI*.25);g.stroke();});
  g.beginPath();g.arc(435,76,3,0,7);g.fill();
  g.lineWidth=3;g.strokeStyle="rgba(13,13,13,.45)";g.beginPath();g.roundRect(462,52,44,24,7);g.stroke();
  g.fillStyle=ink;g.beginPath();g.roundRect(465,55,34,18,4);g.fill();g.fillRect(508,60,3,8);
  /* a white floating button or card with a soft shadow, as in the app */
  const card=(x,y,cw,ch,r)=>{
    g.save();g.shadowColor="rgba(0,0,0,.13)";g.shadowBlur=22;g.shadowOffsetY=5;
    g.beginPath();g.roundRect(x,y,cw,ch,r);g.fillStyle=photo?"rgba(255,255,255,.78)":"#fff";g.fill();g.restore();
    g.beginPath();g.roundRect(x,y,cw,ch,r);g.lineWidth=1.5;g.strokeStyle="rgba(0,0,0,.09)";g.stroke();
  };
  /* top left: the menu button with its green dot. top right: voice and private-chat buttons */
  card(25,103,58,58,29);
  g.strokeStyle=ink;g.lineWidth=3.4;g.lineCap="round";
  g.beginPath();g.moveTo(43,126);g.lineTo(54,126);g.moveTo(43,138);g.lineTo(60,138);g.stroke();
  g.fillStyle="#a4d82b";g.beginPath();g.arc(63,123,5.4,0,7);g.fill();
  card(386,104,130,56,28);
  g.strokeStyle=ink;g.lineWidth=3.2;
  [[407,7],[415,13],[423,9],[431,4]].forEach(([x,hh])=>{g.beginPath();g.moveTo(x,132-hh);g.lineTo(x,132+hh);g.stroke();});
  g.lineWidth=2.8;g.lineJoin="round";
  g.beginPath();g.moveTo(471,131);g.lineTo(501,131);g.moveTo(476,131);g.lineTo(479,119);g.lineTo(493,119);g.lineTo(496,131);g.stroke();
  g.beginPath();g.arc(479,141,5,0,7);g.moveTo(498,141);g.arc(493,141,5,0,7);g.moveTo(484,141);g.lineTo(488,141);g.stroke();
  /* home bar */
  g.fillStyle="#111";g.beginPath();g.roundRect(w/2-92,h-40,184,9,5);g.fill();
  /* the row at the bottom of the message box: plus, the model's name, and a button on the right */
  const tools=(y)=>{
    g.strokeStyle=ink;g.lineWidth=3.2;g.lineCap="round";
    g.beginPath();g.moveTo(34,y);g.lineTo(58,y);g.moveTo(46,y-12);g.lineTo(46,y+12);g.stroke();
    g.textAlign="left";g.font=`600 21px ${FONT}`;g.fillStyle=ink;g.fillText(L.model,88,y+1);
    const mw=g.measureText(L.model).width;g.font=`500 21px ${FONT}`;g.fillStyle=soft;g.fillText(L.effort,88+mw+7,y+1);
  };
  const mic=(x,y)=>{
    g.strokeStyle=ink;g.lineWidth=3;g.lineCap="round";
    g.beginPath();g.roundRect(x-6,y-15,12,21,6);g.stroke();
    g.beginPath();g.arc(x,y-2,12,.15*Math.PI,.85*Math.PI);g.stroke();
    g.beginPath();g.moveTo(x,y+10);g.lineTo(x,y+16);g.stroke();
  };
  if(s.mode==="draft"){
    /* greeting in the middle, as on the app's empty chat */
    g.textAlign="center";g.fillStyle="#111";g.font=`500 28px ${FONT}`;g.fillText(L.greet,w/2,352);
    g.fillStyle="#5b5b5b";g.fillText(L.greet2,w/2,392);
    /* the message box with the typed question; the Send button replaces the microphone once there is text */
    const sendX=photo?378:w-64,sendY=h-190;
    card(16,sendY-126,w-32,172,34);
    g.fillStyle=ink;g.textAlign="left";g.font=`500 33px ${FONT}`;
    g.fillText(lines[0],42,sendY-86,sendX-70);g.fillText(lines[1],42,sendY-46,sendX-110);
    tools(sendY);
    /* tap feedback: as the thumb lands the button sinks and darkens, and a ripple spreads out from it */
    const down=smooth(.7,1,press),R=37;
    if(tapFx>0&&tapFx<1){
      const q=1-Math.pow(1-tapFx,2);
      g.save();g.translate(sendX,sendY);
      g.beginPath();g.arc(0,0,R+100*q,0,Math.PI*2);g.fillStyle=`rgba(10,132,255,${(.2*(1-q)).toFixed(3)})`;g.fill();
      g.beginPath();g.arc(0,0,R+100*q,0,Math.PI*2);g.strokeStyle=`rgba(10,132,255,${(.75*(1-q)).toFixed(3)})`;g.lineWidth=3+9*(1-q);g.stroke();
      g.restore();
    }
    g.save();g.translate(sendX,sendY);g.scale(1-.13*down,1-.13*down);
    g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.fillStyle=`rgb(${Math.round(10-10*down)},${Math.round(132-62*down)},${Math.round(255-95*down)})`;g.fill();
    g.strokeStyle="#fff";g.lineWidth=8;g.lineCap="round";g.lineJoin="round";
    g.beginPath();g.moveTo(0,18);g.lineTo(0,-18);g.moveTo(-17,-2);g.lineTo(0,-19);g.lineTo(17,-2);g.stroke();g.restore();
    if(!photo) glare(g,w,h);
    g.restore();return;
  }
  /* after sending: the question as a bubble on the right, the answer below it, an empty message box at the bottom */
  rr(g,w-24-372,196,372,128,40,s.cipher?"#1c2540":"#0a84ff");
  if(s.cipher){g.font="50px sans-serif";g.textAlign="center";g.fillText("🔒",w-24-372-40,262);}
  g.textAlign="center";g.fillStyle=s.cipher?"#9fb4ff":"#fff";g.font=`600 36px ${s.bits||s.cipher?MONO:FONT}`;g.fillText(lines[0],w-24-186,238,340);g.fillText(lines[1],w-24-186,284,340);
  card(16,h-262,w-32,118,34);
  g.fillStyle=soft;g.textAlign="left";g.font=`500 30px ${FONT}`;g.fillText(L.ask,42,h-226);
  tools(h-180);mic(w-48,h-180);
  if(s.mode==="answer"){
    g.font=`500 38px ${FONT}`;g.textAlign="left";
    const out=[""];
    s.words.forEach(wd=>{const cur=out[out.length-1],t=cur?cur+" "+wd:wd;if(cur&&g.measureText(t).width>430) out.push(wd); else out[out.length-1]=t;});
    if(!s.words.length) out[0]="…";
    g.fillStyle=ink;out.forEach((l,i)=>g.fillText(l,40,392+i*54));
  }
  if(!photo) glare(g,w,h);
  g.restore();
}
const phoneTex=canvasTex(540,1166,drawPhone);
let photoGrip,hand;
let thumbPress=0,tapFx=0;
function redrawPhone(){
  if(photoGrip?.ready) photoGrip.redraw(thumbPress);
  else phoneTex.redraw();
}
function setThumb(p){
  thumbPress=p;
  if(photoGrip?.ready) photoGrip.redraw(p);
  else hand?.pose(p);
}
{
  const wall=pbr(M(0xd8d0c2,{r:.95}),"beige_wall_001",{tint:0xe6ddcf}),white=M(0xcfcbc2,{r:.9,env:.1});
  const floorM=pbr(M(0x8a6748,{r:.85,env:.15}),"laminate_floor_02"),wood=pbr(M(0x6e4a2f,{r:.82,env:.15}),"wood_table_001");
  const WT={tile:2};
  bx(-2.15,2.15,-.12,0,-2.15,2.15,floorM,{tile:1.6});
  bx(-2.15,2.15,2.6,2.75,-2.15,2.15,wall,WT);
  bx(-2.15,-2,0,2.6,-2.15,2.15,wall,WT);
  bx(-2,2,0,2.6,-2.15,-2,wall,WT);bx(-2,2,0,2.6,2,2.15,wall,WT);
  bx(2,2.15,0,1,-2.15,2.15,wall,WT);bx(2,2.15,2.1,2.6,-2.15,2.15,wall,WT);
  /* the opening in that wall is a window: sill, frame, bars and glass, so it reads as a room looking out at the tower */
  {
    const fr=M(0xf1efe9,{r:.55,env:.3}),glass=new THREE.MeshStandardMaterial({color:0xd6ecff,transparent:true,opacity:.1,roughness:.04,metalness:0,envMapIntensity:1.4,depthWrite:false});
    bx(1.93,2.19,.985,1.02,-2.02,2.02,fr,{cast:false});                 /* sill */
    bx(2.04,2.1,1.02,1.06,-2,2,fr,{cast:false});bx(2.04,2.1,2.06,2.1,-2,2,fr,{cast:false});
    [-2,-1,-.33,.33,1,2].forEach(z=>bx(2.04,2.1,1.02,2.1,z-.022,z+.022,fr,{cast:false}));
    bx(2.055,2.085,1.72,1.75,-2,2,fr,{cast:false});                     /* cross bar */
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(4,1.04),glass);pane.rotation.y=-Math.PI/2;pane.position.set(2.07,1.56,0);pane.renderOrder=2;scene.add(pane);
  }
  bx(2,2.15,1,2.1,-2.15,-.75,wall,WT);bx(2,2.15,1,2.1,.75,2.15,wall,WT);
  bx(1.94,2.21,.96,1,-.82,.82,white);bx(1.97,2.18,2.1,2.14,-.82,.82,white);
  bx(1.97,2.18,1,2.1,-.79,-.75,white);bx(1.97,2.18,1,2.1,.75,.79,white);
  const roofShape=new THREE.Shape();roofShape.moveTo(-2.5,0);roofShape.lineTo(2.5,0);roofShape.lineTo(0,1.45);roofShape.closePath();
  const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape,{depth:4.8,bevelEnabled:false}),pbr(M(0x5a2f2a,{r:.9}),"clay_roof_tiles_02",{repeat:[.7,.7]}));
  roof.rotation.y=Math.PI/2;roof.position.set(-2.4,2.75,0);roof.castShadow=true;scene.add(roof);
  /* desk and things on it */
  bx(1.22,1.98,.71,.75,-.95,.95,wood,{tile:1});
  [[1.27,-.9],[1.27,.9],[1.93,-.9],[1.93,.9]].forEach(([x,z])=>bx(x-.025,x+.025,0,.71,z-.025,z+.025,wood));
  const dark=M(0x14161b,{r:.3,m:.8,env:1});
  const lampParts=[cyl(.075,.085,.016,dark,1.72,.758,-.6),cyl(.008,.008,.4,dark,1.72,.95,-.6,8)];
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.05,.115,.13,24,1,true),new THREE.MeshStandardMaterial({color:0xf6e6c8,emissive:0xffc98a,emissiveIntensity:.22,side:THREE.DoubleSide,roughness:.9}));
  shade.position.set(1.72,1.18,-.6);scene.add(shade);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.026,12,12),E(0xffd9a0,1.6));bulb.position.set(1.72,1.15,-.6);scene.add(bulb);
  const lamp=new THREE.PointLight(0xffc98a,.45,7,2);lamp.position.set(1.72,1.1,-.6);scene.add(lamp);
  /* the room's ceiling light: the one that casts the soft shadows of the hand, phone, router and plant onto the desk */
  const key=new THREE.SpotLight(0xfff1dc,5,6,.62,.7,2);key.position.set(1.02,2.4,-.5);key.target.position.set(1.62,.75,.16);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.near=.4;key.shadow.camera.far=4.5;key.shadow.bias=-.0006;key.shadow.normalBias=.012;
  scene.add(key,key.target);
  lampParts.push(shade,bulb);
  model("desk_lamp_arm_01",m=>{lampParts.forEach(o=>o.visible=false);m.position.set(1.76,.75,-.62);m.rotation.y=LAMP_ROT;scene.add(m);placed.lamp=m;});
  model("potted_plant_04",m=>{m.position.set(1.9,.75,-.46);scene.add(m);placed.plant=m;});
  cyl(.04,.036,.09,M(0x2a7f86,{r:.35,env:.6}),1.6,.795,.52);
  bx(1.66,1.9,.75,.78,.58,.76,M(0x8b3a3a,{r:.7}));bx(1.68,1.9,.78,.805,.6,.75,M(0x2f4f7f,{r:.7}));
  /* wifi router */
  bx(1.8,1.9,.75,.778,.16,.34,M(0xd2d4d8,{r:.85,env:.1}));
  cyl(.004,.004,.11,dark,1.87,.83,.18,6);cyl(.004,.004,.11,dark,1.87,.83,.32,6);
  const led=new THREE.Mesh(new THREE.SphereGeometry(.004,8,8),E(0x4ade80,4));led.position.set(1.798,.766,.25);scene.add(led);
  label("wifi",1.86,.95,.25,.034);
  /* phone */
  const outer=new THREE.Group();outer.position.set(1.5,.88,0);outer.rotation.y=-Math.PI/2;scene.add(outer);
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
  /* charging port and speaker holes on the bottom edge */
  bx(-.0045,.0045,-.0792,-.0786,-.0012,.0012,dark,{parent:phoneBody,cast:false});
  [-.022,-.018,-.014,.014,.018,.022].forEach(x=>bx(x-.0008,x+.0008,-.0792,-.0786,-.0008,.0008,dark,{parent:phoneBody,cast:false}));
  photoGrip=createPhotoGrip(inner,drawPhone,{onReady:()=>{
    phoneBody.visible=false;
    redrawPhone();
  },onError:()=>{
    hand=createHand(phoneBody);
    hand.pose(thumbPress);
  }});
  // Keep the existing screen geometry as the tap target for both renderings.
  tap(phoneScreen,()=>(current===0||current===HOME)&&!done&&!busy,()=>mainAction());
}

/* =====================================================================
   WORLD: tower, cables, DNS, routers
   ===================================================================== */
let beacon,towerCab;
{
  const steel=M(0x8b929c,{m:.7,r:.5,env:.7}),tw=new THREE.Group();tw.position.set(42,0,-8);scene.add(tw);
  const hw=h=>2.2-1.7*h/28,corner=(h,i)=>V([1,1,-1,-1][i]*hw(h),h,[1,-1,-1,1][i]*hw(h));
  for(let i=0;i<4;i++){
    beam(corner(0,i),corner(28,i),.09,steel,tw);
    for(let l=0;l<7;l++){beam(corner(l*4+4,i),corner(l*4+4,(i+1)%4),.04,steel,tw);beam(corner(l*4,i),corner(l*4+4,(i+1)%4),.035,steel,tw);}
  }
  cyl(1.1,1.1,.12,steel,0,26.2,0,16,tw);cyl(.09,.09,5.4,steel,0,28.6,0,8,tw);
  for(let i=0;i<3;i++){const a=i*2.1,p=bx(-.18,.18,26.6,28.3,-.08,.08,M(0xbfc3ca,{r:.85,env:.1}),{parent:tw});p.position.set(Math.cos(a)*.95,27.4,Math.sin(a)*.95);p.rotation.y=-a+Math.PI/2;}
  beacon=new THREE.Mesh(new THREE.SphereGeometry(.2,12,12),E(0xff3b3b,4));beacon.position.set(0,31.5,0);tw.add(beacon);
  const vent=E(0xffb84a,.6),cl=new THREE.PointLight(0xffb84a,0,16,2);cl.position.set(44.9,1.3,-4.2);scene.add(cl);
  bx(44.3,45.5,0,1.8,-5.9,-5,M(0xaeb5c0,{r:.85,env:.1}));bx(45.7,46.5,0,1.3,-5.8,-5.1,M(0x9fa7b3,{r:.85,env:.1}));
  [.45,.7,.95,1.2,1.45].forEach(y=>bx(44.42,45.38,y,y+.11,-5.0,-4.985,vent,{cast:false}));
  towerCab={m:vent,l:cl};
  /* ---- the tower's working parts: footings, antennas, dishes, ladder, cables, railing ---- */
  {
    const white=M(0xe8eaed,{r:.55,env:.4}),grey=M(0x6f7780,{m:.6,r:.5,env:.6}),blk=M(0x15171b,{r:.7,env:.2}),conc=M(0x9b9a95,{r:.96,env:.05});
    for(let i=0;i<4;i++){const c=corner(0,i);bx(c.x-.5,c.x+.5,0,.32,c.z-.5,c.z+.5,conc,{parent:tw});bx(c.x-.2,c.x+.2,.32,.4,c.z-.2,c.z+.2,grey,{parent:tw,cast:false});}
    /* three antenna sectors: a pipe frame, two tall panels each, a radio unit behind every panel */
    for(let k=0;k<3;k++){
      const g=new THREE.Group();g.rotation.y=k*2.094+.5;g.position.y=22.9;tw.add(g);
      beam(V(.3,.2,0),V(1.7,.2,0),.05,grey,g);beam(V(.3,2.2,0),V(1.7,2.2,0),.05,grey,g);
      beam(V(1.7,.2,-.8),V(1.7,.2,.8),.045,grey,g);beam(V(1.7,2.2,-.8),V(1.7,2.2,.8),.045,grey,g);
      beam(V(.3,.2,0),V(1.7,2.2,0),.03,grey,g);
      [-.6,.6].forEach(z=>{
        cyl(.045,.045,3.1,grey,1.7,1.2,z,8,g);
        const pn=bx(1.8,1.95,-.15,2.55,z-.18,z+.18,white,{parent:g});pn.rotation.z=-.05;
        bx(1.795,1.8,-.1,2.5,z-.14,z+.14,grey,{parent:g,cast:false});
        bx(1.5,1.64,.45,1.05,z-.14,z+.14,grey,{parent:g});
        beam(V(1.57,.45,z),V(1.2,-.4,z*.5),.018,blk,g);
      });
    }
    /* two microwave dishes linking this tower to the next ones */
    [[19.2,.2],[15.4,2.5]].forEach(([y,az])=>{
      const g=new THREE.Group();g.rotation.y=az;g.position.y=y;tw.add(g);
      const r=hw(y)+.15,drum=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.34,28),white);
      drum.rotation.z=Math.PI/2;drum.position.set(r+.55,0,0);drum.castShadow=true;g.add(drum);
      const back=new THREE.Mesh(new THREE.CylinderGeometry(.3,.6,.22,20),grey);back.rotation.z=-Math.PI/2;back.position.set(r+.28,0,0);g.add(back);
      beam(V(r-.3,0,0),V(r+.2,0,0),.06,grey,g);beam(V(r-.2,-.5,-.6),V(r-.2,-.5,.6),.04,grey,g);
    });
    /* ladder up one face, with the feeder cables running beside it */
    const lad=canvasTex(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle="#a7adb6";g.fillRect(8,0,7,h);g.fillRect(49,0,7,h);[6,27,48].forEach(y=>g.fillRect(8,y,48,5));});
    lad.redraw();lad.tex.wrapS=lad.tex.wrapT=THREE.RepeatWrapping;lad.tex.repeat.set(1,30);
    const ladder=new THREE.Mesh(new THREE.PlaneGeometry(.5,26.05),new THREE.MeshStandardMaterial({map:lad.tex,alphaTest:.5,side:THREE.DoubleSide,metalness:.6,roughness:.45,envMapIntensity:.6}));
    ladder.position.set(0,13,1.47);ladder.rotation.x=-.0607;tw.add(ladder);
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
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(.24,.18),new THREE.MeshStandardMaterial({map:sign.tex,roughness:.6,envMapIntensity:.2}));sg.position.set(45.18,1.52,-4.981);scene.add(sg);
    [0x4ade80,0x4ade80,0xffb84a].forEach((c,k)=>{const l=bx(44.46+k*.07,44.5+k*.07,1.6,1.64,-4.992,-4.98,E(c,3),{cast:false});l.userData.blink=k+7;});
    /* the smaller box: a fan grille on its front */
    const fan=canvasTex(128,128,(g,w,h)=>{g.fillStyle="#8d95a1";g.fillRect(0,0,w,h);g.fillStyle="#1b1e24";g.beginPath();g.arc(64,64,52,0,7);g.fill();g.strokeStyle="#8d95a1";g.lineWidth=5;for(let r=10;r<52;r+=10){g.beginPath();g.arc(64,64,r,0,7);g.stroke();}g.lineWidth=6;g.beginPath();g.moveTo(8,64);g.lineTo(120,64);g.moveTo(64,8);g.lineTo(64,120);g.stroke();});
    fan.redraw();
    const fg=new THREE.Mesh(new THREE.PlaneGeometry(.52,.52),new THREE.MeshStandardMaterial({map:fan.tex,roughness:.7,metalness:.3,envMapIntensity:.3}));fg.position.set(46.1,.78,-5.095);scene.add(fg);
    /* conduits: cabinet to cabinet, cabinet to the tower leg, and down into the ground */
    beam(V(45.5,.45,-5.5),V(45.7,.45,-5.5),.05,grey);beam(V(45.5,.95,-5.5),V(45.7,.95,-5.5),.035,blk);
    [-5.72,-5.62,-5.52].forEach(z=>beam(V(44.3,1.45,z),V(44.14,2.2,z-.18),.028,blk));
    cyl(.06,.06,.5,grey,46.62,.25,-5.45,10);beam(V(46.5,.5,-5.45),V(46.62,.5,-5.45),.06,grey);
  }
  /* ---- chain-link fence round the back and sides of the yard ---- */
  {
    const link=canvasTex(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle="#b9bec6";g.lineWidth=3.2;g.beginPath();for(let k=-64;k<=64;k+=32){g.moveTo(k,0);g.lineTo(k+64,64);g.moveTo(k+64,0);g.lineTo(k,64);}g.stroke();});
    link.redraw();link.tex.wrapS=link.tex.wrapT=THREE.RepeatWrapping;
    const post=M(0x8f969f,{m:.7,r:.45,env:.6});
    const run=(x0,z0,x1,z1)=>{
      const len=Math.hypot(x1-x0,z1-z0),t=link.tex.clone();t.needsUpdate=true;t.repeat.set(len/.22,2/.22);
      const mat=new THREE.MeshStandardMaterial({map:t,alphaTest:.3,side:THREE.DoubleSide,metalness:.7,roughness:.4,envMapIntensity:.7});mat.alphaToCoverage=true;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(len,2),mat);m.position.set((x0+x1)/2,1.02,(z0+z1)/2);m.rotation.y=-Math.atan2(z1-z0,x1-x0);m.castShadow=true;scene.add(m);
      const n=Math.round(len/2.4);for(let k=0;k<=n;k++){const u=k/n;cyl(.045,.045,2.2,post,x0+(x1-x0)*u,1.1,z0+(z1-z0)*u,8);}
      beam(V(x0,2.05,z0),V(x1,2.05,z1),.03,post);
    };
    run(35,-16,49,-16);run(35,-16,35,-3.6);run(49,-16,49,-3.6);
  }
  label("tower",42,33.4,-8,1.5);
  tap(tw,...stopTap(1));
}
const cableMat=E(0x35d6ff,1.5);
const curves=[];
const ribs=canvasTex(64,8,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,"#1c2757");gr.addColorStop(.5,"#a9b9f2");gr.addColorStop(1,"#1c2757");g.fillStyle=gr;g.fillRect(0,0,w,h);});
ribs.redraw();ribs.tex.wrapS=ribs.tex.wrapT=THREE.RepeatWrapping;ribs.tex.repeat.set(1100,1);
/* the sea cables are armoured: dark, ribbed, with the light travelling inside */
const seaCableMat=new THREE.MeshStandardMaterial({color:0x4f63c4,map:ribs.tex,bumpMap:ribs.tex,bumpScale:2,roughness:.5,metalness:.35,envMapIntensity:.5,emissive:0x1a2a8a,emissiveIntensity:.25});
function cable(points,r=.07,mat=cableMat,rad=6){
  const c=new THREE.CatmullRomCurve3(points.map(v3),false,"catmullrom",.4);
  const m=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(40,points.length*14),r,rad),mat);scene.add(m);curves.push(c);return c;
}
cable([[43,.1,-7],[55,.1,-3.2],[70,.1,-1.6],[80,.1,-3.6],[90,.1,-3.4],[100,.1,0],[112,.1,0],[120,.12,0]]);
const seaCurves=[-7,0,7].map(zk=>{
  const pts=[[120,.12,0],[126,.12,zk*.08]];
  for(let x=130;x<=250;x+=6){const s=Math.sin(Math.PI*(x-130)/120);pts.push([x,seaY(x)+.13,zk*(.15+.85*s)]);}
  pts.push([256,.12,zk*.08],[262,.12,0]);
  return cable(pts,.15,seaCableMat,14);
});
cable([[262,.12,0],[280,.1,0],[300,.08,0],[313.2,.06,0]]);
const pulses=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,8,8),E(0xffd27a,3.6),curves.length*7);scene.add(pulses);
label("fiber",108,1.5,-.4,.7);
let seaLabel,speedLabel;
{
  const cab=M(0x55606a,{r:.6,m:.3,env:.5}),routerGroups=[];
  [[62,-3.4],[104,1.6],[278,1.8]].forEach(([x,z],i)=>{
    const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
    bx(-.5,.5,0,1.4,-.32,.32,cab,{parent:g});bx(-.56,.56,1.4,1.46,-.38,.38,cab,{parent:g});
    for(let k=0;k<5;k++){const l=bx(-.33+k*.14,-.25+k*.14,1.12,1.18,-.335,-.32,E(k%2?0x35d6ff:0x4ade80,3),{parent:g,cast:false});l.userData.blink=k;}
    const sp=textSprite(ui.labels.router,.6,{plain:true});sp.position.set(x,2.2,z);scene.add(sp);labels.push({sp,key:"router"});
    if(i===1) tap(g,...stopTap(2));
    routerGroups.push(g);
  });
  model("utility_box_01",m=>{routerGroups.forEach(g=>{g.children.forEach(c=>{if(c.userData.blink===undefined) c.visible=false;});const c=m.clone();g.add(c);});placed.box=m;});
  const bunkerM=pbr(M(0x767b82,{r:.9}),"concrete_wall_008");
  [[121,-5.5],[262,-5.5]].forEach(([x,z])=>{bx(x-2.2,x+2.2,0,2.2,z-2.6,z+2.6,bunkerM,{tile:3});bx(x-2.21,x+2.21,1.7,1.8,z-2.61,z+2.61,E(0x35d6ff,1.6),{cast:false});});
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
let secState="idle",laser,greenMats=[],chips=[],nums=[],archStrips;
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
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(40,30),pbr(M(0x3b3f47,{r:.9}),"asphalt_02",{rough:true,repeat:[10,7.5]}));apron.rotation.x=-Math.PI/2;apron.position.set(281,-.005,0);apron.receiveShadow=true;scene.add(apron);
  /* shell */
  bx(300,300.4,0,12,-25,-2,fac,{tile:5});bx(300,300.4,0,12,2,25,fac,{tile:5});bx(300,300.4,4,12,-2,2,fac,{tile:5});
  bx(399.6,400,0,12,-25,25,fac,{tile:5});bx(300,400,0,12,-25.4,-25,fac,{tile:5});bx(300,400,0,12,25,25.4,fac,{tile:5});bx(300,400,12,12.4,-25.4,25.4,fac,{tile:5});
  bx(300.4,399.6,5,5.3,-25,25,inw,{cast:false,tile:5});
  bx(299.92,300,0,4,-2.16,-2,cyan,{cast:false});bx(299.92,300,0,4,2,2.16,cyan,{cast:false});bx(299.92,300,4,4.16,-2.16,2.16,cyan,{cast:false});
  bx(299.92,300,11.3,11.42,-25,25,cyan,{cast:false});bx(299.92,300,8.2,8.26,-25,25,E(0x35d6ff,.9),{cast:false});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(13,1.9),new THREE.MeshBasicMaterial({map:signTex.tex,transparent:true}));
  sign.rotation.y=-Math.PI/2;sign.position.set(299.9,6.2,0);scene.add(sign);
  const cool=new THREE.InstancedMesh(new THREE.BoxGeometry(4,1.6,4),M(0x565d68,{r:.7,m:.3}),27),d=new THREE.Object3D();let n=0;
  for(let x=312;x<=392;x+=10) for(let z=-14;z<=14;z+=14){d.position.set(x,13.2,z);d.updateMatrix();cool.setMatrixAt(n++,d.matrix);}
  cool.castShadow=true;scene.add(cool);
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
      const dr=new THREE.Mesh(new THREE.PlaneGeometry(4.4,4.2),shutM);dr.rotation.y=-Math.PI/2;dr.position.set(299.93,2.1,z);scene.add(dr);
      bx(299.8,300,4.2,4.5,z-2.4,z+2.4,capM,{cast:false});bx(299.8,300,0,4.2,z-2.4,z-2.2,capM,{cast:false});bx(299.8,300,0,4.2,z+2.2,z+2.4,capM,{cast:false});
      [-1.9,-.65,.65,1.9].forEach(dz=>{cyl(.1,.1,1,yellow,298.6,.5,z+dz,10);});
    });
    /* a fan on every roof cooling unit */
    const fanG=new THREE.CylinderGeometry(1.5,1.5,.16,24),fans=new THREE.InstancedMesh(fanG,darkM,27),hubs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.3,.3,.3,12),capM,27),o=new THREE.Object3D();let k=0;
    for(let x=312;x<=392;x+=10) for(let z=-14;z<=14;z+=14){o.position.set(x,14.08,z);o.updateMatrix();fans.setMatrixAt(k,o.matrix);hubs.setMatrixAt(k++,o.matrix);}
    scene.add(fans,hubs);
    /* outside yard: a fuel tank and generators for when the power fails, and parking lines */
    [[-13],[13]].forEach(([z])=>{
      const tank=new THREE.Mesh(new THREE.CapsuleGeometry(1.1,4.2,8,20),whiteM);tank.rotation.x=Math.PI/2;tank.position.set(291,1.55,z*1.25);tank.castShadow=true;scene.add(tank);
      [-1.5,1.5].forEach(dz=>bx(290.4,291.6,0,.5,z*1.25+dz-.15,z*1.25+dz+.15,darkM));
      [0,1].forEach(i=>{const gx=283-i*5.5;bx(gx-2,gx+2,0,2.1,z*1.25-1.1,z*1.25+1.1,M(0x4b6a52,{r:.6,m:.3,env:.4}));bx(gx-1.7,gx+1.7,2.1,2.3,z*1.25-.9,z*1.25+.9,darkM);cyl(.12,.12,1.2,darkM,gx+1.2,2.9,z*1.25,8);});
    });
    const lines=canvasTex(256,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle="rgba(235,235,225,.85)";for(let x=8;x<w;x+=32) g.fillRect(x,0,3,h);});
    lines.redraw();
    [-9.6,9.6].forEach(z=>{const pl=new THREE.Mesh(new THREE.PlaneGeometry(22,4.6),new THREE.MeshStandardMaterial({map:lines.tex,transparent:true,roughness:.9,depthWrite:false}));pl.rotation.x=-Math.PI/2;pl.position.set(275,.012,z);scene.add(pl);});
  }
  const poles=[],bulbs=[];
  [268,278,288,297].forEach(x=>[-5.5,5.5].forEach(z=>{poles.push(cyl(.07,.09,4.2,M(0x2b2f36,{m:.6,r:.5}),x,2.1,z,8));const b=new THREE.Mesh(new THREE.SphereGeometry(.2,10,10),E(0xfff0d0,5));b.position.set(x,4.3,z);scene.add(b);bulbs.push(b);}));
  model("security_camera_01",m=>{[[304.5,-5.95,0],[304.5,5.95,Math.PI]].forEach(([x,z,r])=>{const c=m.clone();c.position.set(x,4.2,z);c.rotation.y=r;scene.add(c);});placed.cam=m;});
  /* lobby */
  bx(300.4,318,-.1,.02,-6,6,flo,{cast:false});bx(318,399.6,-.1,.02,-25,25,M(0x141922,{r:.3,m:.4,env:.9}),{cast:false});
  bx(300.4,318,0,5,-6.2,-6,inw,{cast:false,tile:5});bx(300.4,318,0,5,6,6.2,inw,{cast:false,tile:5});
  [[-25,-4.6],[-3,-1.4],[.2,1.8],[3.4,25]].forEach(([a,b])=>bx(318,318.3,0,5,a,b,inw,{cast:false,tile:5}));
  const lanes=[-3.8,-.6,2.6];
  lanes.forEach((z,i)=>{
    bx(318,318.3,3,5,z-.8,z+.8,inw,{cast:false,tile:5});
    const mat=i===2?E(0x4ade80,.4):E(0xff4d5e,1.6);if(i===2) greenMats.push(mat);
    bx(317.9,318,3.05,3.2,z-.7,z+.7,mat,{cast:false});
    const s=bx(0,1,.02,.045,-.07,.07,mat,{cast:false}),a=V(314,.03,0),b=V(318.2,.03,z),len=a.distanceTo(b);
    s.scale.x=len;s.position.set((a.x+b.x)/2,.035,(a.z+b.z)/2);s.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
    bx(318.2,352,.02,.045,z-.07,z+.07,mat,{cast:false});
  });
  [303,307,311,315].forEach(x=>{bx(x-.04,x+.04,.3,4.6,-5.99,-5.95,E(0x3b7bff,1.4),{cast:false});bx(x-.04,x+.04,.3,4.6,5.95,5.99,E(0x3b7bff,1.4),{cast:false});});
  [304,309,314].forEach(x=>bx(x-1,x+1,4.96,5,-1.2,1.2,E(0xe8f0ff,1.3),{cast:false}));
  /* security arch */
  const arch=new THREE.Group();scene.add(arch);
  const am=M(0x1a1f2b,{m:.8,r:.3,env:1});
  bx(309.8,310.2,0,3.1,-1.55,-1.25,am,{parent:arch});bx(309.8,310.2,0,3.1,1.25,1.55,am,{parent:arch});bx(309.8,310.2,3.1,3.45,-1.55,1.55,am,{parent:arch});
  archStrips=E(0x35d6ff,2);
  bx(309.78,309.8,.1,3.1,-1.3,-1.25,archStrips,{cast:false});bx(309.78,309.8,.1,3.1,1.25,1.3,archStrips,{cast:false});
  laser=bx(309.98,310.02,0,.025,-1.25,1.25,E(0x4ade80,5),{cast:false});laser.visible=false;
  const ss=new THREE.Mesh(new THREE.PlaneGeometry(2.9,.68),new THREE.MeshBasicMaterial({map:secTex.tex,color:0xdddddd}));
  ss.rotation.y=-Math.PI/2;ss.position.set(309.78,3.95,0);scene.add(ss);
  tap(arch,...stopTap(3));tap(ss,...stopTap(3));
  /* traffic director hub */
  cyl(.9,.9,.06,am,314,.04,0,40);
  const hub=new THREE.Mesh(new THREE.TorusGeometry(.9,.03,8,48),E(0xf4a62a,2.6));hub.rotation.x=Math.PI/2;hub.position.set(314,.09,0);scene.add(hub);
  /* server hall */
  const ledC=["#35ff9a","#35d6ff","#ffb545"],dotsA=[];
  for(let r=0;r<18;r++) for(let k=0;k<2+Math.floor(Math.random()*3);k++) dotsA.push([10+Math.random()*108,8+r*20,ledC[Math.floor(Math.random()*3)]]);
  const fA=canvasTex(128,368,(g,w,h)=>{g.fillStyle="#0b0e15";g.fillRect(0,0,w,h);for(let r=0;r<18;r++){g.fillStyle="#161c29";g.fillRect(5,3+r*20,w-10,16);g.fillStyle="#0e131d";for(let x=24;x<w-26;x+=5) g.fillRect(x,7+r*20,2,8);g.fillStyle="#3b455a";g.fillRect(8,9+r*20,3,3);g.fillRect(w-11,9+r*20,3,3);}g.strokeStyle="#2a3347";g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.fillStyle="#48546e";g.fillRect(w-9,150,4,64);dotsA.forEach(d=>{g.fillStyle=d[2];g.fillRect(d[0],d[1],4,4);});});fA.redraw();
  const fB=canvasTex(128,368,(g,w,h)=>{g.fillStyle="#000";g.fillRect(0,0,w,h);dotsA.forEach(d=>{g.fillStyle=d[2];g.fillRect(d[0],d[1],4,4);});});fB.redraw();
  const side=M(0x0e1119,{r:.5,m:.5,env:.6});
  const front=new THREE.MeshStandardMaterial({map:fA.tex,emissiveMap:fB.tex,emissive:0xffffff,emissiveIntensity:2.6,roughness:.45,metalness:.4,envMapIntensity:.5});
  const per=Math.floor((396-322.5)/.86)+1,racks=new THREE.InstancedMesh(new THREE.BoxGeometry(.8,2.3,1.2),[side,side,side,side,front,front],15*per);
  n=0;
  for(let r=0;r<15;r++) for(let c=0;c<per;c++){
    const x=322.5+c*.86,z=-21.4+3.2*r;
    if(Math.abs(x-GX)<.1&&Math.abs(z-4.2)<.1) continue;
    d.position.set(x,1.15,z);d.updateMatrix();racks.setMatrixAt(n++,d.matrix);
  }
  racks.count=n;scene.add(racks);
  const strips=new THREE.InstancedMesh(new THREE.BoxGeometry(76,.05,.16),E(0xdfeaff,1.7),14);
  for(let k=0;k<14;k++){d.position.set(360,4.95,-19.8+3.2*k);d.updateMatrix();strips.setMatrixAt(k,d.matrix);}
  scene.add(strips);
  /* the open GPU rack */
  const gr=new THREE.Group();scene.add(gr);
  bx(GX-.4,GX+.4,0,2.3,3.63,4.8,side,{parent:gr,cast:false});
  const tray=M(0x2a2f3a,{m:.8,r:.35,env:1});
  const finT=canvasTex(64,64,(g,w,h)=>{g.fillStyle="#9aa3b0";g.fillRect(0,0,w,h);g.fillStyle="#4d5560";for(let x=0;x<w;x+=6) g.fillRect(x,0,2,h);});finT.redraw();
  const fin=M(0xffffff,{m:.8,r:.4,env:1});fin.map=finT.tex;
  for(let k=0;k<5;k++){
    const y=.3+k*.4;
    bx(GX-.37,GX+.37,y,y+.35,3.6,3.63,tray,{parent:gr,cast:false});
    [-.18,.18].forEach(ox=>{
      bx(GX+ox-.15,GX+ox+.15,y+.05,y+.3,3.585,3.6,fin,{parent:gr,cast:false});
      const chip=bx(GX+ox-.055,GX+ox+.055,y+.12,y+.23,3.575,3.585,new THREE.MeshStandardMaterial({color:0x23252c,emissive:0xffa530,emissiveIntensity:0,roughness:.3,metalness:.6}),{parent:gr,cast:false});
      chips.push(chip);
    });
  }
  label("gpu",GX+.56,1.83,3.52,.11);
  for(let i=0;i<8;i++){const s=textSprite(["0.12","−0.87","0.45","0.91","−0.33","0.08","−0.52","0.67"][i],.07,{bg:"rgba(8,12,26,.6)",color:"#7dffb0",border:"rgba(125,255,176,.4)"});s.visible=false;scene.add(s);nums.push(s);}
}

/* =====================================================================
   THE HERO: a sealed envelope of light
   ===================================================================== */
const hero=new THREE.Group(),heroIn=new THREE.Group();hero.add(heroIn);scene.add(hero);
let heroS=.7,heroVis=0,heroScaleOverride=null,lockOn=0,lockGoal=0,lightOn=0,lightGoal=0,heroDark=0,heroPaper,heroFlap,heroGlow;
const lockG=new THREE.Group();
{
  const body=new THREE.Mesh(new RoundedBoxGeometry(.16,.108,.012,3,.006),new THREE.MeshStandardMaterial({color:0xfbf3df,emissive:0xffe9c4,emissiveIntensity:.1,roughness:.85,envMapIntensity:.15}));heroPaper=body.material;
  heroIn.add(body);
  const flap=E(0xf0a01e,1);heroFlap=flap;
  [1,-1].forEach(s=>{const a=bx(-.0494,.0494,-.003,.003,-.001,.001,flap,{parent:heroIn,cast:false});a.position.set(s*.04,.025,.0068);a.rotation.z=s*.627;});
  const gold=M(0xeaf2ff,{m:.9,r:.25,env:1.3,e:0x3a6a9a,ei:.9});
  bx(-.017,.017,-.0135,.0135,-.006,.006,gold,{parent:lockG,cast:false});
  const sh=new THREE.Mesh(new THREE.TorusGeometry(.011,.0035,8,16,Math.PI),gold);sh.position.y=.0135;lockG.add(sh);
  lockG.position.set(.056,-.032,.013);heroIn.add(lockG);
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

/* radio rings */
const rings=[];
for(let i=0;i<10;i++){
  const m=new THREE.Mesh(new THREE.TorusGeometry(1,.014,6,56),new THREE.MeshBasicMaterial({color:0x8fd6ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  m.visible=false;scene.add(m);rings.push({m,life:1,dur:1,max:1});
}
let ringI=0;
function emitRing(pos,dir,max,dur=1.5){const r=rings[ringI++%rings.length];r.m.position.copy(pos);r.m.lookAt(pos.clone().add(dir));r.life=0;r.dur=dur;r.max=max;r.m.visible=true;}

/* radio waves: circles that face the viewer and spread from a glowing point */
const waves=[],waveCore=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd070,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:0}));
waveCore.visible=false;scene.add(waveCore);
for(let i=0;i<10;i++){
  const m=new THREE.Mesh(new THREE.TorusGeometry(1,.035,6,64),new THREE.MeshBasicMaterial({color:0xff9a1f,transparent:true,opacity:0,depthWrite:false,fog:false}));
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
  const PLANET="https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/";
  const em=new THREE.MeshStandardMaterial({color:0x17306e,roughness:.95,metalness:0,envMapIntensity:0});
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(GR,96,64),em));
  texLoader.load(PLANET+"earth_day_4096.jpg",t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;em.map=t;em.color.set(0xffffff);em.needsUpdate=true;});
  texLoader.load(PLANET+"earth_night_4096.jpg",t=>{t.colorSpace=THREE.SRGBColorSpace;em.emissiveMap=t;em.emissive.set(0xffdfa8);em.emissiveIntensity=0;em.needsUpdate=true;});
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x3b8bff,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:.9}));halo.scale.setScalar(GR*3.1);globe.add(halo);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(GR*1.025,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:"varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader:"varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),2.6);gl_FragColor=vec4(.3,.62,1.,1.)*f*1.3;}"})));
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
  L.forEach(k=>{const [a,b]=k.split("-"),pts=arcPts(H[a],H[b],26,.05);for(let i=0;i<pts.length-1;i++) pos.push(...pts[i].toArray(),...pts[i+1].toArray());});
  const wg=new THREE.BufferGeometry();wg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  web=new THREE.LineSegments(wg,new THREE.LineBasicMaterial({color:new THREE.Color(1.5,3,4.4),transparent:true,opacity:.9,fog:false}));
  web.userData.n=pos.length/6;wg.setDrawRange(0,0);web.visible=false;globe.add(web);
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
let stage={text:"",lines:[""],n:0,ghost:1,scr:0,lock:0,seed:0},stageGoal=0,stageOn=0,stageScale=1,stageT=0;
const stageBox={w:1,h:.5,y:0},GIB="x9#Kq7$Zm2&Bv4@Wd8!Rj%Yc5?Hs";
const stageTex=canvasTex(1400,700,g=>{
  const w=g.canvas.width,h=g.canvas.height,s=stage,port=h>=w;
  g.clearRect(0,0,w,h);g.globalAlpha=1;g.shadowBlur=0;
  if(s.mode==="dns") return drawDns(g,w,h,s,port);
  if(s.mode==="relay") return drawRelay(g,w,h,s,port);
  if(s.mode==="fiber") return drawFiber(g,w,h,s,port);
  if(s.mode==="gpu") return drawGpu(g,w,h,s,port);
  const N=(s.text||"").length;
  if(!N) return;
  const pad=w*.025,lines=port?s.lines:[s.text],fs=port?54:62,bubH=lines.length*fs*1.25+44;
  g.textBaseline="middle";
  /* the sentence in its chat bubble: the letter being converted lights up */
  if(s.ghost>0){
    g.globalAlpha=s.ghost;g.font=`800 ${fs}px ${FONT}`;
    const bw=Math.max(...lines.map(l=>g.measureText(l).width))+90;
    rr(g,(w-bw)/2,pad,bw,bubH,40,"#2f6fed");
    g.textAlign="left";
    let idx=0;
    lines.forEach((l,li)=>{
      let x=(w-g.measureText(l).width)/2;const y=pad+22+fs*.62+li*fs*1.25;
      for(const ch of l){g.fillStyle=idx<s.n?"rgba(255,255,255,.38)":idx===s.n?"#ffd166":"#fff";g.fillText(ch,x,y);x+=g.measureText(ch).width;idx++;}
      idx++;
    });
    g.globalAlpha=1;
  }
  /* one tile per letter: its 8 bits, then scrambled */
  const cols=port?6:9,rows=Math.ceil(N/cols),top=pad+bubH+26,cw=(w-pad*2)/cols,chh=Math.min((h-pad-top)/rows,cw*1.25);
  const small=!port,bf=Math.floor(Math.min((cw-26)/2.45,small?(chh-30)/2.9:(chh-22)/2.3)),gy=top+((h-pad-top)-chh*rows)/2;
  g.textAlign="center";
  for(let i=0;i<N;i++){
    const r=Math.floor(i/cols),inRow=r===rows-1?N-cols*r:cols;
    const cx=pad+(i%cols+.5)*cw+(cols-inRow)*cw/2,cy=gy+(r+.5)*chh,on=i<s.n,scr=i<s.scr;
    rr(g,cx-cw/2+6,cy-chh/2+6,cw-12,chh-12,16,on?(scr?"rgba(4,20,34,.94)":"rgba(28,19,3,.94)"):"rgba(255,255,255,.05)",on?(scr?"#5fe0ff":"#f4b63a"):"rgba(255,255,255,.16)");
    if(!on) continue;
    const ch=s.text[i];let a,b;
    if(scr){const q=j=>GIB[((i*8+j)*13+s.seed*7)%GIB.length];a=q(0)+q(1)+q(2)+q(3);b=q(4)+q(5)+q(6)+q(7);}
    else{const bits=(ch.charCodeAt(0)&255).toString(2).padStart(8,"0");a=bits.slice(0,4);b=bits.slice(4);}
    const yo=small?bf*.24:0;
    if(small&&s.ghost>0&&!scr){g.globalAlpha=s.ghost;g.fillStyle="#ffffff";g.font=`800 ${Math.round(bf*.52)}px ${FONT}`;g.fillText(ch===" "?"␣":ch,cx,cy-bf*1.12);g.globalAlpha=1;}
    g.fillStyle=scr?"#9fe8ff":"#ffd166";g.font=`800 ${bf}px ${MONO}`;
    g.fillText(a,cx,cy-bf*.55+yo);g.fillText(b,cx,cy+bf*.55+yo);
  }
  /* the padlock */
  if(s.lock>0){
    const e=outBack(s.lock),R=Math.min(w,h)*(port?.15:.2)*e,cx=w/2,cy=gy+chh*rows/2+R*.1;
    g.globalAlpha=Math.min(1,s.lock*1.6);
    g.strokeStyle="#f4b63a";g.lineWidth=7;g.beginPath();g.roundRect(pad*.4,gy-pad*.35,w-pad*.8,chh*rows+pad*.7,26);g.stroke();
    g.fillStyle="rgba(3,5,12,.78)";g.beginPath();g.arc(cx,cy,R*1.55,0,7);g.fill();
    g.strokeStyle="#f4b63a";g.lineWidth=R*.22;g.lineCap="round";
    g.beginPath();g.moveTo(cx-R*.42,cy-R*.02);g.lineTo(cx-R*.42,cy-R*.38);g.arc(cx,cy-R*.38,R*.42,Math.PI,0);g.lineTo(cx+R*.42,cy-R*.02);g.stroke();
    rr(g,cx-R*.72,cy-R*.08,R*1.44,R*1.08,R*.18,"#f4b63a");
    g.fillStyle="#3a2500";g.beginPath();g.arc(cx,cy+R*.36,R*.15,0,7);g.fill();g.fillRect(cx-R*.06,cy+R*.4,R*.12,R*.3);
    g.globalAlpha=1;
  }
});
const stagePlane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:stageTex.tex,transparent:true,opacity:0,depthTest:false,depthWrite:false,fog:false}));
stagePlane.position.z=-.99;stagePlane.renderOrder=901;stagePlane.visible=false;camera.add(stagePlane);
/* stage: the address book */
function drawDns(g,w,h,s,port){
  const found=s.phase==="found",pad=w*.03,name="chatgpt.com",addr=found?DNS_ROWS[3][1]:"?",fs=port?70:64;
  g.textBaseline="middle";g.textAlign="center";g.font=`800 ${fs}px ${MONO}`;
  let top;
  if(port){
    rr(g,pad,pad,w-pad*2,fs*3.5,36,"rgba(8,16,36,.95)",found?"#f4b63a":"#5fe0ff");
    g.fillStyle="#fff";g.fillText(name,w/2,pad+fs*.8);
    g.fillStyle="#5fe0ff";g.fillText("↓",w/2,pad+fs*1.75);
    g.fillStyle="#ffd166";g.fillText(addr,w/2,pad+fs*2.7);
    top=pad+fs*3.5+22;
  }else{
    rr(g,w*.06,pad,w*.88,fs*1.9,40,"rgba(8,16,36,.95)",found?"#f4b63a":"#5fe0ff");
    const parts=[[name,"#fff"],["  →  ","#5fe0ff"],[addr,"#ffd166"]];
    let x=(w-parts.reduce((a,q)=>a+g.measureText(q[0]).width,0))/2;g.textAlign="left";
    parts.forEach(q=>{g.fillStyle=q[1];g.fillText(q[0],x,pad+fs*.98);x+=g.measureText(q[0]).width;});
    top=pad+fs*1.9+24;
  }
  const bw=port?w-pad*2:w*.74,b0=(w-bw)/2,n=DNS_ROWS.length,th=56,rh=Math.min((h-pad-top-th-14)/n,port?70:66),rf=Math.floor(rh*.52);
  rr(g,b0,top,bw,th+n*rh+14,28,"rgba(6,18,42,.95)","rgba(95,224,255,.45)");
  g.textAlign="center";g.fillStyle="#5fe0ff";g.font=`800 ${Math.floor(th*.52)}px ${FONT}`;g.fillText(ui.labels.dnsTitle,w/2,top+th*.56);
  g.textAlign="left";
  DNS_ROWS.forEach((r,i)=>{
    const y=top+th+(i+.5)*rh,hot=s.row===i;
    if(hot) rr(g,b0+12,y-rh/2+4,bw-24,rh-8,14,found?"rgba(244,182,58,.28)":"rgba(95,224,255,.25)",found?"#f4b63a":"#5fe0ff");
    g.font=`700 ${rf}px ${MONO}`;g.fillStyle=hot?(found?"#ffe7a8":"#fff"):"#6f8fbd";
    g.fillText(r[0],b0+bw*.07,y);g.fillText("→",b0+bw*.5,y);g.fillText(r[1],b0+bw*.58,y);
  });
}
/* stage: no machine knows the whole route; each one passes the message a little closer */
const RN=[[.07,.52],[.22,.34],[.37,.6],[.53,.38],[.69,.62],[.84,.4],[.94,.52],[.2,.8],[.35,.14],[.52,.84],[.66,.14],[.8,.84],[.45,.5]];
const RE=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[0,7],[7,2],[1,8],[8,3],[2,9],[9,4],[3,10],[10,5],[4,11],[11,6],[12,2],[12,3],[7,9],[8,10],[9,11],[1,12]];
function drawRelay(g,w,h,s,port){
  const X=i=>w*(.04+RN[i][0]*.92),Y=i=>h*(.12+RN[i][1]*.76),hops=6,f=clamp01(s.k)*hops,cur=Math.min(hops,Math.floor(f)),fr=f-cur;
  g.lineCap="round";g.lineJoin="round";g.textBaseline="middle";
  g.strokeStyle="rgba(95,200,255,.32)";g.lineWidth=4;
  RE.forEach(([a,b])=>{g.beginPath();g.moveTo(X(a),Y(a));g.lineTo(X(b),Y(b));g.stroke();});
  const ex=cur<hops?X(cur)+(X(cur+1)-X(cur))*ease(fr):X(hops),ey=cur<hops?Y(cur)+(Y(cur+1)-Y(cur))*ease(fr):Y(hops);
  g.strokeStyle="#ffc23a";g.lineWidth=9;g.shadowColor="rgba(255,190,60,.9)";g.shadowBlur=22;
  g.beginPath();g.moveTo(X(0),Y(0));for(let i=1;i<=cur;i++) g.lineTo(X(i),Y(i));g.lineTo(ex,ey);g.stroke();g.shadowBlur=0;
  RN.forEach((n,i)=>{
    const on=i<=cur&&i<=hops,end=i===0||i===hops,bw=end?92:70,bh=end?108:86,x=X(i),y=Y(i);
    rr(g,x-bw/2,y-bh/2,bw,bh,14,on?"rgba(60,40,6,.97)":"rgba(8,18,44,.97)",on?"#ffc23a":"rgba(120,200,255,.75)");
    g.fillStyle=on?"#ffd166":"rgba(120,200,255,.6)";
    for(let r=0;r<3;r++) g.fillRect(x-bw/2+14,y-bh/2+16+r*(bh-32)/3,bw-28,6);
  });
  g.font=`800 ${port?34:32}px ${FONT}`;g.fillStyle="#fff";
  g.textAlign="left";g.fillText(ui.labels.you,X(0)-46,Y(0)+84);
  g.textAlign="right";g.fillText(ui.labels.dcs,X(hops)+46,Y(hops)+84);
  const ew=64,eh=44;
  g.shadowColor="rgba(255,200,80,.95)";g.shadowBlur=26;rr(g,ex-ew/2,ey-eh/2,ew,eh,8,"#fff3cf","#ffc23a");g.shadowBlur=0;
  g.strokeStyle="#c98a12";g.lineWidth=4;g.beginPath();g.moveTo(ex-ew/2+5,ey-eh/2+6);g.lineTo(ex,ey+4);g.lineTo(ex+ew/2-5,ey-eh/2+6);g.stroke();
  const tw=306,th=62,tx=Math.min(w-tw-8,Math.max(8,ex-tw/2)),ty=ey-eh/2-th-18;
  rr(g,tx,ty,tw,th,10,"#ffd23f");
  g.fillStyle="#3a2a00";g.font=`800 26px ${FONT}`;g.textAlign="left";g.fillText(ui.labels.to,tx+14,ty+th/2+1);
  g.font=`800 30px ${MONO}`;g.textAlign="right";g.fillText(DNS_ROWS[3][1],tx+tw-12,ty+th/2+2);
}
/* stage: inside a cable, light running through threads of glass */
const PK=["#f4a62a","#ff6f91","#4ade80","#b685ff"];
function drawFiber(g,w,h,s,port){
  const t=amb,cy=h*(port?.34:.38),ch=h*(port?.4:.5),x0=w*.02,x1=w*.98,c0=w*(port?.1:.16),c1=w*(port?.9:.84),n=port?3:4;
  g.textBaseline="middle";
  rr(g,x0,cy-ch/2,x1-x0,ch,46,"#161d2b","#34435f");
  g.strokeStyle="rgba(255,255,255,.07)";g.lineWidth=3;
  for(let x=x0+30;x<x1-10;x+=38){if(x>c0-12&&x<c1+26) continue;g.beginPath();g.moveTo(x,cy-ch/2+10);g.lineTo(x-14,cy+ch/2-10);g.stroke();}
  rr(g,c0,cy-ch/2+16,c1-c0,ch-32,30,"rgba(3,8,18,.97)","rgba(95,224,255,.4)");
  g.save();g.beginPath();g.rect(c0+4,cy-ch/2+19,c1-c0-8,ch-38);g.clip();g.lineCap="round";
  for(let k=0;k<n;k++){
    const y=cy+(k-(n-1)/2)*(ch-70)/n;
    g.strokeStyle="rgba(150,215,255,.16)";g.lineWidth=18;g.beginPath();g.moveTo(c0,y);g.lineTo(c1,y);g.stroke();
    g.strokeStyle="rgba(210,240,255,.55)";g.lineWidth=3;g.beginPath();g.moveTo(c0,y);g.lineTo(c1,y);g.stroke();
    for(let j=0;j<3;j++){
      const u=(t*.3+k*.23+j/3)%1,x=c0-80+u*(c1-c0+160),gr=g.createRadialGradient(x,y,0,x,y,60);
      gr.addColorStop(0,"#ffc94a");gr.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=.6;g.fillStyle=gr;g.fillRect(x-60,y-60,120,120);g.globalAlpha=1;
      const lg=g.createLinearGradient(x-90,0,x,0);lg.addColorStop(0,"rgba(255,255,255,0)");lg.addColorStop(1,"#fff");
      g.strokeStyle=lg;g.lineWidth=9;g.beginPath();g.moveTo(x-90,y);g.lineTo(x,y);g.stroke();
    }
  }
  g.restore();
  g.font=`700 ${port?36:34}px ${FONT}`;g.textAlign="left";g.lineCap="round";
  [[ui.labels.hair,"#9a7653",15],[ui.labels.glass,"#bfe9ff",5]].forEach((it,i)=>{
    const a=port?w*.08:w*(.07+.5*i),y=port?h*(.72+.13*i):h*.86,len=w*(port?.2:.1);
    g.strokeStyle=it[1];g.lineWidth=it[2];g.beginPath();g.moveTo(a,y);g.lineTo(a+len,y);g.stroke();
    g.fillStyle="#dbe6ff";g.fillText(it[0],a+len+24,y);
  });
}
/* stage: one GPU chip. Many small sums at once, then the model's numbers, then the words going in */
const NUMS=["0.12","-0.87","0.45","0.91","-0.33","0.08","-0.52","0.67","0.29","-0.71","0.56","-0.14"];
function drawGpu(g,w,h,s,port){
  /* one chip full of numbers; then the question slides in and the numbers light up in a wave */
  const t=amb,cols=port?4:6,rows=port?4:3,nc=cols*rows,lt=s.phase===2?t-s.t0:0,sh=s.phase===2?smooth(0,.7,lt):0,loop=s.phase===2?Math.max(0,lt-.6)%3.6:0;
  const CW=port?w*.9:w*.56,CH=port?h*.52:h*.8;
  const X=port?(w-CW)/2:(w-CW)/2+(w*.4-(w-CW)/2)*sh,Y=port?(h-CH)/2+(h*.42-(h-CH)/2)*sh:(h-CH)/2;
  g.textBaseline="middle";g.textAlign="center";
  g.fillStyle="#b98a2e";
  for(let x=X+34;x<X+CW-30;x+=44){g.fillRect(x,Y-14,18,16);g.fillRect(x,Y+CH-2,18,16);}
  for(let y=Y+34;y<Y+CH-30;y+=44){g.fillRect(X-14,y,16,18);g.fillRect(X+CW-2,y,16,18);}
  rr(g,X,Y,CW,CH,28,"#0e131c","#f4a62a");
  g.fillStyle="#f4a62a";g.font=`900 34px ${FONT}`;g.textAlign="left";g.fillText(ui.labels.gpu,X+28,Y+36);g.textAlign="center";
  const gx=X+22,gy=Y+64,cw=(CW-44)/cols,chh=(CH-86)/rows,f=Math.floor(Math.min(cw*.25,chh*.36)),sweep=s.phase===2?(loop-1.2)/1.7:-1;
  for(let i=0;i<nc;i++){
    const c=i%cols,r=Math.floor(i/cols),cx=gx+(c+.5)*cw,cy=gy+(r+.5)*chh,on=s.phase===2||((i*37)%nc)/nc<s.k;
    const u=port?(r+.5)/rows:(c+.5)/cols,hot=s.phase===2&&Math.abs(u-sweep)<.5/(port?rows:cols)+.02;
    rr(g,cx-cw/2+7,cy-chh/2+7,cw-14,chh-14,14,hot?"rgba(244,166,42,.92)":"rgba(255,255,255,.045)",s.phase===0&&on?"#34d399":hot?"#ffd166":"rgba(255,255,255,.14)");
    g.font=`800 ${f}px ${MONO}`;
    if(s.phase===0){
      const a=(i*7)%8+2,b=(i*5)%7+2;
      g.fillStyle="#fff";g.fillText(`${a}×${b}`,cx,cy-f*.6);
      g.fillStyle=on?"#7dffb0":"rgba(255,255,255,.3)";g.fillText(on?`=${a*b}`:"= ?",cx,cy+f*.6);
    }else if(on){
      g.fillStyle=hot?"#1c1200":"#ffcf7a";
      g.fillText(NUMS[(i*5)%12],cx,cy);
    }
  }
  if(s.phase===2){
    /* the question, in the same blue bubble as on the phone, slides into the chip */
    const te=smooth(.25,1.3,loop),L=ui.promptLines;
    let bw,bh,x,y;
    if(port){bw=w*.7;bh=h*.2;x=w*.5;y=h*.03+bh/2+te*(Y+bh*.2-h*.03-bh/2);}
    else{bw=w*.33;bh=h*.3;y=h*.5;x=w*.02+bw/2+te*(X+bw*.25-w*.02-bw/2);}
    g.globalAlpha=(1-smooth(.7,1,te))*smooth(0,.4,lt);
    rr(g,x-bw/2,y-bh/2,bw,bh,bh*.24,"#2f6fed","rgba(255,255,255,.7)");
    g.fillStyle="#fff";g.font=`800 ${Math.floor(Math.min(bh*.26,bw*.115))}px ${FONT}`;
    L.forEach((ln,i)=>g.fillText(ln,x,y+(i-(L.length-1)/2)*bh*.34));
    g.globalAlpha=1;
  }
}
/* fit the stage into the free area between the caption and the bottom bar */
function stageFit(){
  const W=window.innerWidth,H=window.innerHeight;if(!W||!H) return;
  const port=camera.aspect<1,cw=port?840:1400,ch=port?840:700;
  if(stageTex.c.width!==cw||stageTex.c.height!==ch){stageTex.c.width=cw;stageTex.c.height=ch;stageTex.tex.dispose();stageTex.redraw();}
  const top=$("caption").getBoundingClientRect().bottom+16,btm=document.querySelector(".bottom").getBoundingClientRect().top-10;
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
  const lx=[-15,-5,5,15],lp=[],nodes=new THREE.InstancedMesh(new THREE.SphereGeometry(.2,12,12),E(0x7a5cf0,.7),28),d=new THREE.Object3D();
  lx.forEach((x,c)=>{for(let k=0;k<7;k++){d.position.set(x,1.2+k*1.5,-16);d.updateMatrix();nodes.setMatrixAt(c*7+k,d.matrix);if(c<3) for(let j=0;j<7;j++) lp.push(x,1.2+k*1.5,-16,lx[c+1],1.2+j*1.5,-16);}});
  ms.add(nodes);
  const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.Float32BufferAttribute(lp,3));
  ms.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x6a4cff,transparent:true,opacity:.22})));
}
const words=new THREE.Group();ms.add(words);
let tok=[],ans=[],xs=[],widths=[],sentence,idSprites=[],stamps=[],cells,cellBase=[],arcGroup,chart,chartBars=[],ring,CX=0,focusTok=4;
function slab(text,color,h=.8,textColor="#141c33",ei=.2){
  const w=(.6+text.length*.24)*h/.8,g=new THREE.Group();
  const body=new THREE.Mesh(new RoundedBoxGeometry(w,h,.3,4,.1*h/.8),new THREE.MeshStandardMaterial({color,roughness:.35,envMapIntensity:.6,emissive:color,emissiveIntensity:ei}));
  const ct=canvasTex(Math.round(w*128),Math.round(h*128),(c,W,H)=>{c.clearRect(0,0,W,H);c.fillStyle=textColor;c.font=`800 ${Math.round(H*.56)}px ${FONT}`;c.textAlign="center";c.textBaseline="middle";c.fillText(text,W/2,H/2+2);});
  ct.redraw();
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:ct.tex,transparent:true,depthWrite:false}));face.position.z=.157;
  g.add(body,face);g.userData={w,body};return g;
}
function rebuildWords(){
  words.traverse(o=>{if(o.geometry) o.geometry.dispose();if(o.material){if(o.material.map) o.material.map.dispose();o.material.dispose&&o.material.dispose();}});
  words.clear();
  for(let i=tappables.length-1;i>=0;i--) if(tappables[i].userData.tok!==undefined) tappables.splice(i,1);
  tok=ui.tokens.map(t=>slab(t.word,t.color));
  ans=ui.answer.map(w=>slab(w,"#f4b63a"));
  const all=[...tok,...ans];widths=all.map(s=>s.userData.w);xs=[];
  let x=0;widths.forEach(w=>{xs.push(x+w/2);x+=w+.35;});
  const shift=-(xs[4]+widths[4]/2)/2;xs=xs.map(v=>v+shift);
  all.forEach((s,i)=>{s.position.set(xs[i],ROW_Y,0);words.add(s);});
  tok.forEach((s,i)=>{s.userData.body.userData.tok=i;s.userData.body.userData.can=()=>current===MODEL&&(sub===1||sub===2);s.userData.body.userData.tap=()=>{sub===1?selectFingerprint(i):selectAttention(i);};tappables.push(s.userData.body);});
  sentence=slab(ui.prompt,"#2f6fed",.8,"#ffffff");sentence.position.set(0,ROW_Y,0);words.add(sentence);
  idSprites=ui.tokens.map((t,i)=>{const s=textSprite(ui.tokenId(t.id),.42);s.position.set(xs[i],1.85,0);words.add(s);return s;});
  stamps=ui.tokens.map((t,i)=>{const s=textSprite(ui.place(i+1),.36,{color:"#ffd27a",border:"rgba(244,166,42,.5)"});s.position.set(xs[i],.2,0);words.add(s);return s;});
  /* fingerprints: 5 x 6 grid of number cells under each word */
  cells=new THREE.InstancedMesh(new THREE.BoxGeometry(.19,.19,.06),new THREE.MeshBasicMaterial(),150);cellBase=[];
  const dark=new THREE.Color(0x141a3c),col=new THREE.Color();
  ui.tokens.forEach((t,ti)=>{
    let v=t.id+17;
    for(let r=0;r<6;r++) for(let c=0;c<5;c++){
      v=(v*9301+49297)%233280;
      cellBase.push({x:xs[ti]+(c-2)*.22,y:1.9-r*.22-.2,delay:ti*.1+r*.05+c*.02});
      cells.setColorAt(cellBase.length-1,col.set(t.color).lerp(dark,1-v/233280));
    }
  });
  cells.instanceColor.needsUpdate=true;words.add(cells);
  arcGroup=new THREE.Group();words.add(arcGroup);
  /* next-word chart */
  chart=new THREE.Group();words.add(chart);chartBars=[];
  CX=xs[4]+widths[4]/2+5.2;
  ui.choices.forEach((c,i)=>{
    const y=4.1-i*.75,l=slab(c.word,"#27305a",.55,"#ffffff",.05);l.position.set(CX-l.userData.w/2,y,0);chart.add(l);
    const len=Math.max(.14,c.percent*.045);
    const b=new THREE.Mesh(new THREE.BoxGeometry(1,.46,.3),new THREE.MeshStandardMaterial({color:c.color,emissive:c.color,emissiveIntensity:i?.3:.9,roughness:.4}));
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
    const geo=new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,V((a.x+b.x)/2,a.y+h,0),b),48,.02+ln.w*.011,8);
    const total=geo.index.count;geo.setDrawRange(0,0);
    arcGroup.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:ui.tokens[ln.to].color})));
    tween(i*.12,.8,p=>geo.setDrawRange(0,Math.floor(total*p/3)*3),ease);
  });
  subNote=ui.attention(ui.tokens[f].word,ui.relations[f].label);renderHUD();
}
function modelCam(lookX,lookY,dist,dur){
  const cam=[MX+lookX,lookY+.5,dist],look=[MX+lookX,lookY,0];
  if(camBase.x<900){camBase.set(...cam);lookGoal.set(...look);lookCur.copy(lookGoal);}
  else travel({cam:[cam],look,dur,follow:false});
}
function setSub(k){
  clearTasks();
  sub=k;subNote="";busy=false;boost=1;heroScaleOverride=5;
  const pw=xs[4]+widths[4]/2-(xs[0]-widths[0]/2);
  [...tok,...ans].forEach((s,i)=>{s.visible=i<5;s.position.set(xs[i],ROW_Y,0);s.scale.setScalar(1);});
  highlightTok(-1);
  sentence.visible=false;ring.visible=false;chart.visible=k===3;arcGroup.visible=k===2;
  idSprites.forEach(s=>s.visible=k===0);stamps.forEach(s=>s.visible=k===1||k===2);
  cells.visible=k===1||k===2;setCells(()=>1);
  heroVis=0;
  if(k===0){
    hero.position.set(MX,ROW_Y,.8);heroVis=1;
    tween(.5,.5,p=>{heroVis=1-p;},ease);
    sentence.visible=true;sentence.scale.setScalar(.001);tok.forEach(s=>s.visible=false);idSprites.forEach(s=>s.visible=false);
    tween(.6,.5,p=>sentence.scale.setScalar(Math.max(.001,p)),outBack);
    at(1.9,()=>{sentence.visible=false;tok.forEach(s=>s.visible=true);});
    tok.forEach((s,i)=>tween(1.9+i*.08,.6,p=>{s.position.x=xs[i]*(.55+.45*p);s.scale.setScalar(.6+.4*p);},outBack));
    at(2.7,()=>idSprites.forEach(s=>s.visible=true));
    modelCam(0,ROW_Y-.2,distForWidth(pw+3),1.2);
  }
  if(k===1){
    setCells(()=>0);
    tween(.2,1.4,p=>setCells(c=>clamp01(p*2.4-c.delay*2)));
    modelCam(0,1.55,distForWidth(pw+3,10),1.2);
    softs.push(clock+2.8);at(2.8,()=>selectFingerprint(3));
  }
  if(k===2){modelCam(0,3.2,distForWidth(pw+3,13.5),1.2);softs.push(clock+2.8);at(2.8,()=>selectAttention(4));}
  if(k===3){
    chartBars.forEach(({b,len,p},i)=>{
      b.scale.x=.001;p.visible=false;
      tween(.5+i*.12,.9,t=>{b.scale.x=Math.max(.001,len*t);b.position.x=CX+.3+len*t/2;},ease);
      at(1.4+i*.12,()=>p.visible=true);
    });
    softs.push(clock+2.8);at(2.8,()=>{subNote=ui.winner;renderHUD();});
    modelCam(CX-1.2,2.7,distForWidth(13),1.4);
  }
  if(k===4){
    const start=xs[0]-widths[0]/2,end=xs[xs.length-1]+widths[widths.length-1]/2;
    modelCam((start+end)/2,ROW_Y-.3,distForWidth(end-start+3),1.6);
    ans.forEach((s,j)=>{
      const t0=1.8+(j?.5+j:0),i=5+j;
      if(j===0) softs.push(clock+t0+.8);
      at(t0,()=>{ring.visible=true;});
      tween(t0,.8,p=>{ring.position.set(start-.6+(xs[i]-start)*p,ROW_Y,0);},ease);
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
  {hero:[1.47,.99,0],cam:[1.19,1.02,.045],look:[1.5,.955,.012]},
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
function ride(u0,u1,dur,easing){
  const dir=Math.sign(u1-u0);
  tween(0,dur,p=>{
    const u=u0+(u1-u0)*p;
    homePath.getPointAt(u,hero.position);
    const s=heroScaleAt(hero.position);
    homePath.getPointAt(clamp01(u-dir*(2.6*s+.5)/HOME_LEN),camBase);
    camBase.y+=.3*s;
    lookGoal.copy(hero.position);
  },easing||ease);
}
function placeAt(i,P=POSE[i]){
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
  if(i===1){towerCab.m.emissiveIntensity=.6;towerCab.l.intensity=0;}
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
    travel({env:[[20,14,-3],[38,26,-7],[40.5,27.6,-6.5]],cam:[[15,12,1],[32,25.5,-2.5],[36.2,29,-3.2]],look:[44,26.5,-8],dur:3.4});
    at(3.4,()=>{showHero(1,.7);tween(0,.5,p=>{waveOn=1-p;});[0,.3,.6,1.2,1.8].forEach(d=>at(d,()=>emitWave(hero.position,3,1.1)));});
    travel({delay:5.8,env:[[42.6,14,-7.4],[44.3,1.7,-4.3]],cam:[[40,16,-2],[40.6,3.6,-.4]],look:[45.4,1,-5.4],dur:1.5});
    tween(7.4,.9,p=>{const e=Math.sin(Math.PI*Math.min(1,p*1.15));towerCab.m.emissiveIntensity=.6+4.5*e+1.2*p;towerCab.l.intensity=40*e+8*p;});
    travel({delay:7.7,env:[[44.8,.9,-5.5],[47.8,.5,-5.45]],dur:.9,follow:false});
    return 9;
  },
  ()=>{ /* the internet: find the address, hop from machine to machine, ride the light, cross the sea floor */
    const tmp=V(0,0,0);
    stage={mode:"dns",phase:"ask",row:-1};stageScale=1;stageTex.redraw();
    stageGoal=1;
    [0,1,2,3].forEach((r,k)=>at(.8+k*.4,()=>{stage.row=r;stage.phase="scan";stageTex.redraw();}));
    at(2.5,()=>{stage.phase="found";stageTex.redraw();});
    at(3.1,()=>{stage={mode:"relay",live:true,k:0};stageTex.redraw();});
    tween(3.3,3.8,p=>{stage.k=p;});
    at(7.4,()=>{stage={mode:"fiber",live:true};stageTex.redraw();});
    at(11,()=>{
      stageGoal=0;
      fade(()=>{
        hideGlobe();placeAt(2);
        const home=hero.position.clone();
        const cc=new THREE.CatmullRomCurve3([camBase.clone(),...[[124,3.2,2.6],[140,-3.4,2.6],[165,-10.3,3],[190,-11.6,3.4],[215,-10.3,3],[240,-3.4,2.6],[252,2.6,3],[257,4.2,3.6]].map(v3)],false,"catmullrom",.35);
        /* the speed shows next to the light for a moment, then goes away */
        speedLabel.visible=true;tween(1.3,.5,p=>{speedLabel.material.opacity=p;});tween(4.3,.6,p=>{speedLabel.material.opacity=1-p;});at(4.9,()=>{speedLabel.visible=false;});
        tween(.1,7.6,p=>{cc.getPointAt(p,camBase);seaCurves[1].getPointAt(clamp01(p*.96+.03),tmp);tmp.y+=.4;hero.position.lerpVectors(home,tmp,smooth(0,.07,p));lookGoal.copy(hero.position);lookCur.lerp(lookGoal,.5);},t=>1-Math.pow(1-t,1.6));
      });
    });
    at(16.6,()=>fade(()=>showGlobe("web")));
    at(19.4,()=>{hero.position.set(263,3,0);camBase.set(258.2,4.3,3.2);lookGoal.set(263,3,0);lookCur.copy(lookGoal);});
    return 20;
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
    at(9.6,()=>{if(sp) sp.visible=false;stage={mode:"gpu",live:true,phase:1,k:0,t0:0};stageScale=1;stageTex.redraw();stageGoal=1;});
    tween(9.8,1.4,p=>{stage.k=p;});
    at(11.8,()=>{stage.phase=2;stage.t0=amb;});
    return 14.4;
  },
  null,
  ()=>{ /* the envelope is unlocked on the phone and the whole answer lands at once */
    lockGoal=0;
    const sp=textSprite(ui.answer.join(" "),.015,{bg:"#f4b63a",color:"#2a1c02",border:"rgba(255,255,255,.6)"}),a=hero.position.clone().add(V(0,.04,0)),b=V(1.49,1,0);
    const W=sp.scale.x,H=sp.scale.y;sp.scale.set(.001,.001,1);sp.position.copy(a);scene.add(sp);temps.push(sp);
    tween(.9,.5,p=>sp.scale.set(W*Math.max(.001,p),H*Math.max(.001,p),1),outBack);
    tween(2.7,.5,p=>{sp.position.lerpVectors(a,b,p);sp.scale.set(W*(1-.6*p),H*(1-.6*p),1);},ease);
    at(3.2,()=>{scene.remove(sp);phoneState.words=[...ui.answer];redrawPhone();});
    return 4.2;
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
  if(introOn){if(!busy) go(0,true);return;}
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
}
function introCam(snap){
  const port=camera.aspect<1;
  /* far enough back that the whole model fits, whatever the window's shape */
  const z=port?33:Math.max(18.5,31/camera.aspect);
  camBase.set(INTRO_AT.x+.2,port?5.6:3.6+(z-18.5)*.1,z);lookGoal.set(INTRO_AT.x+.1,port?2.6:2.1,0);
  if(snap) lookCur.copy(lookGoal);
}
function replay(){
  clearTasks();
  busy=true;realSpeed=true;renderHUD();
  phoneState.words=[];redrawPhone();
  liveTimer=clock;
  const lin=t=>t*t*(3-2*t);
  ride(0,1,.45,lin);
  at(.6,()=>ride(1,0,.4,lin));
  at(1,()=>{liveTimer=null;showTimer(20);phoneState.words=[...ui.answer];redrawPhone();});
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
  if(introOn){
    const html=`<h2>${ui.introTitle}</h2>${itemHTML(ui.introSay)}`;
    if(html!==capKey){capKey=html;capTitle=ui.introTitle;$("caption").innerHTML=html;}
    $("chapter").innerHTML=`<b class="scr">1 / 22</b><span>${ui.introName}</span>`;
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
  const html=`${ticks?`<div class="beats">${ticks}</div>`:""}<h2>${title}</h2>${body}`;
  if(html!==capKey){
    capKey=html;
    const cap=$("caption");cap.innerHTML=html;
    const words=t=>String(t).replace(/<[^>]+>/g," ").trim().split(/\s+/).length;
    const nw=words((cap.querySelector(".ln,.stat")||cap).textContent)+(title!==capTitle?words(title):0);capTitle=title;
    const need=rate<1?Math.max(3,1+nw/3):Math.max(2.4,.8+nw/3.6);
    capT0=amb;capDur=need+.5;readUntil=amb+need;
  }
  /* screen number: 1 is the opening screen, 2 the phone, and every tap of the main button adds one */
  const SCR0=[0,3,5,9,12,18],scr=SCR0[current]+2+(isModel?sub+(sub===4&&!(stepping&&gates.length)?1:0):beat+1+(current===HOME&&(replayed||realSpeed)?1:0));
  $("chapter").innerHTML=`<b class="scr">${scr} / 22</b><span>${ui.kicker(current+1,n,stop.name)}</span>`;
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
  labels.forEach(l=>l.sp.userData.set(ui.labels[l.key]));
  redrawPhone();dnsTex.redraw();secTex.redraw();signTex.redraw();
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
  const hit=ray.intersectObjects(tappables,false)[0];
  return hit&&hit.object.userData.can()?hit.object:null;
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
  if(typeof seaTick==="function"){seaTick(amb);modelTick(amb);}
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
      else{pr=Math.min(1,(amb-capT0)/capDur,(amb-enT0)/1.5);if(pr>=1){pr=0;mainAction();}}
    }
    if(pr!==lastP){lastP=pr;mb.style.setProperty("--p",pr.toFixed(3));}
  }
  if(liveTimer!==null) showTimer(Math.min(20,(clock-liveTimer)*20));

  /* hero */
  const target=heroScaleOverride??heroScaleAt(hero.position);
  heroS+=(target-heroS)*(1-Math.exp(-dt*6));
  hero.scale.setScalar(Math.max(.0001,heroS*heroVis));
  heroIn.position.y=Math.sin(amb*2.2)*.012;heroIn.rotation.z=Math.sin(amb*1.3)*.06;
  lockOn+=(lockGoal-lockOn)*(1-Math.exp(-dt*7));
  lockG.scale.setScalar(Math.max(.0001,lockOn));lockG.rotation.z=(1-lockOn)*1.4;
  lightGoal=hero.position.x>46&&hero.position.x<296?1:0;
  lightOn+=(lightGoal-lightOn)*(1-Math.exp(-dt*5));
  /* in daylight it is a plain paper envelope; it only glows where the scene is dark */
  const hz=zoneOf(hero.position);
  heroDark+=((hz==="out"||hz==="room"?0:1)-heroDark)*(1-Math.exp(-dt*4));
  /* in dark places the paper is only lit enough to be seen; it shines like a light only inside the cables */
  const shine=heroDark*lightOn;
  heroPaper.emissiveIntensity=.08+.4*heroDark+.5*shine;heroFlap.emissiveIntensity=.9+.15*heroDark+1.15*shine;heroGlow.material.opacity=.04*heroDark+.46*shine;
  heroIn.scale.setScalar(1-.3*lightOn);flare.material.opacity=lightOn*(.12+.78*heroDark);core.material.opacity=lightOn*(.08+.32*heroDark);
  heroLight.intensity=.3*heroS*heroS*heroVis*(1+1.3*lightOn)*(.05+.3*heroDark+.65*shine);heroLight.distance=7*heroS;
  for(let k=TRAIL-1;k>0;k--){trailPos[k*3]=trailPos[k*3-3];trailPos[k*3+1]=trailPos[k*3-2];trailPos[k*3+2]=trailPos[k*3-1];}
  hero.position.toArray(trailPos,0);trailGeo.attributes.position.needsUpdate=true;
  trail.material.size=.055*heroS;trail.material.opacity=.5*heroVis*(.15+.85*heroDark);

  /* camera */
  lookEff.copy(lookGoal);
  /* on a tall phone screen, step back from the phone in your hand and frame it higher, clear of the buttons */
  const roomPort=camera.aspect<1&&camBase.x<1.4&&camBase.y<1.2;
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
  if(stage.live&&stageOn>.02){stageT+=dt;if(stageT>.045){stageT=0;stageTex.redraw();}}
  const ssc=stageScale*(.55+.45*stageOn);
  stagePlane.scale.set(stageBox.w*ssc,stageBox.h*ssc,1);
  stagePlane.position.y+=(stageBox.y*stageScale-stagePlane.position.y)*(1-Math.exp(-dt*8));

  /* atmosphere by zone */
  const zn=zoneOf(camera.position),Z=ZONES[zn],k=1-Math.exp(-dt*(zn==="sea"?9:4));
  zoneCur.fog.lerp(zoneCol.set(Z.fog),k);
  ["den","sun","hemi","fill","exp"].forEach(key=>{zoneCur[key]+=(Z[key]-zoneCur[key])*k;});
  const openAir=zn==="out"||zn==="room"||zn==="sea";
  zoneCur.env+=(Z.env-zoneCur.env)*k;
  scene.environment=openAir&&skyEnv?skyEnv:roomEnv;scene.environmentIntensity=zoneCur.env;
  if(ocean){ocean.material.uniforms.time.value=amb*.5;ocean.visible=camera.position.y>-.15;underSea.visible=!ocean.visible;}
  scene.fog.color.copy(zoneCur.fog);bgColor.copy(zoneCur.fog);scene.fog.density=zoneCur.den;
  sun.intensity=zoneCur.sun;hemi.intensity=zoneCur.hemi;fill.intensity=zoneCur.fill;renderer.toneMappingExposure=zoneCur.exp;
  skyGroup.visible=zn==="out"||zn==="room";skyGroup.position.copy(camera.position);
  setShadowExt(zn==="room"?6:45);
  sun.target.position.copy(focus);sun.position.copy(focus).addScaledVector(SUN_DIR,140);
  fill.position.copy(focus);
  seaLabel.visible=zn==="sea";fill.position.y+=zn==="model"?5:2.6;fill.position.z+=zn==="model"?7:0;

  /* ambient life */
  curves.forEach((c,ci)=>{for(let j=0;j<7;j++){c.getPointAt((amb*(.05+ci*.004)+j/7+ci*.13)%1,tmpV);dummy.position.copy(tmpV);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();pulses.setMatrixAt(ci*7+j,dummy.matrix);}});
  pulses.instanceMatrix.needsUpdate=true;
  beacon.material.emissiveIntensity=Math.sin(amb*4)>0?4.5:.5;
  blinkers.forEach(b=>{b.material.emissiveIntensity=Math.sin(amb*6+b.userData.blink*1.7)>0?3:.4;});
  towerRing-=dt;
  if(towerRing<0&&!globeOn&&camera.position.x<120&&camera.position.distanceTo(tmpV.set(42,29,-8))>30){towerRing=1.1;emitRing(V(42,29,-8),UP,16,2.6);}
  rings.forEach(r=>{
    if(!r.m.visible) return;
    r.life+=dt/r.dur;
    if(r.life>=1){r.m.visible=false;return;}
    r.m.scale.setScalar(.3+(r.max-.3)*r.life);r.m.material.opacity=(1-r.life)*.75;
  });

  if(!draw) return;
  composer.render();
  if(first){first=false;const l=$("loading");l.style.opacity=0;setTimeout(()=>l.remove(),700);}
}

/* boot */
/* extra detail for the room, the sea floor, the data hall and the inside of the AI (see detail.js) */
const H={scene,model,plant,scatter,M,E,bx,cyl,beam,canvasTex,seaY,seaCurves,GLOW,ms};
roomDetail(H);hallDetail(H);
const seaTick=seaDetail(H),modelTick=modelDetail(H);
applyLanguage();
placeAt(0);
showIntro();
frame();
window.__journey={intro:()=>introOn,showIntro,setThumb:p=>setThumb(p),tap:p=>{tapFx=p;redrawPhone();},HP,hand:()=>hand?.rig()??photoGrip,showGlobe,hideGlobe,renderer,composer,sky:()=>skyInfo,modelInfo,placed,camBase,lookGoal,lookCur,scene,THREE,go,mainAction,setSub,tick:(sec)=>{for(let t=0;t<sec;t+=.04) step(.04,false);step(.04,true);},state:()=>({auto,capDur,item,fin,globeOn,current,sub,done,busy,replayed,beat,waiting,stepping,gates:gates.length,clock,cam:camBase.toArray(),hero:hero.position.toArray()})};
