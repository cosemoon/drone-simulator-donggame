import * as THREE from "three";
import type { Course, GameTheme, Gate, Vector3Tuple } from "./types";

export type GateVisualState = "idle" | "active" | "cleared";

export interface GateRenderHandle {
  gate: Gate;
  root: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  arrow: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
}

export interface TrainingArenaScene {
  scene: THREE.Scene;
  drone: THREE.Group;
  gates: Map<string, GateRenderHandle>;
  setGateState(gateId: string, state: GateVisualState): void;
  dispose(): void;
}

const LOCAL_GATE_NORMAL = new THREE.Vector3(0, 0, 1);

function color(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function vectorFromTuple(tuple: Vector3Tuple): THREE.Vector3 {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function normalizedNormal(gate: Gate): THREE.Vector3 {
  const normal = vectorFromTuple(gate.normal);

  if (normal.lengthSq() === 0) {
    return LOCAL_GATE_NORMAL.clone();
  }

  return normal.normalize();
}

function material(
  hex: string,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.58,
    metalness: 0.1,
    ...options,
  });
}

function applyGateMaterial(
  handle: GateRenderHandle,
  theme: GameTheme,
  state: GateVisualState,
): void {
  const gateColor =
    state === "active"
      ? theme.colors.gate.active
      : state === "cleared"
        ? theme.colors.gate.cleared
        : theme.colors.gate.frame;
  const emissiveIntensity = state === "active" ? 0.36 : state === "cleared" ? 0.18 : 0.03;

  handle.ring.material.color.set(gateColor);
  handle.ring.material.emissive.set(gateColor);
  handle.ring.material.emissiveIntensity = emissiveIntensity;
  handle.arrow.material.color.set(
    state === "active" ? theme.colors.gate.active : theme.colors.gate.accent,
  );
  handle.arrow.material.emissive.set(theme.colors.gate.accent);
  handle.arrow.material.emissiveIntensity = state === "active" ? 0.24 : 0.06;
  handle.root.scale.setScalar(state === "active" ? 1.045 : 1);
}

function createSkyDome(theme: GameTheme): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(140, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: color(theme.colors.sky.top) },
      horizonColor: { value: color(theme.colors.sky.horizon) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;

      void main() {
        float h = normalize(vWorldPosition).y;
        float mixAmount = smoothstep(-0.12, 0.82, h);
        gl_FragColor = vec4(mix(horizonColor, topColor, mixAmount), 1.0);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

function createGround(course: Course, theme: GameTheme): THREE.Group {
  const group = new THREE.Group();
  const width = course.bounds.max[0] - course.bounds.min[0] + 12;
  const depth = course.bounds.max[2] - course.bounds.min[2] + 12;
  const centerX = (course.bounds.max[0] + course.bounds.min[0]) / 2;
  const centerZ = (course.bounds.max[2] + course.bounds.min[2]) / 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    material(theme.colors.ground.base, { roughness: 0.92, metalness: 0 }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, 0, centerZ);
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(
    Math.max(width, depth),
    32,
    theme.colors.ground.gridMajor,
    theme.colors.ground.gridMinor,
  );
  grid.position.set(centerX, 0.018, centerZ);
  group.add(grid);

  return group;
}

function createPad(
  position: Vector3Tuple,
  radius: number,
  fillColor: string,
  ringColor: string,
): THREE.Group {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.08, 64),
    material(fillColor, { roughness: 0.72, metalness: 0 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.055, 8, 96),
    material(ringColor, { emissive: ringColor, emissiveIntensity: 0.12 }),
  );

  pad.position.set(position[0], 0.04, position[2]);
  ring.position.set(position[0], 0.105, position[2]);
  ring.rotation.x = Math.PI / 2;
  group.add(pad, ring);

  return group;
}

function createGate(gate: Gate, theme: GameTheme): GateRenderHandle {
  const root = new THREE.Group();
  const normal = normalizedNormal(gate);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(gate.radius, 0.095, 10, 88),
    material(theme.colors.gate.frame, {
      emissive: theme.colors.gate.frame,
      emissiveIntensity: 0.04,
    }),
  );
  const innerGuide = new THREE.Mesh(
    new THREE.TorusGeometry(gate.radius * 0.72, 0.025, 8, 72),
    material(theme.colors.gate.accent, {
      emissive: theme.colors.gate.accent,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.5,
    }),
  );
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.85, 4),
    material(theme.colors.gate.accent, {
      emissive: theme.colors.gate.accent,
      emissiveIntensity: 0.08,
    }),
  );

  root.position.copy(vectorFromTuple(gate.position));
  root.quaternion.setFromUnitVectors(LOCAL_GATE_NORMAL, normal);
  arrow.position.set(0, gate.radius + 0.62, 0.04);
  arrow.rotation.z = Math.PI / 4;
  root.add(ring, innerGuide, arrow);

  return { gate, root, ring, arrow };
}

