import { Application, Graphics } from 'pixi.js';
import { ProjectData, SceneData, Vector2D, AspectRatioType } from '../../engine/types';
import { Camera } from '../../engine/core/Camera';
import { Scene } from '../../engine/scene/Scene';
import { EventBus } from '../../engine/core/EventBus';
import { CanvasGizmoRenderer } from './CanvasGizmoRenderer';
import { CanvasInteractionUtils } from './CanvasInteractionUtils';
import { PolygonEditorController } from './PolygonEditorController';

export class EditorCanvas {
  public app: Application;
  public camera: Camera;
  public containerElement: HTMLElement;
  public project: ProjectData;
  public currentScene: Scene | null = null;

  // Selection state
  public selectedLayerId: string | null = null;
  public selectedHotspotId: string | null = null;
  public selectedCharacterId: string | null = null;
  public selectedElement: { type: string; id: string } | null = null;

  // Editor Gizmos & Overlays
  private debugOverlay: Graphics;

  // Polygon controller
  public polygonController: PolygonEditorController;

  // Spawn picker
  private activeSpawnPickerCallback: ((pt: Vector2D, cancelled?: boolean) => void) | null = null;

  // Drag & Scaling state
  private isDragging = false;
  private isScaling = false;
  private isPanning = false;
  private dragTarget: { type: string; id?: string; hIdx?: number; index?: number } | null = null;
  private dragStartWorld: Vector2D = { x: 0, y: 0 };
  private dragInitialPos: Vector2D = { x: 0, y: 0 };
  private dragInitialScale = 1;
  private dragInitialDist = 1;
  private panStartScreen: Vector2D = { x: 0, y: 0 };
  private mouseWorldPos: Vector2D | null = null;

  constructor(containerElement: HTMLElement, project: ProjectData) {
    this.containerElement = containerElement;
    this.project = project;
    this.camera = new Camera(containerElement.clientWidth || 1280, containerElement.clientHeight || 720);

    this.app = new Application();
    this.debugOverlay = new Graphics();
    this.polygonController = new PolygonEditorController();
  }

