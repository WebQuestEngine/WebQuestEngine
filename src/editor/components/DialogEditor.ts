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

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'dialog-editor-container hidden';

    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'dialog-editor-backdrop hidden';
    this.backdropElement.addEventListener('click', () => this.hide());

    this.canvasController = new GraphCanvasController(this.element, {
      getActiveTree: () => this.getActiveTree(),
      onUpdate: () => EventBus.getInstance().emit('editor:project_updated'),
      onReRenderTree: () => this.renderTree()
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

    EventBus.getInstance().on('editor:open_dialog_editor', (data?: { dialogId?: string }) => {
      if (data?.dialogId) {
        this.selectedTreeId = data.dialogId;
      }
      this.show();
    });
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    if (this.project.dialogs && this.project.dialogs.length > 0) {
      if (!this.selectedTreeId || !this.project.dialogs.some(d => d.id === this.selectedTreeId)) {
        this.selectedTreeId = this.project.dialogs[0].id;
      }
    }
    this.renderTree();
  }

  public selectTree(treeId: string): void {
    this.selectedTreeId = treeId;
    this.renderTree();
  }

  public show(): void {
    if (!this.backdropElement.parentElement && this.element.parentElement) {
      this.element.parentElement.insertBefore(this.backdropElement, this.element);
    }
    this.backdropElement.classList.remove('hidden');
    this.element.classList.remove('hidden');
    this.renderTree();
  }

  public hide(): void {
    this.canvasController.stopAutoPan();
    this.backdropElement.classList.add('hidden');
    this.element.classList.add('hidden');
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

    this.renderTree();
    EventBus.getInstance().emit('editor:project_updated');
  }

  private render(): void {
    this.element.innerHTML = DialogEditorTemplate.renderLayout();
    this.element.querySelector('#dialog-nodes-viewport')?.appendChild(this.zoomWidget.element);

    this.element.querySelector('#btn-close-dialog-editor')?.addEventListener('click', () => {
      this.hide();
    });

    this.element.querySelector('#btn-delete-tree')?.addEventListener('click', () => {
      if (this.selectedTreeId) {
        this.deleteSequence(this.selectedTreeId);
      }
    });

    this.element.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      if (!this.project) return;
      const newTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Cinematic Sequence',
        startNodeId: 'beat_1',
        nodes: {
          beat_1: {
            id: 'beat_1',
            speaker: 'Hero',
            text: 'Greetings, adventurer! What news do you bring?',
            position: { x: 60, y: 60 }
          }
        }
      };
      this.project.dialogs.push(newTree);
      this.selectedTreeId = newTree.id;
      this.renderTree();
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

      this.renderTree();
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

      this.renderTree();
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

      this.renderTree();
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
        actionCategory: 'screen_effect',
        screenEffectType: 'fade_in',
        screenEffectDuration: 1.0,
        screenEffectColor: '#000000',
        speaker: 'Action',
        text: '',
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };

      this.renderTree();
      EventBus.getInstance().emit('editor:project_updated');
    });

    // Sequence title & start node inputs
    this.element.querySelector('#tree-title-input')?.addEventListener('input', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.title = (e.target as HTMLInputElement).value;
        const treeItemLabel = this.element.querySelector(`.dialog-tree-item[data-treeid="${activeTree.id}"] .tree-item-select div:first-child`);
        if (treeItemLabel) {
          treeItemLabel.textContent = `🎬 ${activeTree.title || activeTree.id}`;
        }
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

  private renderTree(): void {
    if (!this.project) return;
    const treeList = this.element.querySelector('#dialog-tree-list');
    const nodesContainer = this.element.querySelector('#dialog-nodes-container');
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;

    if (treeList) {
      treeList.innerHTML = DialogEditorTemplate.renderTreeList({
        dialogs: this.project.dialogs,
        selectedTreeId: this.selectedTreeId,
      });
    }

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
      if (titleInput) titleInput.value = tree.title;
      if (startNodeInput) startNodeInput.value = tree.startNodeId;

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
            onWireDeleted: () => this.renderTree()
          });
        }
      }, 0);

      this.attachEvents(tree);
    }
  }

  private attachEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Sidebar Sequence List Selection & Deletion
    this.element.querySelectorAll('.tree-item-select').forEach(el => {
      el.addEventListener('click', (e) => {
        const treeId = (e.currentTarget as HTMLElement).dataset.treeid!;
        this.selectedTreeId = treeId;
        this.renderTree();
      });
    });

    this.element.querySelectorAll('.btn-del-tree-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const treeId = (e.currentTarget as HTMLElement).dataset.treeid!;
        this.deleteSequence(treeId);
      });
    });

    // Attach canvas drag & wiring interactions
    this.canvasController.attachCanvasInteractions(tree);

    // Attach node card internal form & drag events
    NodeViewFactory.attachNodeEvents({
      container: this.element,
      tree,
      project: this.project,
      onReRender: () => this.renderTree(),
      onUpdate: emitUpdate
    });
  }
}
