import { ProjectData } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { DialogEditorTemplate } from './templates/NodeViews.template';
import { DialogEditorUtils } from './DialogEditorUtils';

export interface StoryboardViewHost {
  getProject: () => ProjectData | null;
  getActiveSceneId: () => string | null;
  setActiveSceneId: (id: string | null) => void;
  getZoomLevel: () => number;
  panToSceneCard: (cardX: number, cardY: number) => void;
  openSceneInSequenceView: (sceneId: string) => void;
  switchToSequence: (treeId: string, sceneId?: string) => void;
  closeEditor: () => void;
}

export class StoryboardViewController {
  constructor(
    private container: HTMLElement,
    private host: StoryboardViewHost
  ) {}

  public renderStoryboardView(): void {
    const project = this.host.getProject();
    if (!project) return;

    const treeList = this.container.querySelector('#dialog-tree-list');
    const nodesContainer = this.container.querySelector('#dialog-nodes-container');
    const activeSceneId = this.host.getActiveSceneId();

    if (treeList) {
      treeList.innerHTML = DialogEditorTemplate.renderStoryboardSidebar({
        project,
        activeSceneId: activeSceneId || undefined
      });

      treeList.querySelectorAll('.storyboard-sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const scId = (e.currentTarget as HTMLElement).dataset.sceneid!;
          this.host.setActiveSceneId(scId);
          const card = this.container.querySelector(`.storyboard-scene-card[data-sceneid="${scId}"]`) as HTMLElement;
          if (card) {
            const cardX = parseFloat(card.style.left) || 0;
            const cardY = parseFloat(card.style.top) || 0;
            this.host.panToSceneCard(cardX, cardY);
          }
          this.renderStoryboardView();
        });
      });
    }

    if (nodesContainer) {
      nodesContainer.innerHTML = DialogEditorTemplate.renderStoryboardCanvas({
        project,
        activeSceneId: activeSceneId || undefined
      });

      setTimeout(() => {
        this.renderStoryboardWires();
      }, 0);

      this.attachStoryboardEvents();
    }
  }

  public attachStoryboardEvents(): void {
    const project = this.host.getProject();
    if (!project) return;

    // 1. Double-click or Open Graphs button to enter sequence view
    this.container.querySelectorAll('.storyboard-scene-card').forEach(card => {
      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const sceneId = (card as HTMLElement).dataset.sceneid!;
        this.host.openSceneInSequenceView(sceneId);
      });
    });

    this.container.querySelectorAll('.btn-open-scene-graphs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        this.host.openSceneInSequenceView(sceneId);
      });
    });

    // 2. Jump to edit scene in main editor
    this.container.querySelectorAll('.btn-jump-main-scene').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        EventBus.getInstance().emit('editor:select_scene', sceneId);
        this.host.closeEditor();
      });
    });

    // 3. Jump to sequence
    this.container.querySelectorAll('.btn-jump-to-sequence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const treeId = (btn as HTMLElement).dataset.treeid!;
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        this.host.switchToSequence(treeId, sceneId);
      });
    });

    // 4. Dragging Scene Cards
    this.container.querySelectorAll('.storyboard-card-header').forEach(hdr => {
      hdr.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const sceneId = (hdr as HTMLElement).dataset.sceneid!;
        const sc = project.scenes?.find(s => s.id === sceneId);
        const card = this.container.querySelector(`.storyboard-scene-card[data-sceneid="${sceneId}"]`) as HTMLElement;
        if (!sc || !card) return;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!sc.storyPosition) {
          sc.storyPosition = {
            x: parseFloat(card.style.left) || 80,
            y: parseFloat(card.style.top) || 80
          };
        }

        const zoom = this.host.getZoomLevel();
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;
        const startPosX = sc.storyPosition.x;
        const startPosY = sc.storyPosition.y;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          sc.storyPosition!.x = Math.round(startPosX + dx);
          sc.storyPosition!.y = Math.round(startPosY + dy);
          card.style.left = `${sc.storyPosition!.x}px`;
          card.style.top = `${sc.storyPosition!.y}px`;
          this.renderStoryboardWires();
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          EventBus.getInstance().emit('editor:project_updated');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });

    // 5. Dragging Switch Scene Nodes
    this.container.querySelectorAll('.switch-node-header').forEach(hdr => {
      hdr.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const trId = (hdr as HTMLElement).dataset.trid!;
        const nodeEl = this.container.querySelector(`.storyboard-switch-node[data-trid="${trId}"]`) as HTMLElement;
        if (!nodeEl || !project) return;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!project.storyboardSettings) project.storyboardSettings = {};
        if (!project.storyboardSettings.switchNodePositions) project.storyboardSettings.switchNodePositions = {};

        const startX = parseFloat(nodeEl.style.left) || 0;
        const startY = parseFloat(nodeEl.style.top) || 0;
        const zoom = this.host.getZoomLevel();
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          const newX = Math.round(startX + dx);
          const newY = Math.round(startY + dy);
          nodeEl.style.left = `${newX}px`;
          nodeEl.style.top = `${newY}px`;
          project.storyboardSettings!.switchNodePositions![trId] = { x: newX, y: newY };
          this.renderStoryboardWires();
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          EventBus.getInstance().emit('editor:project_updated');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });

    // 6. Open Sequence from Switch Node button
    this.container.querySelectorAll('.btn-open-tr-dialog').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dlgId = (btn as HTMLElement).dataset.dialogid!;
        this.host.switchToSequence(dlgId);
      });
    });

    // 7. Dragging Bezier Curvature Handles
    this.attachBezierHandleEvents();
  }

  public renderStoryboardWires(): void {
    const project = this.host.getProject();
    const svgEl = this.container.querySelector('#dialog-connections-svg') as SVGElement;
    if (!svgEl || !project) return;

    const transitions = DialogEditorUtils.getSceneTransitions(project);
    let pathsHtml = `
      <defs>
        <marker id="arrow-scene" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981"/>
        </marker>
        <marker id="arrow-scene-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
        </marker>
      </defs>
    `;

    transitions.forEach(tr => {
      const fromCard = this.container.querySelector(`.storyboard-scene-card[data-sceneid="${tr.fromSceneId}"]`) as HTMLElement;
      const toCard = this.container.querySelector(`.storyboard-scene-card[data-sceneid="${tr.toSceneId}"]`) as HTMLElement;
      const switchNode = this.container.querySelector(`.storyboard-switch-node[data-trid="${tr.id}"]`) as HTMLElement;

      if (!fromCard || !toCard) return;

      const fromX = parseFloat(fromCard.style.left) || 0;
      const fromY = parseFloat(fromCard.style.top) || 0;
      const fromW = fromCard.offsetWidth || 340;
      const fromH = fromCard.offsetHeight || 220;

      const toX = parseFloat(toCard.style.left) || 0;
      const toY = parseFloat(toCard.style.top) || 0;
      const toW = toCard.offsetWidth || 340;
      const toH = toCard.offsetHeight || 220;

      if (switchNode) {
        // --- 2-Segment routing through Switch Scene Node ---
        const swX = parseFloat(switchNode.style.left) || 0;
        const swY = parseFloat(switchNode.style.top) || 0;
        const swW = switchNode.offsetWidth || 220;
        const swH = switchNode.offsetHeight || 72;

        const fcX = fromX + fromW * 0.5;
        const fcY = fromY + fromH * 0.5;
        const scX = swX + swW * 0.5;
        const scY = swY + swH * 0.5;
        const tcX = toX + toW * 0.5;
        const tcY = toY + toH * 0.5;

        // Anchor 1: Exit fromCard towards switchNode
        let p1: { x: number; y: number };
        let tan1: { x: number; y: number };
        if (scX < fromX) {
          p1 = { x: fromX, y: fromY + fromH * 0.45 };
          tan1 = { x: -Math.max(50, Math.abs(scX - fromX) * 0.4), y: 0 };
        } else if (scX > fromX + fromW) {
          p1 = { x: fromX + fromW, y: fromY + fromH * 0.45 };
          tan1 = { x: Math.max(50, Math.abs(scX - (fromX + fromW)) * 0.4), y: 0 };
        } else if (scY < fromY) {
          p1 = { x: fcX, y: fromY };
          tan1 = { x: 0, y: -Math.max(40, Math.abs(scY - fromY) * 0.4) };
        } else {
          p1 = { x: fcX, y: fromY + fromH };
          tan1 = { x: 0, y: Math.max(40, Math.abs(scY - (fromY + fromH)) * 0.4) };
        }

        // Anchor 2: Enter switchNode from fromCard
        let p2: { x: number; y: number };
        let tan2: { x: number; y: number };
        if (tan1.x < 0) {
          p2 = { x: swX + swW, y: swY + swH * 0.5 };
          tan2 = { x: 50, y: 0 };
        } else if (tan1.x > 0) {
          p2 = { x: swX, y: swY + swH * 0.5 };
          tan2 = { x: -50, y: 0 };
        } else if (tan1.y < 0) {
          p2 = { x: scX, y: swY + swH };
          tan2 = { x: 0, y: 40 };
        } else {
          p2 = { x: scX, y: swY };
          tan2 = { x: 0, y: -40 };
        }

        // Segment 1 Bezier Curve with Custom Offset
        const bKey1 = `${tr.id}_seg1`;
        const offset1 = project.storyboardSettings?.bezierOffsets?.[bKey1] || { x: 0, y: 0 };
        const cp1 = { x: p1.x + tan1.x + offset1.x, y: p1.y + tan1.y + offset1.y };
        const cp2 = { x: p2.x + tan2.x + offset1.x, y: p2.y + tan2.y + offset1.y };

        const handle1X = 0.125 * p1.x + 0.375 * cp1.x + 0.375 * cp2.x + 0.125 * p2.x;
        const handle1Y = 0.125 * p1.y + 0.375 * cp1.y + 0.375 * cp2.y + 0.125 * p2.y;

        pathsHtml += `
          <path d="M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6,4" fill="none" marker-end="url(#arrow-scene)" style="filter:drop-shadow(0 0 5px rgba(16,185,129,0.5));" />
          <circle class="storyboard-bezier-handle" data-trid="${tr.id}" data-seg="1" cx="${handle1X}" cy="${handle1Y}" r="7" fill="#10b981" stroke="#ffffff" stroke-width="2" style="cursor:crosshair; pointer-events:auto; filter:drop-shadow(0 0 4px #10b981);" title="Drag to bend curve (Double-click to reset)" />
        `;

        // Anchor 3: Exit switchNode towards toCard
        let p3: { x: number; y: number };
        let tan3: { x: number; y: number };
        if (tcX < swX) {
          p3 = { x: swX, y: swY + swH * 0.5 };
          tan3 = { x: -Math.max(50, Math.abs(tcX - swX) * 0.4), y: 0 };
        } else if (tcX > swX + swW) {
          p3 = { x: swX + swW, y: swY + swH * 0.5 };
          tan3 = { x: Math.max(50, Math.abs(tcX - (swX + swW)) * 0.4), y: 0 };
        } else if (tcY < swY) {
          p3 = { x: scX, y: swY };
          tan3 = { x: 0, y: -Math.max(40, Math.abs(tcY - swY) * 0.4) };
        } else {
          p3 = { x: scX, y: swY + swH };
          tan3 = { x: 0, y: Math.max(40, Math.abs(tcY - (swY + swH)) * 0.4) };
        }

        // Anchor 4: Enter toCard from switchNode
        let p4: { x: number; y: number };
        let tan4: { x: number; y: number };
        if (tan3.x < 0) {
          p4 = { x: toX + toW, y: toY + toH * 0.45 };
          tan4 = { x: 50, y: 0 };
        } else if (tan3.x > 0) {
          p4 = { x: toX, y: toY + toH * 0.45 };
          tan4 = { x: -50, y: 0 };
        } else if (tan3.y < 0) {
          p4 = { x: tcX, y: toY + toH };
          tan4 = { x: 0, y: 50 };
        } else {
          p4 = { x: tcX, y: toY };
          tan4 = { x: 0, y: -50 };
        }

        // Segment 2 Bezier Curve with Custom Offset
        const bKey2 = `${tr.id}_seg2`;
        const offset2 = project.storyboardSettings?.bezierOffsets?.[bKey2] || { x: 0, y: 0 };
        const cp3 = { x: p3.x + tan3.x + offset2.x, y: p3.y + tan3.y + offset2.y };
        const cp4 = { x: p4.x + tan4.x + offset2.x, y: p4.y + tan4.y + offset2.y };

        const handle2X = 0.125 * p3.x + 0.375 * cp3.x + 0.375 * cp4.x + 0.125 * p4.x;
        const handle2Y = 0.125 * p3.y + 0.375 * cp3.y + 0.375 * cp4.y + 0.125 * p4.y;

        pathsHtml += `
          <path d="M ${p3.x} ${p3.y} C ${cp3.x} ${cp3.y}, ${cp4.x} ${cp4.y}, ${p4.x} ${p4.y}" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="6,4" fill="none" marker-end="url(#arrow-scene-cyan)" style="filter:drop-shadow(0 0 5px rgba(56,189,248,0.5));" />
          <circle class="storyboard-bezier-handle" data-trid="${tr.id}" data-seg="2" cx="${handle2X}" cy="${handle2Y}" r="7" fill="#38bdf8" stroke="#ffffff" stroke-width="2" style="cursor:crosshair; pointer-events:auto; filter:drop-shadow(0 0 4px #38bdf8);" title="Drag to bend curve (Double-click to reset)" />
        `;
      } else {
        // Fallback direct connection
        const startX = fromX + fromW;
        const startY = fromY + fromH * 0.4;
        const endX = toX;
        const endY = toY + toH * 0.4;
        const dx = Math.max(60, Math.abs(endX - startX) * 0.5);
        pathsHtml += `
          <path d="M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6,4" fill="none" marker-end="url(#arrow-scene)" />
        `;
      }
    });

    svgEl.innerHTML = pathsHtml;
    this.attachBezierHandleEvents();
  }

  public attachBezierHandleEvents(): void {
    const project = this.host.getProject();
    if (!project) return;

    this.container.querySelectorAll('.storyboard-bezier-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const trId = (handle as SVGElement).dataset.trid!;
        const seg = (handle as SVGElement).dataset.seg!;
        const bKey = `${trId}_seg${seg}`;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!project.storyboardSettings) project.storyboardSettings = {};
        if (!project.storyboardSettings.bezierOffsets) project.storyboardSettings.bezierOffsets = {};

        const initialOffset = project.storyboardSettings.bezierOffsets[bKey] || { x: 0, y: 0 };
        const zoom = this.host.getZoomLevel();
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          project.storyboardSettings!.bezierOffsets![bKey] = {
            x: Math.round(initialOffset.x + dx),
            y: Math.round(initialOffset.y + dy)
          };
          this.renderStoryboardWires();
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          EventBus.getInstance().emit('editor:project_updated');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      handle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const trId = (handle as SVGElement).dataset.trid!;
        const seg = (handle as SVGElement).dataset.seg!;
        const bKey = `${trId}_seg${seg}`;
        if (project.storyboardSettings?.bezierOffsets) {
          delete project.storyboardSettings.bezierOffsets[bKey];
          this.renderStoryboardWires();
          EventBus.getInstance().emit('editor:project_updated');
        }
      });
    });
  }
}
