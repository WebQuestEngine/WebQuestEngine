import { SceneData, HotspotData, CharacterData, LayerData, InventoryItemData, ProjectData } from '../../../../engine/types';
import { AssetManager } from '../../../../engine/core/AssetManager';
import { TemplateUtils } from '../../../utils/TemplateUtils';
import { getThumbnailHTML } from '../../../utils/AssetPathUtils';

import dialogTabNoDialogHtml from './DialogTabInspector.html?raw';
import hotspotHtml from './HotspotInspector.html?raw';
import characterHtml from './CharacterInspector.html?raw';
import layerHtml from './LayerInspector.html?raw';
import itemHtml from './ItemInspector.html?raw';

// ─── DialogTabInspector ─────────────────────────────────────────────────────

export class DialogTabInspectorTemplate {
  public static render(dialogId: string | undefined, project: ProjectData | null): string {
    const dialog = dialogId ? project?.dialogs.find(d => d.id === dialogId) : undefined;
    if (!dialog) {
      return dialogTabNoDialogHtml;
    }

    const startNode = dialog.nodes[dialog.startNodeId];
    const choices = startNode?.choices || [];

    const startNodeHTML = startNode ? `
      <div style="font-size:0.75rem; margin-bottom:6px;">
        <b>Speaker:</b> ${TemplateUtils.escapeHtml(startNode.speaker)}<br/>
        <b>Initial Line:</b> <i>"${TemplateUtils.escapeHtml(startNode.text)}"</i>
      </div>
      <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px;">
        <b>Player Options (${choices.length}):</b>
        <ul style="margin:4px 0 0 16px; padding:0;">
          ${TemplateUtils.renderList<{ text: string }>(choices, (c: { text: string }) => `<li>${TemplateUtils.escapeHtml(c.text)}</li>`)}
        </ul>
      </div>` : '';

    return `
      <div class="sidebar-section">
        <div style="background:rgba(139, 92, 246, 0.08); border:1px solid var(--accent-purple); padding:10px; border-radius:8px; margin-bottom:12px;">
          <div style="font-weight:700; font-family:var(--font-heading); color:var(--accent-gold); font-size:0.85rem; margin-bottom:4px;">
            💬 ${TemplateUtils.escapeHtml(dialog.title)}
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:8px;">ID: <code>${dialog.id}</code></div>
          ${startNodeHTML}
        </div>
        <button class="btn btn-gold btn-open-dialog-editor" data-dlgid="${dialog.id}" style="width:100%; font-size:0.8rem; padding:8px; font-weight:700;">
          💬 Open Specialized Dialog Editor
        </button>
      </div>
    `;
  }
}

// ─── HotspotInspector ───────────────────────────────────────────────────────

export class HotspotInspectorTemplate {
  public static render(params: {
    scene: SceneData;
    hs: HotspotData;
    project: ProjectData | null;
  }): string {
    const { scene, hs, project } = params;
    const hIdx = scene.hotspots.indexOf(hs);

    const posX = hs.position ? hs.position.x : Math.round(hs.points.reduce((s, p) => s + p.x, 0) / (hs.points.length || 1));
    const posY = hs.position ? hs.position.y : Math.round(hs.points.reduce((s, p) => s + p.y, 0) / (hs.points.length || 1));

    const customCursorThumbnailHTML = hs.customCursorUrl
      ? `<div style="width:32px; height:32px; min-width:32px; background:#1e293b; border:1px solid var(--border-color); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
           <img src="${AssetManager.getInstance().resolveImageSrc(hs.customCursorUrl)}" style="max-width:28px; max-height:28px; object-fit:contain;" />
         </div>` : '';

    const customCursorHotspotFieldsHTML = hs.customCursorUrl
      ? `<div style="display:flex; gap:6px; align-items:flex-end; margin-bottom:8px;">
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
         </div>` : '';

    const verticesHTML = TemplateUtils.renderList<{ x: number; y: number }>(hs.points, (pt: { x: number; y: number }, i: number) => `
      <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
        <span style="font-size:0.75rem; color:var(--text-muted); width:24px;">#${i + 1}</span>
        <input type="number" class="form-input hs-pt-x" data-hidx="${hIdx}" data-idx="${i}" value="${pt.x}" style="font-size:0.75rem;" />
        <input type="number" class="form-input hs-pt-y" data-hidx="${hIdx}" data-idx="${i}" value="${pt.y}" style="font-size:0.75rem;" />
        <button class="btn btn-del-hs-pt" data-hidx="${hIdx}" data-idx="${i}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
      </div>
    `);

    const sel = (v: string) => hs.cursor === v ? 'selected' : '';

    return TemplateUtils.populate(hotspotHtml, {
      hIdx,
      name: TemplateUtils.escapeHtml(hs.name),
      thumbnailHTML: getThumbnailHTML(hs.imageUrl),
      imageUrl: TemplateUtils.escapeHtml(hs.imageUrl || ''),
      posX,
      posY,
      scaleX: hs.scaleX ?? 1,
      scaleY: hs.scaleY ?? 1,
      depthY: hs.depthY ?? '',
      cursorInteract: sel('interact'),
      cursorLook: sel('look'),
      cursorTalk: sel('talk'),
      cursorWalk: sel('walk'),
      customCursorThumbnailHTML,
      customCursorUrl: TemplateUtils.escapeHtml(hs.customCursorUrl || ''),
      customCursorHotspotFieldsHTML,
      requiredFlag: TemplateUtils.escapeHtml(hs.requiredFlag || ''),
      notFlag: TemplateUtils.escapeHtml(hs.notFlag || ''),
      vertexCount: hs.points.length,
      verticesHTML,
    });
  }
}

