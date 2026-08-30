import { SceneData, HotspotData, CharacterData, LayerData, InventoryItemData, ProjectData } from '../../../engine/types';
import { AssetManager } from '../../../engine/core/AssetManager';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath, handleFileInputChange, getThumbnailHTML, normalizeImagePath } from '../../utils/AssetPathUtils';
import { ActionRulesInspector } from './ActionRulesInspector';
import { VisualCursorHotspotModal } from '../VisualCursorHotspotModal';
import { VisualSpritePickerModal } from '../VisualSpritePickerModal';
import {
  DialogTabInspectorTemplate,
  HotspotInspectorTemplate,
  CharacterInspectorTemplate,
  LayerInspectorTemplate,
  ItemInspectorTemplate,
} from './templates/EntityInspectors.template';

export class DialogTabInspector {
  public static getHTML(dialogId: string | undefined, project: ProjectData | null): string {
    return DialogTabInspectorTemplate.render(dialogId, project);
  }
}

export class HotspotInspector {
  public static getHTML(params: {
    scene: SceneData;
    hs: HotspotData;
    activeSubTab: 'properties' | 'interactions' | 'dialogs';
    project: ProjectData | null;
  }): string {
    const { scene, hs, activeSubTab, project } = params;
    const hIdx = scene.hotspots.indexOf(hs);
    const actionsCount = hs.actions.length;
    const linkedDialog = hs.actions.find(a => a.dialogId)?.dialogId;
    const dialogsCount = linkedDialog ? 1 : 0;

    const subtabsHTML = `
      <div class="inspector-subtabs">
        <button class="inspector-subtab-btn ${activeSubTab === 'properties' ? 'active' : ''}" data-tab="properties">⚙️ Properties</button>
        <button class="inspector-subtab-btn ${activeSubTab === 'interactions' ? 'active' : ''}" data-tab="interactions">⚡ Actions (${actionsCount})</button>
        <button class="inspector-subtab-btn ${activeSubTab === 'dialogs' ? 'active' : ''}" data-tab="dialogs">💬 Dialogs (${dialogsCount})</button>
      </div>
    `;

    if (activeSubTab === 'interactions') {
      return subtabsHTML + ActionRulesInspector.getHTML({ hIdx, actions: hs.actions, isCharacter: false, project, currentScene: scene });
    } else if (activeSubTab === 'dialogs') {
      return subtabsHTML + DialogTabInspector.getHTML(linkedDialog, project);
    }

    const posX = hs.position ? hs.position.x : Math.round(hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1));
    const posY = hs.position ? hs.position.y : Math.round(hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1));

    return subtabsHTML + HotspotInspectorTemplate.render({ scene, hs, project });
  }

  public static attachEvents(
    container: HTMLElement,
    params: {
      currentScene: SceneData | null;
      project: ProjectData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { currentScene, project, onUpdate, onReRender } = params;
    if (!currentScene) return;

    container.querySelectorAll('.single-hs-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].name = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-img-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const val = (e.target as HTMLInputElement).value;
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].imageUrl = val ? normalizeImagePath(val) : undefined;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0] && currentScene.hotspots[hIdx]) {
          const relPath = resolvePickedAssetPath(files[0], 'images', currentScene, project);
          currentScene.hotspots[hIdx].imageUrl = relPath;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-pos-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const hs = currentScene.hotspots[hIdx];
        if (hs) {
          const newX = parseFloat((e.target as HTMLInputElement).value) || 0;
          const currentX = hs.position ? hs.position.x : (hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1));
          const dx = newX - currentX;
          for (const pt of hs.points) { pt.x += dx; }
          if (!hs.position) hs.position = { x: newX, y: hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1) };
          else hs.position.x = newX;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-pos-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const hs = currentScene.hotspots[hIdx];
        if (hs) {
          const newY = parseFloat((e.target as HTMLInputElement).value) || 0;
          const currentY = hs.position ? hs.position.y : (hs.points.reduce((s,p)=>s+p.y,0)/(hs.points.length||1));
          const dy = newY - currentY;
          for (const pt of hs.points) { pt.y += dy; }
          if (!hs.position) hs.position = { x: hs.points.reduce((s,p)=>s+p.x,0)/(hs.points.length||1), y: newY };
          else hs.position.y = newY;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-scale-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].scaleX = parseFloat((e.target as HTMLInputElement).value) || 1;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-scale-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].scaleY = parseFloat((e.target as HTMLInputElement).value) || 1;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-depth-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const val = (e.target as HTMLInputElement).value.trim();
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].depthY = val === '' ? undefined : parseFloat(val);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-cursor').forEach(select => {
      select.addEventListener('change', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].cursor = (e.target as HTMLSelectElement).value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-custom-cursor').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].customCursorUrl = (e.target as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-custom-cursor-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && currentScene.hotspots[hIdx]) {
          const relPath = resolvePickedAssetPath(file, 'cursors', currentScene, project);
          currentScene.hotspots[hIdx].customCursorUrl = relPath;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-cursor-hx').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].customCursorHotspotX = parseInt((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-cursor-hy').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].customCursorHotspotY = parseInt((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-open-hs-cursor-hotspot-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.currentTarget as HTMLElement).dataset.hidx!);
        const hs = currentScene.hotspots[hIdx];
        if (hs?.customCursorUrl) {
          VisualCursorHotspotModal.open({
            verb: hs.name || 'Object Cursor',
            cursorUrl: hs.customCursorUrl,
            initialHotspotX: hs.customCursorHotspotX ?? 0,
            initialHotspotY: hs.customCursorHotspotY ?? 0,
            onSave: (res) => {
              hs.customCursorHotspotX = res.hotspotX;
              hs.customCursorHotspotY = res.hotspotY;
              onReRender();
              onUpdate();
            }
          });
        }
      });
    });

    container.querySelectorAll('.single-hs-req-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].requiredFlag = (e.target as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-hs-not-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          currentScene.hotspots[hIdx].notFlag = (e.target as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Polygon Vertices
    container.querySelectorAll('.btn-draw-hs-scratch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        EventBus.getInstance().emit('editor:start_draw_polygon', { targetType: 'hotspot', hIdx });
      });
    });

    container.querySelectorAll('#btn-add-hs-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene.hotspots[hIdx]) {
          const hs = currentScene.hotspots[hIdx];
          const pts = hs.points;
          if (pts.length >= 2) {
            const last = pts[pts.length - 1];
            const first = pts[0];
            pts.push({ x: Math.round((last.x + first.x) / 2), y: Math.round((last.y + first.y) / 2) });
          } else {
            pts.push({ x: 500, y: 500 });
          }
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.hs-pt-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.hotspots[hIdx]?.points[idx]) {
          currentScene.hotspots[hIdx].points[idx].x = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.hs-pt-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.hotspots[hIdx]?.points[idx]) {
          currentScene.hotspots[hIdx].points[idx].y = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-del-hs-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.hotspots[hIdx]) {
          const pts = currentScene.hotspots[hIdx].points;
          if (pts.length > 3) {
            pts.splice(idx, 1);
            onReRender();
            onUpdate();
          } else {
            EventBus.getInstance().emit('ui:notify', '⚠️ Hotspot polygon must have at least 3 vertices.');
          }
        }
      });
    });
  }
}

