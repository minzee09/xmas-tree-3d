// Falling snow. Positions are animated entirely in the vertex shader.
import { isSmall, reduceMotion } from './config.js';
import { scene, uniforms } from './stage.js';

const THREE = window.THREE;
const N = isSmall ? 1200 : 2200;

const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
for (let i = 0; i < N; i++) {
  pos.set([(Math.random() - 0.5) * 40, Math.random() * 20, (Math.random() - 0.5) * 40], i * 3);
  size[i] = 1 + Math.random() * 2.5;
  phase[i] = Math.random() * 6.28;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
geometry.setAttribute('aPh', new THREE.BufferAttribute(phase, 1));

const material = new THREE.ShaderMaterial({
  uniforms: { uTime: uniforms.uTime, uPixelRatio: uniforms.uPixelRatio, uFall: { value: reduceMotion ? 0.25 : 1 } },
  vertexShader: `
    attribute float aSize; attribute float aPh;
    uniform float uTime; uniform float uPixelRatio; uniform float uFall;
    varying float vA;
    void main(){
      vec3 p = position;
      p.y = mod(p.y - uTime * (0.6 + aSize * 0.25) * uFall, 20.0) - 1.0;
      p.x += sin(uTime * 0.6 + aPh) * 0.6;
      p.z += cos(uTime * 0.5 + aPh * 1.3) * 0.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (34.0 / -mv.z);
      vA = 0.75 * smoothstep(-1.0, 0.5, p.y);
    }`,
  fragmentShader: `
    varying float vA;
    void main(){
      float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
      gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * vA);
    }`,
  transparent: true, depthWrite: false,
});

const snow = new THREE.Points(geometry, material);
snow.frustumCulled = false;
scene.add(snow);
