"use client";

// ============================================================================
// Isabella — REAL 3D presence renderer (React Three Fiber + Ready Player Me)
// ============================================================================
// A genuine 3D character inside a real-time Three.js scene — NOT an SVG, PNG or
// CSS fake-3D. A Ready Player Me GLB avatar is lit on a holographic stage and
// kept alive procedurally: breathing, weight shift, natural blinking (ARKit
// morph targets), gaze, and mouth articulation while speaking. Hand/﻿body
// gesture CLIPS (Mixamo) are the next asset step and slot into the same
// PresenceState contract.
//
// Decoupling: this file is the ONLY place that knows Isabella is 3D. It speaks
// the same PresenceState the SVG renderer used, so it swaps in with no change to
// the conversation engine. Lazy-loaded by the registry, so three.js is fetched
// only when Isabella's window opens.
//
// The avatar URL is configurable via NEXT_PUBLIC_ISABELLA_AVATAR_URL so the
// team can drop in the official Isabella avatar (created in Ready Player Me to
// match the Character Bible) without a code change.
// ============================================================================

import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PresenceProps, PresenceState } from "./presence";

const BASE_AVATAR =
  process.env.NEXT_PUBLIC_ISABELLA_AVATAR_URL ||
  "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb";

/** Request ARKit morph targets so we can blink + articulate the mouth. */
function withMorphTargets(url: string): string {
  if (url.includes("morphTargets=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}morphTargets=ARKit,Oculus%20Visemes&textureAtlas=1024`;
}
const AVATAR_URL = withMorphTargets(BASE_AVATAR);

type MorphRef = { mesh: THREE.Mesh; index: number };

function findMorph(scene: THREE.Object3D, names: string[]): MorphRef | null {
  let found: MorphRef | null = null;
  scene.traverse((o) => {
    if (found) return;
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    if (!dict || !mesh.morphTargetInfluences) return;
    for (const n of names) {
      if (dict[n] !== undefined) {
        found = { mesh, index: dict[n] };
        return;
      }
    }
  });
  return found;
}

function findBone(scene: THREE.Object3D, name: string): THREE.Bone | null {
  let bone: THREE.Bone | null = null;
  scene.traverse((o) => {
    if (!bone && (o as THREE.Bone).isBone && o.name === name) bone = o as THREE.Bone;
  });
  return bone;
}

function AvatarModel({ state, accent }: { state: PresenceState; accent: string }) {
  const { scene } = useGLTF(AVATAR_URL);
  const root = useRef<THREE.Group>(null);
  const three = useThree();

  // Animated targets live in a ref (mutated every frame, by design).
  type Rig = {
    blinkL: MorphRef | null; blinkR: MorphRef | null; jaw: MorphRef | null;
    smile: MorphRef | null; head: THREE.Bone | null; spine: THREE.Bone | null;
  };
  const rigRef = useRef<Rig | null>(null);
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

  // Frame the bust (head + upper chest) deterministically from the bounding box.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const top = box.max.y;
    const targetY = top - size.y * 0.16; // around the eyes
    const cam = three.camera as THREE.PerspectiveCamera;
    const visible = size.y * 0.42; // show ~head + shoulders
    const dist = visible / 2 / Math.tan((cam.fov * Math.PI) / 180 / 2);
    cam.position.set(center.x, targetY, box.max.z + dist);
    cam.lookAt(center.x, targetY, center.z);
    cam.updateProjectionMatrix();
  }, [scene, three.camera]);

  const blink = useRef({ next: 1.5, t: -1 });

  useFrame((s) => {
    const rig = rigRef.current;
    if (!rig) return;
    const t = s.clock.elapsedTime;
    const speaking = state === "speaking";
    const thinking = state === "thinking";
    const listening = state === "listening";

    // Breathing — whole figure gently rises/settles.
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.5) * 0.006;
      root.current.rotation.z = Math.sin(t * 0.6) * 0.004; // weight shift
    }

    // Head: subtle sway + lean-in when listening, away when thinking, to-user idle.
    if (rig.head) {
      const swayY = Math.sin(t * 0.5) * 0.05 + (thinking ? -0.12 : 0);
      const swayX = Math.sin(t * 0.37) * 0.025 + (listening ? 0.08 : 0);
      rig.head.rotation.y = swayY;
      rig.head.rotation.x = swayX;
    }
    if (rig.spine) rig.spine.rotation.y = Math.sin(t * 0.32) * 0.02;

    // Natural blinking.
    const b = blink.current;
    if (b.t < 0 && t >= b.next) b.t = t;
    let blinkV = 0;
    if (b.t >= 0) {
      const dt = t - b.t;
      if (dt < 0.12) blinkV = dt / 0.12;
      else if (dt < 0.18) blinkV = 1 - (dt - 0.12) / 0.06;
      else { blinkV = 0; b.t = -1; b.next = t + 2.5 + Math.random() * 3.5; }
    }
    if (rig.blinkL?.mesh.morphTargetInfluences) rig.blinkL.mesh.morphTargetInfluences[rig.blinkL.index] = blinkV;
    if (rig.blinkR?.mesh.morphTargetInfluences) rig.blinkR.mesh.morphTargetInfluences[rig.blinkR.index] = blinkV;

    // Mouth: articulate while speaking, soft smile otherwise.
    if (rig.jaw?.mesh.morphTargetInfluences) {
      const target = speaking ? (Math.sin(t * 11) * 0.5 + 0.5) * 0.32 + Math.random() * 0.05 : 0;
      const cur = rig.jaw.mesh.morphTargetInfluences[rig.jaw.index];
      rig.jaw.mesh.morphTargetInfluences[rig.jaw.index] = cur + (target - cur) * 0.4;
    }
    if (rig.smile?.mesh.morphTargetInfluences) {
      const target = speaking ? 0.12 : state === "greeting" ? 0.32 : 0.16;
      const cur = rig.smile.mesh.morphTargetInfluences[rig.smile.index];
      rig.smile.mesh.morphTargetInfluences[rig.smile.index] = cur + (target - cur) * 0.05;
    }
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
      {/* Violet rim/accent light keeps the holographic identity. */}
      <pointLight position={[1.4, 1.6, -1.2]} intensity={6} color={accent} distance={6} />
    </group>
  );
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    // On failure render nothing — the holographic placeholder underneath shows.
    return this.state.failed ? null : this.props.children;
  }
}

export function R3fAvatar({ state = "idle", size = 150, accent = "#7c3aed", className }: PresenceProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <CanvasBoundary>
        <Canvas
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          dpr={[1, 1.75]}
          camera={{ fov: 24, position: [0, 1.5, 1.2] }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.9} />
          <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#3b3a55" />
          <directionalLight position={[2, 3, 2]} intensity={1.4} />
          <Suspense fallback={null}>
            <AvatarModel state={state} accent={accent} />
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}

useGLTF.preload(AVATAR_URL);
