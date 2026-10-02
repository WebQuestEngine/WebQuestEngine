import { Application } from 'pixi.js';
import { ProjectData, SceneData, Vector2D, EventScopeType, SaveGameData, HotspotAction } from '../types';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { RuntimeContext } from './RuntimeContext';
import { EventBus } from '../core/EventBus';
import { LetterboxManager } from './LetterboxManager';
import { DOMOverlayRenderer } from './DOMOverlayRenderer';
import { CinematicsController, CinematicsHost } from './CinematicsController';
import { DialogController, DialogHost } from './DialogController';
import { ActionExecutor, ActionHost } from './ActionExecutor';
import { InputHandler, InputHost } from './InputHandler';
import { SaveRestoreHandler, SaveRestoreHost } from './SaveRestoreHandler';

export class GameRuntime implements CinematicsHost, DialogHost, ActionHost, InputHost, SaveRestoreHost {
  public app: Application;
  public camera: Camera;
  public context: RuntimeContext;
  public currentScene: Scene | null = null;
  public containerElement: HTMLElement;
  public isDestroyed = false;
  public isPaused = false;
  public visitedScenes: Set<string> = new Set();

  // Task-specific managers
  public readonly letterboxManager: LetterboxManager;
  public readonly domRenderer: DOMOverlayRenderer;
  public readonly cinematicsController: CinematicsController;
  public readonly dialogController: DialogController;
  public readonly actionExecutor: ActionExecutor;
  public readonly inputHandler: InputHandler;
  public readonly saveRestoreHandler: SaveRestoreHandler;

  private isLoadingScene = false;
  private pendingSceneOfficialStart: string | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor(containerElement: HTMLElement, project: ProjectData) {
    this.containerElement = containerElement;
    this.context = new RuntimeContext(project, containerElement);
    this.camera = new Camera(containerElement.clientWidth || 1280, containerElement.clientHeight || 720);
    this.app = new Application();

    this.letterboxManager = new LetterboxManager();
    this.domRenderer = new DOMOverlayRenderer(containerElement);

    this.actionExecutor = new ActionExecutor(this);
    this.cinematicsController = new CinematicsController(this, this.domRenderer);
    this.dialogController = new DialogController(this, this.domRenderer, this.letterboxManager);
    this.inputHandler = new InputHandler(this, this.letterboxManager);
    this.saveRestoreHandler = new SaveRestoreHandler(this);
  }