export class CharacterInspector {
  public static getHTML(params: {
    scene: SceneData;
    char: CharacterData;
    activeSubTab: 'properties' | 'interactions' | 'dialogs';
    project: ProjectData | null;
  }): string {
    const { scene, char, activeSubTab, project } = params;
    const cIdx = scene.characters.indexOf(char);
    const actions = char.actions || [];
    const actionsCount = actions.length;
    const linkedDialog = actions.find(a => a.dialogId)?.dialogId || `dlg_${char.id.replace('npc_', '')}`;
    const hasDialog = project?.dialogs.some(d => d.id === linkedDialog);
    const dialogsCount = hasDialog ? 1 : 0;

    const subtabsHTML = `
      <div class="inspector-subtabs">
        <button class="inspector-subtab-btn ${activeSubTab === 'properties' ? 'active' : ''}" data-tab="properties">⚙️ Properties</button>
        <button class="inspector-subtab-btn ${activeSubTab === 'interactions' ? 'active' : ''}" data-tab="interactions">⚡ Actions (${actionsCount})</button>
        <button class="inspector-subtab-btn ${activeSubTab === 'dialogs' ? 'active' : ''}" data-tab="dialogs">💬 Dialogs (${dialogsCount})</button>
      </div>
    `;

    if (activeSubTab === 'interactions') {
      return subtabsHTML + ActionRulesInspector.getHTML({ hIdx: cIdx, actions, isCharacter: true, project, currentScene: scene });
    } else if (activeSubTab === 'dialogs') {
      return subtabsHTML + DialogTabInspector.getHTML(linkedDialog, project);
    }

    return subtabsHTML + CharacterInspectorTemplate.render({ scene, char, project });
  }

