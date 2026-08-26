import { ProjectData, SceneData, HotspotData, LayerData, CharacterData, InventoryItemData, ChapterData, HotspotAction, AnimFrameRef } from '../../engine/types';
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

export function handleFileInputChange(file: File, callback: (url: string) => void): void {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result as string;
    if (result) callback(result);
  };
  reader.readAsDataURL(file);
}

export function getThumbnailHTML(url: string | undefined): string {
  if (!url) {
    return `<div class="inspector-thumbnail-box" title="No graphic loaded"><span style="font-size:1.1rem; opacity:0.3;">🖼️</span></div>`;
  }

  if (url.startsWith('procedural:')) {
    const type = url.replace('procedural:', '');
    let bg = '#3b82f6';
    let icon = '🎨';
    if (type.includes('shrub')) { bg = '#15803d'; icon = '🌿'; }
    else if (type.includes('lab')) { bg = '#581c87'; icon = '🧪'; }
    else if (type.includes('castle')) { bg = '#334155'; icon = '🏰'; }
    else if (type.includes('cauldron')) { bg = '#065f46'; icon = '🥣'; }
    else if (type.includes('hero') || type.includes('npc')) { bg = '#1e3a8a'; icon = '👤'; }
    return `<div class="inspector-thumbnail-box" style="background:${bg};" title="${url}"><span style="font-size:1.1rem;">${icon}</span></div>`;
  }

  const resolved = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')
    ? url
    : `src/demo/${url.replace(/^\/+/, '')}`;
  return `
    <div class="inspector-thumbnail-box" title="${url}">
      <img src="${resolved}" style="width:100%; height:100%; object-fit:contain;" onerror="this.onerror=null; this.outerHTML='<span style=\\'font-size:0.9rem; color:#ef4444;\\'>⚠️</span>';" />
    </div>
  `;
}

export function getVerbIcon(verb: string): string {
  switch (verb) {
    case 'look': return '👁️';
    case 'interact': return '🖐️';
    case 'talk': return '💬';
    case 'use': return '🔑';
    case 'pick_up': return '🎒';
    default: return '⚡';
  }
}

export function getConditionHumanText(act: HotspotAction): string {
  if (act.requiredFlag) return `✅ [${act.requiredFlag}]`;
  if (act.notFlag) return `❌ NOT [${act.notFlag}]`;
  return '✨ ALWAYS';
}

export function getOutcomesSummary(act: HotspotAction): string {
  const outcomes: string[] = [];
  if (act.text) outcomes.push('💬 Text');
  if (act.giveItemId) outcomes.push(`🎁 ${act.giveItemId}`);
  if (act.setFlag) outcomes.push(`🚩 ${act.setFlag}`);
  if (act.targetSceneId) outcomes.push(`🚪 Scene`);
  if (act.dialogId) outcomes.push(`💬 Dialog`);
  return outcomes.length > 0 ? outcomes.join(' + ') : 'None';
}

export class Inspector {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private currentScene: SceneData | null = null;
  private selectedTarget: SelectionTarget | null = null;
  private activeSubTab: 'properties' | 'interactions' | 'dialogs' = 'properties';

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-sidebar';
    this.render();

    // Listen to selection events
    EventBus.getInstance().on('editor:select_target', (target: SelectionTarget) => {
      this.selectedTarget = target;
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_scene', (sceneId: string) => {
      if (this.project) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) this.currentScene = sc;
      }
      this.selectedTarget = { type: 'scene', id: sceneId };
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_walkpath', (sceneId: string) => {
      this.selectedTarget = { type: 'walkpath', sceneId };
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_layer', (id: string) => {
      this.selectedTarget = { type: 'layer', id };
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_hotspot', (id: string) => {
      this.selectedTarget = { type: 'hotspot', id };
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_character', (id: string) => {
      this.selectedTarget = { type: 'character', id };
      this.activeSubTab = 'properties';
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_item', (id: string) => {
      this.selectedTarget = { type: 'item', id };
      this.activeSubTab = 'properties';
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
          <div style="display:flex; gap:8px; align-items:center;">
            ${getThumbnailHTML(bgUrl)}
            <input type="text" class="form-input" id="sc-bg-url" value="${bgUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;" title="Choose Background File">
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
        </div>
        <div style="display:flex; gap:6px; margin-bottom:8px;">
          <button class="btn btn-primary" id="btn-draw-wp-scratch" style="flex:1; font-size:0.75rem; padding:4px 6px;">✏️ Draw From Scratch</button>
          <button class="btn btn-primary" id="btn-add-wp-pt" style="font-size:0.75rem; padding:4px 6px;">+ Point</button>
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
    const actionsCount = hs.actions.length;
    const linkedDialog = hs.actions.find(a => a.dialogId)?.dialogId;
    const dialogsCount = linkedDialog ? 1 : 0;

    const subtabsHTML = `
      <div class="inspector-subtabs">
        <button class="inspector-subtab-btn ${this.activeSubTab === 'properties' ? 'active' : ''}" data-tab="properties">⚙️ Properties</button>
        <button class="inspector-subtab-btn ${this.activeSubTab === 'interactions' ? 'active' : ''}" data-tab="interactions">⚡ Actions (${actionsCount})</button>
        <button class="inspector-subtab-btn ${this.activeSubTab === 'dialogs' ? 'active' : ''}" data-tab="dialogs">💬 Dialogs (${dialogsCount})</button>
      </div>
    `;

    if (this.activeSubTab === 'interactions') {
      return subtabsHTML + this.getInteractionsTabHTML(hIdx, hs.actions, false);
    } else if (this.activeSubTab === 'dialogs') {
      return subtabsHTML + this.getDialogsTabHTML(linkedDialog);
    }

