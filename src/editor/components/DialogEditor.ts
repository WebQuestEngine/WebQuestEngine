import { ProjectData, DialogTree, DialogNode, DialogChoice, Vector2D } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class DialogEditor {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;

  // Pan & Zoom Canvas State
  private panOffset: Vector2D = { x: 0, y: 0 };
  private zoomLevel: number = 1.0;
  private isPanning = false;
  private panStart: Vector2D = { x: 0, y: 0 };

  // Node Dragging State
  private isDraggingNode = false;
  private draggedNodeId: string | null = null;
  private dragOffset: Vector2D = { x: 0, y: 0 };

  // Interactive Wiring State
  private isWiring = false;
  private wireSourceNodeId: string | null = null;
  private wireSourceCIdx: number | null = null;
  private wireStartPt: Vector2D = { x: 0, y: 0 };
  private tempWirePath: string | null = null;

  // Viewport Edge Auto-Pan State
  private autoPanRafId: number | null = null;
  private autoPanVx: number = 0;
  private autoPanVy: number = 0;
  private lastClientX: number = 0;
  private lastClientY: number = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'view-modal hidden';
    this.render();
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    if (project.dialogs.length > 0 && !this.selectedTreeId) {
      this.selectedTreeId = project.dialogs[0].id;
    }
    this.renderTree();
  }

  public show(): void {
    this.element.classList.remove('hidden');
    this.renderTree();
  }

  public hide(): void {
    this.stopAutoPan();
    this.element.classList.add('hidden');
  }

  private updateEdgePanVelocity(e: MouseEvent, viewport: HTMLElement): void {
    const vRect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - vRect.left;
    const mouseY = e.clientY - vRect.top;
    const edgeMargin = 85;
    const maxSpeed = 16;

    let vx = 0;
    let vy = 0;

    // Left edge (cursor near left edge) -> canvas moves right, panning view left
    if (mouseX < edgeMargin) {
      const ratio = Math.min(1.8, (edgeMargin - mouseX) / edgeMargin);
      vx = ratio * maxSpeed;
    }
    // Right edge (cursor near right edge) -> canvas moves left, panning view right
    else if (mouseX > vRect.width - edgeMargin) {
      const ratio = Math.min(1.8, (mouseX - (vRect.width - edgeMargin)) / edgeMargin);
      vx = -ratio * maxSpeed;
    }

    // Top edge (cursor near top edge) -> canvas moves down, panning view up
    if (mouseY < edgeMargin) {
      const ratio = Math.min(1.8, (edgeMargin - mouseY) / edgeMargin);
      vy = ratio * maxSpeed;
    }
    // Bottom edge (cursor near bottom edge) -> canvas moves up, panning view down
    else if (mouseY > vRect.height - edgeMargin) {
      const ratio = Math.min(1.8, (mouseY - (vRect.height - edgeMargin)) / edgeMargin);
      vy = -ratio * maxSpeed;
    }

    this.autoPanVx = vx;
    this.autoPanVy = vy;
  }

  private startAutoPan(tree: DialogTree, svgEl: SVGElement, transformLayer: HTMLElement): void {
    if (this.autoPanRafId !== null) return;

    const loop = () => {
      if (!this.isWiring && !this.isDraggingNode) {
        this.stopAutoPan();
        return;
      }

      if (this.autoPanVx !== 0 || this.autoPanVy !== 0) {
        this.panOffset.x += this.autoPanVx;
        this.panOffset.y += this.autoPanVy;
        this.updateTransform();

        const lRect = transformLayer.getBoundingClientRect();

        if (this.isWiring) {
          const currentX = (this.lastClientX - lRect.left) / this.zoomLevel;
          const currentY = (this.lastClientY - lRect.top) / this.zoomLevel;
          const dx = Math.max(30, Math.abs(currentX - this.wireStartPt.x) * 0.5);
          this.tempWirePath = `M ${this.wireStartPt.x} ${this.wireStartPt.y} C ${this.wireStartPt.x + dx} ${this.wireStartPt.y}, ${currentX - dx} ${currentY}, ${currentX} ${currentY}`;
        } else if (this.isDraggingNode && this.draggedNodeId && tree.nodes[this.draggedNodeId]) {
          const node = tree.nodes[this.draggedNodeId];
          node.position = {
            x: Math.max(10, (this.lastClientX - lRect.left) / this.zoomLevel - this.dragOffset.x),
            y: Math.max(10, (this.lastClientY - lRect.top) / this.zoomLevel - this.dragOffset.y)
          };
          const card = transformLayer.querySelector(`.dialog-graph-card[data-nodeid="${this.draggedNodeId}"]`) as HTMLElement;
          if (card) {
            card.style.left = `${node.position.x}px`;
            card.style.top = `${node.position.y}px`;
          }
        }

        if (svgEl) this.renderConnectionLines(tree, svgEl);
      }

      this.autoPanRafId = requestAnimationFrame(loop);
    };

    this.autoPanRafId = requestAnimationFrame(loop);
  }

  private stopAutoPan(): void {
    if (this.autoPanRafId !== null) {
      cancelAnimationFrame(this.autoPanRafId);
      this.autoPanRafId = null;
    }
    this.autoPanVx = 0;
    this.autoPanVy = 0;
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="view-modal-header">
        <div style="display:flex; gap:12px; align-items:center;">
          <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">💬 Branching Dialogue Graph Editor</h2>
          <button class="btn btn-primary" id="btn-add-dialog-node" style="font-size:0.8rem;">+ Add Speech Node</button>
          <button class="btn btn-primary" id="btn-add-router-node" style="font-size:0.8rem; background:linear-gradient(135deg, #7e22ce, #a855f7); border-color:#c084fc;">🔀 + Add Logic Router</button>
        </div>
        <button class="btn btn-primary" id="btn-close-dialog-editor">Close Editor</button>
      </div>
      <div class="view-modal-content" style="display: flex; gap: 16px; height: calc(100% - 60px);">
        <div style="width: 260px; border-right: 1px solid var(--panel-border); padding-right: 14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size: 0.9rem; color: var(--accent-gold); margin:0;">Dialogue Trees</h3>
            <button class="btn btn-primary" id="btn-add-tree" style="font-size:0.75rem; padding:4px 8px;">+ New Tree</button>
          </div>
          <div id="dialog-tree-list" style="display: flex; flex-direction: column; gap: 6px; overflow-y:auto; flex:1;"></div>
        </div>
        
        <!-- Pan & Zoom Interactive Viewport Canvas -->
        <div style="flex: 1; position:relative; overflow:hidden; background:#0f172a; cursor:grab; user-select:none;" class="graph-canvas" id="dialog-nodes-viewport">
          
          <!-- Fixed Top Toolbar Overlay for Dialogue Title & Start Node -->
          <div id="dialog-tree-header-bar" style="position:absolute; top:16px; left:16px; display:flex; gap:12px; align-items:center; z-index:100; background:rgba(15,23,42,0.92); padding:8px 14px; border-radius:8px; border:1px solid var(--panel-border); box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Dialogue Title:</label>
            <input type="text" id="tree-title-input" class="form-input" value="" style="width:240px;" />
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Start Node ID:</label>
            <input type="text" id="tree-start-node-input" class="form-input" value="" style="width:120px;" />
          </div>

          <div id="dialog-graph-transform-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; transform-origin: 0 0;">
            <svg id="dialog-connections-svg" style="position:absolute; top:0; left:0; width:8000px; height:8000px; pointer-events:none; z-index:3;">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
                </marker>
              </defs>
            </svg>
            <div id="dialog-nodes-container" style="position:absolute; top:0; left:0; width:8000px; height:8000px; z-index:2; pointer-events:none;"></div>
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

    this.element.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      if (!this.project) return;
      const newTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Dialogue Graph',
        startNodeId: 'node_1',
        nodes: {
          node_1: {
            id: 'node_1',
            speaker: 'NPC',
            text: 'Hello adventurer! What brings you here?',
            position: { x: 60, y: 60 }
          }
        }
      };
      this.project.dialogs.push(newTree);
      this.selectedTreeId = newTree.id;
      this.renderTree();
      EventBus.getInstance().emit('editor:project_updated');
    });

    this.element.querySelector('#btn-add-dialog-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `node_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
        speaker: 'Hero',
        text: 'Character speech or response line.',
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
        speaker: 'Router',
        text: '',
        isRouterNode: true,
        choices: [
          { id: 'branch_1', text: 'If Has Flag...', nextNodeId: '' },
          { id: 'branch_2', text: 'Otherwise Fallback...', nextNodeId: '' }
        ],
        position: { x: 120 + (nodeCount * 30), y: 120 + (nodeCount * 40) }
      };

      this.renderTree();
      EventBus.getInstance().emit('editor:project_updated');
    });

    // Zoom Buttons
    this.element.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      this.zoomLevel = Math.min(2.5, this.zoomLevel * 1.15);
      this.updateTransform();
      const tree = this.project?.dialogs.find(d => d.id === this.selectedTreeId);
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      if (tree && svgEl) this.renderConnectionLines(tree, svgEl);
    });

    this.element.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      this.zoomLevel = Math.max(0.2, this.zoomLevel / 1.15);
      this.updateTransform();
      const tree = this.project?.dialogs.find(d => d.id === this.selectedTreeId);
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      if (tree && svgEl) this.renderConnectionLines(tree, svgEl);
    });

    this.element.querySelector('#btn-reset-view')?.addEventListener('click', () => {
      this.zoomLevel = 1.0;
      this.panOffset = { x: 0, y: 0 };
      this.updateTransform();
      const tree = this.project?.dialogs.find(d => d.id === this.selectedTreeId);
      const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;
      if (tree && svgEl) this.renderConnectionLines(tree, svgEl);
    });
  }

  private updateTransform(): void {
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const zoomLabel = this.element.querySelector('#zoom-level-label');
    if (transformLayer) {
      transformLayer.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoomLevel})`;
    }
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  private renderTree(): void {
    if (!this.project) return;
    const treeList = this.element.querySelector('#dialog-tree-list');
    const nodesContainer = this.element.querySelector('#dialog-nodes-container');
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;

    if (treeList) {
      treeList.innerHTML = '';
      for (const dlg of this.project.dialogs) {
        const btn = document.createElement('button');
        btn.className = `btn ${dlg.id === this.selectedTreeId ? 'btn-primary' : ''}`;
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.innerHTML = `💬 <b>${dlg.title}</b><br/><span style="font-size:0.65rem; color:var(--text-muted);">ID: ${dlg.id}</span>`;
        btn.addEventListener('click', () => {
          this.selectedTreeId = dlg.id;
          this.renderTree();
        });
        treeList.appendChild(btn);
      }
    }

    if (nodesContainer && this.selectedTreeId) {
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) {
        nodesContainer.innerHTML = '<div style="padding:20px; color:var(--text-muted); pointer-events:auto;">Select a dialogue tree to edit.</div>';
        if (svgEl) svgEl.innerHTML = '';
        return;
      }

      // Auto-assign grid positions to nodes missing coordinates
      let idx = 0;
      for (const node of Object.values(tree.nodes)) {
        if (!node.position) {
          node.position = { x: 50 + (idx % 3) * 360, y: 50 + Math.floor(idx / 3) * 380 };
        }
        idx++;
      }

      const titleInput = this.element.querySelector('#tree-title-input') as HTMLInputElement;
      const startNodeInput = this.element.querySelector('#tree-start-node-input') as HTMLInputElement;
      if (titleInput) titleInput.value = tree.title;
      if (startNodeInput) startNodeInput.value = tree.startNodeId;

      nodesContainer.innerHTML = `
        ${Object.values(tree.nodes).map(node => {
          const isStartNode = node.id === tree.startNodeId;
          const isRouter = Boolean(node.isRouterNode);
          const choiceCount = node.choices?.length || 0;
          const hasMultipleOutgoing = choiceCount > 1;
          const isInteractive = node.isChoiceInteractive !== false;

          const cardBg = isRouter
            ? 'linear-gradient(135deg, rgba(76,29,149,0.95), rgba(30,41,59,0.96))'
            : 'rgba(30,41,59,0.94)';

          const cardBorder = isRouter
            ? '#c084fc'
            : (isStartNode ? 'var(--accent-gold)' : 'var(--panel-border)');

          return `
            <div class="dialog-graph-card" data-nodeid="${node.id}" style="position:absolute; left:${node.position?.x || 50}px; top:${node.position?.y || 50}px; width:340px; background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:0.8rem; pointer-events:auto;">
              
              <!-- Left Input Port (To connect incoming response arrows) -->
              <div class="node-port node-port-in" data-nodeid="${node.id}" style="position:absolute; left:-9px; top:18px; width:18px; height:18px; border-radius:50%; background:${isRouter ? '#c084fc' : '#38bdf8'}; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px ${isRouter ? 'rgba(192,132,252,0.9)' : 'rgba(56,189,248,0.9)'}; z-index:10;" title="Input Port: Drag an arrow from another node's output port to connect here"></div>

              <!-- Header -->
              <div class="node-drag-handle" data-nodeid="${node.id}" style="display:flex; justify-content:space-between; align-items:center; cursor:move; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:6px; align-items:center;">
                  <span style="font-weight:700; color:${isRouter ? '#c084fc' : (isStartNode ? 'var(--accent-gold)' : '#38bdf8')};">${isRouter ? '🔀 ROUTER:' : '🆔'} ${node.id}</span>
                  ${isStartNode ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>' : ''}
                </div>
                <div style="display:flex; gap:4px;">
                  <button class="btn btn-toggle-router" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 5px;" title="Toggle Logic Router Node">${isRouter ? '💬 Speech' : '🔀 Router'}</button>
                  ${!isStartNode ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>` : ''}
                  <button class="btn btn-del-node" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px; color:#ef4444;" title="Delete Node">✕</button>
                </div>
              </div>

              ${!isRouter ? `
                <!-- Speaker & Text -->
                <div style="margin-bottom:6px; position:relative;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">🗣️ Speaker Name</label>
                  <input type="text" class="form-input node-speaker" data-nodeid="${node.id}" value="${node.speaker}" placeholder="Speaker" style="width:100%; font-weight:600;" />
                  
                  <!-- Main Node Output Port (if NO response choices exist) -->
                  ${choiceCount === 0 ? `
                    <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-21px; top:18px; width:18px; height:18px; border-radius:50%; background:#fbbf24; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(251,191,36,0.9); z-index:10;" title="Click & Drag arrow to connect to target node Input Port"></div>
                  ` : ''}
                </div>

                <div style="margin-bottom:6px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">💬 Spoken Dialogue Text</label>
                  <textarea class="form-input node-text" data-nodeid="${node.id}" style="width:100%; height:46px; font-size:0.8rem;">${node.text}</textarea>
                </div>

                <!-- Voiceover Audio URL -->
                <div style="margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">🎙️ Voiceover Audio File (URL)</label>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" class="form-input node-voice-url" data-nodeid="${node.id}" value="${node.voiceAudioUrl || ''}" placeholder="e.g. assets/audio/eldrin_line1.mp3" style="flex:1; font-size:0.75rem;" />
                    <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose Audio File">
                      📁
                      <input type="file" class="node-voice-file" data-nodeid="${node.id}" accept="audio/*" style="display:none;" />
                    </label>
                  </div>
                </div>
              ` : `
                <div style="background:rgba(192, 132, 252, 0.15); border:1px dashed #c084fc; border-radius:6px; padding:6px; margin-bottom:8px; font-size:0.7rem; color:#e9d5ff;">
                  ⚡ <b>Invisible Logic Router Node</b>: Evaluates outgoing conditions in order. The first matching branch is automatically selected!
                </div>
              `}

              <!-- Optional Per-Node Flag Tests & Actions -->
              <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:6px; margin-bottom:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div>
                  <label style="font-size:0.6rem; color:var(--text-muted);">If Req Flag</label>
                  <input type="text" class="form-input node-req-flag" data-nodeid="${node.id}" value="${node.requiredFlag || ''}" placeholder="e.g. hasItem:crystal" style="font-size:0.7rem;" />
                </div>
                <div>
                  <label style="font-size:0.6rem; color:var(--text-muted);">If NOT Flag</label>
                  <input type="text" class="form-input node-not-flag" data-nodeid="${node.id}" value="${node.notFlag || ''}" placeholder="e.g. hasItem:crystal" style="font-size:0.7rem;" />
                </div>
                <div>
                  <label style="font-size:0.6rem; color:var(--text-muted);">Set Story Flag</label>
                  <input type="text" class="form-input node-set-flag" data-nodeid="${node.id}" value="${node.setFlag || ''}" placeholder="e.g. talkedToEldrin" style="font-size:0.7rem;" />
                </div>
                <div>
                  <label style="font-size:0.6rem; color:var(--accent-gold); font-weight:700;">🎁 Give Item</label>
                  <select class="form-input node-give-item-select" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem; color:${node.giveItem ? '#38bdf8' : 'var(--text-muted)'}; font-weight:600;" title="Give item to player on entering this node">
                    <option value="">-- None --</option>
                    ${(this.project?.items || []).map(item => `
                      <option value="${item.id}" ${node.giveItem === item.id ? 'selected' : ''}>
                        🎁 ${item.name} (${item.id})
                      </option>
                    `).join('')}
                    ${node.giveItem && !(this.project?.items || []).some(it => it.id === node.giveItem) ? `
                      <option value="${node.giveItem}" selected>🎁 ${node.giveItem} (Custom)</option>
                    ` : ''}
                  </select>
                </div>
              </div>

              <!-- Interactivity Checkbox (when multiple choices exist) -->
              ${(!isRouter && hasMultipleOutgoing) ? `
                <div style="background:rgba(251, 191, 36, 0.1); border:1px solid rgba(251, 191, 36, 0.3); border-radius:6px; padding:6px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" class="node-interactive-chk" data-nodeid="${node.id}" ${isInteractive ? 'checked' : ''} id="chk_inter_${node.id}" />
                  <label for="chk_inter_${node.id}" style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; cursor:pointer;">
                    ☑️ Interactive Player Selection Box
                  </label>
                </div>
              ` : ''}

              <!-- Outgoing Choices / Router Branches -->
              <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:0.7rem; font-weight:700; color:${isRouter ? '#c084fc' : 'var(--accent-gold)'};">${isRouter ? 'Router Outgoing Branches' : 'Outgoing Responses'} (${choiceCount}):</span>
                  <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ ${isRouter ? 'Branch' : 'Response'}</button>
                </div>

                ${node.choices && node.choices.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${node.choices.map((c, cIdx) => `
                      <div class="choice-card" style="position:relative; background:rgba(0,0,0,0.3); border:1px solid var(--panel-border); padding:6px; border-radius:6px;">
                        <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                          <input type="text" class="form-input choice-text" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.text}" placeholder="${isRouter ? 'Branch Condition Description' : 'Choice Text'}" style="flex:1; font-size:0.75rem; font-weight:600;" />
                          <span style="font-size:0.65rem; color:var(--text-muted);">➔</span>
                          <select class="form-input choice-next-select" data-nodeid="${node.id}" data-cidx="${cIdx}" style="width:115px; font-size:0.7rem; color:${c.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:600;" title="Select target node to connect">
                            <option value="">-- End / None --</option>
                            ${Object.values(tree.nodes).map(targetN => `
                              <option value="${targetN.id}" ${c.nextNodeId === targetN.id ? 'selected' : ''}>
                                ${targetN.isRouterNode ? '🔀 ' : '💬 '}${targetN.id} (${targetN.speaker || 'Narrator'})
                              </option>
                            `).join('')}
                          </select>
                          ${c.nextNodeId ? `
                            <button class="btn btn-disconnect-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.65rem; color:#f59e0b;" title="✂️ Disconnect this wire">✂️</button>
                          ` : ''}
                          <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;" title="Delete Choice">✕</button>
                        </div>
                        
                        <!-- Choice Branch Flags & Actions -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:2px;">
                          <input type="text" class="form-input choice-req-flag" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.requiredFlag || ''}" placeholder="Req Flag (e.g. hasItem:crystal)" style="font-size:0.65rem;" title="Required Flag condition" />
                          <input type="text" class="form-input choice-not-flag" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.notFlag || ''}" placeholder="NOT Flag" style="font-size:0.65rem;" title="Must NOT have flag condition" />
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:3px;">
                          <input type="text" class="form-input choice-set-flag" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.setFlag || ''}" placeholder="🚩 Set Flag..." style="font-size:0.65rem;" title="Set flag upon choosing this response" />
                          <select class="form-input choice-give-item-select" data-nodeid="${node.id}" data-cidx="${cIdx}" style="width:100%; font-size:0.65rem; color:${c.giveItem ? '#38bdf8' : 'var(--text-muted)'}; font-weight:600;" title="Give item to player on choosing this response">
                            <option value="">🎁 Give Item: None</option>
                            ${(this.project?.items || []).map(item => `
                              <option value="${item.id}" ${c.giveItem === item.id ? 'selected' : ''}>
                                🎁 ${item.name} (${item.id})
                              </option>
                            `).join('')}
                            ${c.giveItem && !(this.project?.items || []).some(it => it.id === c.giveItem) ? `
                              <option value="${c.giveItem}" selected>🎁 ${c.giveItem} (Custom)</option>
                            ` : ''}
                          </select>
                        </div>

                        ${!isRouter ? `
                          <div style="margin-top:4px; display:flex; gap:6px; align-items:center;">
                            <input type="text" class="form-input choice-voice-url" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.voiceAudioUrl || ''}" placeholder="🎙️ Response Voiceover URL..." style="flex:1; font-size:0.7rem;" />
                            <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
                              📁
                              <input type="file" class="choice-voice-file" data-nodeid="${node.id}" data-cidx="${cIdx}" accept="audio/*" style="display:none;" />
                            </label>
                          </div>
                        ` : ''}
                        
                        <!-- Response Choice Output Port (Right Edge) -->
                        <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:${isRouter ? '#c084fc' : '#fbbf24'}; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px ${isRouter ? 'rgba(192,132,252,0.9)' : 'rgba(251,191,36,0.9)'}; z-index:10;" title="Click & Drag arrow to connect or reconnect to any target node Input Port"></div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="display:flex; gap:6px; align-items:center;">
                    <span style="font-size:0.65rem; color:var(--text-muted); white-space:nowrap;">Default Next Node:</span>
                    <select class="form-input node-next-select" data-nodeid="${node.id}" style="flex:1; font-size:0.75rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:600;" title="Select target node to connect">
                      <option value="">-- (None - End Dialogue) --</option>
                      ${Object.values(tree.nodes).filter(targetN => targetN.id !== node.id).map(targetN => `
                        <option value="${targetN.id}" ${node.nextNodeId === targetN.id ? 'selected' : ''}>
                          ${targetN.isRouterNode ? '🔀 ' : '💬 '}${targetN.id} (${targetN.speaker || 'Narrator'})
                        </option>
                      `).join('')}
                    </select>
                    ${node.nextNodeId ? `
                      <button class="btn btn-disconnect-node-next" data-nodeid="${node.id}" style="padding:2px 6px; font-size:0.65rem; color:#f59e0b;" title="✂️ Disconnect this wire">✂️ Disconnect</button>
                    ` : ''}
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      `;

      this.updateTransform();
      setTimeout(() => {
        this.renderConnectionLines(tree, svgEl);
      }, 0);
      this.attachEvents(tree);
    }
  }

  private renderConnectionLines(tree: DialogTree, svgEl: SVGElement): void {
    if (!svgEl) return;
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    if (!transformLayer) return;
    const layerRect = transformLayer.getBoundingClientRect();

    let pathsHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
        </marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
        </marker>
        <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c084fc"/>
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444"/>
        </marker>
      </defs>
    `;

    const nodes = tree.nodes;
    for (const sourceNode of Object.values(nodes)) {
      const isRouter = Boolean(sourceNode.isRouterNode);

      if (sourceNode.choices && sourceNode.choices.length > 0) {
        sourceNode.choices.forEach((c, cIdx) => {
          if (!c.nextNodeId || !nodes[c.nextNodeId]) return;

          const outPort = transformLayer.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"][data-cidx="${cIdx}"]`);
          const inPort = transformLayer.querySelector(`.node-port-in[data-nodeid="${c.nextNodeId}"]`);

          if (outPort && inPort) {
            const rOut = outPort.getBoundingClientRect();
            const rIn = inPort.getBoundingClientRect();

            const x1 = (rOut.left + rOut.width / 2 - layerRect.left) / this.zoomLevel;
            const y1 = (rOut.top + rOut.height / 2 - layerRect.top) / this.zoomLevel;
            const x2 = (rIn.left + rIn.width / 2 - layerRect.left) / this.zoomLevel;
            const y2 = (rIn.top + rIn.height / 2 - layerRect.top) / this.zoomLevel;

            const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            const strokeColor = isRouter ? '#c084fc' : '#fbbf24';
            const markerId = isRouter ? 'arrow-purple' : 'arrow';

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            pathsHTML += `
              <g class="wire-group">
                <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-dasharray="${sourceNode.isChoiceInteractive === false ? '4,4' : 'none'}" marker-end="url(#${markerId})" opacity="0.9" />
                <g class="wire-delete-btn" data-srcnode="${sourceNode.id}" data-cidx="${cIdx}" style="cursor:pointer; pointer-events:all;" transform="translate(${midX}, ${midY})">
                  <title>Click to disconnect wire (from "${sourceNode.id}" to "${c.nextNodeId}")</title>
                  <circle r="10" fill="#0f172a" stroke="#ef4444" stroke-width="2" />
                  <text text-anchor="middle" dy="3.5" font-size="11" fill="#ef4444" font-weight="900">✕</text>
                </g>
              </g>
            `;
          }
        });
      } else if (sourceNode.nextNodeId && nodes[sourceNode.nextNodeId]) {
        const outPort = transformLayer.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"]:not([data-cidx])`);
        const inPort = transformLayer.querySelector(`.node-port-in[data-nodeid="${sourceNode.nextNodeId}"]`);

        if (outPort && inPort) {
          const rOut = outPort.getBoundingClientRect();
          const rIn = inPort.getBoundingClientRect();

          const x1 = (rOut.left + rOut.width / 2 - layerRect.left) / this.zoomLevel;
          const y1 = (rOut.top + rOut.height / 2 - layerRect.top) / this.zoomLevel;
          const x2 = (rIn.left + rIn.width / 2 - layerRect.left) / this.zoomLevel;
          const y2 = (rIn.top + rIn.height / 2 - layerRect.top) / this.zoomLevel;

          const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
          const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          pathsHTML += `
            <g class="wire-group">
              <path d="${pathData}" fill="none" stroke="#38bdf8" stroke-width="2.5" marker-end="url(#arrow-blue)" opacity="0.9" />
              <g class="wire-delete-btn" data-srcnode="${sourceNode.id}" style="cursor:pointer; pointer-events:all;" transform="translate(${midX}, ${midY})">
                <title>Click to disconnect wire (from "${sourceNode.id}" to "${sourceNode.nextNodeId}")</title>
                <circle r="10" fill="#0f172a" stroke="#ef4444" stroke-width="2" />
                <text text-anchor="middle" dy="3.5" font-size="11" fill="#ef4444" font-weight="900">✕</text>
              </g>
            </g>
          `;
        }
      }
    }

    if (this.isWiring && this.tempWirePath) {
      pathsHTML += `<path d="${this.tempWirePath}" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="5,5" marker-end="url(#arrow-red)" />`;
    }

    svgEl.innerHTML = pathsHTML;

    // Attach click listeners on wire delete buttons directly in SVG
    svgEl.querySelectorAll('.wire-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const srcNodeId = target.dataset.srcnode;
        const cIdxStr = target.dataset.cidx;

        if (srcNodeId && tree.nodes[srcNodeId]) {
          if (cIdxStr !== undefined && cIdxStr !== '') {
            const cIdx = parseInt(cIdxStr);
            if (tree.nodes[srcNodeId].choices && tree.nodes[srcNodeId].choices![cIdx]) {
              tree.nodes[srcNodeId].choices![cIdx].nextNodeId = '';
            }
          } else {
            tree.nodes[srcNodeId].nextNodeId = undefined;
          }
          this.renderTree();
          EventBus.getInstance().emit('editor:project_updated');
        }
      });
    });
  }

  private attachEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    const viewport = this.element.querySelector('#dialog-nodes-viewport') as HTMLElement;
    const transformLayer = this.element.querySelector('#dialog-graph-transform-layer') as HTMLElement;
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;

    // --- Pan & Zoom Events ---
    if (viewport) {
      viewport.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.12 : 0.88;
        const newZoom = Math.max(0.2, Math.min(2.5, this.zoomLevel * delta));

        const vRect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - vRect.left;
        const mouseY = e.clientY - vRect.top;

        this.panOffset.x = mouseX - (mouseX - this.panOffset.x) * (newZoom / this.zoomLevel);
        this.panOffset.y = mouseY - (mouseY - this.panOffset.y) * (newZoom / this.zoomLevel);
        this.zoomLevel = newZoom;

        this.updateTransform();
        if (svgEl) this.renderConnectionLines(tree, svgEl);
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

    // --- Interactive Drag-to-Connect Wiring ---
    this.element.querySelectorAll('.node-port-out').forEach(port => {
      port.addEventListener('mousedown', (e: Event) => {
        e.stopPropagation();
        const mouseEv = e as MouseEvent;
        this.isWiring = true;
        this.wireSourceNodeId = (port as HTMLElement).dataset.nodeid!;
        const cIdxStr = (port as HTMLElement).dataset.cidx;
        this.wireSourceCIdx = cIdxStr !== undefined ? parseInt(cIdxStr) : null;
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

    // --- Node Drag & Drop ---
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

    if (viewport && transformLayer) {
      viewport.addEventListener('mousemove', (e: MouseEvent) => {
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;

        if (this.isPanning) {
          this.panOffset.x = e.clientX - this.panStart.x;
          this.panOffset.y = e.clientY - this.panStart.y;
          this.updateTransform();
          return;
        }

        if (this.isWiring || this.isDraggingNode) {
          this.updateEdgePanVelocity(e, viewport);
        }

        const lRect = transformLayer.getBoundingClientRect();

        if (this.isWiring) {
          const currentX = (e.clientX - lRect.left) / this.zoomLevel;
          const currentY = (e.clientY - lRect.top) / this.zoomLevel;

          const dx = Math.max(30, Math.abs(currentX - this.wireStartPt.x) * 0.5);
          this.tempWirePath = `M ${this.wireStartPt.x} ${this.wireStartPt.y} C ${this.wireStartPt.x + dx} ${this.wireStartPt.y}, ${currentX - dx} ${currentY}, ${currentX} ${currentY}`;
          if (svgEl) this.renderConnectionLines(tree, svgEl);
          return;
        }

        if (this.isDraggingNode && this.draggedNodeId && tree.nodes[this.draggedNodeId]) {
          const node = tree.nodes[this.draggedNodeId];
          node.position = {
            x: Math.max(10, (e.clientX - lRect.left) / this.zoomLevel - this.dragOffset.x),
            y: Math.max(10, (e.clientY - lRect.top) / this.zoomLevel - this.dragOffset.y)
          };

          // Fast 60 FPS direct DOM style update
          const card = transformLayer.querySelector(`.dialog-graph-card[data-nodeid="${this.draggedNodeId}"]`) as HTMLElement;
          if (card) {
            card.style.left = `${node.position.x}px`;
            card.style.top = `${node.position.y}px`;
          }

          if (svgEl) this.renderConnectionLines(tree, svgEl);
        }
      });

      viewport.addEventListener('mouseup', (e: MouseEvent) => {
        this.stopAutoPan();

        if (this.isPanning) {
          this.isPanning = false;
          viewport.style.cursor = 'grab';
          return;
        }

        if (this.isWiring) {
          this.isWiring = false;
          this.tempWirePath = null;

          const dropTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
          const inPort = dropTarget?.closest('.node-port-in') as HTMLElement;

          if (inPort && this.wireSourceNodeId) {
            const targetNodeId = inPort.dataset.nodeid!;
            if (targetNodeId !== this.wireSourceNodeId) {
              const srcNode = tree.nodes[this.wireSourceNodeId];
              if (srcNode) {
                if (this.wireSourceCIdx !== null && srcNode.choices && srcNode.choices[this.wireSourceCIdx]) {
                  srcNode.choices[this.wireSourceCIdx].nextNodeId = targetNodeId;
                } else {
                  srcNode.nextNodeId = targetNodeId;
                }
                this.renderTree();
                emitUpdate();
              }
            }
          }

          this.wireSourceNodeId = null;
          this.wireSourceCIdx = null;
          if (svgEl) this.renderConnectionLines(tree, svgEl);
          return;
        }

        if (this.isDraggingNode) {
          this.isDraggingNode = false;
          this.draggedNodeId = null;
          emitUpdate();
        }
      });
    }

    // Toggle Router Node
    this.element.querySelectorAll('.btn-toggle-router').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].isRouterNode = !tree.nodes[nid].isRouterNode;
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Title & Start Node edit
    this.element.querySelector('#tree-title-input')?.addEventListener('input', (e) => {
      tree.title = (e.target as HTMLInputElement).value;
      emitUpdate();
    });

    this.element.querySelector('#tree-start-node-input')?.addEventListener('input', (e) => {
      tree.startNodeId = (e.target as HTMLInputElement).value.trim();
      emitUpdate();
    });

    // Make Start Node
    this.element.querySelectorAll('.btn-make-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        tree.startNodeId = nid;
        this.renderTree();
        emitUpdate();
      });
    });

    // Delete Node
    this.element.querySelectorAll('.btn-del-node').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        delete tree.nodes[nid];
        if (tree.startNodeId === nid) {
          tree.startNodeId = Object.keys(tree.nodes)[0] || '';
        }
        this.renderTree();
        emitUpdate();
      });
    });

    // Speaker Edit
    this.element.querySelectorAll('.node-speaker').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].speaker = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    // Text Edit
    this.element.querySelectorAll('.node-text').forEach(txt => {
      txt.addEventListener('input', (e) => {
        const nid = (txt as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].text = (txt as HTMLTextAreaElement).value;
          emitUpdate();
        }
      });
    });

    // Node Req / NOT / Set Flag
    this.element.querySelectorAll('.node-req-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].requiredFlag = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.node-not-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].notFlag = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.node-set-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].setFlag = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Node Give Item Select
    this.element.querySelectorAll('.node-give-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].giveItem = (e.target as HTMLSelectElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Voiceover Audio URL Edit
    this.element.querySelectorAll('.node-voice-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].voiceAudioUrl = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Interactive Checkbox Toggle
    this.element.querySelectorAll('.node-interactive-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].isChoiceInteractive = (chk as HTMLInputElement).checked;
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Next Node Select Dropdown (Reconnect)
    this.element.querySelectorAll('.node-next-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].nextNodeId = (e.target as HTMLSelectElement).value.trim() || undefined;
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Next Node Disconnect Button
    this.element.querySelectorAll('.btn-disconnect-node-next').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].nextNodeId = undefined;
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice Add
    this.element.querySelectorAll('.btn-add-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].choices) tree.nodes[nid].choices = [];
          const cIdx = tree.nodes[nid].choices!.length + 1;
          tree.nodes[nid].choices!.push({
            id: `branch_${cIdx}`,
            text: tree.nodes[nid].isRouterNode ? 'Branch Condition Description' : 'Response option...',
            nextNodeId: ''
          });
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice Delete
    this.element.querySelectorAll('.btn-del-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices) {
          tree.nodes[nid].choices!.splice(cIdx, 1);
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice Text Edit
    this.element.querySelectorAll('.choice-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].text = target.value;
          emitUpdate();
        }
      });
    });

    // Choice Next Node Select Dropdown (Reconnect)
    this.element.querySelectorAll('.choice-next-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((sel as HTMLElement).dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].nextNodeId = target.value.trim();
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice Disconnect Button
    this.element.querySelectorAll('.btn-disconnect-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].nextNodeId = '';
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice Req & NOT Flags
    this.element.querySelectorAll('.choice-req-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].requiredFlag = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.choice-not-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].notFlag = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Choice Set Flag Edit
    this.element.querySelectorAll('.choice-set-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].setFlag = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Choice Give Item Select
    this.element.querySelectorAll('.choice-give-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((sel as HTMLElement).dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].giveItem = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Choice Voiceover URL Edit
    this.element.querySelectorAll('.choice-voice-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    // Node Voiceover Audio File Picker
    this.element.querySelectorAll('.node-voice-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;

        if (file && tree.nodes[nid]) {
          let relPath = file.name;
          if ((file as any).path) {
            relPath = (file as any).path.replace(/\\/g, '/');
          } else {
            relPath = `assets/audio/${file.name}`;
          }
          tree.nodes[nid].voiceAudioUrl = relPath;
          const urlInput = this.element.querySelector(`.node-voice-url[data-nodeid="${nid}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          emitUpdate();
        }
      });
    });

    // Choice Voiceover Audio File Picker
    this.element.querySelectorAll('.choice-voice-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);

        if (file && tree.nodes[nid]?.choices?.[cIdx]) {
          let relPath = file.name;
          if ((file as any).path) {
            relPath = (file as any).path.replace(/\\/g, '/');
          } else {
            relPath = `assets/audio/${file.name}`;
          }
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = relPath;
          const urlInput = this.element.querySelector(`.choice-voice-url[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          emitUpdate();
        }
      });
    });
  }
}
