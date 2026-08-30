import { ProjectData, ChapterData, VerbType } from '../../../../engine/types';
import { AssetManager } from '../../../../engine/core/AssetManager';
import { TemplateUtils } from '../../../utils/TemplateUtils';

import chapterHtml from './ProjectInspector.html?raw';
import cursorCardHtml from './ProjectCursorCard.html?raw';

const VERB_DEFS: { id: VerbType; name: string; icon: string }[] = [
  { id: 'walk', name: 'Walk', icon: '🥾' },
  { id: 'look', name: 'Look', icon: '👁️' },
  { id: 'interact', name: 'Interact / Touch', icon: '🖐️' },
  { id: 'talk', name: 'Talk', icon: '💬' },
  { id: 'pick_up', name: 'Pick Up', icon: '🎒' },
];

export class ProjectInspectorTemplate {
  /** Renders the chapter card HTML for a single chapter. */
  public static chapter(ch: ChapterData, project: ProjectData | null, lockHeaderHTML: string): string {
    const idx = project?.chapters.indexOf(ch) ?? 0;
    return TemplateUtils.populate(chapterHtml, {
      lockHeaderHTML,
      idx,
      title: TemplateUtils.escapeHtml(ch.title),
      id: TemplateUtils.escapeHtml(ch.id),
      description: TemplateUtils.escapeHtml(ch.description || ''),
    });
  }

  /** Renders the full project settings HTML (metadata + viewport + cursors). */
  public static project(project: ProjectData): string {
    const vp = project.viewportSettings;
    const aspectRatioOptions = [
      { value: '16:9', label: '16:9 Widescreen (1920x1080)' },
      { value: '4:3', label: '4:3 Retro Sierra (1440x1080)' },
      { value: '16:10', label: '16:10 Display (1920x1200)' },
      { value: '21:9', label: '21:9 Ultrawide (2560x1080)' },
      { value: '1:1', label: '1:1 Square (1080x1080)' },
      { value: 'custom', label: 'Custom Drag Box' },
    ];
    const vpPresetOptions = aspectRatioOptions.map(opt =>
      `<option value="${opt.value}" ${(vp?.aspectRatio || '16:9') === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    const uiPresetOptions = [
      { value: 'sierra', label: 'Sierra Top Icon Bar' },
      { value: 'lucasarts', label: 'LucasArts 9-Verbs Grid' },
      { value: 'context_coin', label: 'Curse of Monkey Island Pop-up Coin' },
      { value: 'direct_cursor', label: 'Direct Action Cursor Cycle' },
    ].map(opt =>
      `<option value="${opt.value}" ${project.uiConfig.preset === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    const cursorsHTML = VERB_DEFS.map(v => {
      const cfg = project.uiConfig?.customCursors?.[v.id];
      const resolved = cfg?.url ? AssetManager.getInstance().resolveImageSrc(cfg.url) : '';

      const thumbnailHTML = resolved
        ? `<div style="width:30px; height:30px; min-width:30px; background:#1e293b; border:1px solid var(--border-color); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
             <img src="${resolved}" style="max-width:26px; max-height:26px; object-fit:contain;" />
           </div>`
        : '';

      const calibrateBtn = cfg?.url
        ? `<button class="btn btn-primary btn-open-cursor-hotspot-modal" data-verb="${v.id}" style="padding:2px 8px; font-size:0.68rem; font-weight:700; background:#059669; border:none; color:white;" title="Open visual interactive hotspot editor">
             🎯 Calibrate Hotspot
           </button>`
        : '';

      const calibrateBtnSmall = cfg?.url
        ? `<button class="btn btn-secondary btn-open-cursor-hotspot-modal" data-verb="${v.id}" style="padding:4px 8px; font-size:0.75rem; height:28px;" title="Visually drag hotspot">
             🎯
           </button>`
        : '';

      return TemplateUtils.populate(cursorCardHtml, {
        icon: v.icon,
        name: TemplateUtils.escapeHtml(v.name),
        verbId: v.id,
        cursorUrl: TemplateUtils.escapeHtml(cfg?.url || ''),
        thumbnailHTML,
        hotspotX: cfg?.hotspotX ?? 0,
        hotspotY: cfg?.hotspotY ?? 0,
        calibrateButtonTopHTML: calibrateBtn,
        calibrateButtonBottomHTML: calibrateBtnSmall,
      });
    }).join('');

    return `
      <div class="sidebar-section">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="form-input" id="proj-title" value="${TemplateUtils.escapeHtml(project.title)}" />
        </div>
        <div class="form-group">
          <label>UI Layout Preset</label>
          <select class="form-select" id="ui-preset">${uiPresetOptions}</select>
        </div>
        <div class="form-group">
          <label>Base Asset Folder</label>
          <input type="text" class="form-input" id="proj-base-folder" value="${TemplateUtils.escapeHtml(project.assetBasePath || '')}" placeholder="e.g. demo or assets" />
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="color:var(--accent-gold);">📺 Game Viewport Frame</div>
        <div class="form-group">
          <label>Aspect Ratio Preset</label>
          <select class="form-select" id="proj-vp-preset">${vpPresetOptions}</select>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Width (px)</label>
            <input type="number" class="form-input" id="proj-vp-width" value="${vp?.width || 1920}" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Height (px)</label>
            <input type="number" class="form-input" id="proj-vp-height" value="${vp?.height || 1080}" />
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px; font-style:italic;">
          💡 Tip: Drag cyan corner handles on canvas to visually resize the game frame!
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="color:var(--accent-gold);">🖱️ Custom Verb Cursors &amp; Hotspots</div>
        ${cursorsHTML}
      </div>
    `;
  }
}
