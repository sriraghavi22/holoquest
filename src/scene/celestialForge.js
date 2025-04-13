import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { eventBus } from '../game/eventBus';

class CelestialForge extends THREE.Object3D {
  constructor(scene) {
    super();
    this.scene = scene;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new THREE.TextureLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/assets/draco/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.platformSize = { radius: 10, height: 0.5 };
    this.starFragmentsCollected = 0;
    this.correctConstellationOrder = [0xFF4500, 0x00CED1, 0xFFD700];
    this.constellationSequence = [];
    this.anvilActive = false;
    this.bladeForged = false;
    this.crucibleFilled = false;
    this.quenchReady = false;
    this.constellationAligned = false;
    this.starFragments = [];
    this.constellationNodes = [];
    this.nebulaParticles = null;
    this.cosmicAura = null;
  }

  async init() {
    await Promise.all([
      this.createPlatform(),
      this.addForgeElements(),
      this.addConstellationNodes(),
      this.addInteractiveObjects()
    ]);
    this.addLighting();
    this.addNebulaParticles();
    this.addBackgroundAudio();
    this.addCosmicAura();
    this.addFog();
    console.log('CelestialForge initialized', this.interactiveObjects);
    return this;
  }

  addFog() {
    const fog = new THREE.Fog(0x1A1A2E, 5, 25);
    this.scene.fog = fog;
  }

  getInteractiveObjects() {
    console.log('Interactive objects:', this.interactiveObjects.map(o => o.userData.name));
    return this.interactiveObjects;
  }

