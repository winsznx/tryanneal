"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";

const FLOORS = 5;
const GAP = 1.5;
const WIDTHS = [2.0, 2.5, 3.0, 3.5, 4.0];
const floorY = (i: number) => (2 - i) * GAP;
const TOP_Y = floorY(0);
const BOTTOM_Y = floorY(FLOORS - 1);

const DWELL = 2.2;
const TRAVEL = 0.85;
const RESET = 0.9;
const LOOP = DWELL + 4 * (TRAVEL + DWELL) + RESET;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

type EngineState = { signalY: number; active: number; dwell: number; pulseOpacity: number };

function evalTimeline(t: number): EngineState {
  let acc = 0;
  if (t < DWELL) return { signalY: floorY(0), active: 0, dwell: t / DWELL, pulseOpacity: 1 };
  acc = DWELL;
  for (let i = 1; i <= 4; i++) {
    if (t < acc + TRAVEL) {
      const p = (t - acc) / TRAVEL;
      return { signalY: lerp(floorY(i - 1), floorY(i), easeInOut(p)), active: i, dwell: 0, pulseOpacity: 1 };
    }
    acc += TRAVEL;
    if (t < acc + DWELL) return { signalY: floorY(i), active: i, dwell: (t - acc) / DWELL, pulseOpacity: 1 };
    acc += DWELL;
  }
  const p = (t - acc) / RESET;
  if (p < 0.5) return { signalY: floorY(4), active: 4, dwell: 0, pulseOpacity: 1 - p / 0.5 };
  return { signalY: floorY(0), active: 0, dwell: 0, pulseOpacity: (p - 0.5) / 0.5 };
}

/* ── Reusable in-scene label (mounts only when its floor is active) ── */
function Tag({ position, text, color = "#cfcfff" }: { position: [number, number, number]; text: string; color?: string }) {
  return (
    <Html position={position} center distanceFactor={9} style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          color,
          whiteSpace: "nowrap",
          textShadow: "0 0 6px rgba(0,0,40,0.9)",
        }}
      >
        {text}
      </span>
    </Html>
  );
}

/* ── 01 · INPUT — code lines stream up, hash ring spins ── */
function InputRig({ stateRef }: { stateRef: React.RefObject<EngineState> }) {
  const bars = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const act = stateRef.current.active === 0 ? clamp01(0.3 + stateRef.current.dwell) : 0;
    if (bars.current) {
      bars.current.children.forEach((c, i) => {
        const m = c as THREE.Mesh;
        const h = 0.1 + (Math.sin(s.clock.elapsedTime * 3 + i * 1.3) * 0.5 + 0.5) * 0.6 * act;
        m.scale.y = h;
        m.position.y = h / 2;
      });
    }
    if (ring.current) {
      ring.current.rotation.y += 0.04 * (0.3 + act);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + act * 0.7;
    }
  });
  return (
    <group>
      <group ref={bars}>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 0.1, 0]}>
            <boxGeometry args={[0.06, 1, 0.06]} />
            <meshBasicMaterial color="#8a8aff" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.02, 8, 32]} />
        <meshBasicMaterial color="#4a4aff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/* ── 02 · ANALYZE — ChainGPT pre-screen → Gemini/Groq/Hunyuan cascade → consensus ── */
