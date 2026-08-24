import { ProjectData, DialogTree, DialogNode, DialogChoice } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class DialogEditor {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;

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
        <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">💬 Branching Dialog Tree Editor</h2>
        <button class="btn btn-primary" id="btn-close-dialog-editor">Close Editor</button>
      </div>
      <div class="view-modal-content" style="display: flex; gap: 20px;">
        <div style="width: 280px; border-right: 1px solid var(--panel-border); padding-right: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <h3 style="font-size: 0.9rem; color: var(--accent-gold);">Dialog Trees</h3>
            <button class="btn btn-primary" id="btn-add-tree" style="font-size:0.75rem; padding:4px 8px;">+ New Tree</button>
          </div>
          <div id="dialog-tree-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>
        <div style="flex: 1;" id="dialog-nodes-container"></div>
      </div>
    `;

    this.element.querySelector('#btn-close-dialog-editor')?.addEventListener('click', () => {
      this.hide();
    });

    this.element.querySelector('#btn-add-tree')?.addEventListener('click', () => {
      if (!this.project) return;
      const newTree: DialogTree = {
        id: `dlg_${Date.now()}`,
        title: 'New Conversation',
        startNodeId: 'node_1',
        nodes: {
          node_1: {
            id: 'node_1',
            speaker: 'NPC',
            text: 'Hello adventurer! What brings you here?'
          }
        }
      };
      this.project.dialogs.push(newTree);
      this.selectedTreeId = newTree.id;
      this.renderTree();
      EventBus.getInstance().emit('editor:project_updated');
    });
  }

  private renderTree(): void {
    if (!this.project) return;
    const treeList = this.element.querySelector('#dialog-tree-list');
    const nodesContainer = this.element.querySelector('#dialog-nodes-container');

    if (treeList) {
      treeList.innerHTML = '';
      for (const dlg of this.project.dialogs) {
        const btn = document.createElement('button');
        btn.className = `btn ${dlg.id === this.selectedTreeId ? 'btn-primary' : ''}`;
        btn.style.width = '100%';
        btn.textContent = dlg.title;
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
        nodesContainer.innerHTML = '<div>Select a dialogue tree to edit.</div>';
        return;
      }

      nodesContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted);">Tree Title</label>
            <input type="text" class="form-input" id="tree-title-input" value="${tree.title}" style="font-weight:700; font-size:1rem; width:300px;" />
          </div>
          <button class="btn btn-primary" id="btn-add-node" style="font-size:0.8rem;">+ Add Dialogue Node</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${Object.values(tree.nodes).map(node => `
            <div style="background: rgba(30,41,59,0.8); border: 1px solid var(--panel-border); border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <span style="font-size:0.75rem; color:var(--accent-gold); font-weight:700;">Node ID: ${node.id}</span>
                  <input type="text" class="form-input node-speaker" data-nodeid="${node.id}" value="${node.speaker}" placeholder="Speaker Name" style="width:140px; font-size:0.8rem;" />
                </div>
                <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.75rem; padding:4px 8px;">+ Choice</button>
              </div>

              <div style="margin-bottom:10px;">
                <label style="font-size:0.7rem; color:var(--text-muted);">Dialogue Text</label>
                <textarea class="form-input node-text" data-nodeid="${node.id}" style="width:100%; height:50px; font-size:0.85rem;">${node.text}</textarea>
              </div>

              ${node.choices && node.choices.length > 0 ? `
                <div style="font-size:0.75rem; font-weight:700; color:var(--accent-blue); margin-bottom:6px;">Player Choices:</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  ${node.choices.map((choice, cIdx) => `
                    <div style="display:flex; gap:6px; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; align-items:center;">
                      <input type="text" class="form-input choice-text" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${choice.text}" placeholder="Option Text" style="flex:2; font-size:0.8rem;" />
                      <span style="font-size:0.7rem; color:var(--text-muted);">➔ Leads to:</span>
                      <input type="text" class="form-input choice-next" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${choice.nextNodeId}" placeholder="Target Node ID" style="flex:1; font-size:0.8rem;" />
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;

      this.attachEvents(tree);
    }
  }

  private attachEvents(tree: DialogTree): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Tree title
    this.element.querySelector('#tree-title-input')?.addEventListener('input', (e) => {
      tree.title = (e.target as HTMLInputElement).value;
      emitUpdate();
    });

    // Add node
    this.element.querySelector('#btn-add-node')?.addEventListener('click', () => {
      const newNodeId = `node_${Object.keys(tree.nodes).length + 1}`;
      tree.nodes[newNodeId] = {
        id: newNodeId,
        speaker: 'Speaker',
        text: 'New dialogue sentence.'
      };
      this.renderTree();
      emitUpdate();
    });

    // Node speaker edit
    this.element.querySelectorAll('.node-speaker').forEach(input => {
      input.addEventListener('input', (e) => {
        const nodeId = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nodeId]) {
          tree.nodes[nodeId].speaker = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    // Node text edit
    this.element.querySelectorAll('.node-text').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const nodeId = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nodeId]) {
          tree.nodes[nodeId].text = (e.target as HTMLTextAreaElement).value;
          emitUpdate();
        }
      });
    });

    // Add Choice
    this.element.querySelectorAll('.btn-add-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nodeId = (e.currentTarget as HTMLElement).dataset.nodeid!;
        const node = tree.nodes[nodeId];
        if (node) {
          if (!node.choices) node.choices = [];
          node.choices.push({
            id: `c_${Date.now()}`,
            text: 'New choice response',
            nextNodeId: 'node_1'
          });
          this.renderTree();
          emitUpdate();
        }
      });
    });

    // Choice text edit
    this.element.querySelectorAll('.choice-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const nodeId = (e.target as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((e.target as HTMLElement).dataset.cidx!);
        if (tree.nodes[nodeId] && tree.nodes[nodeId].choices) {
          tree.nodes[nodeId].choices![cIdx].text = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    // Choice next node edit
    this.element.querySelectorAll('.choice-next').forEach(input => {
      input.addEventListener('input', (e) => {
        const nodeId = (e.target as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((e.target as HTMLElement).dataset.cidx!);
        if (tree.nodes[nodeId] && tree.nodes[nodeId].choices) {
          tree.nodes[nodeId].choices![cIdx].nextNodeId = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });
  }
}