  async createPlatform() {
    const platformTexture = await this.loadTexture('/assets/textures/obsidian-star.png');
    platformTexture.wrapS = THREE.RepeatWrapping;
    platformTexture.wrapT = THREE.RepeatWrapping;
    platformTexture.repeat.set(5, 5);
    const platformGeometry = new THREE.CylinderGeometry(this.platformSize.radius, this.platformSize.radius, this.platformSize.height, 64);
    this.ensureUVs(platformGeometry, 'platform');
    const platformMaterial = new THREE.MeshStandardMaterial({
      map: platformTexture,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x1A1A2E,
      emissiveIntensity: 0.2
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = this.platformSize.height / 2;
    this.add(platform);

    const edgeTexture = await this.loadTexture('/assets/textures/stellar-runes.jpg');
    const edgeGeometry = new THREE.CylinderGeometry(this.platformSize.radius + 0.2, this.platformSize.radius + 0.2, 0.8, 64);
    this.ensureUVs(edgeGeometry, 'platform edge');
    const edgeMaterial = new THREE.MeshStandardMaterial({
      map: edgeTexture,
      emissive: 0xFF4500,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.y = 0.4;
    this.add(edge);
  }

  async addForgeElements() {
    // Anvil
    try {
      const anvil = await this.loadModel('/assets/models/cosmic-anvil.glb');
      console.log('Anvil model loaded successfully:', anvil);
      anvil.scale.set(0.004, 0.004, 0.004); // Your chosen scale
      anvil.position.set(0, 2, 3); // Your chosen position
      anvil.userData.initialScale = new THREE.Vector3(0.005, 0.005, 0.005);

      this.anvil = anvil;
      this.add(anvil); // Add to CelestialForge only
      this.objects.push(anvil);
      this.makeObjectInteractive(anvil, {
        name: 'cosmic_anvil',
        type: 'puzzle',
        interactable: true,
        action: () => this.handleAnvilInteraction()
      });
    } catch (error) {
      console.error('Error loading anvil model at /assets/models/cosmic-anvil.glb:', error);
      const anvilGeometry = new THREE.BoxGeometry(2, 1, 1);
      this.ensureUVs(anvilGeometry, 'anvil fallback');
      const anvilMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
      this.anvil = new THREE.Mesh(anvilGeometry, anvilMaterial);
      this.anvil.position.set(0, 0.5, 0);
      this.anvil.userData.initialScale = new THREE.Vector3(1, 1, 1);
      this.add(this.anvil);
      this.objects.push(this.anvil);
      this.makeObjectInteractive(this.anvil, {
        name: 'cosmic_anvil',
        type: 'puzzle',
        interactable: true,
        action: () => this.handleAnvilInteraction()
      });
      console.log('Anvil fallback created at (0, 0.5, 0)');
    }

    // Crucible
    const crucibleGeometry = new THREE.CylinderGeometry(0.8, 1, 1.5, 32);
    this.ensureUVs(crucibleGeometry, 'crucible');
    const crucibleMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF4500,
      emissive: 0xFF4500,
      emissiveIntensity: 0.2,
      metalness: 0.7,
      roughness: 0.3
    });
    this.crucible = new THREE.Mesh(crucibleGeometry, crucibleMaterial);
    this.crucible.position.set(-3, 0.75, 3);
    this.crucible.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.crucible);
    this.objects.push(this.crucible);
    this.makeObjectInteractive(this.crucible, {
      name: 'star_crucible',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (this.starFragmentsCollected === 3 && !this.crucibleFilled) {
          this.fillCrucible();
          eventBus.emit('showMessage', 'The crucible ignites with stellar flame! Awaken the anvil.');
        } else if (!this.crucibleFilled) {
          eventBus.emit('showMessage', `Seek ${3 - this.starFragmentsCollected} more celestial shards for the crucible.`);
        } else {
          eventBus.emit('showMessage', 'The crucible hums with power. Awaken the anvil.');
        }
      }
    });

    // Quench Pool
    const poolRadius = 1.5;
    const poolDepth = 0.5;

    const quenchGeometry = new THREE.CylinderGeometry(poolRadius, poolRadius, poolDepth, 32);
    this.ensureUVs(quenchGeometry, 'quench');
    const quenchMaterial = new THREE.MeshStandardMaterial({
      color: 0x00CED1,
      transparent: true,
      opacity: 0.7,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00CED1,
      emissiveIntensity: 0.5
    });

    this.quenchPool = new THREE.Mesh(quenchGeometry, quenchMaterial);
    this.quenchPool.position.set(3, poolDepth / 2, -3);

    // Water surface
    const waterGeometry = new THREE.CircleGeometry(poolRadius, 32);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x40E0D0,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      emissive: 0x40E0D0,
      emissiveIntensity: 0.3
    });
    const waterSurface = new THREE.Mesh(waterGeometry, waterMaterial);
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.y = poolDepth / 2 + 0.01; // Slightly above pool surface
    this.quenchPool.add(waterSurface);

    // Glow effect
    const glowGeometry = new THREE.CylinderGeometry(poolRadius + 0.1, poolRadius + 0.1, poolDepth + 0.1, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.quenchPool.add(glow);

    // Ripple effect
    const rippleGeometry = new THREE.CircleGeometry(poolRadius - 0.1, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = poolDepth / 2 + 0.02;
    this.quenchPool.add(ripple);

    // Animate ripples with control
    this.rippleActive = true;
    const animateRipples = () => {
      let scale = 0.5;
      const animate = () => {
        if (!this.rippleActive) return;
        scale += 0.02;
        ripple.scale.set(scale, scale, 1);
        ripple.material.opacity = 0.3 * (1 - scale / 2);
        if (scale >= 1.5) scale = 0.5;
        requestAnimationFrame(animate);
      };
      animate();
    };
    animateRipples();

    // Add to scene once
    this.add(this.quenchPool);
    this.objects.push(this.quenchPool);

    // Point light for glow
    const poolLight = new THREE.PointLight(0x00CED1, 1, 5);
    poolLight.position.set(3, 1, -3);
    this.add(poolLight);

    this.quenchPool.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.makeObjectInteractive(this.quenchPool, {
      name: 'quench_pool',
      type: 'puzzle',
      interactable: true,
      action: () => {
        if (!this.bladeForged) {
          eventBus.emit('showMessage', 'The cosmic waters lie still, awaiting a star-forged blade.');
        } else if (!this.quenchReady) {
          eventBus.emit('showMessage', 'The blade burns with celestial heat. Let it cool.');
        } else {
          this.quenchBlade();
          eventBus.emit('showMessage', 'The blade drinks the stellar essence! Answer the riddle to claim your prize.');
          this.showFinalRiddleInput();
          this.triggerQuenchGlow(); // Visual feedback
        }
      }
    });
  }

  triggerQuenchGlow() {
    let t = 0;
    const initialIntensity = 0.5;
    const animate = () => {
      t += 0.05;
      this.quenchPool.material.emissiveIntensity = initialIntensity + Math.sin(t * 5) * 0.5;
      if (t < 1) requestAnimationFrame(animate);
      else {
        this.quenchPool.material.emissiveIntensity = initialIntensity;
        this.rippleActive = false; // Stop ripples after quenching
      }
    };
    animate();
  }

  async addInteractiveObjects() {
    const fragmentGeometry = new THREE.DodecahedronGeometry(0.3, 0);
    this.ensureUVs(fragmentGeometry, 'star fragment');
    const fragmentColors = [0xFF4500, 0x00CED1, 0xFFD700];
    for (let i = 0; i < 3; i++) {
      const fragmentMaterial = new THREE.MeshStandardMaterial({
        color: fragmentColors[i],
        emissive: fragmentColors[i],
        emissiveIntensity: 1,
        roughness: 0.2
      });
      const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
      fragment.position.set(
        Math.cos(i * 2 * Math.PI / 3) * 15,
        2,
        Math.sin(i * 2 * Math.PI / 3) * 15
      );
      fragment.userData.initialScale = new THREE.Vector3(1, 1, 1);
      fragment.userData.orbitAngle = i * 2 * Math.PI / 3;
      fragment.userData.color = fragmentColors[i];
      this.add(fragment);
      this.starFragments.push(fragment);
      this.makeObjectInteractive(fragment, {
        name: `star_fragment_${i}`,
        type: 'puzzle_piece',
        interactable: true,
        action: () => {
          if (this.starFragmentsCollected < 3) {
            this.collectStarFragment(fragment);
            eventBus.emit('showMessage', `A star fragment joins your grasp (${this.starFragmentsCollected}/3)! Offer them to the crucible.`);
          }
        }
      });
    }

    const hammerGeometry = new THREE.BoxGeometry(0.5, 2, 0.5);
    this.ensureUVs(hammerGeometry, 'hammer');
    const hammerMaterial = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.9, roughness: 0.1 });
    this.hammer = new THREE.Mesh(hammerGeometry, hammerMaterial);
    this.hammer.position.set(-2, 1, 0);
    this.hammer.rotation.x = Math.PI / 4;
    this.hammer.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.add(this.hammer);
    this.makeObjectInteractive(this.hammer, {
      name: 'forge_hammer',
      type: 'puzzle_piece',
      interactable: true,
      action: () => {
        if (!this.anvilActive) {
          eventBus.emit('showMessage', 'The hammer rests, its purpose unawakened. Stir the anvil.');
        } else if (!this.constellationAligned) {
          eventBus.emit('showMessage', 'The hammer yearns for order. Align the stars first.');
        } else if (!this.bladeForged) {
          this.animateHammer();
          this.bladeForged = true;
          this.spawnBlade();
          eventBus.emit('showMessage', 'The hammer sings! A blade takes form—cool it, then quench its soul.');
        } else if (!this.quenchReady) {
          eventBus.emit('showMessage', 'The blade’s heat lingers. Await its tempering moment.');
        } else {
          eventBus.emit('showMessage', 'The hammer’s song is complete. Quench the blade in cosmic waters.');
        }
      }
    });
  }

  async addConstellationNodes() {
    const nodeTexture = await this.loadTexture('/assets/textures/stellar-node.png');
    const nodeMaterial = new THREE.MeshStandardMaterial({
      map: nodeTexture,
      transparent: true,
      opacity: 0.7,
      emissive: 0xFFFFFF,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide
    });

    const positions = [
      new THREE.Vector3(-4, 4, 2),
      new THREE.Vector3(0, 5, -2),
      new THREE.Vector3(4, 4, 2)
    ];
    for (let i = 0; i < 3; i++) {
      const nodeGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      this.ensureUVs(nodeGeometry, 'constellation node');
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
      node.position.copy(positions[i]);
      node.userData.initialScale = new THREE.Vector3(1, 1, 1);
      node.userData.colorIndex = i;
      this.add(node);
      this.constellationNodes.push(node);
      this.makeObjectInteractive(node, {
        name: `constellation_node_${i}`,
        type: 'puzzle',
        interactable: true,
        action: () => this.handleConstellationNode(node)
      });
    }
  }

  handleAnvilInteraction() {
    if (!this.crucibleFilled) {
      eventBus.emit('showMessage', 'The anvil slumbers, its heart unlit. Kindle the crucible.');
    } else if (!this.anvilActive) {
      this.anvilActive = true;
      this.triggerAnvilPulse();
      eventBus.emit('showMessage', 'The anvil stirs! Weave the stars: Orange, Turquoise, Gold.');
    } else {
      eventBus.emit('showMessage', 'The anvil pulses with energy. Align the heavens, then strike.');
    }
  }

  handleConstellationNode(node) {
    if (!this.anvilActive) {
      eventBus.emit('showMessage', 'The cosmos sleeps. Awaken the anvil first.');
      return;
    }
    if (this.constellationAligned) {
      eventBus.emit('showMessage', 'The stars are set. Let the hammer fall.');
      return;
    }
    const colors = [0xFF4500, 0x00CED1, 0xFFD700];
    this.constellationSequence.push(colors[node.userData.colorIndex]);
    this.animateNode(node);
    eventBus.emit('showMessage', `A star ignites (${this.constellationSequence.length}/3).`);
    if (this.constellationSequence.length === 3) {
      if (this.checkConstellationOrder()) {
        this.constellationAligned = true;
        eventBus.emit('showMessage', 'The heavens align in splendor! Strike to forge destiny.');
        this.triggerConstellationEffect();
      } else {
        eventBus.emit('showMessage', 'The stars falter! Begin anew.');
        this.constellationSequence = [];
        this.resetNodes();
      }
    }
  }

  resetNodes() {
    this.constellationNodes.forEach(node => {
      node.scale.copy(node.userData.initialScale || new THREE.Vector3(1, 1, 1));
      node.material.emissive.setHex(0xFFFFFF);
      node.material.emissiveIntensity = 0.5;
      node.material.opacity = 0.7;
      let t = 0;
      const animate = () => {
        t += 0.1;
        node.material.emissiveIntensity = 0.5 * (1 - Math.sin(t * Math.PI));
        if (t < 1) requestAnimationFrame(animate);
        else node.material.emissiveIntensity = 0.5;
      };
      animate();
    });
    console.log('Constellation nodes reset');
  }

  checkConstellationOrder() {
    return this.constellationSequence.every((color, i) => color === this.correctConstellationOrder[i]);
  }

  collectStarFragment(fragment) {
    this.starFragmentsCollected++;
    this.animateFragment(fragment);
    fragment.visible = false;
  }

  fillCrucible() {
    this.crucibleFilled = true;
    const moltenGeometry = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32);
    this.ensureUVs(moltenGeometry, 'molten');
    const moltenMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 1 });
    const molten = new THREE.Mesh(moltenGeometry, moltenMaterial);
    molten.position.set(0, 0.5, 0);
    this.crucible.add(molten);
  }

  spawnBlade() {
    const bladeGeometry = new THREE.BoxGeometry(0.1, 2, 0.5);
    this.ensureUVs(bladeGeometry, 'blade');
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 0.9, roughness: 0.1 });
    this.blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    this.blade.position.set(0, 1, 0);
    this.blade.userData.initialScale = new THREE.Vector3(1, 1, 1);
    this.anvil.add(this.blade);
    setTimeout(() => {
      this.quenchReady = true;
      eventBus.emit('showMessage', 'The blade’s fire fades. Quench it in the cosmic pool.');
    }, 3000);
  }

  quenchBlade() {
    this.blade.position.set(3, 0.5, -3);
    this.triggerQuenchEffect();
    this.blade.material.emissive.setHex(0x00CED1);
    this.blade.material.emissiveIntensity = 1;
  }

  showFinalRiddleInput() {
    const inputContainer = document.createElement('div');
    inputContainer.id = 'final-riddle-input';
    inputContainer.style.position = 'absolute';
    inputContainer.style.top = '50%';
    inputContainer.style.left = '50%';
    inputContainer.style.transform = 'translate(-50%, -50%)';
    inputContainer.style.background = 'rgba(0, 0, 51, 0.8)';
    inputContainer.style.padding = '20px';
    inputContainer.style.borderRadius = '10px';
    inputContainer.style.zIndex = '2000';
    inputContainer.style.color = '#FFD700';
    inputContainer.style.fontFamily = 'Georgia, serif';

    const label = document.createElement('div');
    label.textContent = 'Riddle: "I speak without a mouth and hear without ears. What am I?" (4 letters)';
    label.style.marginBottom = '10px';
    inputContainer.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 4;
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    input.placeholder = 'e.g., echo';
    inputContainer.appendChild(input);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.marginTop = '10px';
    submitButton.style.padding = '5px 10px';
    submitButton.style.background = '#FF4500';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '5px';
    submitButton.style.cursor = 'pointer';
    inputContainer.appendChild(submitButton);

    document.body.appendChild(inputContainer);
    setTimeout(() => input.focus(), 0);

    const submitHandler = () => {
      this.handleFinalRiddle(input.value);
      document.body.removeChild(inputContainer);
      eventBus.emit('resumeGame');
    };

    submitButton.addEventListener('click', submitHandler.bind(this));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitHandler();
    });

    eventBus.emit('pauseGame');
  }

  handleFinalRiddle(input) {
    if (input.toLowerCase() === 'echo') {
      eventBus.emit('showMessage', 'The Blade of Eternity is yours! The cosmos heralds your triumph!');
      this.triggerVictoryEffect();
      eventBus.emit('game:win');
    } else {
      eventBus.emit('showMessage', 'The stars whisper dissent. Speak again.');
    }
  }

  triggerAnvilPulse() {
    let t = 0;
    const initialScale = this.anvil.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 1 + Math.sin(t * 5) * 0.1;
      this.anvil.scale.set(initialScale.x * scale, initialScale.y * scale, initialScale.z * scale);
      if (t < 1) requestAnimationFrame(animate);
      else this.anvil.scale.copy(initialScale);
    };
    animate();
  }

  triggerConstellationEffect() {
    this.constellationNodes.forEach(node => {
      const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 5, 16);
      this.ensureUVs(beamGeometry, 'beam');
      const beamMaterial = new THREE.MeshBasicMaterial({ color: node.material.emissive, transparent: true, opacity: 0.7 });
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.copy(node.position);
      beam.lookAt(this.anvil.position);
      this.add(beam);
      setTimeout(() => this.remove(beam), 2000);
    });
  }

  triggerQuenchEffect() {
    const steamGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.ensureUVs(steamGeometry, 'steam');
    const steamMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 });
    const steam = new THREE.Mesh(steamGeometry, steamMaterial);
    steam.position.copy(this.quenchPool.position);
    steam.position.y += 1;
    this.add(steam);
    let t = 0;
    const animate = () => {
      t += 0.05;
      steam.scale.setScalar(1 + t);
      steam.material.opacity = 0.5 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(steam);
    };
    animate();
  }

  triggerVictoryEffect() {
    const burstGeometry = new THREE.SphereGeometry(5, 32, 32);
    this.ensureUVs(burstGeometry, 'victory burst');
    const burstMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const burst = new THREE.Mesh(burstGeometry, burstMaterial);
    burst.position.set(0, 2, 0);
    this.add(burst);
    let t = 0;
    const animate = () => {
      t += 0.05;
      burst.scale.setScalar(1 + t * 2);
      burst.material.opacity = 0.8 - t;
      if (t < 1) requestAnimationFrame(animate);
      else this.remove(burst);
    };
    animate();
  }

  animateFragment(fragment) {
    let t = 0;
    const initialPos = fragment.position.clone();
    const targetPos = this.crucible.position.clone();
    const animate = () => {
      t += 0.05;
      fragment.position.lerpVectors(initialPos, targetPos, t);
      if (t < 1) requestAnimationFrame(animate);
      else fragment.visible = false;
    };
    animate();
  }

  animateNode(node) {
    let t = 0;
    const initialScale = node.scale.clone();
    const animate = () => {
      t += 0.05;
      const scale = 1 + Math.sin(t * 5) * 0.2;
      node.scale.set(scale, scale, scale);
      if (t < 1) requestAnimationFrame(animate);
      else node.scale.copy(initialScale);
    };
    animate();
  }

  animateHammer() {
    let t = 0;
    const initialRotX = this.hammer.rotation.x;
    const animate = () => {
      t += 0.1;
      this.hammer.rotation.x = initialRotX - Math.sin(t * 5) * 0.5;
      if (t < 1) requestAnimationFrame(animate);
      else this.hammer.rotation.x = initialRotX;
    };
    animate();
  }

  addLighting() {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.1);
    this.add(this.ambientLight);

    this.anvilLight = new THREE.PointLight(0xFF4500, 0.5, 15);
    this.anvilLight.position.set(0, 2, 0);
    this.add(this.anvilLight);

    this.crucibleLight = new THREE.PointLight(0xFF4500, 0.3, 10);
    this.crucibleLight.position.set(-3, 2, 3);
    this.add(this.crucibleLight);
  }

  addNebulaParticles() {
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = THREE.MathUtils.randFloat(15, 25);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.05,
      transparent: true,
      opacity: 0.4
    });
    this.nebulaParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.add(this.nebulaParticles);
  }

  addCosmicAura() {
    const auraGeometry = new THREE.SphereGeometry(20, 32, 32);
    this.ensureUVs(auraGeometry, 'cosmic aura');
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x1A1A2E,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.cosmicAura = new THREE.Mesh(auraGeometry, auraMaterial);
    this.cosmicAura.position.set(0, 0, 0);
    this.add(this.cosmicAura);
  }

  addBackgroundAudio() {
    const audioLoader = new THREE.AudioLoader();
    const listener = new THREE.AudioListener();
    this.scene.add(listener);
    const sound = new THREE.PositionalAudio(listener);
    audioLoader.load('/assets/audio/cosmic-forge.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(20);
      sound.setLoop(true);
      sound.play();
    });
    sound.position.set(0, 0, 0);
    this.add(sound);
  }

  update(delta) {
    this.starFragments.forEach(fragment => {
      fragment.userData.orbitAngle += 0.01 * delta;
      fragment.position.set(
        Math.cos(fragment.userData.orbitAngle) * 15,
        2 + Math.sin(Date.now() * 0.001) * 0.2,
        Math.sin(fragment.userData.orbitAngle) * 15
      );
    });
    if (this.nebulaParticles) {
      const positions = this.nebulaParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.001;
      }
      this.nebulaParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  makeObjectInteractive(object, data) {
    object.userData = {
      ...object.userData,
      ...data,
      isInteractive: true,
      onHover: data.onHover || (() => {}),
      onUnhover: data.onUnhover || (() => {})
    };
    this.interactiveObjects.push(object);
    if (object instanceof THREE.Mesh && object.geometry) {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFD700,
        side: THREE.BackSide
      });
      const outlineMesh = new THREE.Mesh(object.geometry.clone(), outlineMaterial);
      outlineMesh.scale.multiplyScalar(1.07);
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
        (progress) => {
          console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
        },
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

export { CelestialForge };