const CRITICS = [
  { name: "Hunyuan", angle: -Math.PI / 2 },
  { name: "Gemini", angle: Math.PI / 6 },
  { name: "Groq", angle: (5 * Math.PI) / 6 },
];
const R = 1.0;
function AnalyzeRig({ stateRef, showLabels }: { stateRef: React.RefObject<EngineState>; showLabels: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const haiku = useRef<THREE.Mesh>(null);
  const critics = useRef<(THREE.Mesh | null)[]>([]);
  const beams = useRef<(THREE.Group | null)[]>([]);
  const scan = useRef<THREE.Mesh>(null);
  const flow = useRef<THREE.Points>(null);

  const FLOW = 21;
  const flowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(FLOW * 3).fill(0), 3));
    return g;
  }, []);
  const criticPos = useMemo(
    () => CRITICS.map((c) => new THREE.Vector3(Math.cos(c.angle) * R, 0, Math.sin(c.angle) * R)),
    []
  );

  useFrame((s) => {
    const st = stateRef.current;
    const p = st.active === 1 ? st.dwell : 0;
    const t = s.clock.elapsedTime;

    // Haiku pre-screen pulses first
    if (haiku.current) {
      const hp = ramp(p, 0.0, 0.3) * (1 - ramp(p, 0.3, 0.45));
      const pulse = 1 + Math.sin(t * 10) * 0.15 * hp;
      haiku.current.scale.setScalar(0.12 * pulse + 0.001);
      (haiku.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * ramp(p, 0, 0.25);
    }
    // Critics ignite
    critics.current.forEach((c, i) => {
      if (!c) return;
      const ig = ramp(p, 0.3 + i * 0.06, 0.55 + i * 0.06);
      (c.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.75 * ig;
      c.scale.setScalar(0.09 + 0.05 * ig);
    });
    // Beams converge
    beams.current.forEach((b, i) => {
      if (!b) return;
      const op = ramp(p, 0.4 + i * 0.05, 0.85);
      b.children.forEach((ch) => {
        const lm = (ch as THREE.Mesh).material as THREE.Material & { opacity: number };
        if (lm) lm.opacity = op * 0.7;
      });
    });
    // Core consensus pulse at the end
    if (core.current) {
      const cp = ramp(p, 0.75, 1);
      const pulse = 1 + Math.sin(t * 8) * 0.2 * cp;
      core.current.scale.setScalar((0.08 + 0.12 * cp) * pulse);
      (core.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * cp;
    }
    // Slither scan sweep
    if (scan.current) {
      const sweep = (t * 0.6) % 1;
      scan.current.position.x = lerp(-1.4, 1.4, sweep);
      (scan.current.material as THREE.MeshBasicMaterial).opacity = (st.active === 1 ? 0.4 : 0) * (0.5 + 0.5 * Math.sin(sweep * Math.PI));
    }
    // Particle trails: models feed the consensus core
    if (flow.current) {
      const pos = flowGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < FLOW; k++) {
        const beam = k % 3;
        const phase = (t * 0.65 + k / FLOW) % 1;
        const cp = criticPos[beam];
        const f = 1 - phase; // critic → center
        pos.setXYZ(k, cp.x * f, cp.y * f, cp.z * f);
      }
      pos.needsUpdate = true;
      (flow.current.material as THREE.PointsMaterial).opacity = ramp(p, 0.4, 0.92) * 0.95;
    }
  });

  return (
    <group position={[0, 0.55, 0]}>
      {/* consensus core */}
      <mesh ref={core}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#8a8aff" transparent opacity={0.3} />
      </mesh>
      {/* Haiku pre-screen */}
      <mesh ref={haiku} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#bdbdff" transparent opacity={0.4} />
      </mesh>
      {showLabels && <Tag position={[0, 0.85, 0]} text="ChainGPT" color="#bdbdff" />}

      {CRITICS.map((c, i) => {
        const x = Math.cos(c.angle) * R;
        const z = Math.sin(c.angle) * R;
        return (
          <group key={c.name}>
            <mesh ref={(el) => { critics.current[i] = el; }} position={[x, 0, z]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshBasicMaterial color="#6a6aff" transparent opacity={0.25} />
            </mesh>
            <group ref={(el) => { beams.current[i] = el; }}>
              <Line points={[[x, 0, z], [0, 0, 0]]} color="#4a4aff" lineWidth={1.5} transparent opacity={0} />
            </group>
            {showLabels && <Tag position={[x, 0.32, z]} text={c.name} />}
          </group>
        );
      })}

      {/* Slither scan line */}
      <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[0.04, 2.6]} />
        <meshBasicMaterial color="#5a5aff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      {showLabels && <Tag position={[0, -0.32, 1.5]} text="Slither + Aderyn" color="#9a9aff" />}

      {/* Particle trails flowing inward to the consensus core */}
      <points ref={flow} geometry={flowGeo}>
        <pointsMaterial color="#8a8aff" size={0.06} sizeAttenuation transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}

/* ── 03 · VALIDATE — 3 votes (2 agree), 2/3 gauge fills, confidence ── */
function ValidateRig({ stateRef, showLabels }: { stateRef: React.RefObject<EngineState>; showLabels: boolean }) {
  const ticks = useRef<(THREE.Mesh | null)[]>([]);
  const votes = useRef<(THREE.Mesh | null)[]>([]);
  const TICKS = 24;
  const FILL = Math.round(TICKS * (2 / 3));

  useFrame(() => {
    const st = stateRef.current;
    const p = st.active === 2 ? st.dwell : 0;
    const filled = Math.floor(ramp(p, 0.15, 0.9) * FILL);
    ticks.current.forEach((m, i) => {
      if (!m) return;
      const on = i < filled;
      (m.material as THREE.MeshBasicMaterial).opacity = on ? 0.9 : 0.12;
      (m.material as THREE.MeshBasicMaterial).color.set(on ? "#5a5aff" : "#666666");
    });
    votes.current.forEach((m, i) => {
      if (!m) return;
      const agree = i < 2;
      const lit = ramp(p, 0.2 + i * 0.18, 0.45 + i * 0.18);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.8 * lit;
      (m.material as THREE.MeshBasicMaterial).color.set(agree ? "#6a6aff" : "#555555");
    });
  });

  return (
    <group position={[0, 0.5, 0]}>
      {/* gauge ring of ticks */}
      {Array.from({ length: TICKS }).map((_, i) => {
        const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * 0.7;
        const z = Math.sin(a) * 0.7;
        return (
          <mesh key={i} ref={(el) => { ticks.current[i] = el; }} position={[x, 0, z]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.03, 0.03, 0.12]} />
            <meshBasicMaterial color="#666666" transparent opacity={0.12} />
          </mesh>
        );
      })}
      {/* 3 vote markers */}
      {[-0.35, 0, 0.35].map((x, i) => (
        <mesh key={i} ref={(el) => { votes.current[i] = el; }} position={[x, 0, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshBasicMaterial color="#555555" transparent opacity={0.2} />
        </mesh>
      ))}
      {showLabels && <Tag position={[0, 0.45, 0]} text="2 / 3 · 0.91" />}
    </group>
  );
}

/* ── 04 · ATTEST — block seals, ERC-8004 ring spins ── */
function AttestRig({ stateRef, showLabels }: { stateRef: React.RefObject<EngineState>; showLabels: boolean }) {
  const lid = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const st = stateRef.current;
    const p = st.active === 3 ? st.dwell : 0;
    if (lid.current) {
      const seal = ramp(p, 0.2, 0.7);
      lid.current.position.y = lerp(0.55, 0.18, easeInOut(seal));
      (lid.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * seal;
    }
    if (ring.current) {
      const spin = ramp(p, 0.3, 1);
      ring.current.rotation.z += 0.12 * (0.2 + spin);
      ring.current.scale.setScalar(0.8 + 0.2 * spin);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.7 * spin;
    }
  });
  return (
    <group position={[0, 0.4, 0]}>
      {/* block base */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.18, 0.4]} />
        <meshBasicMaterial color="#2a2a44" transparent opacity={0.5} />
      </mesh>
      {/* lid */}
      <mesh ref={lid} position={[0, 0.5, 0]}>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
        <meshBasicMaterial color="#6a6aff" transparent opacity={0.3} />
      </mesh>
      {/* ERC-8004 hex ring */}
      <mesh ref={ring} position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.02, 6, 6]} />
        <meshBasicMaterial color="#5a5aff" transparent opacity={0.2} />
      </mesh>
      {showLabels && <Tag position={[0, 0.95, 0]} text="ERC-8004" />}
    </group>
  );
}

