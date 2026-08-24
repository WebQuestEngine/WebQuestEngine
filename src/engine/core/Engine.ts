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
  public isEditorMode = true;

  private project: ProjectData | null = null;
  private debugOverlay: PIXI.Graphics;
  private coinTargetHotspot: any = null;

  constructor(container: HTMLElement) {
    this.containerElement = container;
    this.app = new PIXI.Application();
    this.camera = new Camera(container.clientWidth || 1280, container.clientHeight || 720);
    this.debugOverlay = new PIXI.Graphics();
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

    // Mode changed handler
    EventBus.getInstance().on('editor:mode_changed', (data: { isPlayMode: boolean }) => {
      this.isEditorMode = !data.isPlayMode;
      this.renderDebugOverlay();
      this.showNotification(this.isEditorMode ? 'Editor Mode (Character frozen)' : 'Play Mode (Game active)');
    });

    // Coin verb listener
    EventBus.getInstance().on('ui:coin_verb', (verb: any) => {
      if (this.coinTargetHotspot) {
        const action = this.coinTargetHotspot.getBestAction(verb);
        const player = this.currentScene?.playerCharacter;
        const walkPath = this.currentScene?.getWalkPath();

        if (action) {
          if (!this.isEditorMode && player) {
            player.walkTo(this.coinTargetHotspot.getCenter(), walkPath, () => {
              this.executeAction(action);
            });
          } else {
            this.executeAction(action);
          }
        }
        this.coinTargetHotspot = null;
      }
    });

    // Project updated handler
    EventBus.getInstance().on('editor:project_updated', async () => {
      if (this.currentScene) {
        await this.loadScene(this.currentScene.data);
      }
    });

    // Global canvas listeners
    this.app.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.app.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.app.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleCanvasRightClick(e);
    });

    // Drag & Drop onto WebGL canvas
    this.app.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    this.app.canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));

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
    this.currentScene.container.addChild(this.debugOverlay);
    this.renderDebugOverlay();
  }

  public update(delta: number): void {
    if (this.currentScene) {
      this.camera.update();
      this.currentScene.update(delta, this.camera);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.currentScene) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPoint: Vector2D = {
      x: screenX + this.camera.position.x,
      y: screenY + this.camera.position.y
    };

    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.currentScene.findCharacterAt(worldPoint);
    const selectedItem = InventorySystem.getInstance().getSelectedItem();
    const activeVerb = UISystem.getInstance().activeVerb;

    if (hotspot || charNPC) {
      this.app.canvas.style.cursor = 'pointer';

      const targetName = hotspot ? hotspot.data.name : charNPC!.data.name;
      let text = '';
      if (selectedItem) {
        text = `Use ${selectedItem.name} with ${targetName}`;
      } else {
        const action = hotspot ? hotspot.getBestAction(activeVerb) : null;
        if (action) {
          const verbStr = (action.verb || activeVerb).replace('_', ' ');
          text = `${verbStr.charAt(0).toUpperCase() + verbStr.slice(1)} ${targetName}`;
        } else if (charNPC) {
          text = `Talk to ${targetName}`;
        } else {
          text = `Look at ${targetName}`;
        }
      }

      const sentenceEl = this.containerElement.querySelector('#ui-action-sentence');
      if (sentenceEl) {
        sentenceEl.textContent = text;
      }
    } else {
      this.app.canvas.style.cursor = this.isEditorMode ? 'crosshair' : 'default';

      const sentenceEl = this.containerElement.querySelector('#ui-action-sentence');
      if (sentenceEl) {
        if (selectedItem) {
          sentenceEl.textContent = `Use ${selectedItem.name} with`;
        } else {
          const verbLabel = activeVerb.replace('_', ' ');
          sentenceEl.textContent = `${verbLabel.charAt(0).toUpperCase() + verbLabel.slice(1)} to`;
        }
      }
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (!this.currentScene || DialogSystem.getInstance().isActive()) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPoint: Vector2D = {
      x: Math.round(screenX + this.camera.position.x),
      y: Math.round(screenY + this.camera.position.y)
    };

    const activeVerb = UISystem.getInstance().activeVerb;
    const selectedItem = InventorySystem.getInstance().getSelectedItem();
    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.currentScene.findCharacterAt(worldPoint);
    const player = this.currentScene.playerCharacter;
    const walkPath = this.currentScene.getWalkPath();

    // If an item IS selected, use item directly! Do not open Context Coin!
    if (selectedItem && (hotspot || charNPC)) {
      const targetHotspot = hotspot || (charNPC ? this.currentScene.findHotspotAt({ x: charNPC.container.x, y: charNPC.container.y - 40 }) : null);
      if (targetHotspot) {
        const action = targetHotspot.getActionForItemId(selectedItem.id) || targetHotspot.getBestAction('use', selectedItem.id);
        if (action) {
          if (!this.isEditorMode && player) {
            player.walkTo(targetHotspot.getCenter(), walkPath, () => this.executeAction(action));
          } else {
            this.executeAction(action);
          }
        } else {
          EventBus.getInstance().emit('ui:notify', `That doesn't seem to work with ${targetHotspot.data.name}.`);
        }
      }
      InventorySystem.getInstance().selectItem(null);
      UISystem.getInstance().setActiveVerb('walk');
      return;
    }

    // Context coin mode opening ONLY when NO item is selected
    if (!selectedItem && (hotspot || charNPC) && UISystem.getInstance().config.preset === 'context_coin') {
      this.coinTargetHotspot = hotspot;
      UISystem.getInstance().showContextCoin(screenX, screenY);
      return;
    }

    UISystem.getInstance().hideContextCoin();

    // Interaction with NPC character
    if (charNPC) {
      const npcHotspot = this.currentScene.findHotspotAt({ x: charNPC.container.x, y: charNPC.container.y - 40 });
      if (npcHotspot) {
        const action = npcHotspot.getBestAction(activeVerb);
        if (action) {
          if (!this.isEditorMode && player) {
            player.walkTo(npcHotspot.getCenter(), walkPath, () => this.executeAction(action));
          } else {
            this.executeAction(action);
          }
          return;
        }
      }
      DialogSystem.getInstance().startDialog('dlg_eldrin', (flag) => StoryGraphSystem.getInstance().getFlag(flag));
      return;
    }

    if (hotspot) {
      const action = hotspot.getBestAction(activeVerb);
      if (!this.isEditorMode && player) {
        player.walkTo(hotspot.getCenter(), walkPath, () => {
          if (action) this.executeAction(action);
        });
      } else if (action) {
        this.executeAction(action);
      }
    } else {
      if (!this.isEditorMode && player) {
        player.walkTo(worldPoint, walkPath);
      }
    }
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    if (!this.currentScene) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPoint: Vector2D = {
      x: Math.round(screenX + this.camera.position.x),
      y: Math.round(screenY + this.camera.position.y)
    };

    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    const selectedItem = InventorySystem.getInstance().getSelectedItem();

    if (!selectedItem && hotspot && UISystem.getInstance().config.preset === 'context_coin') {
      this.coinTargetHotspot = hotspot;
      UISystem.getInstance().showContextCoin(screenX, screenY);
      return;
    }

    UISystem.getInstance().setActiveVerb('look');
    this.handleCanvasClick(e);
  }

  private handleCanvasDrop(e: DragEvent): void {
    e.preventDefault();
    const itemId = e.dataTransfer?.getData('text/plain') || InventorySystem.getInstance().getSelectedItem()?.id;
    if (!itemId || !this.currentScene) return;

    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPoint: Vector2D = {
      x: Math.round(screenX + this.camera.position.x),
      y: Math.round(screenY + this.camera.position.y)
    };

    const hotspot = this.currentScene.findHotspotAt(worldPoint);
    if (hotspot) {
      const action = hotspot.getActionForItemId(itemId) || hotspot.getBestAction('use', itemId);
      if (action) {
        const player = this.currentScene.playerCharacter;
        const walkPath = this.currentScene.getWalkPath();

        if (!this.isEditorMode && player) {
          player.walkTo(hotspot.getCenter(), walkPath, () => this.executeAction(action));
        } else {
          this.executeAction(action);
        }
      } else {
        EventBus.getInstance().emit('ui:notify', `That doesn't seem to work with ${hotspot.data.name}.`);
      }
    }

    InventorySystem.getInstance().selectItem(null);
    UISystem.getInstance().setActiveVerb('walk');
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

  private renderDebugOverlay(): void {
    this.debugOverlay.clear();
    if (!this.isEditorMode || !this.currentScene) return;

    // Draw WalkPaths
    for (const wp of this.currentScene.data.walkPaths) {
      if (wp.points.length >= 3) {
        this.debugOverlay.poly(wp.points.flatMap(p => [p.x, p.y]));
        this.debugOverlay.fill({ color: 0x06b6d4, alpha: 0.15 });
        this.debugOverlay.stroke({ color: 0x0891b2, width: 2, alpha: 0.8 });

        for (const pt of wp.points) {
          this.debugOverlay.circle(pt.x, pt.y, 5);
          this.debugOverlay.fill({ color: 0x22d3ee });
        }
      }
    }

    // Draw Hotspots
    for (const hs of this.currentScene.data.hotspots) {
      if (hs.points.length >= 3) {
        this.debugOverlay.poly(hs.points.flatMap(p => [p.x, p.y]));
        this.debugOverlay.fill({ color: 0xfbbf24, alpha: 0.2 });
        this.debugOverlay.stroke({ color: 0xd97706, width: 2, alpha: 0.9 });

        for (const pt of hs.points) {
          this.debugOverlay.circle(pt.x, pt.y, 4);
          this.debugOverlay.fill({ color: 0xfef08a });
        }
      }
    }
  }

  private showNotification(text: string): void {
    EventBus.getInstance().emit('ui:notify', text);
  }

  public destroy(): void {
    this.app.destroy(true);
  }
}
