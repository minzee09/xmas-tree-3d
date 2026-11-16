// A wrapped present with a separate lid, so the lid can pop off.
import { glowSprite } from './stage.js';

const THREE = window.THREE;

/**
 * @param {{w:number,h:number,d:number,color:number,ribbon:number,ribbonWidth?:number,bowSize?:number}} o
 * Origin is the bottom center. Returns the parts the animations need.
 */
export function makeGift({ w, h, d, color, ribbon, ribbonWidth = 0.1, bowSize = 0.09 }) {
  const bodyH = h * 0.82, lidH = h * 0.2;
  const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.5 });
  const ribbonMat = new THREE.MeshStandardMaterial({ color: ribbon, emissive: ribbon, emissiveIntensity: 0.15, metalness: 0.4, roughness: 0.35 });
  const box = (x, y, z, m) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);

  const body = new THREE.Group();
  const bodyBox = box(w, bodyH, d, bodyMat);
  const r1 = box(w + 0.02, bodyH + 0.01, ribbonWidth, ribbonMat);
  const r2 = box(ribbonWidth, bodyH + 0.01, d + 0.02, ribbonMat);
  body.add(bodyBox, r1, r2);
  body.position.y = bodyH / 2;

  const lid = new THREE.Group();
  const lidBox = box(w + 0.06, lidH, d + 0.06, bodyMat);
  const lr1 = box(w + 0.08, lidH + 0.01, ribbonWidth, ribbonMat);
  const lr2 = box(ribbonWidth, lidH + 0.01, d + 0.08, ribbonMat);
  const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(bowSize, bowSize / 3, 48, 6, 2, 3), ribbonMat);
  bow.position.y = lidH / 2 + bowSize * 0.7;
  lid.add(lidBox, lr1, lr2, bow);
  const lidRestY = bodyH + lidH / 2 - 0.02;
  lid.position.y = lidRestY;

  const glow = glowSprite(0xffe2a0, 0);
  const g = Math.max(w, d) * 2.6;
  glow.scale.set(g, g, 1);
  glow.position.y = bodyH;

  const group = new THREE.Group();
  group.add(body, lid, glow);

  return {
    group, body, lid, glow, bodyMat, ribbonMat, bodyH, lidRestY,
    meshes: [bodyBox, r1, r2, lidBox, lr1, lr2, bow],
    dispose() {
      this.meshes.forEach((m) => m.geometry.dispose());
      bodyMat.dispose(); ribbonMat.dispose(); glow.material.dispose();
    },
  };
}
