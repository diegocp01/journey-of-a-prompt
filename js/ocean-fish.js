import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const v = (x,y,z) => new THREE.Vector3(x,y,z);

// All parts share a single animated mesh. The snout is +X; bending increases
// from the trunk to the tail, so the skull, gill covers and eyes remain stable.
function fishShape(deep) {
  const parts = [];
  function add(geometry,color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geometry !== g) geometry.dispose();
    g.deleteAttribute('uv');
    if (!g.attributes.color) {
      const c = new THREE.Color(color), colors = [];
      for (let i=0;i<g.attributes.position.count;i++) colors.push(c.r,c.g,c.b);
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    }
    parts.push(g);
  }
  function oval(x,y,z,a,b,c,color) {
    const g=new THREE.SphereGeometry(1,16,12);g.scale(a,b,c);g.translate(x,y,z);add(g,color);
  }
  function line(points,r,color) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>v(...p))),10,r,5,false),color);
  }

  // Cross sections run from the caudal tip to the nose, with separate back,
  // belly and cheek profiles. The grenadier has a long, tapering tail.
  const rings = deep ? [
    [-.94,.003,.004,-.025],[-.76,.020,.009,-.025],[-.55,.051,.024,-.023],[-.30,.100,.046,-.01],
    [-.06,.145,.082,.012],[.15,.177,.106,.02],[.32,.147,.105,.014],[.42,.101,.081,.01],[.51,.048,.048,.002],[.55,.003,.004,-.006]
  ] : [
    [-.46,.025,.017,.012],[-.37,.052,.036,.01],[-.24,.118,.059,0],[-.05,.158,.079,.005],
    [.14,.154,.077,.007],[.27,.116,.071,.005],[.365,.063,.048,.003],[.405,.009,.009,.006]
  ];
  const sections=new THREE.CatmullRomCurve3(rings.map(([x,h,w])=>v(x,h,w)),false,'catmullrom',.27);
  const pos=[], colors=[], index=[],segments=42,sides=40;
  const belly=new THREE.Color(deep?0xd7cec0:0xd7e3df), flank=new THREE.Color(deep?0x929997:0x8daaaa), back=new THREE.Color(deep?0x485858:0x344e54);
  for(let i=0;i<=segments;i++){
    const t=i/segments,p=sections.getPoint(t), ring=t*(rings.length-1),k=Math.min(Math.floor(ring),rings.length-2);
    const cy=THREE.MathUtils.lerp(rings[k][3],rings[k+1][3],ring-k);
    for(let j=0;j<sides;j++){
      const angle=TAU*j/sides,y=Math.cos(angle),z=Math.sin(angle);
      pos.push(p.x,cy+p.y*y,p.z*z);
      const col=flank.clone().lerp(y>0?back:belly,Math.abs(y)**.78);
      const scales=(Math.sin(i*3.7+j*.77)*.5+.5)*.08;
      const lateralLine=Math.exp(-Math.abs(y-.10)*28)*.19;
      col.multiplyScalar(1+scales-lateralLine);colors.push(col.r,col.g,col.b);
      if(i<segments){const a=i*sides+j,b=i*sides+(j+1)%sides;index.push(a,b,a+sides,b,b+sides,a+sides);}
    }
  }
  const skin=new THREE.BufferGeometry();skin.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  skin.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));skin.setIndex(index);skin.computeVertexNormals();add(skin);

  // A membrane stretched over a fan of rays, with a scalloped outer edge.
  function fin(base,edge,shade) {
    const a=new THREE.CatmullRomCurve3(base.map(p=>v(...p))), b=new THREE.CatmullRomCurve3(edge.map(p=>v(...p)));
    const positions=[],tints=[],indices=[],n=20;
    for(let i=0;i<=n;i++){
      const t=i/n,root=a.getPoint(t),tip=b.getPoint(t);
      tip.lerp(root,.04*Math.sin(Math.PI*i/2)**2);
      for(const [j,f] of [0,.52,1].entries()){
        const p=root.clone().lerp(tip,f);p.z+=.014*Math.sin(Math.PI*f)*Math.sin(Math.PI*t);positions.push(p.x,p.y,p.z);
        const c=new THREE.Color(shade).multiplyScalar((.78+f*.20)*(i%2?.85:1.19));
        tints.push(c.r,c.g,c.b);if(i<n&&j<2){const k=i*3+j;indices.push(k,k+1,k+3,k+1,k+4,k+3);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));g.setIndex(indices);g.computeVertexNormals();add(g);
  }
  if(deep){
    fin([[-.23,.10,0],[.02,.15,0],[.18,.175,0]],[[-.26,.12,0],[-.025,.24,0],[.109,.324,0],[.18,.179,0]],0x788789);
    fin([[-.91,-.015,0],[-.51,.033,0],[-.27,.085,0]],[[-.93,.006,0],[-.65,.062,0],[-.29,.119,0]],0x778486);
    fin([[-.91,-.027,0],[-.52,-.067,0],[.01,-.13,0]],[[-.925,-.041,0],[-.48,-.113,0],[.005,-.163,0]],0xb1a596);
    line([[.386,-.068,0],[.368,-.115,.006],[.342,-.137,.012]],.003,0xc7c3b3);
  }else{
    fin([[-.45,-.024,0],[-.45,.01,0],[-.45,.039,0]],[[-.63,-.151,0],[-.535,-.052,0],[-.515,.005,0],[-.55,.075,0],[-.635,.169,0]],0x627d80);
    fin([[-.23,.095,0],[-.05,.154,0],[.10,.156,0]],[[-.25,.108,0],[-.128,.235,0],[.018,.253,0],[.10,.156,0]],0x6b8383);
    fin([[-.34,-.05,0],[-.19,-.123,0],[-.07,-.147,0]],[[-.37,-.105,0],[-.225,-.183,0],[-.07,-.147,0]],0x9eafac);
  }
  for(const side of [-1,1]){
    const eyeX=deep?.325:.268,eyeY=deep?.067:.05,eyeZ=deep?.090:.065,r=deep?.033:.024;
    oval(eyeX,eyeY,side*eyeZ,r*1.23,r*1.13,r*.56,0x4f5753);
    oval(eyeX,eyeY,side*(eyeZ+.008),r,r,r*.62,0xc2ac6e);
    oval(eyeX+.003,eyeY,side*(eyeZ+.016),r*.79,r*.82,r*.58,0x101b22);
    oval(eyeX+.009,eyeY+r*.30,side*(eyeZ+.016+r*.48),r*.16,r*.14,r*.11,0xf3ede0);
    const x=deep?.234:.185,z=deep?.104:.075;
    line([[x+.018,.096,side*z*.71],[x-.009,.032,side*z],[x-.018,-.028,side*z],[x+.018,-.081,side*z*.72]],.004,0x56615e);
    fin([[x,-.024,side*z],[x+.008,-.045,side*z],[x+.028,-.059,side*z*.85]],
      [[x,-.022,side*z],[x-.11,-.068,side*(z+.080)],[x-.21,-.113,side*(z+.104)],[x+.023,-.06,side*z]],0x83928d);
    const mouthX=deep?.544:.4;
    line([[mouthX,-.006,side*.006],[mouthX-.045,-.025,side*.036],[mouthX-.082,-.026,side*.056]],.0033,0x545951);
  }
  const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function createOceanFish(parent,bedHeight,random) {
  const clock={value:0},d=new THREE.Object3D();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.14,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.seaTime=clock;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float seaTime;')
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float phase = instanceMatrix[3].x*.63 + instanceMatrix[3].z;
        float hind = clamp((.21-position.x)*.96,0.,1.2);
        float angle = seaTime*4.0 + phase + position.x*4.4;
        float slope = -.41*hind*sin(angle) + .93*hind*hind*cos(angle);
        objectNormal.x -= slope*objectNormal.z;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.z += .21*hind*hind*sin(angle);`);
  };
  const schools=[[],[]];
  // Shallow shoals follow shared headings, with individual spacing and phase.
  for(const x of [138,145,238,243]){
    const phase=random()*TAU;
    for(let i=0;i<11;i++)schools[0].push({x:x+(random()-.5)*3.8,z:-2.8+(random()-.5)*3.5,
      clearance:1+random()*1.1,phase:phase+random()*.6,pace:.25,radius:1.1+random()*.55,scale:.46+random()*.30});
  }
  // Slow bottom dwellers, stationed on alternating shoulders of the cable corridor.
  for(const [x,z,h,s] of [[152,-2,1,.78],[162,1.6,.62,.9],[173,-2.1,1.12,1.1],[182,-1.2,.95,.95],
    [188,2.2,.74,.86],[194,-2.2,1.38,1.2],[199,1.9,.95,1.05],[203,-1.25,1.47,1.14],
    [213,1.2,.88,.93],[222,-2.3,1.12,1.05],[230,.8,.75,.83]]){
    schools[1].push({x,z,clearance:h,phase:random()*TAU,pace:.12+random()*.04,radius:.95+random()*.65,scale:s});
  }
  const meshes=schools.map((fish,i)=>{
    const m=new THREE.InstancedMesh(fishShape(i===1),material,fish.length);
    m.name=i?'Deep-water grenadiers':'Silvery coastal shoals';m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled=false;parent.add(m);return m;
  });
  return time=>{
    clock.value=time;
    schools.forEach((fish,i)=>{
      fish.forEach((f,j)=>{
        const a=f.phase+time*f.pace,x=f.x+f.radius*Math.sin(a),z=f.z+f.radius*.44*Math.sin(2*a+.4);
        const y=bedHeight(x,z)+f.clearance+.091*Math.sin(a*1.7+f.phase);
        d.position.set(x,y,z);d.rotation.order='YXZ';
        d.rotation.set(.06*Math.sin(a*2),Math.atan2(-.88*Math.cos(2*a+.4),Math.cos(a)),.045*Math.cos(a*1.7));
        d.scale.setScalar(f.scale);d.updateMatrix();meshes[i].setMatrixAt(j,d.matrix);
      });
      meshes[i].instanceMatrix.needsUpdate=true;
    });
  };
}
