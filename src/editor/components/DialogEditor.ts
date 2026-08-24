import { ProjectData, DialogTree } from '../../engine/types';

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
        <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">💬 Branching Dialog Editor</h2>
        <button class="btn btn-primary" id="btn-close-dialog-editor">Close Editor</button>
      </div>
      <div class="view-modal-content" style="display: flex; gap: 20px;">
        <div style="width: 250px; border-right: 1px solid var(--panel-border); padding-right: 16px;">
          <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: var(--accent-gold);">Dialog Trees</h3>
          <div id="dialog-tree-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>
        <div style="flex: 1;" id="dialog-nodes-container"></div>
      </div>
    `;

    this.element.querySelector('#btn-close-dialog-editor')?.addEventListener('click', () => {
      this.hide();
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
      if (!tree) return;

      nodesContainer.innerHTML = `
        <h3 style="color: var(--accent-gold); margin-bottom: 16px;">Nodes for "${tree.title}"</h3>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${Object.values(tree.nodes).map(node => `
            <div style="background: rgba(30,41,59,0.7); border: 1px solid var(--panel-border); border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--accent-gold); margin-bottom: 6px;">
                <span>Speaker: ${node.speaker}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">ID: ${node.id}</span>
              </div>
              <div style="font-size: 0.9rem; color: #ffffff; margin-bottom: 10px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px;">
                "${node.text}"
              </div>
              ${node.choices && node.choices.length > 0 ? `
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--accent-blue); margin-bottom: 4px;">Choices:</div>
                <div style="display: flex; flex-direction: column; gap: 4px; padding-left: 8px;">
                  ${node.choices.map(c => `
                    <div style="font-size: 0.8rem; color: #cbd5e1;">➔ "${c.text}" ➔ leads to <b>${c.nextNodeId}</b></div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
  }
}
