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
 * Combines the active base folder of the scene or project with the asset category folder and filename.
 * E.g., scene base `assets/scene1` + audio + `look_at_object.mp3` => `assets/scene1/audio/look_at_object.mp3`
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

  // Resolve the effective base path: scene overrides project, both override 'assets'
  const rawBase = scene?.assetBasePath?.trim() || project?.assetBasePath?.trim() || 'assets';
  const cleanBase = rawBase.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  const fileName = file.name;

  if (category === 'audio') {
    if (cleanBase.endsWith('/audio') || cleanBase === 'audio') {
      return `${cleanBase}/${fileName}`;
    }
    return `${cleanBase}/audio/${fileName}`;
  }

  if (category === 'video') {
    if (cleanBase.endsWith('/video') || cleanBase === 'video') {
      return `${cleanBase}/${fileName}`;
    }
    return `${cleanBase}/video/${fileName}`;
  }

  if (category === 'cursors') {
    if (cleanBase.endsWith('/cursors') || cleanBase === 'cursors') {
      return `${cleanBase}/${fileName}`;
    }
    return `${cleanBase}/cursors/${fileName}`;
  }

  if (category === 'items') {
    if (cleanBase.endsWith('/items') || cleanBase === 'items') {
      return `${cleanBase}/${fileName}`;
    }
    return `${cleanBase}/items/${fileName}`;
  }

  if (category === 'characters') {
    if (cleanBase.endsWith('/characters') || cleanBase === 'characters') {
      return `${cleanBase}/${fileName}`;
    }
    if (scene?.assetBasePath && scene.assetBasePath.trim() !== '') {
      return `${cleanBase}/${fileName}`;
    }
    return `${cleanBase}/characters/${fileName}`;
  }

  // For all image-like assets (images, layers)
  // just place them under the effective base folder
  return `${cleanBase}/${fileName}`;
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