  public static attachEvents(
    container: HTMLElement,
    params: {
      currentScene: SceneData | null;
      project: ProjectData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { currentScene, project, onUpdate, onReRender } = params;
    if (!currentScene) return;

    container.querySelectorAll('.char-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].name = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-spritesheet').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].spriteSheetUrl = (e.target as HTMLInputElement).value;
          VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && currentScene.characters[idx]) {
          handleFileInputChange(file, 'characters', currentScene, project, (cleanUrl) => {
            currentScene.characters[idx].spriteSheetUrl = cleanUrl;
            VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
            onReRender();
            onUpdate();
          });
        }
      });
    });

    container.querySelectorAll('.char-pos-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].position.x = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-pos-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].position.y = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-scale').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].scale = parseFloat((e.target as HTMLInputElement).value) || 1;
          VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-speed').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].speed = parseFloat((e.target as HTMLInputElement).value) || 200;
          VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-fw').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].frameWidth = parseInt((e.target as HTMLInputElement).value) || 64;
          VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-fh').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].frameHeight = parseInt((e.target as HTMLInputElement).value) || 64;
          VisualSpritePickerModal.syncCharacterAcrossScenes(project, currentScene.characters[idx]);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-depth-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const val = (e.target as HTMLInputElement).value.trim();
        if (currentScene.characters[idx]) {
          currentScene.characters[idx].depthY = val === '' ? undefined : parseFloat(val);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-add-char-anim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.characters[idx]) {
          const char = currentScene.characters[idx];
          if (!char.animations) char.animations = {};
          const newKey = `anim_${Object.keys(char.animations).length + 1}`;
          char.animations[newKey] = [0];
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-anim-key').forEach(input => {
      input.addEventListener('change', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.cidx!);
        const oldKey = (e.target as HTMLElement).dataset.oldkey!;
        const newKey = (e.target as HTMLInputElement).value.trim();
        if (currentScene.characters[cIdx] && newKey && newKey !== oldKey) {
          const char = currentScene.characters[cIdx];
          const val = char.animations[oldKey];
          delete char.animations[oldKey];
          char.animations[newKey] = val;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.char-anim-frames').forEach(input => {
      input.addEventListener('input', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.cidx!);
        const animKey = (e.target as HTMLElement).dataset.animkey!;
        const valStr = (e.target as HTMLInputElement).value;
        if (currentScene.characters[cIdx]) {
          const char = currentScene.characters[cIdx];
          const frames = valStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          char.animations[animKey] = frames.length > 0 ? frames : [0];
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-del-char-anim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.cidx!);
        const animKey = (e.target as HTMLElement).dataset.animkey!;
        if (currentScene.characters[cIdx]) {
          delete currentScene.characters[cIdx].animations[animKey];
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-open-frame-picker').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt((e.currentTarget as HTMLElement).dataset.cidx!);
        const animKey = (e.currentTarget as HTMLElement).dataset.animkey!;
        if (currentScene.characters[cIdx]) {
          VisualSpritePickerModal.open({
            character: currentScene.characters[cIdx],
            animKey,
            project,
            onSave: () => {
              onReRender();
            }
          });
        }
      });
    });
  }
}

