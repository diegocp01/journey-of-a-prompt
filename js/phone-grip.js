import * as THREE from 'three';
import {phoneLayout} from './phone-screen.js';

// Coordinates in the original photograph. Keep the hand in these coordinates
// and slide the handset until Send meets the distal thumb pad.
const WIDTH = 1086;
const HEIGHT = 1448;
const DISPLAY = {x: 157, y: 46, width: 374, height: 748};
const PAD_Y = 653;
const SLIDE = Math.round(PAD_Y - DISPLAY.y - DISPLAY.height * phoneLayout.send.y / phoneLayout.height);
const SCREEN_TOP = DISPLAY.y + SLIDE;
const METRES_PER_PIXEL = .148 / DISPLAY.height;

/* The thumb that taps Send.
   In the photo the thumb lies flat on the Send button. It is cut out of the plate onto its own layer,
   from the tip back to its base knuckle, and that layer is bent in real 3D like a thumb:
     - it hinges at the base knuckle and lifts off the glass toward the viewer,
     - it hinges again at the middle knuckle, so the end points back down at the phone.
   Lengths are kept; any shortening you see is only the camera's perspective on the bent thumb. */
const LAYER = {x: 360, y: 590, width: 370, height: 260};  // plate area that holds the whole thumb
const BASE = {x: 650, y: 760};      // base knuckle: the thumb swings from here
const KNUCKLE = {x: 522, y: 705};   // middle knuckle: the "elbow" of the thumb
const TIP = {x: 404, y: 667};
const FRAME_X = 566;                // right edge of the phone's steel frame where the thumb crosses it
const LIFT = .56;                   // how far the lower half of the thumb rises off the glass, radians
const DIP = -.45;                   // slope of the end half once lifted (negative: pointing down at the phone)
const SWING = .18;                   // small sideways swing from the base knuckle, radians
// outline of the thumb where it lies over the hand (right of the frame), a little inside its creases
const OVER_HAND = [[FRAME_X - 4, 656], [610, 686], [660, 708], [704, 728], [716, 764], [700, 806], [660, 818], [610, 806], [FRAME_X - 4, 792]];

