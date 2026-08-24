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
        <h2 style="font-family: var(--font-heading); color: var(--accent-gold);">🕸️ Story Graph & Chapters</h2>
        <button class="btn btn-primary" id="btn-close-graph">Close View</button>
      </div>
      <div class="view-modal-content">
        <div class="graph-canvas" id="graph-node-container"></div>
      </div>
    `;

    this.element.querySelector('#btn-close-graph')?.addEventListener('click', () => {
      this.hide();
    });
  }

  private renderNodes(): void {
    const container = this.element.querySelector('#graph-node-container');
    if (!container || !this.project) return;

    container.innerHTML = '';

    for (const node of this.project.storyNodes) {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'story-node';
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;

      const chapter = this.project.chapters.find(c => c.id === node.chapterId);
      const scene = this.project.scenes.find(s => s.id === node.sceneId);

      nodeEl.innerHTML = `
        <div class="story-node-title">${node.name}</div>
        <div class="story-node-scene">Chapter: ${chapter ? chapter.title : 'Unassigned'}</div>
        <div class="story-node-scene">Scene: ${scene ? scene.name : node.sceneId}</div>
        ${node.conditionFlag ? `<div style="font-size:0.7rem; color:var(--accent-gold); margin-top:4px;">Requires Flag: ${node.conditionFlag}</div>` : ''}
        <button class="btn" style="width:100%; margin-top:8px; font-size:0.75rem;" data-nodeid="${node.id}">Switch to Scene</button>
      `;

      nodeEl.querySelector('button')?.addEventListener('click', () => {
        EventBus.getInstance().emit('editor:select_scene', node.sceneId);
        this.hide();
      });

      container.appendChild(nodeEl);
    }
  }
}
