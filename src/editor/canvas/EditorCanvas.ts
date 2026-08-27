import { Application, Graphics, Container, Point } from 'pixi.js';
import { ProjectData, SceneData, Vector2D, WalkPathData, HotspotData, CharacterData, LayerData } from '../../engine/types';
import { Camera } from '../../engine/core/Camera';
import { Scene } from '../../engine/scene/Scene';
import { EventBus } from '../../engine/core/EventBus';

export class EditorCanvas {
  public app: Application;
  public camera: Camera;
  public containerElement: HTMLElement;
  public project: ProjectData;
  public currentScene: Scene | null = null;

  // Editor Gizmos & Overlays
  private debugOverlay: Graphics;
  private selectedElement: { type: string; id: string } | null = null;

  // Polygon & Vertex Editing
  private isDrawingPolygon = false;
  private drawingPoints: Vector2D[] = [];
  private activeSpawnPickerCallback: ((pt: Vector2D) => void) | null = null;
  private activeWalkPathPointIndex: number | null = null;
  private isDraggingPoint = false;
  private isPanning = false;
  private panStartScreen: Vector2D = { x: 0, y: 0 };
  private mouseWorldPos: Vector2D | null = null;

  constructor(containerElement: HTMLElement, project: ProjectData) {
    this.containerElement = containerElement;
    this.project = project;
    this.camera = new Camera(containerElement.clientWidth || 1280, containerElement.clientHeight || 720);

    this.app = new Application();
    this.debugOverlay = new Graphics();
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
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
    EventBus.getInstance().on('editor:select_element', (payload: { type: string; id: string }) => {
      this.selectedElement = payload;
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:start_draw_polygon', () => {
      this.isDrawingPolygon = true;
      this.drawingPoints = [];
      this.app.canvas.style.cursor = 'crosshair';
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:cancel_draw_polygon', () => {
      this.isDrawingPolygon = false;
      this.drawingPoints = [];
      this.app.canvas.style.cursor = 'default';
      this.renderDebugOverlay();
    });

    EventBus.getInstance().on('editor:pick_spawn_point', (callback: (pt: Vector2D) => void) => {
      this.activeSpawnPickerCallback = callback;
      this.app.canvas.style.cursor = 'crosshair';
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
      this.app.stage.removeChild(this.currentScene.container);
      this.currentScene.destroy();
      this.currentScene = null;
    }

    this.currentScene = new Scene(sceneData);
    await this.currentScene.init(this.camera);

    const activeWalkPath = this.currentScene.getWalkPath();
    // Freeze actors on static frame with NO animation in Editor Mode, but respecting scale and position
    for (const char of this.currentScene.characters.values()) {
      char.freezeFrame(activeWalkPath);
    }
    if (this.currentScene.playerCharacter) {
      this.currentScene.playerCharacter.freezeFrame(activeWalkPath);
    }

    this.camera.follow(null);
    this.camera.resetZoom();

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

    // Spawn point visual picker mode
    if (this.activeSpawnPickerCallback) {
      const cb = this.activeSpawnPickerCallback;
      this.activeSpawnPickerCallback = null;
      this.app.canvas.style.cursor = 'default';
      cb(worldPt);
      return;
    }

    // Polygon drawing mode
    if (this.isDrawingPolygon) {
      if (this.drawingPoints.length > 2) {
        const startPt = this.drawingPoints[0];
        const dist = Math.hypot(worldPt.x - startPt.x, worldPt.y - startPt.y);
        if (dist < 15) {
          // Close polygon
          this.isDrawingPolygon = false;
          this.app.canvas.style.cursor = 'default';
          EventBus.getInstance().emit('editor:polygon_completed', { points: [...this.drawingPoints] });
          this.drawingPoints = [];
          this.renderDebugOverlay();
          return;
        }
      }
      this.drawingPoints.push(worldPt);
      this.renderDebugOverlay();
      return;
    }

    // Check WalkPath vertex drag handle
    const activeWp = this.currentScene?.data.walkPaths[0];
    if (activeWp && this.selectedElement?.type === 'walkpath') {
      for (let i = 0; i < activeWp.points.length; i++) {
        const p = activeWp.points[i];
        if (Math.hypot(worldPt.x - p.x, worldPt.y - p.y) < 14 / this.camera.zoom) {
          this.activeWalkPathPointIndex = i;
          this.isDraggingPoint = true;
          return;
        }
      }
    }

    // Select scene elements on click
    if (this.currentScene) {
      const elem = this.currentScene.getElementAtPoint(worldPt);
      if (elem) {
        const type = (elem as any).characterData ? 'character' : 'hotspot';
        this.selectedElement = { type, id: elem.data.id };
        EventBus.getInstance().emit('editor:element_selected', this.selectedElement);
        this.renderDebugOverlay();
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.panStartScreen.x;
      const dy = e.clientY - this.panStartScreen.y;
      this.camera.pan(dx, dy);
      this.panStartScreen = { x: e.clientX, y: e.clientY };
      this.renderDebugOverlay();
      return;
    }

    this.mouseWorldPos = this.getWorldPoint(e);

    if (this.isDraggingPoint && this.activeWalkPathPointIndex !== null && this.currentScene) {
      const activeWp = this.currentScene.data.walkPaths[0];
      if (activeWp) {
        activeWp.points[this.activeWalkPathPointIndex] = { ...this.mouseWorldPos };
        this.renderDebugOverlay();
        EventBus.getInstance().emit('editor:project_updated');
        return;
      }
    }

    if (this.isDrawingPolygon) {
      this.renderDebugOverlay();
    }
  }

  private handleMouseUp(): void {
    if (this.isPanning) {
      this.isPanning = false;
    }
    if (this.isDraggingPoint) {
      this.isDraggingPoint = false;
      this.activeWalkPathPointIndex = null;
    }
  }

  public renderDebugOverlay(): void {
    this.debugOverlay.clear();
    if (!this.currentScene) return;

    const scene = this.currentScene.data;

    // Draw Walkable Polygons
    if (scene.walkPaths) {
      for (const wp of scene.walkPaths) {
        if (wp.points.length < 3) continue;
        const isSelected = this.selectedElement?.id === wp.id || this.selectedElement?.type === 'walkpath';

        this.debugOverlay.poly(wp.points.flatMap((p: Vector2D) => [p.x, p.y]));
        this.debugOverlay.stroke({ color: isSelected ? 0x38bdf8 : 0x06b6d4, width: isSelected ? 3 : 2, alpha: 0.85 });
        this.debugOverlay.fill({ color: isSelected ? 0x38bdf8 : 0x06b6d4, alpha: isSelected ? 0.25 : 0.12 });

        if (isSelected) {
          for (const pt of wp.points) {
            this.debugOverlay.circle(pt.x, pt.y, 6 / this.camera.zoom);
            this.debugOverlay.fill({ color: 0xffffff });
            this.debugOverlay.stroke({ color: 0x0284c7, width: 2 });
          }
        }
      }
    }

    // Draw Hotspots
    if (scene.hotspots) {
      for (const hs of scene.hotspots) {
        if (hs.points.length < 3) continue;
        const isSelected = this.selectedElement?.id === hs.id;

        this.debugOverlay.poly(hs.points.flatMap((p: Vector2D) => [p.x, p.y]));
        this.debugOverlay.stroke({ color: isSelected ? 0xfbbf24 : 0xf59e0b, width: isSelected ? 3 : 1.5, alpha: 0.8 });
        this.debugOverlay.fill({ color: isSelected ? 0xfbbf24 : 0xf59e0b, alpha: isSelected ? 0.3 : 0.1 });
      }
    }

    // Draw Polygon in Progress
    if (this.isDrawingPolygon && this.drawingPoints.length > 0) {
      this.debugOverlay.poly(this.drawingPoints.flatMap(p => [p.x, p.y]));
      this.debugOverlay.stroke({ color: 0xec4899, width: 2.5, alpha: 0.9 });
      this.debugOverlay.fill({ color: 0xec4899, alpha: 0.2 });

      for (let i = 0; i < this.drawingPoints.length; i++) {
        const pt = this.drawingPoints[i];
        this.debugOverlay.circle(pt.x, pt.y, i === 0 ? 8 : 5);
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

    // Draw 2.5D Perspective Scaling Lines
    const activeWp = scene.walkPaths?.[0];
    if (activeWp && activeWp.scaling && this.selectedElement?.type === 'walkpath') {
      const { minY, maxY, vanishX } = activeWp.scaling;
      const sceneW = scene.width || 1920;
      const vx = vanishX ?? (sceneW / 2);

      this.debugOverlay.moveTo(0, minY);
      this.debugOverlay.lineTo(sceneW, minY);
      this.debugOverlay.stroke({ color: 0x06b6d4, width: 2, alpha: 0.9 });

      this.debugOverlay.moveTo(0, maxY);
      this.debugOverlay.lineTo(sceneW, maxY);
      this.debugOverlay.stroke({ color: 0xf59e0b, width: 2, alpha: 0.9 });

      for (let i = 0; i <= 6; i++) {
        const rayX = (sceneW / 6) * i;
        this.debugOverlay.moveTo(rayX, maxY);
        this.debugOverlay.lineTo(vx, minY);
        this.debugOverlay.stroke({ color: 0x38bdf8, width: 1, alpha: 0.3 });
      }
    }
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (!this.currentScene) return { x: 0, y: 0 };

    const sceneWidth = this.currentScene.data.width || 1920;
    const sceneHeight = this.currentScene.data.height || 1080;

    const viewCenterX = (this.containerElement.clientWidth || window.innerWidth) / 2;
    const viewCenterY = (this.containerElement.clientHeight || window.innerHeight) / 2;

    const sceneCenterX = sceneWidth / 2;
    const sceneCenterY = sceneHeight / 2;

    const worldX = Math.round(sceneCenterX + (screenX - (viewCenterX + this.camera.panOffset.x)) / this.camera.zoom);
    const worldY = Math.round(sceneCenterY + (screenY - (viewCenterY + this.camera.panOffset.y)) / this.camera.zoom);
    return { x: worldX, y: worldY };
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
