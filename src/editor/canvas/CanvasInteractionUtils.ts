import { Vector2D, ProjectData, SceneData } from '../../engine/types';
import { Camera } from '../../engine/core/Camera';
import { Scene } from '../../engine/scene/Scene';

export class CanvasInteractionUtils {
  public static distanceToSegment(p: Vector2D, v: Vector2D, w: Vector2D): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  public static isElementLocked(project: ProjectData | null, currentScene: Scene | null, type: string, id?: string): boolean {
    if (!project || !currentScene) return false;
    const scene = currentScene.data;

    // Check parent scene lock
    if (scene.locked) return true;

    // Check containing chapter lock
    const ch = project.chapters?.find(c => {
      const node = project.storyNodes?.find(n => n.id === c.startStoryNodeId);
      return node?.sceneId === scene.id;
    });
    if (ch?.locked) return true;

    if (type === 'layer' && id) {
      const l = scene.layers.find(x => x.id === id);
      return !!l?.locked;
    } else if (type === 'hotspot' && id) {
      const h = scene.hotspots.find(x => x.id === id);
      return !!h?.locked;
    } else if (type === 'character' && id) {
      const defLocked = project?.characters?.find(x => x.id === id)?.locked;
      const c = scene.characters.find(x => (x.characterId || x.id) === id);
      return !!defLocked || !!c?.locked;
    } else if (type === 'walkpath') {
      const wp = scene.walkPaths?.[0];
      return !!wp?.locked;
    }
    return false;
  }

  public static getWorldPoint(
    canvas: HTMLCanvasElement,
    camera: Camera,
    currentScene: Scene | null,
    containerElement: HTMLElement,
    clientX: number,
    clientY: number
  ): Vector2D {
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    if (!currentScene) return { x: 0, y: 0 };

    const sceneWidth = currentScene.data.width || 1920;
    const sceneHeight = currentScene.data.height || 1080;

    const viewCenterX = (containerElement.clientWidth || window.innerWidth) / 2;
    const viewCenterY = (containerElement.clientHeight || window.innerHeight) / 2;

    const sceneCenterX = sceneWidth / 2;
    const sceneCenterY = sceneHeight / 2;

    const worldX = Math.round(sceneCenterX + (screenX - (viewCenterX + camera.panOffset.x)) / camera.zoom);
    const worldY = Math.round(sceneCenterY + (screenY - (viewCenterY + camera.panOffset.y)) / camera.zoom);
    return { x: worldX, y: worldY };
  }
}
