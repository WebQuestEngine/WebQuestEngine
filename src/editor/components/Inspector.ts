import { ProjectData, SceneData, HotspotData, LayerData, CharacterData, InventoryItemData, ChapterData } from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';
import { EventBus } from '../../engine/core/EventBus';

export interface SelectionTarget {
  type: 'project' | 'chapter' | 'scene' | 'walkpath' | 'layer' | 'hotspot' | 'character' | 'item';
  id?: string;
  sceneId?: string;
}

export function normalizeImagePath(pathStr: string): string {
  if (!pathStr) return '';
  let normalized = pathStr.replace(/\\/g, '/');
  if (normalized.startsWith('file://')) normalized = normalized.replace(/^file:\/\//, '');
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:') || normalized.startsWith('procedural:')) {
    return normalized;
  }
  const demoIndex = normalized.indexOf('/demo/');
  if (demoIndex !== -1) return normalized.substring(demoIndex + 1);
  return normalized;
}

export function getRelativeFilePath(file: File): string {
  const fullPath = (file as any).path || '';
  if (fullPath) {
    AssetManager.getInstance().trackFileFolder(fullPath);
    return normalizeImagePath(fullPath);
  }
  if (file.webkitRelativePath && file.webkitRelativePath.trim() !== '') {
    AssetManager.getInstance().trackFileFolder(file.webkitRelativePath);
    return file.webkitRelativePath;
  }
  return file.name;
}

export class Inspector {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private currentScene: SceneData | null = null;
  private selectedTarget: SelectionTarget | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-sidebar';
    this.render();

