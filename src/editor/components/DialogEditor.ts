import { ProjectData, DialogTree, DialogNode, DialogChoice, Vector2D, SceneData, StageDirective, DirectiveActionType } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { resolvePickedAssetPath } from './Inspector';

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

  private getAllProjectActors(): { id: string; name: string; animations: string[] }[] {
    const actors: { id: string; name: string; animations: string[] }[] = [
      { id: 'player', name: '👤 Sir Ronald (Player)', animations: ['idle', 'walk', 'talk', 'pick_up', 'listen', 'gesture', 'bow', 'cower'] }
    ];
    if (this.project?.scenes) {
      for (const sc of this.project.scenes) {
        for (const c of sc.characters) {
          const anims = c.animations ? Object.keys(c.animations) : ['idle', 'talk', 'walk', 'gesture', 'look_around'];
          if (!actors.some(a => a.id === c.id)) {
            actors.push({ id: c.id, name: `🎭 ${c.name} (${c.id})`, animations: anims });
          }
        }
        for (const hs of sc.hotspots) {
          if (!actors.some(a => a.id === hs.id)) {
            actors.push({ id: hs.id, name: `📦 ${hs.name} (${hs.id})`, animations: ['idle', 'active', 'open', 'close'] });
          }
        }
      }
    }
    return actors;
  }

  private getActorAnimations(actorId: string): string[] {
    const actors = this.getAllProjectActors();
    const found = actors.find(a => a.id === actorId);
    if (found && found.animations && found.animations.length > 0) return found.animations;
    return ['idle', 'talk', 'walk', 'gesture', 'stir_cauldron', 'look_around', 'cower', 'celebrate'];
  }

  private updateEdgePanVelocity(e: MouseEvent, viewport: HTMLElement): void {
    const vRect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - vRect.left;
    const mouseY = e.clientY - vRect.top;
    const edgeMargin = 85;
    const maxSpeed = 16;

    let vx = 0;
    let vy = 0;

    if (mouseX < edgeMargin) {
      const ratio = Math.min(1.8, (edgeMargin - mouseX) / edgeMargin);
      vx = ratio * maxSpeed;
    } else if (mouseX > vRect.width - edgeMargin) {
      const ratio = Math.min(1.8, (mouseX - (vRect.width - edgeMargin)) / edgeMargin);
      vx = -ratio * maxSpeed;
    }

    if (mouseY < edgeMargin) {
      const ratio = Math.min(1.8, (edgeMargin - mouseY) / edgeMargin);
      vy = ratio * maxSpeed;
    } else if (mouseY > vRect.height - edgeMargin) {
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
            x: (this.lastClientX - lRect.left) / this.zoomLevel - this.dragOffset.x,
            y: (this.lastClientY - lRect.top) / this.zoomLevel - this.dragOffset.y
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
      this.autoPanVx = 0;
      this.autoPanVy = 0;
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="view-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:12px; align-items:center;">
          <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">🎬 Cinematic Sequences & Beat Studio</h2>
          <button class="btn btn-primary" id="btn-add-dialog-node" style="font-size:0.8rem;">+ Add Beat Node</button>
          <button class="btn btn-primary" id="btn-add-router-node" style="font-size:0.8rem; background:linear-gradient(135deg, #7e22ce, #a855f7); border-color:#c084fc;">🔀 + Add Logic Router</button>
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
          
          <!-- Fixed Top Toolbar Overlay for Dialogue Title & Start Node -->
          <div id="dialog-tree-header-bar" style="position:absolute; top:16px; left:16px; display:flex; gap:12px; align-items:center; z-index:100; background:rgba(15,23,42,0.92); padding:8px 14px; border-radius:8px; border:1px solid var(--panel-border); box-shadow:0 4px 16px rgba(0,0,0,0.6);">
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Sequence Title:</label>
            <input type="text" id="tree-title-input" class="form-input" value="" style="width:240px;" />
            <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Start Beat ID:</label>
            <input type="text" id="tree-start-node-input" class="form-input" value="" style="width:120px;" />
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

    this.element.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      if (!this.project) return;
      const newTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Cinematic Sequence',
        startNodeId: 'beat_1',
        nodes: {
          beat_1: {
            id: 'beat_1',
            speaker: 'NPC',
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

    this.element.querySelector('#btn-add-dialog-node')?.addEventListener('click', () => {
      if (!this.project || !this.selectedTreeId) return;
      const tree = this.project.dialogs.find(d => d.id === this.selectedTreeId);
      if (!tree) return;

      const nodeCount = Object.keys(tree.nodes).length + 1;
      const newNodeId = `beat_${nodeCount}`;

      tree.nodes[newNodeId] = {
        id: newNodeId,
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

  private renderConditionPicker(opts: {
    nodeId: string;
    choiceIdx?: number;
    requiredFlag?: string;
    notFlag?: string;
    allowFallback?: boolean;
  }): string {
    const { nodeId, choiceIdx, requiredFlag, notFlag, allowFallback } = opts;
    const isChoice = choiceIdx !== undefined && choiceIdx >= 0;

    let currentFlag = '';
    let currentOp: 'always' | 'true' | 'false' | 'fallback' = allowFallback ? 'fallback' : 'always';

    if (notFlag !== undefined) {
      currentFlag = notFlag;
      currentOp = 'false';
    } else if (requiredFlag !== undefined) {
      currentFlag = requiredFlag;
      currentOp = 'true';
    }

    const isAlwaysOrFallback = currentOp === 'always' || currentOp === 'fallback';
    const cidxAttr = isChoice ? `data-cidx="${choiceIdx}"` : '';
    const opClass = isChoice ? 'cond-choice-op' : 'cond-node-op';
    const nameClass = isChoice ? 'cond-choice-name' : 'cond-node-name';

    return `
      <div class="unified-condition-box" style="display:flex; gap:5px; align-items:center; background:rgba(0,0,0,0.25); padding:3px 6px; border-radius:5px; border:1px solid rgba(255,255,255,0.06); margin-bottom:4px;">
        <span style="font-size:0.65rem; color:var(--accent-gold); font-weight:700;">Condition:</span>
        <span style="font-size:0.65rem; color:var(--text-muted);">If</span>
        <input type="text" 
               class="form-input ${nameClass}" 
               data-nodeid="${nodeId}" 
               ${cidxAttr} 
               value="${currentFlag}" 
               placeholder="flagName" 
               style="flex:1; font-size:0.7rem; font-weight:600; color:#38bdf8; ${isAlwaysOrFallback ? 'opacity:0.35;' : ''}" 
               ${isAlwaysOrFallback ? 'disabled' : ''} />
        <span style="font-size:0.65rem; color:var(--text-muted);">is</span>
        <select class="form-input ${opClass}" 
                data-nodeid="${nodeId}" 
                ${cidxAttr} 
                style="width:115px; font-size:0.65rem; font-weight:700; color:${currentOp === 'false' ? '#ef4444' : (currentOp === 'true' ? '#22c55e' : (currentOp === 'fallback' ? '#f59e0b' : '#94a3b8'))};">
          ${allowFallback ? `
            <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
            <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
            <option value="fallback" ${currentOp === 'fallback' ? 'selected' : ''}>⚡ Else (Fallback)</option>
          ` : `
            <option value="always" ${currentOp === 'always' ? 'selected' : ''}>⚡ Always</option>
            <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
            <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
          `}
        </select>
      </div>
    `;
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
        btn.innerHTML = `🎬 <b>${dlg.title}</b><br/><span style="font-size:0.65rem; color:var(--text-muted);">ID: ${dlg.id} (${Object.keys(dlg.nodes).length} beats)</span>`;
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
        nodesContainer.innerHTML = '<div style="padding:20px; color:var(--text-muted); pointer-events:auto;">Select a cinematic sequence to edit.</div>';
        if (svgEl) svgEl.innerHTML = '';
        return;
      }

      const actorsList = this.getAllProjectActors();
      const allChoreoGroups = [
        ...(this.project.choreographyGroups || [])
      ];

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

      nodesContainer.innerHTML = `
        ${Object.values(tree.nodes).map(node => {
          const isStartNode = node.id === tree.startNodeId;
          const isRouter = Boolean(node.isRouterNode);
          const choiceCount = node.choices?.length || 0;
          const hasMultipleOutgoing = choiceCount > 1;
          const isInteractive = node.isChoiceInteractive !== false;
          const directives = node.directives || [];

          const cardBg = isRouter
            ? 'linear-gradient(135deg, rgba(76,29,149,0.95), rgba(30,41,59,0.96))'
            : 'rgba(30,41,59,0.96)';

          const cardBorder = isRouter
            ? '#c084fc'
            : (isStartNode ? 'var(--accent-gold)' : 'var(--panel-border)');

          return `
            <div class="dialog-graph-card" data-nodeid="${node.id}" style="position:absolute; left:${node.position?.x ?? 50}px; top:${node.position?.y ?? 50}px; width:380px; background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:0.8rem; pointer-events:auto;">
              
              <!-- Left Input Port -->
              <div class="node-port node-port-in" data-nodeid="${node.id}" style="position:absolute; left:-9px; top:18px; width:18px; height:18px; border-radius:50%; background:${isRouter ? '#c084fc' : '#38bdf8'}; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px ${isRouter ? 'rgba(192,132,252,0.9)' : 'rgba(56,189,248,0.9)'}; z-index:10;" title="Input Port: Drag an arrow from another node's output port to connect here"></div>

              <!-- Header -->
              <div class="node-drag-handle" data-nodeid="${node.id}" style="display:flex; justify-content:space-between; align-items:center; cursor:move; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:6px; align-items:center;">
                  <span style="font-weight:700; color:${isRouter ? '#c084fc' : (isStartNode ? 'var(--accent-gold)' : '#38bdf8')};">${isRouter ? '🔀 ROUTER:' : '🎬 BEAT:'} ${node.id}</span>
                  ${isStartNode ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>' : ''}
                </div>
                <div style="display:flex; gap:4px;">
                  <button class="btn btn-toggle-router" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 5px;" title="Toggle Logic Router Node">${isRouter ? '🎬 Beat' : '🔀 Router'}</button>
                  ${!isStartNode ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Beat">🚩 Start</button>` : ''}
                  <button class="btn btn-del-node" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px; color:#ef4444;" title="Delete Beat">✕</button>
                </div>
              </div>

              ${!isRouter ? `
                <!-- Primary Driver: Speaker & Speech -->
                <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px; position:relative;">
                    <div>
                      <label style="font-size:0.65rem; color:var(--text-muted);">🗣️ Speaker Name</label>
                      <input type="text" class="form-input node-speaker" data-nodeid="${node.id}" value="${node.speaker}" placeholder="e.g. Master Eldrin" style="width:100%; font-weight:600; font-size:0.75rem;" />
                    </div>
                    <div>
                      <label style="font-size:0.65rem; color:#f59e0b;">🎭 Speaker Talk Anim</label>
                      <input type="text" class="form-input node-speaker-anim" data-nodeid="${node.id}" value="${node.speakerAnimation || ''}" placeholder="e.g. talk, gesture" style="width:100%; font-size:0.75rem;" />
                    </div>
                    
                    <!-- Main Node Output Port (if NO response choices exist) -->
                    ${choiceCount === 0 ? `
                      <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-27px; top:18px; width:18px; height:18px; border-radius:50%; background:#fbbf24; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(251,191,36,0.9); z-index:10;" title="Click & Drag arrow to connect to target node Input Port"></div>
                    ` : ''}
                  </div>

                  <div style="margin-bottom:6px;">
                    <label style="font-size:0.65rem; color:var(--text-muted);">💬 Spoken Dialogue Text</label>
                    <textarea class="form-input node-text" data-nodeid="${node.id}" style="width:100%; height:44px; font-size:0.8rem;">${node.text}</textarea>
                  </div>

                  <!-- Voiceover Audio URL -->
                  <div>
                    <label style="font-size:0.65rem; color:var(--text-muted);">🎙️ Voiceover Audio File (URL)</label>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <input type="text" class="form-input node-voice-url" data-nodeid="${node.id}" value="${node.voiceAudioUrl || ''}" placeholder="e.g. assets/c1s1/audio/eldrin_runes.mp3" style="flex:1; font-size:0.75rem;" />
                      <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose Audio File">
                        📁
                        <input type="file" class="node-voice-file" data-nodeid="${node.id}" accept="audio/*" style="display:none;" />
                      </label>
                    </div>
                  </div>
                </div>

                <!-- 🎭 STAGE DIRECTIVES (Multi-Actor Choreography) -->
                <div style="background:rgba(245, 158, 11, 0.05); border:1px solid rgba(245, 158, 11, 0.2); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.7rem; font-weight:700; color:#f59e0b;">🎭 STAGE DIRECTIVES (${directives.length})</span>
                    <button class="btn btn-primary btn-add-directive" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ Add Directive</button>
                  </div>

                  ${directives.length === 0 ? `
                    <div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No background character or camera choreography. Click "+ Add Directive".</div>
                  ` : `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                      ${directives.map((dir, dIdx) => {
                        const actorAnims = this.getActorAnimations(dir.actorId || 'player');
                        return `
                          <div class="stage-directive-card" data-nodeid="${node.id}" data-didx="${dIdx}" draggable="true" style="position:relative; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); padding:6px; border-radius:6px; cursor:grab;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                              <div style="display:flex; gap:4px; align-items:center;">
                                <span class="choice-drag-handle" style="cursor:grab; color:var(--text-muted); font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="Drag & drop to re-order directive">⠿</span>
                                <select class="form-input dir-type-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem; font-weight:700; color:#38bdf8; padding:2px 4px;">
                                  <option value="animation" ${dir.type === 'animation' ? 'selected' : ''}>🎬 Actor Animation</option>
                                  <option value="choreography_group" ${dir.type === 'choreography_group' ? 'selected' : ''}>👥 Choreography Group</option>
                                  <option value="give_item" ${dir.type === 'give_item' ? 'selected' : ''}>🎁 Give Item</option>
                                  <option value="take_item" ${dir.type === 'take_item' ? 'selected' : ''}>🎒 Take Item</option>
                                  <option value="emote" ${dir.type === 'emote' ? 'selected' : ''}>💬 Emote Bubble</option>
                                  <option value="look_at" ${dir.type === 'look_at' ? 'selected' : ''}>👀 Face / Turn To</option>
                                  <option value="walk_to" ${dir.type === 'walk_to' ? 'selected' : ''}>🚶 Walk To</option>
                                  <option value="sfx" ${dir.type === 'sfx' ? 'selected' : ''}>🔊 Audio SFX</option>
                                  <option value="camera" ${dir.type === 'camera' ? 'selected' : ''}>🎥 Camera Action</option>
                                  <option value="custom_event" ${dir.type === 'custom_event' ? 'selected' : ''}>⚡ Custom Event</option>
                                </select>
                              </div>
                              <div style="display:flex; align-items:center; gap:4px;">
                                <span style="font-size:0.6rem; color:var(--text-muted);">⏱️ Delay:</span>
                                <input type="number" step="0.1" class="form-input dir-delay-input" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.delaySeconds ?? 0}" style="width:44px; font-size:0.65rem; padding:1px 3px;" title="Delay offset in seconds" />
                                <button class="btn btn-del-directive" data-nodeid="${node.id}" data-didx="${dIdx}" style="padding:1px 4px; font-size:0.6rem; color:#ef4444;" title="Delete Directive">✕</button>
                              </div>
                            </div>

                            <!-- Dynamic fields based on directive type -->
                            ${dir.type === 'animation' ? `
                              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
                                <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                                <select class="form-input dir-anim-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem; color:#f59e0b; font-weight:600;">
                                  ${actorAnims.map(an => `<option value="${an}" ${dir.animationName === an ? 'selected' : ''}>${an}</option>`).join('')}
                                </select>
                              </div>
                              <div style="margin-top:3px; display:flex; align-items:center; gap:4px;">
                                <input type="checkbox" class="dir-loop-chk" data-nodeid="${node.id}" data-didx="${dIdx}" ${dir.loopAnimation ? 'checked' : ''} id="loop_${node.id}_${dIdx}" />
                                <label for="loop_${node.id}_${dIdx}" style="font-size:0.65rem; color:var(--text-muted); cursor:pointer;">Loop Animation</label>
                              </div>
                            ` : ''}

                            ${dir.type === 'choreography_group' ? `
                              <select class="form-input dir-choreo-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
                                <option value="">-- Select Choreography Group --</option>
                                ${allChoreoGroups.map(cg => `<option value="${cg.id}" ${dir.choreographyGroupId === cg.id ? 'selected' : ''}>👥 ${cg.name}</option>`).join('')}
                              </select>
                            ` : ''}

                            ${(dir.type === 'give_item' || dir.type === 'take_item') ? `
                              <select class="form-input dir-item-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
                                <option value="">-- Select Item --</option>
                                ${(this.project?.items || []).map(it => `<option value="${it.id}" ${dir.itemId === it.id ? 'selected' : ''}>🎁 ${it.name} (${it.id})</option>`).join('')}
                              </select>
                            ` : ''}

                            ${dir.type === 'emote' ? `
                              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
                                <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                                <input type="text" class="form-input dir-emote-text" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.emoteText || ''}" placeholder="e.g. ❗ 'Look!'" style="font-size:0.7rem;" />
                              </div>
                            ` : ''}

                            ${dir.type === 'look_at' ? `
                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                                <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                                <select class="form-input dir-target-actor" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  <option value="">-- Face Target --</option>
                                  ${actorsList.map(a => `<option value="${a.id}" ${dir.targetActorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                              </div>
                            ` : ''}

                            ${dir.type === 'walk_to' ? `
                              <div style="display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:4px;">
                                <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                                <input type="number" class="form-input dir-walk-x" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.x ?? 500}" placeholder="X" style="font-size:0.7rem;" />
                                <input type="number" class="form-input dir-walk-y" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.y ?? 700}" placeholder="Y" style="font-size:0.7rem;" />
                              </div>
                            ` : ''}

                            ${dir.type === 'sfx' ? `
                              <div style="display:flex; gap:4px; align-items:center;">
                                <input type="text" class="form-input dir-sfx-url" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.sfxUrl || ''}" placeholder="e.g. assets/audio/magic_cast.mp3" style="flex:1; font-size:0.7rem;" />
                                <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose SFX File">
                                  📁
                                  <input type="file" class="dir-sfx-file" data-nodeid="${node.id}" data-didx="${dIdx}" accept="audio/*" style="display:none;" />
                                </label>
                              </div>
                            ` : ''}

                            ${dir.type === 'camera' ? `
                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                                <select class="form-input dir-camera-action" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                                  <option value="zoom" ${dir.cameraAction === 'zoom' ? 'selected' : ''}>Zoom In</option>
                                  <option value="shake" ${dir.cameraAction === 'shake' ? 'selected' : ''}>Shake Screen</option>
                                  <option value="reset" ${dir.cameraAction === 'reset' ? 'selected' : ''}>Reset Zoom (1.0)</option>
                                </select>
                                <input type="number" step="0.1" class="form-input dir-camera-zoom" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.cameraZoom ?? 1.3}" placeholder="Zoom Scale" style="font-size:0.7rem;" />
                              </div>
                            ` : ''}

                            ${dir.type === 'custom_event' ? `
                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                                <input type="text" class="form-input dir-event-name" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.eventName || ''}" placeholder="Event Name" style="font-size:0.7rem;" />
                                <input type="text" class="form-input dir-event-payload" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.eventPayload || ''}" placeholder="Payload" style="font-size:0.7rem;" />
                              </div>
                            ` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>
              ` : `
                <div style="background:rgba(192, 132, 252, 0.15); border:1px dashed #c084fc; border-radius:6px; padding:6px; margin-bottom:8px; font-size:0.7rem; color:#e9d5ff;">
                  ⚡ <b>Invisible Logic Router Node</b>: Evaluates outgoing conditions in order. The first matching branch is automatically selected!
                </div>
              `}

              ${!isRouter ? `
                <!-- Condition Section (Beats Only) -->
                ${this.renderConditionPicker({ nodeId: node.id, requiredFlag: node.requiredFlag, notFlag: node.notFlag })}

                <!-- Interactivity Checkbox -->
                ${hasMultipleOutgoing ? `
                  <div style="background:rgba(251, 191, 36, 0.1); border:1px solid rgba(251, 191, 36, 0.3); border-radius:6px; padding:6px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="node-interactive-chk" data-nodeid="${node.id}" ${isInteractive ? 'checked' : ''} id="chk_inter_${node.id}" />
                    <label for="chk_inter_${node.id}" style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; cursor:pointer;">
                      ☑️ Interactive Player Selection Box
                    </label>
                  </div>
                ` : ''}
              ` : ''}

              <!-- Outgoing Choices / Router Branches -->
              <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:0.7rem; font-weight:700; color:${isRouter ? '#c084fc' : 'var(--accent-gold)'};">${isRouter ? 'Branch Rules' : 'Outgoing Responses'} (${choiceCount}):</span>
                  <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ ${isRouter ? 'Rule' : 'Response'}</button>
                </div>

                ${node.choices && node.choices.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${node.choices.map((c, cIdx) => {
                      if (isRouter) {
                        const isFallback = c.requiredFlag === undefined && c.notFlag === undefined;
                        const isDraggable = !isFallback;

                        return `
                          <div class="router-branch-card" data-nodeid="${node.id}" data-cidx="${cIdx}" draggable="${isDraggable}" style="position:relative; background:rgba(0,0,0,0.35); border:1px solid rgba(192, 132, 252, 0.3); padding:6px 8px; border-radius:6px; cursor:${isDraggable ? 'grab' : 'default'};">
                            <div style="display:flex; gap:5px; align-items:center;">
                              <!-- Native Drag Handle -->
                              <span class="choice-drag-handle" style="cursor:${isDraggable ? 'grab' : 'not-allowed'}; color:${isDraggable ? '#c084fc' : '#64748b'}; font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="${isDraggable ? 'Drag & drop to re-order rule' : 'Fallback rule is pinned at the bottom'}">⠿</span>

                              <div style="flex:1;">
                                ${this.renderConditionPicker({ nodeId: node.id, choiceIdx: cIdx, requiredFlag: c.requiredFlag, notFlag: c.notFlag, allowFallback: true })}
                              </div>

                              <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;" title="Delete Rule">✕</button>
                            </div>

                            <!-- Router Choice Output Port -->
                            <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#c084fc; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(192,132,252,0.9); z-index:10;" title="Click & Drag arrow to connect to target Beat or Router node"></div>
                          </div>
                        `;
                      }

                      return `
                        <div class="choice-card" data-nodeid="${node.id}" data-cidx="${cIdx}" draggable="true" style="position:relative; background:rgba(0,0,0,0.35); border:1px solid var(--panel-border); padding:6px; border-radius:6px; cursor:grab;">
                          <!-- Row 1: Drag handle + Choice text + Delete -->
                          <div style="display:flex; gap:5px; align-items:center; margin-bottom:4px;">
                            <span class="choice-drag-handle" style="cursor:grab; color:var(--text-muted); font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="Drag & drop to re-order response">⠿</span>
                            <input type="text" class="form-input choice-text" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.text}" placeholder="Response Text..." style="flex:1; font-size:0.75rem; font-weight:600;" />
                            <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;" title="Delete Response">✕</button>
                          </div>
                          
                          <!-- Row 2: Unified Reusable Condition Component -->
                          ${this.renderConditionPicker({ nodeId: node.id, choiceIdx: cIdx, requiredFlag: c.requiredFlag, notFlag: c.notFlag, allowFallback: false })}

                          <!-- Row 3: Voiceover audio -->
                          <div style="display:flex; gap:6px; align-items:center;">
                            <input type="text" class="form-input choice-voice-url" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.voiceAudioUrl || ''}" placeholder="🎙️ Response Voiceover URL..." style="flex:1; font-size:0.68rem;" />
                            <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
                              📁
                              <input type="file" class="choice-voice-file" data-nodeid="${node.id}" data-cidx="${cIdx}" accept="audio/*" style="display:none;" />
                            </label>
                          </div>
                          
                          <!-- Response Choice Output Port -->
                          <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#fbbf24; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(251,191,36,0.9); z-index:10;" title="Click & Drag arrow to connect or reconnect to any target node Input Port"></div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="display:flex; gap:6px; align-items:center; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:5px;">
                    <span style="font-size:0.68rem; color:var(--text-muted); white-space:nowrap;">Default Next Beat:</span>
                    <span style="font-size:0.72rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:700;">
                      ${node.nextNodeId ? `➔ ${node.nextNodeId}` : '(End Sequence)'}
                    </span>
                    <span style="font-size:0.65rem; color:var(--text-muted); margin-left:auto;">(Drag top-right port to connect)</span>
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

            // Position disconnect button at 15% along the Bezier curve
            const t = 0.15;
            const t1 = 1 - t;
            const btnX = (t1 * t1 * t1 * x1) + (3 * t1 * t1 * t * (x1 + dx)) + (3 * t1 * t * t * (x2 - dx)) + (t * t * t * x2);
            const btnY = (t1 * t1 * t1 * y1) + (3 * t1 * t1 * t * y1) + (3 * t1 * t * t * y2) + (t * t * t * y2);

            pathsHTML += `
              <g class="wire-group" data-srcnode="${sourceNode.id}" data-cidx="${cIdx}" data-targetnode="${c.nextNodeId}">
                <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" marker-end="url(#${markerId})" style="filter: drop-shadow(0 0 4px ${strokeColor}88);" />
                <circle cx="${btnX}" cy="${btnY}" r="9" fill="#0f172a" stroke="#ef4444" stroke-width="1.5" style="cursor:pointer; pointer-events:auto;" class="wire-delete-btn" data-srcnode="${sourceNode.id}" data-cidx="${cIdx}" />
                <text x="${btnX}" y="${btnY + 3}" fill="#ef4444" font-size="10" font-weight="900" text-anchor="middle" style="pointer-events:none; user-select:none;">✕</text>
              </g>
            `;
          }
        });
      } else if (sourceNode.nextNodeId && nodes[sourceNode.nextNodeId]) {
        const outPort = transformLayer.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"]`);
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

          // Position disconnect button at 15% along the Bezier curve
          const t = 0.15;
          const t1 = 1 - t;
          const btnX = (t1 * t1 * t1 * x1) + (3 * t1 * t1 * t * (x1 + dx)) + (3 * t1 * t * t * (x2 - dx)) + (t * t * t * x2);
          const btnY = (t1 * t1 * t1 * y1) + (3 * t1 * t1 * t * y1) + (3 * t1 * t * t * y2) + (t * t * t * y2);

          pathsHTML += `
            <g class="wire-group" data-srcnode="${sourceNode.id}" data-targetnode="${sourceNode.nextNodeId}">
              <path d="${pathData}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" marker-end="url(#arrow-blue)" style="filter: drop-shadow(0 0 4px #38bdf888);" />
              <circle cx="${btnX}" cy="${btnY}" r="9" fill="#0f172a" stroke="#ef4444" stroke-width="1.5" style="cursor:pointer; pointer-events:auto;" class="wire-delete-btn" data-srcnode="${sourceNode.id}" />
              <text x="${btnX}" y="${btnY + 3}" fill="#ef4444" font-size="10" font-weight="900" text-anchor="middle" style="pointer-events:none; user-select:none;">✕</text>
            </g>
          `;
        }
      }
    }

    if (this.isWiring && this.tempWirePath) {
      pathsHTML += `
        <path d="${this.tempWirePath}" fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="6,4" stroke-linecap="round" marker-end="url(#arrow)" style="filter: drop-shadow(0 0 6px #22c55e);" />
      `;
    }

    svgEl.innerHTML = pathsHTML;

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
            x: (e.clientX - lRect.left) / this.zoomLevel - this.dragOffset.x,
            y: (e.clientY - lRect.top) / this.zoomLevel - this.dragOffset.y
          };

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

    // Speaker Animation Edit
    this.element.querySelectorAll('.node-speaker-anim').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].speakerAnimation = (e.target as HTMLInputElement).value.trim() || undefined;
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

    // --- STAGE DIRECTIVES LISTENERS ---
    this.element.querySelectorAll('.btn-add-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].directives) tree.nodes[nid].directives = [];
          tree.nodes[nid].directives!.push({
            id: `dir_${Date.now()}`,
            type: 'animation',
            actorId: 'player',
            animationName: 'gesture'
          });
          this.renderTree();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);
        if (tree.nodes[nid]?.directives) {
          tree.nodes[nid].directives!.splice(didx, 1);
          this.renderTree();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].type = target.value as DirectiveActionType;
          this.renderTree();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-actor-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].actorId = target.value;
          const anims = this.getActorAnimations(target.value);
          if (anims.length > 0) tree.nodes[nid].directives![didx].animationName = anims[0];
          this.renderTree();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-anim-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].animationName = target.value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-loop-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        const didx = parseInt((chk as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].loopAnimation = (chk as HTMLInputElement).checked;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-delay-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].delaySeconds = parseFloat((input as HTMLInputElement).value) || 0;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-choreo-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].choreographyGroupId = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].itemId = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-emote-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].emoteText = (input as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-target-actor').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].targetActorId = target.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-walk-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.x = parseFloat((input as HTMLInputElement).value) || 0;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-walk-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.y = parseFloat((input as HTMLInputElement).value) || 0;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-sfx-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].sfxUrl = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-camera-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraAction = target.value as any;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-camera-zoom').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraZoom = parseFloat((input as HTMLInputElement).value) || 1.0;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-event-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventName = (input as HTMLInputElement).value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.dir-event-payload').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventPayload = (input as HTMLInputElement).value || undefined;
          emitUpdate();
        }
      });
    });

    // Helper to find associated scene for base asset path resolution
    const findDialogScene = (dTree: DialogTree): SceneData | null => {
      if (this.project?.scenes) {
        for (const sc of this.project.scenes) {
          for (const c of sc.characters) {
            if (c.actions?.some(a => a.dialogId === dTree.id) || (dTree.id && dTree.id.includes(c.id.replace(/^npc_/, '')))) {
              return sc;
            }
          }
          for (const hs of sc.hotspots) {
            if (hs.actions?.some(a => a.dialogId === dTree.id)) {
              return sc;
            }
          }
        }
      }
      return null;
    };

    // Directive SFX File Picker
    this.element.querySelectorAll('.dir-sfx-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);

        if (file && tree.nodes[nid]?.directives?.[didx]) {
          const targetScene = findDialogScene(tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, this.project);
          tree.nodes[nid].directives![didx].sfxUrl = relPath;
          const urlInput = this.element.querySelector(`.dir-sfx-url[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          emitUpdate();
        }
      });
    });

    // Beat Node Condition Flag Name Edit
    this.element.querySelectorAll('.cond-node-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const val = (input as HTMLInputElement).value;
          const opSel = this.element.querySelector(`.cond-node-op[data-nodeid="${nid}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            tree.nodes[nid].notFlag = val;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = val;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          emitUpdate();
        }
      });
    });

    // Beat Node Condition Flag Op Edit (Always / TRUE / FALSE)
    this.element.querySelectorAll('.cond-node-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const nameInput = this.element.querySelector(`.cond-node-name[data-nodeid="${nid}"]`) as HTMLInputElement;
          const flag = nameInput?.value.trim() || '';
          const op = (e.target as HTMLSelectElement).value;
          if (op === 'false') {
            tree.nodes[nid].notFlag = flag;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = flag;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          this.renderTree();
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

    const enforceRouterFallbackLast = (nid: string) => {
      const node = tree.nodes[nid];
      if (!node || !node.isRouterNode || !node.choices) return;
      const fallbackIdx = node.choices.findIndex(c => c.requiredFlag === undefined && c.notFlag === undefined);
      if (fallbackIdx !== -1 && fallbackIdx !== node.choices.length - 1) {
        const [fallback] = node.choices.splice(fallbackIdx, 1);
        node.choices.push(fallback);
      }
    };

    // Choice / Rule Add
    this.element.querySelectorAll('.btn-add-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].choices) tree.nodes[nid].choices = [];
          const isR = Boolean(tree.nodes[nid].isRouterNode);
          const cIdx = tree.nodes[nid].choices!.length + 1;
          const newChoice = {
            id: `branch_${cIdx}`,
            text: isR ? 'Flag is true' : 'Response option...',
            requiredFlag: isR ? '' : undefined,
            nextNodeId: ''
          };

          if (isR && tree.nodes[nid].choices!.length > 0) {
            const lastChoice = tree.nodes[nid].choices![tree.nodes[nid].choices!.length - 1];
            if (lastChoice && lastChoice.requiredFlag === undefined && lastChoice.notFlag === undefined) {
              // Insert before the Fallback rule so Fallback stays at the end
              tree.nodes[nid].choices!.splice(tree.nodes[nid].choices!.length - 1, 0, newChoice);
            } else {
              tree.nodes[nid].choices!.push(newChoice);
            }
          } else {
            tree.nodes[nid].choices!.push(newChoice);
          }

          enforceRouterFallbackLast(nid);
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Drag & Drop Re-ordering for Rules and Choices
    let draggedChoiceNid: string | null = null;
    let draggedChoiceIdx: number | null = null;

    this.element.querySelectorAll('.router-branch-card, .choice-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const cidx = parseInt(el.dataset.cidx || '-1');
        if (nid && cidx >= 0) {
          draggedChoiceNid = nid;
          draggedChoiceIdx = cidx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${cidx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
        el.style.opacity = '1';
        this.element.querySelectorAll('.router-branch-card, .choice-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedChoiceNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #c084fc';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetCIdx = parseInt(el.dataset.cidx || '-1');

        if (draggedChoiceNid && draggedChoiceNid === targetNid && draggedChoiceIdx !== null && targetCIdx >= 0 && draggedChoiceIdx !== targetCIdx) {
          const choices = tree.nodes[targetNid]?.choices;
          if (choices) {
            const [moved] = choices.splice(draggedChoiceIdx, 1);
            choices.splice(targetCIdx, 0, moved);
            enforceRouterFallbackLast(targetNid);
            this.renderTree();
            emitUpdate();
          }
        }
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
      });
    });

    // Drag & Drop Re-ordering for Stage Directives
    let draggedDirNid: string | null = null;
    let draggedDirIdx: number | null = null;

    this.element.querySelectorAll('.stage-directive-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const didx = parseInt(el.dataset.didx || '-1');
        if (nid && didx >= 0) {
          draggedDirNid = nid;
          draggedDirIdx = didx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${didx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedDirNid = null;
        draggedDirIdx = null;
        el.style.opacity = '1';
        this.element.querySelectorAll('.stage-directive-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedDirNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #f59e0b';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetDIdx = parseInt(el.dataset.didx || '-1');

        if (draggedDirNid && draggedDirNid === targetNid && draggedDirIdx !== null && targetDIdx >= 0 && draggedDirIdx !== targetDIdx) {
          const dirs = tree.nodes[targetNid]?.directives;
          if (dirs) {
            const [moved] = dirs.splice(draggedDirIdx, 1);
            dirs.splice(targetDIdx, 0, moved);
            this.renderTree();
            emitUpdate();
          }
        }
        draggedDirNid = null;
        draggedDirIdx = null;
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

    // Unified Choice & Router Condition Flag Name Edit
    this.element.querySelectorAll('.cond-choice-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const val = target.value;
          const opSel = this.element.querySelector(`.cond-choice-op[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            choice.notFlag = val;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = val;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
          }
          emitUpdate();
        }
      });
    });

    // Unified Choice & Router Condition Flag Op Edit (Always / Fallback / TRUE / FALSE)
    this.element.querySelectorAll('.cond-choice-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((sel as HTMLElement).dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const nameInput = this.element.querySelector(`.cond-choice-name[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          const flag = nameInput?.value || '';
          const op = target.value;
          if (op === 'false') {
            choice.notFlag = flag;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = flag;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = 'Else (Fallback)';
          }
          if (tree.nodes[nid].isRouterNode) {
            enforceRouterFallbackLast(nid);
          }
          this.renderTree();
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
          const targetScene = findDialogScene(tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, this.project);
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
          const targetScene = findDialogScene(tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, this.project);
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = relPath;
          const urlInput = this.element.querySelector(`.choice-voice-url[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          emitUpdate();
        }
      });
    });
  }
}
