import { SceneData, ProjectData } from '../../../../engine/types';
import { TemplateUtils } from '../../../utils/TemplateUtils';
import { getThumbnailHTML } from '../../../utils/AssetPathUtils';

import sceneHtml from './SceneInspector.html?raw';
import walkPathHtml from './SceneWalkPath.html?raw';

export class SceneInspectorTemplate {
  /** Renders the main scene properties section. */
  public static scene(scene: SceneData, project: ProjectData | null, lockHeaderHTML: string): string {
    const bgUrl = scene.layers[0]?.imageUrl || '';
    return TemplateUtils.populate(sceneHtml, {
      lockHeaderHTML,
      sceneName: TemplateUtils.escapeHtml(scene.name),
      sceneId: TemplateUtils.escapeHtml(scene.id),
      bgUrl: TemplateUtils.escapeHtml(bgUrl),
      thumbnailHTML: getThumbnailHTML(bgUrl),
      bgmUrl: TemplateUtils.escapeHtml(scene.backgroundMusicUrl || ''),
      sceneBasePath: TemplateUtils.escapeHtml(scene.assetBasePath || project?.assetBasePath || ''),
      projectBasePath: TemplateUtils.escapeHtml(project?.assetBasePath || ''),
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