/* ── 05 · ON-CHAIN — blocks snap into a chain, finality ripple ── */
function ChainRig({ stateRef, showLabels }: { stateRef: React.RefObject<EngineState>; showLabels: boolean }) {
  const blocks = useRef<(THREE.Mesh | null)[]>([]);
  const ripple = useRef<THREE.Mesh>(null);
  const N = 4;
  useFrame(() => {
    const st = stateRef.current;
    const p = st.active === 4 ? st.dwell : 0;
    blocks.current.forEach((m, i) => {
      if (!m) return;
      const appear = ramp(p, i * 0.18, i * 0.18 + 0.25);
      m.scale.setScalar(0.001 + 0.18 * appear);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.7 * appear;
    });
    if (ripple.current) {
      const r = ramp(p, 0.7, 1);
      const sc = 0.2 + r * 1.6;
      ripple.current.scale.set(sc, sc, sc);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.5;
    }
  });
  return (
    <group position={[0, 0.35, 0]}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={(el) => { blocks.current[i] = el; }} position={[-0.55 + i * 0.37, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#6a6aff" transparent opacity={0.2} />
        </mesh>
      ))}
      <mesh ref={ripple} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <ringGeometry args={[0.45, 0.5, 48]} />
        <meshBasicMaterial color="#5a5aff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      {showLabels && <Tag position={[0, 0.5, 0]} text="Mantle · 5000" color="#bdbdff" />}
    </group>
  );
}

