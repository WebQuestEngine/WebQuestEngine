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

  public selectedLayerId: string | null = null;
  public selectedHotspotId: string | null = null;
  public selectedCharacterId: string | null = null;

  // WYSIWYG Drag & Scale State
  private isDragging = false;
  private isScaling = false;
  private dragTarget: { type: 'layer' | 'hotspot_vertex' | 'walkpath_vertex' | 'character' | 'hotspot_poly'; id?: string; index?: number; hIdx?: number } | null = null;
  private dragStartWorld: Vector2D = { x: 0, y: 0 };
  private dragInitialPos: Vector2D = { x: 0, y: 0 };
  private dragInitialScale: number = 1;
  private dragInitialDist: number = 1;

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
      this.showNotification(this.isEditorMode ? 'Editor Mode (Drag & Scale enabled)' : 'Play Mode (Game active)');
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

    // Selection handlers
    EventBus.getInstance().on('editor:select_layer', (layerId: string) => {
      this.selectedLayerId = layerId;
      this.selectedHotspotId = null;
      this.selectedCharacterId = null;
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_hotspot', (hotspotId: string) => {
      this.selectedHotspotId = hotspotId;
      this.selectedLayerId = null;
      this.selectedCharacterId = null;
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_character', (characterId: string) => {
      this.selectedCharacterId = characterId;
      this.selectedLayerId = null;
      this.selectedHotspotId = null;
      this.renderDebugOverlay();
    });

    // Project updated handler
    EventBus.getInstance().on('editor:project_updated', async () => {
      if (this.currentScene) {
        await this.loadScene(this.currentScene.data);
      }
    });

    // Global canvas listeners
    this.app.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.app.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.app.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.app.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.app.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleCanvasRightClick(e);
    });

    // Mouse wheel cycles verbs in Direct Cursor and Sierra modes
    this.app.canvas.addEventListener('wheel', (e) => {
      if (this.isEditorMode) return;
      e.preventDefault();
      const verbs: ('walk' | 'look' | 'interact' | 'talk' | 'pick_up')[] = ['walk', 'look', 'interact', 'talk', 'pick_up'];
      const current = UISystem.getInstance().activeVerb;
      const idx = verbs.indexOf(current as any);
      const nextIdx = e.deltaY > 0 ? (idx + 1) % verbs.length : (idx - 1 + verbs.length) % verbs.length;
      const nextVerb = verbs[nextIdx];

      InventorySystem.getInstance().selectItem(null);
      UISystem.getInstance().setActiveVerb(nextVerb);
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

  private getWorldPoint(e: MouseEvent): Vector2D {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      x: Math.round(screenX + this.camera.position.x),
      y: Math.round(screenY + this.camera.position.y)
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.isEditorMode || !this.currentScene) return;
    const worldPt = this.getWorldPoint(e);

    // 1. Check selected layer corner handles for Aspect-Ratio Scaling
    if (this.selectedLayerId) {
      const layerData = this.currentScene.data.layers.find(l => l.id === this.selectedLayerId);
      const layerObj = this.currentScene.layers.find(l => l.data.id === this.selectedLayerId);
      if (layerData && layerObj && layerObj.sprite) {
        const lx = layerData.x || 0;
        const ly = layerData.y || 0;
        const lw = (layerObj.sprite.width || 1920) * (layerData.scaleX ?? 1);
        const lh = (layerObj.sprite.height || 1080) * (layerData.scaleY ?? 1);

        // Corner handles
        const handles = [
          { x: lx, y: ly },
          { x: lx + lw, y: ly },
          { x: lx + lw, y: ly + lh },
          { x: lx, y: ly + lh }
        ];

        for (const h of handles) {
          if (Math.hypot(worldPt.x - h.x, worldPt.y - h.y) < 14) {
            this.isScaling = true;
            this.dragTarget = { type: 'layer', id: layerData.id };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: lx, y: ly };
            this.dragInitialScale = layerData.scaleX ?? 1;
            this.dragInitialDist = Math.hypot(worldPt.x - (lx + lw / 2), worldPt.y - (ly + lh / 2));
            return;
          }
        }

        // Check if inside selected layer rectangle for Position Dragging
        if (worldPt.x >= lx && worldPt.x <= lx + lw && worldPt.y >= ly && worldPt.y <= ly + lh) {
          this.isDragging = true;
          this.dragTarget = { type: 'layer', id: layerData.id };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { x: lx, y: ly };
          return;
        }
      }
    }

    // 2. Check WalkPath vertices
    for (const wp of this.currentScene.data.walkPaths) {
      for (let i = 0; i < wp.points.length; i++) {
        const pt = wp.points[i];
        if (Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) < 12) {
          this.isDragging = true;
          this.dragTarget = { type: 'walkpath_vertex', index: i };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { ...pt };
          return;
        }
      }
    }

    // 3. Check Hotspot vertices and Hotspot Area
    for (let hIdx = 0; hIdx < this.currentScene.data.hotspots.length; hIdx++) {
      const hs = this.currentScene.data.hotspots[hIdx];
      for (let i = 0; i < hs.points.length; i++) {
        const pt = hs.points[i];
        if (Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) < 12) {
          this.isDragging = true;
          this.dragTarget = { type: 'hotspot_vertex', hIdx, index: i };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { ...pt };
          return;
        }
      }

      const hsObj = this.currentScene.hotspots[hIdx];
      if (hsObj && hsObj.containsPointInEditor(worldPt)) {
        this.isDragging = true;
        this.selectedHotspotId = hs.id;
        this.selectedLayerId = null;
        this.selectedCharacterId = null;
        this.dragTarget = { type: 'hotspot_poly', hIdx };
        this.dragStartWorld = worldPt;
        this.dragInitialPos = { x: worldPt.x, y: worldPt.y };
        EventBus.getInstance().emit('editor:select_hotspot', hs.id);
        EventBus.getInstance().emit('editor:element_selected', { type: 'hotspot', id: hs.id });
        this.renderDebugOverlay();
        return;
      }
    }

    // 4. Check Characters / NPCs
    const char = this.currentScene.findCharacterAt(worldPt);
    if (char) {
      this.isDragging = true;
      this.selectedCharacterId = char.data.id;
      this.selectedHotspotId = null;
      this.selectedLayerId = null;
      this.dragTarget = { type: 'character', id: char.data.id };
      this.dragStartWorld = worldPt;
      this.dragInitialPos = { x: char.container.x, y: char.container.y };
      EventBus.getInstance().emit('editor:select_character', char.data.id);
      EventBus.getInstance().emit('editor:element_selected', { type: 'character', id: char.data.id });
      this.renderDebugOverlay();
      return;
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.currentScene) return;
    const worldPt = this.getWorldPoint(e);

    // Perform Drag or Scale in Editor mode
    if (this.isEditorMode && (this.isDragging || this.isScaling) && this.dragTarget) {
      const dx = worldPt.x - this.dragStartWorld.x;
      const dy = worldPt.y - this.dragStartWorld.y;

      if (this.dragTarget.type === 'layer' && this.dragTarget.id) {
        const layerData = this.currentScene.data.layers.find(l => l.id === this.dragTarget!.id);
        const layerObj = this.currentScene.layers.find(l => l.data.id === this.dragTarget!.id);

        if (layerData && layerObj) {
          if (this.isScaling && layerObj.sprite) {
            // Keep Aspect Ratio: scaleX === scaleY
            const lx = layerData.x || 0;
            const ly = layerData.y || 0;
            const lw = (layerObj.sprite.width || 1920) * (layerData.scaleX ?? 1);
            const lh = (layerObj.sprite.height || 1080) * (layerData.scaleY ?? 1);
            const currentDist = Math.hypot(worldPt.x - (lx + lw / 2), worldPt.y - (ly + lh / 2));

            const aspectScale = Math.max(0.05, Math.round((this.dragInitialScale * (currentDist / (this.dragInitialDist || 1))) * 100) / 100);
            layerData.scaleX = aspectScale;
            layerData.scaleY = aspectScale; // Strictly preserve aspect ratio!
          } else {
            layerData.x = Math.round(this.dragInitialPos.x + dx);
            layerData.y = Math.round(this.dragInitialPos.y + dy);
          }
        }
      } else if (this.dragTarget.type === 'walkpath_vertex' && this.dragTarget.index !== undefined) {
        const wp = this.currentScene.data.walkPaths[0];
        if (wp && wp.points[this.dragTarget.index]) {
          wp.points[this.dragTarget.index].x = worldPt.x;
          wp.points[this.dragTarget.index].y = worldPt.y;
        }
      } else if (this.dragTarget.type === 'hotspot_vertex' && this.dragTarget.hIdx !== undefined && this.dragTarget.index !== undefined) {
        const hs = this.currentScene.data.hotspots[this.dragTarget.hIdx];
        const hsObj = this.currentScene.hotspots[this.dragTarget.hIdx];
        if (hs && hs.points[this.dragTarget.index]) {
          hs.points[this.dragTarget.index].x = worldPt.x;
          hs.points[this.dragTarget.index].y = worldPt.y;
          if (hsObj) {
            if (hs.position) {
              const center = hsObj.getCenter();
              hs.position.x = center.x;
              hs.position.y = center.y;
            }
            hsObj.update();
          }
        }
      } else if (this.dragTarget.type === 'hotspot_poly' && this.dragTarget.hIdx !== undefined) {
        const hs = this.currentScene.data.hotspots[this.dragTarget.hIdx];
        const hsObj = this.currentScene.hotspots[this.dragTarget.hIdx];
        if (hs) {
          for (const pt of hs.points) {
            pt.x += dx;
            pt.y += dy;
          }
          if (hs.position) {
            hs.position.x += dx;
            hs.position.y += dy;
          }
          if (hsObj) {
            hsObj.update();
          }
          this.dragStartWorld = worldPt;
        }
      } else if (this.dragTarget.type === 'character' && this.dragTarget.id) {
        const charData = this.currentScene.data.characters.find(c => c.id === this.dragTarget!.id);
        const charObj = this.currentScene.characters.get(this.dragTarget!.id);
        if (charData && charObj) {
          charData.position.x = Math.round(this.dragInitialPos.x + dx);
          charData.position.y = Math.round(this.dragInitialPos.y + dy);
          charObj.container.x = charData.position.x;
          charObj.container.y = charData.position.y;
        }
      }

      this.renderDebugOverlay();
      return;
    }

    // Hover tooltip processing
    const hotspot = this.currentScene.findHotspotAt(worldPt);
    const charNPC = this.currentScene.findCharacterAt(worldPt);
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

  private handleMouseUp(e: MouseEvent): void {
    if (this.isDragging || this.isScaling) {
      this.isDragging = false;
      this.isScaling = false;
      this.dragTarget = null;
      EventBus.getInstance().emit('editor:project_updated');
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (this.isEditorMode || !this.currentScene || DialogSystem.getInstance().isActive()) return;
    const worldPoint = this.getWorldPoint(e);

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
      const rect = this.app.canvas.getBoundingClientRect();
      this.coinTargetHotspot = hotspot;
      UISystem.getInstance().showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
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
    if (this.isEditorMode || !this.currentScene) return;
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = this.getWorldPoint(e);

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
    if (this.isEditorMode || !this.currentScene) return;
    const itemId = e.dataTransfer?.getData('text/plain') || InventorySystem.getInstance().getSelectedItem()?.id;
    if (!itemId) return;

    const worldPoint = this.getWorldPoint(e as any);

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
          this.debugOverlay.circle(pt.x, pt.y, 6);
          this.debugOverlay.fill({ color: 0x22d3ee });
          this.debugOverlay.stroke({ color: 0xffffff, width: 1.5 });
        }
      }
    }

    // Draw Hotspots
    for (const hs of this.currentScene.data.hotspots) {
      if (hs.points.length >= 3) {
        const isSelected = this.selectedHotspotId === hs.id;
        this.debugOverlay.poly(hs.points.flatMap(p => [p.x, p.y]));
        this.debugOverlay.fill({ color: isSelected ? 0x8b5cf6 : 0xfbbf24, alpha: isSelected ? 0.4 : 0.2 });
        this.debugOverlay.stroke({ color: isSelected ? 0xa855f7 : 0xd97706, width: isSelected ? 4 : 2, alpha: 0.9 });

        for (const pt of hs.points) {
          this.debugOverlay.circle(pt.x, pt.y, isSelected ? 7 : 5);
          this.debugOverlay.fill({ color: isSelected ? 0xc084fc : 0xfef08a });
          this.debugOverlay.stroke({ color: isSelected ? 0x7e22ce : 0xd97706, width: 1.5 });
        }
      }
    }

    // Draw Selected Character Highlight
    if (this.selectedCharacterId && this.currentScene) {
      const charObj = this.currentScene.characters.get(this.selectedCharacterId);
      if (charObj) {
        const cx = charObj.container.x;
        const cy = charObj.container.y;
        const hw = (charObj.data.frameWidth * charObj.data.scale) / 2;
        const hh = charObj.data.frameHeight * charObj.data.scale;
        this.debugOverlay.rect(cx - hw, cy - hh, hw * 2, hh);
        this.debugOverlay.stroke({ color: 0x8b5cf6, width: 3, alpha: 0.9 });
      }
    }

    // Draw Selected Layer Aspect-Ratio Scale & Move Handles
    if (this.selectedLayerId && this.currentScene) {
      const selectedLayer = this.currentScene.layers.find(l => l.data.id === this.selectedLayerId);
      if (selectedLayer && selectedLayer.sprite) {
        const lx = selectedLayer.data.x || 0;
        const ly = selectedLayer.data.y || 0;
        const lw = (selectedLayer.sprite.width || 1920) * (selectedLayer.data.scaleX ?? 1);
        const lh = (selectedLayer.sprite.height || 1080) * (selectedLayer.data.scaleY ?? 1);

        this.debugOverlay.rect(lx, ly, lw, lh);
        this.debugOverlay.stroke({ color: 0xa855f7, width: 3, alpha: 0.9 });
        this.debugOverlay.fill({ color: 0xa855f7, alpha: 0.12 });

        const handles = [
          { x: lx, y: ly },
          { x: lx + lw, y: ly },
          { x: lx + lw, y: ly + lh },
          { x: lx, y: ly + lh }
        ];

        for (const h of handles) {
          this.debugOverlay.rect(h.x - 7, h.y - 7, 14, 14);
          this.debugOverlay.fill({ color: 0xc084fc });
          this.debugOverlay.stroke({ color: 0xffffff, width: 2 });
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
