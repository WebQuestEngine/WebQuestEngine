import { Application, Graphics, Container, FederatedPointerEvent } from 'pixi.js';
import { ProjectData, SceneData, Vector2D, VerbType, HotspotAction } from '../types';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { RuntimeContext } from './RuntimeContext';
import { EventBus } from '../core/EventBus';

export class GameRuntime {
  public app: Application;
  public camera: Camera;
  public context: RuntimeContext;
  public currentScene: Scene | null = null;
  public containerElement: HTMLElement;
  private isDestroyed = false;

  private viewportMask: Graphics;
  private dialogOverlayEl: HTMLElement | null = null;

  constructor(containerElement: HTMLElement, project: ProjectData) {
    this.containerElement = containerElement;
    this.context = new RuntimeContext(project, containerElement);
    this.camera = new Camera(containerElement.clientWidth || 1280, containerElement.clientHeight || 720);

    this.app = new Application();
    this.viewportMask = new Graphics();
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
    this.setupInputListeners();

    // Start game loop
    this.app.ticker.add((ticker) => {
      if (!this.isDestroyed) {
        this.update(ticker.deltaTime / 60);
      }
    });

    // Load initial scene
    const initialSceneData = this.context.story.getCurrentScene();
    if (initialSceneData) {
      await this.loadScene(initialSceneData);
    }
  }

