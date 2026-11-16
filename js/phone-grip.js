import * as THREE from 'three';

// Pixel coordinates in the ImageGen plate. The world anchor is the center
// of the display, shared with the original phone's raycast target.
const WIDTH = 1086;
const HEIGHT = 1448;
const DISPLAY = {x: 157, y: 46, width: 374, height: 748};
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
const SWING = .1;                   // small sideways swing from the base knuckle, radians
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
    WIDTH * METRES_PER_PIXEL, HEIGHT * METRES_PER_PIXEL
  ), material);
  mesh.name = 'ImageGen phone and hand';
  mesh.position.set(
    (WIDTH / 2 - DISPLAY.x - DISPLAY.width / 2) * METRES_PER_PIXEL,
    (DISPLAY.y + DISPLAY.height / 2 - HEIGHT / 2) * METRES_PER_PIXEL,
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

  const displayClip = new Path2D();
  displayClip.roundRect(DISPLAY.x, DISPLAY.y, DISPLAY.width, DISPLAY.height, 52);

  const plate = new Image();
  let underPatch = null;   // what is under the thumb once it moves: plain glass and the phone's frame
  let shadow = null;       // the thumb's outline, for its shadow on the glass
  let handPatch = null;    // skin of the hand behind the thumb's upper edge, shown once the thumb lifts away from it

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
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = src[i], gr = src[i + 1], b = src[i + 2], X = LAYER.x + x, Y = LAYER.y + y;
      let a;
      if (X < FRAME_X) {
        /* over the glass and the frame: skin is clearly redder than grey glass and brighter than dark steel */
        const red = Math.min(1, Math.max(0, (r - b - 18) / 14));
        if (X < DISPLAY.x + DISPLAY.width - 4) {
          /* over the glass: skin is redder than grey glass, and so is not the grey contact shadow around it */
          a = Math.min(1, Math.max(0, red * 1.3 - .3));
        } else {
          /* over the steel frame: skin is also brighter than the steel, and only the stretch the thumb crosses counts */
          a = red * Math.min(1, Math.max(0, (r - 112) / 30));
          if (Y < 644 + (X - 527) * .36) a = 0;
        }
        /* but not the palm showing below the phone */
        if (Y > (X < 520 ? 772 : 772 + (X - 520) * .5)) a = 0;
        if (a === 0 && X < DISPLAY.x + DISPLAY.width - 12 && Y < DISPLAY.y + DISPLAY.height - 30) { sr += r; sg += gr; sb += b; n++; }
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

    /* what shows where the photographed thumb used to be:
       plain glass over the screen, and the phone's own frame continued down from just above the thumb */
    const glass = [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
    const wide = blank(), wg = wide.getContext('2d', {willReadFrequently: true});
    wg.filter = 'blur(4px)';
    for (const [ox, oy] of [[0, 0], [7, 0], [-7, 0], [0, 7], [0, -7], [5, 5], [-5, 5], [5, -5], [-5, -5]]) wg.drawImage(shadow, ox, oy);
    const wideA = wg.getImageData(0, 0, W, H).data;
    const frameLeft = DISPLAY.x + DISPLAY.width - 4 - LAYER.x, frameRight = FRAME_X - 5 - LAYER.x;
    const cleanTop = 598 - LAYER.y, cleanRows = 34, frameTo = 752 - LAYER.y;
    underPatch = blank();
    put(underPatch, k => {
      const x = k % W, y = (k - x) / W, a = Math.min(255, wideA[k * 4 + 3] * 1.6);
      if (x < frameLeft) return [...glass, a];
      if (x < frameRight && y < frameTo) {
        const s = ((cleanTop + ((y - cleanTop) % cleanRows + cleanRows) % cleanRows) * W + x) * 4;
        return [src[s], src[s + 1], src[s + 2], a];
      }
      return [0, 0, 0, 0];
    });

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

  function redraw(press) {
    if (!mesh.visible) return;
    const lift = 1 - press;
    bend.uLift.value = lift;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(plate, 0, 0);
    /* cover the photographed thumb with what is under it */
    context.drawImage(underPatch, LAYER.x, LAYER.y);
    context.globalAlpha = Math.min(1, lift * 3);
    context.drawImage(handPatch, LAYER.x, LAYER.y);
    context.globalAlpha = 1;
    context.save();
    context.clip(displayClip);
    /* the screen: chat, prompt and the Send button */
    context.save();
    context.translate(DISPLAY.x, DISPLAY.y);
    context.scale(DISPLAY.width / 540, DISPLAY.height / 1166);
    drawPhone(context, 540, 1166, true, press);
    context.restore();
    /* the thumb's shadow on the glass: tight under the pad when pressing, softer and off to one side when lifted */
    const angle = Math.atan2(TIP.y - BASE.y, TIP.x - BASE.x);
    context.globalAlpha = .26 - .16 * lift;
    context.filter = `blur(${3 + 9 * lift}px)`;
    context.translate(BASE.x - 5 * lift, BASE.y + 2 + 7 * lift);
    context.rotate(-SWING * lift);
    context.rotate(angle);
    context.scale(1 - .1 * lift, 1);
    context.rotate(-angle);
    context.translate(-BASE.x, -BASE.y);
    context.drawImage(shadow, LAYER.x, LAYER.y);
    context.restore();
    texture.needsUpdate = true;
  }

  plate.onload = () => {
    cutThumb();
    mesh.visible = true;
    onReady();
  };
  plate.onerror = onError;
  plate.src = new URL('../assets/phone-grip.png', import.meta.url).href;
  return {get ready() { return mesh.visible; }, redraw, mesh, thumbMesh};
}
