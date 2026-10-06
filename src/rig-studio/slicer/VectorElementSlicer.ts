import { VectorOutlineElement } from '../types';
import { MarchingSquares, Point2D } from './MarchingSquares';

export type SlicerToolMode = 'select' | 'polygon' | 'magic' | 'pivot' | 'pan';

export interface SlicerEvents {
  onElementsChange?: (elements: VectorOutlineElement[]) => void;
  onSelectElement?: (element: VectorOutlineElement | null) => void;
  onTextureLoaded?: (img: HTMLImageElement) => void;
}

export class VectorElementSlicer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private image: HTMLImageElement | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private elements: VectorOutlineElement[] = [];
  private selectedElementId: string | null = null;

  // Viewport navigation
  private zoom = 1.0;
  private panX = 40;
  private panY = 40;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Active Tool
  private toolMode: SlicerToolMode = 'polygon';

  // In-progress polygon drawing
  private drawingPoints: Point2D[] = [];
  private hoverPoint: Point2D | null = null;

  // Vertex or Pivot dragging
  private draggingVertexIndex: number | null = null;
  private isDraggingPivot = false;
  private isSpacePressed = false;

  private events: SlicerEvents;

  constructor(container: HTMLElement, events: SlicerEvents = {}) {
    this.container = container;
    this.events = events;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'slicer-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })!;

    this.bindEvents();
    this.resizeCanvas();
  }

  public setToolMode(mode: SlicerToolMode): void {
    this.toolMode = mode;
    this.drawingPoints = [];
    this.draggingVertexIndex = null;
    this.isDraggingPivot = false;
    this.container.classList.toggle('panning', mode === 'pan');
    this.render();
  }

  public getToolMode(): SlicerToolMode {
    return this.toolMode;
  }

  public setElements(elements: VectorOutlineElement[]): void {
    this.elements = JSON.parse(JSON.stringify(elements));
    if (this.selectedElementId && !this.elements.some(e => e.id === this.selectedElementId)) {
      this.selectedElementId = this.elements[0]?.id || null;
    }
    this.render();
    if (this.events.onElementsChange) {
      this.events.onElementsChange(this.elements);
    }
  }

  public getElements(): VectorOutlineElement[] {
    return this.elements;
  }

  public getSelectedElement(): VectorOutlineElement | null {
    return this.elements.find(e => e.id === this.selectedElementId) || null;
  }

  public selectElement(id: string | null): void {
    this.selectedElementId = id;
    this.render();
    if (this.events.onSelectElement) {
      this.events.onSelectElement(this.getSelectedElement());
    }
  }

  public loadTexture(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.image = img;
        this.offscreenCanvas.width = img.naturalWidth;
        this.offscreenCanvas.height = img.naturalHeight;
        this.offscreenCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
        this.offscreenCtx.drawImage(img, 0, 0);

        // Center the view on load
        this.resetView();
        this.render();
        if (this.events.onTextureLoaded) {
          this.events.onTextureLoaded(img);
        }
        resolve();
      };
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  public resetView(): void {
    if (!this.image) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scaleX = (w - 80) / this.image.naturalWidth;
    const scaleY = (h - 80) / this.image.naturalHeight;
    this.zoom = Math.min(Math.max(0.5, Math.min(scaleX, scaleY)), 2.5);
    this.panX = Math.round((w - this.image.naturalWidth * this.zoom) / 2);
    this.panY = Math.round((h - this.image.naturalHeight * this.zoom) / 2);
    this.render();
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.2, Math.min(8.0, zoom));
    this.render();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  private screenToWorld(sx: number, sy: number): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    const x = (sx - rect.left - this.panX) / this.zoom;
    const y = (sy - rect.top - this.panY) / this.zoom;
    return { x, y };
  }

  private worldToScreen(wx: number, wy: number): Point2D {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY
    };
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(0.2, Math.min(8.0, this.zoom * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
    }, { passive: false });

    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this.toolMode === 'pan' || this.isSpacePressed) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        return;
      }

      if (e.button !== 0 || !this.image) return;

      const world = this.screenToWorld(e.clientX, e.clientY);

      if (this.toolMode === 'magic') {
        this.handleMagicClick(world.x, world.y);
      } else if (this.toolMode === 'polygon') {
        this.handlePolygonClick(world.x, world.y);
      } else if (this.toolMode === 'pivot') {
        this.handlePivotClick(world.x, world.y);
      } else if (this.toolMode === 'select') {
        this.handleSelectMouseDown(world.x, world.y);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX += e.clientX - this.lastMouseX;
        this.panY += e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.render();
        return;
      }

      if (!this.image) return;
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.hoverPoint = world;

      if (this.isDraggingPivot && this.selectedElementId) {
        const elem = this.getSelectedElement();
        if (elem) {
          elem.pivot = {
            x: Math.round(world.x - elem.bounds.x),
            y: Math.round(world.y - elem.bounds.y)
          };
          this.render();
          if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
        }
      } else if (this.draggingVertexIndex !== null && this.selectedElementId) {
        const elem = this.getSelectedElement();
        if (elem && elem.polygon[this.draggingVertexIndex]) {
          elem.polygon[this.draggingVertexIndex] = {
            x: Math.round(world.x),
            y: Math.round(world.y)
          };
          this.recalculateBounds(elem);
          this.render();
          if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
        }
      } else if (this.toolMode === 'polygon' && this.drawingPoints.length > 0) {
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isDraggingPivot = false;
      this.draggingVertexIndex = null;
    });

    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        this.isSpacePressed = true;
        this.container.classList.add('panning');
      } else if (e.key === 'Escape') {
        this.drawingPoints = [];
        this.render();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedElementId) {
          this.elements = this.elements.filter(el => el.id !== this.selectedElementId);
          this.selectedElementId = this.elements[0]?.id || null;
          this.render();
          if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
          if (this.events.onSelectElement) this.events.onSelectElement(this.getSelectedElement());
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (this.toolMode !== 'pan') {
          this.container.classList.remove('panning');
        }
      }
    });
  }

  private handleMagicClick(worldX: number, worldY: number): void {
    if (!this.image) return;
    const imageData = this.offscreenCtx.getImageData(0, 0, this.image.naturalWidth, this.image.naturalHeight);
    const contour = MarchingSquares.traceContour(imageData, worldX, worldY, 20, 2.0);

    if (contour && contour.length >= 3) {
      const id = `elem_${Date.now()}`;
      const name = `part_${this.elements.length + 1}`;
      const bounds = this.computePolygonBounds(contour);
      const pivot = {
        x: Math.round(bounds.width / 2),
        y: Math.round(bounds.height / 2)
      };

      const newElem: VectorOutlineElement = {
        id,
        name,
        polygon: contour,
        pivot,
        bounds,
        deformationMode: 'cutout'
      };

      this.elements.push(newElem);
      this.selectedElementId = id;
      this.render();
      if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
      if (this.events.onSelectElement) this.events.onSelectElement(newElem);
    }
  }

  private handlePolygonClick(worldX: number, worldY: number): void {
    const pt = { x: Math.round(worldX), y: Math.round(worldY) };

    // Check if clicked close to start point to close loop
    if (this.drawingPoints.length >= 3) {
      const start = this.drawingPoints[0];
      const dist = Math.hypot(pt.x - start.x, pt.y - start.y) * this.zoom;
      if (dist < 14) {
        // Complete element
        const id = `elem_${Date.now()}`;
        const name = `part_${this.elements.length + 1}`;
        const bounds = this.computePolygonBounds(this.drawingPoints);
        const pivot = {
          x: Math.round(bounds.width / 2),
          y: Math.round(bounds.height / 2)
        };

        const newElem: VectorOutlineElement = {
          id,
          name,
          polygon: [...this.drawingPoints],
          pivot,
          bounds,
          deformationMode: 'cutout'
        };

        this.elements.push(newElem);
        this.selectedElementId = id;
        this.drawingPoints = [];
        this.render();
        if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
        if (this.events.onSelectElement) this.events.onSelectElement(newElem);
        return;
      }
    }

    this.drawingPoints.push(pt);
    this.render();
  }

  private handlePivotClick(worldX: number, worldY: number): void {
    const elem = this.getSelectedElement();
    if (!elem) return;

    elem.pivot = {
      x: Math.round(worldX - elem.bounds.x),
      y: Math.round(worldY - elem.bounds.y)
    };
    this.isDraggingPivot = true;
    this.render();
    if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
  }

  private handleSelectMouseDown(worldX: number, worldY: number): void {
    const selected = this.getSelectedElement();
    if (selected) {
      // Check if clicking pivot
      const pivotWorldX = selected.bounds.x + selected.pivot.x;
      const pivotWorldY = selected.bounds.y + selected.pivot.y;
      if (Math.hypot(worldX - pivotWorldX, worldY - pivotWorldY) * this.zoom < 12) {
        this.isDraggingPivot = true;
        return;
      }

      // Check if clicking a vertex
      for (let i = 0; i < selected.polygon.length; i++) {
        const v = selected.polygon[i];
        if (Math.hypot(worldX - v.x, worldY - v.y) * this.zoom < 10) {
          this.draggingVertexIndex = i;
          return;
        }
      }
    }

    // Check hit on any element polygon
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const elem = this.elements[i];
      if (this.isPointInPolygon({ x: worldX, y: worldY }, elem.polygon)) {
        this.selectedElementId = elem.id;
        this.render();
        if (this.events.onSelectElement) this.events.onSelectElement(elem);
        return;
      }
    }

    // Clicked empty space
    this.selectedElementId = null;
    this.render();
    if (this.events.onSelectElement) this.events.onSelectElement(null);
  }

  private isPointInPolygon(p: Point2D, poly: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private computePolygonBounds(poly: Point2D[]): { x: number; y: number; width: number; height: number } {
    if (poly.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = poly[0].x;
    let maxX = poly[0].x;
    let minY = poly[0].y;
    let maxY = poly[0].y;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.max(1, Math.round(maxX - minX)),
      height: Math.max(1, Math.round(maxY - minY))
    };
  }

  private recalculateBounds(elem: VectorOutlineElement): void {
    elem.bounds = this.computePolygonBounds(elem.polygon);
  }

  /**
   * Generates a trimmed, isolated data URL image for an element.
   */
  public generateThumbnail(elem: VectorOutlineElement): string {
    if (!this.image) return '';
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = elem.bounds.width;
    thumbCanvas.height = elem.bounds.height;
    const tctx = thumbCanvas.getContext('2d');
    if (!tctx) return '';

    tctx.save();
    // Clip with polygon
    tctx.beginPath();
    for (let i = 0; i < elem.polygon.length; i++) {
      const px = elem.polygon[i].x - elem.bounds.x;
      const py = elem.polygon[i].y - elem.bounds.y;
      if (i === 0) tctx.moveTo(px, py);
      else tctx.lineTo(px, py);
    }
    tctx.closePath();
    tctx.clip();

    tctx.drawImage(
      this.image,
      elem.bounds.x,
      elem.bounds.y,
      elem.bounds.width,
      elem.bounds.height,
      0,
      0,
      elem.bounds.width,
      elem.bounds.height
    );
    tctx.restore();

    return thumbCanvas.toDataURL('image/png');
  }

  public render(): void {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    if (!this.image) {
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('No image loaded. Import a graphics file to begin slicing.', w / 2, h / 2);
      return;
    }

    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // 1. Draw source image
    this.ctx.drawImage(this.image, 0, 0);

    // 2. Draw defined elements
    for (const elem of this.elements) {
      const isSelected = elem.id === this.selectedElementId;
      this.ctx.beginPath();
      for (let i = 0; i < elem.polygon.length; i++) {
        const pt = elem.polygon[i];
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      }
      this.ctx.closePath();

      // Fill
      this.ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.15)';
      this.ctx.fill();

      // Stroke
      this.ctx.lineWidth = (isSelected ? 2 : 1.2) / this.zoom;
      this.ctx.strokeStyle = isSelected ? '#38bdf8' : '#0284c7';
      this.ctx.stroke();

      // Draw vertices if selected
      if (isSelected) {
        for (const pt of elem.polygon) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          this.ctx.arc(pt.x, pt.y, 4 / this.zoom, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#0284c7';
          this.ctx.lineWidth = 1.5 / this.zoom;
          this.ctx.stroke();
        }

        // Draw Pivot Crosshair
        const pWorldX = elem.bounds.x + elem.pivot.x;
        const pWorldY = elem.bounds.y + elem.pivot.y;
        const arm = 9 / this.zoom;

        this.ctx.beginPath();
        this.ctx.moveTo(pWorldX - arm, pWorldY);
        this.ctx.lineTo(pWorldX + arm, pWorldY);
        this.ctx.moveTo(pWorldX, pWorldY - arm);
        this.ctx.lineTo(pWorldX, pWorldY + arm);
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2.5 / this.zoom;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(pWorldX, pWorldY, 5 / this.zoom, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.stroke();
      }
    }

    // 3. Draw in-progress polygon
    if (this.drawingPoints.length > 0) {
      this.ctx.beginPath();
      for (let i = 0; i < this.drawingPoints.length; i++) {
        const pt = this.drawingPoints[i];
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      }
      if (this.hoverPoint) {
        this.ctx.lineTo(this.hoverPoint.x, this.hoverPoint.y);
      }
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 1.8 / this.zoom;
      this.ctx.stroke();

      for (let i = 0; i < this.drawingPoints.length; i++) {
        const pt = this.drawingPoints[i];
        this.ctx.fillStyle = i === 0 ? '#10b981' : '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, (i === 0 ? 5.5 : 3.5) / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#065f46';
        this.ctx.lineWidth = 1.2 / this.zoom;
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  public renameElement(id: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    const elem = this.elements.find(el => el.id === id);
    if (!elem) return false;
    elem.name = trimmed;
    this.render();
    if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
    return true;
  }

  public moveElement(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.elements.length || toIndex < 0 || toIndex >= this.elements.length) return;
    const [moved] = this.elements.splice(fromIndex, 1);
    this.elements.splice(toIndex, 0, moved);
    this.render();
    if (this.events.onElementsChange) this.events.onElementsChange(this.elements);
  }
}