  private setupEventHandlers(): void {
    // Scene change
    this.context.eventBus.on('scene:change', async (payload: any) => {
      const sceneData = payload.scene || payload;
      await this.loadScene(sceneData, payload.spawnPoint);
    });

    EventBus.getInstance().on('scene:change', async (payload: any) => {
      const sceneData = payload.scene || payload;
      await this.loadScene(sceneData, payload.spawnPoint);
    });

    // Inventory give & flag set
    EventBus.getInstance().on('inventory:give', (itemId: string) => {
      this.context.inventory.addItem(itemId);
    });

    EventBus.getInstance().on('flag:set', (flag: string) => {
      this.context.story.setFlag(flag, true);
    });

    // Dialogue presentation
    EventBus.getInstance().on('dialog:node', (data: any) => {
      this.renderDialogOverlay(data);
    });

    EventBus.getInstance().on('dialog:end', () => {
      if (this.dialogOverlayEl) {
        this.dialogOverlayEl.remove();
        this.dialogOverlayEl = null;
      }
    });
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('click', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasClick(e);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasMouseMove(e);
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.isDestroyed) return;
      this.handleCanvasWheel(e);
    }, { passive: false });
  }

  public async loadScene(sceneData: SceneData, spawnPoint?: Vector2D): Promise<void> {
    if (this.currentScene) {
      this.app.stage.removeChild(this.currentScene.container);
      this.currentScene.destroy();
      this.currentScene = null;
    }

    // Register required scene dialogues
    this.registerSceneDialogs(sceneData);

    this.currentScene = new Scene(sceneData);
    await this.currentScene.init(this.camera);

    // Position player
    if (spawnPoint && this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.container.x = spawnPoint.x;
      this.currentScene.playerCharacter.container.y = spawnPoint.y;
    }

    if (this.currentScene.playerCharacter) {
      this.camera.follow(this.currentScene.playerCharacter.container);
    }

    this.app.stage.addChild(this.currentScene.container);
    this.currentScene.container.addChild(this.viewportMask);

    // Play scene BGM
    if (sceneData.backgroundMusicUrl) {
      this.context.audio.playMusic(sceneData.backgroundMusicUrl);
    } else {
      this.context.audio.stopMusic(500);
    }
  }

  private registerSceneDialogs(sceneData: SceneData): void {
    this.context.dialog.clear();
    if (!this.context.project || !this.context.project.dialogs) return;

    const sceneDialogIds = new Set<string>();
    if (sceneData.characters) {
      for (const char of sceneData.characters) {
        if (char.actions) {
          for (const act of char.actions) {
            if (act.dialogId) sceneDialogIds.add(act.dialogId);
          }
        }
      }
    }
    if (sceneData.hotspots) {
      for (const hs of sceneData.hotspots) {
        if (hs.actions) {
          for (const act of hs.actions) {
            if (act.dialogId) sceneDialogIds.add(act.dialogId);
          }
        }
      }
    }

    for (const dialogId of sceneDialogIds) {
      const tree = this.context.project.dialogs.find(d => d.id === dialogId);
      if (tree) {
        this.context.dialog.registerDialog(tree);
      }
    }
  }

  public update(delta: number): void {
    if (!this.currentScene) return;

    this.camera.viewport = {
      width: this.containerElement.clientWidth || window.innerWidth,
      height: this.containerElement.clientHeight || window.innerHeight
    };
    this.camera.update();
    this.currentScene.update(delta, this.camera);

    const vp = this.context.project.viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    // Hard-clip to Viewport Rectangle & Stretch/Fit Screen Window
    this.viewportMask.visible = true;
    this.viewportMask.clear();
    this.viewportMask.rect(vpX, vpY, vpW, vpH);
    this.viewportMask.fill({ color: 0xffffff });
    this.currentScene.container.mask = this.viewportMask;

    const viewW = this.camera.viewport.width;
    const viewH = this.camera.viewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    this.currentScene.container.scale.set(playScale, playScale);
    this.currentScene.container.pivot.set(vpX, vpY);
    this.currentScene.container.x = offsetX;
    this.currentScene.container.y = offsetY;
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (!this.currentScene) return;

    const worldPt = this.getWorldPoint(e);
    const activeVerb = this.context.ui.activeVerb;
    const selectedItem = this.context.inventory.getSelectedItem();

    const clickedElement = this.currentScene.getElementAtPoint(worldPt);

    if (clickedElement) {
      const action = clickedElement.getBestAction(activeVerb, selectedItem?.id);
      if (action) {
        this.executeAction(action, clickedElement);
        return;
      }
    }

    // Default walk to ground point
    if (this.currentScene.playerCharacter && activeVerb === 'walk') {
      this.currentScene.playerCharacter.walkTo(worldPt);
    }
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (!this.currentScene) return;
    const worldPt = this.getWorldPoint(e);
    const hoveredElement = this.currentScene.getElementAtPoint(worldPt);

    if (hoveredElement) {
      const bestAction = (hoveredElement as any).getBestAction?.(this.context.ui.activeVerb, this.context.inventory.getSelectedItem()?.id);
      const verb = bestAction?.verb || this.context.ui.activeVerb;
      this.context.ui.updateHoverTitle(hoveredElement.data.name, verb);
    } else {
      this.context.ui.clearHoverTitle();
    }
  }

  private handleCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    const items = this.context.inventory.getItems();
    const currentItem = this.context.inventory.getSelectedItem();

    if (items.length > 0) {
      const itemIds: (string | null)[] = [null, ...items.map(i => i.id)];
      const currentId = currentItem ? currentItem.id : null;
      const idx = itemIds.indexOf(currentId);
      const nextIdx = e.deltaY > 0 ? (idx + 1) % itemIds.length : (idx - 1 + itemIds.length) % itemIds.length;
      const nextItemId = itemIds[nextIdx];
      this.context.inventory.selectItem(nextItemId);
      if (!nextItemId) {
        this.context.ui.setActiveVerb('interact');
      }
    }
  }

  public executeAction(action: HotspotAction, targetElement: any): void {
    const player = this.currentScene?.playerCharacter;

    if (player && action.targetSpawnPoint) {
      player.walkTo(action.targetSpawnPoint);
    }

    if (player) {
      if (action.playAnimation) {
        player.playCustomAnimation(action.playAnimation);
      } else if (action.verb === 'talk') {
        player.talk();
      }
    }

    if (action.sfxUrl) {
      this.context.audio.playSFX(action.sfxUrl);
    }

    if (action.text) {
      EventBus.getInstance().emit('ui:notify', action.text);
      this.context.ui.showSubtitle(action.text);
    }

    if (action.setFlag) {
      this.context.story.setFlag(action.setFlag, true);
    }

    if (action.giveItemId) {
      this.context.inventory.addItem(action.giveItemId);
    }

    if (action.dialogId) {
      this.context.dialog.startDialog(action.dialogId, (flag) => this.context.story.getFlag(flag));
    }

    if (action.targetSceneId) {
      this.context.story.changeScene(action.targetSceneId, action.targetSpawnPoint);
    }
  }

  public getCharacterScreenPos(speakerName?: string): Vector2D | null {
    if (!this.currentScene) return null;

    const chars = Array.from(this.currentScene.characters.values());
    let targetChar = null;
    if (speakerName) {
      targetChar = chars.find(c =>
        c.data.name.toLowerCase() === speakerName.toLowerCase() ||
        c.data.id.toLowerCase() === speakerName.toLowerCase()
      );
    }

    if (!targetChar && this.currentScene.playerCharacter) {
      targetChar = this.currentScene.playerCharacter;
    }

    if (!targetChar) return null;

    const worldX = targetChar.container.x || targetChar.position.x;
    const worldY = (targetChar.container.y || targetChar.position.y) - 145;

    return this.camera.toScreenPoint({ x: worldX, y: worldY });
  }

  private renderDialogOverlay(data: any): void {
    if (this.dialogOverlayEl) {
      this.dialogOverlayEl.remove();
      this.dialogOverlayEl = null;
    }

    const screenPos = this.getCharacterScreenPos(data.speaker);
    const overlay = document.createElement('div');
    overlay.className = `dialog-box-overlay ${screenPos ? 'in-world-bubble' : ''}`;

    if (screenPos) {
      overlay.style.left = `${screenPos.x}px`;
      overlay.style.top = `${screenPos.y}px`;
      overlay.style.transform = 'translate(-50%, -100%)';
      overlay.style.bottom = 'auto';
    }

    overlay.innerHTML = `
      ${data.portraitUrl ? `<img src="${data.portraitUrl}" class="dialog-portrait" onError="this.style.display='none'" />` : ''}
      <div class="dialog-content">
        <div class="dialog-speaker">${data.speaker}</div>
        <div class="dialog-text">${data.text}</div>
        ${data.choices && data.choices.length > 0 ? `
          <div class="dialog-choices">
            ${data.choices.map((c: any) => `
              <button class="dialog-choice-btn" data-choiceid="${c.id}">${c.text}</button>
            `).join('')}
          </div>
        ` : (data.hasNext ? `<button class="btn btn-primary" id="btn-dlg-next">Continue ➔</button>` : `<button class="btn btn-primary" id="btn-dlg-end">Close</button>`)}
      </div>
    `;

    overlay.querySelectorAll('.dialog-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.choiceid!;
        this.context.dialog.selectChoice(id, (flag) => this.context.story.getFlag(flag));
      });
    });

    overlay.querySelector('#btn-dlg-next')?.addEventListener('click', () => {
      this.context.dialog.advanceNextNode((flag) => this.context.story.getFlag(flag));
    });

    overlay.querySelector('#btn-dlg-end')?.addEventListener('click', () => {
      this.context.dialog.endDialog();
    });

    this.dialogOverlayEl = overlay;
    this.containerElement.appendChild(overlay);
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const vp = this.context.project.viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    const viewW = this.camera.viewport.width;
    const viewH = this.camera.viewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    return {
      x: Math.round(vpX + (screenX - offsetX) / playScale),
      y: Math.round(vpY + (screenY - offsetY) / playScale)
    };
  }

  public destroy(): void {
    this.isDestroyed = true;

    if (this.dialogOverlayEl) {
      this.dialogOverlayEl.remove();
      this.dialogOverlayEl = null;
    }

    this.context.destroy();

    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }

    this.app.destroy(true, { children: true, texture: false });
  }
}
