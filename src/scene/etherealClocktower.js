import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

class EtherealClocktower extends THREE.Object3D {
  constructor(scene, camera, renderer) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();
    this.clock = new THREE.Clock();
    this.font = null; // To store the loaded font

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.towerSize = { radius: 15, height: 20 };
    this.timeScale = 1.0; // Default time flow
    this.clockHandsSynced = false;
    this.orbsAligned = false;
    this.finalKeyActivated = false;
    this.holographicUI = null;

    this.setupPostProcessing();
    this.loadFont(); // Load font on initialization
  }

  async loadFont() {
    const fontLoader = new FontLoader();
    fontLoader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
      this.font = font;
      console.log('Font loaded successfully');
    }, undefined, (error) => {
      console.error('Error loading font:', error);
    });
  }

  async init() {
    await Promise.all([
      this.createTower(),
      this.addMechanisms(),
      this.addCelestialOrbs(),
      this.addInteractiveObjects()
    ]);
    this.addLighting();
    this.addStarfield();
    this.addBackgroundAudio();
    this.addTemporalAura();
    console.log('EtherealClocktower initialized', this.interactiveObjects);
    return this;
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 0.8;
    bloomPass.radius = 0;
    this.composer.addPass(bloomPass);
  }

  async createTower() {
    const floorTexture = await this.loadTexture('/assets/textures/glowing-stone.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);
    const floorGeometry = new THREE.CircleGeometry(this.towerSize.radius, 32);
    this.ensureUVs(floorGeometry, 'floor');
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      map: floorTexture, 
      roughness: 0.3, 
      metalness: 0.2,
      emissive: 0x1A1A2E,
      emissiveIntensity: 0.1 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    const wallTexture = await this.loadTexture('/assets/textures/clockwork-metal.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(3, 3);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      map: wallTexture, 
      roughness: 0.4, 
      metalness: 0.3, 
      side: THREE.DoubleSide,
      emissive: 0x333333,
      emissiveIntensity: 0.2 
    });

    const wallGeometry = new THREE.CylinderGeometry(this.towerSize.radius, this.towerSize.radius, this.towerSize.height, 32);
    this.ensureUVs(wallGeometry, 'wall');
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.y = this.towerSize.height / 2;
    this.add(wall);

    const ceilingGeometry = new THREE.CircleGeometry(this.towerSize.radius, 32);
    this.ensureUVs(ceilingGeometry, 'ceiling');
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x3333FF,
      emissiveIntensity: 0.05,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.towerSize.height;
    this.add(ceiling);
  }

  async addMechanisms() {
    try {
      const clockFace = await this.loadModel('/assets/models/clock-face.glb');
      clockFace.scale.set(5, 5, 5);
      clockFace.position.set(0, 10, 0);
      clockFace.rotation.y = Math.PI / 2;
      this.clockFace = clockFace;
      this.add(clockFace);
      this.objects.push(clockFace);
    } catch (error) {
      console.error('Error loading clock face:', error);
      const clockGeometry = new THREE.CircleGeometry(4, 32);
      this.ensureUVs(clockGeometry, 'clock fallback');
      const clockMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xFFFFFF, emissiveIntensity: 0.1 });
      const clockFace = new THREE.Mesh(clockGeometry, clockMaterial);
      clockFace.position.set(0, 10, 0);
      this.clockFace = clockFace;
      this.add(clockFace);
      this.objects.push(clockFace);
    }

    const hourHandGeometry = new THREE.BoxGeometry(0.2, 0.02, 1.5);
    this.ensureUVs(hourHandGeometry, 'hour hand');
    const hourHandMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.5 });
    this.hourHand = new THREE.Mesh(hourHandGeometry, hourHandMaterial);
    this.hourHand.position.set(0, 10.1, 0);
    this.hourHand.rotation.z = -Math.PI / 2;
    this.add(this.hourHand);
    this.makeObjectInteractive(this.hourHand, {
      name: 'hour_hand',
      type: 'puzzle',
      interactable: true,
      action: () => this.adjustTime('hour')
    });

    const minuteHandGeometry = new THREE.BoxGeometry(0.2, 0.02, 2);
    this.ensureUVs(minuteHandGeometry, 'minute hand');
    const minuteHandMaterial = new THREE.MeshStandardMaterial({ color: 0x00FFFF, emissive: 0x00FFFF, emissiveIntensity: 0.5 });
    this.minuteHand = new THREE.Mesh(minuteHandGeometry, minuteHandMaterial);
    this.minuteHand.position.set(0, 10.1, 0);
    this.minuteHand.rotation.z = -Math.PI / 2;
    this.add(this.minuteHand);
    this.makeObjectInteractive(this.minuteHand, {
      name: 'minute_hand',
      type: 'puzzle',
      interactable: true,
      action: () => this.adjustTime('minute')
    });
  }

  async addCelestialOrbs() {
    const orbTexture = await this.loadTexture('/assets/textures/celestial-glow.png');
    const orbMaterial = new THREE.MeshStandardMaterial({
      map: orbTexture,
      transparent: true,
      opacity: 0.8,
      emissive: 0xFFFFFF,
      emissiveIntensity: 1.0
    });

    const orbPositions = [
      { x: -5, y: 15, z: 0, targetAngle: Math.PI / 4 },
      { x: 5, y: 15, z: 0, targetAngle: -Math.PI / 4 },
      { x: 0, y: 15, z: 5, targetAngle: Math.PI / 3 }
    ];

    orbPositions.forEach((pos, index) => {
      const orbGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      this.ensureUVs(orbGeometry, 'celestial orb');
      const orb = new THREE.Mesh(orbGeometry, orbMaterial.clone());
      orb.position.set(pos.x, pos.y, pos.z);
      orb.userData.currentAngle = 0;
      orb.userData.targetAngle = pos.targetAngle;
      orb.userData.speed = 0.01;
      this.celestialOrbs = this.celestialOrbs || [];
      this.celestialOrbs.push(orb);

      this.makeObjectInteractive(orb, {
        name: `celestial_orb_${index}`,
        type: 'puzzle',
        interactable: true,
        action: () => this.alignOrb(orb)
      });

      this.add(orb);
    });
  }

  async addInteractiveObjects() {
    const timeDialGeometry = new THREE.TorusGeometry(1, 0.2, 32, 100);
    this.ensureUVs(timeDialGeometry, 'time dial');
    const timeDialMaterial = new THREE.MeshStandardMaterial({
      color: 0x00FF00,
      emissive: 0x00FF00,
      emissiveIntensity: 0.5
    });
    this.timeDial = new THREE.Mesh(timeDialGeometry, timeDialMaterial);
    this.timeDial.position.set(0, 5, -10);
    this.timeDial.rotation.x = Math.PI / 2;
    this.add(this.timeDial);
    this.makeObjectInteractive(this.timeDial, {
      name: 'time_dial',
      type: 'puzzle',
      interactable: true,
      action: () => this.showTimeScaleInput()
    });

    const keyGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.1);
    this.ensureUVs(keyGeometry, 'temporal key');
    const keyMaterial = new THREE.MeshStandardMaterial({ color: 0xFF00FF, emissive: 0xFF00FF, emissiveIntensity: 0.7 });
    this.temporalKey = new THREE.Mesh(keyGeometry, keyMaterial);
    this.temporalKey.position.set(-7, 7, 0);
    this.temporalKey.userData.activated = false;
    this.add(this.temporalKey);
    this.makeObjectInteractive(this.temporalKey, {
      name: 'temporal_key',
      type: 'puzzle_piece',
      interactable: true,
      action: () => this.activateKey()
    });

    const portalGeometry = new THREE.TorusGeometry(2, 0.5, 32, 100);
    this.ensureUVs(portalGeometry, 'exit portal');
    const portalMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.exitPortal = new THREE.Mesh(portalGeometry, portalMaterial);
    this.exitPortal.position.set(0, 10, 10);
    this.exitPortal.rotation.x = Math.PI / 2;
    this.exitPortal.userData.active = false;
    this.add(this.exitPortal);
    this.makeObjectInteractive(this.exitPortal, {
      name: 'exit_portal',
      type: 'puzzle',
      interactable: true,
      action: () => this.checkVictory()
    });
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x1A1A2E, 0.3);
    this.add(this.ambientLight);

    this.clockLight = new THREE.PointLight(0xFFD700, 0.5, 20);
    this.clockLight.position.set(0, 10, 0);
    this.add(this.clockLight);
  }

  addStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(100);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(100);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(100);
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.1 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.add(stars);
  }

  addTemporalAura() {
    const auraGeometry = new THREE.TorusGeometry(10, 0.5, 32, 100);
    this.ensureUVs(auraGeometry, 'temporal aura');
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x3333FF,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.temporalAura = new THREE.Mesh(auraGeometry, auraMaterial);
    this.temporalAura.position.y = 10;
    this.temporalAura.rotation.x = Math.PI / 2;
    this.add(this.temporalAura);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/ethereal-chimes.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(20);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 10, 0);
    this.add(sound);
  }

  adjustTime(type) {
    if (!this.clockHandsSynced) {
      const angle = type === 'hour' ? Math.PI / 6 : Math.PI / 30;
      const hand = type === 'hour' ? this.hourHand : this.minuteHand;
      hand.rotation.z += angle;
      eventBus.emit('showMessage', `${type} hand adjusted. Sync both to 12:00.`);

      if (Math.abs(this.hourHand.rotation.z) < 0.1 && Math.abs(this.minuteHand.rotation.z) < 0.1) {
        this.clockHandsSynced = true;
        this.triggerTimeSyncEffect();
        eventBus.emit('showMessage', 'The clock hands align! The temporal key glows.');
      }
    } else {
      eventBus.emit('showMessage', 'The clock is already synced.');
    }
  }

  alignOrb(orb) {
    if (!this.clockHandsSynced) {
      eventBus.emit('showMessage', 'Sync the clock hands first.');
      return;
    }

    orb.userData.currentAngle += orb.userData.speed;
    if (Math.abs(orb.userData.currentAngle - orb.userData.targetAngle) < 0.1) {
      orb.userData.currentAngle = orb.userData.targetAngle;
      orb.userData.speed = 0;
      this.checkOrbAlignment();
    }

    eventBus.emit('showMessage', 'Adjusting celestial orb...');
  }

  checkOrbAlignment() {
    if (this.celestialOrbs.every(orb => Math.abs(orb.userData.currentAngle - orb.userData.targetAngle) < 0.1)) {
      this.orbsAligned = true;
      this.celestialOrbs.forEach(orb => {
        orb.material.emissiveIntensity = 2.0;
      });
      this.triggerCelestialAlignment();
      eventBus.emit('showMessage', 'The orbs align! The exit portal activates.');
    }
  }

  showTimeScaleInput() {
    if (!this.font) {
      eventBus.emit('showMessage', 'Font not loaded yet. Please wait.');
      return;
    }

    if (!this.holographicUI) {
      this.holographicUI = this.createHolographicUI('Adjust Time Scale (0.5-2.0):', (value) => {
        this.timeScale = parseFloat(value) || 1.0;
        this.updateTimeEffects();
        eventBus.emit('showMessage', `Time scale set to ${this.timeScale}x.`);
      });
      this.add(this.holographicUI);
    }
  }

  createHolographicUI(prompt, onSubmit) {
    const uiGroup = new THREE.Group();
    uiGroup.position.set(0, 5, -5);

    const bgGeometry = new THREE.PlaneGeometry(4, 2);
    this.ensureUVs(bgGeometry, 'holo UI');
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000FF,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    uiGroup.add(background);

    const textGeometry = new TextGeometry(prompt, {
      font: this.font,
      size: 0.2,
      height: 0.01,
      curveSegments: 12,
      bevelEnabled: false
    });
    this.ensureUVs(textGeometry, 'holo text');
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(-1.5, 0.5, 0.01);
    uiGroup.add(textMesh);

    const inputGeometry = new THREE.PlaneGeometry(1, 0.3);
    const inputMaterial = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.8 });
    const inputPlane = new THREE.Mesh(inputGeometry, inputMaterial);
    inputPlane.position.set(0, 0, 0.01);
    uiGroup.add(inputPlane);

    // Simulate input interaction via eventBus
    eventBus.on('uiInput', (value) => {
      onSubmit(value);
      this.remove(uiGroup);
      this.holographicUI = null;
    });

    return uiGroup;
  }

  activateKey() {
    if (!this.clockHandsSynced) {
      eventBus.emit('showMessage', 'Sync the clock first.');
      return;
    }

    if (!this.temporalKey.userData.activated) {
      this.temporalKey.userData.activated = true;
      this.temporalKey.material.emissiveIntensity = 1.5;
      this.triggerKeyActivation();
      eventBus.emit('showMessage', 'The temporal key is activated! Use it to open the portal.');
    } else {
      eventBus.emit('showMessage', 'The key is already activated.');
    }
  }

  checkVictory() {
    if (this.orbsAligned && this.temporalKey.userData.activated) {
      this.exitPortal.userData.active = true;
      this.exitPortal.material.opacity = 1.0;
      eventBus.emit('showMessage', 'Victory! The Ethereal Clocktower is mastered!');
      eventBus.emit('game:win');
    } else {
      eventBus.emit('showMessage', 'The portal is dormant. Align the orbs and activate the key.');
    }
  }

  triggerTimeSyncEffect() {
    const pulseGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.ensureUVs(pulseGeometry, 'time pulse');
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.6 });
    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.position.set(0, 10, 0);
    this.add(pulse);

    let t = 0;
    const animate = () => {
      t += 0.05;
      pulse.scale.setScalar(1 + t * 2);
      pulse.material.opacity = 0.6 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(pulse);
    };
    animate();
  }

  triggerCelestialAlignment() {
    this.celestialOrbs.forEach(orb => {
      const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 5, 16);
      this.ensureUVs(beamGeometry, 'alignment beam');
      const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7 });
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.copy(orb.position);
      beam.position.y -= 5;
      beam.rotation.x = Math.PI / 2;
      this.add(beam);

      setTimeout(() => this.remove(beam), 2000);
    });
  }

  triggerKeyActivation() {
    const glowGeometry = new THREE.SphereGeometry(1, 32, 32);
    this.ensureUVs(glowGeometry, 'key glow');
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xFF00FF, transparent: true, opacity: 0.8 });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(this.temporalKey.position);
    this.add(glow);

    let t = 0;
    const animate = () => {
      t += 0.05;
      glow.scale.setScalar(1 + t);
      glow.material.opacity = 0.8 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(glow);
    };
    animate();
  }

  updateTimeEffects() {
    this.clockLight.intensity = 0.5 * this.timeScale;
    this.temporalAura.rotation.z += 0.01 * this.timeScale;
    this.celestialOrbs.forEach(orb => {
      orb.userData.speed = 0.01 * this.timeScale;
    });
  }

  update(delta) {
    const time = this.clock.getDelta() * this.timeScale;
    this.temporalAura.rotation.z += 0.01 * time;
    this.celestialOrbs.forEach(orb => {
      orb.rotation.y += orb.userData.speed * time;
      if (Math.abs(orb.userData.currentAngle - orb.userData.targetAngle) > 0.1) {
        orb.userData.currentAngle += orb.userData.speed * time;
      }
    });

    if (this.composer) {
      this.composer.render();
    }
  }

  makeObjectInteractive(object, data) {
    object.userData = { 
      ...object.userData, 
      ...data, 
      isInteractive: true,
      onHover: data.onHover || (() => {
        object.scale.multiplyScalar(1.1);
        object.material.emissiveIntensity *= 1.5;
      }),
      onUnhover: data.onUnhover || (() => {
        object.scale.multiplyScalar(1 / 1.1);
        object.material.emissiveIntensity /= 1.5;
      })
    };
    
    this.interactiveObjects.push(object);
    
    if (object instanceof THREE.Mesh && object.geometry) {
      const outlineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF, 
        side: THREE.BackSide 
      });
      const outlineMesh = new THREE.Mesh(object.geometry.clone(), outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.05);
      outlineMesh.visible = false;
      object.add(outlineMesh);
      object.userData.outlineMesh = outlineMesh;
    }
    
    console.log(`Made ${data.name} interactive with hover effects`);
  }

  loadTexture(path) {
    return new Promise((resolve) => {
      this.textureLoader.load(path, resolve, undefined, (error) => {
        console.error(`Failed to load texture: ${path}`, error);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        context.fillStyle = '#AAAAAA';
        context.fillRect(0, 0, 256, 256);
        resolve(new THREE.CanvasTexture(canvas));
      });
    });
  }

  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (!child.geometry.attributes.uv) {
                console.warn(`Model ${path} mesh missing UVs, adding fallback`, child);
                const uvs = new Float32Array(child.geometry.attributes.position.count * 2);
                child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                for (let i = 0; i < uvs.length; i += 2) {
                  uvs[i] = (i / 2) % 2;
                  uvs[i + 1] = Math.floor((i / 2) / 2) % 2;
                }
              }
            }
          });
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  ensureUVs(geometry, name) {
    if (!geometry.attributes.uv) {
      console.warn(`Geometry for ${name} missing UVs, adding fallback`);
      const uvs = new Float32Array(geometry.attributes.position.count * 2);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = (i / 2) % 2;
        uvs[i + 1] = Math.floor((i / 2) / 2) % 2;
      }
    }
  }
}

export { EtherealClocktower };