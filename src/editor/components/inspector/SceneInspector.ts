import { SceneData, ProjectData } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath, handleFileInputChange, getThumbnailHTML } from '../../utils/AssetPathUtils';

export class SceneInspector {
  public static getSceneHTML(scene: SceneData, project: ProjectData | null, lockHeaderHTML: string): string {
    const bgUrl = scene.layers[0]?.imageUrl || '';
    return `
      ${lockHeaderHTML}
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
          <label>🎵 Background Music Path / Upload</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" class="form-input" id="sc-bgm-url" value="${scene.backgroundMusicUrl || ''}" placeholder="e.g. assets/audio/town.mp3" style="flex:1;" />
            <label class="btn btn-primary" style="padding:6px 10px; cursor:pointer;" title="Choose BGM File">
              📁
              <input type="file" id="sc-bgm-file" accept="audio/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Scene Base Asset Folder</label>
          <input type="text" class="form-input" id="sc-base-folder" value="${scene.assetBasePath || project?.assetBasePath || ''}" placeholder="e.g. assets/scene1" />
          <div style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">
            Base folder for this scene's assets (e.g. <code>assets/scene1</code> ➔ audio in <code>assets/scene1/audio/</code>).
          </div>
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

  public static getWalkPathHTML(scene: SceneData, lockHeaderHTML: string): string {
    const wp = scene.walkPaths[0] || { scaling: { minY: 400, maxY: 1080, minScale: 0.6, maxScale: 1.2, vanishX: scene.width / 2 }, points: [] };
    return `
      ${lockHeaderHTML}
      <div class="sidebar-section">
        <div class="sidebar-section-title">📐 2.5D Perspective Frustum & Floor Plane</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">
          Matches character movement & scaling to background depth perspective. Drag handles on canvas or edit values.
        </div>
        <div class="form-group">
          <label style="color:#06b6d4; font-weight:700;">🌅 Min Horizon Y (Distance)</label>
          <input type="number" class="form-input" id="wp-min-y" value="${wp.scaling.minY}" />
        </div>
        <div class="form-group">
          <label style="color:#06b6d4; font-weight:700;">Horizon Scale (minScale)</label>
          <input type="number" step="0.05" class="form-input" id="wp-min-scale" value="${wp.scaling.minScale}" />
        </div>
        <div class="form-group">
          <label style="color:#f59e0b; font-weight:700;">📐 Max Horizon Y (Foreground)</label>
          <input type="number" class="form-input" id="wp-max-y" value="${wp.scaling.maxY}" />
        </div>
        <div class="form-group">
          <label style="color:#f59e0b; font-weight:700;">Foreground Scale (maxScale)</label>
          <input type="number" step="0.05" class="form-input" id="wp-max-scale" value="${wp.scaling.maxScale}" />
        </div>
        <div class="form-group">
          <label style="color:#38bdf8; font-weight:700;">🎯 Vanishing Point X (Center of Rays)</label>
          <input type="number" class="form-input" id="wp-vanish-x" value="${wp.scaling.vanishX ?? Math.round(scene.width / 2)}" />
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

  public static attachEvents(
    container: HTMLElement,
    params: {
      project: ProjectData | null;
      currentScene: SceneData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { project, currentScene, onUpdate, onReRender } = params;
    if (!currentScene) return;

    // Scene properties
    const scName = container.querySelector('#sc-name') as HTMLInputElement;
    if (scName) {
      scName.addEventListener('input', () => {
        currentScene.name = scName.value;
        onUpdate();
      });
    }

    const scBase = container.querySelector('#sc-base-folder') as HTMLInputElement;
    if (scBase) {
      scBase.addEventListener('input', () => {
        currentScene.assetBasePath = scBase.value.trim();
        onUpdate();
      });
    }

    const scBgUrl = container.querySelector('#sc-bg-url') as HTMLInputElement;
    if (scBgUrl) {
      scBgUrl.addEventListener('input', () => {
        if (currentScene.layers[0]) {
          currentScene.layers[0].imageUrl = scBgUrl.value.trim();
          onUpdate();
        }
      });
    }

    const scBgFile = container.querySelector('#sc-bg-file') as HTMLInputElement;
    if (scBgFile) {
      scBgFile.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && currentScene.layers[0]) {
          handleFileInputChange(file, 'images', currentScene, project, (cleanUrl) => {
            currentScene.layers[0].imageUrl = cleanUrl;
            onReRender();
            onUpdate();
          });
        }
      });
    }

