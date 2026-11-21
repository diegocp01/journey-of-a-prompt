/* The ride inside the cable: a first-person view from the message itself,
   racing down a thread of glass under the ocean. Streaks of light rush past on the glass wall,
   with neighbouring buffered fibres beyond the cladding and brighter splices passing the camera.
   It sits far away from the rest of the world, in its own spot. */
import * as THREE from 'three';

export const TUNNEL_AT = new THREE.Vector3(-3000, 0, 0);
const LENGTH = 420;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createTunnel(scene, glow) {
  const R = rng(5), root = new THREE.Group();
  root.name = 'Cable ride';
  root.position.copy(TUNNEL_AT);
  root.visible = false;
  scene.add(root);
  const spin = new THREE.Group();   /* everything that turns round the cable's own line */
  root.add(spin);

  /* streaks of light that run along the glass: tall thin strokes on a see-through picture, wrapped round a tube */
  const streakTex = (count, colours, seed) => {
    const rr = rng(seed), c = document.createElement('canvas');
    c.width = 512; c.height = 1024;
    const g = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = rr() * 512, len = 90 + rr() * 520, y = rr() * 1024, w = 1 + rr() * 3.2, col = colours[Math.floor(rr() * colours.length)];
      /* drawn twice, one picture-height apart, so the pattern repeats without a seam */
      [0, -1024].forEach(dy => {
        const gr = g.createLinearGradient(0, y + dy, 0, y + dy + len);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.75, col); gr.addColorStop(1, 'rgba(255,255,255,.95)');
        g.fillStyle = gr; g.fillRect(x, y + dy, w, len);
      });
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const tube = (radius, tex, repeat, opacity) => {
    tex.repeat.set(repeat[0], repeat[1]);
    const geo = new THREE.CylinderGeometry(radius, radius, LENGTH, 56, 1, true);
    geo.rotateZ(-Math.PI / 2); geo.translate(LENGTH / 2 - 12, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, opacity, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false}));
    m.frustumCulled = false; spin.add(m);
    return m;
  };
  const inner = tube(1.05, streakTex(29, ['rgba(120,220,255,.75)', 'rgba(255,214,120,.8)', 'rgba(255,255,255,.7)'], 11), [2, 5], .68);
  const mid = tube(1.7, streakTex(24, ['rgba(70,150,255,.6)', 'rgba(120,220,255,.5)'], 23), [2, 4], .42);

  /* Deep blue light scattered behind the cladding, with soft colour variation along the strand. */
  const sea = document.createElement('canvas'); sea.width = 256; sea.height = 512;
  {
    const g = sea.getContext('2d'); g.fillStyle = '#04123f'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 70; i++) {
      const x = R() * 256, y = R() * 512, r = 14 + R() * 46;
      [[0, 0], [0, -512], [0, 512], [-256, 0], [256, 0]].forEach(([dx, dy]) => {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, 'rgba(60,130,235,.34)'); gr.addColorStop(1, 'rgba(60,130,235,0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      });
    }
  }
  const seaTex = new THREE.CanvasTexture(sea);
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.colorSpace = THREE.SRGBColorSpace; seaTex.repeat.set(4, 3);
  const oceanGeo = new THREE.CylinderGeometry(6, 6, LENGTH, 40, 1, true);
  oceanGeo.rotateZ(-Math.PI / 2); oceanGeo.translate(LENGTH / 2 - 12, 0, 0);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshBasicMaterial({map: seaTex, side: THREE.BackSide, fog: false}));
  ocean.frustumCulled = false; spin.add(ocean);

  // The camera is inside one glass core. Draw the buffered fibres outside
  // its cladding as round strands, so their flanks occlude one another.
  const strandRadius = .115, strandCount = 8, advance = {value:0};
  const fiberGeo = new THREE.CylinderGeometry(strandRadius, strandRadius, 112, 14, 112, true);
  fiberGeo.rotateZ(-Math.PI / 2);
  fiberGeo.translate(48,0,0);
  const strandMaterial = new THREE.ShaderMaterial({
    uniforms:{advance},
    vertexShader:`
      uniform float advance;
      varying vec3 flank;
      varying vec3 towardEye;
      varying float strand;
      void main(){
        strand=float(gl_InstanceID);
        float a=(position.x+advance)*.033+strand*.78539816+.12*sin(strand*4.2);
        float r=1.61+.15*cos(strand*2.2);
        vec3 p=position+vec3(0.,r*cos(a),r*sin(a));
        p.y+=.54*(1.-cos(p.x*.11));
        p.z+=.47*sin(p.x*.15)-.075*p.x;
        vec4 view=modelViewMatrix*vec4(p,1.);
        flank=normalMatrix*normalize(vec3(.033*r*(sin(a)*normal.y-cos(a)*normal.z),normal.yz));
        towardEye=-view.xyz;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec3 flank;
      varying vec3 towardEye;
      varying float strand;
      void main(){
        vec3 n=normalize(flank), v=normalize(towardEye);
        float nDotV=max(0.,dot(n,v));
        float edge=pow(1.-nDotV,4.);
        float reflected=dot(reflect(-v,n),normalize(vec3(-.4,.7,.28)));
        vec3 body=mix(vec3(.012,.068,.11),vec3(.025,.16,.21),.5+.5*sin(strand*8.));
        if(mod(strand,5.)<.5)body=vec3(.19,.095,.032);
        vec3 tint=body*(.36+.65*max(dot(n,normalize(vec3(-.6,.8,.32))),0.));
        tint+=edge*vec3(.045,.105,.16)+smoothstep(.63,.94,reflected)*vec3(.12,.23,.30);
        tint=mix(tint,vec3(.022,.064,.145),smoothstep(11.,66.,length(towardEye))*.82);
        gl_FragColor=vec4(tint,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const strands = new THREE.InstancedMesh(fiberGeo,strandMaterial,strandCount);
  strands.frustumCulled=false;
  strands.name='Stranded optical fibre bundle';
  spin.add(strands);

  // Trace one guided signal as it grazes alternate sides of the core. A
  // moving packet lights only a short part of each path at any instant.
  const traced=new THREE.Group();
  traced.name='Light paths in the glass core';
  for(let k=0;k<2;k++){
    const p=[];
    const az=.58+k*1.23, cy=Math.cos(az), cz=Math.sin(az);
    for(let i=-1;i<14;i++){
      const x=i*5.85+k*1.7;
      const side=i%2===0?.91:-.91;
      p.push(new THREE.Vector3(x,side*cy+.10,side*cz));
    }
    const path=new THREE.CurvePath();
    for(let i=1;i<p.length;i++)path.add(new THREE.LineCurve3(p[i-1],p[i]));
    const glowMat=new THREE.ShaderMaterial({
      uniforms:{advance,offset:{value:k*7.},gold:{value:k===0?1:0}},
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`varying float along;
        void main(){along=position.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float advance; uniform float offset;uniform float gold;varying float along;
        void main(){
          float phase=mod(advance*.8-along+offset,17.);
          float pulse=exp(-phase*.87);
          vec3 hue=mix(vec3(.25,.79,1.),vec3(1.,.67,.21),gold);
          gl_FragColor=vec4(hue*(1.+2.7*pulse),(.20+.8*pulse)*(1.-smoothstep(16.,70.,along)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const trace=new THREE.Mesh(new THREE.TubeGeometry(path,112,.007,5,false),glowMat);
    trace.renderOrder=3;traced.add(trace);
  }
  spin.add(traced);

  // A glass/air boundary picks up a narrow reflection at grazing angles.
  // Angular bands simulate a refracted second image of the coloured fibres.
  const claddingGeo=new THREE.CylinderGeometry(1.12,1.12,112,80,1,true);
  claddingGeo.rotateZ(-Math.PI/2); claddingGeo.translate(48,0,0);
  const cladding=new THREE.Mesh(claddingGeo,new THREE.ShaderMaterial({
    uniforms:{advance}, side:THREE.BackSide, transparent:true, depthWrite:false,
    vertexShader:`
      varying vec3 corePoint;
      void main(){corePoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      uniform float advance;
      varying vec3 corePoint;
      void main(){
        float angle=atan(corePoint.z,corePoint.y)-(corePoint.x+advance)*.033;
        float ribbon=cos(angle*8.+.36*sin(2.*angle));
        float edge=smoothstep(.19,.70,ribbon)*(1.-smoothstep(.73,.98,ribbon));
        float rim=smoothstep(.72,.91,ribbon)*(1.-smoothstep(.92,.995,ribbon));
        float farFade=1.-smoothstep(15.,58.,corePoint.x);
        gl_FragColor=vec4(vec3(.11,.43,.56)+rim*vec3(.27,.34,.31),farFade*(.10+.19*edge+.21*rim+.10*pow(.5+.5*cos(corePoint.x*.92-advance*.26),6.)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  cladding.name='Inner optical cladding';
  cladding.renderOrder=1;
  inner.renderOrder=2;
  spin.add(cladding);
  /* rings that flash past: the repeaters built into a real sea cable */
  const RINGS = 14, GAP = LENGTH / RINGS;
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.08, .045, 8, 48),
    new THREE.MeshBasicMaterial({color: 0x7fe3ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}), RINGS);
  rings.frustumCulled = false; spin.add(rings);
  const d = new THREE.Object3D();

  /* the far end of the thread: a bright point the message is racing toward */
  const far = new THREE.Sprite(new THREE.SpriteMaterial({map: glow, color: 0xcfeaff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  far.position.set(150, 1.2, -9); far.scale.set(26, 26, 1); root.add(far);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({map: glow, color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  core.position.copy(far.position); core.scale.set(7, 7, 1); root.add(core);

  let travelled = 0;
  function tick(t, dt, speed = 1) {
    if (!root.visible) return;
    travelled += dt * 150 * speed;
    advance.value=travelled*.26;
    inner.material.map.offset.y = travelled / (LENGTH / 5);
    mid.material.map.offset.y = travelled * .62 / (LENGTH / 4);
    seaTex.offset.y = travelled * .16 / (LENGTH / 3);
    for (let i = 0; i < RINGS; i++) {
      const x = ((i * GAP - travelled) % LENGTH + LENGTH) % LENGTH - 12;
      d.position.set(x, 0, 0); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); rings.setMatrixAt(i, d.matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
    /* the thread is not perfectly straight: it turns slowly and sways */
    spin.rotation.x = .17*Math.sin(t*.33);
    root.rotation.y = Math.sin(t * .55) * .05; root.rotation.z = Math.sin(t * .4) * .04;
    far.material.opacity = .8 + .15 * Math.sin(t * 9);
  }
  return {root, tick, show: v => { root.visible = v; }};
}
