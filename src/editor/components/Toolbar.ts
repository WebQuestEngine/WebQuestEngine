import { EventBus } from '../../engine/core/EventBus';
import { UIPresetType } from '../../engine/types';

export class Toolbar {
  public element: HTMLElement;
  private isPlayMode = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-toolbar';
    this.render();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="brand-title">
        <span class="brand-icon">🏰</span>
        <span>QuestForge 2D</span>
      </div>

      <div class="toolbar-group">
        <button class="btn btn-gold" id="btn-play-toggle">
          <span id="play-icon">▶</span>
          <span id="play-text">Play Test</span>
        </button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
        <button class="btn" id="btn-undo" title="Undo (Ctrl+Z)" disabled>↩️ Undo</button>
        <button class="btn" id="btn-redo" title="Redo (Ctrl+Y / Cmd+Shift+Z)" disabled>↪️ Redo</button>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
        <button class="btn" id="btn-open-file" title="Open Local Project JSON (HTML5 File Access API)">📂 Open</button>
        <button class="btn" id="btn-save-file" title="Save Project JSON (Ctrl+S or Shift+Click for Save As)">💾 Save</button>
        <button class="btn" id="btn-save-as-file" title="Save Project JSON As... (Ctrl+Shift+S)">💾 Save As...</button>
      </div>

      <div class="toolbar-group">
        <select class="form-select" id="select-viewport-preset" style="width: 145px;" title="Game Aspect Ratio / Viewport Preset">
          <option value="16:9">📺 16:9 (Widescreen)</option>
          <option value="4:3">📺 4:3 (Retro Sierra)</option>
          <option value="16:10">📺 16:10 (Display)</option>
          <option value="21:9">📺 21:9 (Ultrawide)</option>
          <option value="1:1">📺 1:1 (Square)</option>
          <option value="custom">📺 Custom Bounds</option>
        </select>
        <select class="form-select" id="select-ui-preset" style="width: 140px;">
          <option value="lucasarts">LucasArts UI</option>
          <option value="sierra">Sierra UI</option>
          <option value="context_coin">Context Coin UI</option>
          <option value="direct_cursor">Direct Cursor UI</option>
        </select>
        <button class="btn" id="btn-story-graph">🕸️ Story Graph</button>
        <button class="btn" id="btn-dialog-tree">💬 Dialogs</button>
      </div>
    `;

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
