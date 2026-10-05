import * as PIXI from 'pixi.js';
import { Vector2D, SpriteSheetVisualConfig, AnimFrameRef, AnimationClipConfig } from '../types';
import { AssetManager } from '../core/AssetManager';
import { ICharacterVisualizer, CharacterRenderState } from './ICharacterVisualizer';

export class SpriteSheetCharacterVisualizer implements ICharacterVisualizer {
  public readonly container: PIXI.Container;
  public readonly sprite: PIXI.Sprite;
  public config: SpriteSheetVisualConfig;

  private textureSheet: PIXI.Texture | null = null;
  private animFrame = 0;
  private animTimer = 0;
  private animSpeed = 0.15;

  constructor(config: SpriteSheetVisualConfig) {
    this.config = config;
    this.container = new PIXI.Container();
    this.sprite = new PIXI.Sprite();
    this.sprite.anchor.set(0.5, 0.9);
    this.container.addChild(this.sprite);
  }

  public async init(): Promise<void> {
    const assetManager = AssetManager.getInstance();
    if (this.config.spriteSheetUrl.startsWith('procedural:')) {
      const type = this.config.spriteSheetUrl.replace('procedural:', '');
      this.textureSheet = assetManager.createProceduralCharacterSheet(type);
    } else if (this.config.spriteSheetUrl) {
      this.textureSheet = await assetManager.loadTexture(this.config.spriteSheetUrl);
    }
    this.updateSpriteFrame({
      state: 'idle',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });
  }

  public update(delta: number, state: CharacterRenderState): void {
    if (!this.container || (this.container as any).destroyed) return;

    this.animTimer += delta;
    if (this.animTimer >= this.animSpeed) {
      this.animTimer = 0;
      this.animFrame++;
      this.updateSpriteFrame(state);
    }
  }

  public freezeFrame(state: CharacterRenderState): void {
    this.animFrame = 0;
    this.animTimer = 0;
    this.updateSpriteFrame(state);
  }

  public getBounds(): { width: number; height: number; anchorX: number; anchorY: number } {
    return {
      width: this.config.frameWidth || 64,
      height: this.config.frameHeight || 96,
      anchorX: 0.5,
      anchorY: 0.9
    };
  }

  public containsPoint(localPoint: Vector2D): boolean {
    const fw = this.config.frameWidth || 64;
    const fh = this.config.frameHeight || 96;
    const hw = fw / 2;
    const minX = -hw;
    const maxX = hw;
    const minY = -fh * 0.9;
    const maxY = fh * 0.1;
    return localPoint.x >= minX && localPoint.x <= maxX && localPoint.y >= minY && localPoint.y <= maxY;
  }

  private resolveAnimFrames(animEntry: AnimFrameRef[] | AnimationClipConfig | undefined): AnimFrameRef[] {
    if (!animEntry) return [0];
    if (Array.isArray(animEntry)) return animEntry.length > 0 ? animEntry : [0];
    return animEntry.frames && animEntry.frames.length > 0 ? animEntry.frames : [0];
  }

  private updateSpriteFrame(state: CharacterRenderState): void {
    if (!this.textureSheet) return;

    const anims = this.config.animations || {};
    let frames: AnimFrameRef[] = [0];

    const dir = state.direction8Way;
    const dir4 = (dir === 'left' || dir === 'right' || dir.includes('side')) ? 'side' : (dir.includes('up') ? 'up' : 'down');

    if (state.currentCustomAnimKey && anims[state.currentCustomAnimKey]) {
      frames = this.resolveAnimFrames(anims[state.currentCustomAnimKey]);
    } else if (state.state === 'walking') {
      frames = this.resolveAnimFrames(
        anims[`walk_${dir}`] || anims[`walk_${dir4}`] || (dir4 === 'side' ? anims.walkSide : (dir4 === 'up' ? anims.walkUp : anims.walkDown))
      );
    } else if (state.state === 'talking') {
      frames = this.resolveAnimFrames(
        anims[`talk_${dir}`] || anims[`talk_${dir4}`] || anims.talk
      );
    } else if (state.state === 'picking_up') {
      frames = this.resolveAnimFrames(
        anims[`pick_up_${dir}`] || anims['pick_up']
      );
    } else if (state.holdingItemId && anims[`hold_${state.holdingItemId}`]) {
      frames = this.resolveAnimFrames(anims[`hold_${state.holdingItemId}`]);
    } else if (anims['hold_item']) {
      frames = this.resolveAnimFrames(anims['hold_item']);
    } else {
      frames = this.resolveAnimFrames(
        anims[`idle_${dir}`] || anims[`idle_${dir4}`] || (dir4 === 'side' ? anims.idleSide : (dir4 === 'up' ? anims.idleUp : anims.idleDown))
      );
    }

    if (!frames || frames.length === 0) frames = [0];
    const currentFrame = frames[this.animFrame % frames.length];

    let frameRect: PIXI.Rectangle;
    if (typeof currentFrame === 'object' && currentFrame !== null && 'x' in currentFrame) {
      const f = currentFrame as any;
      frameRect = new PIXI.Rectangle(f.x, f.y, f.w, f.h);
    } else {
      const frameIndex = typeof currentFrame === 'number' ? currentFrame : 0;
      const texWidth = this.textureSheet.width || 256;
      const cols = Math.max(1, Math.floor(texWidth / (this.config.frameWidth || 64)));
      const fw = this.config.frameWidth || 64;
      const fh = this.config.frameHeight || 96;
      const col = frameIndex % cols;
      const row = Math.floor(frameIndex / cols);

      frameRect = new PIXI.Rectangle(col * fw, row * fh, fw, fh);
    }

    this.sprite.texture = new PIXI.Texture({
      source: this.textureSheet.source,
      frame: frameRect
    });
  }

  public destroy(): void {
    this.container.destroy({ children: true, texture: false });
  }
}
