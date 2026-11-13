import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Decorative local animation. No audio, APIs, controls or user data. */
export async function createDancingMascot(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(220, 320, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.55, .55, .8, -.8, .01, 20);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b929e, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 2); scene.add(key);
  let disposed = false;
  const assets = new Set<THREE.Texture>();
  let model: THREE.Group | undefined;
  const dispose = () => {
    disposed = true;
    model?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) assets.add(value);
        material.dispose();
      }
    });
    assets.forEach(texture => texture.dispose());
    renderer.dispose(); renderer.forceContextLoss();
  };
  try {
    const gltf = await new GLTFLoader().loadAsync("/mascot/dom-guima.glb?v=2");
    model = gltf.scene; scene.add(model);
    const clips = gltf.animations
      .filter(clip => /^dance_/.test(clip.name) && clip.name !== "dance_03")
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!clips.length) throw new Error("No dance clips");
    const mixer = new THREE.AnimationMixer(model);
    // Fit the whole body and raised hands across every dance, using the real skinned mesh.
    const bounds = new THREE.Box3();
    for (const clip of clips) {
      const sample = mixer.clipAction(clip).play();
      for (const portion of [0, .2, .4, .6, .8]) {
        mixer.setTime(clip.duration * portion); model.updateMatrixWorld(true);
        model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox(); });
        bounds.union(new THREE.Box3().setFromObject(model));
      }
      sample.stop();
    }
    mixer.stopAllAction(); mixer.setTime(0);
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const halfHeight = Math.max(size.y, size.z * 320 / 220) * .55;
    camera.left = -halfHeight * 220 / 320; camera.right = -camera.left;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.set(center.x - 3, center.y, center.z); camera.lookAt(center); camera.updateProjectionMatrix();
    let index = 0, elapsed = 0;
    let action = mixer.clipAction(clips[index]).reset().play();
    // Release finished cross-fades so only the current and incoming dance remain active.
    let retiring: THREE.AnimationAction | null = null, fadeRemaining = 0;
    return {
      draw(delta: number, reduced = false) {
        if (disposed) return;
        const step = Math.min(.08, Math.max(0, delta));
        if (!reduced) {
          elapsed += step;
          if (retiring && (fadeRemaining -= step) <= 0) { retiring.stop(); retiring = null; }
          if (elapsed >= Math.min(12, Math.max(5, clips[index].duration))) {
            elapsed = 0; index = (index + 1) % clips.length;
            const next = mixer.clipAction(clips[index]).reset().setEffectiveWeight(1).play();
            action.crossFadeTo(next, .45, false); retiring = action; fadeRemaining = .5; action = next;
          }
          mixer.update(step);
        }
        renderer.render(scene, camera);
      },
      dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model!); dispose(); },
    };
  } catch (error) { dispose(); throw error; }
}
