import * as PIXI from 'pixi.js';
import { ProjectData, Vector2D, VerbType } from '../types';
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
  private isPanning = false;
  private panStartScreen: Vector2D = { x: 0, y: 0 };
  private dragTarget: { type: 'layer' | 'hotspot_vertex' | 'walkpath_vertex' | 'character' | 'hotspot_poly' | 'perspective_horizon' | 'perspective_foreground'; id?: string; index?: number; hIdx?: number } | null = null;
  private dragStartWorld: Vector2D = { x: 0, y: 0 };
  private dragInitialPos: Vector2D = { x: 0, y: 0 };
  private dragInitialScale: number = 1;
  private dragInitialDist: number = 1;

  // Polygon Drawing & Graphical Editing
  private isDrawingPolygon = false;
  private drawingPolygonTarget: { type: 'hotspot' | 'walkpath'; hIdx?: number } | null = null;
  private drawingPoints: Vector2D[] = [];
  private mouseWorldPos: Vector2D | null = null;

  constructor(container: HTMLElement) {
    this.containerElement = container;
    this.app = new PIXI.Application();
    this.camera = new Camera(container.clientWidth || 1280, container.clientHeight || 720);
    this.debugOverlay = new PIXI.Graphics();

    window.addEventListener('keydown', (e) => {
      if (this.isDrawingPolygon) {
        if (e.key === 'Enter') {
          if (this.drawingPoints.length >= 3) {
            this.finishDrawingPolygon();
          } else {
            EventBus.getInstance().emit('ui:notify', '⚠️ Need at least 3 points to complete polygon.');
          }
        } else if (e.key === 'Escape') {
          this.isDrawingPolygon = false;
          this.drawingPolygonTarget = null;
          this.drawingPoints = [];
          this.renderDebugOverlay();
          EventBus.getInstance().emit('ui:notify', '❌ Canceled polygon draw mode.');
        }
      }
    });
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

    // Editor mode change listener
    EventBus.getInstance().on('editor:mode_changed', (data: { isPlayMode: boolean }) => {
      this.isEditorMode = !data.isPlayMode;
      if (data.isPlayMode) {
        this.camera.resetZoom();
        if (this.currentScene?.playerCharacter) {
          this.camera.follow(this.currentScene.playerCharacter.container);
        }
      } else {
        this.camera.follow(null);
      }
      this.renderDebugOverlay();
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

    // Scene change handler
    EventBus.getInstance().on('scene:change', async (data: any) => {
      const sceneData = data.scene || data;
      const spawnPoint = data.spawnPoint;
      if (sceneData) {
        await this.loadScene(sceneData, spawnPoint);
        this.selectedLayerId = null;
        this.selectedHotspotId = null;
        this.selectedCharacterId = null;
      }
    });

    // Dialog end handler
    EventBus.getInstance().on('dialog:end', () => {
      if (this.currentScene?.playerCharacter) {
        this.currentScene.playerCharacter.state = 'idle';
      }
    });

    // Project updated handler
    EventBus.getInstance().on('editor:project_updated', async () => {
      if (this.currentScene) {
        await this.loadScene(this.currentScene.data);
      }
    });

    // Polygon drawing handlers
    EventBus.getInstance().on('editor:start_draw_polygon', (payload: { type?: 'hotspot' | 'walkpath'; targetType?: 'hotspot' | 'walkpath'; hIdx?: number }) => {
      this.isDrawingPolygon = true;
      this.drawingPolygonTarget = { type: payload.targetType || payload.type || 'hotspot', hIdx: payload.hIdx };
      this.drawingPoints = [];
      EventBus.getInstance().emit('ui:notify', '✏️ DRAWING POLYGON MODE: Click canvas to place vertices. Click near 1st point or press Enter to complete.');
      this.renderDebugOverlay();
    });

    // Camera zoom event handlers
    EventBus.getInstance().on('camera:zoom_in', () => {
      this.camera.zoomBy(1.2);
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('camera:zoom_out', () => {
      this.camera.zoomBy(0.8);
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('camera:zoom_reset', () => {
      this.camera.resetZoom();
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('camera:zoom_fit', () => {
      this.camera.fitToViewport();
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
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

    // Mouse wheel zoom and verb cycling
    this.app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const worldPt = this.getWorldPoint(e);

      if (this.isEditorMode || e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.camera.zoomBy(factor);
        EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
        this.renderDebugOverlay();
        return;
      }

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

  private registerSceneDialogs(sceneData: any): void {
    DialogSystem.getInstance().clear();
    if (!this.project || !this.project.dialogs) return;

    const sceneDialogIds = new Set<string>();

    // 1. Collect dialogs from character actions
    if (sceneData.characters) {
      for (const char of sceneData.characters) {
        if (char.actions) {
          for (const act of char.actions) {
            if (act.dialogId) sceneDialogIds.add(act.dialogId);
          }
        }
      }
    }

    // 2. Collect dialogs from hotspot actions
    if (sceneData.hotspots) {
      for (const hs of sceneData.hotspots) {
        if (hs.actions) {
          for (const act of hs.actions) {
            if (act.dialogId) sceneDialogIds.add(act.dialogId);
          }
        }
      }
    }

    // Register ONLY dialog trees required for the active scene
    for (const dialogId of sceneDialogIds) {
      const tree = this.project.dialogs.find((d: any) => d.id === dialogId);
      if (tree) {
        DialogSystem.getInstance().registerDialog(tree);
      }
    }
  }

  public async loadScene(sceneData: any, spawnPoint?: Vector2D): Promise<void> {
    if (this.currentScene) {
      this.app.stage.removeChild(this.currentScene.container);
    }

    this.registerSceneDialogs(sceneData);

    this.currentScene = new Scene(sceneData);
    await this.currentScene.init(this.camera);

    if (spawnPoint && this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.container.x = spawnPoint.x;
      this.currentScene.playerCharacter.container.y = spawnPoint.y;
    }

    if (this.isEditorMode) {
      this.camera.follow(null);
    } else if (this.currentScene.playerCharacter) {
      this.camera.follow(this.currentScene.playerCharacter.container);
    }

    this.app.stage.addChild(this.currentScene.container);
    this.currentScene.container.addChild(this.debugOverlay);
    this.renderDebugOverlay();
  }

  public update(delta: number): void {
    if (this.currentScene) {
      this.camera.viewport = {
        width: this.containerElement.clientWidth || 1280,
        height: this.containerElement.clientHeight || 720
      };
      this.camera.update();
      this.currentScene.update(delta, this.camera);

      const sceneWidth = this.currentScene.data.width || 1920;
      const sceneHeight = this.currentScene.data.height || 1080;

      const viewCenterX = this.camera.viewport.width / 2;
      const viewCenterY = this.camera.viewport.height / 2;

      this.currentScene.container.scale.set(this.camera.zoom, this.camera.zoom);

      if (this.isEditorMode) {
        this.currentScene.container.pivot.set(sceneWidth / 2, sceneHeight / 2);
        this.currentScene.container.x = viewCenterX + this.camera.panOffset.x;
        this.currentScene.container.y = viewCenterY + this.camera.panOffset.y;
      } else {
        this.currentScene.container.pivot.set(0, 0);
        this.currentScene.container.x = -this.camera.position.x * this.camera.zoom;
        this.currentScene.container.y = -this.camera.position.y * this.camera.zoom;
      }
    }
  }

  private getWorldPoint(e: MouseEvent): Vector2D {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (!this.currentScene) return { x: 0, y: 0 };

    const sceneWidth = this.currentScene.data.width || 1920;
    const sceneHeight = this.currentScene.data.height || 1080;

    const viewCenterX = (this.containerElement.clientWidth || this.app.canvas.width || 1280) / 2;
    const viewCenterY = (this.containerElement.clientHeight || this.app.canvas.height || 720) / 2;

    if (this.isEditorMode) {
      const sceneCenterX = sceneWidth / 2;
      const sceneCenterY = sceneHeight / 2;

      const worldX = Math.round(sceneCenterX + (screenX - (viewCenterX + this.camera.panOffset.x)) / this.camera.zoom);
      const worldY = Math.round(sceneCenterY + (screenY - (viewCenterY + this.camera.panOffset.y)) / this.camera.zoom);
      return { x: worldX, y: worldY };
    } else {
      const worldX = Math.round(screenX / this.camera.zoom + this.camera.position.x);
      const worldY = Math.round(screenY / this.camera.zoom + this.camera.position.y);
      return { x: worldX, y: worldY };
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.isEditorMode || !this.currentScene) return;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isPanning = true;
      this.panStartScreen = { x: e.clientX, y: e.clientY };
      return;
    }

    const worldPt = this.getWorldPoint(e);

    // If Drawing Polygon From Scratch
    if (this.isDrawingPolygon) {
      if (this.drawingPoints.length >= 3) {
        const firstPt = this.drawingPoints[0];
        if (Math.hypot(worldPt.x - firstPt.x, worldPt.y - firstPt.y) < 15) {
          this.finishDrawingPolygon();
          return;
        }
      }
      this.drawingPoints.push({ x: Math.round(worldPt.x), y: Math.round(worldPt.y) });
      this.updateDrawingPolygonTarget();
      this.renderDebugOverlay();
      return;
    }

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

    // 2. Check Perspective Horizon & Foreground Handles
    const activeWp = this.currentScene.data.walkPaths[0];
    if (activeWp && activeWp.scaling) {
      const { minY, maxY, vanishX } = activeWp.scaling;
      const vx = vanishX ?? (this.currentScene.data.width / 2);
      if (Math.hypot(worldPt.x - vx, worldPt.y - minY) < 14) {
        this.isDragging = true;
        this.dragTarget = { type: 'perspective_horizon' };
        this.dragStartWorld = worldPt;
        this.dragInitialPos = { x: vx, y: minY };
        return;
      }
      if (Math.hypot(worldPt.x - vx, worldPt.y - maxY) < 14) {
        this.isDragging = true;
        this.dragTarget = { type: 'perspective_foreground' };
        this.dragStartWorld = worldPt;
        this.dragInitialPos = { x: vx, y: maxY };
        return;
      }
    }

    // 3. Check WalkPath vertices
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

    // Graphical Edge Insertion for selected Hotspot
    if (this.selectedHotspotId && this.currentScene) {
      const hsIdx = this.currentScene.data.hotspots.findIndex(h => h.id === this.selectedHotspotId);
      if (hsIdx !== -1) {
        const hs = this.currentScene.data.hotspots[hsIdx];
        for (let i = 0; i < hs.points.length; i++) {
          const ptA = hs.points[i];
          const ptB = hs.points[(i + 1) % hs.points.length];
          if (this.distanceToSegment(worldPt, ptA, ptB) < 10) {
            hs.points.splice(i + 1, 0, { x: Math.round(worldPt.x), y: Math.round(worldPt.y) });
            this.isDragging = true;
            this.dragTarget = { type: 'hotspot_vertex', hIdx: hsIdx, index: i + 1 };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: Math.round(worldPt.x), y: Math.round(worldPt.y) };
            EventBus.getInstance().emit('editor:project_updated');
            EventBus.getInstance().emit('ui:notify', '➕ Inserted new vertex point on edge!');
            this.renderDebugOverlay();
            return;
          }
        }
      }
    }

    // Graphical Edge Insertion for WalkPaths
    if (this.currentScene && this.currentScene.data.walkPaths) {
      for (const wp of this.currentScene.data.walkPaths) {
        for (let i = 0; i < wp.points.length; i++) {
          const ptA = wp.points[i];
          const ptB = wp.points[(i + 1) % wp.points.length];
          if (this.distanceToSegment(worldPt, ptA, ptB) < 10) {
            wp.points.splice(i + 1, 0, { x: Math.round(worldPt.x), y: Math.round(worldPt.y) });
            this.isDragging = true;
            this.dragTarget = { type: 'walkpath_vertex', index: i + 1 };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: Math.round(worldPt.x), y: Math.round(worldPt.y) };
            EventBus.getInstance().emit('editor:project_updated');
            EventBus.getInstance().emit('ui:notify', '➕ Inserted new vertex point on WalkPath edge!');
            this.renderDebugOverlay();
            return;
          }
        }
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

    if (this.isPanning) {
      const dx = e.clientX - this.panStartScreen.x;
      const dy = e.clientY - this.panStartScreen.y;
      this.camera.pan(dx, dy);
      this.panStartScreen = { x: e.clientX, y: e.clientY };
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
      return;
    }

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
      } else if (this.dragTarget.type === 'perspective_horizon') {
        const wp = this.currentScene.data.walkPaths[0];
        if (wp && wp.scaling) {
          wp.scaling.minY = Math.round(worldPt.y);
          EventBus.getInstance().emit('editor:project_updated');
        }
      } else if (this.dragTarget.type === 'perspective_foreground') {
        const wp = this.currentScene.data.walkPaths[0];
        if (wp && wp.scaling) {
          wp.scaling.maxY = Math.round(worldPt.y);
          EventBus.getInstance().emit('editor:project_updated');
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
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }
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
    const preset = UISystem.getInstance().config.preset;

    // 1. If an item IS selected, use item directly!
    if (selectedItem && (hotspot || charNPC)) {
      const targetHotspot = hotspot || (charNPC ? this.currentScene.findHotspotAt({ x: charNPC.container.x, y: charNPC.container.y - 40 }) : null);
      if (targetHotspot) {
        const action = targetHotspot.getActionForItemId(selectedItem.id) || targetHotspot.getBestAction('use', selectedItem.id);
        const targetCenter = targetHotspot.getCenter();
        if (action) {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => this.executeAction(action, targetCenter));
          } else {
            this.executeAction(action, targetCenter);
          }
        } else {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => {
              EventBus.getInstance().emit('ui:notify', `Using ${selectedItem.name} on ${targetHotspot.data.name} has no effect.`);
            });
          }
        }
      } else if (charNPC) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            EventBus.getInstance().emit('ui:notify', `Giving ${selectedItem.name} to ${charNPC.data.name} has no effect.`);
          });
        }
      }
      InventorySystem.getInstance().selectItem(null);
      UISystem.getInstance().setActiveVerb('walk');
      return;
    }

    // 2. Context coin mode opening ONLY when NO item is selected
    if (!selectedItem && (hotspot || charNPC) && preset === 'context_coin') {
      const rect = this.app.canvas.getBoundingClientRect();
      this.coinTargetHotspot = hotspot;
      UISystem.getInstance().showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }

    UISystem.getInstance().hideContextCoin();

    // 3. Interaction with NPC character (Direct Cursor, LucasArts, Sierra)
    if (charNPC && charNPC !== player) {
      let action = charNPC.getBestAction(activeVerb);
      if (!action) {
        action = charNPC.getBestAction('talk')
          || charNPC.getBestAction('interact')
          || charNPC.getBestAction('look')
          || (charNPC.data.actions ? charNPC.data.actions[0] : undefined);
      }
      if (action) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => this.executeAction(action, charNPC.position));
        } else {
          this.executeAction(action, charNPC.position);
        }
        return;
      }
      if (charNPC.data.actions && charNPC.data.actions[0]?.dialogId) {
        const dialogId = charNPC.data.actions[0].dialogId;
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            DialogSystem.getInstance().startDialog(dialogId, (flag) => StoryGraphSystem.getInstance().getFlag(flag));
          });
        } else {
          DialogSystem.getInstance().startDialog(dialogId, (flag) => StoryGraphSystem.getInstance().getFlag(flag));
        }
        return;
      }
    }

    // 4. Hotspot Interaction (Direct Cursor, LucasArts, Sierra)
    if (hotspot) {
      let action = hotspot.getBestAction(activeVerb);
      if (!action) {
        const cursorVerb = (hotspot.data.cursor as VerbType) || 'interact';
        action = hotspot.getBestAction(cursorVerb)
          || hotspot.getBestAction('interact')
          || hotspot.getBestAction('look')
          || hotspot.getBestAction('use')
          || hotspot.getBestAction('pick_up')
          || hotspot.getBestAction('open')
          || (hotspot.data.actions ? hotspot.data.actions[0] : undefined);
      }

      const targetCenter = hotspot.getCenter();
      if (action) {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            this.executeAction(action, targetCenter);
          });
        } else {
          this.executeAction(action, targetCenter);
        }
      } else {
        if (player) {
          player.walkTo(targetCenter, walkPath);
        }
      }
      return;
    }

    // 5. Empty ground click -> Walk
    if (player) {
      player.walkTo(worldPoint, walkPath);
    }
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    if (!this.currentScene) return;

    if (this.isEditorMode) {
      if (this.isDrawingPolygon) {
        if (this.drawingPoints.length > 0) {
          this.drawingPoints.pop();
          this.updateDrawingPolygonTarget();
          this.renderDebugOverlay();
          EventBus.getInstance().emit('ui:notify', '↩️ Undid last placed vertex point.');
        }
        return;
      }

      const worldPoint = this.getWorldPoint(e);

      // Check right-clicking a vertex point of selected hotspot
      if (this.selectedHotspotId) {
        const hsIdx = this.currentScene.data.hotspots.findIndex(h => h.id === this.selectedHotspotId);
        if (hsIdx !== -1) {
          const hs = this.currentScene.data.hotspots[hsIdx];
          for (let i = 0; i < hs.points.length; i++) {
            if (Math.hypot(worldPoint.x - hs.points[i].x, worldPoint.y - hs.points[i].y) < 14) {
              if (hs.points.length > 3) {
                hs.points.splice(i, 1);
                EventBus.getInstance().emit('editor:project_updated');
                EventBus.getInstance().emit('ui:notify', `🗑️ Deleted vertex point #${i + 1}`);
                this.renderDebugOverlay();
              } else {
                EventBus.getInstance().emit('ui:notify', '⚠️ Polygon must have at least 3 vertices.');
              }
              return;
            }
          }
        }
      }

      // Check right-clicking a walkpath vertex point
      for (const wp of this.currentScene.data.walkPaths) {
        for (let i = 0; i < wp.points.length; i++) {
          if (Math.hypot(worldPoint.x - wp.points[i].x, worldPoint.y - wp.points[i].y) < 14) {
            if (wp.points.length > 3) {
              wp.points.splice(i, 1);
              EventBus.getInstance().emit('editor:project_updated');
              EventBus.getInstance().emit('ui:notify', `🗑️ Deleted WalkPath vertex #${i + 1}`);
              this.renderDebugOverlay();
            } else {
              EventBus.getInstance().emit('ui:notify', '⚠️ WalkPath polygon must have at least 3 vertices.');
            }
            return;
          }
        }
      }
      return;
    }

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

  private finishDrawingPolygon(): void {
    if (!this.drawingPolygonTarget || !this.currentScene || this.drawingPoints.length < 3) return;

    if (this.drawingPolygonTarget.type === 'walkpath') {
      const wp = this.currentScene.data.walkPaths[0];
      if (wp) wp.points = [...this.drawingPoints];
    } else if (this.drawingPolygonTarget.type === 'hotspot' && this.drawingPolygonTarget.hIdx !== undefined) {
      const hs = this.currentScene.data.hotspots[this.drawingPolygonTarget.hIdx];
      if (hs) hs.points = [...this.drawingPoints];
    }

    const count = this.drawingPoints.length;
    this.isDrawingPolygon = false;
    this.drawingPolygonTarget = null;
    this.drawingPoints = [];
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('ui:notify', `✅ Completed polygon with ${count} vertices!`);
    this.renderDebugOverlay();
  }

  private updateDrawingPolygonTarget(): void {
    if (!this.drawingPolygonTarget || !this.currentScene) return;

    if (this.drawingPolygonTarget.type === 'walkpath') {
      const wp = this.currentScene.data.walkPaths[0];
      if (wp) wp.points = [...this.drawingPoints];
    } else if (this.drawingPolygonTarget.type === 'hotspot' && this.drawingPolygonTarget.hIdx !== undefined) {
      const hs = this.currentScene.data.hotspots[this.drawingPolygonTarget.hIdx];
      if (hs) hs.points = [...this.drawingPoints];
    }
  }

  private distanceToSegment(p: Vector2D, v: Vector2D, w: Vector2D): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
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

  private executeAction(action: any, targetPos?: Vector2D): void {
    if (action.requiredFlag && !StoryGraphSystem.getInstance().getFlag(action.requiredFlag)) {
      EventBus.getInstance().emit('ui:notify', `You cannot do that right now.`);
      return;
    }

    const player = this.currentScene?.playerCharacter;

    if (player) {
      if (targetPos) {
        player.faceTarget(targetPos);
      }
      if (action.faceDirection) {
        player.direction8Way = action.faceDirection;
        player.isFacingLeft = action.faceDirection === 'left' || action.faceDirection === 'up_left' || action.faceDirection === 'down_left';
      }
      if (action.playAnimation) {
        player.playCustomAnimation(action.playAnimation);
      } else if (action.verb === 'pick_up') {
        player.playCustomAnimation('pick_up', 1200);
      } else if (action.verb === 'talk') {
        player.talk();
      } else if (action.verb === 'use' && action.requireItemId) {
        player.holdItem(action.requireItemId);
      }
    }

    if (action.text) {
      EventBus.getInstance().emit('ui:notify', action.text);
      UISystem.getInstance().showSubtitle(action.text);
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

    // Draw Polygon Being Drawn From Scratch
    if (this.isDrawingPolygon && this.drawingPoints.length > 0) {
      this.debugOverlay.poly(this.drawingPoints.flatMap(p => [p.x, p.y]));
      this.debugOverlay.stroke({ color: 0xec4899, width: 3, alpha: 0.9 });
      this.debugOverlay.fill({ color: 0xec4899, alpha: 0.25 });

      for (let i = 0; i < this.drawingPoints.length; i++) {
        const pt = this.drawingPoints[i];
        this.debugOverlay.circle(pt.x, pt.y, i === 0 ? 9 : 6);
        this.debugOverlay.fill({ color: i === 0 ? 0x22c55e : 0xf472b6 });
        this.debugOverlay.stroke({ color: 0xffffff, width: 2 });
      }

      if (this.mouseWorldPos) {
        const lastPt = this.drawingPoints[this.drawingPoints.length - 1];
        this.debugOverlay.moveTo(lastPt.x, lastPt.y);
        this.debugOverlay.lineTo(this.mouseWorldPos.x, this.mouseWorldPos.y);
        this.debugOverlay.stroke({ color: 0xf472b6, width: 2, alpha: 0.8 });
      }
    }

    // Draw 2.5D Perspective Frustum & 3D Floor Grid Lines
    const activeWp = this.currentScene.data.walkPaths[0];
    if (activeWp && activeWp.scaling) {
      const { minY, maxY, minScale, maxScale, vanishX } = activeWp.scaling;
      const sceneW = this.currentScene.data.width || 1920;
      const vx = vanishX ?? (sceneW / 2);

      // 1. Horizon Line (minY) - Cyan
      this.debugOverlay.moveTo(0, minY);
      this.debugOverlay.lineTo(sceneW, minY);
      this.debugOverlay.stroke({ color: 0x06b6d4, width: 2, alpha: 0.9 });

      // 2. Foreground Line (maxY) - Gold
      this.debugOverlay.moveTo(0, maxY);
      this.debugOverlay.lineTo(sceneW, maxY);
      this.debugOverlay.stroke({ color: 0xf59e0b, width: 2, alpha: 0.9 });

      // 3. 3D Perspective Converging Rays to Vanishing Point (vx, minY)
      const numRays = 8;
      for (let i = 0; i <= numRays; i++) {
        const rayX = (sceneW / numRays) * i;
        this.debugOverlay.moveTo(rayX, maxY);
        this.debugOverlay.lineTo(vx, minY);
        this.debugOverlay.stroke({ color: 0x38bdf8, width: 1, alpha: 0.35 });
      }

      // 4. Horizontal Depth Floor Grid Lines (Perspective steps)
      const depthSteps = 5;
      for (let i = 1; i < depthSteps; i++) {
        const t = i / depthSteps;
        const depthY = minY + (maxY - minY) * Math.pow(t, 1.4);
        this.debugOverlay.moveTo(0, depthY);
        this.debugOverlay.lineTo(sceneW, depthY);
        this.debugOverlay.stroke({ color: 0x38bdf8, width: 1, alpha: 0.25 });
      }

      // 5. Interactive Horizon & Foreground Drag Handles
      this.debugOverlay.circle(vx, minY, 8);
      this.debugOverlay.fill({ color: 0x06b6d4 });
      this.debugOverlay.stroke({ color: 0xffffff, width: 2 });

      this.debugOverlay.circle(vx, maxY, 8);
      this.debugOverlay.fill({ color: 0xf59e0b });
      this.debugOverlay.stroke({ color: 0xffffff, width: 2 });
    }

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
