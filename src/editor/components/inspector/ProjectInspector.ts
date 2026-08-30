import { ProjectData, ChapterData, VerbType, AspectRatioType, UIPresetType } from '../../../engine/types';
import { AssetManager } from '../../../engine/core/AssetManager';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath } from '../../utils/AssetPathUtils';
import { VisualCursorHotspotModal } from '../VisualCursorHotspotModal';

export class ProjectInspector {
  public static getChapterHTML(ch: ChapterData, project: ProjectData | null, lockHeaderHTML: string): string {
    const idx = project?.chapters.indexOf(ch) ?? 0;
    return `
      ${lockHeaderHTML}
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

  public static getProjectHTML(project: ProjectData | null): string {
    if (!project) return '';
    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="form-input" id="proj-title" value="${project.title}" />
        </div>
        <div class="form-group">
          <label>UI Layout Preset</label>
          <select class="form-select" id="ui-preset">
            <option value="sierra" ${project.uiConfig.preset === 'sierra' ? 'selected' : ''}>Sierra Top Icon Bar</option>
            <option value="lucasarts" ${project.uiConfig.preset === 'lucasarts' ? 'selected' : ''}>LucasArts 9-Verbs Grid</option>
            <option value="context_coin" ${project.uiConfig.preset === 'context_coin' ? 'selected' : ''}>Curse of Monkey Island Pop-up Coin</option>
            <option value="direct_cursor" ${project.uiConfig.preset === 'direct_cursor' ? 'selected' : ''}>Direct Action Cursor Cycle</option>
          </select>
        </div>
        <div class="form-group">
          <label>Base Asset Folder</label>
          <input type="text" class="form-input" id="proj-base-folder" value="${project.assetBasePath || ''}" placeholder="e.g. demo or assets" />
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="color:var(--accent-gold);">📺 Game Viewport Frame</div>
        <div class="form-group">
          <label>Aspect Ratio Preset</label>
          <select class="form-select" id="proj-vp-preset">
            <option value="16:9" ${(project.viewportSettings?.aspectRatio || '16:9') === '16:9' ? 'selected' : ''}>16:9 Widescreen (1920x1080)</option>
            <option value="4:3" ${project.viewportSettings?.aspectRatio === '4:3' ? 'selected' : ''}>4:3 Retro Sierra (1440x1080)</option>
            <option value="16:10" ${project.viewportSettings?.aspectRatio === '16:10' ? 'selected' : ''}>16:10 Display (1920x1200)</option>
            <option value="21:9" ${project.viewportSettings?.aspectRatio === '21:9' ? 'selected' : ''}>21:9 Ultrawide (2560x1080)</option>
            <option value="1:1" ${project.viewportSettings?.aspectRatio === '1:1' ? 'selected' : ''}>1:1 Square (1080x1080)</option>
            <option value="custom" ${project.viewportSettings?.aspectRatio === 'custom' ? 'selected' : ''}>Custom Drag Box</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Width (px)</label>
            <input type="number" class="form-input" id="proj-vp-width" value="${project.viewportSettings?.width || 1920}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Height (px)</label>
            <input type="number" class="form-input" id="proj-vp-height" value="${project.viewportSettings?.height || 1080}" />
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px; font-style:italic;">
          💡 Tip: Drag cyan corner handles on canvas to visually resize the game frame!
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="color:var(--accent-gold);">🖱️ Custom Verb Cursors & Hotspots</div>
        ${([
          { id: 'walk', name: 'Walk', icon: '🥾' },
          { id: 'look', name: 'Look', icon: '👁️' },
          { id: 'interact', name: 'Interact / Touch', icon: '🖐️' },
          { id: 'talk', name: 'Talk', icon: '💬' },
          { id: 'pick_up', name: 'Pick Up', icon: '🎒' }
        ] as { id: VerbType; name: string; icon: string }[]).map(v => {
          const cfg = project?.uiConfig?.customCursors?.[v.id];
          const resolved = cfg?.url ? AssetManager.getInstance().resolveImageSrc(cfg.url) : '';
          return `
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:6px; padding:8px; margin-bottom:8px;">
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span>${v.icon}</span> <span>${v.name} Cursor</span>
                </div>
                ${cfg?.url ? `
                  <button class="btn btn-primary btn-open-cursor-hotspot-modal" data-verb="${v.id}" style="padding:2px 8px; font-size:0.68rem; font-weight:700; background:#059669; border:none; color:white;" title="Open visual interactive hotspot editor">
                    🎯 Calibrate Hotspot
                  </button>
                ` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">Graphic URL</label>
                <div style="display:flex; gap:6px; align-items:center;">
                  ${resolved ? `
                    <div style="width:30px; height:30px; min-width:30px; background:#1e293b; border:1px solid var(--border-color); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                      <img src="${resolved}" style="max-width:26px; max-height:26px; object-fit:contain;" />
                    </div>
                  ` : ''}
                  <input type="text" class="form-input proj-cursor-input" data-verb="${v.id}" value="${cfg?.url || ''}" placeholder="e.g. assets/cursors/${v.id}.png" style="flex:1; font-size:0.75rem;" />
                  <label class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; cursor:pointer; margin:0;" title="Browse cursor file">
                    📁
                    <input type="file" class="proj-cursor-file" data-verb="${v.id}" accept="image/*" style="display:none;" />
                  </label>
                </div>
              </div>
              <div style="display:flex; gap:8px; align-items:flex-end;">
                <div style="flex:1;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Hotspot X (px)</label>
                  <input type="number" class="form-input proj-cursor-hx" data-verb="${v.id}" value="${cfg?.hotspotX ?? 0}" placeholder="0" style="font-size:0.75rem;" />
                </div>
                <div style="flex:1;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Hotspot Y (px)</label>
                  <input type="number" class="form-input proj-cursor-hy" data-verb="${v.id}" value="${cfg?.hotspotY ?? 0}" placeholder="0" style="font-size:0.75rem;" />
                </div>
                ${cfg?.url ? `
                  <button class="btn btn-secondary btn-open-cursor-hotspot-modal" data-verb="${v.id}" style="padding:4px 8px; font-size:0.75rem; height:28px;" title="Visually drag hotspot">
                    🎯
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
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

    // Chapter inputs
    container.querySelectorAll('.ch-title').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.chapters[idx]) {
          project.chapters[idx].title = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.ch-desc').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.idx!);
        if (project.chapters[idx]) {
          project.chapters[idx].description = (e.target as HTMLTextAreaElement).value;
          onUpdate();
        }
      });
    });

    // Project metadata
    const projTitle = container.querySelector('#proj-title') as HTMLInputElement;
    if (projTitle) {
      projTitle.addEventListener('input', () => {
        project.title = projTitle.value;
        onUpdate();
      });
    }

    const projBase = container.querySelector('#proj-base-folder') as HTMLInputElement;
    if (projBase) {
      projBase.addEventListener('input', () => {
        project.assetBasePath = projBase.value.trim();
        onUpdate();
      });
    }

    const uiPreset = container.querySelector('#ui-preset') as HTMLSelectElement;
    if (uiPreset) {
      uiPreset.addEventListener('change', () => {
        const preset = uiPreset.value as UIPresetType;
        project.uiConfig.preset = preset;
        EventBus.getInstance().emit('editor:change_preset', preset);
        onUpdate();
      });
    }

    // Viewport Settings
    const vpPreset = container.querySelector('#proj-vp-preset') as HTMLSelectElement;
    const vpW = container.querySelector('#proj-vp-width') as HTMLInputElement;
    const vpH = container.querySelector('#proj-vp-height') as HTMLInputElement;

    const updateViewportConfig = (preset: AspectRatioType, width: number, height: number) => {
      if (!project.viewportSettings) {
        project.viewportSettings = { aspectRatio: preset, width, height, x: 0, y: 0 };
      } else {
        project.viewportSettings.aspectRatio = preset;
        project.viewportSettings.width = width;
        project.viewportSettings.height = height;
      }
      if (vpW) vpW.value = width.toString();
      if (vpH) vpH.value = height.toString();
      onUpdate();
      EventBus.getInstance().emit('editor:viewport_updated', project.viewportSettings);
    };

    if (vpPreset) {
      vpPreset.addEventListener('change', () => {
        const val = vpPreset.value as AspectRatioType;
        if (val === '16:9') updateViewportConfig(val, 1920, 1080);
        else if (val === '4:3') updateViewportConfig(val, 1440, 1080);
        else if (val === '16:10') updateViewportConfig(val, 1920, 1200);
        else if (val === '21:9') updateViewportConfig(val, 2560, 1080);
        else if (val === '1:1') updateViewportConfig(val, 1080, 1080);
      });
    }

    if (vpW) {
      vpW.addEventListener('input', () => {
        const w = parseInt(vpW.value) || 1920;
        const h = parseInt(vpH?.value) || 1080;
        if (vpPreset) vpPreset.value = 'custom';
        updateViewportConfig('custom', w, h);
      });
    }

    if (vpH) {
      vpH.addEventListener('input', () => {
        const w = parseInt(vpW?.value) || 1920;
        const h = parseInt(vpH.value) || 1080;
        if (vpPreset) vpPreset.value = 'custom';
        updateViewportConfig('custom', w, h);
      });
    }

    // Custom Cursors
    container.querySelectorAll('.proj-cursor-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const verb = (e.target as HTMLElement).dataset.verb as VerbType;
        const val = (e.target as HTMLInputElement).value.trim();
        if (!project.uiConfig.customCursors) project.uiConfig.customCursors = {};
        if (!project.uiConfig.customCursors[verb]) project.uiConfig.customCursors[verb] = { url: '', hotspotX: 0, hotspotY: 0 };
        project.uiConfig.customCursors[verb]!.url = val;
        onUpdate();
      });
    });

    container.querySelectorAll('.proj-cursor-file').forEach(input => {
      input.addEventListener('change', (e) => {
        const verb = (e.target as HTMLElement).dataset.verb as VerbType;
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const relPath = resolvePickedAssetPath(file, 'cursors', null, project);
          if (!project.uiConfig.customCursors) project.uiConfig.customCursors = {};
          if (!project.uiConfig.customCursors[verb]) project.uiConfig.customCursors[verb] = { url: '', hotspotX: 0, hotspotY: 0 };
          project.uiConfig.customCursors[verb]!.url = relPath;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.proj-cursor-hx').forEach(input => {
      input.addEventListener('input', (e) => {
        const verb = (e.target as HTMLElement).dataset.verb as VerbType;
        const val = parseInt((e.target as HTMLInputElement).value) || 0;
        if (!project.uiConfig.customCursors) project.uiConfig.customCursors = {};
        if (!project.uiConfig.customCursors[verb]) project.uiConfig.customCursors[verb] = { url: '', hotspotX: 0, hotspotY: 0 };
        project.uiConfig.customCursors[verb]!.hotspotX = val;
        onUpdate();
      });
    });

    container.querySelectorAll('.proj-cursor-hy').forEach(input => {
      input.addEventListener('input', (e) => {
        const verb = (e.target as HTMLElement).dataset.verb as VerbType;
        const val = parseInt((e.target as HTMLInputElement).value) || 0;
        if (!project.uiConfig.customCursors) project.uiConfig.customCursors = {};
        if (!project.uiConfig.customCursors[verb]) project.uiConfig.customCursors[verb] = { url: '', hotspotX: 0, hotspotY: 0 };
        project.uiConfig.customCursors[verb]!.hotspotY = val;
        onUpdate();
      });
    });

    container.querySelectorAll('.btn-open-cursor-hotspot-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const verb = (e.currentTarget as HTMLElement).dataset.verb as VerbType;
        const cfg = project.uiConfig?.customCursors?.[verb];
        if (cfg?.url) {
          VisualCursorHotspotModal.open({
            verb,
            cursorUrl: cfg.url,
            initialHotspotX: cfg.hotspotX ?? 0,
            initialHotspotY: cfg.hotspotY ?? 0,
            onSave: (res) => {
              if (!project.uiConfig.customCursors) project.uiConfig.customCursors = {};
              if (!project.uiConfig.customCursors[verb]) project.uiConfig.customCursors[verb] = { url: cfg.url, hotspotX: 0, hotspotY: 0 };
              project.uiConfig.customCursors[verb]!.hotspotX = res.hotspotX;
              project.uiConfig.customCursors[verb]!.hotspotY = res.hotspotY;
              onReRender();
              onUpdate();
            }
          });
        }
      });
    });
  }
}