// ─── CharacterInspector ─────────────────────────────────────────────────────

export class CharacterInspectorTemplate {
  public static render(params: {
    scene: SceneData;
    char: CharacterData;
    project: ProjectData | null;
  }): string {
    const { scene, char, project } = params;
    const cIdx = scene.characters.indexOf(char);

    const animationsHTML = Object.entries(char.animations || {}).map(([key, val]) => {
      const framesStr = Array.isArray(val) ? val.join(',') : ((val as any).frames || []).join(',');
      return `
        <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
          <input type="text" class="form-input char-anim-key" data-cidx="${cIdx}" data-oldkey="${TemplateUtils.escapeHtml(key)}" value="${TemplateUtils.escapeHtml(key)}" placeholder="Clip Name" style="font-size:0.75rem; flex:1; font-weight:600;" />
          <input type="text" class="form-input char-anim-frames" data-cidx="${cIdx}" data-animkey="${TemplateUtils.escapeHtml(key)}" value="${framesStr}" placeholder="0,1,2,3" style="font-size:0.75rem; flex:1;" />
          <button class="btn btn-gold btn-open-frame-picker" data-cidx="${cIdx}" data-animkey="${TemplateUtils.escapeHtml(key)}" style="font-size:0.65rem; padding:3px 6px;" title="Open Visual Grid Picker">🖼️ Pick</button>
          <button class="btn btn-del-char-anim" data-cidx="${cIdx}" data-animkey="${TemplateUtils.escapeHtml(key)}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
        </div>`;
    }).join('');

    return TemplateUtils.populate(characterHtml, {
      cIdx,
      name: TemplateUtils.escapeHtml(char.name),
      thumbnailHTML: getThumbnailHTML(char.spriteSheetUrl),
      spriteSheetUrl: TemplateUtils.escapeHtml(char.spriteSheetUrl),
      posX: char.position.x,
      posY: char.position.y,
      scale: char.scale,
      speed: char.speed,
      spritesheetCols: char.cols,
      spritesheetRows: char.rows,
      depthY: char.depthY ?? '',
      animCount: Object.keys(char.animations || {}).length,
      animationsHTML,
    });
  }
}

// ─── LayerInspector ─────────────────────────────────────────────────────────

export class LayerInspectorTemplate {
  public static render(scene: SceneData, layer: LayerData): string {
    const lIdx = scene.layers.indexOf(layer);
    return TemplateUtils.populate(layerHtml, {
      lIdx,
      name: TemplateUtils.escapeHtml(layer.name),
      thumbnailHTML: getThumbnailHTML(layer.imageUrl),
      imageUrl: TemplateUtils.escapeHtml(layer.imageUrl),
      posX: layer.x || 0,
      posY: layer.y || 0,
      scaleX: layer.scaleX ?? 1,
      scaleY: layer.scaleY ?? 1,
      parallaxX: layer.parallaxX,
      parallaxY: layer.parallaxY,
      opacityPct: Math.round(layer.opacity * 100),
      opacity: layer.opacity,
      layerNum: lIdx + 1,
      totalLayers: scene.layers.length,
      moveUpDisabled: lIdx === 0 ? 'disabled' : '',
      moveDownDisabled: lIdx === scene.layers.length - 1 ? 'disabled' : '',
      visibilityLabel: layer.visible ? '👁️ Visible' : '🙈 Hidden',
    });
  }
}

// ─── ItemInspector ──────────────────────────────────────────────────────────

export class ItemInspectorTemplate {
  public static render(item: InventoryItemData, project: ProjectData | null): string {
    const idx = project?.items.indexOf(item) ?? 0;
    return TemplateUtils.populate(itemHtml, {
      idx,
      name: TemplateUtils.escapeHtml(item.name),
      itemId: TemplateUtils.escapeHtml(item.id),
      thumbnailHTML: getThumbnailHTML(item.iconUrl),
      iconUrl: TemplateUtils.escapeHtml(item.iconUrl),
      description: TemplateUtils.escapeHtml(item.description),
    });
  }
}