export function createPhotoGrip(parent, drawPhone, {onReady, onError}) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const material = new THREE.MeshBasicMaterial({
    map: texture, alphaTest: .24, transparent: true, toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(
    WIDTH * METRES_PER_PIXEL, HEIGHT * METRES_PER_PIXEL, 52, 72
  ), material);
  // Round the heel and forearm in depth, keeping the contact area and rails
  // fixed. The wrist can then reveal its curvature during the return flight.
  const relief = mesh.geometry.attributes.position;
  for (let i=0; i<relief.count; i++) {
    const x=WIDTH/2+relief.getX(i)/METRES_PER_PIXEL;
    const y=HEIGHT/2-relief.getY(i)/METRES_PER_PIXEL;
    const free=Math.max(THREE.MathUtils.smoothstep(x,568,665),THREE.MathUtils.smoothstep(y,SCREEN_TOP+DISPLAY.height+34,1150));
    const center=644+.47*(y-850);
    const arm=Math.exp(-(((x-center)/155)**2));
    const wrist=THREE.MathUtils.smoothstep(y,790,1090);
    const heel=Math.exp(-(((y-916)/152)**2+((x-682)/134)**2));
    relief.setZ(i,free*(.012*heel+wrist*(.018*arm-.006)));
  }
  mesh.geometry.computeVertexNormals();
  mesh.name = 'ImageGen phone and hand';
  mesh.position.set(
    (WIDTH / 2 - DISPLAY.x - DISPLAY.width / 2) * METRES_PER_PIXEL,
    (SCREEN_TOP + DISPLAY.height / 2 - HEIGHT / 2) * METRES_PER_PIXEL,
    .00485
  );
  mesh.visible = false;
  parent.add(mesh);

  /* ---- the thumb layer ---- */
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = LAYER.width;
  thumbCanvas.height = LAYER.height;
  const thumbTexture = new THREE.CanvasTexture(thumbCanvas);
  thumbTexture.colorSpace = THREE.SRGBColorSpace;
  thumbTexture.anisotropy = 8;
  // plate pixels -> the layer's own coordinates (metres, y up, origin at the layer's centre)
  const local = p => new THREE.Vector2((p.x - LAYER.x - LAYER.width / 2) * METRES_PER_PIXEL,
    (LAYER.y + LAYER.height / 2 - p.y) * METRES_PER_PIXEL);
  const base = local(BASE), axis = local(TIP).sub(base).normalize();
  const lowerLen = local(KNUCKLE).sub(base).dot(axis);
  const bend = {uLift: {value: 0}, uBase: {value: base}, uAxis: {value: axis}};
  const thumbMaterial = new THREE.MeshBasicMaterial({
    map: thumbTexture, transparent: true, depthWrite: false, toneMapped: false
  });
  thumbMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, bend);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uLift; uniform vec2 uBase; uniform vec2 uAxis;
        /* 0 before a joint, then a smooth start, then rising one for one: distance travelled past the joint */
        float past(float x, float h) { return x <= 0. ? 0. : (x < h ? x * x / (2. * h) : x - .5 * h); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        const float L1 = ${lowerLen.toFixed(6)};
        vec2 p = transformed.xy - uBase;
        /* a small swing from the base knuckle, as a whole */
        float sw = ${SWING.toFixed(3)} * uLift * smoothstep(-.25 * L1, .3 * L1, dot(p, uAxis));
        p = vec2(cos(sw) * p.x - sin(sw) * p.y, sin(sw) * p.x + cos(sw) * p.y);
        vec2 side = vec2(-uAxis.y, uAxis.x);
        float a = dot(p, uAxis), b = dot(p, side);
        float lower = past(a, .3 * L1), upper = past(a - L1, .22 * L1);
        float rise = ${LIFT.toFixed(3)} * uLift, dip = ${DIP.toFixed(3)} * uLift;
        /* two straight parts hinged at the knuckles: the lower one rises, the end one points back down */
        float along = a - (1. - cos(rise)) * (lower - upper) - (1. - cos(dip)) * upper;
        transformed.xy = uBase + uAxis * along + side * b;
        transformed.z += sin(rise) * (lower - upper) + sin(dip) * upper;`);
  };
  const thumbMesh = new THREE.Mesh(new THREE.PlaneGeometry(
    LAYER.width * METRES_PER_PIXEL, LAYER.height * METRES_PER_PIXEL, 72, 52
  ), thumbMaterial);
  thumbMesh.name = 'Thumb';
  thumbMesh.position.set(
    (LAYER.x + LAYER.width / 2 - WIDTH / 2) * METRES_PER_PIXEL,
    (HEIGHT / 2 - LAYER.y - LAYER.height / 2) * METRES_PER_PIXEL,
    .0003
  );
  thumbMesh.renderOrder = 2;
  thumbMesh.frustumCulled = false;
  mesh.add(thumbMesh);

  // The polished nail and thumb pad have different curvature. Shape the
  // photographed surface before its existing two joints bend it for the tap.
  const thumbVertices = thumbMesh.geometry.attributes.position;
  for (let i = 0; i < thumbVertices.count; i++) {
    const x = LAYER.x + LAYER.width/2 + thumbVertices.getX(i)/METRES_PER_PIXEL;
    const y = LAYER.y + LAYER.height/2 - thumbVertices.getY(i)/METRES_PER_PIXEL;
    const along = (x-TIP.x)*.91 + (y-TIP.y)*.415;
    const across = -(x-TIP.x)*.415 + (y-TIP.y)*.91;
    const pad = Math.exp(-((across/47)**2)) * Math.exp(-(((along-126)/138)**2));
    const nail = Math.max(0, 1-((along-43)/37)**2-((across+12)/29)**2);
    thumbVertices.setZ(i,.0031*pad+.00085*nail);
  }
  thumbMesh.geometry.computeVertexNormals();

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = phoneLayout.width * 2;
  screenCanvas.height = phoneLayout.height * 2;
  const screenContext = screenCanvas.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(
    DISPLAY.width * METRES_PER_PIXEL, DISPLAY.height * METRES_PER_PIXEL
  ), new THREE.MeshBasicMaterial({map: screenTexture, transparent: true, depthWrite: false, toneMapped: false}));
  screen.name = 'iPhone display';
  screen.position.set((DISPLAY.x + DISPLAY.width / 2 - WIDTH / 2) * METRES_PER_PIXEL,
    (HEIGHT / 2 - SCREEN_TOP - DISPLAY.height / 2) * METRES_PER_PIXEL, .0001);
  screen.renderOrder = 1;
  mesh.add(screen);

  const plate = new Image();
  let glass, fingers, shadow, handPatch;
  const reflection = {value: null};
  screen.material.onBeforeCompile = shader => {
    shader.uniforms.treeReflection = reflection;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec2 eyeSlope;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec3 eye = cameraPosition - (modelMatrix * vec4(transformed, 1.)).xyz;
        float dist = max(.025, dot(eye,normalize(modelMatrix[2].xyz)));
        eyeSlope = vec2(dot(eye,normalize(modelMatrix[0].xyz)),dot(eye,normalize(modelMatrix[1].xyz)))/dist;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform sampler2D treeReflection; varying vec2 eyeSlope;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 reflectionUV = vMapUv - clamp(eyeSlope,vec2(-.65),vec2(.65))*vec2(.15,.073);
        float b = texture2D(treeReflection,reflectionUV).r;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.),b*.75);`);
  };

  const blank = () => {
    const c = document.createElement('canvas');
    c.width = LAYER.width;
    c.height = LAYER.height;
    return c;
  };

  function cutThumb() {
    const W = LAYER.width, H = LAYER.height;
    const work = blank(), g = work.getContext('2d', {willReadFrequently: true});
    g.drawImage(plate, LAYER.x, LAYER.y, W, H, 0, 0, W, H);
    const src = g.getImageData(0, 0, W, H).data;

    /* over the hand the thumb is skin on skin, so there its outline is drawn by hand, with a soft edge */
    const poly = blank(), pg = poly.getContext('2d', {willReadFrequently: true});
    pg.filter = 'blur(5px)';
    pg.beginPath();
    OVER_HAND.forEach(([x, y], i) => pg[i ? 'lineTo' : 'moveTo'](x - LAYER.x, y - LAYER.y));
    pg.closePath();
    pg.fill();
    const polyA = pg.getImageData(0, 0, W, H).data;

    const dx = TIP.x - BASE.x, dy = TIP.y - BASE.y, len = Math.hypot(dx, dy);
    const mask = new Uint8ClampedArray(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = src[i], b = src[i + 2], X = LAYER.x + x, Y = LAYER.y + y;
      let a;
      if (X < FRAME_X) {
        /* over the glass and the frame: skin is clearly redder than grey glass and brighter than dark steel */
        const red = Math.min(1, Math.max(0, (r - b - 18) / 14));
        if (X < DISPLAY.x + DISPLAY.width - 4) {
          /* over the glass: skin is redder than grey glass, and so is not the grey contact shadow around it */
          a = Math.min(1, Math.max(0, red * 1.15 - .15));
        } else {
          /* over the steel frame: skin is also brighter than the steel, and only the stretch the thumb crosses counts */
          a = red * Math.min(1, Math.max(0, (r - 112) / 30));
          if (Y < 644 + (X - 527) * .36) a = 0;
          /* well inside that stretch it is all thumb, even where the skin is in shadow */
          else if (Y > 650 + (X - 527) * .36 && Y < 766 + (X - 520) * .5) a = 1;
        }
        /* but not the palm showing below the phone */
        if (Y > (X < 520 ? 772 : 772 + (X - 520) * .5)) a = 0;
      } else a = polyA[i + 3] / 255;
      /* fade out behind the base knuckle, where the thumb becomes the hand */
      const along = ((X - BASE.x) * dx + (Y - BASE.y) * dy) / len;
      a *= Math.min(1, Math.max(0, (along + 46) / 70));
      mask[y * W + x] = Math.round(a * 255 * (src[i + 3] / 255));
    }
    const put = (canvasEl, rgba) => {
      const c = canvasEl.getContext('2d'), img = c.createImageData(W, H);
      for (let k = 0; k < W * H; k++) {
        const [r, gr, b, a] = rgba(k);
        img.data[k * 4] = r; img.data[k * 4 + 1] = gr; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = a;
      }
      c.putImageData(img, 0, 0);
    };
    /* the thumb on its own layer */
    put(thumbCanvas, k => [src[k * 4], src[k * 4 + 1], src[k * 4 + 2], mask[k]]);
    thumbTexture.needsUpdate = true;
    /* its outline, dark, for the shadow */
    shadow = blank();
    put(shadow, k => [38, 32, 28, mask[k]]);

    /* right of the frame the lifted thumb uncovers a sliver of its own photographed upper edge.
       Cover that sliver with the hand's skin from just above it. */
    const strip = blank(), tg = strip.getContext('2d', {willReadFrequently: true});
    tg.filter = 'blur(3px)';
    tg.beginPath();
    [[562, 642], [612, 664], [662, 690], [664, 714], [612, 696], [562, 680]].forEach(([x, y], i) => tg[i ? 'lineTo' : 'moveTo'](x - LAYER.x, y - LAYER.y));
    tg.closePath();
    tg.fill();
    const stripA = tg.getImageData(0, 0, W, H).data;
    handPatch = blank();
    put(handPatch, k => {
      const x = k % W, y = (k - x) / W;
      if (x < 562 - LAYER.x) return [0, 0, 0, 0];
      const sx = Math.min(W - 1, x + 10), sy = Math.max(0, y - 28), q = (sy * W + sx) * 4;
      return [src[q], src[q + 1], src[q + 2], stripA[k * 4 + 3]];
    });
  }

  // The original plate is flattened. Separate the fingers from the rails once
  // so the same photographed hand can grip the phone at its new height.
  function seatPhone() {
    context.drawImage(plate, 0, 0);
    const original = context.getImageData(0, 0, WIDTH, HEIGHT);
    const pixels = original.data;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    // The bottom of the image is already pure palm and wrist. Only the
    // narrow strip beside the rail needs a matte.
    context.drawImage(plate, 0, 819, WIDTH, HEIGHT - 819, 0, 819, WIDTH, HEIGHT - 819);
    context.drawImage(plate, 558, 448, WIDTH - 558, 371, 558, 448, WIDTH - 558, 371);
    const seam = context.createImageData(8, 371);
    for (let y = 0; y < seam.height; y++) {
      for (let x = 0; x < seam.width; x++) {
        const i = 4 * ((448 + y) * WIDTH + 550 + x);
        if (pixels[i] - pixels[i + 2] >= 24) seam.data.set(pixels.subarray(i, i + 4), 4 * (y * seam.width + x));
      }
    }
    context.putImageData(seam, 550, 448);
    context.drawImage(handPatch, LAYER.x, LAYER.y);

    // Preserve each fingertip's interior, including the pale nail. Only test
    // the warm outer silhouette against the neutral metal and glass.
    const fx = 48, fy = 289, fw = 129, fh = 421;
    fingers = document.createElement('canvas');
    fingers.width = fw; fingers.height = fh;
    const fg = fingers.getContext('2d'), cut = fg.createImageData(fw, fh);
    for (let y = 0; y < fh; y++) {
      let edge = -1;
      for (let x = 0; x < fw; x++) {
        const i = 4 * ((fy + y) * WIDTH + fx + x);
        if (pixels[i + 3] > 25 && pixels[i] > 58 && pixels[i] - pixels[i + 2] > 31 && pixels[i] - pixels[i + 1] > 13) edge = x;
      }
      if (edge < 0) continue;
      const start = 4 * ((fy + y) * WIDTH + fx);
      cut.data.set(pixels.subarray(start, start + 4 * (edge + 1)), y * fw * 4);
    }
    fg.putImageData(cut, 0, 0);
    context.drawImage(fingers, fx, fy);

    // The unoccluded crown, steel rails and side controls all come from this
    // handset. Its crown also supplies the curved steel under the keyboard.
    context.save(); context.translate(0, SLIDE);
    context.drawImage(plate, 125, 17, 438, 271, 125, 17, 438, 271);
    context.drawImage(plate, 132, 119, 423, 57, 132, 288, 423, 457);
    context.drawImage(plate, 551, 288, 13, 99, 551, 288, 13, 99);
    context.save(); context.translate(0, 840); context.scale(1, -1);
    context.drawImage(plate, 125, 17, 438, 79, 125, 17, 438, 79);
    context.restore(); context.restore();

    // Three curled fingertips overlap the front rail. The uppermost finger
    // stays behind it. The moving thumb is the independent articulated mesh.
    const foreground = document.createElement('canvas');
    foreground.width = fw; foreground.height = fh-106;
    foreground.getContext('2d').drawImage(fingers,0,-106);
    const fingerMap = new THREE.CanvasTexture(foreground);
    fingerMap.colorSpace = THREE.SRGBColorSpace; fingerMap.anisotropy=8;
    const fingerGeo = new THREE.PlaneGeometry(fw*METRES_PER_PIXEL,(fh-106)*METRES_PER_PIXEL,28,64);
    const fingerVertices = fingerGeo.attributes.position;
    for (let i=0; i<fingerVertices.count; i++) {
      const x = fx + fw/2 + fingerVertices.getX(i)/METRES_PER_PIXEL;
      const y = fy + (106+fh)/2 - fingerVertices.getY(i)/METRES_PER_PIXEL;
      let dome = 0;
      for (const [cx,cy,rx,ry] of [[116,447,56,45],[111,539,57,44],[115,632,49,45]]) {
        dome = Math.max(dome,1-((x-cx)/rx)**2-((y-cy)/ry)**2);
      }
      fingerVertices.setZ(i,.00024+.0032*dome);
    }
    fingerGeo.computeVertexNormals();
    const tips = new THREE.Mesh(fingerGeo,new THREE.MeshBasicMaterial({map:fingerMap,transparent:true,
      alphaTest:.04,depthWrite:false,toneMapped:false}));
    tips.name='Curled fingertips';tips.renderOrder=2;
    tips.position.set((fx+fw/2-WIDTH/2)*METRES_PER_PIXEL,(HEIGHT/2-fy-(106+fh)/2)*METRES_PER_PIXEL,0);
    mesh.add(tips);
    texture.needsUpdate = true;

    // Keep the photographed tree reflection and lens. Extend the clean glass
    // into the area formerly hidden by the thumb, lifting daylight midtones
    // for light mode while retaining the blacks of the lens and bezel.
    glass = document.createElement('canvas');
    glass.width = DISPLAY.width; glass.height = DISPLAY.height;
    const gg = glass.getContext('2d'), surface = gg.createImageData(glass.width, glass.height);
    const tree = document.createElement('canvas');
    tree.width = glass.width; tree.height = glass.height;
    const layer = tree.getContext('2d'), sky = layer.createImageData(tree.width, tree.height);
    for (let y = 0; y < glass.height; y++) {
      const row = DISPLAY.y + y;
      const sourceY = Math.round(row <= 385 ? row : 385 + (row - 385) * .37);
      for (let x = 0; x < glass.width; x++) {
        const sourceX = sourceY > 387 ? Math.max(178, DISPLAY.x + x) : DISPLAY.x + x;
        const i = 4 * (sourceY * WIDTH + sourceX), o = 4 * (y * glass.width + x);
        const lift = .47 * Math.max(0, Math.min(1, (pixels[i + 1] - 48) / 154));
        // Lift the reflected branches off the static plate. Their luminance
        // is reapplied in the glass shader at the reflected viewing angle.
        const neighbor = 4*(sourceY*WIDTH+DISPLAY.x+250);
        const region = THREE.MathUtils.smoothstep(y,61,109)*(1-THREE.MathUtils.smoothstep(y,290,360))
          * THREE.MathUtils.smoothstep(x,0,11)*(1-THREE.MathUtils.smoothstep(x,116,173));
        const skyLift = region*Math.max(0,pixels[i+1]-pixels[neighbor+1]);
        const neutral = Math.min(252,pixels[neighbor+1]+(255-pixels[neighbor+1])*lift);
        const reflectance = Math.min(1,skyLift*(1-lift)/Math.max(8,255-neutral));
        sky.data[o]=sky.data[o+1]=sky.data[o+2]=255*reflectance; sky.data[o+3]=255;
        for (let c = 0; c < 3; c++) surface.data[o + c] = pixels[i + c] + (255 - pixels[i + c]) * lift - skyLift*(1-lift);
        surface.data[o + 3] = 255;
      }
    }
    gg.putImageData(surface, 0, 0);
    layer.putImageData(sky,0,0);reflection.value=new THREE.CanvasTexture(tree);
    reflection.value.anisotropy=4;
  }

  function redraw(press) {
    if (!mesh.visible) return;
    const lift = 1 - press;
    bend.uLift.value = lift;
    const g = screenContext;
    g.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
    g.save();
    g.scale(screenCanvas.width / DISPLAY.width, screenCanvas.height / DISPLAY.height);
    g.beginPath(); g.roundRect(0, 0, DISPLAY.width, DISPLAY.height, 52); g.clip();
    g.drawImage(glass, 0, 0);
    drawPhone(g, DISPLAY.width, DISPLAY.height, true, press);
    g.translate(-DISPLAY.x, -SCREEN_TOP);

    // The photograph fixes the contact position. Swing the cast shadow with
    // the raised thumb and tighten it as the pad meets the screen.
    const angle = Math.atan2(TIP.y - BASE.y, TIP.x - BASE.x);
    g.globalAlpha = .22 - .1 * lift;
    g.filter = `blur(${4 + 7 * lift}px)`;
    g.translate(BASE.x - 5 * lift, BASE.y + 2 + 7 * lift);
    g.rotate(-SWING * lift); g.rotate(angle);
    g.scale(1 - .1 * lift, 1); g.rotate(-angle);
    g.translate(-BASE.x, -BASE.y);
    g.drawImage(shadow, LAYER.x, LAYER.y);
    g.restore();
    screenTexture.needsUpdate = true;
  }

  plate.onload = () => {
    cutThumb();
    seatPhone();
    mesh.visible = true;
    onReady();
  };
  plate.onerror = onError;
  plate.src = new URL('../assets/phone-grip.png', import.meta.url).href;
  return {get ready() { return mesh.visible; }, redraw, mesh, screen, thumbMesh};
}
