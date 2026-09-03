import { ProjectData, DialogTree } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { DialogEditorUtils } from './dialog/DialogEditorUtils';
import { GraphWireRenderer } from './dialog/GraphWireRenderer';
import { GraphCanvasController } from './dialog/GraphCanvasController';
import { NodeViewFactory } from './dialog/nodes/NodeViewFactory';
import { DialogEditorTemplate } from './dialog/templates/NodeViews.template';
import { ZoomWidget } from './ZoomWidget';

export class DialogEditor {
  public element: HTMLElement;
  public backdropElement: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;
  private canvasController: GraphCanvasController;
  private zoomWidget: ZoomWidget;

  public viewMode: 'storyboard' | 'sequences' = 'sequences';
  public selectedSceneFilter: string = 'all';
  public activeSceneId: string | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'dialog-editor-container hidden';

    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'dialog-editor-backdrop hidden';
    this.backdropElement.addEventListener('click', () => this.hide());

    this.canvasController = new GraphCanvasController(this.element, {
      getActiveTree: () => this.getActiveTree(),
      onUpdate: () => EventBus.getInstance().emit('editor:project_updated'),
      onReRenderTree: () => this.renderCurrentView(),
      getViewMode: () => this.viewMode,
      onReRenderStoryboardWires: () => this.renderStoryboardWires()
    });

    this.zoomWidget = new ZoomWidget({
      onZoomIn: () => this.canvasController.zoomIn(),
      onZoomOut: () => this.canvasController.zoomOut(),
      onReset: () => this.canvasController.resetZoom(),
      onFit: () => this.canvasController.fitToNodes(),
      initialZoom: this.canvasController.zoomLevel
    });
    this.canvasController.setZoomWidget(this.zoomWidget);

