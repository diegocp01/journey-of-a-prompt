// The surface and cloud deck share geographic UVs. Route markers sit above both.
import * as THREE from 'three';

export function addEarth(globe, radius) {
  const loader = new THREE.TextureLoader();
  function atlas(name, color = false) {
    const map = loader.load(new URL('../assets/earth/' + name + '.webp', import.meta.url).href);
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return { value: map };
  }
  const uniforms = {
    surface: atlas('surface', true),
    night: atlas('night', true),
    relief: atlas('relief-clouds'),
    sunward: { value: new THREE.Vector3(-0.65, 0.48, 0.58).normalize() },
  };
  const vertexShader = `
    varying vec2 geoUV;
    varying vec3 radial, towardEye;
    void main() {
      geoUV = uv;
      radial = normal;
      vec4 world = modelMatrix * vec4(position, 1.);
      towardEye = cameraPosition - world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const header = `
    varying vec2 geoUV;
    varying vec3 radial, towardEye;
    uniform sampler2D surface, night, relief;
    uniform vec3 sunward;`;
  function shell(name, scale, fragment, options = {}) {
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader: header + fragment,
      ...options,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 96, 64), mat);
    mesh.name = name;
    globe.add(mesh);
  }
  shell(
    'Continents, ocean and city lights',
    1,
    `
    void main() {
      vec3 n = normalize(radial), v = normalize(towardEye);
      vec3 terrain = texture2D(relief, geoUV).rgb;
      vec2 texel = vec2(1./2048., 1./1024.);
      vec2 slope = vec2(texture2D(relief, geoUV + vec2(texel.x,0.)).r,
                        texture2D(relief, geoUV + vec2(0.,texel.y)).r) - terrain.rr;
      vec3 east = normalize(vec3(n.z, 0., -n.x) + vec3(.00001,0.,0.));
      vec3 landNormal = normalize(n - east * slope.x * .8 - cross(east,n) * slope.y * .8);
      float light = dot(landNormal, sunward);
      float day = smoothstep(-.14, .18, light);
      vec3 albedo = texture2D(surface, geoUV).rgb;
      float cover = texture2D(relief, geoUV + .0018 * vec2(dot(sunward,east), dot(sunward,cross(east,n)))).b;
      vec3 lit = albedo * (.19 + 1.08 * max(light, 0.)) * (1. - .30 * smoothstep(.18,.9,cover));
      float glint = pow(max(0.,dot(n,normalize(sunward+v))), 70.) * (1.-terrain.g);
      vec3 cities = texture2D(night, geoUV).rgb * 1.95;
      vec3 color = mix(albedo*.065 + cities, lit + vec3(.47,.57,.68)*glint, day);
      float rim = pow(1.-max(0.,dot(v,n)), 3.4);
      color += vec3(.038,.19,.48)*rim*(.15+.85*day);
      gl_FragColor=vec4(color,1.);
    }`,
  );
  shell(
    'Cloud deck',
    1.004,
    `
    void main() {
      float density = smoothstep(.12,.91,texture2D(relief,geoUV).b);
      float daylight = smoothstep(-.18,.58,dot(normalize(radial),sunward));
      gl_FragColor=vec4(mix(vec3(.035,.052,.092),vec3(.82,.88,.97),daylight),density*.88);
    }`,
    { transparent: true, depthWrite: false },
  );
  shell(
    'Atmospheric limb',
    1.023,
    `
    void main() {
      vec3 n=normalize(radial), v=normalize(towardEye);
      float rim=pow(1.-abs(dot(n,v)),9.);
      float light=smoothstep(-.42,.5,dot(n,sunward));
      gl_FragColor=vec4(mix(vec3(.22,.082,.055),vec3(.12,.45,1.),light),rim*(.15+.8*light));
    }`,
    { transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending },
  );
}
