import { ProjectData, DialogTree, DialogNodeType } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { DialogEditorUtils } from './DialogEditorUtils';
import { DialogEditorTemplate } from './templates/NodeViews.template';
import { NodeViewFactory } from './nodes/NodeViewFactory';
import { GraphWireRenderer } from './GraphWireRenderer';
import { GraphCanvasController } from './GraphCanvasController';

export interface DialogSequenceHost {
  getProject: () => ProjectData | null;
  getSelectedTreeId: () => string | null;
  setSelectedTreeId: (id: string | null) => void;
  getSelectedSceneFilter: () => string;
  setSelectedSceneFilter: (filter: string) => void;
  getActiveSceneId: () => string | null;
  setActiveSceneId: (id: string | null) => void;
  getCanvasController: () => GraphCanvasController;
  onRenderCurrentView: () => void;
  onSwitchViewMode: (mode: 'storyboard' | 'sequences') => void;
}

export class DialogSequenceController {
  constructor(
    private container: HTMLElement,
    private host: DialogSequenceHost
  ) {}

  public getActiveTree(): DialogTree | null {
    const project = this.host.getProject();
    const selectedTreeId = this.host.getSelectedTreeId();
    if (!project || !selectedTreeId) return null;
    return project.dialogs.find(d => d.id === selectedTreeId) || null;
  }

  public populateSceneDropdowns(): void {
    const project = this.host.getProject();
    if (!project) return;

    // 1. Sidebar scene filter dropdown
    const filterSelect = this.container.querySelector('#select-sequence-scene-filter') as HTMLSelectElement;
    if (filterSelect) {
      const selectedFilter = this.host.getSelectedSceneFilter();
      let filterHtml = `
        <option value="all" ${selectedFilter === 'all' ? 'selected' : ''}>🌐 All Scenes & Sequences</option>
        <option value="global" ${selectedFilter === 'global' ? 'selected' : ''}>✨ Global / Game Sequences</option>
      `;
      project.scenes.forEach(sc => {
        filterHtml += `<option value="${sc.id}" ${selectedFilter === sc.id ? 'selected' : ''}>🏰 ${sc.name}</option>`;
      });
      filterSelect.innerHTML = filterHtml;
    }

    // 2. Active sequence scene assignment dropdown
    const sceneSelect = this.container.querySelector('#tree-scene-select') as HTMLSelectElement;
    if (sceneSelect) {
      const activeTree = this.getActiveTree();
      const currentScId = activeTree ? DialogEditorUtils.getSequenceSceneId(project, activeTree) : 'global';

      let sceneOptHtml = `<option value="global" ${currentScId === 'global' ? 'selected' : ''}>🌐 Global / Any Scene</option>`;
      project.scenes.forEach(sc => {
        sceneOptHtml += `<option value="${sc.id}" ${currentScId === sc.id ? 'selected' : ''}>🏰 ${sc.name}</option>`;
      });
      sceneSelect.innerHTML = sceneOptHtml;
    }
  }