    this.render();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.element.classList.contains('hidden')) {
        if (this.element.classList.contains('viewport-picking-active')) return;
        this.hide();
      }
    });

    EventBus.getInstance().on('editor:open_dialog_editor', (data?: { dialogId?: string; viewMode?: 'storyboard' | 'sequences'; sceneId?: string }) => {
      this.show(data);
    });
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    if (this.project.scenes && this.project.scenes.length > 0 && !this.activeSceneId) {
      this.activeSceneId = this.project.scenes[0].id;
    }
    if (this.project.dialogs && this.project.dialogs.length > 0) {
      if (!this.selectedTreeId || !this.project.dialogs.some(d => d.id === this.selectedTreeId)) {
        this.selectedTreeId = this.project.dialogs[0].id;
      }
    }
    this.populateSceneDropdowns();
    this.renderCurrentView();
  }

  public selectTree(treeId: string): void {
    this.selectedTreeId = treeId;
    this.viewMode = 'sequences';
    this.renderCurrentView();
  }

  public show(options?: { viewMode?: 'storyboard' | 'sequences'; sceneId?: string; dialogId?: string }): void {
    if (!this.backdropElement.parentElement && this.element.parentElement) {
      this.element.parentElement.insertBefore(this.backdropElement, this.element);
    }
    this.backdropElement.classList.remove('hidden');
    this.element.classList.remove('hidden');

    if (options?.viewMode) {
      this.viewMode = options.viewMode;
    }
    if (options?.sceneId) {
      this.selectedSceneFilter = options.sceneId;
      this.activeSceneId = options.sceneId;
    }
    if (options?.dialogId) {
      this.selectedTreeId = options.dialogId;
      this.viewMode = 'sequences';
    }

    this.populateSceneDropdowns();
    this.renderCurrentView();
  }

  public hide(): void {
    this.canvasController.stopAutoPan();
    this.backdropElement.classList.add('hidden');
    this.element.classList.add('hidden');
  }

  public switchViewMode(mode: 'storyboard' | 'sequences'): void {
    this.viewMode = mode;
    this.renderCurrentView();
  }

  private getActiveTree(): DialogTree | null {
    if (!this.project || !this.selectedTreeId) return null;
    return this.project.dialogs.find(d => d.id === this.selectedTreeId) || null;
  }

  private deleteSequence(treeId: string): void {
    if (!this.project) return;
    const tree = this.project.dialogs.find(d => d.id === treeId);
    if (!tree) return;

    const confirmed = window.confirm(`Are you sure you want to delete the sequence "${tree.title || tree.id}"?\n\nThis will remove all its nodes and connections. This action cannot be undone.`);
    if (!confirmed) return;

    this.project.dialogs = this.project.dialogs.filter(d => d.id !== treeId);
    if (this.project.dialogs.length === 0) {
      const defaultTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Sequence',
        startNodeId: 'beat_1',
        sceneId: this.selectedSceneFilter !== 'all' ? this.selectedSceneFilter : 'global',
        nodes: {
          beat_1: {
            id: 'beat_1',
            speaker: 'Hero',
            text: 'Sequence starting line.',
            position: { x: 60, y: 60 }
          }
        }
      };
      this.project.dialogs.push(defaultTree);
      this.selectedTreeId = defaultTree.id;
    } else {
      this.selectedTreeId = this.project.dialogs[0].id;
    }

    this.renderCurrentView();
    EventBus.getInstance().emit('editor:project_updated');
  }

  private populateSceneDropdowns(): void {
    if (!this.project) return;

    // 1. Sidebar scene filter dropdown
    const filterSelect = this.element.querySelector('#select-sequence-scene-filter') as HTMLSelectElement;
    if (filterSelect) {
      let filterHtml = `
        <option value="all" ${this.selectedSceneFilter === 'all' ? 'selected' : ''}>🌐 All Scenes & Sequences</option>
        <option value="global" ${this.selectedSceneFilter === 'global' ? 'selected' : ''}>✨ Global / Game Sequences</option>
      `;
      this.project.scenes.forEach(sc => {
        filterHtml += `<option value="${sc.id}" ${this.selectedSceneFilter === sc.id ? 'selected' : ''}>🏰 ${sc.name}</option>`;
      });
      filterSelect.innerHTML = filterHtml;
    }

    // 2. Active sequence scene assignment dropdown
    const sceneSelect = this.element.querySelector('#tree-scene-select') as HTMLSelectElement;
    if (sceneSelect) {
      const activeTree = this.getActiveTree();
      const currentScId = activeTree ? DialogEditorUtils.getSequenceSceneId(this.project, activeTree) : 'global';

      let sceneOptHtml = `<option value="global" ${currentScId === 'global' ? 'selected' : ''}>🌐 Global / Any Scene</option>`;
      this.project.scenes.forEach(sc => {
        sceneOptHtml += `<option value="${sc.id}" ${currentScId === sc.id ? 'selected' : ''}>🏰 ${sc.name}</option>`;
      });
      sceneSelect.innerHTML = sceneOptHtml;
    }
  }

  private render(): void {
    this.element.innerHTML = DialogEditorTemplate.renderLayout();
    this.element.querySelector('#dialog-nodes-viewport')?.appendChild(this.zoomWidget.element);

    this.element.querySelector('#btn-close-dialog-editor')?.addEventListener('click', () => {
      this.hide();
    });

    // View switcher buttons
    this.element.querySelector('#btn-tab-storyboard')?.addEventListener('click', () => {
      this.switchViewMode('storyboard');
    });

    this.element.querySelector('#btn-tab-sequences')?.addEventListener('click', () => {
      this.switchViewMode('sequences');
    });

    this.element.querySelector('#btn-back-to-storyboard')?.addEventListener('click', () => {
      this.switchViewMode('storyboard');
    });

    // Sidebar scene filter
    this.element.querySelector('#select-sequence-scene-filter')?.addEventListener('change', (e) => {
      this.selectedSceneFilter = (e.target as HTMLSelectElement).value;
      const backBtn = this.element.querySelector('#btn-back-to-storyboard') as HTMLElement;
      if (backBtn) {
        backBtn.style.display = (this.selectedSceneFilter !== 'all') ? 'inline-block' : 'none';
      }
      this.renderTreeListOnly();
    });

    // Tree scene assignment
    this.element.querySelector('#tree-scene-select')?.addEventListener('change', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.sceneId = (e.target as HTMLSelectElement).value;
        EventBus.getInstance().emit('editor:project_updated');
        this.renderTreeListOnly();
      }
    });

    this.element.querySelector('#btn-delete-tree')?.addEventListener('click', () => {
      if (this.selectedTreeId) {
        this.deleteSequence(this.selectedTreeId);
      }
    });

    this.element.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      if (!this.project) return;
      const targetScene = this.selectedSceneFilter !== 'all' ? this.selectedSceneFilter : 'global';
      const newTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Sequence',
        startNodeId: 'beat_1',
        sceneId: targetScene,
        nodes: {
          beat_1: {
            id: 'beat_1',
            speaker: 'Hero',
            text: 'Greetings! What news do you bring?',
            position: { x: 60, y: 60 }
          }
        }
      };
      this.project.dialogs.push(newTree);
      this.selectedTreeId = newTree.id;
      this.renderCurrentView();
      EventBus.getInstance().emit('editor:project_updated');
    });

    this.element.querySelector('#btn-add-beat-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `beat_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'beat',
        speaker: 'Hero',
        text: 'Character speech or narrative line.',
        directives: [],
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };

      this.renderCurrentView();
      EventBus.getInstance().emit('editor:project_updated');
    });

    this.element.querySelector('#btn-add-router-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `router_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'router',
        speaker: 'Router',
        text: '',
        isRouterNode: true,
        choices: [
          { id: 'branch_1', text: 'If Has Flag...', nextNodeId: '' },
          { id: 'branch_2', text: 'Else (Fallback)', nextNodeId: '' }
        ],
        position: { x: 120 + (nodeCount * 30), y: 120 + (nodeCount * 40) }
      };

      this.renderCurrentView();
      EventBus.getInstance().emit('editor:project_updated');
    });

    this.element.querySelector('#btn-add-event-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `event_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'event_listener',
        eventScope: 'scene',
        eventTargetId: this.project.scenes[0]?.id || '',
        eventName: 'enter',
        speaker: 'Event Trigger',
        text: '',
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };

      this.renderCurrentView();
      EventBus.getInstance().emit('editor:project_updated');
    });

    this.element.querySelector('#btn-add-action-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `action_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'action',
        actionCategory: 'character',
        characterAction: 'walk_to',
        targetPosition: { x: 500, y: 750 },
        speaker: 'Action',
        text: '',
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };

      this.renderCurrentView();
      EventBus.getInstance().emit('editor:project_updated');
    });

    // Sequence title & start node inputs
    this.element.querySelector('#tree-title-input')?.addEventListener('input', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.title = (e.target as HTMLInputElement).value;
        this.renderTreeListOnly();
        EventBus.getInstance().emit('editor:project_updated');
      }
    });

    this.element.querySelector('#tree-start-node-input')?.addEventListener('input', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.startNodeId = (e.target as HTMLInputElement).value.trim();
        EventBus.getInstance().emit('editor:project_updated');
      }
    });

    this.canvasController.initGlobalEvents();
  }

  public renderCurrentView(): void {
    if (!this.project) return;
    this.updateHeaderTabsUI();

    if (this.viewMode === 'storyboard') {
      this.renderStoryboardView();
    } else {
      this.renderSequenceView();
    }
  }

  private updateHeaderTabsUI(): void {
    const btnStoryboard = this.element.querySelector('#btn-tab-storyboard') as HTMLElement;
    const btnSequences = this.element.querySelector('#btn-tab-sequences') as HTMLElement;
    const nodeBtns = this.element.querySelector('#sequence-node-buttons') as HTMLElement;
    const backBtn = this.element.querySelector('#btn-back-to-storyboard') as HTMLElement;
    const treeHeaderBar = this.element.querySelector('#dialog-tree-header-bar') as HTMLElement;
    const storyboardHeaderBar = this.element.querySelector('#storyboard-header-bar') as HTMLElement;
    const sidebarTitle = this.element.querySelector('#panel-sidebar-title') as HTMLElement;
    const filterWrap = this.element.querySelector('#sequence-scene-filter-wrap') as HTMLElement;
    const addTreeBtn = this.element.querySelector('#btn-add-tree') as HTMLElement;

    if (this.viewMode === 'storyboard') {
      if (btnStoryboard) {
        btnStoryboard.style.background = 'var(--accent-gold)';
        btnStoryboard.style.color = '#000';
      }
      if (btnSequences) {
        btnSequences.style.background = 'transparent';
        btnSequences.style.color = 'var(--text-muted)';
      }
      if (nodeBtns) nodeBtns.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      if (treeHeaderBar) treeHeaderBar.style.display = 'none';
      if (storyboardHeaderBar) storyboardHeaderBar.style.display = 'flex';
      if (sidebarTitle) sidebarTitle.textContent = '🗺️ Storyboard Scenes';
      if (filterWrap) filterWrap.style.display = 'none';
      if (addTreeBtn) addTreeBtn.style.display = 'none';
    } else {
      if (btnStoryboard) {
        btnStoryboard.style.background = 'transparent';
        btnStoryboard.style.color = 'var(--text-muted)';
      }
      if (btnSequences) {
        btnSequences.style.background = '#38bdf8';
        btnSequences.style.color = '#000';
      }
      if (nodeBtns) nodeBtns.style.display = 'flex';
      if (backBtn) {
        backBtn.style.display = (this.selectedSceneFilter !== 'all') ? 'inline-block' : 'none';
      }
      if (treeHeaderBar) treeHeaderBar.style.display = 'flex';
      if (storyboardHeaderBar) storyboardHeaderBar.style.display = 'none';
      if (sidebarTitle) sidebarTitle.textContent = 'Sequence & Logic Graphs';
      if (filterWrap) filterWrap.style.display = 'flex';
      if (addTreeBtn) addTreeBtn.style.display = 'inline-block';
    }
  }

  private renderStoryboardView(): void {
    if (!this.project) return;
    const treeList = this.element.querySelector('#dialog-tree-list');
    const nodesContainer = this.element.querySelector('#dialog-nodes-container');

    if (treeList) {
      treeList.innerHTML = DialogEditorTemplate.renderStoryboardSidebar({
        project: this.project,
        activeSceneId: this.activeSceneId || undefined
      });

      treeList.querySelectorAll('.storyboard-sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const scId = (e.currentTarget as HTMLElement).dataset.sceneid!;
          this.activeSceneId = scId;
          const card = this.element.querySelector(`.storyboard-scene-card[data-sceneid="${scId}"]`) as HTMLElement;
          if (card) {
            const cardX = parseFloat(card.style.left) || 0;
            const cardY = parseFloat(card.style.top) || 0;
            this.canvasController.panOffset.x = 250 - cardX * this.canvasController.zoomLevel;
            this.canvasController.panOffset.y = 150 - cardY * this.canvasController.zoomLevel;
            this.canvasController.updateTransform();
          }
          this.renderStoryboardView();
        });
      });
    }

    if (nodesContainer) {
      nodesContainer.innerHTML = DialogEditorTemplate.renderStoryboardCanvas({
        project: this.project,
        activeSceneId: this.activeSceneId || undefined
      });

      this.canvasController.updateTransform();

      setTimeout(() => {
        this.renderStoryboardWires();
      }, 0);

      // Attach Storyboard Node Interactions
      this.attachStoryboardEvents();
    }
  }

  private attachStoryboardEvents(): void {
    // 1. Double-click or Open Graphs button to enter sequence view
    this.element.querySelectorAll('.storyboard-scene-card').forEach(card => {
      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const sceneId = (card as HTMLElement).dataset.sceneid!;
        this.openSceneInSequenceView(sceneId);
      });
    });

    this.element.querySelectorAll('.btn-open-scene-graphs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        this.openSceneInSequenceView(sceneId);
      });
    });

    // 2. Jump to edit scene in main editor
    this.element.querySelectorAll('.btn-jump-main-scene').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        EventBus.getInstance().emit('editor:select_scene', sceneId);
        this.hide();
      });
    });

    // 3. Jump to sequence
    this.element.querySelectorAll('.btn-jump-to-sequence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const treeId = (btn as HTMLElement).dataset.treeid!;
        const sceneId = (btn as HTMLElement).dataset.sceneid!;
        this.selectedTreeId = treeId;
        this.selectedSceneFilter = sceneId || 'all';
        this.activeSceneId = sceneId || null;
        this.switchViewMode('sequences');
      });
    });

    // 4. Dragging Scene Cards
    this.element.querySelectorAll('.storyboard-card-header').forEach(hdr => {
      hdr.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const sceneId = (hdr as HTMLElement).dataset.sceneid!;
        const sc = this.project?.scenes?.find(s => s.id === sceneId);
        const card = this.element.querySelector(`.storyboard-scene-card[data-sceneid="${sceneId}"]`) as HTMLElement;
        if (!sc || !card) return;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!sc.storyPosition) {
          sc.storyPosition = {
            x: parseFloat(card.style.left) || 80,
            y: parseFloat(card.style.top) || 80
          };
        }

        const zoom = this.canvasController.zoomLevel;
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
    this.element.querySelectorAll('.switch-node-header').forEach(hdr => {
      hdr.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const trId = (hdr as HTMLElement).dataset.trid!;
        const nodeEl = this.element.querySelector(`.storyboard-switch-node[data-trid="${trId}"]`) as HTMLElement;
        if (!nodeEl || !this.project) return;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!this.project.storyboardSettings) this.project.storyboardSettings = {};
        if (!this.project.storyboardSettings.switchNodePositions) this.project.storyboardSettings.switchNodePositions = {};

        const startX = parseFloat(nodeEl.style.left) || 0;
        const startY = parseFloat(nodeEl.style.top) || 0;
        const zoom = this.canvasController.zoomLevel;
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          const newX = Math.round(startX + dx);
          const newY = Math.round(startY + dy);
          nodeEl.style.left = `${newX}px`;
          nodeEl.style.top = `${newY}px`;
          this.project!.storyboardSettings!.switchNodePositions![trId] = { x: newX, y: newY };
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
    this.element.querySelectorAll('.btn-open-tr-dialog').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dlgId = (btn as HTMLElement).dataset.dialogid!;
        this.selectedTreeId = dlgId;
        this.switchViewMode('sequences');
      });
    });

    // 7. Dragging Bezier Curvature Handles
    this.element.querySelectorAll('.storyboard-bezier-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const trId = (handle as SVGElement).dataset.trid!;
        const seg = (handle as SVGElement).dataset.seg!;
        const bKey = `${trId}_seg${seg}`;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!this.project) return;
        if (!this.project.storyboardSettings) this.project.storyboardSettings = {};
        if (!this.project.storyboardSettings.bezierOffsets) this.project.storyboardSettings.bezierOffsets = {};

        const initialOffset = this.project.storyboardSettings.bezierOffsets[bKey] || { x: 0, y: 0 };
        const zoom = this.canvasController.zoomLevel;
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          this.project!.storyboardSettings!.bezierOffsets![bKey] = {
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
        if (this.project?.storyboardSettings?.bezierOffsets) {
          delete this.project.storyboardSettings.bezierOffsets[bKey];
          this.renderStoryboardWires();
          EventBus.getInstance().emit('editor:project_updated');
        }
      });
    });
  }

  private renderStoryboardWires(): void {
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
    if (!svgEl || !this.project) return;

    const transitions = DialogEditorUtils.getSceneTransitions(this.project);
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
      const fromCard = this.element.querySelector(`.storyboard-scene-card[data-sceneid="${tr.fromSceneId}"]`) as HTMLElement;
      const toCard = this.element.querySelector(`.storyboard-scene-card[data-sceneid="${tr.toSceneId}"]`) as HTMLElement;
      const switchNode = this.element.querySelector(`.storyboard-switch-node[data-trid="${tr.id}"]`) as HTMLElement;

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
          // Switch node is to the left of fromCard
          p1 = { x: fromX, y: fromY + fromH * 0.45 };
          tan1 = { x: -Math.max(50, Math.abs(scX - fromX) * 0.4), y: 0 };
        } else if (scX > fromX + fromW) {
          // Switch node is to the right of fromCard
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
          // Coming from right into switchNode
          p2 = { x: swX + swW, y: swY + swH * 0.5 };
          tan2 = { x: 50, y: 0 };
        } else if (tan1.x > 0) {
          // Coming from left into switchNode
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
        const offset1 = this.project?.storyboardSettings?.bezierOffsets?.[bKey1] || { x: 0, y: 0 };
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
          // Entering toCard from the right
          p4 = { x: toX + toW, y: toY + toH * 0.45 };
          tan4 = { x: 50, y: 0 };
        } else if (tan3.x > 0) {
          // Entering toCard from the left
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
        const offset2 = this.project?.storyboardSettings?.bezierOffsets?.[bKey2] || { x: 0, y: 0 };
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

    // Attach Bezier handles events after injecting into SVG
    this.attachBezierHandleEvents();
  }

  private attachBezierHandleEvents(): void {
    this.element.querySelectorAll('.storyboard-bezier-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        const mouseEv = e as MouseEvent;
        if (mouseEv.button !== 0) return;
        const trId = (handle as SVGElement).dataset.trid!;
        const seg = (handle as SVGElement).dataset.seg!;
        const bKey = `${trId}_seg${seg}`;

        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        if (!this.project) return;
        if (!this.project.storyboardSettings) this.project.storyboardSettings = {};
        if (!this.project.storyboardSettings.bezierOffsets) this.project.storyboardSettings.bezierOffsets = {};

        const initialOffset = this.project.storyboardSettings.bezierOffsets[bKey] || { x: 0, y: 0 };
        const zoom = this.canvasController.zoomLevel;
        const startMouseX = mouseEv.clientX;
        const startMouseY = mouseEv.clientY;

        const onMouseMove = (moveE: MouseEvent) => {
          const dx = (moveE.clientX - startMouseX) / zoom;
          const dy = (moveE.clientY - startMouseY) / zoom;
          this.project!.storyboardSettings!.bezierOffsets![bKey] = {
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
        if (this.project?.storyboardSettings?.bezierOffsets) {
          delete this.project.storyboardSettings.bezierOffsets[bKey];
          this.renderStoryboardWires();
          EventBus.getInstance().emit('editor:project_updated');
        }
      });
    });
  }

  private openSceneInSequenceView(sceneId: string): void {
    this.selectedSceneFilter = sceneId;
    this.activeSceneId = sceneId;
    const seqs = DialogEditorUtils.getSequencesForScene(this.project, sceneId);
    if (seqs.length > 0) {
      this.selectedTreeId = seqs[0].id;
    } else {
      // Pick first global or project sequence if none
      this.selectedTreeId = this.project?.dialogs?.[0]?.id || null;
    }
    this.populateSceneDropdowns();
    this.switchViewMode('sequences');
  }

  private renderSequenceView(): void {
    if (!this.project) return;
    this.renderTreeListOnly();

    const nodesContainer = this.element.querySelector('#dialog-nodes-container');
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;

    if (nodesContainer && this.selectedTreeId) {
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) {
        nodesContainer.innerHTML = DialogEditorTemplate.renderEmptySequencePrompt();
        if (svgEl) svgEl.innerHTML = '';
        return;
      }

      // Auto-assign grid positions to nodes missing coordinates
      let idx = 0;
      for (const node of Object.values(tree.nodes)) {
        if (!node.position) {
          node.position = { x: 50 + (idx % 3) * 400, y: 50 + Math.floor(idx / 3) * 440 };
        }
        idx++;
      }

      const titleInput = this.element.querySelector('#tree-title-input') as HTMLInputElement;
      const startNodeInput = this.element.querySelector('#tree-start-node-input') as HTMLInputElement;
      const sceneSelect = this.element.querySelector('#tree-scene-select') as HTMLSelectElement;

      if (titleInput) titleInput.value = tree.title;
      if (startNodeInput) startNodeInput.value = tree.startNodeId;
      if (sceneSelect) {
        sceneSelect.value = DialogEditorUtils.getSequenceSceneId(this.project, tree);
      }

      nodesContainer.innerHTML = Object.values(tree.nodes).map(node =>
        NodeViewFactory.renderNodeCard({ node, tree, project: this.project })
      ).join('');

      this.canvasController.updateTransform();

      setTimeout(() => {
        if (svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: this.canvasController.zoomLevel,
            isWiring: this.canvasController.isWiring,
            tempWirePath: this.canvasController.tempWirePath,
            onWireDeleted: () => this.renderSequenceView()
          });
        }
      }, 0);

      this.attachSequenceEvents(tree);
    }
  }

  private renderTreeListOnly(): void {
    if (!this.project) return;
    const treeList = this.element.querySelector('#dialog-tree-list');
    if (treeList) {
      treeList.innerHTML = DialogEditorTemplate.renderTreeList({
        dialogs: this.project.dialogs,
        selectedTreeId: this.selectedTreeId,
        project: this.project,
        sceneFilter: this.selectedSceneFilter
      });

      treeList.querySelectorAll('.tree-item').forEach(el => {
        el.addEventListener('click', (e) => {
          const treeId = (e.currentTarget as HTMLElement).dataset.treeid!;
          this.selectedTreeId = treeId;
          this.renderSequenceView();
        });
      });
    }
  }

  private attachSequenceEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Attach canvas drag & wiring interactions
    this.canvasController.attachCanvasInteractions(tree);

    // Attach node card internal form & drag events
    NodeViewFactory.attachNodeEvents({
      container: this.element,
      tree,
      project: this.project,
      onReRender: () => this.renderSequenceView(),
      onUpdate: emitUpdate
    });
  }
}
