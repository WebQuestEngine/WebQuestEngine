import * as PIXI from 'pixi.js';
import { ProjectData, Vector2D } from '../types';
import { Camera } from './Camera';
import { Scene } from '../scene/Scene';
import { InventorySystem } from '../systems/InventorySystem';
import { DialogSystem } from '../systems/DialogSystem';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';
import { UISystem } from '../systems/UISystem';
import { EventBus } from './EventBus';

export class Engine {
  public app: PIXI.Application;
  public camera: Camera;
  public currentScene: Scene | null = null;
  public isRunning = false;
  public containerElement: HTMLElement;

  private project: ProjectData | null = null;

  constructor(container: HTMLElement) {
    this.containerElement = container;
    this.app = new PIXI.Application();
    this.camera = new Camera(container.clientWidth || 1280, container.clientHeight || 720);
  }

  public async init(project: ProjectData): Promise<void> {
    this.project = project;

    await this.app.init({
      resizeTo: this.containerElement,
      backgroundColor: 0x0f172a,
      antialias: true,
      resolution: window.devicePixelRatio || 1
    });

    this.containerElement.appendChild(this.app.canvas);

    // Initialize systems
    InventorySystem.getInstance().clear();
    for (const item of project.items) {
      InventorySystem.getInstance().registerItem(item);
    }
    for (const dialog of project.dialogs) {
      DialogSystem.getInstance().registerDialog(dialog);
    }

    UISystem.getInstance().init(this.containerElement, project.uiConfig);
    StoryGraphSystem.getInstance().loadProject(project);

    // Listen for scene changes
    EventBus.getInstance().on('scene:change', async (payload: any) => {
      const sceneData = payload.scene || payload;
      await this.loadScene(sceneData, payload.spawnPoint);
    });

    // Listen for inventory additions
    EventBus.getInstance().on('inventory:give', (itemId: string) => {
      InventorySystem.getInstance().addItem(itemId);
    });

    // Listen for flags
    EventBus.getInstance().on('flag:set', (flag: string) => {
      StoryGraphSystem.getInstance().setFlag(flag, true);
    });

    // Global interaction listener on canvas
    this.app.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.app.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleCanvasRightClick(e);
    });

    // Start loop
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime / 60);
    });

    // Load initial scene
    const initialSceneData = StoryGraphSystem.getInstance().getCurrentScene();
    if (initialSceneData) {
      await this.loadScene(initialSceneData);
    }
  }

  public async loadScene(sceneData: any, spawnPoint?: Vector2D): Promise<void> {
    if (this.currentScene) {
      this.app.stage.removeChild(this.currentScene.container);
    }

    this.currentScene = new Scene(sceneData);
    await this.currentScene.init(this.camera);

    if (spawnPoint && this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.container.x = spawnPoint.x;
      this.currentScene.playerCharacter.container.y = spawnPoint.y;
    }

    this.app.stage.addChild(this.currentScene.container);
  }

  public update(delta: number): void {
    if (this.currentScene) {
      this.camera.update();
      this.currentScene.update(delta, this.camera);
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (!this.currentScene || DialogSystem.getInstance().isActive()) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates (factoring camera offset)
    const worldPoint: Vector2D = {
      x: screenX + this.camera.position.x,
      y: screenY + this.camera.position.y
    };

    const activeVerb = UISystem.getInstance().activeVerb;
    const selectedItem = InventorySystem.getInstance().getSelectedItem();
    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const player = this.currentScene.playerCharacter;
    const walkPath = this.currentScene.getWalkPath();

    if (selectedItem && hotspot) {
      // Use selected item on hotspot
      const action = hotspot.getActionForVerb('use');
      if (action && action.requireItemId === selectedItem.id) {
        if (player) {
          player.walkTo(hotspot.getCenter(), walkPath, () => {
            this.executeAction(action);
          });
        } else {
          this.executeAction(action);
        }
      } else {
        EventBus.getInstance().emit('ui:notify', `That doesn't seem to work with ${hotspot.data.name}.`);
      }
      InventorySystem.getInstance().selectItem(null);
      return;
    }

    if (hotspot) {
      const action = hotspot.getActionForVerb(activeVerb) || hotspot.data.actions[0];
      if (player) {
        player.walkTo(hotspot.getCenter(), walkPath, () => {
          if (action) this.executeAction(action);
        });
      } else if (action) {
        this.executeAction(action);
      }
    } else {
      // Walk to point
      if (player) {
        player.walkTo(worldPoint, walkPath);
      }
    }
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    // Right click defaults to 'look' or context menu
    UISystem.getInstance().setActiveVerb('look');
    this.handleCanvasClick(e);
  }

  private executeAction(action: any): void {
    if (action.requiredFlag && !StoryGraphSystem.getInstance().getFlag(action.requiredFlag)) {
      EventBus.getInstance().emit('ui:notify', `You cannot do that right now.`);
      return;
    }

    if (action.text) {
      EventBus.getInstance().emit('ui:notify', action.text);
    }
    if (action.setFlag) {
      StoryGraphSystem.getInstance().setFlag(action.setFlag, true);
    }
    if (action.giveItemId) {
      InventorySystem.getInstance().addItem(action.giveItemId);
    }
    if (action.dialogId) {
      DialogSystem.getInstance().startDialog(action.dialogId, (flag) => StoryGraphSystem.getInstance().getFlag(flag));
    }
    if (action.targetSceneId) {
      StoryGraphSystem.getInstance().changeScene(action.targetSceneId, action.targetSpawnPoint);
    }
  }

  public destroy(): void {
    this.app.destroy(true);
  }
}