    const scBgmUrl = container.querySelector('#sc-bgm-url') as HTMLInputElement;
    if (scBgmUrl) {
      scBgmUrl.addEventListener('input', () => {
        currentScene.backgroundMusicUrl = scBgmUrl.value.trim() || undefined;
        onUpdate();
      });
    }

    const scBgmFile = container.querySelector('#sc-bgm-file') as HTMLInputElement;
    if (scBgmFile) {
      scBgmFile.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const relPath = resolvePickedAssetPath(file, 'audio', currentScene, project);
          currentScene.backgroundMusicUrl = relPath;
          if (scBgmUrl) scBgmUrl.value = relPath;
          onUpdate();
        }
      });
    }

    // Add Layer & Hotspot
    container.querySelector('#btn-add-layer')?.addEventListener('click', () => {
      currentScene.layers.push({
        id: `layer_${Date.now()}`,
        name: `Layer ${currentScene.layers.length + 1}`,
        imageUrl: '',
        parallaxX: 0,
        parallaxY: 0,
        opacity: 1,
        visible: true,
        zIndex: currentScene.layers.length
      });
      onReRender();
      onUpdate();
    });

    container.querySelector('#btn-add-hotspot')?.addEventListener('click', () => {
      currentScene.hotspots.push({
        id: `obj_${Date.now()}`,
        name: `Object ${currentScene.hotspots.length + 1}`,
        cursor: 'interact',
        enabled: true,
        points: [
          { x: 400, y: 400 },
          { x: 500, y: 400 },
          { x: 500, y: 500 },
          { x: 400, y: 500 }
        ],
        actions: [
          { verb: 'look', text: 'An interesting object.' }
        ]
      });
      onReRender();
      onUpdate();
    });

    // WalkPath parameters
    const wp = currentScene.walkPaths[0];
    if (wp) {
      const wpMinY = container.querySelector('#wp-min-y') as HTMLInputElement;
      const wpMaxY = container.querySelector('#wp-max-y') as HTMLInputElement;
      const wpMinScale = container.querySelector('#wp-min-scale') as HTMLInputElement;
      const wpMaxScale = container.querySelector('#wp-max-scale') as HTMLInputElement;
      const wpVanishX = container.querySelector('#wp-vanish-x') as HTMLInputElement;

      wpMinY?.addEventListener('input', () => { wp.scaling.minY = parseFloat(wpMinY.value) || 400; onUpdate(); });
      wpMaxY?.addEventListener('input', () => { wp.scaling.maxY = parseFloat(wpMaxY.value) || 1080; onUpdate(); });
      wpMinScale?.addEventListener('input', () => { wp.scaling.minScale = parseFloat(wpMinScale.value) || 0.6; onUpdate(); });
      wpMaxScale?.addEventListener('input', () => { wp.scaling.maxScale = parseFloat(wpMaxScale.value) || 1.2; onUpdate(); });
      wpVanishX?.addEventListener('input', () => { wp.scaling.vanishX = parseFloat(wpVanishX.value) || Math.round(currentScene.width / 2); onUpdate(); });

      container.querySelector('#btn-draw-wp-scratch')?.addEventListener('click', () => {
        EventBus.getInstance().emit('editor:start_draw_polygon', { targetType: 'walkpath' });
      });

      container.querySelector('#btn-add-wp-pt')?.addEventListener('click', () => {
        if (wp.points.length >= 2) {
          const last = wp.points[wp.points.length - 1];
          const first = wp.points[0];
          wp.points.push({ x: Math.round((last.x + first.x) / 2), y: Math.round((last.y + first.y) / 2) });
        } else {
          wp.points.push({ x: 500, y: 700 });
        }
        onReRender();
        onUpdate();
      });

      container.querySelectorAll('.wp-pt-x').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.idx!);
          if (wp.points[idx]) {
            wp.points[idx].x = parseFloat((e.target as HTMLInputElement).value) || 0;
            onUpdate();
          }
        });
      });

      container.querySelectorAll('.wp-pt-y').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.idx!);
          if (wp.points[idx]) {
            wp.points[idx].y = parseFloat((e.target as HTMLInputElement).value) || 0;
            onUpdate();
          }
        });
      });

      container.querySelectorAll('.btn-del-wp-pt').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.idx!);
          if (wp.points.length > 3) {
            wp.points.splice(idx, 1);
            onReRender();
            onUpdate();
          } else {
            EventBus.getInstance().emit('ui:notify', '⚠️ WalkPath polygon must have at least 3 vertices.');
          }
        });
      });
    }
  }
}
