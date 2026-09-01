import { ProjectData, SceneData } from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';

export type AssetCategory = 'audio' | 'characters' | 'cursors' | 'items' | 'images' | 'layers' | 'video';

export function normalizeImagePath(pathStr: string): string {
  if (!pathStr) return '';
  let normalized = pathStr.replace(/\\/g, '/');
  if (normalized.startsWith('file://')) normalized = normalized.replace(/^file:\/\//, '');
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:') || normalized.startsWith('procedural:')) {
    return normalized;
  }
  const assetsIndex = normalized.indexOf('/assets/');
  if (assetsIndex !== -1) return normalized.substring(assetsIndex + 1);
  const demoIndex = normalized.indexOf('/demo/');
  if (demoIndex !== -1) return normalized.substring(demoIndex + 1);
  return normalized;
}

/**
 * Resolves the effective base folder path for a scene or project.
 * E.g., if project base is "assets" and scene base is "c1s1", resolves to "assets/c1s1".
 * If scene base is not defined, returns the project base (defaulting to "assets").
 */
export function getEffectiveBasePath(scene?: SceneData | null, project?: ProjectData | null): string {
  const projBase = (project?.assetBasePath?.trim() || 'assets').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const sceneBase = scene?.assetBasePath?.trim()?.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  if (!sceneBase) {
    return projBase || 'assets';
  }

  // If sceneBase already starts with projBase (e.g. "assets/c1s1" starts with "assets"), use sceneBase
  if (projBase && (sceneBase === projBase || sceneBase.startsWith(`${projBase}/`))) {
    return sceneBase;
  }

  // Otherwise, automatically prefix with parent project base path (e.g. "assets" + "c1s1" => "assets/c1s1")
  if (projBase) {
    return `${projBase}/${sceneBase}`;
  }

  return sceneBase;
}

/**
 * Combines the active base folder of the scene or project with the asset category folder and filename.
 * E.g., scene base `assets/c1s1` + audio + `bgm.mp3` => `assets/c1s1/audio/bgm.mp3`
 * E.g., project base `assets` + items + `key.png` => `assets/items/key.png`
 */
export function resolvePickedAssetPath(
  file: File,
  category: AssetCategory,
  scene?: SceneData | null,
  project?: ProjectData | null
): string {
  // 1. Try to extract relative path from path properties if available
  const fullPath = (file as any).path || '';
  if (fullPath) {
    const normalized = normalizeImagePath(fullPath);
    if (normalized && normalized !== file.name) {
      AssetManager.getInstance().trackFileFolder(fullPath);
      return normalized;
    }
  }

  if (file.webkitRelativePath && file.webkitRelativePath.trim() !== '') {
    const normalized = normalizeImagePath(file.webkitRelativePath);
    if (normalized && normalized !== file.name) {
      AssetManager.getInstance().trackFileFolder(file.webkitRelativePath);
      return normalized;
    }
  }

  // Resolve the effective base path: automatically nested under project base
  const projBase = (project?.assetBasePath?.trim() || 'assets').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const effectiveBase = getEffectiveBasePath(scene, project);
  const fileName = file.name;

  if (category === 'audio') {
    if (effectiveBase.endsWith('/audio') || effectiveBase === 'audio') {
      return `${effectiveBase}/${fileName}`;
    }
    return `${effectiveBase}/audio/${fileName}`;
  }

  if (category === 'video') {
    if (effectiveBase.endsWith('/video') || effectiveBase === 'video') {
      return `${effectiveBase}/${fileName}`;
    }
    return `${effectiveBase}/video/${fileName}`;
  }

  if (category === 'cursors') {
    const base = projBase || effectiveBase;
    if (base.endsWith('/cursors') || base === 'cursors') {
      return `${base}/${fileName}`;
    }
    return `${base}/cursors/${fileName}`;
  }

  if (category === 'items') {
    const base = projBase || effectiveBase;
    if (base.endsWith('/items') || base === 'items') {
      return `${base}/${fileName}`;
    }
    return `${base}/items/${fileName}`;
  }

  if (category === 'characters') {
    const base = projBase || 'assets';
    if (base.endsWith('/characters') || base === 'characters') {
      return `${base}/${fileName}`;
    }
    return `${base}/characters/${fileName}`;
  }

  // For all image-like assets (images, layers)
  // place them under the effective scene base folder
  return `${effectiveBase}/${fileName}`;
}

export function getRelativeFilePath(
  file: File,
  category: AssetCategory = 'images',
  scene?: SceneData | null,
  project?: ProjectData | null
): string {
  return resolvePickedAssetPath(file, category, scene, project);
}

/**
 * Opens the standard native OS directory picker dialog (showDirectoryPicker)
 * to select a base asset folder.
 */
export async function pickFolderPath(callback: (folderPath: string) => void): Promise<void> {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await (window as any).showDirectoryPicker();
      if (handle && handle.name) {
        callback(handle.name);
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled in OS dialog
      console.warn('showDirectoryPicker error', err);
    }
  }

  // Fallback for browsers without File System Access API
  const input = document.createElement('input');
  input.type = 'file';
  input.setAttribute('webkitdirectory', '');
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = () => {
    const files = input.files;
    document.body.removeChild(input);
    if (!files || files.length === 0) return;
    const rel = files[0].webkitRelativePath || '';
    if (rel) {
      callback(rel.split('/')[0]);
      return;
    }
    callback(files[0].name.replace(/\.[^.]+$/, ''));
  };

  input.click();
}

export function handleFileInputChange(
  file: File,
  category: AssetCategory,
  scene: SceneData | null | undefined,
  project: ProjectData | null | undefined,
  callback: (cleanUrl: string) => void
): void {
  if (!file) return;
  const cleanUrl = resolvePickedAssetPath(file, category, scene, project);

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string;
    if (dataUrl) {
      await AssetManager.getInstance().cacheDataUrl(cleanUrl, dataUrl);
      callback(cleanUrl);
    }
  };
  reader.readAsDataURL(file);
}

export function getThumbnailHTML(url: string | undefined): string {
  if (!url) {
    return `<div class="inspector-thumbnail-box" title="No graphic loaded"><span style="font-size:1.1rem; opacity:0.3;">🖼️</span></div>`;
  }

  if (url.startsWith('procedural:')) {
    const type = url.replace('procedural:', '');
    let bg = '#3b82f6';
    let icon = '🎨';
    if (type.includes('shrub')) { bg = '#15803d'; icon = '🌿'; }
    else if (type.includes('lab')) { bg = '#581c87'; icon = '🧪'; }
    else if (type.includes('castle')) { bg = '#334155'; icon = '🏰'; }
    else if (type.includes('cauldron')) { bg = '#065f46'; icon = '🥣'; }
    else if (type.includes('hero') || type.includes('npc')) { bg = '#1e3a8a'; icon = '👤'; }
    return `<div class="inspector-thumbnail-box" style="background:${bg};" title="${url}"><span style="font-size:1.1rem;">${icon}</span></div>`;
  }

  const resolved = AssetManager.getInstance().resolveImageSrc(url);
  return `
    <div class="inspector-thumbnail-box" title="${url}">
      <img src="${resolved}" alt="thumb" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
      <span style="font-size:1.1rem; display:none;">⚠️</span>
    </div>
  `;
}