  public initEventListeners(): void {
    // Sidebar scene filter
    this.container.querySelector('#select-sequence-scene-filter')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.host.setSelectedSceneFilter(val);
      const backBtn = this.container.querySelector('#btn-back-to-storyboard') as HTMLElement;
      if (backBtn) {
        backBtn.style.display = (val !== 'all') ? 'inline-block' : 'none';
      }
      this.renderTreeListOnly();
    });

    // Tree scene assignment
    this.container.querySelector('#tree-scene-select')?.addEventListener('change', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.sceneId = (e.target as HTMLSelectElement).value;
        EventBus.getInstance().emit('editor:project_updated');
        this.renderTreeListOnly();
      }
    });

    // Add Tree
    this.container.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      this.addNewSequence();
    });

    // Delete Tree
    this.container.querySelector('#btn-delete-tree')?.addEventListener('click', () => {
      const selectedId = this.host.getSelectedTreeId();
      if (selectedId) {
        this.deleteSequence(selectedId);
      }
    });

    // Add Node buttons
    this.container.querySelector('#btn-add-beat-node')?.addEventListener('click', () => {
      this.addNode('beat');
    });

    this.container.querySelector('#btn-add-router-node')?.addEventListener('click', () => {
      this.addNode('router');
    });

    this.container.querySelector('#btn-add-event-node')?.addEventListener('click', () => {
      this.addNode('event_listener');
    });

    this.container.querySelector('#btn-add-action-node')?.addEventListener('click', () => {
      this.addNode('action');
    });

    // Sequence title & start node inputs
    this.container.querySelector('#tree-title-input')?.addEventListener('input', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.title = (e.target as HTMLInputElement).value;
        this.renderTreeListOnly();
        EventBus.getInstance().emit('editor:project_updated');
      }
    });

    this.container.querySelector('#tree-start-node-input')?.addEventListener('input', (e) => {
      const activeTree = this.getActiveTree();
      if (activeTree) {
        activeTree.startNodeId = (e.target as HTMLInputElement).value.trim();
        EventBus.getInstance().emit('editor:project_updated');
      }
    });
  }

  public addNewSequence(): void {
    const project = this.host.getProject();
    if (!project) return;
    const filter = this.host.getSelectedSceneFilter();
    const targetScene = filter !== 'all' ? filter : 'global';
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
    project.dialogs.push(newTree);
    this.host.setSelectedTreeId(newTree.id);
    this.host.onRenderCurrentView();
    EventBus.getInstance().emit('editor:project_updated');
  }

  public deleteSequence(treeId: string): void {
    const project = this.host.getProject();
    if (!project) return;
    const tree = project.dialogs.find(d => d.id === treeId);
    if (!tree) return;

    const confirmed = window.confirm(`Are you sure you want to delete the sequence "${tree.title || tree.id}"?\n\nThis will remove all its nodes and connections. This action cannot be undone.`);
    if (!confirmed) return;

    project.dialogs = project.dialogs.filter(d => d.id !== treeId);
    if (project.dialogs.length === 0) {
      const filter = this.host.getSelectedSceneFilter();
      const defaultTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Sequence',
        startNodeId: 'beat_1',
        sceneId: filter !== 'all' ? filter : 'global',
        nodes: {
          beat_1: {
            id: 'beat_1',
            speaker: 'Hero',
            text: 'Sequence starting line.',
            position: { x: 60, y: 60 }
          }
        }
      };
      project.dialogs.push(defaultTree);
      this.host.setSelectedTreeId(defaultTree.id);
    } else {
      this.host.setSelectedTreeId(project.dialogs[0].id);
    }

    this.host.onRenderCurrentView();
    EventBus.getInstance().emit('editor:project_updated');
  }

  public addNode(nodeType: DialogNodeType): void {
    const project = this.host.getProject();
    const selectedTreeId = this.host.getSelectedTreeId();
    if (!project || !selectedTreeId) return;
    const tree = project.dialogs.find(d => d.id === selectedTreeId);
    if (!tree) return;

    const nodeCount = Object.keys(tree.nodes).length + 1;
    const newNodeId = `${nodeType === 'event_listener' ? 'event' : nodeType}_${nodeCount}`;

    if (nodeType === 'beat') {
      const playerChar = project.scenes?.flatMap(s => s.characters || []).find(c => c.id === 'player');
      const defaultSpeaker = playerChar?.name || 'Hero';
      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'beat',
        speaker: defaultSpeaker,
        actorId: playerChar ? 'player' : undefined,
        text: 'Character speech or narrative line.',
        directives: [],
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };
    } else if (nodeType === 'router') {
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
    } else if (nodeType === 'event_listener') {
      tree.nodes[newNodeId] = {
        id: newNodeId,
        nodeType: 'event_listener',
        eventScope: 'scene',
        eventTargetId: project.scenes[0]?.id || '',
        eventName: 'enter',
        speaker: 'Event Trigger',
        text: '',
        position: { x: 100 + (nodeCount * 30), y: 100 + (nodeCount * 40) }
      };
    } else if (nodeType === 'action') {
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
    }

    this.host.onRenderCurrentView();
    EventBus.getInstance().emit('editor:project_updated');
  }

  public renderSequenceView(): void {
    const project = this.host.getProject();
    if (!project) return;
    this.renderTreeListOnly();

    const nodesContainer = this.container.querySelector('#dialog-nodes-container');
    const svgEl = this.container.querySelector('#dialog-connections-svg') as SVGElement;
    const transformLayer = this.container.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const selectedTreeId = this.host.getSelectedTreeId();
    const canvasController = this.host.getCanvasController();

    if (nodesContainer && selectedTreeId) {
      const tree = project.dialogs.find(d => d.id === selectedTreeId);
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

      const titleInput = this.container.querySelector('#tree-title-input') as HTMLInputElement;
      const startNodeInput = this.container.querySelector('#tree-start-node-input') as HTMLInputElement;
      const sceneSelect = this.container.querySelector('#tree-scene-select') as HTMLSelectElement;

      if (titleInput) titleInput.value = tree.title;
      if (startNodeInput) startNodeInput.value = tree.startNodeId;
      if (sceneSelect) {
        sceneSelect.value = DialogEditorUtils.getSequenceSceneId(project, tree);
      }

      nodesContainer.innerHTML = Object.values(tree.nodes).map(node =>
        NodeViewFactory.renderNodeCard({ node, tree, project })
      ).join('');

      canvasController.updateTransform();

      setTimeout(() => {
        if (svgEl && transformLayer) {
          GraphWireRenderer.renderConnectionLines({
            tree,
            svgEl,
            transformLayer,
            zoomLevel: canvasController.zoomLevel,
            isWiring: canvasController.isWiring,
            tempWirePath: canvasController.tempWirePath,
            onWireDeleted: () => this.renderSequenceView()
          });
        }
      }, 0);

      this.attachSequenceEvents(tree);
    }
  }

  public renderTreeListOnly(): void {
    const project = this.host.getProject();
    if (!project) return;
    const treeList = this.container.querySelector('#dialog-tree-list');
    if (treeList) {
      treeList.innerHTML = DialogEditorTemplate.renderTreeList({
        dialogs: project.dialogs,
        selectedTreeId: this.host.getSelectedTreeId(),
        project,
        sceneFilter: this.host.getSelectedSceneFilter()
      });

      treeList.querySelectorAll('.tree-item').forEach(el => {
        el.addEventListener('click', (e) => {
          const treeId = (e.currentTarget as HTMLElement).dataset.treeid!;
          this.host.setSelectedTreeId(treeId);
          this.renderSequenceView();
        });
      });
    }
  }

  private attachSequenceEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    const canvasController = this.host.getCanvasController();
    canvasController.attachCanvasInteractions(tree);

    NodeViewFactory.attachNodeEvents({
      container: this.container,
      tree,
      project: this.host.getProject(),
      onReRender: () => this.renderSequenceView(),
      onUpdate: emitUpdate
    });
  }
}
