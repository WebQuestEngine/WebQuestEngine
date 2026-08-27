import { ProjectData, DialogTree, DialogNode, DialogChoice, Vector2D } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class DialogEditor {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;

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
    this.element.classList.add('hidden');
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="view-modal-header">
        <div style="display:flex; gap:16px; align-items:center;">
          <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">💬 Branching Dialogue Graph Editor</h2>
          <button class="btn btn-primary" id="btn-add-dialog-node" style="font-size:0.8rem;">+ Add Dialogue Speech Node</button>
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
        <div style="flex: 1; position:relative; overflow:hidden;" class="graph-canvas" id="dialog-nodes-viewport">
          <svg id="dialog-connections-svg" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1;">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
              </marker>
            </defs>
          </svg>
          <div id="dialog-nodes-container" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; overflow:auto;"></div>
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
        nodesContainer.innerHTML = '<div style="padding:20px; color:var(--text-muted);">Select a dialogue tree to edit.</div>';
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

      nodesContainer.innerHTML = `
        <div style="padding:10px; margin-bottom:10px; display:flex; gap:12px; align-items:center;">
          <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Dialogue Title:</label>
          <input type="text" id="tree-title-input" class="form-input" value="${tree.title}" style="width:240px;" />
          <label style="font-size:0.8rem; color:var(--accent-gold); font-weight:700;">Start Node ID:</label>
          <input type="text" id="tree-start-node-input" class="form-input" value="${tree.startNodeId}" style="width:120px;" />
        </div>
        ${Object.values(tree.nodes).map(node => {
          const isStartNode = node.id === tree.startNodeId;
          const choiceCount = node.choices?.length || 0;
          const hasMultipleOutgoing = choiceCount > 1;
          const isInteractive = node.isChoiceInteractive !== false;

          return `
            <div class="dialog-graph-card" data-nodeid="${node.id}" style="position:absolute; left:${node.position?.x || 50}px; top:${node.position?.y || 50}px; width:340px; background:rgba(30,41,59,0.94); border:1px solid ${isStartNode ? 'var(--accent-gold)' : 'var(--panel-border)'}; border-radius:10px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:0.8rem;">
              
              <!-- Left Input Port (To connect incoming response arrows) -->
              <div class="node-port node-port-in" data-nodeid="${node.id}" style="position:absolute; left:-9px; top:18px; width:18px; height:18px; border-radius:50%; background:#38bdf8; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(56,189,248,0.9); z-index:10;" title="Input Port: Drag an arrow from another node's output port to connect here"></div>

              <!-- Header -->
              <div class="node-drag-handle" data-nodeid="${node.id}" style="display:flex; justify-content:space-between; align-items:center; cursor:move; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:6px; align-items:center;">
                  <span style="font-weight:700; color:${isStartNode ? 'var(--accent-gold)' : '#38bdf8'};">🆔 ${node.id}</span>
                  ${isStartNode ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>' : ''}
                </div>
                <div style="display:flex; gap:4px;">
                  ${!isStartNode ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>` : ''}
                  <button class="btn btn-del-node" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px; color:#ef4444;" title="Delete Node">✕</button>
                </div>
              </div>

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

              <!-- Interactivity Checkbox (when multiple choices exist) -->
              ${hasMultipleOutgoing ? `
                <div style="background:rgba(251, 191, 36, 0.1); border:1px solid rgba(251, 191, 36, 0.3); border-radius:6px; padding:6px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" class="node-interactive-chk" data-nodeid="${node.id}" ${isInteractive ? 'checked' : ''} id="chk_inter_${node.id}" />
                  <label for="chk_inter_${node.id}" style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; cursor:pointer;">
                    ☑️ Interactive Player Selection Box
                  </label>
                </div>
              ` : ''}

              <!-- Outgoing Choices & Responses -->
              <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:0.7rem; font-weight:700; color:var(--accent-gold);">Outgoing Responses (${choiceCount}):</span>
                  <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ Response</button>
                </div>

                ${node.choices && node.choices.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${node.choices.map((c, cIdx) => `
                      <div class="choice-card" style="position:relative; background:rgba(0,0,0,0.3); border:1px solid var(--panel-border); padding:6px; border-radius:6px;">
                        <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                          <input type="text" class="form-input choice-text" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.text}" placeholder="Choice Text" style="flex:1; font-size:0.75rem; font-weight:600;" />
                          <span style="font-size:0.65rem; color:var(--text-muted);">➔</span>
                          <input type="text" class="form-input choice-next" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.nextNodeId}" placeholder="Next ID" style="width:75px; font-size:0.75rem;" />
                          <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;">✕</button>
                        </div>
                        <div style="margin-top:2px; display:flex; gap:6px; align-items:center;">
                          <input type="text" class="form-input choice-voice-url" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.voiceAudioUrl || ''}" placeholder="🎙️ Response Voiceover Audio URL..." style="flex:1; font-size:0.7rem;" />
                          <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
                            📁
                            <input type="file" class="choice-voice-file" data-nodeid="${node.id}" data-cidx="${cIdx}" accept="audio/*" style="display:none;" />
                          </label>
                        </div>
                        
                        <!-- Response Choice Output Port (Right Edge) -->
                        <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#fbbf24; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(251,191,36,0.9); z-index:10;" title="Click & Drag arrow to connect to target node Input Port"></div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="display:flex; gap:6px; align-items:center;">
                    <span style="font-size:0.65rem; color:var(--text-muted);">Default Next Node:</span>
                    <input type="text" class="form-input node-next-id" data-nodeid="${node.id}" value="${node.nextNodeId || ''}" placeholder="Node ID or empty for end" style="flex:1; font-size:0.75rem;" />
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      `;

      setTimeout(() => {
        this.renderConnectionLines(tree, svgEl);
      }, 0);
      this.attachEvents(tree);
    }
  }

  private renderConnectionLines(tree: DialogTree, svgEl: SVGElement): void {
    if (!svgEl) return;
    const viewport = this.element.querySelector('#dialog-nodes-viewport') as HTMLElement;
    if (!viewport) return;
    const vRect = viewport.getBoundingClientRect();

    let pathsHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
        </marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444"/>
        </marker>
      </defs>
    `;

    const nodes = tree.nodes;
    for (const sourceNode of Object.values(nodes)) {
      if (sourceNode.choices && sourceNode.choices.length > 0) {
        sourceNode.choices.forEach((c, cIdx) => {
          if (!c.nextNodeId || !nodes[c.nextNodeId]) return;

          const outPort = viewport.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"][data-cidx="${cIdx}"]`);
          const inPort = viewport.querySelector(`.node-port-in[data-nodeid="${c.nextNodeId}"]`);

          if (outPort && inPort) {
            const rOut = outPort.getBoundingClientRect();
            const rIn = inPort.getBoundingClientRect();

            const x1 = rOut.left + rOut.width / 2 - vRect.left + viewport.scrollLeft;
            const y1 = rOut.top + rOut.height / 2 - vRect.top + viewport.scrollTop;
            const x2 = rIn.left + rIn.width / 2 - vRect.left + viewport.scrollLeft;
            const y2 = rIn.top + rIn.height / 2 - vRect.top + viewport.scrollTop;

            const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            pathsHTML += `<path d="${pathData}" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="${sourceNode.isChoiceInteractive === false ? '4,4' : 'none'}" marker-end="url(#arrow)" opacity="0.9" />`;
          }
        });
      } else if (sourceNode.nextNodeId && nodes[sourceNode.nextNodeId]) {
        const outPort = viewport.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"]:not([data-cidx])`);
        const inPort = viewport.querySelector(`.node-port-in[data-nodeid="${sourceNode.nextNodeId}"]`);

        if (outPort && inPort) {
          const rOut = outPort.getBoundingClientRect();
          const rIn = inPort.getBoundingClientRect();

          const x1 = rOut.left + rOut.width / 2 - vRect.left + viewport.scrollLeft;
          const y1 = rOut.top + rOut.height / 2 - vRect.top + viewport.scrollTop;
          const x2 = rIn.left + rIn.width / 2 - vRect.left + viewport.scrollLeft;
          const y2 = rIn.top + rIn.height / 2 - vRect.top + viewport.scrollTop;

          const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
          const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          pathsHTML += `<path d="${pathData}" fill="none" stroke="#38bdf8" stroke-width="2.5" marker-end="url(#arrow-blue)" opacity="0.9" />`;
        }
      }
    }

    if (this.isWiring && this.tempWirePath) {
      pathsHTML += `<path d="${this.tempWirePath}" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="5,5" marker-end="url(#arrow-red)" />`;
    }

    svgEl.innerHTML = pathsHTML;
  }

  private attachEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    const viewport = this.element.querySelector('#dialog-nodes-viewport') as HTMLElement;
    const svgEl = this.element.querySelector('#dialog-connections-svg') as SVGElement;

    // --- Interactive Drag-to-Connect Wiring ---
    this.element.querySelectorAll('.node-port-out').forEach(port => {
      port.addEventListener('mousedown', (e: Event) => {
        e.stopPropagation();
        const mouseEv = e as MouseEvent;
        this.isWiring = true;
        this.wireSourceNodeId = (port as HTMLElement).dataset.nodeid!;
        const cIdxStr = (port as HTMLElement).dataset.cidx;
        this.wireSourceCIdx = cIdxStr !== undefined ? parseInt(cIdxStr) : null;

        if (viewport) {
          const vRect = viewport.getBoundingClientRect();
          const pRect = (port as HTMLElement).getBoundingClientRect();
          this.wireStartPt = {
            x: pRect.left + pRect.width / 2 - vRect.left + viewport.scrollLeft,
            y: pRect.top + pRect.height / 2 - vRect.top + viewport.scrollTop
          };
        }
      });
    });

    // --- Node Drag & Drop ---
    this.element.querySelectorAll('.node-drag-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e: Event) => {
        if (this.isWiring) return;
        const mouseEv = e as MouseEvent;
        this.isDraggingNode = true;
        this.draggedNodeId = (handle as HTMLElement).dataset.nodeid!;
        const card = handle.closest('.dialog-graph-card') as HTMLElement;

        if (card && viewport) {
          const rect = card.getBoundingClientRect();
          this.dragOffset = {
            x: mouseEv.clientX - rect.left,
            y: mouseEv.clientY - rect.top
          };
        }
      });
    });

    if (viewport) {
      viewport.addEventListener('mousemove', (e: MouseEvent) => {
        if (this.isWiring) {
          const vRect = viewport.getBoundingClientRect();
          const currentX = e.clientX - vRect.left + viewport.scrollLeft;
          const currentY = e.clientY - vRect.top + viewport.scrollTop;

          const dx = Math.max(30, Math.abs(currentX - this.wireStartPt.x) * 0.5);
          this.tempWirePath = `M ${this.wireStartPt.x} ${this.wireStartPt.y} C ${this.wireStartPt.x + dx} ${this.wireStartPt.y}, ${currentX - dx} ${currentY}, ${currentX} ${currentY}`;
          if (svgEl) this.renderConnectionLines(tree, svgEl);
          return;
        }

        if (this.isDraggingNode && this.draggedNodeId && tree.nodes[this.draggedNodeId]) {
          const vRect = viewport.getBoundingClientRect();
          const node = tree.nodes[this.draggedNodeId];
          node.position = {
            x: Math.max(10, e.clientX - vRect.left - this.dragOffset.x),
            y: Math.max(10, e.clientY - vRect.top - this.dragOffset.y)
          };

          // Fast 60 FPS direct DOM style update
          const card = viewport.querySelector(`.dialog-graph-card[data-nodeid="${this.draggedNodeId}"]`) as HTMLElement;
          if (card) {
            card.style.left = `${node.position.x}px`;
            card.style.top = `${node.position.y}px`;
          }

          if (svgEl) this.renderConnectionLines(tree, svgEl);
        }
      });

      viewport.addEventListener('mouseup', (e: MouseEvent) => {
        if (this.isWiring) {
          this.isWiring = false;
          this.tempWirePath = null;

          // Detect if dropped on an Input Port (.node-port-in)
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

    // Next Node ID Edit
    this.element.querySelectorAll('.node-next-id').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].nextNodeId = (input as HTMLInputElement).value.trim() || undefined;
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
            id: `choice_${cIdx}`,
            text: 'Response option...',
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

    // Choice Next Node ID Edit
    this.element.querySelectorAll('.choice-next').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].nextNodeId = target.value.trim();
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
