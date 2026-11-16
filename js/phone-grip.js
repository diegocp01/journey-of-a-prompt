import * as THREE from 'three';

// Pixel coordinates in the ImageGen plate. The world anchor is the center
// of the display, shared with the original phone's raycast target.
const WIDTH = 1086;
const HEIGHT = 1448;
const DISPLAY = {x: 157, y: 46, width: 374, height: 748};
const METRES_PER_PIXEL = .148 / DISPLAY.height;

// The thumb that taps Send. In the photo it already rests on the button, so it is cut out
// of the plate and moved on its own layer: lifted off the glass at rest, down onto Send for a press.
// Pixel area that holds the part of the thumb that moves; it ends where the thumb meets the hand.
const THUMB = {x: 360, y: 590, width: 205, height: 215};
const ROOT = {x: 560, y: 712};   // where the thumb bends from: nothing here moves
const TIP = {x: 408, y: 668};    // the pad that lands on Send
const CUT = 562;                 // pixels right of this belong to the hand and stay still
const LIFT_ANGLE = .5;           // how far the thumb swings up off the button when lifted, radians
const LIFT_SCALE = .07;          // and how much nearer the camera it looks

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

  /* the thumb layer: a finely divided patch over the thumb that bends from its root,
     so the tip swings while the part joined to the hand stays put */
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = THUMB.width;
  thumbCanvas.height = THUMB.height;
  const thumbTexture = new THREE.CanvasTexture(thumbCanvas);
  thumbTexture.colorSpace = THREE.SRGBColorSpace;
  thumbTexture.anisotropy = 8;
  const px = (x, y) => new THREE.Vector2((x - THUMB.x - THUMB.width / 2) * METRES_PER_PIXEL,
    (THUMB.y + THUMB.height / 2 - y) * METRES_PER_PIXEL);
  const bend = {uLift: {value: 0}, uRoot: {value: px(ROOT.x, ROOT.y)}, uTip: {value: px(TIP.x, TIP.y)}};
  const thumbMaterial = new THREE.MeshBasicMaterial({
    map: thumbTexture, transparent: true, depthWrite: false, toneMapped: false
  });
  thumbMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, bend);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uLift; uniform vec2 uRoot; uniform vec2 uTip;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 axis = uTip - uRoot;
        float t = clamp(dot(transformed.xy - uRoot, axis) / dot(axis, axis), 0., 1.);
        float w = t * t * (3. - 2. * t);
        float a = -${LIFT_ANGLE.toFixed(3)} * uLift * w;
        vec2 d = (transformed.xy - uRoot) * (1. + ${LIFT_SCALE.toFixed(3)} * uLift * w);
        transformed.xy = uRoot + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
        transformed.z += .004 * uLift * w;`);
  };
  const thumbMesh = new THREE.Mesh(new THREE.PlaneGeometry(
    THUMB.width * METRES_PER_PIXEL, THUMB.height * METRES_PER_PIXEL, 48, 48
  ), thumbMaterial);
  thumbMesh.name = 'Thumb';
  const c = px(THUMB.x + THUMB.width / 2, THUMB.y + THUMB.height / 2);
  thumbMesh.position.set(
    (THUMB.x + THUMB.width / 2 - WIDTH / 2) * METRES_PER_PIXEL,
    (HEIGHT / 2 - THUMB.y - THUMB.height / 2) * METRES_PER_PIXEL,
    .0004
  );
  thumbMesh.renderOrder = 2;
  mesh.add(thumbMesh);
  void c;

  const displayClip = new Path2D();
  displayClip.roundRect(DISPLAY.x, DISPLAY.y, DISPLAY.width, DISPLAY.height, 52);

  const plate = new Image();
  let thumbMask = null;   // the thumb's outline at its place in the photo
  let screenPatch = null; // plain screen colour to paint where the photographed thumb was

  /* find the thumb by its skin colour: skin is clearly redder than the grey glass and the steel frame */
  function cutThumb() {
    const work = document.createElement('canvas');
    work.width = THUMB.width;
    work.height = THUMB.height;
    const g = work.getContext('2d');
    g.drawImage(plate, THUMB.x, THUMB.y, THUMB.width, THUMB.height, 0, 0, THUMB.width, THUMB.height);
    const img = g.getImageData(0, 0, THUMB.width, THUMB.height), d = img.data;
    let sr = 0, sg = 0, sb = 0, n = 0;
    const mask = g.createImageData(THUMB.width, THUMB.height);
    for (let y = 0; y < THUMB.height; y++) for (let x = 0; x < THUMB.width; x++) {
      const i = (y * THUMB.width + x) * 4, r = d[i], gr = d[i + 1], b = d[i + 2];
      let a = Math.min(1, Math.max(0, (r - b - 16) / 18)) * (d[i + 3] / 255);
      const X = THUMB.x + x;
      a *= Math.min(1, Math.max(0, (CUT - X) / 14));
      mask.data[i + 3] = Math.round(a * 255);
      if (a === 0 && X < DISPLAY.x + DISPLAY.width - 12 && THUMB.y + y < DISPLAY.y + DISPLAY.height - 30) {
        sr += r; sg += gr; sb += b; n++;
      }
    }
    thumbMask = document.createElement('canvas');
    thumbMask.width = THUMB.width;
    thumbMask.height = THUMB.height;
    thumbMask.getContext('2d').putImageData(mask, 0, 0);

    /* the thumb on its own: photo pixels kept only where the mask is */
    const tg = thumbCanvas.getContext('2d');
    tg.clearRect(0, 0, THUMB.width, THUMB.height);
    tg.drawImage(work, 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    tg.drawImage(thumbMask, 0, 0);
    tg.globalCompositeOperation = 'source-over';
    thumbTexture.needsUpdate = true;

    /* a patch of plain glass, a little wider than the thumb, to cover the photographed thumb and its shadow */
    screenPatch = document.createElement('canvas');
    screenPatch.width = THUMB.width;
    screenPatch.height = THUMB.height;
    const pg = screenPatch.getContext('2d');
    pg.filter = 'blur(5px)';
    for (const [ox, oy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, 5], [5, -5], [-5, -5]]) pg.drawImage(thumbMask, ox, oy);
    pg.filter = 'none';
    pg.globalCompositeOperation = 'source-in';
    pg.fillStyle = `rgb(${Math.round(sr / n)},${Math.round(sg / n)},${Math.round(sb / n)})`;
    pg.fillRect(0, 0, THUMB.width, THUMB.height);
  }

  function redraw(press) {
    if (!mesh.visible) return;
    const lift = 1 - press;
    bend.uLift.value = lift;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(plate, 0, 0);
    context.save();
    context.clip(displayClip);
    /* glass where the photographed thumb was */
    context.drawImage(screenPatch, THUMB.x, THUMB.y);
    /* the screen: chat, prompt and the Send button */
    context.save();
    context.translate(DISPLAY.x, DISPLAY.y);
    context.scale(DISPLAY.width / 540, DISPLAY.height / 1166);
    drawPhone(context, 540, 1166, true, press);
    context.restore();
    /* the thumb's soft shadow on the glass: tight under the pad when pressing, wider and fainter when lifted */
    context.save();
    context.globalAlpha = .34 - .16 * lift;
    context.filter = `blur(${3 + 9 * lift}px)`;
    context.translate(ROOT.x, ROOT.y);
    context.rotate(LIFT_ANGLE * .75 * lift);
    context.translate(-ROOT.x - 4 - 8 * lift, -ROOT.y + 4 + 22 * lift);
    context.drawImage(shadowOf(), THUMB.x, THUMB.y);
    context.restore();
    context.restore();
    /* outside the glass the photographed thumb stays as it is, under the moving layer */
    texture.needsUpdate = true;
  }

  let shadowCanvas = null;
  function shadowOf() {
    if (shadowCanvas) return shadowCanvas;
    shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = THUMB.width;
    shadowCanvas.height = THUMB.height;
    const s = shadowCanvas.getContext('2d');
    s.drawImage(thumbMask, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#2a2420';
    s.fillRect(0, 0, THUMB.width, THUMB.height);
    return shadowCanvas;
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