/* ── Floor plate that reacts + hosts its instrument ── */
function Floor({
  i,
  stateRef,
  activeFloor,
}: {
  i: number;
  stateRef: React.RefObject<EngineState>;
  activeFloor: number;
}) {
  const w = WIDTHS[i];
  const y = floorY(i);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(w, 0.1, w), [w]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);

  const glowEdge = useRef<THREE.LineBasicMaterial>(null);
  const face = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const st = stateRef.current;
    const a = st.active === i ? clamp01(0.35 + st.dwell * 0.65) : 0;
    if (glowEdge.current) glowEdge.current.opacity = a;
    if (face.current) face.current.emissiveIntensity = a * 0.5;
  });

  const showLabels = activeFloor === i;

  return (
    <group position={[0, y, 0]}>
      <mesh geometry={boxGeo}>
        <meshStandardMaterial ref={face} color="#171717" transparent opacity={0.24} metalness={0.1} roughness={0.85} emissive="#0000ff" emissiveIntensity={0} />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#c4c4c4" transparent opacity={0.38} />
      </lineSegments>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial ref={glowEdge} color="#4a4aff" transparent opacity={0} />
      </lineSegments>

      {/* instrument per floor */}
      {i === 0 && <InputRig stateRef={stateRef} />}
      {i === 1 && <AnalyzeRig stateRef={stateRef} showLabels={showLabels} />}
      {i === 2 && <ValidateRig stateRef={stateRef} showLabels={showLabels} />}
      {i === 3 && <AttestRig stateRef={stateRef} showLabels={showLabels} />}
      {i === 4 && <ChainRig stateRef={stateRef} showLabels={showLabels} />}
    </group>
  );
}

function LeadPulse({ stateRef }: { stateRef: React.RefObject<EngineState> }) {
  const g = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const st = stateRef.current;
    if (g.current) g.current.position.y = st.signalY;
    if (coreMat.current) coreMat.current.opacity = st.pulseOpacity;
    if (haloMat.current) haloMat.current.opacity = 0.25 * st.pulseOpacity;
    if (light.current) light.current.intensity = 4 * st.pulseOpacity;
  });
  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial ref={coreMat} color="#9a9aff" transparent opacity={1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshBasicMaterial ref={haloMat} color="#0000ff" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#3a3aff" intensity={4} distance={4.2} />
    </group>
  );
}