  public async init(): Promise<void> {
    await this.app.init({
      width: this.containerElement.clientWidth || 1280,
      height: this.containerElement.clientHeight || 720,
      backgroundColor: 0x0f172a,
      resizeTo: this.containerElement,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app.canvas.style.display = 'block';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.containerElement.appendChild(this.app.canvas);

    this.setupInputListeners();
    this.setupEventHandlers();

    // Loop for render updates
    this.app.ticker.add(() => {
      this.update();
    });

    const activeScene = this.project.scenes[0];
    if (activeScene) {
      await this.loadScene(activeScene);
    }
  }

  private setupInputListeners(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseup', () => this.handleMouseUp());
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleCanvasRightClick(e);
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      this.camera.zoomBy(factor);
      EventBus.getInstance().emit('camera:zoom_changed', { zoom: this.camera.zoom });
      this.renderDebugOverlay();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        (window as any).__isSpacePressed = true;
        this.app.canvas.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        (window as any).__isSpacePressed = false;
        this.app.canvas.style.cursor = 'default';
      }
    });
  }

  private setupEventHandlers(): void {
    EventBus.getInstance().on('editor:select_layer', (layerId: string) => {
      this.selectedLayerId = layerId;
      this.selectedHotspotId = null;
      this.selectedCharacterId = null;
      this.selectedElement = { type: 'layer', id: layerId };
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_hotspot', (hotspotId: string) => {
      this.selectedHotspotId = hotspotId;
      this.selectedLayerId = null;
      this.selectedCharacterId = null;
      this.selectedElement = { type: 'hotspot', id: hotspotId };
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_character', (characterId: string) => {
      this.selectedCharacterId = characterId;
      this.selectedLayerId = null;
      this.selectedHotspotId = null;
      this.selectedElement = { type: 'character', id: characterId };
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_walkpath', (sceneId?: string) => {
      this.selectedLayerId = null;
      this.selectedHotspotId = null;
      this.selectedCharacterId = null;
      this.selectedElement = { type: 'walkpath', id: sceneId || '' };
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:select_element', (payload: { type: string; id: string }) => {
      this.selectedElement = payload;
      if (payload.type === 'layer') {
        this.selectedLayerId = payload.id;
        this.selectedHotspotId = null;
        this.selectedCharacterId = null;
      } else if (payload.type === 'hotspot') {
        this.selectedHotspotId = payload.id;
        this.selectedLayerId = null;
        this.selectedCharacterId = null;
      } else if (payload.type === 'character') {
        this.selectedCharacterId = payload.id;
        this.selectedLayerId = null;
        this.selectedHotspotId = null;
      } else if (payload.type === 'walkpath') {
        this.selectedLayerId = null;
        this.selectedHotspotId = null;
        this.selectedCharacterId = null;
      }
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:start_draw_polygon', (payload?: { type?: 'hotspot' | 'walkpath'; targetType?: 'hotspot' | 'walkpath'; hIdx?: number }) => {
      const targetType = payload?.targetType || payload?.type || 'hotspot';
      let hsId: string | undefined;
      if (targetType === 'hotspot' && payload?.hIdx !== undefined && this.currentScene) {
        hsId = this.currentScene.data.hotspots[payload.hIdx]?.id;
      } else if (targetType === 'hotspot' && this.selectedHotspotId) {
        hsId = this.selectedHotspotId;
      }

      if (this.isElementLocked(targetType, hsId)) {
        EventBus.getInstance().emit('ui:notify', '🔒 Cannot edit polygon: Element is locked!');
        return;
      }

      const hIdx = payload?.hIdx !== undefined ? payload.hIdx : (this.selectedHotspotId && this.currentScene ? this.currentScene.data.hotspots.findIndex(h => h.id === this.selectedHotspotId) : undefined);
      this.polygonController.startDrawing(targetType, hIdx);

      this.app.canvas.style.cursor = 'crosshair';
      EventBus.getInstance().emit('ui:notify', `✏️ Click points on scene to draw ${targetType} polygon. Click first point to complete, right-click to undo.`);
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:cancel_draw_polygon', () => {
      this.polygonController.cancelDrawing();
      this.app.canvas.style.cursor = 'default';
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:pick_spawn_point', (callback: (pt: Vector2D, cancelled?: boolean) => void) => {
      this.activeSpawnPickerCallback = callback;
      this.app.canvas.style.cursor = 'crosshair';
    });

    EventBus.getInstance().on('editor:cancel_pick_spawn', () => {
      if (this.activeSpawnPickerCallback) {
        this.activeSpawnPickerCallback = null;
        this.app.canvas.style.cursor = 'default';
      }
    });

    EventBus.getInstance().on('editor:project_updated', async () => {
      if (this.currentScene) {
        await this.currentScene.syncLayers();
        this.renderDebugOverlay();
      }
    });

    EventBus.getInstance().on('editor:change_viewport_preset', (presetStr: string) => {
      if (!this.project) return;
      const preset = presetStr as AspectRatioType;
      let w = 1920, h = 1080;
      if (preset === '16:9') { w = 1920; h = 1080; }
      else if (preset === '4:3') { w = 1440; h = 1080; }
      else if (preset === '16:10') { w = 1920; h = 1200; }
      else if (preset === '21:9') { w = 2560; h = 1080; }
      else if (preset === '1:1') { w = 1080; h = 1080; }
      else if (preset === 'custom') {
        w = this.project.viewportSettings?.width || 1920;
        h = this.project.viewportSettings?.height || 1080;
      }

      if (!this.project.viewportSettings) {
        this.project.viewportSettings = { aspectRatio: preset, width: w, height: h };
      } else {
        this.project.viewportSettings.aspectRatio = preset;
        this.project.viewportSettings.width = w;
        this.project.viewportSettings.height = h;
      }

      this.camera.setBounds(w, h);
      this.renderDebugOverlay();
      EventBus.getInstance().emit('editor:project_updated');
    });

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
  }

  public async loadScene(sceneData: SceneData): Promise<void> {
    if (this.currentScene) {
      if (this.debugOverlay && this.debugOverlay.parent) {
        this.debugOverlay.parent.removeChild(this.debugOverlay);
      }
      this.app.stage.removeChild(this.currentScene.container);
      this.currentScene.destroy();
      this.currentScene = null;
    }

    this.currentScene = new Scene(sceneData);
    await this.currentScene.init(this.camera);

    const activeWalkPath = this.currentScene.getWalkPath();
    for (const char of this.currentScene.characters.values()) {
      char.freezeFrame(activeWalkPath);
    }
    if (this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.freezeFrame(activeWalkPath);
    }

    this.camera.follow(null);
    this.camera.resetZoom();

    if (!this.debugOverlay || (this.debugOverlay as any).destroyed || (this.debugOverlay as any).context === null) {
      this.debugOverlay = new Graphics();
    }

    this.app.stage.addChild(this.currentScene.container);
    this.currentScene.container.addChild(this.debugOverlay);
    this.renderDebugOverlay();
  }

  public update(): void {
    if (!this.currentScene) return;

    this.camera.viewport = {
      width: this.containerElement.clientWidth || window.innerWidth,
      height: this.containerElement.clientHeight || window.innerHeight
    };
    this.camera.update();

    const activeWalkPath = this.currentScene.getWalkPath();
    for (const char of this.currentScene.characters.values()) {
      char.freezeFrame(activeWalkPath);
    }
    if (this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.freezeFrame(activeWalkPath);
    }
    for (const hs of this.currentScene.hotspots) {
      hs.update();
    }
    for (const layer of this.currentScene.layers) {
      layer.updateParallax(0, 0);
    }

    const sceneWidth = this.currentScene.data.width || 1920;
    const sceneHeight = this.currentScene.data.height || 1080;

    const viewCenterX = this.camera.viewport.width / 2;
    const viewCenterY = this.camera.viewport.height / 2;

    this.currentScene.container.scale.set(this.camera.zoom, this.camera.zoom);
    this.currentScene.container.pivot.set(sceneWidth / 2, sceneHeight / 2);
    this.currentScene.container.x = viewCenterX + this.camera.panOffset.x;
    this.currentScene.container.y = viewCenterY + this.camera.panOffset.y;
  }

  private handleMouseDown(e: MouseEvent): void {
    // Panning on Middle-click (1), Right-click (2), or Left-click with Alt/Space/Shift
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (e.altKey || e.shiftKey || (window as any).__isSpacePressed))) {
      this.isPanning = true;
      this.panStartScreen = { x: e.clientX, y: e.clientY };
      return;
    }

    const worldPt = this.getWorldPoint(e);

    // 0. Active Spawn Point Picker Mode
    if (this.activeSpawnPickerCallback) {
      const cb = this.activeSpawnPickerCallback;
      this.activeSpawnPickerCallback = null;
      this.app.canvas.style.cursor = 'default';
      cb(worldPt);
      return;
    }

    // 1. Drawing Polygon From Scratch Mode
    if (this.polygonController.isDrawingPolygon) {
      const res = this.polygonController.addDrawingPoint(worldPt, this.camera.zoom, this.currentScene);
      if (res.finished) {
        this.app.canvas.style.cursor = 'default';
        EventBus.getInstance().emit('editor:project_updated');
        EventBus.getInstance().emit('ui:notify', `✅ Completed polygon with ${res.count} vertices!`);
      }
      this.renderDebugOverlay();
      return;
    }

    if (!this.currentScene) return;

    // 2. Check Viewport Frame Corner Handles for Drag-Resizing
    const vpSettings = this.project?.viewportSettings || { aspectRatio: '16:9', width: 1920, height: 1080 };
    const vW = vpSettings.width || 1920;
    const vH = vpSettings.height || 1080;
    const vX = vpSettings.x ?? 0;
    const vY = vpSettings.y ?? 0;
    const vpCorners = [
      { x: vX, y: vY },
      { x: vX + vW, y: vY },
      { x: vX + vW, y: vY + vH },
      { x: vX, y: vY + vH }
    ];

    for (const c of vpCorners) {
      if (Math.hypot(worldPt.x - c.x, worldPt.y - c.y) < 16 / this.camera.zoom) {
        this.isScaling = true;
        this.dragTarget = { type: 'viewport_frame' };
        this.dragStartWorld = worldPt;
        this.dragInitialPos = { x: vW, y: vH };
        return;
      }
    }

    // 3. Check Selected Layer Corner Scale Handles (4 corners)
    if (this.selectedLayerId && this.currentScene) {
      const layerData = this.currentScene.data.layers.find(l => l.id === this.selectedLayerId);
      const layerObj = this.currentScene.layers.find(l => l.data.id === this.selectedLayerId);
      if (layerData && !this.isElementLocked('layer', layerData.id) && layerObj?.sprite) {
        const lx = layerData.x || 0;
        const ly = layerData.y || 0;
        const baseW = layerObj.sprite.texture?.width > 1 ? layerObj.sprite.texture.width : 1920;
        const baseH = layerObj.sprite.texture?.height > 1 ? layerObj.sprite.texture.height : 1080;
        const lw = baseW * (layerData.scaleX ?? 1);
        const lh = baseH * (layerData.scaleY ?? 1);

        const handles = [
          { x: lx, y: ly },
          { x: lx + lw, y: ly },
          { x: lx + lw, y: ly + lh },
          { x: lx, y: ly + lh }
        ];

        for (const h of handles) {
          if (Math.hypot(worldPt.x - h.x, worldPt.y - h.y) < 14 / this.camera.zoom) {
            this.isScaling = true;
            this.dragTarget = { type: 'layer', id: layerData.id };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: lx, y: ly };
            this.dragInitialScale = layerData.scaleX ?? 1;
            this.dragInitialDist = Math.hypot(worldPt.x - (lx + lw / 2), worldPt.y - (ly + lh / 2));
            return;
          }
        }
      }
    }

    // 4. Check Selected Character Corner Handles (Scale)
    if (this.selectedCharacterId && this.currentScene && !this.isElementLocked('character', this.selectedCharacterId)) {
      const charObj = this.currentScene.characters.get(this.selectedCharacterId);
      if (charObj) {
        const cx = charObj.container.x;
        const cy = charObj.container.y;
        const hw = (charObj.data.frameWidth * charObj.data.scale) / 2;
        const hh = charObj.data.frameHeight * charObj.data.scale;
        const handles = [
          { x: cx - hw, y: cy - hh },
          { x: cx + hw, y: cy - hh },
          { x: cx + hw, y: cy },
          { x: cx - hw, y: cy }
        ];

        for (const h of handles) {
          if (Math.hypot(worldPt.x - h.x, worldPt.y - h.y) < 14 / this.camera.zoom) {
            this.isScaling = true;
            this.dragTarget = { type: 'character', id: charObj.data.id };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: cx, y: cy };
            this.dragInitialScale = charObj.data.scale;
            this.dragInitialDist = Math.hypot(worldPt.x - cx, worldPt.y - (cy - hh / 2));
            return;
          }
        }
      }
    }

    // 5. Check Perspective Horizon & Foreground Drag Handles
    if (!this.isElementLocked('walkpath')) {
      const activeWp = this.currentScene.data.walkPaths?.[0];
      if (activeWp?.scaling) {
        const { minY, maxY, vanishX } = activeWp.scaling;
        const vx = vanishX ?? ((this.currentScene.data.width || 1920) / 2);
        if (Math.hypot(worldPt.x - vx, worldPt.y - minY) < 14 / this.camera.zoom) {
          this.isDragging = true;
          this.dragTarget = { type: 'perspective_horizon' };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { x: vx, y: minY };
          return;
        }
        if (Math.hypot(worldPt.x - vx, worldPt.y - maxY) < 14 / this.camera.zoom) {
          this.isDragging = true;
          this.dragTarget = { type: 'perspective_foreground' };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { x: vx, y: maxY };
          return;
        }
      }
    }

    // 6. Check WalkPath Vertices (Precise handle click)
    if (!this.isElementLocked('walkpath') && this.currentScene.data.walkPaths) {
      for (const wp of this.currentScene.data.walkPaths) {
        for (let i = 0; i < wp.points.length; i++) {
          const pt = wp.points[i];
          if (Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) < 12 / this.camera.zoom) {
            this.isDragging = true;
            this.dragTarget = { type: 'walkpath_vertex', index: i };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { ...pt };
            return;
          }
        }
      }
    }

    // 7. Check Hotspot Vertices (Precise handle click)
    if (this.currentScene.data.hotspots) {
      for (let hIdx = 0; hIdx < this.currentScene.data.hotspots.length; hIdx++) {
        const hs = this.currentScene.data.hotspots[hIdx];
        if (!this.isElementLocked('hotspot', hs.id)) {
          for (let i = 0; i < hs.points.length; i++) {
            const pt = hs.points[i];
            if (Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y) < 12 / this.camera.zoom) {
              this.selectedHotspotId = hs.id;
              this.selectedLayerId = null;
              this.selectedCharacterId = null;
              this.selectedElement = { type: 'hotspot', id: hs.id };
              this.isDragging = true;
              this.dragTarget = { type: 'hotspot_vertex', hIdx, index: i };
              this.dragStartWorld = worldPt;
              this.dragInitialPos = { ...pt };
              EventBus.getInstance().emit('editor:select_hotspot', hs.id);
              EventBus.getInstance().emit('editor:element_selected', { type: 'hotspot', id: hs.id });
              this.renderDebugOverlay();
              return;
            }
          }
        }
      }
    }

    // 8 & 9. Graphical Edge Insertion for Selected Hotspot and WalkPaths
    const edgeInsert = this.polygonController.tryInsertEdgeVertex(
      worldPt,
      this.camera.zoom,
      this.currentScene,
      this.selectedHotspotId
    );
    if (edgeInsert) {
      this.isDragging = true;
      this.dragTarget = { type: edgeInsert.type, hIdx: edgeInsert.hIdx, index: edgeInsert.index };
      this.dragStartWorld = worldPt;
      this.dragInitialPos = { ...edgeInsert.point };
      EventBus.getInstance().emit('editor:project_updated');
      EventBus.getInstance().emit(
        'ui:notify',
        edgeInsert.type === 'hotspot_vertex' ? '➕ Inserted new vertex point on edge!' : '➕ Inserted new vertex point on WalkPath edge!'
      );
      this.renderDebugOverlay();
      return;
    }

    // 10. Check Hotspot Polygon Body Click / Drag
    if (this.currentScene.data.hotspots) {
      for (let hIdx = 0; hIdx < this.currentScene.data.hotspots.length; hIdx++) {
        const hs = this.currentScene.data.hotspots[hIdx];
        const hsObj = this.currentScene.hotspots[hIdx];
        if (hsObj && hsObj.containsPointInEditor(worldPt)) {
          if (this.isElementLocked('hotspot', hs.id)) continue;

          this.selectedHotspotId = hs.id;
          this.selectedLayerId = null;
          this.selectedCharacterId = null;
          this.selectedElement = { type: 'hotspot', id: hs.id };
          this.isDragging = true;
          this.dragTarget = { type: 'hotspot_poly', hIdx };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { x: worldPt.x, y: worldPt.y };

          EventBus.getInstance().emit('editor:select_hotspot', hs.id);
          EventBus.getInstance().emit('editor:element_selected', { type: 'hotspot', id: hs.id });
          this.renderDebugOverlay();
          return;
        }
      }
    }

    // 11. Check Characters / NPCs Click / Drag
    const char = this.currentScene.findCharacterAt(worldPt, true);
    if (char && !this.isElementLocked('character', char.data.id)) {
      this.selectedCharacterId = char.data.id;
      this.selectedHotspotId = null;
      this.selectedLayerId = null;
      this.selectedElement = { type: 'character', id: char.data.id };
      this.isDragging = true;
      this.dragTarget = { type: 'character', id: char.data.id };
      this.dragStartWorld = worldPt;
      this.dragInitialPos = { x: char.container.x, y: char.container.y };
      EventBus.getInstance().emit('editor:select_character', char.data.id);
      EventBus.getInstance().emit('editor:element_selected', { type: 'character', id: char.data.id });
      this.renderDebugOverlay();
      return;
    }

    // 12. Check Selected Layer Body Drag (Move Layer position)
    if (this.selectedLayerId && this.currentScene) {
      const layerData = this.currentScene.data.layers.find(l => l.id === this.selectedLayerId);
      const layerObj = this.currentScene.layers.find(l => l.data.id === this.selectedLayerId);
      if (layerData && !this.isElementLocked('layer', layerData.id) && layerObj?.sprite) {
        const lx = layerData.x || 0;
        const ly = layerData.y || 0;
        const baseW = layerObj.sprite.texture?.width > 1 ? layerObj.sprite.texture.width : 1920;
        const baseH = layerObj.sprite.texture?.height > 1 ? layerObj.sprite.texture.height : 1080;
        const lw = baseW * (layerData.scaleX ?? 1);
        const lh = baseH * (layerData.scaleY ?? 1);

        if (worldPt.x >= lx && worldPt.x <= lx + lw && worldPt.y >= ly && worldPt.y <= ly + lh) {
          this.isDragging = true;
          this.dragTarget = { type: 'layer', id: layerData.id };
          this.dragStartWorld = worldPt;
          this.dragInitialPos = { x: lx, y: ly };
          return;
        }
      }
    }

    // 13. Check Layers Selection on Canvas Click
    if (this.currentScene && this.currentScene.data.layers) {
      const sortedLayers = [...this.currentScene.data.layers].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
      for (const lData of sortedLayers) {
        const lObj = this.currentScene.layers.find(l => l.data.id === lData.id);
        if (lObj?.sprite) {
          const lx = lData.x || 0;
          const ly = lData.y || 0;
          const baseW = lObj.sprite.texture?.width > 1 ? lObj.sprite.texture.width : 1920;
          const baseH = lObj.sprite.texture?.height > 1 ? lObj.sprite.texture.height : 1080;
          const lw = baseW * (lData.scaleX ?? 1);
          const lh = baseH * (lData.scaleY ?? 1);

          if (worldPt.x >= lx && worldPt.x <= lx + lw && worldPt.y >= ly && worldPt.y <= ly + lh) {
            if (this.isElementLocked('layer', lData.id)) continue;

            this.selectedLayerId = lData.id;
            this.selectedHotspotId = null;
            this.selectedCharacterId = null;
            this.selectedElement = { type: 'layer', id: lData.id };
            this.isDragging = true;
            this.dragTarget = { type: 'layer', id: lData.id };
            this.dragStartWorld = worldPt;
            this.dragInitialPos = { x: lx, y: ly };

            EventBus.getInstance().emit('editor:select_layer', lData.id);
            EventBus.getInstance().emit('editor:element_selected', { type: 'layer', id: lData.id });
            this.renderDebugOverlay();
            return;
          }
        }
      }
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
    this.mouseWorldPos = worldPt;

    // Perform Drag or Scale in Editor mode
    if ((this.isDragging || this.isScaling) && this.dragTarget) {
      const dx = worldPt.x - this.dragStartWorld.x;
      const dy = worldPt.y - this.dragStartWorld.y;

      if (this.dragTarget.type === 'layer' && this.dragTarget.id) {
        const layerData = this.currentScene.data.layers.find(l => l.id === this.dragTarget!.id);
        const layerObj = this.currentScene.layers.find(l => l.data.id === this.dragTarget!.id);
        if (layerData && layerObj && layerObj.sprite) {
          if (this.isScaling) {
            const lx = layerData.x || 0;
            const ly = layerData.y || 0;
            const baseW = layerObj.sprite.texture?.width > 1 ? layerObj.sprite.texture.width : 1920;
            const baseH = layerObj.sprite.texture?.height > 1 ? layerObj.sprite.texture.height : 1080;
            const currentDist = Math.hypot(worldPt.x - (lx + (baseW * (layerData.scaleX ?? 1)) / 2), worldPt.y - (ly + (baseH * (layerData.scaleY ?? 1)) / 2));
            const scaleFactor = currentDist / (this.dragInitialDist || 1);
            const aspectScale = Math.max(0.05, Math.min(10, Math.round(this.dragInitialScale * scaleFactor * 100) / 100));
            layerData.scaleX = aspectScale;
            layerData.scaleY = aspectScale;
          } else {
            layerData.x = Math.round(this.dragInitialPos.x + dx);
            layerData.y = Math.round(this.dragInitialPos.y + dy);
          }

          layerObj.updateParallax(this.camera.position.x, this.camera.position.y);
          EventBus.getInstance().emit('editor:project_updated');
          this.renderDebugOverlay();
        }
      } else if (this.dragTarget.type === 'perspective_horizon') {
        if (this.isElementLocked('walkpath')) return;
        const wp = this.currentScene.data.walkPaths?.[0];
        if (wp?.scaling) {
          wp.scaling.minY = Math.round(worldPt.y);
          EventBus.getInstance().emit('editor:project_updated');
        }
      } else if (this.dragTarget.type === 'perspective_foreground') {
        if (this.isElementLocked('walkpath')) return;
        const wp = this.currentScene.data.walkPaths?.[0];
        if (wp?.scaling) {
          wp.scaling.maxY = Math.round(worldPt.y);
          EventBus.getInstance().emit('editor:project_updated');
        }
      } else if (this.dragTarget.type === 'walkpath_vertex' && this.dragTarget.index !== undefined) {
        if (this.isElementLocked('walkpath')) return;
        const wp = this.currentScene.data.walkPaths?.[0];
        if (wp?.points[this.dragTarget.index]) {
          wp.points[this.dragTarget.index].x = worldPt.x;
          wp.points[this.dragTarget.index].y = worldPt.y;
          EventBus.getInstance().emit('editor:project_updated');
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
          EventBus.getInstance().emit('editor:project_updated');
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
          EventBus.getInstance().emit('editor:project_updated');
        }
      } else if (this.dragTarget.type === 'character' && this.dragTarget.id) {
        const charData = this.currentScene.data.characters.find(c => c.id === this.dragTarget!.id);
        const charObj = this.currentScene.characters.get(this.dragTarget!.id);
        if (charData && charObj) {
          if (this.isScaling) {
            const cx = charData.position.x;
            const cy = charData.position.y;
            const hh = (charData.frameHeight * this.dragInitialScale) / 2;
            const currentDist = Math.hypot(worldPt.x - cx, worldPt.y - (cy - hh));
            const scaleFactor = currentDist / (this.dragInitialDist || 1);
            const newScale = Math.max(0.1, Math.min(5, Math.round(this.dragInitialScale * scaleFactor * 100) / 100));
            charData.scale = newScale;
            charObj.data.scale = newScale;
            charObj.container.scale.set(newScale);
            EventBus.getInstance().emit('editor:project_updated');
          } else {
            charData.position.x = Math.round(this.dragInitialPos.x + dx);
            charData.position.y = Math.round(this.dragInitialPos.y + dy);
            charObj.container.x = charData.position.x;
            charObj.container.y = charData.position.y;
            EventBus.getInstance().emit('editor:project_updated');
          }
        }
      } else if (this.dragTarget.type === 'viewport_frame' && this.project) {
        let newW = Math.max(320, Math.round(this.dragInitialPos.x + dx));
        let newH = Math.max(240, Math.round(this.dragInitialPos.y + dy));

        const currentRatio = this.project.viewportSettings?.aspectRatio || '16:9';
        if (currentRatio === '16:9') {
          newH = Math.round(newW * (9 / 16));
        } else if (currentRatio === '4:3') {
          newH = Math.round(newW * (3 / 4));
        } else if (currentRatio === '16:10') {
          newH = Math.round(newW * (10 / 16));
        } else if (currentRatio === '21:9') {
          newH = Math.round(newW * (9 / 21));
        } else if (currentRatio === '1:1') {
          newH = newW;
        } else {
          if (this.project.viewportSettings) {
            this.project.viewportSettings.aspectRatio = 'custom';
          }
        }

        if (!this.project.viewportSettings) {
          this.project.viewportSettings = { aspectRatio: 'custom', width: newW, height: newH };
        }
        this.project.viewportSettings.width = newW;
        this.project.viewportSettings.height = newH;

        this.camera.setBounds(newW, newH);
        EventBus.getInstance().emit('editor:project_updated');
        this.renderDebugOverlay();
        return;
      }
    }

    if (this.polygonController.isDrawingPolygon) {
      this.renderDebugOverlay();
    }
  }

  private handleMouseUp(): void {
    if (this.isPanning) {
      this.isPanning = false;
    }
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTarget = null;
    }
    if (this.isScaling) {
      this.isScaling = false;
      this.dragTarget = null;
    }
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    if (!this.currentScene) return;

    if (this.activeSpawnPickerCallback) {
      const cb = this.activeSpawnPickerCallback;
      this.activeSpawnPickerCallback = null;
      this.app.canvas.style.cursor = 'default';
      cb({ x: 0, y: 0 }, true);
      EventBus.getInstance().emit('ui:notify', '❌ Spawn point selection cancelled.');
      return;
    }

    if (this.polygonController.isDrawingPolygon) {
      if (this.polygonController.undoDrawingPoint(this.currentScene)) {
        this.renderDebugOverlay();
        EventBus.getInstance().emit('ui:notify', '↩️ Undid last placed vertex point.');
      }
      return;
    }

    const worldPoint = this.getWorldPoint(e);
    const delRes = this.polygonController.tryDeleteVertex(
      worldPoint,
      this.camera.zoom,
      this.currentScene,
      this.selectedHotspotId
    );

    if (delRes) {
      if (delRes.success) {
        EventBus.getInstance().emit('editor:project_updated');
        this.renderDebugOverlay();
      }
      EventBus.getInstance().emit('ui:notify', delRes.message);
    }
  }

  public renderDebugOverlay(): void {
    CanvasGizmoRenderer.render({
      debugOverlay: this.debugOverlay,
      currentScene: this.currentScene,
      project: this.project,
      camera: this.camera,
      isDrawingPolygon: this.polygonController.isDrawingPolygon,
      drawingPoints: this.polygonController.drawingPoints,
      mouseWorldPos: this.mouseWorldPos,
      selectedElement: this.selectedElement,
      selectedHotspotId: this.selectedHotspotId,
      selectedCharacterId: this.selectedCharacterId,
      selectedLayerId: this.selectedLayerId
    });
  }

  public isElementLocked(type: string, id?: string): boolean {
    return CanvasInteractionUtils.isElementLocked(this.project, this.currentScene, type, id);
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    return CanvasInteractionUtils.getWorldPoint(
      this.app.canvas,
      this.camera,
      this.currentScene,
      this.containerElement,
      e.clientX,
      e.clientY
    );
  }

  public setProject(project: ProjectData): void {
    this.project = project;
  }

  public destroy(): void {
    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }
    this.app.destroy(true, { children: true, texture: false });
  }
}
