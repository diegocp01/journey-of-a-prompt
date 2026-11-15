import * as THREE from 'three';

// Pixel coordinates in the ImageGen plate. The world anchor is the center
// of the display, shared with the original phone's raycast target.
const WIDTH = 1086;
const HEIGHT = 1448;
const DISPLAY = {x: 157, y: 46, width: 374, height: 748};
const METRES_PER_PIXEL = .148 / DISPLAY.height;

export function createPhotoGrip(parent, drawPhone, {onReady, onError}) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const gesture = {value: 0};
  const material = new THREE.MeshBasicMaterial({
    map: texture, alphaTest: .24, transparent: true, toneMapped: false
  });
  // The thumb compresses a few pixels into the glass during a press. The
  // deformation fades out well before the bezel, the palm, and the fingers.
  material.onBeforeCompile = shader => {
    shader.uniforms.thumbPress = gesture;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float thumbPress;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 thumb = (uv - vec2(.407, .535)) / vec2(.068, .051);
        float compression = thumbPress * exp(-dot(thumb, thumb) * 2.);
        transformed += vec3(-.00055, -.00033, -.00065) * compression;`);
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(
    WIDTH * METRES_PER_PIXEL, HEIGHT * METRES_PER_PIXEL, 48, 64
  ), material);
  mesh.name = 'ImageGen phone and hand';
  mesh.position.set(
    (WIDTH / 2 - DISPLAY.x - DISPLAY.width / 2) * METRES_PER_PIXEL,
    (DISPLAY.y + DISPLAY.height / 2 - HEIGHT / 2) * METRES_PER_PIXEL,
    .00485
  );
  mesh.visible = false;
  parent.add(mesh);

  // Clip dynamic display pixels behind the photographed thumb. Everything
  // else in the screen, including the reflection and shadows, comes from the plate.
  const displayClip = new Path2D();
  displayClip.roundRect(DISPLAY.x, DISPLAY.y, DISPLAY.width, DISPLAY.height, 52);
  displayClip.moveTo(531, 659);
  displayClip.bezierCurveTo(496, 645, 467, 625, 443, 627);
  displayClip.bezierCurveTo(423, 627, 407, 644, 407, 666);
  displayClip.bezierCurveTo(405, 694, 433, 721, 463, 736);
  displayClip.bezierCurveTo(486, 750, 510, 759, 531, 768);
  displayClip.closePath();

  const plate = new Image();
  function redraw(press) {
    if (!mesh.visible) return;
    gesture.value = press;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(plate, 0, 0);
    context.save();
    context.clip(displayClip, 'evenodd');
    context.translate(DISPLAY.x, DISPLAY.y);
    context.scale(DISPLAY.width / 540, DISPLAY.height / 1166);
    drawPhone(context, 540, 1166, true, press);
    context.restore();
    texture.needsUpdate = true;
  }

  plate.onload = () => {
    mesh.visible = true;
    onReady();
  };
  plate.onerror = onError;
  plate.src = new URL('../assets/phone-grip.png', import.meta.url).href;
  return {get ready() { return mesh.visible; }, redraw, mesh};
}
