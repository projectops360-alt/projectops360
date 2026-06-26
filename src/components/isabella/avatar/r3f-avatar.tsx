"use client";

// ============================================================================
// Isabella — REAL-TIME 3D presence (React Three Fiber + Ready Player Me)
// ============================================================================
// A genuine 3D character inside a real Three.js scene — a Ready Player Me GLB
// (rigged, realistic) kept ALIVE: breathing, weight shift, head sway (lean-in
// listening, away thinking), natural blinking (ARKit morph targets), and mouth
// articulation while speaking. Mixamo gesture clips slot in next.
//
// This renderer is ONLY mounted when NEXT_PUBLIC_ISABELLA_AVATAR_URL is set (the
// official Isabella avatar, created in Ready Player Me to match the Character
// Bible). With no avatar configured the window shows the elegant holographic
// presence instead — we never hand-build a face from primitives.
//
// Lazy-loaded by the registry, so three.js is fetched only when Isabella opens.
// ============================================================================

import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PresenceProps, PresenceState } from "./presence";

const RPM_URL = process.env.NEXT_PUBLIC_ISABELLA_AVATAR_URL || "";
const HAS_RPM = RPM_URL.length > 0;
function withMorphTargets(url: string): string {
  if (!url || url.includes("morphTargets=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024`;
}
const AVATAR_URL = withMorphTargets(RPM_URL);

type MorphRef = { mesh: THREE.Mesh; index: number };
function findMorph(scene: THREE.Object3D, names: string[]): MorphRef | null {
  let found: MorphRef | null = null;
  scene.traverse((o) => {
    if (found) return;
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;
    for (const n of names) if (dict[n] !== undefined) { found = { mesh, index: dict[n] }; return; }
  });
  return found;
}
function findBone(scene: THREE.Object3D, name: string): THREE.Bone | null {
  let bone: THREE.Bone | null = null;
  scene.traverse((o) => { if (!bone && (o as THREE.Bone).isBone && o.name === name) bone = o as THREE.Bone; });
  return bone;
}

// ── Shared idle/expression timing ───────────────────────────────────────────
function useBlink() {
  return useRef({ next: 1.5, t: -1 });
}
function blinkValue(blink: { next: number; t: number }, t: number): number {
  if (blink.t < 0 && t >= blink.next) blink.t = t;
  if (blink.t < 0) return 0;
  const dt = t - blink.t;
  if (dt < 0.1) return dt / 0.1;
  if (dt < 0.16) return 1 - (dt - 0.1) / 0.06;
  blink.t = -1; blink.next = t + 2.4 + Math.random() * 3.4;
  return 0;
}

// ── Ready Player Me GLB (opt-in) ────────────────────────────────────────────
function RpmModel({ state, accent }: { state: PresenceState; accent: string }) {
  const { scene } = useGLTF(AVATAR_URL);
  const root = useRef<THREE.Group>(null);
  const three = useThree();
  type Rig = { blinkL: MorphRef | null; blinkR: MorphRef | null; jaw: MorphRef | null; smile: MorphRef | null; head: THREE.Bone | null; spine: THREE.Bone | null };
  const rigRef = useRef<Rig | null>(null);
  const blink = useBlink();

  useEffect(() => {
    rigRef.current = {
      blinkL: findMorph(scene, ["eyeBlinkLeft"]),
      blinkR: findMorph(scene, ["eyeBlinkRight"]),
      jaw: findMorph(scene, ["jawOpen", "mouthOpen", "viseme_aa"]),
      smile: findMorph(scene, ["mouthSmile", "mouthSmileLeft"]),
      head: findBone(scene, "Head"),
      spine: findBone(scene, "Spine2") || findBone(scene, "Spine1") || findBone(scene, "Spine"),
    };
  }, [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetY = box.max.y - size.y * 0.16;
    const cam = three.camera as THREE.PerspectiveCamera;
    const dist = (size.y * 0.42) / 2 / Math.tan((cam.fov * Math.PI) / 180 / 2);
    cam.position.set(center.x, targetY, box.max.z + dist);
    cam.lookAt(center.x, targetY, center.z);
    cam.updateProjectionMatrix();
  }, [scene, three.camera]);

  useFrame((s) => {
    const rig = rigRef.current; if (!rig) return;
    const t = s.clock.elapsedTime;
    const speaking = state === "speaking";
    if (root.current) root.current.position.y = Math.sin(t * 1.5) * 0.006;
    if (rig.head) {
      rig.head.rotation.y = Math.sin(t * 0.5) * 0.05 + (state === "thinking" ? -0.12 : 0);
      rig.head.rotation.x = Math.sin(t * 0.37) * 0.025 + (state === "listening" ? 0.08 : 0);
    }
    if (rig.spine) rig.spine.rotation.y = Math.sin(t * 0.32) * 0.02;
    const bv = blinkValue(blink.current, t);
    if (rig.blinkL?.mesh.morphTargetInfluences) rig.blinkL.mesh.morphTargetInfluences[rig.blinkL.index] = bv;
    if (rig.blinkR?.mesh.morphTargetInfluences) rig.blinkR.mesh.morphTargetInfluences[rig.blinkR.index] = bv;
    if (rig.jaw?.mesh.morphTargetInfluences) {
      const target = speaking ? (Math.sin(t * 11) * 0.5 + 0.5) * 0.32 : 0;
      const cur = rig.jaw.mesh.morphTargetInfluences[rig.jaw.index];
      rig.jaw.mesh.morphTargetInfluences[rig.jaw.index] = cur + (target - cur) * 0.4;
    }
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
      <pointLight position={[1.4, 1.6, -1.2]} intensity={6} color={accent} distance={6} />
    </group>
  );
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function R3fAvatar({ state = "idle", size = 150, accent = "#7c3aed", className }: PresenceProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <CanvasBoundary>
        <Canvas
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          dpr={[1, 1.75]}
          camera={{ fov: 30, position: [0, 0.1, 2.7] }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.85} />
          <hemisphereLight intensity={0.55} color="#ffffff" groundColor="#3b3a55" />
          <directionalLight position={[2.5, 3, 3]} intensity={1.5} />
          {/* Violet holographic rim from behind. */}
          <pointLight position={[-2, 1.5, -2]} intensity={5} color={accent} distance={9} />
          <Suspense fallback={null}>
            {HAS_RPM ? <RpmModel state={state} accent={accent} /> : null}
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}

if (HAS_RPM) useGLTF.preload(AVATAR_URL);