export class LayerInspector {
  public static getHTML(scene: SceneData, layer: LayerData): string {
    return LayerInspectorTemplate.render(scene, layer);
  }

  public static attachEvents(
    container: HTMLElement,
    params: {
      currentScene: SceneData | null;
      project: ProjectData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { currentScene, project, onUpdate, onReRender } = params;
    if (!currentScene) return;

    container.querySelectorAll('.single-layer-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].name = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].imageUrl = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && currentScene.layers[idx]) {
          handleFileInputChange(file, 'layers', currentScene, project, (cleanUrl) => {
            currentScene.layers[idx].imageUrl = cleanUrl;
            onReRender();
            onUpdate();
          });
        }
      });
    });

    container.querySelectorAll('.single-layer-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].x = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].y = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-scalex').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].scaleX = parseFloat((e.target as HTMLInputElement).value) || 1;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-scaley').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].scaleY = parseFloat((e.target as HTMLInputElement).value) || 1;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-parallaxx').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].parallaxX = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-parallaxy').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].parallaxY = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.single-layer-opacity').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].opacity = parseFloat((e.target as HTMLInputElement).value);
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-toggle-vis').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers[idx].visible = !currentScene.layers[idx].visible;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-layer-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (idx > 0 && currentScene.layers[idx]) {
          const temp = currentScene.layers[idx];
          currentScene.layers[idx] = currentScene.layers[idx - 1];
          currentScene.layers[idx - 1] = temp;
          currentScene.layers.forEach((l, i) => l.zIndex = i);
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-layer-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (idx < currentScene.layers.length - 1 && currentScene.layers[idx]) {
          const temp = currentScene.layers[idx];
          currentScene.layers[idx] = currentScene.layers[idx + 1];
          currentScene.layers[idx + 1] = temp;
          currentScene.layers.forEach((l, i) => l.zIndex = i);
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-layer-duplicate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          const src = currentScene.layers[idx];
          const dup: LayerData = JSON.parse(JSON.stringify(src));
          dup.id = `layer_${Date.now()}`;
          dup.name = `${src.name} (Copy)`;
          dup.zIndex = currentScene.layers.length;
          currentScene.layers.splice(idx + 1, 0, dup);
          currentScene.layers.forEach((l, i) => l.zIndex = i);
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-del-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (currentScene.layers[idx]) {
          currentScene.layers.splice(idx, 1);
          currentScene.layers.forEach((l, i) => l.zIndex = i);
          onReRender();
          onUpdate();
        }
      });
    });
  }
}

export class ItemInspector {
  public static getHTML(item: InventoryItemData, project: ProjectData | null): string {
    return ItemInspectorTemplate.render(item, project);
  }

  public static attachEvents(
    container: HTMLElement,
    params: {
      project: ProjectData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { project, onUpdate, onReRender } = params;
    if (!project) return;

    container.querySelectorAll('.item-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.items[idx]) {
          project.items[idx].name = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.item-icon-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.items[idx]) {
          project.items[idx].iconUrl = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.item-icon-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && project.items[idx]) {
          handleFileInputChange(file, 'items', null, project, (cleanUrl) => {
            project.items[idx].iconUrl = cleanUrl;
            onReRender();
            onUpdate();
          });
        }
      });
    });

    container.querySelectorAll('.item-desc').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.items[idx]) {
          project.items[idx].description = (e.target as HTMLTextAreaElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.items[idx]) {
          project.items.splice(idx, 1);
          onReRender();
          onUpdate();
        }
      });
    });
  }
}
