import { EventBus } from '../../engine/core/EventBus';
import { UIPresetType } from '../../engine/types';
import { ToolbarTemplate } from './templates/Toolbar.template';

export class Toolbar {
  public element: HTMLElement;
  private isPlayMode = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-toolbar';
    this.render();
  }

  private render(): void {
    this.element.innerHTML = ToolbarTemplate.render();

    this.attachEvents();
  }

  private attachEvents(): void {
    const playBtn = this.element.querySelector('#btn-play-toggle') as HTMLButtonElement;

    EventBus.getInstance().on('editor:mode_changed', (data: { isPlayMode: boolean }) => {
      this.isPlayMode = data.isPlayMode;
      const playIcon = this.element.querySelector('#play-icon');
      const playText = this.element.querySelector('#play-text');
      if (this.isPlayMode) {
        playBtn.classList.remove('btn-gold');
        playBtn.classList.add('btn-primary');
        if (playIcon) playIcon.textContent = '⏸';
        if (playText) playText.textContent = 'Pause Editor';
      } else {
        playBtn.classList.remove('btn-primary');
        playBtn.classList.add('btn-gold');
        if (playIcon) playIcon.textContent = '▶';
        if (playText) playText.textContent = 'Play Test';
      }
    });

    playBtn.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:mode_changed', { isPlayMode: !this.isPlayMode });
    });

    const undoBtn = this.element.querySelector('#btn-undo') as HTMLButtonElement;
    const redoBtn = this.element.querySelector('#btn-redo') as HTMLButtonElement;

    undoBtn?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:undo');
    });

    redoBtn?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:redo');
    });

    EventBus.getInstance().on('history:changed', (state: { canUndo: boolean; canRedo: boolean }) => {
      if (undoBtn) undoBtn.disabled = !state.canUndo;
      if (redoBtn) redoBtn.disabled = !state.canRedo;
    });

    this.element.querySelector('#btn-new-project')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:show_project_hub');
    });

    this.element.querySelector('#btn-open-file')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:open_file');
    });

    this.element.querySelector('#btn-save-file')?.addEventListener('click', (e: Event) => {
      const mouseEv = e as MouseEvent;
      if (mouseEv.shiftKey) {
        EventBus.getInstance().emit('editor:save_file_as');
      } else {
        EventBus.getInstance().emit('editor:save_file');
      }
    });

    this.element.querySelector('#btn-save-as-file')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:save_file_as');
    });

    this.element.querySelector('#btn-project-settings')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:select_target', { type: 'project' });
    });

    this.element.querySelector('#select-viewport-preset')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      EventBus.getInstance().emit('editor:change_viewport_preset', val);
    });

    this.element.querySelector('#select-ui-preset')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as UIPresetType;
      EventBus.getInstance().emit('editor:change_preset', val);
    });

    this.element.querySelector('#btn-story-graph')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:toggle_story_graph');
    });

    this.element.querySelector('#btn-dialog-tree')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:toggle_dialog_editor');
    });
  }
}
