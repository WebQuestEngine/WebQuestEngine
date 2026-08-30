import {
  ProjectData,
  SceneData,
  HotspotData,
  LayerData,
  CharacterData,
  InventoryItemData,
  ChapterData,
  HotspotAction,
  AnimFrameRef,
  VerbType
} from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';
import { EventBus } from '../../engine/core/EventBus';
import { VisualSpritePickerModal } from './VisualSpritePickerModal';
import { VisualCursorHotspotModal } from './VisualCursorHotspotModal';
import { VisualSpawnPickerModal } from './VisualSpawnPickerModal';
import {
  normalizeImagePath,
  AssetCategory,
  resolvePickedAssetPath,
  getRelativeFilePath,
  handleFileInputChange,
  getThumbnailHTML
} from '../utils/AssetPathUtils';
import { ProjectInspector } from './inspector/ProjectInspector';
import { SceneInspector } from './inspector/SceneInspector';
import {
  HotspotInspector,
  CharacterInspector,
  LayerInspector,
  ItemInspector,
  DialogTabInspector
} from './inspector/EntityInspectors';
import { ActionRulesInspector } from './inspector/ActionRulesInspector';

export {
  normalizeImagePath,
  resolvePickedAssetPath,
  getRelativeFilePath,
  handleFileInputChange,
  getThumbnailHTML
};
export type { AssetCategory };

export interface SelectionTarget {
  type: 'project' | 'chapter' | 'scene' | 'walkpath' | 'layer' | 'hotspot' | 'character' | 'item';
  id?: string;
  sceneId?: string;
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
  const outcomes: string[] = [];
  if (act.dialogId) outcomes.push(`💬 Dialog: ${act.dialogId}`);
  if (act.playAnimation) outcomes.push(`🎬 Anim: ${act.playAnimation}`);
  if (act.text) outcomes.push(`🗣️ "${act.text.length > 16 ? act.text.substring(0, 14) + '...' : act.text}"`);
  if (act.eventName) outcomes.push(`⚡ Event: ${act.eventName}`);
  if (act.targetSceneId) outcomes.push(`🚪 Teleport: ${act.targetSceneId}`);
  if (act.giveItemId) outcomes.push(`🎁 Item: ${act.giveItemId}`);
  if (act.setFlag) outcomes.push(`🚩 Flag: ${act.setFlag}`);
  if (act.clearFlag) outcomes.push(`🚩 Clear: ${act.clearFlag}`);
  if (act.sfxUrl) outcomes.push('🔊 SFX');
  return outcomes.length > 0 ? outcomes.join(' • ') : 'No outcomes';
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

