import { CharacterData, SkeletalVisualConfig, ProjectData } from '../../engine/types';
import { SkeletalImporter } from '../../engine/visualization/SkeletalImporter';
import { EventBus } from '../../engine/core/EventBus';
import { AssetManager } from '../../engine/core/AssetManager';

export class SkeletalCharacterModal {
  public static open(opts: {
    character: CharacterData;
    project: ProjectData | null;
    onSave?: (savedConfig: SkeletalVisualConfig) => void;
  }): void {
    const { character: char, project, onSave } = opts;

    const overlay = document.createElement('div');
    overlay.className = 'sprite-picker-overlay';
    overlay.style.zIndex = '9999';

    // Full-screen modal container
    overlay.innerHTML = `
      <div class="sprite-picker-modal" style="width: 95vw; height: 92vh; max-width: 1600px; padding: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
        <iframe 
          id="rig-studio-iframe" 
          src="/rig-studio.html?mode=embedded" 
          style="width: 100%; height: 100%; border: none; background: #090d16;"
        ></iframe>
      </div>
    `;

    document.body.appendChild(overlay);

    const iframe = overlay.querySelector('#rig-studio-iframe') as HTMLIFrameElement;

    // Resolve texture URL from character
    let textureUrl = (char.visual && char.visual.type === 'skeletal' && char.visual.textureUrl)
      ? char.visual.textureUrl
      : '';

    if (!textureUrl && char.spriteSheetUrl && !char.spriteSheetUrl.startsWith('procedural:')) {
      textureUrl = AssetManager.getInstance().resolveImageSrc(char.spriteSheetUrl);
    }

    // Resolve Spine document if already present
    const spineDoc = (char.visual && char.visual.type === 'skeletal' && (char.visual as any).spineDoc)
      ? (char.visual as any).spineDoc
      : null;

    const messageHandler = (event: MessageEvent) => {
      // Security check: ensure event source is our iframe
      if (event.source !== iframe.contentWindow) return;

      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'STUDIO_READY') {
        iframe.contentWindow?.postMessage({
          type: 'STUDIO_INIT',
          payload: {
            characterName: char.name,
            characterId: char.id,
            textureUrl,
            spineData: spineDoc
          }
        }, '*');
      } else if (data.type === 'STUDIO_SAVE') {
        const spineData = data.payload?.spineData;
        const savedTexUrl = data.payload?.textureUrl || textureUrl;

        if (spineData) {
          const config = SkeletalImporter.importSpineJson(spineData, savedTexUrl);
          char.visual = config;

          if (project?.characters) {
            const found = project.characters.find(c => c.id === char.id);
            if (found) {
              found.visual = config;
            }
          }

          if (onSave) {
            onSave(config);
          }

          EventBus.getInstance().emit('ENTITY_SELECTED', {
            type: 'character',
            id: char.id,
            character: char
          });
        }

        cleanupAndClose();
      } else if (data.type === 'STUDIO_CLOSE') {
        cleanupAndClose();
      }
    };

    window.addEventListener('message', messageHandler);

    const cleanupAndClose = () => {
      window.removeEventListener('message', messageHandler);
      overlay.remove();
    };

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanupAndClose();
      }
    });
  }
}
