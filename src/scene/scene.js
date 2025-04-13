// src/scene/scene.js
import * as THREE from 'three';
import { setupLighting } from './lighting';
import { setupCamera } from './camera';
import { setupRenderer } from './renderer';
import { LevelManager } from './levelManager';
import { InteractionSystem } from '../game/interactions';
import { Player } from '../game/player';
import { UIManager } from '../ui/uiManager';
import { AICompanion } from '../game/AICompanion.js';
import MetricsManager from '../game/metricsManager.js';

export class SceneManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.loadingManager = new THREE.LoadingManager();
    this.interactableObjects = [];
    this.inventory = {
      items: [],
      hasItem: (id) => this.inventory.items.some(item => item.id === id)
    };
    this.renderer = setupRenderer();
    if (!this.renderer) {
      throw new Error('Failed to initialize renderer. Check renderer.js and HTML canvas setup.');
    }
    this.camera = setupCamera();
    this.lights = setupLighting(this.scene);
    this.currentLevelId = null;
    this.currentLevel = null;
    this.uiManager = new UIManager(this.eventBus);
    this.metricsManager = MetricsManager;
    this.isRunning = false;
    this.isPaused = false;
    this.eventListeners = new Map();
    this.setupLoadingManager();
    this.setupEventProxy();
    this.setupInputListeners();
  }

  setupEventProxy() {
    if (!this.eventBus.emit) this.eventBus.emit = this.eventBus.publish;
    if (!this.eventBus.publish) this.eventBus.publish = this.eventBus.emit;
    if (!this.eventBus.on) this.eventBus.on = this.eventBus.subscribe;
    if (!this.eventBus.subscribe) this.eventBus.subscribe = this.eventBus.on;
  }

  addEventBusListener(event, handler) {
    this.eventBus.on(event, handler);
    this.eventListeners.set(`${event}-${handler.toString()}`, handler);
  }

  setupInputListeners() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.isPaused) {
          this.resumeGame();
        } else if (this.isRunning) {
          this.pauseGame();
        }
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'h' && this.companion) {
        this.companion.provideHint();
      }
    });
  }

  async init(levelId = 'scholarsLibrary', skillObject = null) {
    this.currentLevelId = levelId;
    const effectiveSkillObject = skillObject || this.metricsManager.getLatestSkillObject();
    console.log(`[DEBUG] Initializing level ${levelId} with skill:`, effectiveSkillObject, 'at', new Date().toISOString());

    this.eventBus.emit('stageStarted', levelId);

    this.currentLevel = LevelManager.getLevel(this.currentLevelId, this.scene, effectiveSkillObject?.skillLevel);
    await this.currentLevel.init();
    this.scene.add(this.currentLevel);
    this.scene.currentLevel = this.currentLevel;

    this.interactableObjects = this.currentLevel.getInteractiveObjects();
    console.log('[DEBUG] Interactable objects for', levelId, ':', this.interactableObjects.map(o => o.userData.name || 'unnamed'));

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.uiManager.init();

    this.interactionSystem = new InteractionSystem(this.camera, this.scene);
    await this.interactionSystem.init();
    this.interactionSystem.setLevel(this.currentLevelId);
    this.interactionSystem.setInteractiveObjects(this.interactableObjects);
    this.interactionSystem.inventory = this.inventory;
    this.interactionSystem.setInventory(this.inventory);

    this.resetPlayer();

    this.companion = new AICompanion(this);

    this.addEventBusListener('collectItem', (item) => {
      this.inventory.items.push(item);
      this.eventBus.emit('inventory:updated', this.inventory);
    });

    this.addEventBusListener('game:win', () => {
      if (!this.isRunning || this.isPaused) {
        console.log('[SceneManager] Ignoring premature game:win event during initialization or pause at', new Date().toISOString());
        return;
      }
      console.log('[SceneManager] Game win event triggered for level', this.currentLevelId, 'at', new Date().toISOString());
      this.stopRenderLoop();
      this.showWinScreen();
    });

    this.addEventBusListener('showMessage', (message) => {
      this.uiManager.showMessage(message);
    });

    this.addEventBusListener('puzzle:interacted', (data) => {
      this.eventBus.emit('puzzleInteracted', data);
    });

    this.eventBus.publish('scene:ready', this);
    this.eventBus.emit('scene:ready', this);

    this.startRenderLoop();
  }

  getInteractiveObjects() {
    return this.scene.children.filter(child => child.userData && child.userData.isInteractive);
  }

  // src/scene/scene.js (snippet)
