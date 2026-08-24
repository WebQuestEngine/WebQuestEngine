import { ProjectData, SceneData, WalkPathData, HotspotData, UIPresetType } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class Inspector {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private currentScene: SceneData | null = null;
  private activeTab: 'scene' | 'walkpath' | 'hotspots' | 'ui' = 'scene';

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-sidebar';
    this.render();
  }

  public setProject(project: ProjectData, currentScene?: SceneData): void {
    this.project = project;
    if (currentScene) this.currentScene = currentScene;
    this.renderContent();
  }

  public setCurrentScene(scene: SceneData): void {
    this.currentScene = scene;
    this.renderContent();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="sidebar-tab-header">
        <button class="tab-btn active" data-tab="scene">Scene</button>
        <button class="tab-btn" data-tab="walkpath">WalkPath</button>
        <button class="tab-btn" data-tab="hotspots">Hotspots</button>
        <button class="tab-btn" data-tab="ui">UI Config</button>
      </div>
      <div id="inspector-tab-content"></div>
    `;

    this.element.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as any;
        this.activeTab = tab;
        this.element.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.renderContent();
      });
    });
  }

  private renderContent(): void {
    const container = this.element.querySelector('#inspector-tab-content');
    if (!container || !this.project) return;

    if (this.activeTab === 'scene') {
      container.innerHTML = this.getSceneHTML();
    } else if (this.activeTab === 'walkpath') {
      container.innerHTML = this.getWalkPathHTML();
    } else if (this.activeTab === 'hotspots') {
      container.innerHTML = this.getHotspotsHTML();
    } else if (this.activeTab === 'ui') {
      container.innerHTML = this.getUIHTML();
    }

    this.attachEvents();
  }

  private getSceneHTML(): string {
    if (!this.currentScene) return '<div class="sidebar-section">No scene selected.</div>';
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Scene Info</div>
        <div class="form-group">
          <label>Scene Name</label>
          <input type="text" class="form-input" id="sc-name" value="${this.currentScene.name}" />
        </div>
        <div class="form-group">
          <label>Width x Height</label>
          <div style="display:flex; gap:8px;">
            <input type="number" class="form-input" id="sc-w" value="${this.currentScene.width}" />
            <input type="number" class="form-input" id="sc-h" value="${this.currentScene.height}" />
          </div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Parallax Layers (${this.currentScene.layers.length})</div>
        ${this.currentScene.layers.map(l => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 700; color: var(--accent-gold); font-size: 0.8rem;">${l.name} (z: ${l.zIndex})</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Parallax X: ${l.parallaxX} | Y: ${l.parallaxY}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getWalkPathHTML(): string {
    if (!this.currentScene || this.currentScene.walkPaths.length === 0) {
      return '<div class="sidebar-section">No walkpath defined.</div>';
    }
    const wp = this.currentScene.walkPaths[0];
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">WalkPath Perspective Scaling</div>
        <div class="form-group">
          <label>Min Horizon Y</label>
          <input type="number" class="form-input" id="wp-min-y" value="${wp.scaling.minY}" />
        </div>
        <div class="form-group">
          <label>Max Horizon Y</label>
          <input type="number" class="form-input" id="wp-max-y" value="${wp.scaling.maxY}" />
        </div>
        <div class="form-group">
          <label>Min Character Scale (at horizon)</label>
          <input type="number" step="0.05" class="form-input" id="wp-min-scale" value="${wp.scaling.minScale}" />
        </div>
        <div class="form-group">
          <label>Max Character Scale (at foreground)</label>
          <input type="number" step="0.05" class="form-input" id="wp-max-scale" value="${wp.scaling.maxScale}" />
        </div>
      </div>
    `;
  }

  private getHotspotsHTML(): string {
    if (!this.currentScene) return '<div class="sidebar-section">No scene selected.</div>';
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Hotspots (${this.currentScene.hotspots.length})</div>
        ${this.currentScene.hotspots.map(hs => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 700; color: var(--accent-gold); font-size: 0.85rem;">${hs.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Cursor: ${hs.cursor}</div>
            <div style="font-size: 0.75rem; color: var(--accent-blue); margin-top: 4px;">Actions: ${hs.actions.map(a => a.verb).join(', ')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getUIHTML(): string {
    if (!this.project) return '';
    const ui = this.project.uiConfig;
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Interface Layout Presets</div>
        <div class="form-group">
          <label>Active Layout Preset</label>
          <select class="form-select" id="ui-preset-select">
            <option value="lucasarts" ${ui.preset === 'lucasarts' ? 'selected' : ''}>LucasArts Bottom Grid</option>
            <option value="sierra" ${ui.preset === 'sierra' ? 'selected' : ''}>Sierra Top Action Bar</option>
            <option value="context_coin" ${ui.preset === 'context_coin' ? 'selected' : ''}>Context Coin / Radial Menu</option>
            <option value="direct_cursor" ${ui.preset === 'direct_cursor' ? 'selected' : ''}>Direct Smart Cursor</option>
          </select>
        </div>
        <div class="form-group">
          <label>Inventory Position</label>
          <select class="form-select" id="ui-inv-pos">
            <option value="bottom" ${ui.inventoryPosition === 'bottom' ? 'selected' : ''}>Bottom Bar</option>
            <option value="top" ${ui.inventoryPosition === 'top' ? 'selected' : ''}>Top Bar</option>
            <option value="drawer" ${ui.inventoryPosition === 'drawer' ? 'selected' : ''}>Slide-out Drawer</option>
          </select>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    const presetSelect = this.element.querySelector('#ui-preset-select') as HTMLSelectElement;
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const val = presetSelect.value as UIPresetType;
        EventBus.getInstance().emit('editor:change_preset', val);
      });
    }

    // Walkpath updates
    const minYInput = this.element.querySelector('#wp-min-y') as HTMLInputElement;
    const maxYInput = this.element.querySelector('#wp-max-y') as HTMLInputElement;
    const minScaleInput = this.element.querySelector('#wp-min-scale') as HTMLInputElement;
    const maxScaleInput = this.element.querySelector('#wp-max-scale') as HTMLInputElement;

    const updateWalkpathScaling = () => {
      if (!this.currentScene || this.currentScene.walkPaths.length === 0) return;
      const wp = this.currentScene.walkPaths[0];
      if (minYInput) wp.scaling.minY = parseFloat(minYInput.value) || wp.scaling.minY;
      if (maxYInput) wp.scaling.maxY = parseFloat(maxYInput.value) || wp.scaling.maxY;
      if (minScaleInput) wp.scaling.minScale = parseFloat(minScaleInput.value) || wp.scaling.minScale;
      if (maxScaleInput) wp.scaling.maxScale = parseFloat(maxScaleInput.value) || wp.scaling.maxScale;
    };

    minYInput?.addEventListener('change', updateWalkpathScaling);
    maxYInput?.addEventListener('change', updateWalkpathScaling);
    minScaleInput?.addEventListener('change', updateWalkpathScaling);
    maxScaleInput?.addEventListener('change', updateWalkpathScaling);
  }
}