function Spine() {
  return (
    <mesh>
      <cylinderGeometry args={[0.012, 0.012, TOP_Y - BOTTOM_Y, 8]} />
      <meshBasicMaterial color="#0000ff" transparent opacity={0.16} />
    </mesh>
  );
}

/* Cinematic camera: orbits the structure horizontally, bobs in height,
   breathes in/out, and eases its look-target down to follow the signal. */
function CameraRig({ animate, stateRef }: { animate: boolean; stateRef: React.RefObject<EngineState> }) {
  const { camera, size } = useThree();
  const lookY = useRef(0);
  const lookX = useRef(0);
  useFrame((s) => {
    const t = animate ? s.clock.elapsedTime : 0;
    const narrow = size.width / Math.max(1, size.height) < 1.2;

    // Wider, more noticeable horizontal orbit; pull back + calmer swing on narrow screens.
    const azAmp = narrow ? 0.5 : 0.95; // ±29° mobile, ±54° desktop
    const baseR = narrow ? 16 : 12.5;
    const az = 0.4 + Math.sin(t * 0.17) * azAmp;
    const radius = baseR + Math.sin(t * 0.09) * 1.0;
    const height = 5.0 + Math.sin(t * 0.11) * 0.8;
    camera.position.set(Math.sin(az) * radius, height, Math.cos(az) * radius);

    // Lateral pan + vertical follow of the descending signal.
    const targetX = (narrow ? 0.0 : 0.6) * Math.sin(t * 0.13);
    lookX.current = lerp(lookX.current, targetX, 0.06);
    lookY.current = lerp(lookY.current, stateRef.current.signalY * 0.28, 0.06);
    camera.lookAt(lookX.current, lookY.current, 0);
  });
  return null;
}

function Model({
  animate,
  onActive,
  stateRef,
}: {
  animate: boolean;
  onActive?: (i: number) => void;
  stateRef: React.RefObject<EngineState>;
}) {
  const lastActive = useRef(-1);
  const [activeFloor, setActiveFloor] = useState(0);

  useFrame((s) => {
    if (animate) {
      const t = s.clock.elapsedTime % LOOP;
      const st = evalTimeline(t);
      stateRef.current = st;
      if (st.active !== lastActive.current) {
        lastActive.current = st.active;
        setActiveFloor(st.active);
        onActive?.(st.active);
      }
    } else {
      stateRef.current = { signalY: floorY(1), active: 1, dwell: 0.65, pulseOpacity: 1 };
      if (lastActive.current !== 1) { lastActive.current = 1; setActiveFloor(1); onActive?.(1); }
    }
  });

  return (
    <group rotation={[0, 0.35, 0]}>
      {Array.from({ length: FLOORS }).map((_, i) => (
        <Floor key={i} i={i} stateRef={stateRef} activeFloor={activeFloor} />
      ))}
      <Spine />
      <LeadPulse stateRef={stateRef} />
    </group>
  );
}

export type EngineSceneProps = {
  animate?: boolean;
  paused?: boolean;
  onActive?: (i: number) => void;
};

export default function EngineScene({
  animate = true,
  paused = false,
  onActive,
}: EngineSceneProps) {
  const stateRef = useRef<EngineState>({ signalY: TOP_Y, active: 0, dwell: 0, pulseOpacity: 1 });
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [6.2, 5.2, 11.4], fov: 42 }}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <fog attach="fog" args={["#0d0d0d", 11, 30]} />
      {/* key */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 10, 6]} intensity={0.8} color="#ffffff" />
      {/* cool fill from the opposite side — lifts shadow faces, reveals form */}
      <directionalLight position={[-7, 4, -5]} intensity={0.35} color="#3a3aff" />
      {/* bottom rim glow toward the Mantle foundation */}
      <pointLight position={[0, -4, 0]} intensity={0.5} color="#2a2aff" distance={14} />
      <CameraRig animate={animate} stateRef={stateRef} />
      <Model animate={animate} onActive={onActive} stateRef={stateRef} />
    </Canvas>
  );
}
