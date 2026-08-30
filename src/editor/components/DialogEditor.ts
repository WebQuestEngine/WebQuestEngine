import { ProjectData, DialogTree } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { DialogEditorUtils } from './dialog/DialogEditorUtils';
import { GraphWireRenderer } from './dialog/GraphWireRenderer';
import { GraphCanvasController } from './dialog/GraphCanvasController';
import { NodeViewFactory } from './dialog/nodes/NodeViewFactory';

export class DialogEditor {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;
  private canvasController: GraphCanvasController;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'dialog-editor-container view-modal hidden';

    this.canvasController = new GraphCanvasController(this.element, {
      getActiveTree: () => this.getActiveTree(),
      onUpdate: () => EventBus.getInstance().emit('editor:project_updated'),
      onReRenderTree: () => this.renderTree()
    });

    this.render();

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
    this.element.classList.remove('hidden');
    this.renderTree();
  }

  public hide(): void {
    this.canvasController.stopAutoPan();
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
    this.element.innerHTML = `
      <div class="view-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <h2 style="font-family: var(--font-heading); color: var(--accent-gold); margin-right:4px;">🎬 Visual Sequences & Scripting Studio</h2>
          <button class="btn btn-primary" id="btn-add-beat-node" style="font-size:0.75rem; background:#1e293b; border-color:#38bdf8; color:#38bdf8;">🎬 + Beat (Dialogue)</button>
          <button class="btn btn-primary" id="btn-add-router-node" style="font-size:0.75rem; background:linear-gradient(135deg, #7e22ce, #a855f7); border-color:#c084fc;">🔀 + Router (Logic)</button>
          <button class="btn btn-primary" id="btn-add-event-node" style="font-size:0.75rem; background:linear-gradient(135deg, #b45309, #d97706); border-color:#f59e0b; color:#fff;">⚡ + Event Trigger</button>
          <button class="btn btn-primary" id="btn-add-action-node" style="font-size:0.75rem; background:linear-gradient(135deg, #047857, #059669); border-color:#10b981; color:#fff;">✨ + Action / FX</button>
        </div>
        <button class="btn btn-primary" id="btn-close-dialog-editor">Close Editor</button>
      </div>
      <div class="view-modal-content" style="display: flex; gap: 16px; height: calc(100% - 60px);">
        <div style="width: 260px; border-right: 1px solid var(--panel-border); padding-right: 14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size: 0.9rem; color: var(--accent-gold); margin:0;">Dialogue / Cutscene Graphs</h3>
            <button class="btn btn-primary" id="btn-add-tree" style="font-size:0.75rem; padding:4px 8px;">+ New Graph</button>
          </div>
          <div id="dialog-tree-list" style="display: flex; flex-direction: column; gap: 6px; overflow-y:auto; flex:1;"></div>
        </div>
        
        <!-- Pan & Zoom Interactive Viewport Canvas -->
        <div style="flex: 1; position:relative; overflow:hidden; background:#0f172a; cursor:grab; user-select:none;" class="graph-canvas" id="dialog-nodes-viewport">
          
          <!-- Fixed Top Toolbar Overlay for Dialogue Title & Start Node & Delete -->
          <div id="dialog-tree-header-bar" style="position:absolute; top:16px; left:16px; display:flex; gap:10px; align-items:center; z-index:100; background:rgba(15,23,42,0.92); padding:8px 14px; border-radius:8px; border:1px solid var(--panel-border); box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Sequence Title:</label>
            <input type="text" id="tree-title-input" class="form-input" value="" style="width:220px;" />
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Start Beat ID:</label>
            <input type="text" id="tree-start-node-input" class="form-input" value="" style="width:110px;" />
            <button class="btn btn-primary" id="btn-delete-tree" style="font-size:0.75rem; padding:4px 10px; color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Delete this sequence graph">🗑️ Delete Sequence</button>
          </div>

          <div id="dialog-graph-transform-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:visible; transform-origin: 0 0;">
            <svg id="dialog-connections-svg" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:3;">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
                </marker>
              </defs>
            </svg>
            <div id="dialog-nodes-container" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:visible; z-index:2; pointer-events:none;"></div>
          </div>

          <!-- Pan & Zoom Control Overlay -->
          <div class="zoom-controls-overlay" style="position:absolute; bottom:16px; right:16px; display:flex; gap:6px; z-index:100; background:rgba(15,23,42,0.9); padding:6px 10px; border-radius:8px; border:1px solid var(--panel-border); box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <button class="btn btn-primary" id="btn-zoom-out" style="padding:3px 8px; font-size:0.8rem;" title="Zoom Out (Mouse Wheel Down)">🔍 -</button>
            <span id="zoom-level-label" style="font-size:0.75rem; font-weight:700; color:var(--accent-gold); align-self:center; min-width:46px; text-align:center;">100%</span>
            <button class="btn btn-primary" id="btn-zoom-in" style="padding:3px 8px; font-size:0.8rem;" title="Zoom In (Mouse Wheel Up)">🔍 +</button>
            <button class="btn btn-primary" id="btn-reset-view" style="padding:3px 8px; font-size:0.75rem;" title="Reset Pan & Zoom">🎯 Reset View</button>
          </div>
        </div>
      </div>
    `;

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

    // Zoom Buttons
    this.element.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      this.canvasController.zoomLevel = Math.min(2.5, this.canvasController.zoomLevel * 1.15);
      this.canvasController.updateTransform();
      const tree = this.getActiveTree();
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
      if (tree && svgEl && transformLayer) {
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
    });

    this.element.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      this.canvasController.zoomLevel = Math.max(0.2, this.canvasController.zoomLevel / 1.15);
      this.canvasController.updateTransform();
      const tree = this.getActiveTree();
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
      if (tree && svgEl && transformLayer) {
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
    });

    this.element.querySelector('#btn-reset-view')?.addEventListener('click', () => {
      this.canvasController.zoomLevel = 1.0;
      this.canvasController.panOffset = { x: 0, y: 0 };
      this.canvasController.updateTransform();
      const tree = this.getActiveTree();
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
      if (tree && svgEl && transformLayer) {
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
      treeList.innerHTML = this.project.dialogs.map(dlg => {
        const isSel = dlg.id === this.selectedTreeId;
        const nodeCount = Object.keys(dlg.nodes || {}).length;
        return `
          <div class="dialog-tree-item ${isSel ? 'active' : ''}" data-treeid="${dlg.id}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:6px; background:${isSel ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isSel ? 'var(--accent-gold)' : 'transparent'}; cursor:pointer; transition:all 0.15s ease;">
            <div class="tree-item-select" data-treeid="${dlg.id}" style="flex:1; overflow:hidden;">
              <div style="font-weight:${isSel ? '700' : '500'}; color:${isSel ? 'var(--accent-gold)' : 'var(--text-main)'}; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🎬 ${DialogEditorUtils.escapeHtml(dlg.title || dlg.id)}</div>
              <div style="font-size:0.65rem; color:var(--text-muted);">ID: ${dlg.id} (${nodeCount} node${nodeCount !== 1 ? 's' : ''})</div>
            </div>
            <button class="btn btn-del-tree-item" data-treeid="${dlg.id}" style="padding:2px 5px; font-size:0.7rem; color:#ef4444; background:transparent; border:none; opacity:0.7; cursor:pointer;" title="Delete Sequence">🗑️</button>
          </div>
        `;
      }).join('');
    }

    if (nodesContainer && this.selectedTreeId) {
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) {
        nodesContainer.innerHTML = '<div style="padding:20px; color:var(--text-muted); pointer-events:auto;">Select a cinematic sequence to edit.</div>';
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
