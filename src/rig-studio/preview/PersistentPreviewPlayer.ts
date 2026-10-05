import * as PIXI from 'pixi.js';
import { SpineDocument } from '../types';

export class PersistentPreviewPlayer {
  private container: HTMLElement;
  private app: PIXI.Application | null = null;
  private rootStageContainer: PIXI.Container | null = null;
  private boneGraphicsContainer: PIXI.Container | null = null;

  private currentDoc: SpineDocument | null = null;
  private currentAnimation = 'idle';
  private playbackSpeed = 1.0;
  private isPlaying = true;
  private animTimer = 0;
  private tickerRef: any = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initPixi().catch(console.error);
  }

  private async initPixi(): Promise<void> {
    this.app = new PIXI.Application();
    await this.app.init({
      width: 316,
      height: 220,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    this.container.appendChild(this.app.canvas);

    this.rootStageContainer = new PIXI.Container();
    this.rootStageContainer.x = 158;
    this.rootStageContainer.y = 180;
    this.app.stage.addChild(this.rootStageContainer);

    this.boneGraphicsContainer = new PIXI.Container();
    this.rootStageContainer.addChild(this.boneGraphicsContainer);

    this.tickerRef = (ticker: any) => {
      if (!this.isPlaying) return;
      const delta = (ticker.deltaTime / 60) * this.playbackSpeed;
      this.update(delta);
    };
    this.app.ticker.add(this.tickerRef);
  }

  public setSpineDocument(doc: SpineDocument): void {
    this.currentDoc = doc;
    const animNames = Object.keys(doc.animations || {});
    if (!animNames.includes(this.currentAnimation)) {
      this.currentAnimation = animNames[0] || 'idle';
    }
    this.rebuildSkeleton();
  }

  public setAnimation(animName: string): void {
    this.currentAnimation = animName;
    this.animTimer = 0;
  }

  public setSpeed(speed: number): void {
    this.playbackSpeed = speed;
  }

  public togglePlay(play?: boolean): void {
    this.isPlaying = play !== undefined ? play : !this.isPlaying;
  }

  private rebuildSkeleton(): void {
    if (!this.boneGraphicsContainer || !this.currentDoc) return;
    this.boneGraphicsContainer.removeChildren();

    // Draw simple bone rig visualization
    const bones = this.currentDoc.bones || [];
    for (const b of bones) {
      const gfx = new PIXI.Graphics();
      const length = b.length || 20;

      // Joint circle
      gfx.circle(0, 0, 4);
      gfx.fill({ color: 0x0284c7 });

      // Bone body
      gfx.roundRect(0, -3, length, 6, 2);
      gfx.fill({ color: 0x38bdf8 });

      // End joint
      gfx.circle(length, 0, 3);
      gfx.fill({ color: 0x0284c7 });

      gfx.label = b.name;
      gfx.x = b.x;
      gfx.y = b.y;
      gfx.rotation = ((b.rotation || 0) * Math.PI) / 180;

      this.boneGraphicsContainer.addChild(gfx);
    }
  }

  private update(delta: number): void {
    if (!this.currentDoc || !this.boneGraphicsContainer) return;
    this.animTimer += delta;

    const animTrack = this.currentDoc.animations?.[this.currentAnimation];
    if (!animTrack || !animTrack.bones) return;

    // Loop duration (calculate max keyframe time or default 1.0s)
    let maxTime = 1.0;
    for (const bTrack of Object.values(animTrack.bones)) {
      for (const k of bTrack.rotate || []) {
        if (k.time > maxTime) maxTime = k.time;
      }
    }

    const t = this.animTimer % maxTime;

    // Evaluate rotations
    for (const [boneName, bTrack] of Object.entries(animTrack.bones)) {
      const child = this.boneGraphicsContainer.children.find(c => c.label === boneName);
      if (!child) continue;

      const baseBone = this.currentDoc.bones.find(b => b.name === boneName);
      const baseRot = baseBone?.rotation || 0;

      if (bTrack.rotate && bTrack.rotate.length > 0) {
        const rot = this.interpolateRotation(bTrack.rotate, t);
        child.rotation = ((baseRot + rot) * Math.PI) / 180;
      }
    }
  }

  private interpolateRotation(keyframes: { time: number; angle: number }[], t: number): number {
    if (keyframes.length === 1) return keyframes[0].angle;
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
    }

    const span = k1.time - k0.time;
    const factor = span > 0 ? (t - k0.time) / span : 0;
    return k0.angle + (k1.angle - k0.angle) * factor;
  }

  public destroy(): void {
    if (this.app) {
      if (this.tickerRef) this.app.ticker.remove(this.tickerRef);
      this.app.destroy(true, { children: true });
    }
  }
}
