import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { clamp, mix, smooth, interval } from './story-timeline.mjs';

const materials = new Map();
const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);

function material(color, roughness = 0.95) {
  const key = `${color}-${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key);
}

function mesh(parent, geometry, surface, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function ellipsoid(parent, surface, position, scale) {
  return mesh(parent, sphereGeometry, surface, position, scale);
}

function mergeStaticChildren(parent) {
  const batches = new Map();
  parent.children.filter(child => child.isMesh && !child.isInstancedMesh).forEach(child => {
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(child);
  });
  batches.forEach((objects, surface) => {
    if (objects.length < 2) return;
    const geometries = objects.map(object => {
      object.updateMatrix();
      return object.geometry.clone().applyMatrix4(object.matrix);
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(item => item.dispose());
    if (!geometry) return;
    objects.forEach(object => parent.remove(object));
    mesh(parent, geometry, surface);
  });
}

function branch(parent, points, radius, surface, segments = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 6, false), surface);
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pleatedRobe(topRadius, bottomRadius, height, color, folds = 26) {
  const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 64, 18, true);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const horizontal = positions.getX(index);
    const depth = positions.getZ(index);
    const vertical = positions.getY(index);
    const angle = Math.atan2(depth, horizontal);
    const pleat = 1 + Math.sin(angle * folds + vertical * 1.3) * 0.035 + Math.cos(angle * 9) * 0.02;
    positions.setXYZ(index, horizontal * pleat, vertical, depth * pleat * 0.82);
  }
  geometry.computeVertexNormals();
  const surface = material(color).clone();
  surface.side = THREE.DoubleSide;
  return { geometry, surface, rest: new Float32Array(positions.array) };
}

function makeMonk({ elder = true, robeColor = '#c67432', skinColor = '#ac7958' } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.38;
  group.add(body);
  const skin = material(skinColor);
  const robe = material(robeColor);
  const shadowRobe = material('#9e4e26');
  const hair = material(elder ? '#e5e0ca' : '#332c21');
  const hairShadow = material(elder ? '#c7c4b0' : '#27271f');
  const torso = new THREE.Group();
  body.add(torso);
  ellipsoid(torso, robe, [0, 0.51, -0.02], [0.36, 0.57, 0.23]);
  const chestCloth = pleatedRobe(0.28, 0.4, 0.93, robeColor, 18);
  const chest = mesh(torso, chestCloth.geometry, chestCloth.surface, [0, 0.45, 0]);
  chest.rotation.z = -0.055;
  branch(torso, [[-0.31, 0.94, 0.07], [-0.22, 0.75, 0.25], [0.2, 0.36, 0.25], [0.31, 0.04, 0.1]], 0.047, material('#d38b45'));
  branch(torso, [[-0.27, 0.92, 0.13], [-0.08, 0.51, 0.29], [0.24, 0.16, 0.2]], 0.025, shadowRobe);
  ellipsoid(torso, skin, [0, 0.96, 0], [0.095, 0.2, 0.095]);
  const head = new THREE.Group();
  head.position.set(0, 1.18, 0.035);
  torso.add(head);
  ellipsoid(head, skin, [0, 0.12, 0], [0.205, 0.28, 0.18]);
  ellipsoid(head, hairShadow, [0, 0.19, -0.055], [0.225, 0.275, 0.17]);
  ellipsoid(head, skin, [0, 0.105, 0.064], [0.182, 0.245, 0.155]);
  ellipsoid(head, skin, [0, 0.052, 0.23], [0.035, 0.072, 0.052]);
  ellipsoid(head, skin, [0, -0.005, 0.26], [0.047, 0.03, 0.029]);
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, [side * 0.195, 0.05, 0.013], [0.04, 0.087, 0.035]);
    ellipsoid(head, material('#895b43'), [side * 0.212, 0.05, 0.04], [0.013, 0.045, 0.008]);
    ellipsoid(head, material('#513f30'), [side * 0.077, 0.106, 0.201], [0.042, 0.015, 0.01]);
    ellipsoid(head, material('#1f2920'), [side * 0.076, 0.102, 0.211], [0.014, 0.012, 0.006]);
    branch(head, [[side * 0.033, 0.153, 0.202], [side * 0.077, 0.166, 0.198], [side * 0.12, 0.15, 0.185]], 0.013, hair, 8);
    if (elder) {
      const moustache = ellipsoid(head, hair, [side * 0.049, -0.035, 0.221], [0.074, 0.027, 0.035]);
      moustache.rotation.z = side * -0.28;
    }
  }
  for (let wrinkle = 0; wrinkle < 3; wrinkle += 1) {
    const vertical = 0.225 + wrinkle * 0.028;
    branch(head, [[-0.09, vertical, 0.191], [0, vertical - 0.01, 0.205], [0.09, vertical, 0.191]], 0.0022, material('#946d50'), 12);
  }
  const beard = new THREE.Group();
  head.add(beard);
  if (elder) {
    const beardGeometry = new THREE.LatheGeometry([
      new THREE.Vector2(0.014, -0.54), new THREE.Vector2(0.065, -0.46), new THREE.Vector2(0.13, -0.27),
      new THREE.Vector2(0.155, -0.1), new THREE.Vector2(0.12, 0)
    ], 24);
    mesh(beard, beardGeometry, hair, [0, -0.035, 0.11], [1, 1, 0.6]);
    for (let strand = 0; strand < 22; strand += 1) {
      const horizontal = (strand / 21 - 0.5) * 0.27;
      const length = 0.35 + (1 - Math.abs(horizontal) / 0.14) * 0.15;
      branch(beard, [[horizontal, -0.06, 0.21], [horizontal * 0.95, -0.23, 0.215], [horizontal * 0.4, -length, 0.15]], 0.008, strand % 3 ? hair : hairShadow, 10);
    }
    for (let lock = 0; lock < 18; lock += 1) {
      const angle = 0.2 + lock / 17 * Math.PI * 1.75;
      const horizontal = Math.sin(angle) * 0.19;
      const depth = Math.cos(angle) * -0.15;
      branch(head, [[horizontal * 0.75, 0.33, depth], [horizontal * 1.2, 0.11, depth - 0.035], [horizontal * 1.25, -0.11, depth], [horizontal * 1.05, -0.22, depth + 0.02]], 0.025, lock % 3 ? hair : hairShadow, 16);
    }
  }
  const limbs = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.31, 0.81, 0);
    torso.add(shoulder);
    ellipsoid(shoulder, side < 0 ? robe : skin, [0, -0.17, 0], [0.09, 0.25, 0.092]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.39;
    shoulder.add(elbow);
    ellipsoid(elbow, skin, [0, -0.18, 0], [0.064, 0.225, 0.065]);
    const hand = new THREE.Group();
    hand.position.y = -0.38;
    elbow.add(hand);
    ellipsoid(hand, skin, [0, -0.055, 0.006], [0.055, 0.085, 0.027]);
    for (let finger = 0; finger < 4; finger += 1) {
      const digit = ellipsoid(hand, skin, [(finger - 1.5) * 0.024, -0.139 + Math.abs(finger - 1.5) * 0.011, 0.008], [0.009, 0.05, 0.012]);
      digit.rotation.z = (finger - 1.5) * 0.09;
    }
    const thumb = ellipsoid(hand, skin, [side * 0.069, -0.06, 0.015], [0.016, 0.045, 0.014]);
    thumb.rotation.z = side * 0.5;
    const hip = new THREE.Group();
    hip.position.set(side * 0.15, 0, 0);
    body.add(hip);
    ellipsoid(hip, robe, [0, -0.29, 0], [0.17, 0.37, 0.18]);
    const knee = new THREE.Group();
    knee.position.y = -0.6;
    hip.add(knee);
    ellipsoid(knee, robe, [0, -0.2, 0], [0.115, 0.27, 0.13]);
    ellipsoid(knee, skin, [0, -0.49, 0.035], [0.065, 0.15, 0.075]);
    const foot = new THREE.Group();
    foot.position.set(0, -0.63, 0.075);
    knee.add(foot);
    ellipsoid(foot, skin, [0, 0, 0.03], [0.09, 0.052, 0.17]);
    for (let toe = 0; toe < 5; toe += 1) ellipsoid(foot, skin, [(toe - 2) * 0.033, 0, 0.18 - Math.abs(toe - 1) * 0.006], [0.022, 0.034, 0.042]);
    limbs.push({ side, shoulder, elbow, hand, hip, knee, foot });
  }
  const skirtShape = pleatedRobe(0.34, 0.48, 1.07, robeColor);
  const skirt = mesh(body, skirtShape.geometry, skirtShape.surface, [0, -0.37, 0]);
  const seatedCloth = ellipsoid(body, robe, [0, -0.13, 0.2], [0.7, 0.22, 0.46]);
  seatedCloth.visible = false;
  for (let fold = 0; fold < 9; fold += 1) {
    const pleat = branch(seatedCloth, [[-0.8 + fold * 0.2, 0.65, -0.3], [-0.5 + fold * 0.13, 0.95, 0.2], [-0.3 + fold * 0.08, 0.75, 0.7]], 0.012, shadowRobe, 8);
    pleat.castShadow = false;
  }
  const staff = new THREE.Group();
  branch(staff, [[0, 0, 0], [0.014, 0.7, 0.01], [-0.008, 1.7, -0.01], [0.035, 2.38, 0.02]], 0.027, material('#6b5030'));
  group.add(staff);
  const bowl = new THREE.Group();
  mesh(bowl, new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), material('#9d7a39', 0.45));
  mesh(bowl, new THREE.TorusGeometry(0.16, 0.015, 6, 24), material('#c49e5f', 0.45)).rotation.x = Math.PI / 2;
  group.add(bowl);

  function pose({ stride = 0, walking = 0, sit = 0, help = 0, teach = 0, turn = 0 } = {}) {
    group.rotation.y = turn;
    body.position.y = mix(1.38, 0.49, sit) + Math.abs(Math.sin(stride)) * 0.045 * walking;
    torso.rotation.x = help * 0.27;
    torso.rotation.z = Math.sin(stride) * 0.02 * walking;
    head.rotation.x = help * 0.2 + sit * 0.055 - teach * 0.04;
    head.rotation.y = teach * Math.sin(teach * 6) * 0.16;
    beard.rotation.x = Math.sin(stride + 0.3) * 0.035 * walking;
    limbs.forEach(({ side, shoulder, elbow, hand, hip, knee, foot }) => {
      const phase = stride + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(phase) * walking;
      hip.rotation.set(swing * 0.43 - sit * 1.35, side * sit * 0.32, side * sit * 0.67);
      knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.65 * walking + sit * 1.68;
      foot.rotation.x = -knee.rotation.x * 0.25;
      shoulder.rotation.set(-swing * 0.25 - help * 1.05 - sit * 0.32, 0, side * (0.13 + sit * 0.32));
      elbow.rotation.set(-0.14 - help * 0.5 - sit * 0.8, 0, 0);
      hand.rotation.set(0, 0, 0);
      if (teach && side > 0) {
        shoulder.rotation.x -= teach * 0.8;
        shoulder.rotation.z -= teach * 0.4;
        elbow.rotation.x -= teach * (0.3 + Math.sin(teach * 10) * 0.32);
        hand.rotation.z = teach * -0.4;
      }
    });
    skirt.visible = sit < 0.98;
    skirt.scale.y = 1 - sit * 0.8;
    skirt.position.y = -0.37 + sit * 0.32;
    seatedCloth.visible = sit > 0.05;
    seatedCloth.scale.set(0.7 * sit, 0.22 * sit, 0.46 * sit);
    const positions = skirtShape.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const offset = index * 3;
      const vertical = skirtShape.rest[offset + 1];
      const influence = clamp((0.54 - vertical) / 1.07);
      positions.setXYZ(index, skirtShape.rest[offset] + Math.sin(stride + vertical * 3) * 0.035 * influence * walking, vertical, skirtShape.rest[offset + 2] + Math.sin(stride) * influence * 0.14 * walking);
    }
    positions.needsUpdate = true;
    staff.visible = sit < 0.1 && help < 0.1;
    staff.position.set(-0.52, 0.02 + Math.max(0, Math.sin(stride + 1)) * 0.07 * walking, 0.2 + Math.sin(stride) * 0.15 * walking);
    staff.rotation.x = Math.sin(stride) * 0.055 * walking;
    bowl.visible = help > 0.02;
    bowl.scale.setScalar(smooth(interval(help, 0, 0.18)));
    group.updateMatrixWorld(true);
    const handPosition = limbs[1].hand.localToWorld(new THREE.Vector3(0, -0.16, 0.035));
    bowl.position.copy(group.worldToLocal(handPosition));
  }
  [head, beard, torso, ...limbs.flatMap(limb => [limb.shoulder, limb.elbow, limb.hand, limb.hip, limb.knee, limb.foot])].forEach(mergeStaticChildren);
  pose();
  return { group, pose };
}

function makeTree(parent, horizontal, depth, size, random) {
  const tree = new THREE.Group();
  tree.position.set(horizontal, 0, depth);
  tree.scale.setScalar(size);
  parent.add(tree);
  const bark = material('#64563d');
  const leaves = new THREE.InstancedMesh(stoneGeometry, material('#ffffff'), 7 * 36);
  const leafTransform = new THREE.Object3D();
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  tree.add(leaves);
  branch(tree, [[0, 0, 0], [0.14, 1.1, 0], [-0.02, 2.5, 0.08], [0.16, 4.5, 0.03]], 0.22, bark);
  for (let arm = 0; arm < 7; arm += 1) {
    const angle = arm / 7 * Math.PI * 2;
    const reach = 1.4 + random() * 1.1;
    const endpoint = [Math.cos(angle) * reach, 3.6 + random(), Math.sin(angle) * reach];
    branch(tree, [[0, 1.4 + random(), 0], [endpoint[0] * 0.45, 3, endpoint[2] * 0.45], endpoint], 0.08, bark);
    for (let cluster = 0; cluster < 36; cluster += 1) {
      const azimuth = random() * Math.PI * 2;
      const reach = Math.sqrt(random()) * 1.3;
      const lift = Math.sqrt(Math.max(0, 1 - reach * reach / 1.69)) * 0.7;
      leafTransform.position.set(endpoint[0] + Math.cos(azimuth) * reach, endpoint[1] + lift + random() * 0.24, endpoint[2] + Math.sin(azimuth) * reach);
      leafTransform.scale.set(0.32 + random() * 0.22, 0.18 + random() * 0.16, 0.3 + random() * 0.23);
      leafTransform.rotation.set(random(), random() * 6, random());
      leafTransform.updateMatrix();
      leaves.setMatrixAt(arm * 36 + cluster, leafTransform.matrix);
      leaves.setColorAt(arm * 36 + cluster, new THREE.Color(['#3f5735', '#506638', '#6b7b42', '#879150'][cluster % 4]));
    }
    if (arm % 2 === 0) branch(tree, [endpoint, [endpoint[0] * 0.9, 2.1, endpoint[2] * 0.9], [endpoint[0] * 0.84, 0.2, endpoint[2] * 0.86]], 0.015, bark);
  }
}

function makeMountain(parent, horizontal, depth, width, height, surface, random) {
  const geometry = new THREE.ConeGeometry(width, height, 7, 3);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) < height * 0.49) positions.setY(index, positions.getY(index) + (random() - 0.5) * height * 0.16);
  }
  geometry.computeVertexNormals();
  return mesh(parent, geometry, surface, [horizontal, height / 2 - 2, depth], [1, 1, 0.8]);
}

function makePhone(parent) {
  const phone = new THREE.Group();
  parent.add(phone);
  const shape = new THREE.Shape();
  const width = 1.24;
  const height = 2.45;
  const radius = 0.18;
  shape.moveTo(-width / 2 + radius, -height / 2);
  shape.lineTo(width / 2 - radius, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  shape.lineTo(width / 2, height / 2 - radius);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  shape.lineTo(-width / 2 + radius, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  shape.lineTo(-width / 2, -height / 2 + radius);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
  const phoneBody = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 3, steps: 1 });
  mesh(phone, phoneBody, material('#423824', 0.4));
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = mesh(phone, new THREE.PlaneGeometry(1.17, 2.37), new THREE.MeshBasicMaterial({ map: texture }), [0, 0, 0.141]);
  screen.castShadow = false;
  function paint(logo) {
    context.fillStyle = '#f4ecd9';
    context.fillRect(0, 0, 512, 1024);
    context.strokeStyle = '#c3a669';
    context.lineWidth = 2;
    context.strokeRect(28, 28, 456, 968);
    if (logo) context.drawImage(logo, 194, 104, 124, 184);
    context.textAlign = 'center';
    context.fillStyle = '#6f2724';
    context.font = '46px Georgia';
    context.fillText('Guru Vandan', 256, 361);
    context.fillStyle = '#796340';
    context.font = '18px sans-serif';
    context.fillText('A SACRED SPACE, ALWAYS CLOSE', 256, 407);
    const labels = ['Satsang', 'Meditation', 'Aarti', 'Guru Vani'];
    labels.forEach((label, index) => {
      const top = 488 + index * 94;
      context.fillStyle = index === 0 ? '#e4d1ae' : '#eadfc8';
      context.fillRect(57, top, 398, 74);
      context.fillStyle = '#533c26';
      context.font = '27px Georgia';
      context.fillText(label, 256, top + 45);
    });
    context.font = '18px sans-serif';
    context.fillText('REMEMBER. REFLECT. RECONNECT.', 256, 948);
    texture.needsUpdate = true;
  }
  paint();
  return { group: phone, paint };
}

export function createStoryScene(canvas, onAssetReady) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8d5a9');
  scene.fog = new THREE.Fog('#e8d5a9', 28, 95);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 170);
  scene.add(new THREE.HemisphereLight('#fff1dc', '#555b43', 1.7));
  const sun = new THREE.DirectionalLight('#ffe9c5', 2.7);
  sun.position.set(-5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 40;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#e2eee2', 0.7);
  fill.position.set(6, 4, -8);
  scene.add(fill);
  const random = seededRandom(3904);
  const landscape = new THREE.Group();
  scene.add(landscape);
  const ground = mesh(landscape, new THREE.PlaneGeometry(160, 100), material('#bbaa7c'), [35, -0.05, -22]);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const river = mesh(landscape, new THREE.PlaneGeometry(145, 11), material('#78958d', 0.3), [40, -0.015, -7]);
  river.rotation.x = -Math.PI / 2;
  river.castShadow = false;
  const ripples = new THREE.Group();
  landscape.add(ripples);
  for (let ripple = 0; ripple < 80; ripple += 1) {
    const wave = mesh(ripples, new THREE.PlaneGeometry(0.3 + random() * 2.8, 0.025), new THREE.MeshBasicMaterial({ color: '#c6c7a3', transparent: true, opacity: 0.38 }), [-30 + random() * 150, 0.005, -3 - random() * 8]);
    wave.rotation.x = -Math.PI / 2;
    wave.castShadow = false;
    wave.userData.original = wave.position.x;
  }
  for (let row = 0; row < 3; row += 1) {
    for (let mountain = 0; mountain < 22; mountain += 1) {
      const horizontal = -40 + mountain * 8 + random() * 5;
      const depth = -29 - row * 15;
      const height = 5 + random() * 9 + row * 1.5;
      makeMountain(landscape, horizontal, depth, 6 + random() * 7, height, material(['#647c68', '#849988', '#b0baa8'][row]), random);
      if (row > 0 && height > 13) makeMountain(landscape, horizontal, depth - 0.05, 1.5, 3.5, material('#ede6d1'), random).position.y = height - 3.55;
    }
  }
  const path = mesh(landscape, new THREE.PlaneGeometry(145, 3.5), material('#d8bd89'), [38, -0.005, 1]);
  path.rotation.x = -Math.PI / 2;
  path.castShadow = false;
  for (let pebble = 0; pebble < 155; pebble += 1) {
    const horizontal = -12 + random() * 110;
    const depth = random() > 0.5 ? 2.4 + random() * 3.2 : -1.3 - random() * 1.3;
    const size = 0.045 + random() * 0.22;
    const rock = mesh(landscape, stoneGeometry, material(['#8a835f', '#aea078', '#797759'][pebble % 3]), [horizontal, size * 0.3, depth], [size * 1.4, size * 0.8, size]);
    rock.rotation.y = random() * 6;
  }
  const grassGeometry = new THREE.ConeGeometry(0.055, 0.45, 3);
  const grasses = new THREE.InstancedMesh(grassGeometry, material('#797843'), 500);
  const transform = new THREE.Object3D();
  for (let blade = 0; blade < 500; blade += 1) {
    transform.position.set(-12 + random() * 110, 0.1, 2.8 + random() * 4);
    transform.rotation.set((random() - 0.5) * 0.4, random() * 6, (random() - 0.5) * 0.4);
    transform.scale.setScalar(0.5 + random());
    transform.updateMatrix();
    grasses.setMatrixAt(blade, transform.matrix);
  }
  landscape.add(grasses);
  const village = new THREE.Group();
  village.position.x = 18;
  landscape.add(village);
  for (let house = 0; house < 4; house += 1) {
    const building = new THREE.Group();
    building.position.set(-5 + house * 3.7, 0, -4.5 - (house % 2) * 2);
    village.add(building);
    mesh(building, new THREE.BoxGeometry(2.4, 1.7, 1.9), material('#c3a77d'), [0, 0.85, 0]);
    const roof = mesh(building, new THREE.ConeGeometry(1.9, 1.1, 4), material('#8e6b40'), [0, 2.15, 0], [1, 1, 0.9]);
    roof.rotation.y = Math.PI / 4;
    mesh(building, new THREE.PlaneGeometry(0.55, 1.17), material('#564734'), [0, 0.58, 0.956]);
    for (const side of [-1, 1]) {
      mesh(building, new THREE.BoxGeometry(0.07, 1.25, 0.08), material('#846240'), [side * 0.31, 0.61, 0.99]);
      mesh(building, new THREE.BoxGeometry(0.32, 0.34, 0.07), material('#746349'), [side * 0.8, 1.06, 0.96]);
      mesh(building, new THREE.BoxGeometry(0.025, 0.37, 0.08), material('#aa8a5c'), [side * 0.8, 1.06, 1.01]);
    }
    mesh(building, new THREE.BoxGeometry(0.7, 0.08, 0.1), material('#846240'), [0, 1.23, 0.99]);
  }
  makeTree(village, -3, -1.7, 0.78, random);
  const villager = makeMonk({ elder: false, robeColor: '#baae89', skinColor: '#8d694d' });
  villager.group.position.set(19.1, 0, 0.85);
  villager.group.scale.setScalar(0.81);
  scene.add(villager.group);
  villager.pose({ sit: 1, turn: -0.7 });
  const cave = new THREE.Group();
  cave.position.set(38, 0, -1.1);
  landscape.add(cave);
  const caveBack = mesh(cave, new THREE.SphereGeometry(1, 24, 16), material('#514b38'), [0, 1.75, -0.9], [3.1, 2.4, 0.6]);
  caveBack.castShadow = false;
  for (let stone = 0; stone < 13; stone += 1) {
    const angle = stone / 12 * Math.PI;
    mesh(cave, stoneGeometry, material(['#938970', '#a2997c', '#807b64'][stone % 3]), [Math.cos(angle) * 2.5, Math.sin(angle) * 2.8 + 0.3, -0.2], [0.8, 0.8, 0.9]);
  }
  const meditationMat = mesh(landscape, new THREE.CylinderGeometry(1.05, 1.1, 0.06, 32), material('#9d7245'), [38, 0.03, 0.8]);
  meditationMat.receiveShadow = true;
  makeTree(landscape, 42, -2.1, 0.8, random);
  const teaching = new THREE.Group();
  teaching.position.set(58, 0, 0);
  landscape.add(teaching);
  makeTree(teaching, 0.2, -2.3, 1.7, random);
  const platform = mesh(teaching, new THREE.CylinderGeometry(1.2, 1.25, 0.18, 32), material('#a59067'), [0, 0.09, 0.7]);
  platform.receiveShadow = true;
  const disciples = [];
  for (let disciple = 0; disciple < 5; disciple += 1) {
    const angle = -0.9 + disciple * 0.43;
    const person = makeMonk({ elder: false, robeColor: ['#d6cdb3', '#a8997b', '#b9b7a1', '#b18e64', '#d2b895'][disciple], skinColor: ['#a47b58', '#986a4b', '#b58d68'][disciple % 3] });
    person.group.position.set(58 + Math.sin(angle) * 2.4, 0, 0.7 + Math.cos(angle) * 2.1);
    person.group.rotation.y = Math.PI + angle;
    person.group.scale.setScalar(0.78);
    person.pose({ sit: 1, turn: Math.PI + angle });
    scene.add(person.group);
    disciples.push(person);
  }
  const phone = makePhone(scene);
  phone.group.position.set(78, 1.6, 0.5);
  const lightThreads = new THREE.Group();
  scene.add(lightThreads);
  for (let thread = 0; thread < 7; thread += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(60, 1 + thread * 0.1, 1), new THREE.Vector3(66, 3.1 + thread * 0.16, -1.8), new THREE.Vector3(73, 1.9 + thread * 0.12, 0), new THREE.Vector3(78, 1.6, 0.5)
    ]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#f5d086', transparent: true, opacity: 0.6 }));
    line.userData.curve = curve;
    lightThreads.add(line);
  }
  const monk = makeMonk();
  scene.add(monk.group);
  const haloGeometry = new THREE.TorusGeometry(0.76, 0.006, 6, 80);
  const halo = mesh(scene, haloGeometry, new THREE.MeshBasicMaterial({ color: '#efca80', transparent: true, opacity: 0.7 }), [38, 2, -0.1]);
  halo.castShadow = false;
  const logo = new Image();
  logo.onload = () => { phone.paint(logo); onAssetReady(); };
  logo.src = '/assets/assets/images/chakra_logo.png';
  mergeStaticChildren(landscape);
  let width = 1;
  let height = 1;
  let lastSample;

  function resize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(sample) {
    lastSample = sample;
    const mobile = width / height < 0.9;
    monk.group.position.set(sample.position, sample.elevation, 0.75);
    monk.pose(sample);
    const meditating = sample.chapter === 2;
    halo.visible = meditating && sample.sit > 0.4;
    halo.position.set(sample.position, 1.77, 0.31);
    halo.scale.setScalar(0.5 + sample.sit * 0.5);
    villager.pose({ sit: 1, help: sample.chapter === 1 ? sample.help * 0.6 : 0, turn: -0.85 });
    const appFocus = sample.chapter === 4 ? sample.reveal : 0;
    phone.group.visible = sample.chapter === 4;
    phone.group.position.y = mix(-0.8, 1.68, appFocus);
    phone.group.rotation.set(0.02 * (1 - appFocus), mix(-0.55, 0.14, appFocus), -0.035 * (1 - appFocus));
    phone.group.scale.setScalar(0.6 + appFocus * 0.6);
    if (sample.chapter === 4) {
      monk.group.position.x = mix(sample.position, 75.8, appFocus);
      monk.pose({ ...sample, teach: Math.max(sample.teach, appFocus), walking: sample.walking, turn: mix(sample.turn, 0.6, appFocus) });
    }
    lightThreads.visible = sample.chapter === 4;
    lightThreads.children.forEach(line => line.geometry.setDrawRange(0, Math.max(0, Math.floor(sample.reveal * 101))));
    const twilight = smooth(interval(sample.progress, 0.58, 0.84)) * (1 - smooth(interval(sample.progress, 0.86, 1)));
    const skyColor = new THREE.Color('#e8d5a9').lerp(new THREE.Color('#77958c'), twilight * 0.48);
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
    const destinationX = sample.chapter === 4 ? mix(sample.position, 78, appFocus) : sample.position;
    const seated = sample.sit;
    const orbit = sample.chapter === 3 ? sample.teach * 0.55 : sample.chapter === 2 ? sample.sit * -0.25 : 0;
    const cameraDistance = mobile ? 14 : 10.5;
    const targetX = destinationX - (mobile ? appFocus * 1.15 : 2.05);
    const targetY = mobile ? 2.75 + appFocus * 0.45 - seated * 0.5 : 1.35 - seated * 0.15;
    camera.position.set(targetX + 3.0 + orbit, 3.8 - seated * 0.55 + (mobile ? 0.65 : 0), cameraDistance);
    camera.lookAt(targetX, targetY, 0.25);
    sun.position.set(destinationX - 6, 11, 7);
    sun.target.position.set(destinationX, 0, 0);
    ripples.children.forEach((wave, index) => { wave.position.x = wave.userData.original + Math.sin(sample.progress * 60 + index) * 0.22; });
    renderer.render(scene, camera);
    canvas.dataset.frame = String(sample.frame);
    canvas.dataset.chapter = String(sample.chapter);
    canvas.dataset.stride = sample.stride.toFixed(5);
    canvas.dataset.handPose = sample.teach.toFixed(5);
    canvas.dataset.renderCount = String(Number(canvas.dataset.renderCount || 0) + 1);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
  }

  function dispose() {
    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(surface => { surface.map?.dispose(); surface.dispose(); });
      }
    });
    renderer.dispose();
  }
  return { resize, render, dispose, redraw: () => lastSample && render(lastSample) };
}