  public async init(): Promise<void> {
    await this.app.init({
      width: this.containerElement.clientWidth || 1280,
      height: this.containerElement.clientHeight || 720,
      backgroundColor: 0x000000,
      resizeTo: this.containerElement,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app.canvas.style.display = 'block';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.containerElement.appendChild(this.app.canvas);

    this.setupEventHandlers();
    this.inputHandler.setupInputListeners();

    // Start game loop
    this.app.ticker.add((ticker) => {
      if (!this.isDestroyed) {
        this.update(ticker.deltaTime / 60);
      }
    });

    // Check if project has a defined Game Start sequence (intro video, cutscene, etc.)
    const hasGameStart = this.hasGameStartEvent();
    const initialSceneData = this.context.story.getCurrentScene();
    if (initialSceneData) {
      await this.loadScene(initialSceneData, undefined, {
        playMusic: !hasGameStart,
        triggerEnterEvents: !hasGameStart
      });
    }

    if (hasGameStart) {
      this.pendingSceneOfficialStart = initialSceneData ? initialSceneData.id : null;
      this.checkAndTriggerEvent('game', 'game', 'start');
    }
  }

  private setupEventHandlers(): void {
    const bus = EventBus.getInstance();

    // Scene change
    this.unsubscribers.push(
      bus.on('scene:change', async (payload: any) => {
        if (this.isDestroyed) return;
        const sceneData = payload.scene || payload;
        await this.loadScene(sceneData, payload.spawnPoint);
      })
    );

    // Inventory give & flag set
    this.unsubscribers.push(
      bus.on('inventory:give', (itemId: string) => {
        if (this.isDestroyed) return;
        this.context.inventory.addItem(itemId);
      })
    );

    this.unsubscribers.push(
      bus.on('inventory:item_added', (itemId: string) => {
        if (this.isDestroyed) return;
        this.checkAndTriggerEvent('item', itemId, 'obtained');
      })
    );

    this.unsubscribers.push(
      bus.on('item:use', (itemId: string) => {
        if (this.isDestroyed) return;
        this.checkAndTriggerEvent('item', itemId, 'use');
      })
    );

    this.unsubscribers.push(
      bus.on('item:examine', (itemId: string) => {
        if (this.isDestroyed) return;
        this.checkAndTriggerEvent('item', itemId, 'examine');
      })
    );

    this.unsubscribers.push(
      bus.on('item:combine', (payload: { item1: string; item2: string }) => {
        if (this.isDestroyed) return;
        this.checkAndTriggerEvent('item', payload.item1, 'combine') ||
        this.checkAndTriggerEvent('item', payload.item2, 'combine');
      })
    );

    this.unsubscribers.push(
      bus.on('inventory:take', (itemId: string) => {
        if (this.isDestroyed) return;
        this.context.inventory.removeItem(itemId);
      })
    );

    this.unsubscribers.push(
      bus.on('flag:set', (flag: string) => {
        if (this.isDestroyed) return;
        this.context.story.setFlag(flag, true);
      })
    );

    this.unsubscribers.push(
      bus.on('flag:clear', (flag: string) => {
        if (this.isDestroyed) return;
        this.context.story.setFlag(flag, false);
      })
    );
  }

  public async loadScene(
    sceneData: SceneData,
    spawnPoint?: Vector2D,
    options: { playMusic?: boolean; triggerEnterEvents?: boolean } = {}
  ): Promise<void> {
    if (this.isLoadingScene) return;
    this.isLoadingScene = true;

    const shouldPlayMusic = options.playMusic !== false;
    const shouldTriggerEnter = options.triggerEnterEvents !== false;

    try {
      const oldScene = this.currentScene;
      this.currentScene = null;

      if (oldScene) {
        this.letterboxManager.detachMask();
        this.app.stage.removeChild(oldScene.container);
        oldScene.destroy();
      }

      // Deselect held item when switching scenes
      this.context.inventory.selectItem(null);
      this.context.ui.setActiveVerb('walk');

      this.visitedScenes.add(sceneData.id);
      const newScene = new Scene(sceneData);
      await newScene.init(this.camera);
      this.currentScene = newScene;

      // Position player
      if (spawnPoint && this.currentScene.playerCharacter) {
        this.currentScene.playerCharacter.container.x = spawnPoint.x;
        this.currentScene.playerCharacter.container.y = spawnPoint.y;
      }

      if (this.currentScene.playerCharacter) {
        this.camera.follow(this.currentScene.playerCharacter.container);
      }

      this.app.stage.addChild(this.currentScene.container);

      // Play scene BGM (if permitted)
      if (shouldPlayMusic) {
        if (sceneData.backgroundMusicUrl) {
          this.context.audio.playMusic(sceneData.backgroundMusicUrl);
        } else {
          this.context.audio.stopMusic(500);
        }
      }

      // Refresh inventory UI on scene load
      this.context.ui.renderInventoryItems(this.context.inventory.getItems());

      // Trigger Scene Events (First Enter and Enter) (if permitted)
      if (shouldTriggerEnter) {
        const visitedFlag = `scene_visited_${sceneData.id}`;
        const isFirstEnter = !this.context.story.getFlag(visitedFlag);
        if (isFirstEnter) {
          this.context.story.setFlag(visitedFlag, true);
          this.checkAndTriggerEvent('scene', sceneData.id, 'first_enter');
        }
        this.checkAndTriggerEvent('scene', sceneData.id, 'enter');
      }
    } finally {
      this.isLoadingScene = false;
    }
  }

  public hasGameStartEvent(): boolean {
    return this.actionExecutor.hasGameStartEvent();
  }

  public clearPendingSceneStart(): void {
    this.pendingSceneOfficialStart = null;
  }

  public onDialogEnded(): void {
    if (this.pendingSceneOfficialStart) {
      this.startPendingScene();
    }
  }

  public startPendingScene(): void {
    if (!this.pendingSceneOfficialStart || !this.currentScene) return;
    const sceneData = this.currentScene.data;
    this.pendingSceneOfficialStart = null;

    console.log(
      `%c[GameRuntime] 🎬 Intro sequence completed -> Officially starting initial scene "${sceneData.id}"`,
      'color: #10b981; font-weight: bold;'
    );

    if (sceneData.backgroundMusicUrl) {
      this.context.audio.playMusic(sceneData.backgroundMusicUrl);
    }
    const visitedFlag = `scene_visited_${sceneData.id}`;
    const isFirstEnter = !this.context.story.getFlag(visitedFlag);
    if (isFirstEnter) {
      this.context.story.setFlag(visitedFlag, true);
      this.checkAndTriggerEvent('scene', sceneData.id, 'first_enter');
    }
    this.checkAndTriggerEvent('scene', sceneData.id, 'enter');
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public update(delta: number): void {
    if (this.isDestroyed || !this.currentScene || this.isLoadingScene) return;

    this.camera.viewport = {
      width: this.containerElement.clientWidth || window.innerWidth,
      height: this.containerElement.clientHeight || window.innerHeight
    };
    this.camera.update();

    if (!this.isPaused && this.currentScene) {
      this.currentScene.update(delta, this.camera);
    }

    if (this.isDestroyed || !this.currentScene || this.isLoadingScene) return;

    this.letterboxManager.applyLetterbox(
      this.currentScene,
      this.camera.viewport,
      this.context.project.viewportSettings
    );
  }

  public executeAction(action: HotspotAction | any, targetPos?: Vector2D, targetElement?: any): void {
    this.actionExecutor.executeAction(action, targetPos, targetElement);
  }

  public getCharacterByNameOrId(nameOrId?: string): Character | null {
    return this.cinematicsController.getCharacterByNameOrId(nameOrId);
  }

  public getCharacterScreenPos(speakerName?: string): Vector2D | null {
    return this.letterboxManager.getCharacterScreenPos(
      this.currentScene,
      this.camera.viewport,
      this.context.project.viewportSettings,
      speakerName
    );
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    return this.inputHandler.getWorldPoint(e);
  }

  public checkAndTriggerEvent(
    scope: EventScopeType,
    targetId: string,
    eventName: string
  ): boolean {
    return this.actionExecutor.checkAndTriggerEvent(scope, targetId, eventName);
  }

  public async restoreSaveGame(saveData: SaveGameData): Promise<void> {
    await this.saveRestoreHandler.restoreSaveGame(saveData);
  }

  public setVisitedScenes(scenes: Set<string>): void {
    this.visitedScenes = scenes;
  }

  public destroy(): void {
    this.isDestroyed = true;

    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.inputHandler.destroy();
    this.dialogController.destroy();
    this.cinematicsController.destroy();
    this.saveRestoreHandler.destroy();
    this.domRenderer.destroy();
    this.letterboxManager.destroy();

    this.context.destroy();

    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }

    this.app.destroy(true, { children: true, texture: false });
  }
}

export * from './LetterboxManager';
export * from './DOMOverlayRenderer';
export * from './CinematicsController';
export * from './DialogController';
export * from './ActionExecutor';
export * from './InputHandler';
export * from './SaveRestoreHandler';
