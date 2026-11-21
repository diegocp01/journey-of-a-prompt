import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

// A periodic directional wave spectrum. Integer wave counts make opposite
// edges agree in both height and slope when the wind field is tiled.
function windRipples() {
  const size = 128,
    data = new Uint8Array(size * size * 4);
  const waves = [
    [3, 1, 0.13, 0.1],
    [5, 3, 0.12, 0.5],
    [8, 1, 0.09, 0.31],
    [12, 5, 0.08, 0.79],
    [17, -3, 0.064, 0.13],
    [24, 7, 0.046, 0.36],
    [7, 18, 0.038, 0.94],
    [32, 11, 0.033, 0.67],
    [39, -9, 0.027, 0.21],
    [51, 7, 0.018, 0.84],
    [-4, 13, 0.035, 0.28],
  ].map(([kx, kz, amplitude, phase]) => {
    const length = Math.hypot(kx, kz);
    return [kx, kz, (amplitude * kx) / length, (amplitude * kz) / length, phase];
  });
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      let sx = 0,
        sz = 0;
      for (const [kx, kz, dx, dz, phase] of waves) {
        const slope = Math.cos(2 * Math.PI * ((kx * x + kz * z) / size + phase));
        sx += slope * dx;
        sz += slope * dz;
      }
      const len = Math.hypot(1, sx, sz),
        i = (z * size + x) * 4;
      data.set([(1 + sx / len) * 127.5, (1 + sz / len) * 127.5, (1 + 1 / len) * 127.5, 255], i);
    }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function coastalWater(scene, sunDirection) {
  const normal = windRipples();
  const geometry = new THREE.PlaneGeometry(120, 700);
  const surface = new Water(geometry, {
    textureWidth: 384,
    textureHeight: 384,
    waterNormals: normal,
    sunDirection: sunDirection.clone(),
    sunColor: 0x708897,
    waterColor: 0x115467,
    distortionScale: 1.18,
    fog: true,
  });
  surface.name = 'Wind-rippled coastal surface';
  surface.material.uniforms.size.value = 7.0;
  surface.material.transparent = true;
  surface.material.fragmentShader = surface.material.fragmentShader.replace(
    'gl_FragColor = vec4( outgoingLight, alpha );',
    `
    float shoal=smoothstep(.1,5.5,min(worldPosition.x-130.,250.-worldPosition.x));
    float grazing=pow(1.-theta,3.);
    float opacity=mix(.33,.98,shoal)+.60*grazing*(1.-shoal);
    gl_FragColor=vec4(outgoingLight,opacity);
  `,
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(190, -0.15, 0);
  scene.add(surface);
  // Looking upward, the wind field breaks the light entering the water.
  const underside = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x3d969c,
      roughness: 0.55,
      metalness: 0.03,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.73, 0.73),
      emissive: 0x235165,
      emissiveIntensity: 0.4,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 0.18,
    }),
  );
  underside.name = 'Rippled underside of the sea';
  underside.rotation.copy(surface.rotation);
  underside.position.copy(surface.position);
  scene.add(underside);
  const underNormal = normal.clone();
  underNormal.repeat.set(19, 112);
  underside.material.normalMap = underNormal;
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
  // A sphere around this 700m-wide bay intersects views looking entirely up
  // the mast. Clip the water rectangle before launching its mirrored render.
  const clipA = Array.from({ length: 12 }, () => new THREE.Vector3());
  const clipB = clipA.map(() => new THREE.Vector3());
  function waterInView(camera) {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let input = clipA, output = clipB, count = 4;
    input[0].set(130, -0.15, -350); input[1].set(250, -0.15, -350);
    input[2].set(250, -0.15, 350); input[3].set(130, -0.15, 350);
    for (const plane of frustum.planes) {
      let n = 0, prev = input[count - 1], dPrev = plane.distanceToPoint(prev);
      for (let i = 0; i < count; i++) {
        const point = input[i], d = plane.distanceToPoint(point);
        if (d * dPrev < 0) output[n++].lerpVectors(prev, point, dPrev / (dPrev - d));
        if (d >= 0) output[n++].copy(point);
        prev = point; dPrev = d;
      }
      if (!n) return false;
      const swap = input; input = output; output = swap; count = n;
    }
    return true;
  }
  return (t, camera) => {
    // The distant exterior can see the bay from the mast. Inside the home and
    // data center the horizon is occluded, so skip its planar reflection pass.
    const coastalView = camera.position.x > 3 && camera.position.x < 302 && waterInView(camera);
    surface.visible = coastalView && camera.position.y > -0.15;
    underside.visible = coastalView && !surface.visible;
    surface.material.uniforms.time.value = t * 0.34;
    underNormal.offset.set(t * 0.012, t * 0.006);
  };
}