    EventBus.getInstance().on('editor:project_updated', () => {
      if (document.activeElement && this.element.contains(document.activeElement)) {
        return;
      }
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

  public renderInspectorLockHeader(type: string, id?: string, sceneId?: string): string {
    const scene = sceneId ? this.project?.scenes.find(s => s.id === sceneId) : this.currentScene;
    let locked = false;

    if (type === 'chapter' && id) {
      locked = !!this.project?.chapters.find(c => c.id === id)?.locked;
    } else if (type === 'scene' && id) {
      const sc = this.project?.scenes.find(s => s.id === id);
      locked = !!sc?.locked || !!this.project?.chapters[0]?.locked;
    } else if (type === 'layer' && id) {
      locked = !!scene?.locked || !!this.project?.chapters[0]?.locked || !!scene?.layers.find(l => l.id === id)?.locked;
    } else if (type === 'hotspot' && id) {
      locked = !!scene?.locked || !!this.project?.chapters[0]?.locked || !!scene?.hotspots.find(h => h.id === id)?.locked;
    } else if (type === 'character' && id) {
      locked = !!scene?.locked || !!this.project?.chapters[0]?.locked || !!scene?.characters.find(c => c.id === id)?.locked;
    } else if (type === 'walkpath') {
      locked = !!scene?.locked || !!this.project?.chapters[0]?.locked || !!scene?.walkPaths[0]?.locked;
    }

    return `
      <div class="inspector-lock-banner" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding:8px 12px; background:${locked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; border:1px solid ${locked ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}; border-radius:6px;">
        <span style="font-weight:600; font-size:0.82rem; color:${locked ? '#f59e0b' : 'var(--text-main)'}; display:flex; align-items:center; gap:6px;">
          ${locked ? '🔒 Element is Locked (Read-Only)' : '🔓 Element is Editable'}
        </span>
        <button class="btn ${locked ? 'btn-secondary' : 'btn-primary'}" id="btn-toggle-inspector-lock" data-type="${type}" data-id="${id || ''}" data-sceneid="${sceneId || scene?.id || ''}" style="font-size:0.75rem; padding:4px 8px;">
          ${locked ? '🔓 Unlock' : '🔒 Lock'}
        </button>
      </div>
    `;
  }

  private renderContent(): void {
    const container = this.element.querySelector('#inspector-content');
    const header = this.element.querySelector('#inspector-header');
    if (!container || !this.project) return;

    const target = this.selectedTarget || (this.currentScene ? { type: 'scene', id: this.currentScene.id } : { type: 'project' });

    let contentHTML = '';

    if (target.type === 'scene') {
      const scene = this.project.scenes.find(s => s.id === (target.id || this.currentScene?.id)) || this.currentScene || this.project.scenes[0];
      if (header) header.innerHTML = `<span>🎬 Scene Properties: <b>${scene.name}</b></span>`;
      contentHTML = SceneInspector.getSceneHTML(scene, this.project, this.renderInspectorLockHeader('scene', scene.id));
    } else if (target.type === 'walkpath') {
      const sceneId = target.sceneId || this.currentScene?.id || this.project.scenes[0].id;
      const scene = this.project.scenes.find(s => s.id === sceneId) || this.project.scenes[0];
      if (header) header.innerHTML = `<span>🚶 WalkPath Polygon: <b>${scene.name}</b></span>`;
      contentHTML = SceneInspector.getWalkPathHTML(scene, this.renderInspectorLockHeader('walkpath', undefined, scene.id));
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
        contentHTML = this.renderInspectorLockHeader('hotspot', foundHs.id, foundScene.id) + HotspotInspector.getHTML({
          scene: foundScene,
          hs: foundHs,
          activeSubTab: this.activeSubTab,
          project: this.project
        });
      } else {
        contentHTML = '<div class="sidebar-section">Hotspot not found.</div>';
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
        contentHTML = this.renderInspectorLockHeader('layer', foundLayer.id, foundScene.id) + LayerInspector.getHTML(foundScene, foundLayer);
      } else {
        contentHTML = '<div class="sidebar-section">Layer not found.</div>';
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
        contentHTML = this.renderInspectorLockHeader('character', foundChar.id, foundScene.id) + CharacterInspector.getHTML({
          scene: foundScene,
          char: foundChar,
          activeSubTab: this.activeSubTab,
          project: this.project
        });
      } else {
        contentHTML = '<div class="sidebar-section">Character not found.</div>';
      }
    } else if (target.type === 'item') {
      const item = this.project.items.find(i => i.id === target.id);
      if (item) {
        if (header) header.innerHTML = `<span>🎒 Quest Item: <b>${item.name}</b></span>`;
        contentHTML = ItemInspector.getHTML(item, this.project);
      } else {
        contentHTML = '<div class="sidebar-section">Item not found.</div>';
      }
    } else if (target.type === 'chapter') {
      const ch = this.project.chapters.find(c => c.id === target.id) || this.project.chapters[0];
      if (header) header.innerHTML = `<span>📖 Chapter: <b>${ch.title}</b></span>`;
      contentHTML = ProjectInspector.getChapterHTML(ch, this.project, this.renderInspectorLockHeader('chapter', ch.id));
    } else {
      if (header) header.innerHTML = `<span>⚙️ Project Settings</span>`;
      contentHTML = ProjectInspector.getProjectHTML(this.project);
    }

    container.innerHTML = contentHTML;

    this.attachEvents();
  }

  private attachEvents(): void {
    const emitUpdate = () => {
      EventBus.getInstance().emit('editor:project_updated');
    };

    const reRender = () => {
      this.renderContent();
    };

    // Lock toggle button
    this.element.querySelector('#btn-toggle-inspector-lock')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      const sceneId = btn.dataset.sceneid;
      if (type) {
        EventBus.getInstance().emit('editor:toggle_lock', { type, id: id || undefined, sceneId: sceneId || undefined });
      }
    });

    // Subtab switching
    this.element.querySelectorAll('.inspector-subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).dataset.tab as any;
        if (tab) {
          this.activeSubTab = tab;
          this.renderContent();
        }
      });
    });

    // Dialog Editor Button
    this.element.querySelectorAll('.btn-open-dialog-editor').forEach(btn => {
      btn.addEventListener('click', () => {
        EventBus.getInstance().emit('editor:toggle_dialog_editor');
      });
    });

    // Delegate to Sub-Inspectors
    ProjectInspector.attachEvents(this.element, {
      project: this.project,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    SceneInspector.attachEvents(this.element, {
      project: this.project,
      currentScene: this.currentScene,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    HotspotInspector.attachEvents(this.element, {
      project: this.project,
      currentScene: this.currentScene,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    CharacterInspector.attachEvents(this.element, {
      project: this.project,
      currentScene: this.currentScene,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    LayerInspector.attachEvents(this.element, {
      project: this.project,
      currentScene: this.currentScene,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    ItemInspector.attachEvents(this.element, {
      project: this.project,
      onUpdate: emitUpdate,
      onReRender: reRender
    });

    ActionRulesInspector.attachEvents(this.element, {
      project: this.project,
      currentScene: this.currentScene,
      onUpdate: emitUpdate,
      onReRender: reRender
    });
  }
}