function createDroneMesh(theme: GameTheme): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.22, 0.82),
    material(theme.colors.gate.accent, { roughness: 0.4, metalness: 0.32 }),
  );
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.42, 4),
    material(theme.colors.scene.accentLight, {
      emissive: theme.colors.scene.accentLight,
      emissiveIntensity: 0.22,
    }),
  );
  const armMaterial = material(theme.colors.gate.frame, { roughness: 0.35, metalness: 0.42 });
  const armX = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.065, 0.12), armMaterial);
  const armZ = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 1.55), armMaterial);
  const propMaterial = material(theme.colors.scene.keyLight, {
    transparent: true,
    opacity: 0.68,
    roughness: 0.18,
    metalness: 0.12,
  });

  nose.position.z = 0.61;
  nose.rotation.x = Math.PI / 2;
  group.add(body, nose, armX, armZ);

  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.72, 0.72]) {
      const motor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 18),
        armMaterial,
      );
      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.018, 28), propMaterial);

      motor.position.set(x, 0.02, z);
      prop.position.set(x, 0.105, z);
      group.add(motor, prop);
    }
  }

  return group;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;

    mesh.geometry?.dispose();

    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

export function createTrainingArenaScene(
  course: Course,
  theme: GameTheme,
): TrainingArenaScene {
  const scene = new THREE.Scene();
  const gates = new Map<string, GateRenderHandle>();
  const startPad = createPad(
    course.start.position,
    course.start.padRadius,
    theme.colors.ground.startPad,
    theme.colors.gate.active,
  );
  const finishPad = createPad(
    course.finish.position,
    Math.max(2.4, course.finish.width / 2),
    theme.colors.ground.finishPad,
    theme.colors.gate.cleared,
  );
  const drone = createDroneMesh(theme);

  scene.background = color(theme.colors.scene.background);
  scene.fog = new THREE.Fog(theme.colors.sky.fog, theme.colors.sky.fogNear, theme.colors.sky.fogFar);
  scene.add(createSkyDome(theme));
  scene.add(createGround(course, theme));
  scene.add(startPad, finishPad);

  const ambient = new THREE.AmbientLight(theme.colors.scene.ambientLight, 1.45);
  const key = new THREE.DirectionalLight(theme.colors.scene.keyLight, 2.2);
  const fill = new THREE.PointLight(theme.colors.scene.accentLight, 55, 80, 1.8);

  key.position.set(-8, 18, -10);
  fill.position.set(8, 7, -6);
  scene.add(ambient, key, fill);

  for (const gate of course.gates) {
    const handle = createGate(gate, theme);

    gates.set(gate.id, handle);
    scene.add(handle.root);
  }

  scene.add(drone);

  return {
    scene,
    drone,
    gates,
    setGateState(gateId, state) {
      const handle = gates.get(gateId);

      if (handle) {
        applyGateMaterial(handle, theme, state);
      }
    },
    dispose() {
      disposeObject(scene);
      scene.clear();
    },
  };
}