resetPlayer() {
  if (this.player) {
    this.scene.remove(this.player.mesh);
  }
  this.player = new Player(this.camera, this.scene);
  this.player.init();
  this.player.setInteractiveObjects(this.interactableObjects);
  if (!this.player.mesh) {
    console.error('Player mesh not initialized. Using fallback.');
    this.player.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
  }
  this.scene.add(this.player.mesh);

  if (this.currentLevelId === 'scholarsLibrary') {
    this.player.position.set(0, 1, 10); // Sync with Player.js position
    this.player.mesh.position.set(0, 1 - this.player.height / 2, 10); // Match offset
    this.camera.position.set(0, 1.7, 10); // Match Player.js camera height
    this.camera.lookAt(0, 1.7, 0);
    console.log('Player reset to (0, 1, 10) for', this.currentLevelId, 'at', new Date().toISOString());
  }
}

render() {
  if (!this.isRunning || !this.currentLevel || this.isPaused) return;
  const delta = this.clock.getDelta();
  const colliders = [];
  const collectColliders = (object) => {
    if (object.userData && object.userData.isCollider === true) colliders.push(object);
    object.children.forEach(child => collectColliders(child));
  };
  this.scene.children.forEach(obj => collectColliders(obj));

  this.player.update(delta, colliders);
  if (typeof this.currentLevel.update === 'function') this.currentLevel.update(delta);
  this.interactionSystem.update();
  this.companion.update(delta);
  this.uiManager.update();
  this.renderer.render(this.scene, this.camera);
}

  startRenderLoop() {
    if (!this.renderer || !this.currentLevel || this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.render());
    console.log('[DEBUG] Render loop started for', this.currentLevelId, 'at', new Date().toISOString());
  }

  stopRenderLoop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = false;
    this.clock.stop();
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }
    console.log('[DEBUG] Render loop stopped for', this.currentLevelId, 'at', new Date().toISOString());
  }

  pauseGame() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.isRunning = false;
    this.clock.stop();
    this.eventBus.emit('game:pause');
    this.uiManager.showPauseMenu();
    document.exitPointerLock();
    console.log('[SceneManager] Game paused for', this.currentLevelId, 'at', new Date().toISOString());
  }

  resumeGame() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.isRunning = true;
    this.clock.start();
    this.eventBus.emit('game:resume');
    this.uiManager.hidePauseMenu();
    this.renderer.domElement.requestPointerLock();
    this.startRenderLoop();
    console.log('[SceneManager] Game resumed for', this.currentLevelId, 'at', new Date().toISOString());
  }

  showWinScreen() {
    const existingWinScreen = document.getElementById('win-screen');
    if (existingWinScreen) {
      document.body.removeChild(existingWinScreen);
    }

    const skillObject = this.metricsManager.getLatestSkillObject();
    const winScreen = document.createElement('div');
    winScreen.id = 'win-screen';
    winScreen.style.position = 'absolute';
    winScreen.style.top = '50%';
    winScreen.style.left = '50%';
    winScreen.style.transform = 'translate(-50%, -50%)';
    winScreen.style.background = 'rgba(0, 100, 0, 0.9)';
    winScreen.style.color = 'white';
    winScreen.style.padding = '20px';
    winScreen.style.borderRadius = '10px';
    winScreen.style.fontSize = '24px';
    winScreen.style.textAlign = 'center';
    winScreen.style.zIndex = '3000';
    winScreen.innerHTML = this.currentLevelId === 'scholarsLibrary' ? `
      <h1>You Mastered the Library!</h1>
      <p>Congratulations on unlocking the arcane secrets!</p>
      <button id="next-level-button">Next Level</button>
      <button id="return-to-menu-button">Return to Menu</button>
    ` : `
      <h1>You Escaped!</h1>
      <p>Congratulations on solving the room!</p>
      <button id="next-level-button">Next Level</button>
      <button id="return-to-menu-button">Return to Menu</button>
    `;
    document.body.appendChild(winScreen);

    const nextLevelButton = document.getElementById('next-level-button');
    nextLevelButton.style.padding = '10px 20px';
    nextLevelButton.style.background = '#FFD700';
    nextLevelButton.style.color = 'black';
    nextLevelButton.style.border = 'none';
    nextLevelButton.style.borderRadius = '5px';
    nextLevelButton.style.cursor = 'pointer';
    nextLevelButton.style.marginRight = '10px';

    const returnToMenuButton = document.getElementById('return-to-menu-button');
    returnToMenuButton.style.padding = '10px 20px';
    returnToMenuButton.style.background = '#FF4500';
    returnToMenuButton.style.color = 'white';
    returnToMenuButton.style.border = 'none';
    returnToMenuButton.style.borderRadius = '5px';
    returnToMenuButton.style.cursor = 'pointer';

    const nextLevelId = LevelManager.getNextLevelId(this.currentLevelId);

    if (nextLevelId) {
      nextLevelButton.addEventListener('click', async () => {
        const holoQuest = window.holoQuest;
        if (holoQuest) {
          holoQuest.showLoadingScreen(`Loading ${nextLevelId}...`);
        }

        document.body.removeChild(winScreen);

        const levelCompletedEvent = new CustomEvent('levelCompleted', {
          detail: { levelId: this.currentLevelId, nextLevelId }
        });
        window.dispatchEvent(levelCompletedEvent);
        this.eventBus.emit('stageCompleted', this.currentLevelId);

        await this.loadLevel(nextLevelId);

        if (holoQuest) {
          holoQuest.hideLoadingScreen();
        }
      });
    } else {
      nextLevelButton.style.display = 'none';
    }

    returnToMenuButton.addEventListener('click', () => {
      document.body.removeChild(winScreen);
      if (nextLevelId) {
        const levelCompletedEvent = new CustomEvent('levelCompleted', {
          detail: { levelId: this.currentLevelId, nextLevelId }
        });
        window.dispatchEvent(levelCompletedEvent);
      }
      this.eventBus.emit('game:restart');
    });
  }

  async loadLevel(levelId) {
    console.log(`Starting loadLevel for ${levelId} at`, new Date().toISOString());
    const startTime = performance.now();

    this.stopRenderLoop();

    if (this.currentLevel) {
      this.scene.remove(this.currentLevel);
      this.disposeObject(this.currentLevel);
      this.currentLevel = null;
    }

    while (this.scene.children.length > 0) {
      const object = this.scene.children[0];
      this.scene.remove(object);
      this.disposeObject(object);
    }

    this.interactableObjects = [];
    this.inventory.items = [];
    this.eventBus.emit('inventory:updated', this.inventory);

    if (this.interactionSystem) {
      this.interactionSystem.destroy();
      this.interactionSystem = null;
    }

    if (this.companion) {
      this.companion.destroy();
      this.companion = null;
    }

    this.eventListeners.forEach((handler, key) => {
      this.eventBus.off(key.split('-')[0], handler);
    });
    this.eventListeners.clear();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = setupCamera();
    this.lights = setupLighting(this.scene);

    const skillObject = this.metricsManager.getLatestSkillObject();
    console.log(`[DEBUG] Loading ${levelId} with skill:`, skillObject);
    await this.init(levelId, skillObject);

    this.resetPlayer();

    if (window.holoQuest && window.holoQuest.controlManager) {
      window.holoQuest.controlManager.setScene(this.scene);
      window.holoQuest.controlManager.enableControls();
      if (window.holoQuest.gameState.getCurrentState() === window.holoQuest.gameState.states.PLAYING) {
        window.holoQuest.controlManager.requestPointerLock();
      }
    }

    this.startRenderLoop();

    this.eventBus.emit('level:reset');

    const endTime = performance.now();
    console.log(`loadLevel for ${levelId} completed in ${(endTime - startTime).toFixed(2)}ms at`, new Date().toISOString());
  }

  disposeObject(object) {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
    if (object.children) object.children.forEach(child => this.disposeObject(child));
  }

  resetGame() {
    this.stopRenderLoop();
    this.eventBus.emit('game:restart');
    this.scene.children = [];
    this.interactableObjects = [];
    this.inventory.items = [];
    this.eventBus.emit('inventory:updated', this.inventory);
    const levelSelectScreen = document.getElementById('level-select-screen');
    const gameContainer = document.getElementById('game-container');
    if (levelSelectScreen && gameContainer) {
      levelSelectScreen.classList.remove('hidden');
      levelSelectScreen.classList.add('visible');
      levelSelectScreen.classList.add('shake');
      gameContainer.classList.remove('visible');
      gameContainer.classList.add('hidden');
    }
    this.loadLevel(this.currentLevelId || 'scholarsLibrary');
  }

  update(delta) {
    this.eventBus.publish('scene:update', { delta });
    this.eventBus.emit('scene:update', { delta });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLoadingManager() {
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      this.eventBus.publish('loading:progress', { progress: itemsLoaded / itemsTotal, url });
    };
    this.loadingManager.onError = (url) => {
      console.error('SceneManager: Loading error:', url);
      this.eventBus.publish('loading:error', { url });
    };
    this.loadingManager.onLoad = () => {
      this.eventBus.publish('loading:complete');
    };
  }

  cleanup() {
    this.stopRenderLoop();
    if (this.interactionSystem) this.interactionSystem.destroy();
    if (this.controls) this.controls.dispose();
    if (this.uiManager) this.uiManager.hideAll();
    if (this.companion) this.companion.destroy();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.eventListeners.forEach((handler, key) => {
      this.eventBus.off(key.split('-')[0], handler);
    });
    this.eventListeners.clear();
    console.log('[SceneManager] Cleanup complete at', new Date().toISOString());
  }
}