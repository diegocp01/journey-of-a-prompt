/* The hand that holds the phone.
   A rigged right hand (Babylon.js hand mesh, CC BY 4.0) is posed around the phone: four fingers wrap the left edge,
   the thumb hovers by the Send button and presses it. Skin tones and fingernails are added here.
   Everything is expressed in the phone's own space: x right, y up, z out of the screen toward the viewer. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL=new URL('../assets/hand-right.glb',import.meta.url).href;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const FINGERS=['index','middle','ring','little'];
const chain=f=>['metacarpal','proxPhalanx','intPhalanx','distPhalanx','tip'].map(k=>`${f}_${k}_R`);
const THUMB=['thumb_metacarpal_R','thumb_proxPhalanx_R','thumb_distPhalanx_R','thumb_tip_R'];

/* pose settings (phone space, metres) */
export const HP={
  s:1,                       /* hand size */
  pos:[.052,-.118,-.02],     /* wrist */
  tilt:-.92,                 /* fingers point up-left */
  pitch:-.28,                /* wrist tips toward the viewer, so the arm comes from the bottom of the picture */
  roll:0,
  curl:[[.25,.9],[.25,.9],[.25,.9],[.3,.9]],
  /* each finger: where the last joint sits (outside the left edge) and where the tip aims (on the front bezel) */
  wrapY:[.032,.01,-.012,-.033],
  wrapA:[-.0525,0,-.004],
  wrapB:[-.0335,0,.0135],
  thumbUp:[.04,-.062,.024],  /* resting: hovering just below and right of Send */
  thumbFlex:.12,             /* slight fixed bend of the thumb's last joint; the thumb moves from its base */
  thumbTwist:.9,             /* how far the thumb turns so its nail faces the viewer */
  thumbDown:[.0235,-.052,.0118],
  nailRoll:0
};

/* Loop subdivision of a skinned mesh: rounds the low-poly silhouette. Skin weights are blended along with positions. */
function subdivide(geo){
  const pos=geo.attributes.position,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,idx=geo.index.array;
  /* weld vertices that share a position (the model splits them along seams) */
  const key=i=>`${Math.round(pos.getX(i)*1e5)},${Math.round(pos.getY(i)*1e5)},${Math.round(pos.getZ(i)*1e5)}`;
  const map=new Map(),remap=new Int32Array(pos.count),P=[],W=[];
  for(let i=0;i<pos.count;i++){
    const k=key(i);
    if(!map.has(k)){
      map.set(k,P.length);P.push(V(pos.getX(i),pos.getY(i),pos.getZ(i)));
      const w=new Map();for(let j=0;j<4;j++){const wt=sw.getComponent(i,j);if(wt>0) w.set(si.getComponent(i,j),(w.get(si.getComponent(i,j))||0)+wt);}
      W.push(w);
    }
    remap[i]=map.get(k);
  }
  const tris=[];for(let i=0;i<idx.length;i+=3){const a=remap[idx[i]],b=remap[idx[i+1]],c=remap[idx[i+2]];if(a!==b&&b!==c&&a!==c) tris.push([a,b,c]);}
  const blend=(list)=>{const out=new Map();list.forEach(([w,k])=>w.forEach((wt,b)=>out.set(b,(out.get(b)||0)+wt*k)));return out;};
  /* edges and their opposite vertices */
  const edges=new Map(),nbr=P.map(()=>new Set());
  const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  tris.forEach(([a,b,c])=>{
    [[a,b,c],[b,c,a],[c,a,b]].forEach(([u,v,o])=>{const k=ek(u,v);if(!edges.has(k)) edges.set(k,{u,v,opp:[]});edges.get(k).opp.push(o);nbr[u].add(v);nbr[v].add(u);});
  });
  const boundary=new Set();edges.forEach(e=>{if(e.opp.length!==2){boundary.add(e.u);boundary.add(e.v);}});
  const NP=[],NW=[];
  /* moved original vertices */
  P.forEach((p,i)=>{
    const ns=[...nbr[i]],n=ns.length;
    if(boundary.has(i)||n<3){NP.push(p.clone());NW.push(W[i]);return;}
    const beta=n===3?3/16:3/(8*n),q=p.clone().multiplyScalar(1-n*beta);
    ns.forEach(j=>q.addScaledVector(P[j],beta));
    NP.push(q);NW.push(W[i]);
  });
  /* one new vertex per edge */
  const mid=new Map();
  edges.forEach((e,k)=>{
    let q;
    if(e.opp.length===2) q=P[e.u].clone().add(P[e.v]).multiplyScalar(3/8).addScaledVector(P[e.opp[0]],1/8).addScaledVector(P[e.opp[1]],1/8);
    else q=P[e.u].clone().add(P[e.v]).multiplyScalar(.5);
    mid.set(k,NP.length);NP.push(q);NW.push(blend([[W[e.u],.5],[W[e.v],.5]]));
  });
  const ni=[];
  tris.forEach(([a,b,c])=>{const ab=mid.get(ek(a,b)),bc=mid.get(ek(b,c)),ca=mid.get(ek(c,a));ni.push(a,ab,ca, b,bc,ab, c,ca,bc, ab,bc,ca);});
  const g=new THREE.BufferGeometry(),pa=new Float32Array(NP.length*3),ia=new Uint16Array(NP.length*4),wa=new Float32Array(NP.length*4);
  NP.forEach((p,i)=>{
    p.toArray(pa,i*3);
    const top=[...NW[i]].sort((x,y)=>y[1]-x[1]).slice(0,4),sum=top.reduce((s,t)=>s+t[1],0)||1;
    top.forEach(([b,wt],j)=>{ia[i*4+j]=b;wa[i*4+j]=wt/sum;});
  });
  g.setAttribute('position',new THREE.BufferAttribute(pa,3));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(ia,4));
  g.setAttribute('skinWeight',new THREE.BufferAttribute(wa,4));
  g.setIndex(ni);g.computeVertexNormals();
  return g;
}

