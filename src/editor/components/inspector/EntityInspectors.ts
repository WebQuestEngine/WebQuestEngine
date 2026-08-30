import { SceneData, HotspotData, CharacterData, LayerData, InventoryItemData, ProjectData } from '../../../engine/types';
import { AssetManager } from '../../../engine/core/AssetManager';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath, handleFileInputChange, getThumbnailHTML, normalizeImagePath } from '../../utils/AssetPathUtils';
import { ActionRulesInspector } from './ActionRulesInspector';
import { VisualCursorHotspotModal } from '../VisualCursorHotspotModal';
import { VisualSpritePickerModal } from '../VisualSpritePickerModal';

export class DialogTabInspector {
  public static getHTML(dialogId: string | undefined, project: ProjectData | null): string {
    const dialog = dialogId ? project?.dialogs.find(d => d.id === dialogId) : undefined;
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
          <div style="grid-column: span 2;">
            <label style="font-size:0.65rem; color:#06b6d4; font-weight:700;">Depth Y / Z-Sort (Leave empty for Auto Base Y)</label>
            <input type="number" class="form-input single-hs-depth-y" data-hidx="${hIdx}" value="${hs.depthY ?? ''}" placeholder="Auto (Base Y)" />
          </div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Cursor Context</label>
          <select class="form-select single-hs-cursor" data-hidx="${hIdx}">
            <option value="interact" ${hs.cursor === 'interact' ? 'selected' : ''}>✋ Touch / Interact</option>
            <option value="look" ${hs.cursor === 'look' ? 'selected' : ''}>👁️ Look</option>
            <option value="talk" ${hs.cursor === 'talk' ? 'selected' : ''}>💬 Talk</option>
            <option value="walk" ${hs.cursor === 'walk' ? 'selected' : ''}>🥾 Walk</option>
          </select>
        </div>
        <div class="form-group">
          <label>Custom Cursor Graphic (URL)</label>
          <div style="display:flex; gap:6px; align-items:center;">
            ${hs.customCursorUrl ? `
              <div style="width:32px; height:32px; min-width:32px; background:#1e293b; border:1px solid var(--border-color); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <img src="${AssetManager.getInstance().resolveImageSrc(hs.customCursorUrl)}" style="max-width:28px; max-height:28px; object-fit:contain;" />
              </div>
            ` : ''}
            <input type="text" class="form-input single-hs-custom-cursor" data-hidx="${hIdx}" value="${hs.customCursorUrl || ''}" placeholder="Optional custom mouse cursor PNG" style="flex:1;" />
            <label class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; cursor:pointer; margin:0;" title="Browse cursor file">
              📁
              <input type="file" class="single-hs-custom-cursor-file" data-hidx="${hIdx}" accept="image/*" style="display:none;" />
            </label>
          </div>
        </div>
        ${hs.customCursorUrl ? `
          <div style="display:flex; gap:6px; align-items:flex-end; margin-bottom:8px;">
            <div style="flex:1;">
              <label style="font-size:0.65rem; color:var(--text-muted);">Hotspot X (px)</label>
              <input type="number" class="form-input single-hs-cursor-hx" data-hidx="${hIdx}" value="${hs.customCursorHotspotX ?? 0}" placeholder="0" style="font-size:0.75rem;" />
            </div>
            <div style="flex:1;">
              <label style="font-size:0.65rem; color:var(--text-muted);">Hotspot Y (px)</label>
              <input type="number" class="form-input single-hs-cursor-hy" data-hidx="${hIdx}" value="${hs.customCursorHotspotY ?? 0}" placeholder="0" style="font-size:0.75rem;" />
            </div>
            <button class="btn btn-primary btn-open-hs-cursor-hotspot-modal" data-hidx="${hIdx}" style="padding:4px 8px; font-size:0.7rem; white-space:nowrap; height:28px; background:#059669; border:none; color:white;" title="Visually drag and select hotspot">
              🎯 Visual Pick
            </button>
          </div>
        ` : ''}
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
          <div style="grid-column: span 2;">
            <label style="font-size:0.65rem; color:#06b6d4; font-weight:700;">Depth Y / Z-Sort (Leave empty for Auto Feet Y)</label>
            <input type="number" class="form-input char-depth-y" data-idx="${cIdx}" value="${char.depthY ?? ''}" placeholder="Auto (Feet Y)" />
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
        <div class="form-group" style="margin-top:10px;">
          <label style="font-weight:700;">Layer Ordering & Duplication (Layer ${lIdx + 1} of ${scene.layers.length})</label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-top:4px;">
            <button class="btn btn-layer-move-up" data-idx="${lIdx}" ${lIdx === 0 ? 'disabled' : ''} style="font-size:0.75rem;" title="Move Layer Backwards (Behind)">⬆️ Move Backwards</button>
            <button class="btn btn-layer-move-down" data-idx="${lIdx}" ${lIdx === scene.layers.length - 1 ? 'disabled' : ''} style="font-size:0.75rem;" title="Move Layer Forwards (In Front)">⬇️ Move Forwards</button>
            <button class="btn btn-primary btn-layer-duplicate" data-idx="${lIdx}" style="font-size:0.75rem;" title="Duplicate this Layer">📋 Duplicate Layer</button>
            <button class="btn btn-del-layer" data-idx="${lIdx}" style="font-size:0.75rem; color:#ef4444;" title="Delete Layer">🗑️ Delete Layer</button>
          </div>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-toggle-vis" data-idx="${lIdx}" style="font-size:0.75rem;">
            ${layer.visible ? '👁️ Visible' : '🙈 Hidden'}
          </button>
        </div>
      </div>
    `;
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
    const idx = project?.items.indexOf(item) ?? 0;
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
