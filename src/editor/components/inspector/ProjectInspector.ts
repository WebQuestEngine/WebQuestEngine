import { ProjectData, ChapterData, VerbType, AspectRatioType, UIPresetType } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath, pickFolderPath } from '../../utils/AssetPathUtils';
import { VisualCursorHotspotModal } from '../VisualCursorHotspotModal';
import { ProjectInspectorTemplate } from './templates/ProjectInspector.template';

export class ProjectInspector {
  public static getChapterHTML(ch: ChapterData, project: ProjectData | null, lockHeaderHTML: string): string {
    return ProjectInspectorTemplate.chapter(ch, project, lockHeaderHTML);
  }

  public static getProjectHTML(project: ProjectData | null): string {
    if (!project) return '';
    return ProjectInspectorTemplate.project(project);
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

    container.querySelector('#btn-pick-proj-base-folder')?.addEventListener('click', async () => {
      await pickFolderPath((folderPath) => {
        project.assetBasePath = folderPath;
        if (projBase) projBase.value = folderPath;
        onUpdate();
      });
    });

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
