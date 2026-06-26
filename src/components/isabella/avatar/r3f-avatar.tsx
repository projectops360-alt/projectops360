"use client";

// ============================================================================
// Isabella — REAL-TIME 3D presence (React Three Fiber)
// ============================================================================
// A genuine 3D character inside a real Three.js scene — NOT an SVG/PNG/CSS
// fake-3D. Two figures behind the SAME PresenceState contract:
//
//   • Procedural 3D Isabella (DEFAULT) — an original stylized executive bust
//     built from real geometry with real-time lighting, depth and a gentle turn
//     that reveals her volume. Always renders, no external asset, no network.
//   • Ready Player Me GLB (OPT-IN) — when NEXT_PUBLIC_ISABELLA_AVATAR_URL is set
//     the official Isabella avatar (built in RPM to match the Character Bible)
//     loads with ARKit morph targets. Mixamo gesture clips slot in next.
//
// Both are kept ALIVE: breathing, weight shift, head sway (lean-in listening,
// away thinking), natural blinking, mouth articulation while speaking.
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

// Brand palette (Character Bible — violet accent, navy tailoring, no green).
const SKIN = "#f0c6a4";
const SKIN_SHADOW = "#e0a883";
const HAIR = "#2c1d14";
const BLAZER = "#23223f";
const BLOUSE = "#eceaf6";

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

// ── Procedural 3D Isabella (default — original stylized executive bust) ──────
function ProceduralIsabella({ state, accent }: { state: PresenceState; accent: string }) {
  const figure = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const blink = useBlink();

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const speaking = state === "speaking";
    // Breathing + a gentle turn that reveals her 3D volume.
    if (figure.current) {
      figure.current.position.y = -0.9 + Math.sin(t * 1.5) * 0.012;
      figure.current.rotation.y = Math.sin(t * 0.32) * 0.14;
      figure.current.rotation.z = Math.sin(t * 0.6) * 0.01;
    }
    // Head sway + lean-in / away by state.
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.5) * 0.06 + (state === "thinking" ? -0.18 : 0);
      head.current.rotation.x = Math.sin(t * 0.4) * 0.03 + (state === "listening" ? 0.12 : 0);
    }
    // Blink (squash the eyelids over the eyes).
    const bv = blinkValue(blink.current, t);
    if (lidL.current) lidL.current.scale.y = 0.08 + bv * 0.95;
    if (lidR.current) lidR.current.scale.y = 0.08 + bv * 0.95;
    // Mouth articulates while speaking.
    if (mouth.current) {
      const target = speaking ? 0.5 + (Math.sin(t * 12) * 0.5 + 0.5) * 1.4 : 0.4;
      mouth.current.scale.y += (target - mouth.current.scale.y) * 0.4;
    }
  });

  return (
    <group ref={figure} position={[0, -0.9, 0]}>
      {/* Shoulders / tailored blazer */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.92, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={BLAZER} roughness={0.62} metalness={0.05} />
      </mesh>
      {/* Blouse V */}
      <mesh position={[0, 0.5, 0.34]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.16, 0.4, 4]} />
        <meshStandardMaterial color={BLOUSE} roughness={0.5} />
      </mesh>
      {/* Violet lapel accent */}
      <mesh position={[0.16, 0.56, 0.36]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.62, 0.02]}>
        <cylinderGeometry args={[0.17, 0.21, 0.36, 24]} />
        <meshStandardMaterial color={SKIN_SHADOW} roughness={0.7} />
      </mesh>

      {/* Head group */}
      <group ref={head} position={[0, 1.0, 0]}>
        {/* Hair back */}
        <mesh position={[0, 0.02, -0.06]} scale={[1.12, 1.18, 1.12]}>
          <sphereGeometry args={[0.5, 40, 32]} />
          <meshStandardMaterial color={HAIR} roughness={0.85} />
        </mesh>
        {/* Skull / face */}
        <mesh position={[0, 0, 0.02]} scale={[0.92, 1.06, 0.96]}>
          <sphereGeometry args={[0.5, 48, 40]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Hair front fringe (side-parted) */}
        <mesh position={[-0.06, 0.34, 0.26]} rotation={[0.5, 0.3, 0.2]} scale={[0.7, 0.42, 0.5]}>
          <sphereGeometry args={[0.5, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={HAIR} roughness={0.85} />
        </mesh>

        {/* Brows */}
        <mesh position={[-0.17, 0.16, 0.46]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.16, 0.022, 0.03]} />
          <meshStandardMaterial color={"#3a2a20"} roughness={0.8} />
        </mesh>
        <mesh position={[0.17, 0.16, 0.46]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.16, 0.022, 0.03]} />
          <meshStandardMaterial color={"#3a2a20"} roughness={0.8} />
        </mesh>

        {/* Eyes (white + iris) */}
        {[-0.17, 0.17].map((x, i) => (
          <group key={i} position={[x, 0.07, 0.44]}>
            <mesh scale={[1.2, 0.8, 0.6]}>
              <sphereGeometry args={[0.075, 24, 20]} />
              <meshStandardMaterial color={"#ffffff"} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <sphereGeometry args={[0.038, 20, 16]} />
              <meshStandardMaterial color={"#4a342a"} roughness={0.25} />
            </mesh>
            <mesh position={[0.012, 0.012, 0.082]}>
              <sphereGeometry args={[0.012, 12, 12]} />
              <meshBasicMaterial color={"#ffffff"} />
            </mesh>
          </group>
        ))}
        {/* Eyelids (blink) */}
        <mesh ref={lidL} position={[-0.17, 0.1, 0.47]} scale={[1, 0.08, 1]}>
          <boxGeometry args={[0.17, 0.09, 0.04]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
        <mesh ref={lidR} position={[0.17, 0.1, 0.47]} scale={[1, 0.08, 1]}>
          <boxGeometry args={[0.17, 0.09, 0.04]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.5]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.045, 0.16, 16]} />
          <meshStandardMaterial color={SKIN_SHADOW} roughness={0.6} />
        </mesh>

        {/* Mouth (articulates) */}
        <mesh ref={mouth} position={[0, -0.22, 0.46]} scale={[1, 0.4, 1]}>
          <sphereGeometry args={[0.07, 24, 16]} />
          <meshStandardMaterial color={"#bb6178"} roughness={0.45} />
        </mesh>

        {/* Earrings — violet accent */}
        <mesh position={[-0.46, -0.04, 0.08]}>
          <sphereGeometry args={[0.028, 14, 14]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.46, -0.04, 0.08]}>
          <sphereGeometry args={[0.028, 14, 14]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
        </mesh>
      </group>
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
            {HAS_RPM ? <RpmModel state={state} accent={accent} /> : <ProceduralIsabella state={state} accent={accent} />}
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}

if (HAS_RPM) useGLTF.preload(AVATAR_URL);