    const posX = hs.position ? hs.position.x : Math.round(hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1));
    const posY = hs.position ? hs.position.y : Math.round(hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1));

    return subtabsHTML + `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Object Name</label>
          <input type="text" class="form-input single-hs-name" data-hidx="${hIdx}" value="${hs.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Graphic Image Path / Upload</label>
          <div style="display:flex; gap:8px; align-items:center;">
            ${getThumbnailHTML(hs.imageUrl)}
            <input type="text" class="form-input single-hs-img-url" data-hidx="${hIdx}" value="${hs.imageUrl || ''}" placeholder="None (Invisible Polygon)" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;" title="Upload custom graphic">
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Polygon Vertices (${hs.points.length})</div>
        </div>
        <div style="display:flex; gap:6px; margin-bottom:8px;">
          <button class="btn btn-primary btn-draw-hs-scratch" data-hidx="${hIdx}" style="flex:1; font-size:0.75rem; padding:4px 6px;">✏️ Draw From Scratch</button>
          <button class="btn btn-primary" id="btn-add-hs-pt" data-hidx="${hIdx}" style="font-size:0.75rem; padding:4px 6px;">+ Point</button>
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

  private getCharacterHTML(scene: SceneData, char: CharacterData): string {
    const cIdx = scene.characters.indexOf(char);
    const actions = char.actions || [];
    const actionsCount = actions.length;
    const linkedDialog = actions.find(a => a.dialogId)?.dialogId || `dlg_${char.id.replace('npc_', '')}`;
    const hasDialog = this.project?.dialogs.some(d => d.id === linkedDialog);
    const dialogsCount = hasDialog ? 1 : 0;

    const subtabsHTML = `
      <div class="inspector-subtabs">
        <button class="inspector-subtab-btn ${this.activeSubTab === 'properties' ? 'active' : ''}" data-tab="properties">⚙️ Properties</button>
        <button class="inspector-subtab-btn ${this.activeSubTab === 'interactions' ? 'active' : ''}" data-tab="interactions">⚡ Actions (${actionsCount})</button>
        <button class="inspector-subtab-btn ${this.activeSubTab === 'dialogs' ? 'active' : ''}" data-tab="dialogs">💬 Dialogs (${dialogsCount})</button>
      </div>
    `;

    if (this.activeSubTab === 'interactions') {
      return subtabsHTML + this.getInteractionsTabHTML(cIdx, actions, true);
    } else if (this.activeSubTab === 'dialogs') {
      return subtabsHTML + this.getDialogsTabHTML(linkedDialog);
    }

    return subtabsHTML + `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Character Name</label>
          <input type="text" class="form-input char-name" data-idx="${cIdx}" value="${char.name}" style="font-weight:700;" />
        </div>
        <div class="form-group">
          <label>Sprite Sheet Path / Upload</label>
          <div style="display:flex; gap:8px; align-items:center;">
            ${getThumbnailHTML(char.spriteSheetUrl)}
            <input type="text" class="form-input char-spritesheet" data-idx="${cIdx}" value="${char.spriteSheetUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;">
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

      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">🎬 Sprite Sheet Animation Clips (${Object.keys(char.animations || {}).length})</div>
          <button class="btn btn-primary btn-add-char-anim" data-idx="${cIdx}" style="font-size:0.7rem; padding:3px 6px;">+ Add Clip</button>
        </div>
        ${Object.entries(char.animations || {}).map(([key, val]) => {
          const framesStr = Array.isArray(val) ? val.join(',') : (val.frames || []).join(',');
          return `
            <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
              <input type="text" class="form-input char-anim-key" data-cidx="${cIdx}" data-oldkey="${key}" value="${key}" placeholder="Clip Name" style="font-size:0.75rem; flex:1; font-weight:600;" />
              <input type="text" class="form-input char-anim-frames" data-cidx="${cIdx}" data-animkey="${key}" value="${framesStr}" placeholder="0,1,2,3" style="font-size:0.75rem; flex:1;" />
              <button class="btn btn-gold btn-open-frame-picker" data-cidx="${cIdx}" data-animkey="${key}" style="font-size:0.65rem; padding:3px 6px;" title="Open Visual Grid Picker">🖼️ Pick</button>
              <button class="btn btn-del-char-anim" data-cidx="${cIdx}" data-animkey="${key}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private getInteractionsTabHTML(hIdx: number, actions: HotspotAction[], isCharacter = false): string {
    return `
      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Interaction Rules (${actions.length})</div>
          <button class="btn btn-primary ${isCharacter ? 'btn-add-char-action' : 'btn-add-hs-action'}" data-hidx="${hIdx}" style="font-size:0.7rem; padding:4px 8px;">+ Add Action Rule</button>
        </div>
        ${actions.length === 0 ? `
          <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:8px 0;">
            No interaction rules defined yet. Click "+ Add Action Rule" to create one.
          </div>
        ` : actions.map((act, aIdx) => `
          <div class="action-flow-card" style="padding:10px;">
            <!-- WHEN Section -->
            <div class="flow-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span class="flow-group-title">⚡ WHEN USER PERFORMS</span>
                <button class="btn btn-del-action" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕ Delete</button>
              </div>
              <select class="form-select act-verb" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; font-weight:700; color:var(--accent-gold);">
                <option value="look" ${act.verb === 'look' ? 'selected' : ''}>👁️ Look At</option>
                <option value="interact" ${act.verb === 'interact' ? 'selected' : ''}>🖐️ Interact / Touch</option>
                <option value="talk" ${act.verb === 'talk' ? 'selected' : ''}>💬 Talk To</option>
                <option value="use" ${act.verb === 'use' ? 'selected' : ''}>🔑 Use Item With</option>
                <option value="pick_up" ${act.verb === 'pick_up' ? 'selected' : ''}>🎒 Pick Up</option>
              </select>
              ${act.verb === 'use' ? `
                <div style="margin-top:6px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Required Item ID</label>
                  <input type="text" class="form-input act-req-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.requireItemId || ''}" placeholder="e.g. item_key" style="font-size:0.75rem;" />
                </div>
              ` : ''}
            </div>

            <!-- CONDITION Section: True/False toggle button + Flag name input (empty = ALWAYS) -->
            <div class="flow-group">
              <span class="flow-group-title">🔀 IF CONDITION (LEAVE FLAG EMPTY FOR ALWAYS)</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <button class="btn act-cond-toggle ${act.notFlag ? 'mode-false' : 'mode-true'}" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" title="Click to toggle between IF TRUE and IF FALSE">
                  ${act.notFlag ? '❌ FALSE' : '✅ TRUE'}
                </button>
                <input type="text" class="form-input act-flag-input" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.requiredFlag || act.notFlag || ''}" placeholder="Flag Name (e.g. player:hasKey)" style="flex:1; font-size:0.75rem;" />
              </div>
            </div>

            <!-- THEN Section -->
            <div class="flow-group">
              <span class="flow-group-title">🎬 THEN OUTCOMES</span>
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">💬 Speak Response Text</label>
                <input type="text" class="form-input act-text" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.text || ''}" placeholder="Character or narrator response..." style="font-size:0.75rem;" />
              </div>

              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🎭 Play Custom Animation Override</label>
                <input type="text" class="form-input act-play-anim" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.playAnimation || ''}" placeholder="e.g. pick_up, gesture, hold_key" style="font-size:0.75rem;" />
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                <div>
                  <label style="font-size:0.65rem; color:var(--text-muted);">🎁 Give Quest Item</label>
                  <input type="text" class="form-input act-give-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.giveItemId || ''}" placeholder="e.g. item_key" style="font-size:0.75rem;" />
                </div>
                <div>
                  <label style="font-size:0.65rem; color:var(--text-muted);">🚩 Set Story Flag</label>
                  <input type="text" class="form-input act-set-flag" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.setFlag || ''}" placeholder="e.g. hasKey" style="font-size:0.75rem;" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                <div>
                  <label style="font-size:0.65rem; color:var(--text-muted);">🚪 Teleport Scene</label>
                  <input type="text" class="form-input act-target-scene" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.targetSceneId || ''}" placeholder="None" style="font-size:0.75rem;" />
                </div>
                <div>
                  <label style="font-size:0.65rem; color:var(--text-muted);">💬 Trigger Dialogue</label>
                  <input type="text" class="form-input act-dialog-id" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.dialogId || ''}" placeholder="e.g. dlg_eldrin" style="font-size:0.75rem;" />
                </div>
              </div>

              <!-- Direct Shortcuts -->
              <div style="display:flex; gap:6px; margin-top:8px;">
                ${act.dialogId ? `
                  <button class="btn btn-gold btn-open-dialog-editor" data-dlgid="${act.dialogId}" style="flex:1; font-size:0.7rem; padding:4px;">
                    💬 Open Dialog Editor
                  </button>
                ` : ''}
                ${act.targetSceneId ? `
                  <button class="btn btn-primary btn-open-story-graph" style="flex:1; font-size:0.7rem; padding:4px;">
                    🕸️ Open Story Graph
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private getDialogsTabHTML(dialogId?: string): string {
    const dialog = dialogId ? this.project?.dialogs.find(d => d.id === dialogId) : undefined;
    if (!dialog) {
      return `
        <div class="sidebar-section">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px; font-style:italic;">
            No dialogue flow assigned to this element.
          </div>
          <button class="btn btn-primary btn-open-dialog-editor" style="width:100%; font-size:0.75rem; padding:8px;">
            💬 Open Specialized Dialog Editor
          </button>
        </div>
      `;
    }

    const startNode = dialog.nodes[dialog.startNodeId];
    const choices = startNode?.choices || [];

    return `
      <div class="sidebar-section">
        <div style="background:rgba(139, 92, 246, 0.08); border:1px solid var(--accent-purple); padding:10px; border-radius:8px; margin-bottom:12px;">
          <div style="font-weight:700; font-family:var(--font-heading); color:var(--accent-gold); font-size:0.85rem; margin-bottom:4px;">
            💬 ${dialog.title}
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:8px;">ID: <code>${dialog.id}</code></div>
          ${startNode ? `
            <div style="font-size:0.75rem; margin-bottom:6px;">
              <b>Speaker:</b> ${startNode.speaker}<br/>
              <b>Initial Line:</b> <i>"${startNode.text}"</i>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px;">
              <b>Player Options (${choices.length}):</b>
              <ul style="margin:4px 0 0 16px; padding:0;">
                ${choices.map(c => `<li>${c.text}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <button class="btn btn-gold btn-open-dialog-editor" data-dlgid="${dialog.id}" style="width:100%; font-size:0.8rem; padding:8px; font-weight:700;">
          💬 Open Specialized Dialog Editor
        </button>
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
          <div style="display:flex; gap:8px; align-items:center;">
            ${getThumbnailHTML(layer.imageUrl)}
            <input type="text" class="form-input single-layer-url" data-idx="${lIdx}" value="${layer.imageUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;" title="Choose File">
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
          <div style="display:flex; gap:8px; align-items:center;">
            ${getThumbnailHTML(item.iconUrl)}
            <input type="text" class="form-input item-icon-url" data-idx="${idx}" value="${item.iconUrl}" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;">
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

    // Sub-tabs switching
    this.element.querySelectorAll('.inspector-subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).dataset.tab as any;
        if (tab) {
          this.activeSubTab = tab;
          this.renderContent();
        }
      });
    });

    // Special Editor Modal Openers
    this.element.querySelectorAll('.btn-open-dialog-editor').forEach(btn => {
      btn.addEventListener('click', () => {
        EventBus.getInstance().emit('editor:toggle_dialog_editor');
      });
    });

    this.element.querySelectorAll('.btn-open-story-graph').forEach(btn => {
      btn.addEventListener('click', () => {
        EventBus.getInstance().emit('editor:toggle_story_graph');
      });
    });

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
          this.renderContent();
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

    // Action Adding
    this.element.querySelectorAll('.btn-add-hs-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (this.currentScene?.hotspots[hIdx]) {
          this.currentScene.hotspots[hIdx].actions.push({ verb: 'look', text: 'New action text.' });
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-add-char-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (this.currentScene?.characters[cIdx]) {
          if (!this.currentScene.characters[cIdx].actions) this.currentScene.characters[cIdx].actions = [];
          this.currentScene.characters[cIdx].actions!.push({ verb: 'talk', text: 'New speech response.' });
          this.renderContent();
          emitUpdate();
        }
      });
    });

    // Action Editing
    this.element.querySelectorAll('.act-verb').forEach(select => {
      select.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].verb = targetEl.value as any;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].text = targetEl.value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-cond-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLButtonElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          const act = actions[aIdx];
          const flagVal = act.requiredFlag || act.notFlag;
          if (act.notFlag) {
            // Switch to TRUE mode
            act.requiredFlag = flagVal;
            act.notFlag = undefined;
          } else {
            // Switch to FALSE mode
            act.notFlag = flagVal;
            act.requiredFlag = undefined;
          }
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-flag-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          const val = targetEl.value.trim() || undefined;
          const isFalseMode = actions[aIdx].notFlag !== undefined;
          if (!val) {
            actions[aIdx].requiredFlag = undefined;
            actions[aIdx].notFlag = undefined;
          } else if (isFalseMode) {
            actions[aIdx].notFlag = val;
            actions[aIdx].requiredFlag = undefined;
          } else {
            actions[aIdx].requiredFlag = val;
            actions[aIdx].notFlag = undefined;
          }
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-give-item').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].giveItemId = targetEl.value.trim() || undefined;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-req-item').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].requireItemId = targetEl.value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-target-scene').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].targetSceneId = targetEl.value;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-set-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].setFlag = targetEl.value;
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-dialog-id').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].dialogId = targetEl.value;
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.target as HTMLElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions.splice(aIdx, 1);
          this.renderContent();
          emitUpdate();
        }
      });
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

    // WalkPath polygon handlers
    this.element.querySelector('#btn-draw-wp-scratch')?.addEventListener('click', () => {
      EventBus.getInstance().emit('editor:start_draw_polygon', { targetType: 'walkpath' });
    });

    this.element.querySelector('#btn-add-wp-pt')?.addEventListener('click', () => {
      if (this.currentScene && this.currentScene.walkPaths[0]) {
        const wp = this.currentScene.walkPaths[0];
        const pts = wp.points;
        if (pts.length >= 2) {
          const last = pts[pts.length - 1];
          const first = pts[0];
          pts.push({ x: Math.round((last.x + first.x) / 2), y: Math.round((last.y + first.y) / 2) });
        } else {
          pts.push({ x: 500, y: 500 });
        }
        this.renderContent();
        emitUpdate();
      }
    });

    this.element.querySelectorAll('.btn-del-wp-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene && this.currentScene.walkPaths[0]) {
          const wp = this.currentScene.walkPaths[0];
          if (wp.points.length > 3) {
            wp.points.splice(idx, 1);
            this.renderContent();
            emitUpdate();
          } else {
            EventBus.getInstance().emit('ui:notify', '⚠️ WalkPath polygon must have at least 3 vertices.');
          }
        }
      });
    });

    // Hotspot polygon handlers
    this.element.querySelectorAll('.btn-draw-hs-scratch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        EventBus.getInstance().emit('editor:start_draw_polygon', { targetType: 'hotspot', hIdx });
      });
    });

    this.element.querySelectorAll('#btn-add-hs-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (this.currentScene && this.currentScene.hotspots[hIdx]) {
          const hs = this.currentScene.hotspots[hIdx];
          const pts = hs.points;
          if (pts.length >= 2) {
            const last = pts[pts.length - 1];
            const first = pts[0];
            pts.push({ x: Math.round((last.x + first.x) / 2), y: Math.round((last.y + first.y) / 2) });
          } else {
            pts.push({ x: 500, y: 500 });
          }
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-hs-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (this.currentScene && this.currentScene.hotspots[hIdx]) {
          const hs = this.currentScene.hotspots[hIdx];
          if (hs.points.length > 3) {
            hs.points.splice(idx, 1);
            this.renderContent();
            emitUpdate();
          } else {
            EventBus.getInstance().emit('ui:notify', '⚠️ Hotspot polygon must have at least 3 vertices.');
          }
        }
      });
    });

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
          this.renderContent();
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
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.single-layer-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const lIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.currentScene?.layers[lIdx]) {
          handleFileInputChange(files[0], (dataUrl) => {
            if (this.currentScene?.layers[lIdx]) {
              this.currentScene.layers[lIdx].imageUrl = dataUrl;
              this.renderContent();
              emitUpdate();
            }
          });
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
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.char-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.currentScene?.characters[cIdx]) {
          handleFileInputChange(files[0], (dataUrl) => {
            if (this.currentScene?.characters[cIdx]) {
              this.currentScene.characters[cIdx].spriteSheetUrl = dataUrl;
              this.renderContent();
              emitUpdate();
            }
          });
        }
      });
    });

    // Character Animation Clip Studio handlers
    this.element.querySelectorAll('.btn-add-char-anim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.idx!);
        const char = this.currentScene?.characters[cIdx];
        if (char) {
          if (!char.animations) char.animations = {};
          const newKey = `clip_${Object.keys(char.animations).length + 1}`;
          char.animations[newKey] = [0, 1, 2, 3];
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.char-anim-key').forEach(input => {
      input.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const cIdx = parseInt(targetEl.dataset.cidx!);
        const oldKey = targetEl.dataset.oldkey!;
        const newKey = targetEl.value.trim();
        const char = this.currentScene?.characters[cIdx];
        if (char && char.animations && newKey && oldKey !== newKey) {
          char.animations[newKey] = char.animations[oldKey];
          delete char.animations[oldKey];
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.char-anim-frames').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const cIdx = parseInt(targetEl.dataset.cidx!);
        const animKey = targetEl.dataset.animkey!;
        const char = this.currentScene?.characters[cIdx];
        if (char && char.animations && animKey) {
          const framesArr = targetEl.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          char.animations[animKey] = framesArr.length > 0 ? framesArr : [0];
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.btn-del-char-anim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.target as HTMLElement;
        const cIdx = parseInt(targetEl.dataset.cidx!);
        const animKey = targetEl.dataset.animkey!;
        const char = this.currentScene?.characters[cIdx];
        if (char && char.animations && animKey) {
          delete char.animations[animKey];
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.act-play-anim').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = isChar ? this.currentScene?.characters[hIdx]?.actions : this.currentScene?.hotspots[hIdx]?.actions;
        if (actions && actions[aIdx]) {
          actions[aIdx].playAnimation = targetEl.value.trim() || undefined;
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
          this.renderContent();
          emitUpdate();
        }
      });
    });

    this.element.querySelectorAll('.item-icon-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && this.project?.items[idx]) {
          handleFileInputChange(files[0], (dataUrl) => {
            if (this.project?.items[idx]) {
              this.project.items[idx].iconUrl = dataUrl;
              this.renderContent();
              emitUpdate();
            }
          });
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

    this.element.querySelectorAll('.btn-open-frame-picker').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLElement;
        const cIdx = parseInt(targetEl.dataset.cidx!);
        const animKey = targetEl.dataset.animkey!;
        this.openSpriteFramePicker(cIdx, animKey);
      });
    });

    const uiPreset = this.element.querySelector('#ui-preset') as HTMLSelectElement;
    if (uiPreset && this.project) {
      uiPreset.addEventListener('change', () => {
        const preset = uiPreset.value as any;
        EventBus.getInstance().emit('editor:change_preset', preset);
      });
    }
  }

  private openSpriteFramePicker(cIdx: number, animKey: string): void {
    if (!this.currentScene || !this.currentScene.characters[cIdx]) return;
    const char = this.currentScene.characters[cIdx];
    const anims = char.animations || {};
    const currentVal = anims[animKey];
    let rawFrames: AnimFrameRef[] = Array.isArray(currentVal) ? JSON.parse(JSON.stringify(currentVal)) : JSON.parse(JSON.stringify(currentVal?.frames || [0]));

    const overlay = document.createElement('div');
    overlay.className = 'sprite-picker-overlay';

    let gridW = char.frameWidth || 64;
    let gridH = char.frameHeight || 64;
    let gridOffsetX = char.gridOffsetX || 0;
    let gridOffsetY = char.gridOffsetY || 0;
    let showGridOverlay = true;
    let snapToGrid = true;
    let currentZoom = 1; // 1 = 100%, 2 = 200%, 4 = 400%
    let selectedFrameIndex = rawFrames.length > 0 ? 0 : -1;

    const rawUrl = char.spriteSheetUrl || '';
    const imgUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('/'))
      ? rawUrl
      : `src/demo/${rawUrl.replace(/^\/+/, '')}`;

    const otherClipKeys = Object.keys(anims).filter(k => k !== animKey);

    overlay.innerHTML = `
      <div class="sprite-picker-modal" style="width:980px; max-height:92vh;">
        <div class="sprite-picker-header">
          <span>🖼️ Visual Frame Studio - ${char.name} (${animKey})</span>
          <button class="btn btn-del-action" id="btn-close-sprite-picker" style="font-size:0.8rem; padding:4px 8px;">✕ Close</button>
        </div>

        <!-- Studio Control Bar -->
        <div style="padding:10px 16px; background:#0f172a; border-bottom:1px solid var(--panel-border); display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
          <!-- Grid Settings -->
          <div style="display:flex; align-items:center; gap:8px; font-size:0.75rem;">
            <span style="font-weight:700; color:var(--accent-gold);">Grid:</span>
            <input type="number" id="input-grid-w" value="${gridW}" style="width:46px; font-size:0.75rem; padding:2px 4px;" title="Grid Cell Width" /> x
            <input type="number" id="input-grid-h" value="${gridH}" style="width:46px; font-size:0.75rem; padding:2px 4px;" title="Grid Cell Height" />
            <span style="font-weight:700; color:var(--text-muted); margin-left:4px;">Offset:</span>
            X:<input type="number" id="input-grid-off-x" value="${gridOffsetX}" style="width:40px; font-size:0.75rem; padding:2px 4px;" />
            Y:<input type="number" id="input-grid-off-y" value="${gridOffsetY}" style="width:40px; font-size:0.75rem; padding:2px 4px;" />
            
            <button class="btn ${showGridOverlay ? 'btn-gold' : 'btn-primary'}" id="btn-toggle-grid" style="font-size:0.7rem; padding:3px 8px;">
              ${showGridOverlay ? '👁️ Grid ON' : '🙈 Grid OFF'}
            </button>
            <button class="btn ${snapToGrid ? 'btn-gold' : 'btn-primary'}" id="btn-toggle-snap" style="font-size:0.7rem; padding:3px 8px;">
              ${snapToGrid ? '🧲 Snap ON' : '🔓 Snap OFF'}
            </button>
          </div>

          <!-- Zoom & Frame Duplicate Controls -->
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Zoom:</span>
            <button class="btn btn-primary btn-zoom" data-zoom="1" style="font-size:0.7rem; padding:2px 6px;">100%</button>
            <button class="btn btn-primary btn-zoom" data-zoom="2" style="font-size:0.7rem; padding:2px 6px;">200%</button>
            <button class="btn btn-primary btn-zoom" data-zoom="4" style="font-size:0.7rem; padding:2px 6px;">400%</button>

            <button class="btn btn-gold" id="btn-dup-frame-right" style="font-size:0.7rem; padding:3px 8px; margin-left:8px;">➕ Duplicate Right →</button>
            <button class="btn btn-gold" id="btn-dup-frame-down" style="font-size:0.7rem; padding:3px 8px;">➕ Duplicate Down ↓</button>
          </div>
        </div>

        <div class="sprite-picker-body" style="grid-template-columns: 1fr 320px;">
          <div>
            <div class="sprite-picker-grid-container" style="user-select:none; max-height:480px;">
              <div id="picker-zoom-wrapper" style="transform-origin:0 0; transition:transform 0.1s ease; display:inline-block;">
                <div id="picker-sheet-wrapper" style="position:relative; display:inline-block;">
                  <img id="picker-sheet-img" src="${imgUrl}" style="display:block; image-rendering:pixelated; pointer-events:none;" />
                  <div id="picker-grid-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair; pointer-events:auto;"></div>
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; background:rgba(15,23,42,0.5); padding:12px; border-radius:8px; border:1px solid var(--panel-border); overflow-y:auto; max-height:480px;">
            <div class="sidebar-section-title" style="margin-bottom:0;">Frames Sequence (${rawFrames.length})</div>
            <div id="picker-frames-list" style="display:flex; flex-direction:column; gap:4px; max-height:140px; overflow-y:auto;"></div>

            <!-- Selected Frame Edit & Pixel Nudging -->
            <div id="frame-edit-panel" style="background:rgba(30,41,59,0.9); padding:8px; border-radius:6px; border:1px solid var(--panel-border);">
              <div style="font-size:0.7rem; font-weight:700; color:var(--accent-gold); margin-bottom:6px;">
                🎯 Edit Frame #${selectedFrameIndex + 1} (Drag box or corner handle on image)
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:6px;">
                <div><label style="font-size:0.6rem; color:var(--text-muted);">X</label><input type="number" id="edit-frame-x" class="form-input" style="font-size:0.7rem;" /></div>
                <div><label style="font-size:0.6rem; color:var(--text-muted);">Y</label><input type="number" id="edit-frame-y" class="form-input" style="font-size:0.7rem;" /></div>
                <div><label style="font-size:0.6rem; color:var(--text-muted);">Width</label><input type="number" id="edit-frame-w" class="form-input" style="font-size:0.7rem;" /></div>
                <div><label style="font-size:0.6rem; color:var(--text-muted);">Height</label><input type="number" id="edit-frame-h" class="form-input" style="font-size:0.7rem;" /></div>
              </div>
              <!-- Pixel Nudge Buttons -->
              <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                <span style="font-size:0.65rem; color:var(--text-muted);">Nudge:</span>
                <button class="btn btn-primary btn-nudge" data-dir="left" style="font-size:0.65rem; padding:2px 6px;">◄ Left</button>
                <button class="btn btn-primary btn-nudge" data-dir="up" style="font-size:0.65rem; padding:2px 6px;">▲ Up</button>
                <button class="btn btn-primary btn-nudge" data-dir="down" style="font-size:0.65rem; padding:2px 6px;">▼ Down</button>
                <button class="btn btn-primary btn-nudge" data-dir="right" style="font-size:0.65rem; padding:2px 6px;">► Right</button>
              </div>
            </div>

            <!-- Copy Frames From Another Animation -->
            <div style="background:rgba(30,41,59,0.7); padding:8px; border-radius:6px; border:1px solid var(--panel-border);">
              <div style="font-size:0.7rem; font-weight:700; color:var(--accent-gold); margin-bottom:4px;">📋 Copy Frames From Clip</div>
              <div style="display:flex; gap:6px;">
                <select id="select-copy-clip" class="form-input" style="font-size:0.7rem; flex:1; padding:2px 4px;">
                  ${otherClipKeys.length > 0
                    ? otherClipKeys.map(k => `<option value="${k}">${k}</option>`).join('')
                    : '<option value="">(No other clips)</option>'}
                </select>
                <button class="btn btn-primary" id="btn-copy-clip-frames" style="font-size:0.7rem; padding:2px 8px;">📥 Copy</button>
              </div>
            </div>

            <div style="display:flex; gap:6px;">
              <button class="btn btn-primary" id="btn-picker-clear" style="flex:1; font-size:0.7rem;">🧹 Clear All</button>
              <button class="btn btn-gold" id="btn-picker-save" style="flex:1; font-size:0.7rem; font-weight:700;">💾 Save Clip</button>
            </div>

            <div style="margin-top:2px;">
              <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">Live Preview</div>
              <div style="width:100%; height:90px; background:#000; border-radius:6px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <canvas id="picker-preview-canvas" width="${gridW}" height="${gridH}" style="image-rendering:pixelated; width:${gridW * 1.5}px; height:${gridH * 1.5}px;"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const sheetImg = overlay.querySelector('#picker-sheet-img') as HTMLImageElement;
    const zoomWrapper = overlay.querySelector('#picker-zoom-wrapper') as HTMLElement;
    const gridOverlay = overlay.querySelector('#picker-grid-overlay') as HTMLElement;
    const framesListEl = overlay.querySelector('#picker-frames-list') as HTMLElement;
    const previewCanvas = overlay.querySelector('#picker-preview-canvas') as HTMLCanvasElement;
    const ctx = previewCanvas?.getContext('2d');

    const inputGridW = overlay.querySelector('#input-grid-w') as HTMLInputElement;
    const inputGridH = overlay.querySelector('#input-grid-h') as HTMLInputElement;
    const inputGridOffX = overlay.querySelector('#input-grid-off-x') as HTMLInputElement;
    const inputGridOffY = overlay.querySelector('#input-grid-off-y') as HTMLInputElement;
    const btnToggleGrid = overlay.querySelector('#btn-toggle-grid') as HTMLButtonElement;
    const btnToggleSnap = overlay.querySelector('#btn-toggle-snap') as HTMLButtonElement;

    const editFrameX = overlay.querySelector('#edit-frame-x') as HTMLInputElement;
    const editFrameY = overlay.querySelector('#edit-frame-y') as HTMLInputElement;
    const editFrameW = overlay.querySelector('#edit-frame-w') as HTMLInputElement;
    const editFrameH = overlay.querySelector('#edit-frame-h') as HTMLInputElement;

    let previewTimer: any = null;
    let previewIdx = 0;

    // Drag-to-draw rectangle state
    let isDrawingRect = false;
    let drawStartPos = { x: 0, y: 0 };
    let tempDrawRect: { x: number; y: number; w: number; h: number } | null = null;

    // Drag to move or resize selected box state
    let isMovingBox = false;
    let isResizingBox = false;
    let dragStartPos = { x: 0, y: 0 };
    let initialBoxRect = { x: 0, y: 0, w: gridW, h: gridH };

    const saveCharacterGridConfig = () => {
      char.frameWidth = gridW;
      char.frameHeight = gridH;
      char.gridOffsetX = gridOffsetX;
      char.gridOffsetY = gridOffsetY;
    };

    const snapVal = (val: number, step: number, offset: number): number => {
      if (!snapToGrid || step <= 0) return val;
      return offset + Math.round((val - offset) / step) * step;
    };

    const getFrameRect = (f: AnimFrameRef): { x: number; y: number; w: number; h: number } => {
      if (typeof f === 'object' && f !== null && 'x' in f) {
        return { x: f.x, y: f.y, w: f.w, h: f.h };
      }
      const idx = typeof f === 'number' ? f : 0;
      const nw = sheetImg.naturalWidth || 256;
      const cols = Math.max(1, Math.floor((nw - gridOffsetX) / gridW));
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      return { x: gridOffsetX + c * gridW, y: gridOffsetY + r * gridH, w: gridW, h: gridH };
    };

    const updateEditPanelInputs = () => {
      if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) {
        editFrameX.value = '0'; editFrameY.value = '0'; editFrameW.value = `${gridW}`; editFrameH.value = `${gridH}`;
        return;
      }
      const rect = getFrameRect(rawFrames[selectedFrameIndex]);
      editFrameX.value = `${rect.x}`;
      editFrameY.value = `${rect.y}`;
      editFrameW.value = `${rect.w}`;
      editFrameH.value = `${rect.h}`;
    };

    const renderFramesList = () => {
      framesListEl.innerHTML = rawFrames.map((f, i) => {
        const isSel = i === selectedFrameIndex;
        const rect = getFrameRect(f);
        return `
          <div class="frame-item-row" data-idx="${i}" style="display:flex; gap:4px; align-items:center; background:${isSel ? 'rgba(59,130,246,0.3)' : 'rgba(30,41,59,0.8)'}; border:${isSel ? '1px solid #3b82f6' : '1px solid transparent'}; padding:4px 6px; border-radius:4px; font-size:0.7rem; cursor:pointer;">
            <span style="color:${isSel ? '#3b82f6' : 'var(--accent-gold)'}; font-weight:700;">#${i + 1}</span>
            <span style="flex:1; font-family:monospace; font-size:0.65rem;">(${rect.x},${rect.y}, ${rect.w}x${rect.h})</span>
            <button class="btn btn-del-frame-item" data-idx="${i}" style="padding:1px 4px; font-size:0.65rem; color:#ef4444;">✕</button>
          </div>
        `;
      }).join('');

      framesListEl.querySelectorAll('.frame-item-row').forEach(row => {
        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).classList.contains('btn-del-frame-item')) return;
          selectedFrameIndex = parseInt((row as HTMLElement).dataset.idx!);
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
        });
      });

      framesListEl.querySelectorAll('.btn-del-frame-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
          rawFrames.splice(idx, 1);
          if (selectedFrameIndex >= rawFrames.length) selectedFrameIndex = rawFrames.length - 1;
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
          startPreview();
        });
      });
    };

    const renderOverlayBoxes = () => {
      if (!sheetImg.complete || !sheetImg.naturalWidth) return;
      const nw = sheetImg.naturalWidth;
      const nh = sheetImg.naturalHeight;
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const scaleX = dispW / nw;
      const scaleY = dispH / nh;

      gridOverlay.innerHTML = '';

      // Render customizable Grid Overlay lines if enabled
      if (showGridOverlay && gridW > 0 && gridH > 0) {
        const cols = Math.max(1, Math.floor((nw - gridOffsetX) / gridW));
        const rows = Math.max(1, Math.floor((nh - gridOffsetY) / gridH));

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const gridIdx = r * cols + c;
            const gridCell = document.createElement('div');
            gridCell.style.position = 'absolute';
            gridCell.style.left = `${(gridOffsetX + c * gridW) * scaleX}px`;
            gridCell.style.top = `${(gridOffsetY + r * gridH) * scaleY}px`;
            gridCell.style.width = `${gridW * scaleX}px`;
            gridCell.style.height = `${gridH * scaleY}px`;
            gridCell.style.border = '1px dashed rgba(255, 255, 255, 0.22)';
            gridCell.style.boxSizing = 'border-box';
            gridCell.style.pointerEvents = 'none';
            gridCell.style.fontSize = '0.55rem';
            gridCell.style.color = 'rgba(255,255,255,0.35)';
            gridCell.style.padding = '1px';
            gridCell.textContent = `#${gridIdx}`;
            gridOverlay.appendChild(gridCell);
          }
        }
      }

      // Render defined Frame Bounding Boxes
      rawFrames.forEach((f, i) => {
        const rect = getFrameRect(f);
        const isSel = i === selectedFrameIndex;

        const rectBox = document.createElement('div');
        rectBox.className = 'studio-frame-box';
        rectBox.style.position = 'absolute';
        rectBox.style.left = `${rect.x * scaleX}px`;
        rectBox.style.top = `${rect.y * scaleY}px`;
        rectBox.style.width = `${rect.w * scaleX}px`;
        rectBox.style.height = `${rect.h * scaleY}px`;
        rectBox.style.border = isSel ? '2px solid #3b82f6' : '2px solid var(--accent-gold)';
        rectBox.style.background = isSel ? 'rgba(59, 130, 246, 0.4)' : 'rgba(245, 158, 11, 0.25)';
        rectBox.style.boxSizing = 'border-box';
        rectBox.style.color = '#ffffff';
        rectBox.style.fontSize = '0.7rem';
        rectBox.style.fontWeight = '800';
        rectBox.style.padding = '2px 4px';
        rectBox.style.cursor = 'move';
        rectBox.style.borderRadius = '3px';
        rectBox.textContent = `#${i + 1}`;

        // Interactive Resize Handle on Selected Frame Box
        if (isSel) {
          const resizeHandle = document.createElement('div');
          resizeHandle.style.position = 'absolute';
          resizeHandle.style.right = '-6px';
          resizeHandle.style.bottom = '-6px';
          resizeHandle.style.width = '10px';
          resizeHandle.style.height = '10px';
          resizeHandle.style.background = '#3b82f6';
          resizeHandle.style.border = '1px solid #ffffff';
          resizeHandle.style.cursor = 'se-resize';
          resizeHandle.style.zIndex = '10';

          resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            selectedFrameIndex = i;
            isResizingBox = true;
            const overlayRect = gridOverlay.getBoundingClientRect();
            dragStartPos = {
              x: Math.round((e.clientX - overlayRect.left) * (nw / dispW)),
              y: Math.round((e.clientY - overlayRect.top) * (nh / dispH))
            };
            initialBoxRect = { ...rect };
          });

          rectBox.appendChild(resizeHandle);
        }

        rectBox.addEventListener('mousedown', (e) => {
          if (isResizingBox) return;
          e.stopPropagation();
          selectedFrameIndex = i;
          isMovingBox = true;
          const overlayRect = gridOverlay.getBoundingClientRect();
          dragStartPos = {
            x: Math.round((e.clientX - overlayRect.left) * (nw / dispW)),
            y: Math.round((e.clientY - overlayRect.top) * (nh / dispH))
          };
          initialBoxRect = { ...rect };
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
        });

        gridOverlay.appendChild(rectBox);
      });

      // Render live drag rectangle preview if drawing
      if (tempDrawRect) {
        const liveBox = document.createElement('div');
        liveBox.style.position = 'absolute';
        liveBox.style.left = `${tempDrawRect.x * scaleX}px`;
        liveBox.style.top = `${tempDrawRect.y * scaleY}px`;
        liveBox.style.width = `${tempDrawRect.w * scaleX}px`;
        liveBox.style.height = `${tempDrawRect.h * scaleY}px`;
        liveBox.style.border = '2px dashed #22c55e';
        liveBox.style.background = 'rgba(34, 197, 94, 0.3)';
        liveBox.style.boxSizing = 'border-box';
        liveBox.style.pointerEvents = 'none';
        gridOverlay.appendChild(liveBox);
      }
    };

    // Mouse Dragging to Draw, Move, or Resize
    gridOverlay.addEventListener('mousedown', (e) => {
      if (isMovingBox || isResizingBox) return;
      const rect = gridOverlay.getBoundingClientRect();
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const nw = sheetImg.naturalWidth || 1;
      const nh = sheetImg.naturalHeight || 1;
      const scaleX = nw / dispW;
      const scaleY = nh / dispH;

      const clickX = Math.round((e.clientX - rect.left) * scaleX);
      const clickY = Math.round((e.clientY - rect.top) * scaleY);

      isDrawingRect = true;
      drawStartPos = { x: clickX, y: clickY };
    });

    overlay.addEventListener('mousemove', (e) => {
      const rect = gridOverlay.getBoundingClientRect();
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const nw = sheetImg.naturalWidth || 1;
      const nh = sheetImg.naturalHeight || 1;
      const scaleX = nw / dispW;
      const scaleY = nh / dispH;

      const currentX = Math.round((e.clientX - rect.left) * scaleX);
      const currentY = Math.round((e.clientY - rect.top) * scaleY);

      if (isResizingBox && selectedFrameIndex >= 0 && selectedFrameIndex < rawFrames.length) {
        const dx = currentX - dragStartPos.x;
        const dy = currentY - dragStartPos.y;
        let newW = Math.max(5, initialBoxRect.w + dx);
        let newH = Math.max(5, initialBoxRect.h + dy);

        if (snapToGrid) {
          newW = Math.max(gridW, Math.round(newW / gridW) * gridW);
          newH = Math.max(gridH, Math.round(newH / gridH) * gridH);
        }

        rawFrames[selectedFrameIndex] = {
          x: initialBoxRect.x,
          y: initialBoxRect.y,
          w: newW,
          h: newH
        };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        return;
      }

      if (isMovingBox && selectedFrameIndex >= 0 && selectedFrameIndex < rawFrames.length) {
        const dx = currentX - dragStartPos.x;
        const dy = currentY - dragStartPos.y;
        let newX = Math.max(0, initialBoxRect.x + dx);
        let newY = Math.max(0, initialBoxRect.y + dy);

        if (snapToGrid) {
          newX = snapVal(newX, gridW, gridOffsetX);
          newY = snapVal(newY, gridH, gridOffsetY);
        }

        rawFrames[selectedFrameIndex] = {
          x: newX,
          y: newY,
          w: initialBoxRect.w,
          h: initialBoxRect.h
        };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        return;
      }

      if (isDrawingRect) {
        let x = Math.min(drawStartPos.x, currentX);
        let y = Math.min(drawStartPos.y, currentY);
        let w = Math.max(5, Math.abs(currentX - drawStartPos.x));
        let h = Math.max(5, Math.abs(currentY - drawStartPos.y));

        if (snapToGrid) {
          x = snapVal(x, gridW, gridOffsetX);
          y = snapVal(y, gridH, gridOffsetY);
          w = Math.max(gridW, Math.round(w / gridW) * gridW);
          h = Math.max(gridH, Math.round(h / gridH) * gridH);
        }

        tempDrawRect = { x, y, w, h };
        renderOverlayBoxes();
      }
    });

    overlay.addEventListener('mouseup', () => {
      if (isMovingBox || isResizingBox) {
        isMovingBox = false;
        isResizingBox = false;
        startPreview();
        return;
      }
      if (isDrawingRect && tempDrawRect) {
        rawFrames.push({ ...tempDrawRect });
        selectedFrameIndex = rawFrames.length - 1;
        tempDrawRect = null;
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
      }
      isDrawingRect = false;
    });

    // Zoom Buttons
    overlay.querySelectorAll('.btn-zoom').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const z = parseFloat((e.currentTarget as HTMLElement).dataset.zoom!);
        currentZoom = z;
        zoomWrapper.style.transform = `scale(${currentZoom})`;
      });
    });

    // Grid Inputs with Persistence
    inputGridW?.addEventListener('input', () => { gridW = parseInt(inputGridW.value) || 64; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridH?.addEventListener('input', () => { gridH = parseInt(inputGridH.value) || 64; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridOffX?.addEventListener('input', () => { gridOffsetX = parseInt(inputGridOffX.value) || 0; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridOffY?.addEventListener('input', () => { gridOffsetY = parseInt(inputGridOffY.value) || 0; saveCharacterGridConfig(); renderOverlayBoxes(); });

    btnToggleGrid?.addEventListener('click', () => {
      showGridOverlay = !showGridOverlay;
      btnToggleGrid.textContent = showGridOverlay ? '👁️ Grid ON' : '🙈 Grid OFF';
      btnToggleGrid.className = `btn ${showGridOverlay ? 'btn-gold' : 'btn-primary'}`;
      renderOverlayBoxes();
    });

    btnToggleSnap?.addEventListener('click', () => {
      snapToGrid = !snapToGrid;
      btnToggleSnap.textContent = snapToGrid ? '🧲 Snap ON' : '🔓 Snap OFF';
      btnToggleSnap.className = `btn ${snapToGrid ? 'btn-gold' : 'btn-primary'}`;
    });

    // Direct Frame Inputs
    const updateSelectedFrameFromEditInputs = () => {
      if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) return;
      const x = parseInt(editFrameX.value) || 0;
      const y = parseInt(editFrameY.value) || 0;
      const w = parseInt(editFrameW.value) || gridW;
      const h = parseInt(editFrameH.value) || gridH;
      rawFrames[selectedFrameIndex] = { x, y, w, h };
      renderFramesList();
      renderOverlayBoxes();
      startPreview();
    };

    editFrameX?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameY?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameW?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameH?.addEventListener('input', updateSelectedFrameFromEditInputs);

    // Pixel Nudge Buttons
    overlay.querySelectorAll('.btn-nudge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) return;
        const dir = (e.currentTarget as HTMLElement).dataset.dir;
        const rect = getFrameRect(rawFrames[selectedFrameIndex]);
        if (dir === 'left') rect.x = Math.max(0, rect.x - 1);
        if (dir === 'right') rect.x += 1;
        if (dir === 'up') rect.y = Math.max(0, rect.y - 1);
        if (dir === 'down') rect.y += 1;

        rawFrames[selectedFrameIndex] = { ...rect };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
      });
    });

    // Copy Frames From Another Animation Clip
    overlay.querySelector('#btn-copy-clip-frames')?.addEventListener('click', () => {
      const srcSelect = overlay.querySelector('#select-copy-clip') as HTMLSelectElement;
      const srcKey = srcSelect?.value;
      if (srcKey && anims[srcKey]) {
        const srcVal = anims[srcKey];
        const srcFrames = Array.isArray(srcVal) ? srcVal : (srcVal?.frames || [0]);
        rawFrames = JSON.parse(JSON.stringify(srcFrames));
        selectedFrameIndex = rawFrames.length > 0 ? 0 : -1;
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
        EventBus.getInstance().emit('ui:notify', `📋 Copied ${rawFrames.length} frames from clip '${srcKey}'!`);
      }
    });

    // Duplicate Next Frame Buttons
    overlay.querySelector('#btn-dup-frame-right')?.addEventListener('click', () => {
      if (rawFrames.length === 0) {
        rawFrames.push({ x: gridOffsetX, y: gridOffsetY, w: gridW, h: gridH });
      } else {
        const last = getFrameRect(rawFrames[rawFrames.length - 1]);
        rawFrames.push({ x: last.x + last.w, y: last.y, w: last.w, h: last.h });
      }
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    overlay.querySelector('#btn-dup-frame-down')?.addEventListener('click', () => {
      if (rawFrames.length === 0) {
        rawFrames.push({ x: gridOffsetX, y: gridOffsetY, w: gridW, h: gridH });
      } else {
        const last = getFrameRect(rawFrames[rawFrames.length - 1]);
        rawFrames.push({ x: last.x, y: last.y + last.h, w: last.w, h: last.h });
      }
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    const startPreview = () => {
      if (previewTimer) clearInterval(previewTimer);
      if (!ctx || rawFrames.length === 0 || !sheetImg.complete) return;

      previewIdx = 0;
      previewTimer = setInterval(() => {
        if (rawFrames.length === 0) return;
        const currentFrame = rawFrames[previewIdx % rawFrames.length];
        previewIdx++;

        const rect = getFrameRect(currentFrame);
        previewCanvas.width = rect.w;
        previewCanvas.height = rect.h;
        ctx.clearRect(0, 0, rect.w, rect.h);
        ctx.drawImage(sheetImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      }, 150);
    };

    sheetImg.onload = () => {
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    };
    if (sheetImg.complete) {
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    }

    overlay.querySelector('#btn-picker-clear')?.addEventListener('click', () => {
      rawFrames = [];
      selectedFrameIndex = -1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    overlay.querySelector('#btn-picker-save')?.addEventListener('click', () => {
      saveCharacterGridConfig();
      char.animations[animKey] = rawFrames.length > 0 ? rawFrames : [0];
      if (previewTimer) clearInterval(previewTimer);
      overlay.remove();
      this.renderContent();
      EventBus.getInstance().emit('editor:project_updated');
      EventBus.getInstance().emit('ui:notify', `💾 Saved clip '${animKey}' with ${rawFrames.length} frames!`);
    });

    overlay.querySelector('#btn-close-sprite-picker')?.addEventListener('click', () => {
      if (previewTimer) clearInterval(previewTimer);
      overlay.remove();
    });
  }
}
