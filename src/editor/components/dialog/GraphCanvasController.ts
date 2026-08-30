import { Vector2D, DialogTree } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { GraphWireRenderer } from './GraphWireRenderer';

export interface CanvasControllerCallbacks {
  getActiveTree: () => DialogTree | null;
  onUpdate: () => void;
  onReRenderTree: () => void;
}

export class GraphCanvasController {
  private element: HTMLElement;
  private callbacks: CanvasControllerCallbacks;

  public panOffset: Vector2D = { x: 0, y: 0 };
  public zoomLevel: number = 1.0;
  public isPanning = false;
  public panStart: Vector2D = { x: 0, y: 0 };

  public isDraggingNode = false;
  public draggedNodeId: string | null = null;
  public dragOffset: Vector2D = { x: 0, y: 0 };

  public isWiring = false;
  public wireSourceNodeId: string | null = null;
  public wireSourceCIdx: number | null = null;
  public wireStartPt: Vector2D = { x: 0, y: 0 };
  public tempWirePath: string | null = null;

  private autoPanRafId: number | null = null;
  private autoPanVx: number = 0;
  private autoPanVy: number = 0;
  private lastClientX: number = 0;
  private lastClientY: number = 0;
  private isGlobalEventsAttached = false;

  constructor(element: HTMLElement, callbacks: CanvasControllerCallbacks) {
    this.element = element;
    this.callbacks = callbacks;
  }