/* turn the joints of a chain until its last point lands on the target (cyclic coordinate descent) */
function solve(P,names,Q,target,iters=30,steps=null){
  const n=names.length-1;
  const joints=()=>{const out=[P[names[0]].clone()];for(let k=0;k<n;k++) out.push(out[k].clone().add(P[names[k+1]].clone().sub(P[names[k]]).applyQuaternion(Q[k])));return out;};
  for(let it=0;it<iters;it++) for(let k=n-1;k>=0;k--){
    const J=joints(),v1=J[n].clone().sub(J[k]).normalize(),v2=target.clone().sub(J[k]).normalize(),c=Math.min(1,Math.max(-1,v1.dot(v2)));
    if(c>.999999) continue;
    const d=new THREE.Quaternion().setFromAxisAngle(v1.clone().cross(v2).normalize(),Math.min(Math.acos(c),steps?steps[k]:.25));
    for(let m=k;m<n;m++) Q[m].premultiply(d);
  }
  return joints();
}

export function createHand(parent){
  const root=new THREE.Group();parent.add(root);
  let R=null,last=0;

  const skin=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.55,metalness:0,sheen:.45,sheenRoughness:.55,sheenColor:new THREE.Color(0xff7a5c),
    clearcoat:.08,clearcoatRoughness:.55,envMapIntensity:.22});
  /* fine skin relief drawn by the shader: pores everywhere, crease lines across every knuckle.
     It is worked out on the hand's resting shape, so the creases stay put when the fingers bend. */
  const SKIN_J=14,skinU={uJ:{value:Array.from({length:SKIN_J},()=>V(0,0,0))},uA:{value:Array.from({length:SKIN_J},()=>V(0,1,0))},
    uPore:{value:.00006},uWr:{value:.00022},uDark:{value:.32}};
  skin.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,skinU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvRest=transformed;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vRest;uniform vec3 uJ[${SKIN_J}];uniform vec3 uA[${SKIN_J}];uniform float uPore;uniform float uWr;uniform float uDark;
float sHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float sNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(sHash(i),sHash(i+vec3(1,0,0)),f.x),mix(sHash(i+vec3(0,1,0)),sHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(sHash(i+vec3(0,0,1)),sHash(i+vec3(1,0,1)),f.x),mix(sHash(i+vec3(0,1,1)),sHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
/* how deep the skin folds here, 0..1: bands of wrinkles across each knuckle, plus faint criss-cross lines everywhere */
float creaseF(vec3 p){
  float c=0.;
  for(int j=0;j<${SKIN_J};j++){
    vec3 d=p-uJ[j];float al=dot(d,uA[j]);float rad=length(d-al*uA[j]);
    float m=exp(-al*al/(.0046*.0046))*(1.-smoothstep(.012,.021,rad));
    float wob=sNoise(p*420.)*3.5+sNoise(p*90.)*2.;
    float s=sin(al*3000.+wob);
    c=max(c,m*pow(max(0.,-s),2.5)*(.55+.45*sNoise(p*900.)));
  }
  float f1=sin(dot(p,vec3(.82,.47,.33))*4300.+sNoise(p*240.)*7.);
  float f2=sin(dot(p,vec3(-.35,.62,.70))*3900.+sNoise(p*210.+7.)*7.);
  c=max(c,.32*(pow(max(0.,-f1),9.)+pow(max(0.,-f2),9.))*sNoise(p*160.+3.));
  return c;
}
float skinH(vec3 p){
  return (sNoise(p*1700.)-.5)*uPore+(sNoise(p*650.)-.5)*uPore*1.6-creaseF(p)*uWr;
}
vec3 skinBump(vec3 pos,vec3 n,float fd){
  float h=skinH(vRest);vec2 dh=vec2(dFdx(h),dFdy(h));
  vec3 sx=normalize(dFdx(pos)),sy=normalize(dFdy(pos)),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1)*fd;
  return normalize(abs(det)*n-sign(det)*(dh.x*r1+dh.y*r2));
}`).replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-uDark*creaseF(vRest);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=skinBump(-vViewPosition,normal,faceDirection);');
  };
  const nailMat=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.32,metalness:0,clearcoat:.55,clearcoatRoughness:.22,envMapIntensity:.45});
  /* a nail: a thin shell with rounded corners, curved across its width so its sides tuck into the skin.
     Local axes: x across the nail, y from the cuticle (-1) to the tip (+1), z out of the finger. */
  const nailGeo=new THREE.PlaneGeometry(2,2,26,26);
  {const a=nailGeo.attributes.position,cols=new Float32Array(a.count*3),c=new THREE.Color();
   const bed=new THREE.Color(0xd99a88),moon=new THREE.Color(0xe9c7bb),edge=new THREE.Color(0xf1e3d6),fold=new THREE.Color(0xb57560);
   for(let i=0;i<a.count;i++){
     const u=a.getX(i),w=a.getY(i);
     /* square grid -> rounded rectangle, a little narrower at the cuticle */
     const x=(u*(1-.45*(1-Math.sqrt(1-w*w/2))))*(1-.12*Math.max(0,-w)),y=w*(1-.42*(1-Math.sqrt(1-u*u/2)));
     a.setXYZ(i,x,y,-(1.25*x*x*x*x+.25*x*x+.08*Math.max(0,-y)*Math.max(0,-y)));
     const r=Math.hypot(x*1.15,(y+1)*1.5);
     c.copy(bed).lerp(moon,Math.max(0,1-r/.62)*.75)
      .lerp(edge,.85*Math.min(1,Math.max(0,(y-.8)/.12)))
      .lerp(fold,Math.min(1,Math.max(0,(Math.abs(x)-.78)/.2))*.7+Math.min(1,Math.max(0,(-y-.86)/.12))*.6);
     c.toArray(cols,i*3);
   }
   nailGeo.computeVertexNormals();nailGeo.setAttribute('color',new THREE.BufferAttribute(cols,3));}

  /* the bones of this model are all siblings, so each chain is placed by hand: turn a segment, carry the next joint along */
  function place(names,Q){
    const {B,P,rest}=R;let pos=P[names[0]].clone();
    names.forEach((n,k)=>{
      const q=Q[Math.min(k,Q.length-1)];
      B[n].position.copy(pos);B[n].quaternion.copy(q).multiply(rest[n]);
      if(k<names.length-1) pos=pos.clone().add(P[names[k+1]].clone().sub(P[n]).applyQuaternion(q));
    });
  }

  function pose(p){
    last=p;if(!R) return;
    const {h,P}=R,I=new THREE.Quaternion();
    /* hand axes: fingers +Y, palm +Z, thumb +X  ->  phone axes: fingers toward -x, palm toward the viewer */
    const m=new THREE.Matrix4().makeBasis(V(0,1,0),V(-1,0,0),V(0,0,1)),q=new THREE.Quaternion();
    h.quaternion.setFromRotationMatrix(m).premultiply(q.setFromAxisAngle(V(0,0,1),HP.tilt));
    const fd=V(-Math.cos(HP.tilt),-Math.sin(HP.tilt),0);
    h.quaternion.premultiply(q.setFromAxisAngle(V(fd.y,-fd.x,0).normalize(),HP.pitch));
    h.quaternion.premultiply(q.setFromAxisAngle(fd,HP.roll));
    h.position.set(...HP.pos);h.scale.setScalar(HP.s);
    h.updateMatrixWorld(true);
    const toHand=a=>h.worldToLocal(parent.localToWorld(V(...a)));
    FINGERS.forEach((f,i)=>{
      const n=chain(f),ax=P[n[2]].clone().sub(P[n[1]]).cross(V(0,0,1)).normalize();
      const Qp=new THREE.Quaternion().setFromAxisAngle(ax,HP.curl[i][0]),Qi=new THREE.Quaternion().setFromAxisAngle(ax,HP.curl[i][0]+HP.curl[i][1]);
      const A=toHand([HP.wrapA[0],HP.wrapY[i],HP.wrapA[2]]),Bt=toHand([HP.wrapB[0],HP.wrapY[i]+.002,HP.wrapB[2]]);
      const J=solve(P,[n[1],n[2],n[3]],[Qp,Qi],A);
      /* last segment: aim from where the joint ended up toward the bezel */
      const cur=P[n[4]].clone().sub(P[n[3]]).applyQuaternion(Qi).normalize(),want=Bt.clone().sub(J[2]).normalize();
      const Qd=new THREE.Quaternion().setFromUnitVectors(cur,want).multiply(Qi);
      place(n,[I,Qp,Qi,Qd,Qd]);
    });
    /* thumb: it swings from its base and stays nearly straight. The last joint keeps a small fixed bend,
       so only the two lower joints are solved. */
    const [tm,tp,td,tt]=THUMB,flexAx=P[tt].clone().sub(P[td]).cross(R.thumbDorsal).normalize();
    const flexQ=new THREE.Quaternion().setFromAxisAngle(flexAx,-HP.thumbFlex);
    P._thumbEnd=P[td].clone().add(P[tt].clone().sub(P[td]).applyQuaternion(flexQ));
    const names=[tm,tp,'_thumbEnd'],Qt=[new THREE.Quaternion(),new THREE.Quaternion()];
    const tgt=toHand(V(...HP.thumbUp).lerp(V(...HP.thumbDown),p).toArray());
    solve(P,[tm,'_thumbEnd'],[Qt[0]],tgt,12);Qt[1].copy(Qt[0]);          /* first aim the whole thumb from its base */
    const J=solve(P,names,Qt,tgt,30,[.25,.05]);
    /* turn the thumb about its own line so the nail faces the viewer, as when you press with the pad */
    const axis=J[2].clone().sub(J[0]).normalize(),flat=u=>u.addScaledVector(axis,-u.dot(axis)).normalize();
    const a=flat(R.thumbDorsal.clone().applyQuaternion(Qt[1])),b=flat(toHand([0,0,1]).sub(toHand([0,0,0])));
    const ang=Math.atan2(a.clone().cross(b).dot(axis),a.dot(b))*HP.thumbTwist;
    [.45,1].forEach((k,i)=>Qt[i].premultiply(new THREE.Quaternion().setFromAxisAngle(axis,ang*k)));
    solve(P,names,Qt,tgt,10,[.25,.05]);
    const Qd=Qt[1].clone().multiply(flexQ);
    place(THUMB,[Qt[0],Qt[1],Qd,Qd]);
  }

  new GLTFLoader().load(MODEL_URL,g=>{
    const h=g.scene,B={},rest={},P={};let mesh=null;
    h.traverse(o=>{if(o.isSkinnedMesh) mesh=o;if(o.isBone){B[o.name]=o;rest[o.name]=o.quaternion.clone();P[o.name]=o.position.clone();}});
    mesh.geometry=subdivide(subdivide(mesh.geometry));
    /* feed the knuckle positions and finger directions to the skin shader */
    {let j=0;const put=(a,b)=>{skinU.uJ.value[j].copy(P[a]);skinU.uA.value[j].copy(P[b]).sub(P[a]).normalize();j++;};
     FINGERS.forEach(f=>{const n=chain(f);put(n[1],n[2]);put(n[2],n[3]);put(n[3],n[4]);});put(THUMB[1],THUMB[2]);put(THUMB[2],THUMB[3]);}
    /* skin tones: pinker fingertips and knuckles, lighter palm */
    const pos=mesh.geometry.attributes.position,nor=mesh.geometry.attributes.normal,col=new Float32Array(pos.count*3);
    const base=new THREE.Color(0xa96d4b),pink=new THREE.Color(0xbd6650),palm=new THREE.Color(0xc99377),c=new THREE.Color(),v=V(0,0,0);
    const tips=[...FINGERS.map(f=>P[`${f}_tip_R`]),P.thumb_tip_R],knuckles=[...FINGERS.flatMap(f=>[P[`${f}_proxPhalanx_R`],P[`${f}_intPhalanx_R`],P[`${f}_distPhalanx_R`]]),P.thumb_proxPhalanx_R,P.thumb_distPhalanx_R];
    const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);
      const dt=Math.min(...tips.map(t=>t.distanceTo(v))),dk=Math.min(...knuckles.map(t=>t.distanceTo(v))),nz=nor.getZ(i);
      c.copy(base).lerp(palm,.75*sm(.1,.8,nz)).lerp(pink,.55*sm(.03,.008,dt)+.22*sm(.014,.006,dk)*sm(.2,-.6,nz));
      /* a little mottling so the skin is not one flat colour */
      const n=.035*Math.sin(v.x*900+v.y*700)*Math.sin(v.y*1100+v.z*800);
      c.multiplyScalar(1+n);c.toArray(col,i*3);
    }
    mesh.geometry.setAttribute('color',new THREE.BufferAttribute(col,3));
    mesh.material=skin;mesh.castShadow=true;mesh.frustumCulled=false;
    root.add(h);h.updateMatrixWorld(true);
    /* fingernails, placed on the back of each last finger segment and carried by its bone */
    /* fingernails. Each one is fitted to the actual shape of the last finger segment:
       the segment's flattest side is the nail side, the nail ends just short of the real fingertip,
       and it covers about the last third of the segment, as on a real finger. */
    const nails=[];let thumbDorsal=V(0,0,-1);
    const palmC=P.index_proxPhalanx_R.clone().add(P.little_proxPhalanx_R).multiplyScalar(.5);
    [...FINGERS.map(f=>[`${f}_distPhalanx_R`,`${f}_tip_R`]),['thumb_distPhalanx_R','thumb_tip_R']].forEach(([dn,tn])=>{
      const isThumb=dn.startsWith('thumb'),a=P[dn],dir=P[tn].clone().sub(a).normalize();
      /* skin points around this segment */
      const pts=[];let tipA=0;
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i).sub(a);
        const al=v.dot(dir),off=v.clone().addScaledVector(dir,-al);
        if(al>-.002&&off.length()<.013&&al<.045){pts.push([al,off]);tipA=Math.max(tipA,al);}
      }
      /* flattest side: the direction across the segment with the least spread */
      const mid=pts.filter(([al])=>al>tipA*.35&&al<tipA*.8).map(([,o])=>o);
      const cen=mid.reduce((s,o)=>s.add(o),V(0,0,0)).multiplyScalar(1/Math.max(1,mid.length));
      const e1=Math.abs(dir.x)<.9?V(1,0,0).cross(dir).normalize():V(0,1,0).cross(dir).normalize(),e2=dir.clone().cross(e1);
      let xx=0,xy=0,yy=0;mid.forEach(o=>{const d=o.clone().sub(cen),x=d.dot(e1),y=d.dot(e2);xx+=x*x;xy+=x*y;yy+=y*y;});
      const ang=.5*Math.atan2(2*xy,xx-yy),major=e1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(e2,Math.sin(ang));
      let dorsal=dir.clone().cross(major).normalize();
      /* of the two flat sides, the nail is on the back of the hand (fingers) or facing away from the palm (thumb) */
      if(isThumb){const away=a.clone().sub(palmC);if(dorsal.dot(away.addScaledVector(dir,-away.dot(dir)))<0) dorsal.negate();}
      else if(dorsal.z>0) dorsal.negate();
      const side=dir.clone().cross(dorsal).normalize();
      /* nail length and position along the segment */
      const len=tipA*(isThumb?.4:.38),endA=tipA-(isThumb?.0016:.0013),cA=endA-len/2;
      let top=-1,wid=0;
      pts.forEach(([al,o])=>{if(Math.abs(al-cA)<len*.5){const t=o.dot(dorsal);if(t>top) top=t;}if(Math.abs(al-cA)<.002) wid=Math.max(wid,Math.abs(o.dot(side)));});
      if(isThumb) thumbDorsal=dorsal.clone();
      const nail=new THREE.Mesh(nailGeo,nailMat);
      nail.scale.set(wid*(isThumb?.8:.78),len/2,.0016);
      nail.position.copy(a).addScaledVector(dir,cA).addScaledVector(dorsal,top+.00065);
      nail.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,dir,dorsal));
      h.add(nail);nail.updateMatrixWorld(true);B[dn].attach(nail);nails.push(nail);
    });
    /* forearm, so the hand does not end in mid-air */
    const forearm=new THREE.CylinderGeometry(1,1,.34,48,24,false);
    const ap=forearm.attributes.position,ac=new Float32Array(ap.count*3);
    for(let i=0;i<ap.count;i++){
      const y=ap.getY(i)-.163,t=THREE.MathUtils.clamp(-y/.33,0,1);
      const x=ap.getX(i),z=ap.getZ(i),angle=Math.atan2(z,x);
      const muscle=Math.sin(Math.PI*t*.95),wrist=Math.exp(-(((t-.11)/.09)**2));
      const ridge=.0015*wrist*Math.cos(2*angle+.55)+.0016*muscle*Math.cos(3*angle+.7*t);
      ap.setXYZ(i,.004+.004*t+x*(.0272+.012*muscle+ridge),y,.006-.004*t+z*(.0196+.010*muscle+ridge));
      c.copy(base).lerp(palm,.30*Math.max(0,z)).lerp(pink,.09*wrist).toArray(ac,i*3);
    }
    forearm.computeVertexNormals();forearm.setAttribute('color',new THREE.BufferAttribute(ac,3));
    const arm=new THREE.Mesh(forearm,skin);arm.castShadow=true;h.add(arm);
    R={h,B,P,rest,mesh,nails,arm,thumbDorsal,skinU,skin};
    pose(last);
  });

  return {pose,rig:()=>R,root};
}
