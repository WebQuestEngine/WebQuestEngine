import { ProjectData, SceneData, WalkPathData, HotspotData, UIPresetType, LayerData, InventoryItemData } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export class Inspector {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private currentScene: SceneData | null = null;
  private activeTab: 'scene' | 'walkpath' | 'hotspots' | 'items' | 'ui' = 'scene';

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
        <button class="tab-btn" data-tab="items">Items</button>
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
    } else if (this.activeTab === 'items') {
      container.innerHTML = this.getItemsHTML();
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
          <label>Dimensions (W x H)</label>
          <div style="display:flex; gap:8px;">
            <input type="number" class="form-input" id="sc-w" value="${this.currentScene.width}" />
            <input type="number" class="form-input" id="sc-h" value="${this.currentScene.height}" />
          </div>
        </div>
        <div class="form-group">
          <label>Player Spawn (X , Y)</label>
          <div style="display:flex; gap:8px;">
            <input type="number" class="form-input" id="sc-spawn-x" value="${this.currentScene.playerSpawn.x}" />
            <input type="number" class="form-input" id="sc-spawn-y" value="${this.currentScene.playerSpawn.y}" />
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Layers (${this.currentScene.layers.length})</div>
          <button class="btn btn-primary" id="btn-add-layer" style="font-size:0.75rem; padding:4px 8px;">+ Add Layer</button>
        </div>
        ${this.currentScene.layers.map((l, index) => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <input type="text" class="form-input layer-name" data-idx="${index}" value="${l.name}" style="font-weight:700; width:70%; font-size:0.8rem;" />
              <button class="btn btn-del-layer" data-idx="${index}" style="padding:2px 6px; font-size:0.7rem; color:#ef4444;">🗑️</button>
            </div>
            <div style="margin-top:6px;">
              <label style="font-size:0.7rem; color:var(--text-muted);">Image Source / Local Upload</label>
              <div style="display:flex; gap:6px;">
                <input type="text" class="form-input layer-url" data-idx="${index}" value="${l.imageUrl}" style="font-size:0.75rem; flex:1;" />
                <label class="btn btn-primary" style="font-size:0.75rem; padding:4px 8px; cursor:pointer;">
                  📁
                  <input type="file" class="layer-file-input" data-idx="${index}" accept="image/*" style="display:none;" />
                </label>
              </div>
            </div>
            <div style="display:flex; gap:6px; margin-top:6px;">
              <div>
                <label style="font-size:0.65rem; color:var(--text-muted);">Parallax X</label>
                <input type="number" step="0.1" class="form-input layer-px" data-idx="${index}" value="${l.parallaxX}" style="font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.65rem; color:var(--text-muted);">Parallax Y</label>
                <input type="number" step="0.1" class="form-input layer-py" data-idx="${index}" value="${l.parallaxY}" style="font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.65rem; color:var(--text-muted);">Z-Index</label>
                <input type="number" class="form-input layer-z" data-idx="${index}" value="${l.zIndex}" style="font-size:0.75rem;" />
              </div>
            </div>
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
          <label>Min Horizon Y (Distance)</label>
          <input type="number" class="form-input" id="wp-min-y" value="${wp.scaling.minY}" />
        </div>
        <div class="form-group">
          <label>Max Horizon Y (Foreground)</label>
          <input type="number" class="form-input" id="wp-max-y" value="${wp.scaling.maxY}" />
        </div>
        <div class="form-group">
          <label>Min Scale Factor (at horizon)</label>
          <input type="number" step="0.05" class="form-input" id="wp-min-scale" value="${wp.scaling.minScale}" />
        </div>
        <div class="form-group">
          <label>Max Scale Factor (at foreground)</label>
          <input type="number" step="0.05" class="form-input" id="wp-max-scale" value="${wp.scaling.maxScale}" />
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Walk Polygon Vertices (${wp.points.length})</div>
        ${wp.points.map((pt, i) => `
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
            <span style="font-size:0.75rem; color:var(--text-muted); width:24px;">#${i + 1}</span>
            <input type="number" class="form-input wp-pt-x" data-idx="${i}" value="${pt.x}" style="font-size:0.75rem;" />
            <input type="number" class="form-input wp-pt-y" data-idx="${i}" value="${pt.y}" style="font-size:0.75rem;" />
          </div>
        `).join('')}
      </div>
    `;
  }

  private getHotspotsHTML(): string {
    if (!this.currentScene) return '<div class="sidebar-section">No scene selected.</div>';
    return `
      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Hotspots (${this.currentScene.hotspots.length})</div>
          <button class="btn btn-primary" id="btn-add-hotspot" style="font-size:0.75rem; padding:4px 8px;">+ Add Hotspot</button>
        </div>
        ${this.currentScene.hotspots.map((hs, hIdx) => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <input type="text" class="form-input hs-name" data-hidx="${hIdx}" value="${hs.name}" style="font-weight:700; font-size:0.85rem; width:75%;" />
              <button class="btn btn-del-hs" data-hidx="${hIdx}" style="padding:2px 6px; font-size:0.7rem; color:#ef4444;">🗑️</button>
            </div>
            <div style="margin-top:6px;">
              <label style="font-size:0.7rem; color:var(--text-muted);">Cursor Context</label>
              <input type="text" class="form-input hs-cursor" data-hidx="${hIdx}" value="${hs.cursor}" style="font-size:0.75rem;" />
            </div>

            <div style="margin-top:8px;">
              <div style="font-size:0.75rem; font-weight:600; color:var(--accent-gold); margin-bottom:4px;">Actions</div>
              ${hs.actions.map((act, aIdx) => `
                <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:6px; border-radius:4px; margin-bottom:6px;">
                  <div style="display:flex; gap:6px; margin-bottom:4px;">
                    <select class="form-select act-verb" data-hidx="${hIdx}" data-aidx="${aIdx}" style="font-size:0.75rem;">
                      <option value="look" ${act.verb === 'look' ? 'selected' : ''}>Look</option>
                      <option value="interact" ${act.verb === 'interact' ? 'selected' : ''}>Interact / Touch</option>
                      <option value="talk" ${act.verb === 'talk' ? 'selected' : ''}>Talk</option>
                      <option value="use" ${act.verb === 'use' ? 'selected' : ''}>Use Item</option>
                      <option value="pick_up" ${act.verb === 'pick_up' ? 'selected' : ''}>Pick Up</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size:0.65rem; color:var(--text-muted);">Action Text</label>
                    <input type="text" class="form-input act-text" data-hidx="${hIdx}" data-aidx="${aIdx}" value="${act.text || ''}" style="font-size:0.75rem;" />
                  </div>
                  ${act.verb === 'use' ? `
                    <div style="margin-top:4px;">
                      <label style="font-size:0.65rem; color:var(--text-muted);">Required Item ID</label>
                      <input type="text" class="form-input act-req-item" data-hidx="${hIdx}" data-aidx="${aIdx}" value="${act.requireItemId || ''}" style="font-size:0.75rem;" />
                    </div>
                  ` : ''}
                  ${act.targetSceneId ? `
                    <div style="margin-top:4px;">
                      <label style="font-size:0.65rem; color:var(--text-muted);">Target Scene ID</label>
                      <input type="text" class="form-input act-target-scene" data-hidx="${hIdx}" data-aidx="${aIdx}" value="${act.targetSceneId || ''}" style="font-size:0.75rem;" />
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getItemsHTML(): string {
    if (!this.project) return '';
    return `
      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Inventory Items (${this.project.items.length})</div>
          <button class="btn btn-primary" id="btn-add-item" style="font-size:0.75rem; padding:4px 8px;">+ Add Item</button>
        </div>
        ${this.project.items.map((item, idx) => `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <input type="text" class="form-input item-name" data-idx="${idx}" value="${item.name}" style="font-weight:700; font-size:0.85rem; width:75%;" />
              <button class="btn btn-del-item" data-idx="${idx}" style="padding:2px 6px; font-size:0.7rem; color:#ef4444;">🗑️</button>
            </div>
            <div style="margin-top:4px;">
              <label style="font-size:0.65rem; color:var(--text-muted);">Item ID</label>
              <input type="text" class="form-input item-id" data-idx="${idx}" value="${item.id}" style="font-size:0.75rem;" />
            </div>
            <div style="margin-top:4px;">
              <label style="font-size:0.65rem; color:var(--text-muted);">Description</label>
              <input type="text" class="form-input item-desc" data-idx="${idx}" value="${item.description}" style="font-size:0.75rem;" />
            </div>
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
      </div>
    `;
  }

  private attachEvents(): void {
    if (!this.project || !this.currentScene) return;

    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Scene fields
    this.element.querySelector('#sc-name')?.addEventListener('input', (e) => {
      this.currentScene!.name = (e.target as HTMLInputElement).value;
      emitUpdate();
    });
    this.element.querySelector('#sc-w')?.addEventListener('change', (e) => {
      this.currentScene!.width = parseInt((e.target as HTMLInputElement).value) || 1920;
      emitUpdate();
    });
    this.element.querySelector('#sc-h')?.addEventListener('change', (e) => {
      this.currentScene!.height = parseInt((e.target as HTMLInputElement).value) || 1080;
      emitUpdate();
    });

    // Add Layer
    this.element.querySelector('#btn-add-layer')?.addEventListener('click', () => {
      this.currentScene!.layers.push({
        id: `layer_${Date.now()}`,
        name: 'New Layer',
        imageUrl: 'procedural:lab_background',
        parallaxX: 1.0,
        parallaxY: 1.0,
        zIndex: this.currentScene!.layers.length + 1,
        opacity: 1,
        visible: true
      });
      this.renderContent();
      emitUpdate();
    });

    // Layer file upload
    this.element.querySelectorAll('.layer-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              this.currentScene!.layers[idx].imageUrl = ev.target.result as string;
              this.renderContent();
              emitUpdate();
            }
          };
          reader.readAsDataURL(files[0]);
        }
      });
    });

    // Delete Layer
    this.element.querySelectorAll('.btn-del-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
        this.currentScene!.layers.splice(idx, 1);
        this.renderContent();
        emitUpdate();
      });
    });

    // Add Hotspot
    this.element.querySelector('#btn-add-hotspot')?.addEventListener('click', () => {
      const newHs: HotspotData = {
        id: `hs_${Date.now()}`,
        name: 'New Hotspot',
        cursor: 'interact',
        enabled: true,
        points: [
          { x: 500, y: 500 },
          { x: 700, y: 500 },
          { x: 700, y: 700 },
          { x: 500, y: 700 }
        ],
        actions: [
          { verb: 'look', text: 'You see a mysterious object.' },
          { verb: 'interact', text: 'You interact with it.' }
        ]
      };
      this.currentScene!.hotspots.push(newHs);
      this.renderContent();
      emitUpdate();
    });

    // Delete Hotspot
    this.element.querySelectorAll('.btn-del-hs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.hidx!);
        this.currentScene!.hotspots.splice(idx, 1);
        this.renderContent();
        emitUpdate();
      });
    });

    // Add Item
    this.element.querySelector('#btn-add-item')?.addEventListener('click', () => {
      const newItem: InventoryItemData = {
        id: `item_${Date.now()}`,
        name: 'New Quest Item',
        description: 'A newly created quest item.',
        iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
      };
      this.project!.items.push(newItem);
      this.renderContent();
      emitUpdate();
    });

    // Delete Item
    this.element.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
        this.project!.items.splice(idx, 1);
        this.renderContent();
        emitUpdate();
      });
    });

    // Preset selector
    this.element.querySelector('#ui-preset-select')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as UIPresetType;
      EventBus.getInstance().emit('editor:change_preset', val);
    });
  }
}