  public initGlobalEvents(): void {
    if (this.isGlobalEventsAttached) return;
    this.isGlobalEventsAttached = true;

    const viewport = this.element.querySelector('#dialog-nodes-viewport') as HTMLElement;
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;

    if (viewport) {
      viewport.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const tree = this.callbacks.getActiveTree();
        const delta = e.deltaY < 0 ? 1.12 : 0.88;
        const newZoom = Math.max(0.2, Math.min(2.5, this.zoomLevel * delta));

        const vRect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - vRect.left;
        const mouseY = e.clientY - vRect.top;

        this.panOffset.x = mouseX - (mouseX - this.panOffset.x) * (newZoom / this.zoomLevel);
        this.panOffset.y = mouseY - (mouseY - this.panOffset.y) * (newZoom / this.zoomLevel);
        this.zoomLevel = newZoom;

        this.updateTransform();
        if (tree && svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: this.zoomLevel,
            isWiring: this.isWiring,
            tempWirePath: this.tempWirePath,
            onWireDeleted: this.callbacks.onReRenderTree
          });
        }
      }, { passive: false });

      viewport.addEventListener('mousedown', (e: MouseEvent) => {
        if (this.isWiring || this.isDraggingNode) return;
        const target = e.target as HTMLElement;
        const isCanvasBackground = target.id === 'dialog-nodes-viewport' ||
                                    target.id === 'dialog-nodes-container' ||
                                    target.id === 'dialog-graph-transform-layer' ||
                                    target.tagName.toLowerCase() === 'svg';

        if (e.button === 1 || e.button === 2 || isCanvasBackground) {
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
          viewport.style.cursor = 'grabbing';
          e.preventDefault();
        }
      });

      viewport.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      const tree = this.callbacks.getActiveTree();
      if (!tree) return;

      if (this.isPanning && viewport) {
        this.panOffset.x = e.clientX - this.panStart.x;
        this.panOffset.y = e.clientY - this.panStart.y;
        this.updateTransform();
        return;
      }

      if ((this.isWiring || this.isDraggingNode) && viewport) {
        this.updateEdgePanVelocity(e, viewport);
      }

      const lRect = transformLayer?.getBoundingClientRect();
      if (!lRect) return;

      if (this.isWiring) {
        const hoverTargetId = this.findTargetNodeIdAt(e.clientX, e.clientY, this.wireSourceNodeId);

        // Highlight target card
        transformLayer.querySelectorAll('.dialog-graph-card').forEach(c => {
          const cardEl = c as HTMLElement;
          if (hoverTargetId && cardEl.dataset.nodeid === hoverTargetId) {
            cardEl.style.outline = '2px solid #22c55e';
            cardEl.style.boxShadow = '0 0 20px rgba(34,197,94,0.6)';
          } else {
            cardEl.style.outline = '';
            cardEl.style.boxShadow = '';
          }
        });

        let targetX = (e.clientX - lRect.left) / this.zoomLevel;
        let targetY = (e.clientY - lRect.top) / this.zoomLevel;

        if (hoverTargetId) {
          const inPort = transformLayer.querySelector(`.node-port-in[data-nodeid="${hoverTargetId}"]`);
          if (inPort) {
            const pRect = inPort.getBoundingClientRect();
            targetX = (pRect.left + pRect.width / 2 - lRect.left) / this.zoomLevel;
            targetY = (pRect.top + pRect.height / 2 - lRect.top) / this.zoomLevel;
          }
        }

        const dx = Math.max(30, Math.abs(targetX - this.wireStartPt.x) * 0.5);
        this.tempWirePath = `M ${this.wireStartPt.x} ${this.wireStartPt.y} C ${this.wireStartPt.x + dx} ${this.wireStartPt.y}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;
        if (svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: this.zoomLevel,
            isWiring: this.isWiring,
            tempWirePath: this.tempWirePath,
            onWireDeleted: this.callbacks.onReRenderTree
          });
        }
        return;
      }

      if (this.isDraggingNode && this.draggedNodeId && tree.nodes[this.draggedNodeId]) {
        const node = tree.nodes[this.draggedNodeId];
        node.position = {
          x: (e.clientX - lRect.left) / this.zoomLevel - this.dragOffset.x,
          y: (e.clientY - lRect.top) / this.zoomLevel - this.dragOffset.y
        };

        const card = transformLayer.querySelector(`.dialog-graph-card[data-nodeid="${this.draggedNodeId}"]`) as HTMLElement;
        if (card) {
          card.style.left = `${node.position.x}px`;
          card.style.top = `${node.position.y}px`;
        }

        if (svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: this.zoomLevel,
            isWiring: this.isWiring,
            tempWirePath: this.tempWirePath,
            onWireDeleted: this.callbacks.onReRenderTree
          });
        }
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      this.stopAutoPan();
      const tree = this.callbacks.getActiveTree();

      if (this.isPanning) {
        this.isPanning = false;
        if (viewport) viewport.style.cursor = 'grab';
        return;
      }

      if (this.isWiring) {
        const targetNodeId = this.findTargetNodeIdAt(e.clientX, e.clientY, this.wireSourceNodeId);
        const srcId = this.wireSourceNodeId;
        const cIdx = this.wireSourceCIdx;

        this.isWiring = false;
        this.tempWirePath = null;
        this.wireSourceNodeId = null;
        this.wireSourceCIdx = null;

        transformLayer?.querySelectorAll('.dialog-graph-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
          (c as HTMLElement).style.boxShadow = '';
        });

        if (tree && targetNodeId && srcId && targetNodeId !== srcId) {
          const srcNode = tree.nodes[srcId];
          if (srcNode) {
            if (cIdx !== null && srcNode.choices && srcNode.choices[cIdx]) {
              srcNode.choices[cIdx].nextNodeId = targetNodeId;
            } else {
              srcNode.nextNodeId = targetNodeId;
            }
            this.callbacks.onReRenderTree();
            EventBus.getInstance().emit('editor:project_updated');
            return;
          }
        }

        if (tree && svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: this.zoomLevel,
            isWiring: this.isWiring,
            tempWirePath: this.tempWirePath,
            onWireDeleted: this.callbacks.onReRenderTree
          });
        }
        return;
      }

      if (this.isDraggingNode) {
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        EventBus.getInstance().emit('editor:project_updated');
      }
    });
  }

  public updateEdgePanVelocity(e: MouseEvent, viewport: HTMLElement): void {
    const vRect = viewport.getBoundingClientRect();
    const margin = 80;
    const maxSpeed = 16;

    this.autoPanVx = 0;
    this.autoPanVy = 0;

    if (e.clientX < vRect.left + margin) {
      const ratio = 1 - (e.clientX - vRect.left) / margin;
      this.autoPanVx = Math.min(maxSpeed, Math.max(2, ratio * maxSpeed));
    } else if (e.clientX > vRect.right - margin) {
      const ratio = 1 - (vRect.right - e.clientX) / margin;
      this.autoPanVx = -Math.min(maxSpeed, Math.max(2, ratio * maxSpeed));
    }

    if (e.clientY < vRect.top + margin) {
      const ratio = 1 - (e.clientY - vRect.top) / margin;
      this.autoPanVy = Math.min(maxSpeed, Math.max(2, ratio * maxSpeed));
    } else if (e.clientY > vRect.bottom - margin) {
      const ratio = 1 - (vRect.bottom - e.clientY) / margin;
      this.autoPanVy = -Math.min(maxSpeed, Math.max(2, ratio * maxSpeed));
    }
  }

  public startAutoPan(tree: DialogTree, svgEl: SVGElement, transformLayer: HTMLElement): void {
    if (this.autoPanRafId !== null) return;

    const tick = () => {
      if (this.autoPanVx !== 0 || this.autoPanVy !== 0) {
        this.panOffset.x += this.autoPanVx;
        this.panOffset.y += this.autoPanVy;
        this.updateTransform();

        const lRect = transformLayer.getBoundingClientRect();

        if (this.isDraggingNode && this.draggedNodeId && tree.nodes[this.draggedNodeId]) {
          const node = tree.nodes[this.draggedNodeId];
          node.position = {
            x: (this.lastClientX - lRect.left) / this.zoomLevel - this.dragOffset.x,
            y: (this.lastClientY - lRect.top) / this.zoomLevel - this.dragOffset.y
          };
          const card = transformLayer.querySelector(`.dialog-graph-card[data-nodeid="${this.draggedNodeId}"]`) as HTMLElement;
          if (card) {
            card.style.left = `${node.position.x}px`;
            card.style.top = `${node.position.y}px`;
          }
        }

        if (this.isWiring) {
          const targetX = (this.lastClientX - lRect.left) / this.zoomLevel;
          const targetY = (this.lastClientY - lRect.top) / this.zoomLevel;
          const dx = Math.max(30, Math.abs(targetX - this.wireStartPt.x) * 0.5);
          this.tempWirePath = `M ${this.wireStartPt.x} ${this.wireStartPt.y} C ${this.wireStartPt.x + dx} ${this.wireStartPt.y}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;
        }

        GraphWireRenderer.renderConnectionLines({
          tree,
          svgEl,
          transformLayer,
          zoomLevel: this.zoomLevel,
          isWiring: this.isWiring,
          tempWirePath: this.tempWirePath,
          onWireDeleted: this.callbacks.onReRenderTree
        });
      }

      this.autoPanRafId = requestAnimationFrame(tick);
    };

    this.autoPanRafId = requestAnimationFrame(tick);
  }

  public stopAutoPan(): void {
    if (this.autoPanRafId !== null) {
      cancelAnimationFrame(this.autoPanRafId);
      this.autoPanRafId = null;
    }
    this.autoPanVx = 0;
    this.autoPanVy = 0;
  }

  public findTargetNodeIdAt(clientX: number, clientY: number, excludeNodeId?: string | null): string | null {
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    if (!transformLayer) return null;

    const cards = Array.from(transformLayer.querySelectorAll('.dialog-graph-card')) as HTMLElement[];
    for (const card of cards) {
      const nid = card.dataset.nodeid;
      if (!nid || nid === excludeNodeId) continue;

      const rect = card.getBoundingClientRect();
      const pad = 24;
      if (
        clientX >= rect.left - pad &&
        clientX <= rect.right + pad &&
        clientY >= rect.top - pad &&
        clientY <= rect.bottom + pad
      ) {
        return nid;
      }
    }
    return null;
  }

  public updateTransform(): void {
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const zoomLabel = this.element.querySelector('#dialog-zoom-label');
    if (transformLayer) {
      transformLayer.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomLevel})`;
    }
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  public attachCanvasInteractions(tree: DialogTree): void {
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;

    // Interactive Drag-to-Connect Wiring from Out-Ports
    this.element.querySelectorAll('.node-port-out').forEach(port => {
      port.addEventListener('mousedown', (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        const mouseEv = e as MouseEvent;
        this.isWiring = true;
        this.wireSourceNodeId = (port as HTMLElement).dataset.nodeid!;
        const cIdxStr = (port as HTMLElement).dataset.cidx;
        this.wireSourceCIdx = cIdxStr !== undefined && cIdxStr !== '' ? parseInt(cIdxStr) : null;
        this.lastClientX = mouseEv.clientX;
        this.lastClientY = mouseEv.clientY;

        if (transformLayer) {
          const lRect = transformLayer.getBoundingClientRect();
          const pRect = (port as HTMLElement).getBoundingClientRect();
          this.wireStartPt = {
            x: (pRect.left + pRect.width / 2 - lRect.left) / this.zoomLevel,
            y: (pRect.top + pRect.height / 2 - lRect.top) / this.zoomLevel
          };
          if (svgEl) this.startAutoPan(tree, svgEl, transformLayer);
        }
      });
    });

    // Node Drag & Drop
    this.element.querySelectorAll('.node-drag-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e: Event) => {
        if (this.isWiring || this.isPanning) return;
        e.stopPropagation();
        const mouseEv = e as MouseEvent;
        this.isDraggingNode = true;
        this.draggedNodeId = (handle as HTMLElement).dataset.nodeid!;
        this.lastClientX = mouseEv.clientX;
        this.lastClientY = mouseEv.clientY;
        const card = handle.closest('.dialog-graph-card') as HTMLElement;

        if (card && transformLayer) {
          const lRect = transformLayer.getBoundingClientRect();
          const cRect = card.getBoundingClientRect();
          this.dragOffset = {
            x: (mouseEv.clientX - cRect.left) / this.zoomLevel,
            y: (mouseEv.clientY - cRect.top) / this.zoomLevel
          };
          if (svgEl) this.startAutoPan(tree, svgEl, transformLayer);
        }
      });
    });
  }
}
