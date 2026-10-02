import { Graphics } from 'pixi.js';
import { Vector2D, ViewportSettings } from '../types';
import { Scene } from '../scene/Scene';

export interface LetterboxMetrics {
  vpX: number;
  vpY: number;
  vpW: number;
  vpH: number;
  playScale: number;
  offsetX: number;
  offsetY: number;
  viewW: number;
  viewH: number;
}

export class LetterboxManager {
  private viewportMask: Graphics;

  constructor() {
    this.viewportMask = new Graphics();
  }

  public computeMetrics(
    cameraViewport: { width: number; height: number },
    viewportSettings?: ViewportSettings
  ): LetterboxMetrics {
    const vp = viewportSettings || { width: 1920, height: 1080, x: 0, y: 0 };
    const vpW = vp.width || 1920;
    const vpH = vp.height || 1080;
    const vpX = vp.x ?? 0;
    const vpY = vp.y ?? 0;

    const viewW = cameraViewport.width;
    const viewH = cameraViewport.height;

    const scaleX = viewW / vpW;
    const scaleY = viewH / vpH;
    const playScale = Math.min(scaleX, scaleY);

    const offsetX = (viewW - vpW * playScale) / 2;
    const offsetY = (viewH - vpH * playScale) / 2;

    return {
      vpX,
      vpY,
      vpW,
      vpH,
      playScale,
      offsetX,
      offsetY,
      viewW,
      viewH
    };
  }

  public applyLetterbox(
    scene: Scene | null | undefined,
    cameraViewport: { width: number; height: number },
    viewportSettings?: ViewportSettings
  ): void {
    if (!scene || !scene.container || (scene.container as any).destroyed) return;

    const metrics = this.computeMetrics(cameraViewport, viewportSettings);

    if (!this.viewportMask || (this.viewportMask as any).destroyed || (this.viewportMask as any).context === null) {
      this.viewportMask = new Graphics();
      scene.container.addChild(this.viewportMask);
    } else if (this.viewportMask.parent !== scene.container) {
      scene.container.addChild(this.viewportMask);
    }

    this.viewportMask.visible = true;
    this.viewportMask.clear();
    this.viewportMask.rect(metrics.vpX, metrics.vpY, metrics.vpW, metrics.vpH);
    this.viewportMask.fill({ color: 0xffffff });
    scene.container.mask = this.viewportMask;

    scene.container.scale.set(metrics.playScale, metrics.playScale);
    scene.container.pivot.set(metrics.vpX, metrics.vpY);
    scene.container.x = metrics.offsetX;
    scene.container.y = metrics.offsetY;
  }

  public screenToWorld(
    canvas: HTMLCanvasElement,
    screenX: number,
    screenY: number,
    cameraViewport: { width: number; height: number },
    viewportSettings?: ViewportSettings
  ): Vector2D {
    const rect = canvas.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    const m = this.computeMetrics(cameraViewport, viewportSettings);
    return {
      x: Math.round(m.vpX + (relX - m.offsetX) / m.playScale),
      y: Math.round(m.vpY + (relY - m.offsetY) / m.playScale)
    };
  }

  public worldToScreen(
    worldPoint: Vector2D,
    cameraViewport: { width: number; height: number },
    viewportSettings?: ViewportSettings
  ): Vector2D {
    const m = this.computeMetrics(cameraViewport, viewportSettings);
    return {
      x: Math.round(m.offsetX + (worldPoint.x - m.vpX) * m.playScale),
      y: Math.round(m.offsetY + (worldPoint.y - m.vpY) * m.playScale)
    };
  }

  public getCharacterScreenPos(
    scene: Scene | null,
    cameraViewport: { width: number; height: number },
    viewportSettings?: ViewportSettings,
    speakerName?: string
  ): Vector2D | null {
    if (!scene) return null;

    const chars = Array.from(scene.characters.values());
    let targetChar = null;
    if (speakerName) {
      targetChar = chars.find(c =>
        c.data.name.toLowerCase() === speakerName.toLowerCase() ||
        c.data.id.toLowerCase() === speakerName.toLowerCase()
      );
    }

    if (!targetChar && scene.playerCharacter) {
      targetChar = scene.playerCharacter;
    }

    if (!targetChar) return null;

    const worldX = targetChar.container.x || targetChar.position.x;
    const worldY = (targetChar.container.y || targetChar.position.y) - 145;

    return this.worldToScreen({ x: worldX, y: worldY }, cameraViewport, viewportSettings);
  }

  public detachMask(): void {
    if (this.viewportMask && this.viewportMask.parent) {
      this.viewportMask.parent.removeChild(this.viewportMask);
    }
  }

  public destroy(): void {
    this.detachMask();
    if (this.viewportMask && !(this.viewportMask as any).destroyed) {
      this.viewportMask.destroy();
    }
  }
}
