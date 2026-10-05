import { SceneData, ProjectData } from '../../../../engine/types';
import { TemplateUtils } from '../../../utils/TemplateUtils';
import { getThumbnailHTML } from '../../../utils/AssetPathUtils';

import sceneHtml from './SceneInspector.html?raw';
import walkPathHtml from './SceneWalkPath.html?raw';

export class SceneInspectorTemplate {
  /** Renders the main scene properties section. */
  public static scene(scene: SceneData, project: ProjectData | null, lockHeaderHTML: string): string {
    const bgUrl = scene.layers[0]?.imageUrl || '';
    const characters = project?.characters || [];
    const currentPlayableId = scene.playerCharacterId || characters[0]?.id || 'player';

    const playableCharOptionsHTML = characters.map(c => `
      <option value="${TemplateUtils.escapeHtml(c.id)}" ${c.id === currentPlayableId ? 'selected' : ''}>
        ${TemplateUtils.escapeHtml(c.name)} (${TemplateUtils.escapeHtml(c.id)})
      </option>
    `).join('') || '<option value="player">Default Hero (player)</option>';

    const sceneCharactersListHTML = (scene.characters || []).map((ch, idx) => {
      const charId = ch.characterId || ch.id || '';
      const def = characters.find(c => c.id === charId);
      const name = def?.name || (ch as any).name || charId;
      const isPlayable = charId === currentPlayableId;
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; margin-bottom:4px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:4px;">
          <div>
            <div style="font-weight:600; font-size:0.78rem;">
              👤 ${TemplateUtils.escapeHtml(name)}
              ${isPlayable ? '<span style="background:rgba(251,191,36,0.2); color:#fbbf24; font-size:0.65rem; padding:1px 4px; border-radius:3px; margin-left:4px;">Playable</span>' : ''}
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted);">
              ID: ${TemplateUtils.escapeHtml(charId)} | Pos: (${Math.round(ch.position?.x ?? 0)}, ${Math.round(ch.position?.y ?? 0)})
            </div>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-select-scene-char" data-charid="${TemplateUtils.escapeHtml(charId)}" style="padding:2px 6px; font-size:0.65rem;" title="Select Character">✏️</button>
            <button class="btn btn-del-scene-char" data-idx="${idx}" data-charid="${TemplateUtils.escapeHtml(charId)}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;" title="Remove from scene">🗑️</button>
          </div>
        </div>
      `;
    }).join('') || '<div style="font-size:0.72rem; color:var(--text-muted); font-style:italic;">No characters placed in this scene.</div>';

    return TemplateUtils.populate(sceneHtml, {
      lockHeaderHTML,
      sceneName: TemplateUtils.escapeHtml(scene.name),
      sceneId: TemplateUtils.escapeHtml(scene.id),
      bgUrl: TemplateUtils.escapeHtml(bgUrl),
      thumbnailHTML: getThumbnailHTML(bgUrl),
      bgmUrl: TemplateUtils.escapeHtml(scene.backgroundMusicUrl || ''),
      sceneBasePath: TemplateUtils.escapeHtml(scene.assetBasePath || project?.assetBasePath || ''),
      projectBasePath: TemplateUtils.escapeHtml(project?.assetBasePath || ''),
      playableCharOptionsHTML,
      sceneCharCount: (scene.characters || []).length,
      sceneCharactersListHTML,
    });
  }

  /** Renders the walk-path / 2.5D frustum section. */
  public static walkPath(scene: SceneData, lockHeaderHTML: string): string {
    const wp = scene.walkPaths[0] || {
      scaling: { minY: 400, maxY: 1080, minScale: 0.6, maxScale: 1.2, vanishX: scene.width / 2 },
      points: [],
    };

    const verticesHTML = TemplateUtils.renderList<{x: number; y: number}>(wp.points, (pt: {x: number; y: number}, i: number) => `
      <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
        <span style="font-size:0.75rem; color:var(--text-muted); width:24px;">#${i + 1}</span>
        <input type="number" class="form-input wp-pt-x" data-idx="${i}" value="${pt.x}" style="font-size:0.75rem;" />
        <input type="number" class="form-input wp-pt-y" data-idx="${i}" value="${pt.y}" style="font-size:0.75rem;" />
        <button class="btn btn-del-wp-pt" data-idx="${i}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;">✕</button>
      </div>
    `);

    return TemplateUtils.populate(walkPathHtml, {
      lockHeaderHTML,
      minY: wp.scaling.minY,
      minScale: wp.scaling.minScale,
      maxY: wp.scaling.maxY,
      maxScale: wp.scaling.maxScale,
      vanishX: wp.scaling.vanishX ?? Math.round(scene.width / 2),
      vertexCount: wp.points.length,
      verticesHTML,
    });
  }
}