    // Listen to selection events
    EventBus.getInstance().on('editor:select_target', (target: SelectionTarget) => {
      this.selectedTarget = target;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_scene', (sceneId: string) => {
      if (this.project) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) this.currentScene = sc;
      }
      this.selectedTarget = { type: 'scene', id: sceneId };
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_walkpath', (sceneId: string) => {
      this.selectedTarget = { type: 'walkpath', sceneId };
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_layer', (id: string) => {
      this.selectedTarget = { type: 'layer', id };
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_hotspot', (id: string) => {
      this.selectedTarget = { type: 'hotspot', id };
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_character', (id: string) => {
      this.selectedTarget = { type: 'character', id };
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_item', (id: string) => {
      this.selectedTarget = { type: 'item', id };
      this.renderContent();
    });
  }

  public setProject(project: ProjectData, currentScene?: SceneData): void {
    this.project = project;
    if (project.assetBasePath) {
      AssetManager.getInstance().setBaseFolder(project.assetBasePath);
    }
    if (currentScene) this.currentScene = currentScene;
    if (!this.selectedTarget && currentScene) {
      this.selectedTarget = { type: 'scene', id: currentScene.id };
    }
    this.renderContent();
  }

  public setCurrentScene(scene: SceneData): void {
    this.currentScene = scene;
    if (!this.selectedTarget || this.selectedTarget.type === 'scene') {
      this.selectedTarget = { type: 'scene', id: scene.id };
    }
    this.renderContent();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="inspector-header" id="inspector-header">
        <span>⚙️ Properties</span>
      </div>
      <div id="inspector-content" style="flex:1; overflow-y:auto;"></div>
    `;
  }

  private renderContent(): void {
    const header = this.element.querySelector('#inspector-header');
    const container = this.element.querySelector('#inspector-content');
    if (!container || !this.project) return;

    const target = this.selectedTarget || (this.currentScene ? { type: 'scene', id: this.currentScene.id } : { type: 'project' });

    if (target.type === 'scene') {
      const scene = this.project.scenes.find(s => s.id === (target.id || this.currentScene?.id)) || this.currentScene || this.project.scenes[0];
      if (header) header.innerHTML = `<span>🎬 Scene Properties: <b>${scene.name}</b></span>`;
      container.innerHTML = this.getSceneHTML(scene);
    } else if (target.type === 'walkpath') {
      const sceneId = target.sceneId || this.currentScene?.id || this.project.scenes[0].id;
      const scene = this.project.scenes.find(s => s.id === sceneId) || this.project.scenes[0];
      if (header) header.innerHTML = `<span>🚶 WalkPath Polygon: <b>${scene.name}</b></span>`;
      container.innerHTML = this.getWalkPathHTML(scene);
    } else if (target.type === 'hotspot') {
      let foundHs: HotspotData | undefined;
      let foundScene: SceneData | undefined;

      for (const sc of this.project.scenes) {
        const hs = sc.hotspots.find(h => h.id === target.id);
        if (hs) {
          foundHs = hs;
          foundScene = sc;
          break;
        }
      }

      if (foundHs && foundScene) {
        if (header) header.innerHTML = `<span>🎯 Object / Hotspot: <b>${foundHs.name}</b></span>`;
        container.innerHTML = this.getHotspotHTML(foundScene, foundHs);
      } else {
        container.innerHTML = '<div class="sidebar-section">Hotspot not found.</div>';
      }
    } else if (target.type === 'layer') {
      let foundLayer: LayerData | undefined;
      let foundScene: SceneData | undefined;

      for (const sc of this.project.scenes) {
        const l = sc.layers.find(ly => ly.id === target.id);
        if (l) {
          foundLayer = l;
          foundScene = sc;
          break;
        }
      }

      if (foundLayer && foundScene) {
        if (header) header.innerHTML = `<span>🖼️ Parallax Layer: <b>${foundLayer.name}</b></span>`;
        container.innerHTML = this.getLayerHTML(foundScene, foundLayer);
      } else {
        container.innerHTML = '<div class="sidebar-section">Layer not found.</div>';
      }
    } else if (target.type === 'character') {
      let foundChar: CharacterData | undefined;
      let foundScene: SceneData | undefined;

      for (const sc of this.project.scenes) {
        const c = sc.characters.find(char => char.id === target.id);
        if (c) {
          foundChar = c;
          foundScene = sc;
          break;
        }
      }

      if (foundChar && foundScene) {
        if (header) header.innerHTML = `<span>👤 Character: <b>${foundChar.name}</b></span>`;
        container.innerHTML = this.getCharacterHTML(foundScene, foundChar);
      } else {
        container.innerHTML = '<div class="sidebar-section">Character not found.</div>';
      }
    } else if (target.type === 'item') {
      const item = this.project.items.find(i => i.id === target.id);
      if (item) {
        if (header) header.innerHTML = `<span>🎒 Quest Item: <b>${item.name}</b></span>`;
        container.innerHTML = this.getItemHTML(item);
      } else {
        container.innerHTML = '<div class="sidebar-section">Item not found.</div>';
      }
    } else if (target.type === 'chapter') {
      const ch = this.project.chapters.find(c => c.id === target.id) || this.project.chapters[0];
      if (header) header.innerHTML = `<span>📖 Chapter: <b>${ch.title}</b></span>`;
      container.innerHTML = this.getChapterHTML(ch);
    } else {
      if (header) header.innerHTML = `<span>⚙️ Project Configuration</span>`;
      container.innerHTML = this.getProjectHTML();
    }

    this.attachEvents();
  }

  private getSceneHTML(scene: SceneData): string {
    const bgUrl = scene.layers[0]?.imageUrl || '';
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Scene Name</label>
          <input type="text" class="form-input" id="sc-name" value="${scene.name}" />
        </div>
        <div class="form-group">
          <label>Scene ID</label>
          <input type="text" class="form-input" id="sc-id" value="${scene.id}" readonly style="opacity:0.7;" />
        </div>
        <div class="form-group">
          <label>Background Image Path / Upload</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-input" id="sc-bg-url" value="${bgUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose Background File">
              📁
              <input type="file" id="sc-bg-file" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Base Asset Folder</label>
          <input type="text" class="form-input" id="base-folder-input" value="${this.project?.assetBasePath || ''}" placeholder="e.g. src/demo or assets" />
        </div>
      </div>
      <div class="sidebar-section">
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary" id="btn-add-layer" style="flex:1; font-size:0.75rem;">+ Add Layer</button>
          <button class="btn btn-primary" id="btn-add-hotspot" style="flex:1; font-size:0.75rem;">+ Add Object</button>
        </div>
      </div>
    `;
  }

  private getWalkPathHTML(scene: SceneData): string {
    const wp = scene.walkPaths[0] || { scaling: { minY: 400, maxY: 1080, minScale: 0.6, maxScale: 1.2 }, points: [] };
    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Perspective Scaling</div>
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Walk Polygon Vertices (${wp.points.length})</div>
          <button class="btn btn-primary" id="btn-add-wp-pt" style="font-size:0.7rem; padding:3px 6px;">+ Point</button>
        </div>
        ${wp.points.map((pt, i) => `
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
            <span style="font-size:0.75rem; color:var(--text-muted); width:24px;">#${i + 1}</span>
            <input type="number" class="form-input wp-pt-x" data-idx="${i}" value="${pt.x}" style="font-size:0.75rem;" />
            <input type="number" class="form-input wp-pt-y" data-idx="${i}" value="${pt.y}" style="font-size:0.75rem;" />
            <button class="btn btn-del-wp-pt" data-idx="${i}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getHotspotHTML(scene: SceneData, hs: HotspotData): string {
    const hIdx = scene.hotspots.indexOf(hs);
    const posX = hs.position ? hs.position.x : Math.round(hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1));
    const posY = hs.position ? hs.position.y : Math.round(hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1));

    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Object Name</label>
          <input type="text" class="form-input single-hs-name" data-hidx="${hIdx}" value="${hs.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Graphic Image Path / Upload</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-input single-hs-img-url" data-hidx="${hIdx}" value="${hs.imageUrl || ''}" placeholder="None (Invisible Polygon)" style="flex:1;" />
            <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Upload custom graphic">
              📁
              <input type="file" class="single-hs-file-input" data-hidx="${hIdx}" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position X</label>
            <input type="number" class="form-input single-hs-pos-x" data-hidx="${hIdx}" value="${posX}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position Y</label>
            <input type="number" class="form-input single-hs-pos-y" data-hidx="${hIdx}" value="${posY}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Scale X</label>
            <input type="number" step="0.05" class="form-input single-hs-scale-x" data-hidx="${hIdx}" value="${hs.scaleX ?? 1}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Scale Y</label>
            <input type="number" step="0.05" class="form-input single-hs-scale-y" data-hidx="${hIdx}" value="${hs.scaleY ?? 1}" />
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Cursor Context</label>
          <input type="text" class="form-input single-hs-cursor" data-hidx="${hIdx}" value="${hs.cursor}" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Required Flag</label>
            <input type="text" class="form-input single-hs-req-flag" data-hidx="${hIdx}" value="${hs.requiredFlag || ''}" placeholder="None" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Not Flag</label>
            <input type="text" class="form-input single-hs-not-flag" data-hidx="${hIdx}" value="${hs.notFlag || ''}" placeholder="None" />
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Interaction Actions</div>
          <button class="btn btn-primary" id="btn-add-hs-action" data-hidx="${hIdx}" style="font-size:0.7rem; padding:3px 6px;">+ Action</button>
        </div>
        ${hs.actions.map((act, aIdx) => `
          <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:8px; border-radius:6px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; gap:6px; margin-bottom:4px;">
              <select class="form-select act-verb" data-hidx="${hIdx}" data-aidx="${aIdx}" style="font-size:0.75rem; flex:1;">
                <option value="look" ${act.verb === 'look' ? 'selected' : ''}>Look</option>
                <option value="interact" ${act.verb === 'interact' ? 'selected' : ''}>Interact / Touch</option>
                <option value="talk" ${act.verb === 'talk' ? 'selected' : ''}>Talk</option>
                <option value="use" ${act.verb === 'use' ? 'selected' : ''}>Use Item</option>
                <option value="pick_up" ${act.verb === 'pick_up' ? 'selected' : ''}>Pick Up</option>
              </select>
              <button class="btn btn-del-action" data-hidx="${hIdx}" data-aidx="${aIdx}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
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

      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Polygon Vertices (${hs.points.length})</div>
          <button class="btn btn-primary" id="btn-add-hs-pt" data-hidx="${hIdx}" style="font-size:0.7rem; padding:3px 6px;">+ Point</button>
        </div>
        ${hs.points.map((pt, i) => `
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
            <span style="font-size:0.75rem; color:var(--text-muted); width:24px;">#${i + 1}</span>
            <input type="number" class="form-input hs-pt-x" data-hidx="${hIdx}" data-idx="${i}" value="${pt.x}" style="font-size:0.75rem;" />
            <input type="number" class="form-input hs-pt-y" data-hidx="${hIdx}" data-idx="${i}" value="${pt.y}" style="font-size:0.75rem;" />
            <button class="btn btn-del-hs-pt" data-hidx="${hIdx}" data-idx="${i}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getLayerHTML(scene: SceneData, layer: LayerData): string {
    const lIdx = scene.layers.indexOf(layer);
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Layer Name</label>
          <input type="text" class="form-input single-layer-name" data-idx="${lIdx}" value="${layer.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Image Path / Upload</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-input single-layer-url" data-idx="${lIdx}" value="${layer.imageUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose File">
              📁
              <input type="file" class="single-layer-file" data-idx="${lIdx}" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position X</label>
            <input type="number" class="form-input single-layer-x" data-idx="${lIdx}" value="${layer.x || 0}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position Y</label>
            <input type="number" class="form-input single-layer-y" data-idx="${lIdx}" value="${layer.y || 0}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Scale X</label>
            <input type="number" step="0.05" class="form-input single-layer-scalex" data-idx="${lIdx}" value="${layer.scaleX ?? 1}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Scale Y</label>
            <input type="number" step="0.05" class="form-input single-layer-scaley" data-idx="${lIdx}" value="${layer.scaleY ?? 1}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Parallax X</label>
            <input type="number" step="0.1" class="form-input single-layer-parallaxx" data-idx="${lIdx}" value="${layer.parallaxX}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Parallax Y</label>
            <input type="number" step="0.1" class="form-input single-layer-parallaxy" data-idx="${lIdx}" value="${layer.parallaxY}" />
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Opacity (${Math.round(layer.opacity * 100)}%)</label>
          <input type="range" min="0" max="1" step="0.05" class="single-layer-opacity" data-idx="${lIdx}" value="${layer.opacity}" style="width:100%;" />
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-toggle-vis" data-idx="${lIdx}" style="font-size:0.75rem;">
            ${layer.visible ? '👁️ Visible' : '🙈 Hidden'}
          </button>
          <button class="btn btn-del-layer" data-idx="${lIdx}" style="font-size:0.75rem; color:#ef4444;">🗑️ Delete Layer</button>
        </div>
      </div>
    `;
  }

  private getCharacterHTML(scene: SceneData, char: CharacterData): string {
    const cIdx = scene.characters.indexOf(char);
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Character Name</label>
          <input type="text" class="form-input char-name" data-idx="${cIdx}" value="${char.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Sprite Sheet Path / Upload</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-input char-spritesheet" data-idx="${cIdx}" value="${char.spriteSheetUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;">
              📁
              <input type="file" class="char-file-input" data-idx="${cIdx}" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position X</label>
            <input type="number" class="form-input char-pos-x" data-idx="${cIdx}" value="${char.position.x}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Position Y</label>
            <input type="number" class="form-input char-pos-y" data-idx="${cIdx}" value="${char.position.y}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Scale</label>
            <input type="number" step="0.05" class="form-input char-scale" data-idx="${cIdx}" value="${char.scale}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Speed</label>
            <input type="number" class="form-input char-speed" data-idx="${cIdx}" value="${char.speed}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Frame Width</label>
            <input type="number" class="form-input char-fw" data-idx="${cIdx}" value="${char.frameWidth}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Frame Height</label>
            <input type="number" class="form-input char-fh" data-idx="${cIdx}" value="${char.frameHeight}" />
          </div>
        </div>
      </div>
    `;
  }

  private getItemHTML(item: InventoryItemData): string {
    const idx = this.project?.items.indexOf(item) ?? 0;
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Item Name</label>
          <input type="text" class="form-input item-name" data-idx="${idx}" value="${item.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Item ID</label>
          <input type="text" class="form-input item-id" data-idx="${idx}" value="${item.id}" readonly style="opacity:0.7;" />
        </div>
        <div class="form-group">
          <label>Icon Path / Upload</label>
          <div style="display:flex; gap:6px;">
            <input type="text" class="form-input item-icon-url" data-idx="${idx}" value="${item.iconUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;">
              📁
              <input type="file" class="item-icon-file" data-idx="${idx}" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-input item-desc" data-idx="${idx}" style="height:60px;">${item.description}</textarea>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-del-item" data-idx="${idx}" style="font-size:0.75rem; color:#ef4444;">🗑️ Delete Item</button>
        </div>
      </div>
    `;
  }

  private getChapterHTML(ch: ChapterData): string {
    const idx = this.project?.chapters.indexOf(ch) ?? 0;
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Chapter Title</label>
          <input type="text" class="form-input ch-title" data-idx="${idx}" value="${ch.title}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Chapter ID</label>
          <input type="text" class="form-input" value="${ch.id}" readonly style="opacity:0.7;" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-input ch-desc" data-idx="${idx}" style="height:60px;">${ch.description || ''}</textarea>
        </div>
      </div>
    `;
  }

  private getProjectHTML(): string {
    if (!this.project) return '';
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="form-input" id="proj-title" value="${this.project.title}" />
        </div>
        <div class="form-group">
          <label>UI Layout Preset</label>
          <select class="form-select" id="ui-preset">
            <option value="sierra" ${this.project.uiConfig.preset === 'sierra' ? 'selected' : ''}>Sierra Top Icon Bar</option>
            <option value="lucasarts" ${this.project.uiConfig.preset === 'lucasarts' ? 'selected' : ''}>LucasArts 9-Verbs Grid</option>
            <option value="context_coin" ${this.project.uiConfig.preset === 'context_coin' ? 'selected' : ''}>Curse of Monkey Island Pop-up Coin</option>
            <option value="direct_cursor" ${this.project.uiConfig.preset === 'direct_cursor' ? 'selected' : ''}>Direct Action Cursor Cycle</option>
          </select>
        </div>
        <div class="form-group">
          <label>Base Asset Folder</label>
          <input type="text" class="form-input" id="proj-base-folder" value="${this.project.assetBasePath || ''}" placeholder="e.g. src/demo or assets" />
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    // Scene events
    const scName = this.element.querySelector('#sc-name') as HTMLInputElement;
    if (scName && this.currentScene) {
      scName.addEventListener('input', () => {
        this.currentScene!.name = scName.value;
        emitUpdate();
      });
    }

    const scBgUrl = this.element.querySelector('#sc-bg-url') as HTMLInputElement;
    if (scBgUrl && this.currentScene) {
      scBgUrl.addEventListener('input', () => {
        if (this.currentScene!.layers[0]) {
          this.currentScene!.layers[0].imageUrl = normalizeImagePath(scBgUrl.value);
        }
        emitUpdate();
      });
    }

    const scBgFile = this.element.querySelector('#sc-bg-file') as HTMLInputElement;
    if (scBgFile && this.currentScene) {
      scBgFile.addEventListener('change', () => {
        if (scBgFile.files && scBgFile.files[0]) {
          const relPath = getRelativeFilePath(scBgFile.files[0]);
          if (this.currentScene!.layers[0]) {
            this.currentScene!.layers[0].imageUrl = relPath;
          }
          if (scBgUrl) scBgUrl.value = relPath;
          emitUpdate();
        }
      });
    }

    const baseFolderInput = this.element.querySelector('#base-folder-input') as HTMLInputElement;
    if (baseFolderInput && this.project) {
      baseFolderInput.addEventListener('input', () => {
        const val = baseFolderInput.value.trim();
        this.project!.assetBasePath = val;
        if (val) AssetManager.getInstance().setBaseFolder(val);
        emitUpdate();
      });
    }

    // Add Layer button
    this.element.querySelector('#btn-add-layer')?.addEventListener('click', () => {
      if (!this.currentScene) return;
      const newLayer: LayerData = {
        id: `layer_${Date.now()}`,
        name: `New Layer ${this.currentScene.layers.length + 1}`,
        imageUrl: 'procedural:shrub',
        parallaxX: 1,
        parallaxY: 1,
        zIndex: this.currentScene.layers.length,
        opacity: 1,
        visible: true
      };
      this.currentScene.layers.push(newLayer);
      this.selectedTarget = { type: 'layer', id: newLayer.id };
      this.renderContent();
      emitUpdate();
    });

    // Add Object button
    this.element.querySelector('#btn-add-hotspot')?.addEventListener('click', () => {
      if (!this.currentScene) return;
      const newHs: HotspotData = {
        id: `hs_${Date.now()}`,
        name: `New Object ${this.currentScene.hotspots.length + 1}`,
        cursor: 'interact',
        enabled: true,
        points: [
          { x: 500, y: 500 },
          { x: 700, y: 500 },
          { x: 700, y: 700 },
          { x: 500, y: 700 }
        ],
        actions: [
          { verb: 'look', text: 'You see a new object.' },
          { verb: 'interact', text: 'You interact with it.' }
        ]
      };
      this.currentScene.hotspots.push(newHs);
      this.selectedTarget = { type: 'hotspot', id: newHs.id };
      this.renderContent();
      emitUpdate();
    });

    // WalkPath events
    const wpMinY = this.element.querySelector('#wp-min-y') as HTMLInputElement;
    const wpMaxY = this.element.querySelector('#wp-max-y') as HTMLInputElement;
    const wpMinScale = this.element.querySelector('#wp-min-scale') as HTMLInputElement;
    const wpMaxScale = this.element.querySelector('#wp-max-scale') as HTMLInputElement;

    if (this.currentScene && this.currentScene.walkPaths[0]) {
      const wp = this.currentScene.walkPaths[0];
      wpMinY?.addEventListener('input', () => { wp.scaling.minY = parseFloat(wpMinY.value) || 0; emitUpdate(); });
      wpMaxY?.addEventListener('input', () => { wp.scaling.maxY = parseFloat(wpMaxY.value) || 0; emitUpdate(); });
      wpMinScale?.addEventListener('input', () => { wp.scaling.minScale = parseFloat(wpMinScale.value) || 0; emitUpdate(); });
      wpMaxScale?.addEventListener('input', () => { wp.scaling.maxScale = parseFloat(wpMaxScale.value) || 0; emitUpdate(); });
    }

    // Single Hotspot / Object inputs
    this.element.querySelectorAll('.single-hs-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (this.currentScene && this.currentScene.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].name = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-img-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const val = (e.target as HTMLInputElement).value;
        if (this.currentScene && this.currentScene.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].imageUrl = val ? normalizeImagePath(val) : undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.currentScene && this.currentScene.hotspots[hIdx]) {
          const relPath = getRelativeFilePath(files[0]);
          this.currentScene.hotspots[hIdx].imageUrl = relPath;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-pos-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const hs = this.currentScene?.hotspots[hIdx];
        if (hs) {
          const newX = parseFloat((e.target as HTMLInputElement).value) || 0;
          const currentX = hs.position ? hs.position.x : (hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1));
          const dx = newX - currentX;
          for (const pt of hs.points) { pt.x += dx; }
          if (!hs.position) hs.position = { x: newX, y: hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1) };
          else hs.position.x = newX;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-pos-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const hs = this.currentScene?.hotspots[hIdx];
        if (hs) {
          const newY = parseFloat((e.target as HTMLInputElement).value) || 0;
          const currentY = hs.position ? hs.position.y : (hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1));
          const dy = newY - currentY;
          for (const pt of hs.points) { pt.y += dy; }
          if (!hs.position) hs.position = { x: hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1), y: newY };
          else hs.position.y = newY;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-scale-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (this.currentScene?.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].scaleX = isNaN(val) ? 1 : val;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-scale-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (this.currentScene?.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].scaleY = isNaN(val) ? 1 : val;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-hs-cursor').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (this.currentScene?.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].cursor = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    // Single Layer inputs
    this.element.querySelectorAll('.single-layer-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.layers[lIdx]) {
          this.currentScene.layers[lIdx].name = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-layer-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.layers[lIdx]) {
          this.currentScene.layers[lIdx].imageUrl = normalizeImagePath((e.target as HTMLInputElement).value);
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-layer-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.currentScene?.layers[lIdx]) {
          const relPath = getRelativeFilePath(files[0]);
          this.currentScene.layers[lIdx].imageUrl = relPath;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-layer-opacity').forEach(input => {
      input.addEventListener('input', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.layers[lIdx]) {
          this.currentScene.layers[lIdx].opacity = parseFloat((e.target as HTMLInputElement).value);
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-toggle-vis').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.layers[lIdx]) {
          this.currentScene.layers[lIdx].visible = !this.currentScene.layers[lIdx].visible;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.layers[lIdx]) {
          this.currentScene.layers.splice(lIdx, 1);
          this.selectedTarget = { type: 'scene', id: this.currentScene.id };
          this.renderContent();
          emitUpdate();
        }
      });
    });

    // Character inputs
    this.element.querySelectorAll('.char-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.characters[cIdx]) {
          this.currentScene.characters[cIdx].name = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.char-spritesheet').forEach(input => {
      input.addEventListener('input', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene?.characters[cIdx]) {
          this.currentScene.characters[cIdx].spriteSheetUrl = normalizeImagePath((e.target as HTMLInputElement).value);
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.char-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.currentScene?.characters[cIdx]) {
          const relPath = getRelativeFilePath(files[0]);
          this.currentScene.characters[cIdx].spriteSheetUrl = relPath;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    // Item inputs
    this.element.querySelectorAll('.item-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.items[idx]) {
          this.project.items[idx].name = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.item-icon-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.items[idx]) {
          this.project.items[idx].iconUrl = normalizeImagePath((e.target as HTMLInputElement).value);
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.item-icon-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.project?.items[idx]) {
          const relPath = getRelativeFilePath(files[0]);
          this.project.items[idx].iconUrl = relPath;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.item-desc').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.items[idx]) {
          this.project.items[idx].description = (e.target as HTMLTextAreaElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.items[idx]) {
          this.project.items.splice(idx, 1);
          this.selectedTarget = { type: 'project' };
          this.renderContent();
          emitUpdate();
        }
      });
    });

    // Chapter inputs
    this.element.querySelectorAll('.ch-title').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.chapters[idx]) {
          this.project.chapters[idx].title = (e.target as HTMLInputElement).value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.ch-desc').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.project?.chapters[idx]) {
          this.project.chapters[idx].description = (e.target as HTMLTextAreaElement).value;
          emitUpdate();
        }
      });
    });

    // Project title & preset
    const projTitle = this.element.querySelector('#proj-title') as HTMLInputElement;
    if (projTitle && this.project) {
      projTitle.addEventListener('input', () => {
        this.project!.title = projTitle.value;
        emitUpdate();
      });
    }

    const uiPreset = this.element.querySelector('#ui-preset') as HTMLSelectElement;
    if (uiPreset && this.project) {
      uiPreset.addEventListener('change', () => {
        const preset = uiPreset.value as any;
        EventBus.getInstance().emit('editor:change_preset', preset);
      });
    }
  }
}
