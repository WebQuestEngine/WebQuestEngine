import { ProjectData, StoryNodeData } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class StoryGraphView {
  public element: HTMLElement;
  private project: ProjectData | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'view-modal hidden';
    this.render();
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    this.renderNodes();
  }

  public show(): void {
    this.element.classList.remove('hidden');
    this.renderNodes();
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="view-modal-header">
        <div style="display:flex; gap:16px; align-items:center;">
          <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">🕸️ Story Graph & Chapters</h2>
          <button class="btn btn-primary" id="btn-add-story-node" style="font-size:0.8rem;">+ Add Story Node</button>
        </div>
        <button class="btn btn-primary" id="btn-close-graph">Close View</button>
      </div>
      <div class="view-modal-content">
        <div class="graph-canvas" id="graph-node-container"></div>
      </div>
    `;

    this.element.querySelector('#btn-close-graph')?.addEventListener('click', () => {
      this.hide();
    });

    this.element.querySelector('#btn-add-story-node')?.addEventListener('click', () => {
      if (!this.project) return;
      const newNode: StoryNodeData = {
        id: `sn_${Date.now()}`,
        chapterId: this.project.chapters[0]?.id || 'ch_1',
        sceneId: this.project.scenes[0]?.id || 'scene_gates',
        name: 'New Story Node',
        description: 'New quest chapter step.',
        position: { x: 200 + this.project.storyNodes.length * 200, y: 150 },
        connections: []
      };
      this.project.storyNodes.push(newNode);
      this.renderNodes();
      EventBus.getInstance().emit('editor:project_updated');
    });
  }

  private renderNodes(): void {
    const container = this.element.querySelector('#graph-node-container');
    if (!container || !this.project) return;

    container.innerHTML = '';

    for (let index = 0; index < this.project.storyNodes.length; index++) {
      const node = this.project.storyNodes[index];
      const nodeEl = document.createElement('div');
      nodeEl.className = 'story-node';
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;

      nodeEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <input type="text" class="form-input sn-name" data-idx="${index}" value="${node.name}" style="font-weight:700; font-size:0.85rem; color:var(--accent-gold); width:75%;" />
          <button class="btn btn-del-sn" data-idx="${index}" style="padding:2px 4px; font-size:0.7rem; color:#ef4444;">🗑️</button>
        </div>

        <div style="margin-bottom:4px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Scene ID</label>
          <select class="form-select sn-scene" data-idx="${index}" style="font-size:0.75rem;">
            ${this.project.scenes.map(s => `
              <option value="${s.id}" ${s.id === node.sceneId ? 'selected' : ''}>${s.name} (${s.id})</option>
            `).join('')}
          </select>
        </div>

        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Condition Flag</label>
          <input type="text" class="form-input sn-flag" data-idx="${index}" value="${node.conditionFlag || ''}" placeholder="None" style="font-size:0.75rem;" />
        </div>

        <button class="btn btn-primary btn-jump-scene" style="width:100%; font-size:0.75rem; padding:6px;" data-sceneid="${node.sceneId}">Load Scene ➔</button>
      `;

      container.appendChild(nodeEl);
    }

    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.project) return;
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Node name edit
    this.element.querySelectorAll('.sn-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        this.project!.storyNodes[idx].name = (e.target as HTMLInputElement).value;
        emitUpdate();
      });
    });

    // Scene ID edit
    this.element.querySelectorAll('.sn-scene').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        this.project!.storyNodes[idx].sceneId = (e.target as HTMLSelectElement).value;
        emitUpdate();
      });
    });

    // Flag edit
    this.element.querySelectorAll('.sn-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        this.project!.storyNodes[idx].conditionFlag = (e.target as HTMLInputElement).value || undefined;
        emitUpdate();
      });
    });

    // Delete story node
    this.element.querySelectorAll('.btn-del-sn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
        this.project!.storyNodes.splice(idx, 1);
        this.renderNodes();
        emitUpdate();
      });
    });

    // Jump to Scene
    this.element.querySelectorAll('.btn-jump-scene').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sceneId = (e.currentTarget as HTMLElement).dataset.sceneid!;
        EventBus.getInstance().emit('editor:select_scene', sceneId);
        this.hide();
      });
    });
  }
}
