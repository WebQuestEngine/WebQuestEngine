import { SceneData, ProjectData } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath, handleFileInputChange } from '../../utils/AssetPathUtils';
import { SceneInspectorTemplate } from './templates/SceneInspector.template';

export class SceneInspector {
  public static getSceneHTML(scene: SceneData, project: ProjectData | null, lockHeaderHTML: string): string {
    return SceneInspectorTemplate.scene(scene, project, lockHeaderHTML);
  }

  public static getWalkPathHTML(scene: SceneData, lockHeaderHTML: string): string {
    return SceneInspectorTemplate.walkPath(scene, lockHeaderHTML);
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

    // Playable Character selection
    const scPlayableChar = container.querySelector('#sc-playable-char') as HTMLSelectElement;
    if (scPlayableChar) {
      scPlayableChar.addEventListener('change', () => {
        currentScene.playerCharacterId = scPlayableChar.value;
        onUpdate();
        EventBus.getInstance().emit('editor:select_target', { type: 'scene', id: currentScene.id });
      });
    }

    // Add Character to Scene
    container.querySelector('#btn-add-char-to-scene')?.addEventListener('click', () => {
      const allChars = project?.characters || [];
      if (allChars.length === 0) {
        if (!project) return;
        if (!project.characters) project.characters = [];
        const newChar = {
          id: `char_${Date.now()}`,
          name: 'Hero',
          spriteSheetUrl: '',
          frameWidth: 64,
          frameHeight: 96,
          speed: 200,
          scale: 1,
          talkColor: '#fbbf24',
          animations: {}
        };
        project.characters.push(newChar);
        currentScene.characters.push({
          characterId: newChar.id,
          position: { x: 500, y: 750 }
        });
      } else {
        const unplaced = allChars.find(c => !currentScene.characters.some(scChar => (scChar.characterId || scChar.id) === c.id));
        const targetChar = unplaced || allChars[0];
        currentScene.characters.push({
          characterId: targetChar.id,
          position: { x: 500, y: 750 }
        });
      }
      onReRender();
      onUpdate();
    });

    // Select character in scene
    container.querySelectorAll('.btn-select-scene-char').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const charId = (e.currentTarget as HTMLElement).dataset.charid;
        if (charId) {
          EventBus.getInstance().emit('editor:select_target', { type: 'character', sceneId: currentScene.id, id: charId });
        }
      });
    });

    // Remove character from scene
    container.querySelectorAll('.btn-del-scene-char').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
        if (!isNaN(idx) && currentScene.characters[idx]) {
          currentScene.characters.splice(idx, 1);
          onReRender();
          onUpdate();
        }
      });
    });

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
