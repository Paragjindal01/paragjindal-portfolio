import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ═══════════ Orbiting Particles ═══════════ */
function OrbitalParticles({ count = 60 }) {
  const ref = useRef();
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 2.2 + Math.random() * 1.2;
      const yOff = (Math.random() - 0.5) * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = yOff;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = 0.15 + Math.random() * 0.35;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const speed = particles.speeds[i];
      const radius = 2.2 + Math.sin(t * speed + i) * 0.3;
      pos.array[i * 3] = Math.cos(baseAngle + t * speed) * radius;
      pos.array[i * 3 + 1] = Math.sin(t * speed * 0.5 + i * 0.5) * 1.0;
      pos.array[i * 3 + 2] = Math.sin(baseAngle + t * speed) * radius;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#06b6d4"
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

/* ═══════════ Circuit Lines ═══════════ */
function CircuitLines() {
  const ref = useRef();

  const lines = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const theta = (Math.random() * Math.PI) - Math.PI / 2;
      const phi = Math.random() * Math.PI * 2;
      const r = 1.52;
      const start = new THREE.Vector3(
        r * Math.cos(theta) * Math.cos(phi),
        r * Math.sin(theta),
        r * Math.cos(theta) * Math.sin(phi)
      );
      const dir = start.clone().normalize();
      const extend = 0.6 + Math.random() * 1.0;
      const mid = start.clone().add(dir.clone().multiplyScalar(extend * 0.5));
      mid.x += (Math.random() - 0.5) * 0.4;
      mid.y += (Math.random() - 0.5) * 0.4;
      const end = start.clone().add(dir.clone().multiplyScalar(extend));
      result.push([start, mid, end]);
    }
    return result;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={ref}>
      {lines.map((pts, i) => {
        const curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
        const points = curve.getPoints(16);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <line key={i} geometry={geometry}>
            <lineBasicMaterial
              color={i % 2 === 0 ? '#06b6d4' : '#8b5cf6'}
              transparent
              opacity={0.35}
            />
          </line>
        );
      })}
    </group>
  );
}

/* ═══════════ Scan Line ═══════════ */
function ScanLine() {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 1.5;
    }
  });
  return (
    <mesh ref={ref} rotation={[0, 0, 0]}>
      <planeGeometry args={[4, 0.02]} />
      <meshBasicMaterial color="#06b6d4" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ═══════════ AI Head (Procedural) ═══════════ */
function AIHead({ mouseX, mouseY }) {
  const groupRef = useRef();
  const wireRef = useRef();
  const solidRef = useRef();

  // Create clipping plane to show wireframe on right side
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.2), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.12;
      // Subtle mouse tilt
      const targetX = (mouseY || 0) * 0.15;
      const targetZ = -(mouseX || 0) * 0.1;
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.03;
      groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.03;
    }
  });

  // Surface particles
  const surfaceParticles = useMemo(() => {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 0.08;
      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    return positions;
  }, []);

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.8}>
      <group ref={groupRef}>
        {/* Solid head (left portion) */}
        <mesh ref={solidRef}>
          <icosahedronGeometry args={[1.5, 6]} />
          <meshPhysicalMaterial
            color="#c8cfe8"
            metalness={0.3}
            roughness={0.4}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
            envMapIntensity={0.8}
            clippingPlanes={[clipPlane]}
            clipShadows
          />
        </mesh>

        {/* Wireframe head (right portion — dissolving into tech) */}
        <mesh ref={wireRef}>
          <icosahedronGeometry args={[1.52, 4]} />
          <meshBasicMaterial
            color="#06b6d4"
            wireframe
            transparent
            opacity={0.4}
            clippingPlanes={[new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.2)]}
          />
        </mesh>

        {/* Full wireframe overlay - subtle */}
        <mesh>
          <icosahedronGeometry args={[1.54, 3]} />
          <meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.08} />
        </mesh>

        {/* Eye glow - left */}
        <mesh position={[-0.45, 0.25, 1.2]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.9} />
        </mesh>
        <pointLight position={[-0.45, 0.25, 1.3]} color="#06b6d4" intensity={0.8} distance={2} />

        {/* Eye glow - right */}
        <mesh position={[0.45, 0.25, 1.2]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.9} />
        </mesh>
        <pointLight position={[0.45, 0.25, 1.3]} color="#06b6d4" intensity={0.8} distance={2} />

        {/* Surface particles (neuron points) */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={400}
              array={surfaceParticles}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.025}
            color="#8b5cf6"
            transparent
            opacity={0.5}
            sizeAttenuation
          />
        </points>

        {/* Circuit lines extending outward */}
        <CircuitLines />
      </group>
    </Float>
  );
}

/* ═══════════ Main Canvas ═══════════ */
export default function HeroCanvas({ mouseX = 0, mouseY = 0 }) {
  return (
    <div className="w-full h-[380px] md:h-[480px] lg:h-full">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, localClippingEnabled: true }}
      >
        {/* Lighting - bright ambient for light theme */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#f8fafc" />
        <pointLight position={[-4, 3, 2]} intensity={0.6} color="#06b6d4" />
        <pointLight position={[4, -2, 3]} intensity={0.4} color="#8b5cf6" />
        <pointLight position={[0, 4, -3]} intensity={0.3} color="#3b82f6" />

        {/* AI Head */}
        <AIHead mouseX={mouseX} mouseY={mouseY} />

        {/* Orbital particles */}
        <OrbitalParticles />

        {/* Scan line */}
        <ScanLine />

        {/* Subtle star field */}
        <Stars
          radius={40}
          depth={50}
          count={800}
          factor={3}
          saturation={0.2}
          fade
          speed={0.5}
        />
      </Canvas>
    </div>
  );
}
