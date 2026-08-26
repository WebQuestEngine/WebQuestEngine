import * as PIXI from 'pixi.js';
import { MovableElement } from './MovableElement';
import { Vector2D, CharacterData, Direction8Way, AnimationClipConfig, AnimFrameRef } from '../types';
import { AssetManager } from '../core/AssetManager';
import { WalkPath } from './WalkPath';

export type CharacterState = 'idle' | 'walking' | 'talking' | 'picking_up' | 'gesturing' | 'custom_anim';

export function calculate8WayDirection(from: Vector2D, to: Vector2D): Direction8Way {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angleDeg >= -22.5 && angleDeg < 22.5) return 'right';
  if (angleDeg >= 22.5 && angleDeg < 67.5) return 'down_right';
  if (angleDeg >= 67.5 && angleDeg < 112.5) return 'down';
  if (angleDeg >= 112.5 && angleDeg < 157.5) return 'down_left';
  if (angleDeg >= 157.5 || angleDeg < -157.5) return 'left';
  if (angleDeg >= -157.5 && angleDeg < -112.5) return 'up_left';
  if (angleDeg >= -112.5 && angleDeg < -67.5) return 'up';
  return 'up_right';
}

export class Character extends MovableElement {
  public data: CharacterData;
  public state: CharacterState = 'idle';
  public direction8Way: Direction8Way = 'down';
  public isFacingLeft = false;

  private path: Vector2D[] = [];
  private currentPathIndex = 0;
  private animFrame = 0;
  private animTimer = 0;
  private animSpeed = 0.15;
  private currentCustomAnimKey: string | null = null;
  private customAnimTimer: any = null;
  private textureSheet: PIXI.Texture | null = null;
  private onWalkCompleteCallback: (() => void) | null = null;

  constructor(data: CharacterData) {
    super(data.id, data.name, data.position);
    this.data = data;
    this.imageUrl = data.spriteSheetUrl;
    this.cursor = data.cursor || 'talk';
    this.actions = data.actions || [];
    this.speed = data.speed;
    this.sprite.anchor.set(0.5, 0.9); // Foot placement anchor
  }

  public override containsPointInEditor(p: Vector2D): boolean {
    if (this.points && this.points.length >= 3) {
      return super.containsPointInEditor(p);
    }
    const hw = (this.data.frameWidth * (this.data.scale || 1)) / 2;
    const hh = this.data.frameHeight * (this.data.scale || 1);
    const minX = this.position.x - hw;
    const maxX = this.position.x + hw;
    const minY = this.position.y - hh;
    const maxY = this.position.y;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }

  public async init(): Promise<void> {
    const assetManager = AssetManager.getInstance();
    this.textureSheet = await assetManager.loadTexture(this.data.spriteSheetUrl);
    this.updateSpriteFrame();
  }

  public faceTarget(target: Vector2D): void {
    const current = { x: this.container.x, y: this.container.y };
    this.direction8Way = calculate8WayDirection(current, target);
    this.isFacingLeft = this.direction8Way === 'left' || this.direction8Way === 'up_left' || this.direction8Way === 'down_left';
    this.updateSpriteFrame();
  }

  public walkTo(target: Vector2D, walkPath?: WalkPath, onComplete?: () => void): void {
    const start = { x: this.container.x, y: this.container.y };
    let destination = target;

    if (walkPath) {
      destination = walkPath.clampToWalkable(target);
    }

    this.path = [destination];
    this.currentPathIndex = 0;
    this.state = 'walking';
    this.currentCustomAnimKey = null;
    this.onWalkCompleteCallback = onComplete || null;
  }

  public talk(onComplete?: () => void): void {
    this.state = 'talking';
    this.animFrame = 0;
    this.currentCustomAnimKey = null;
    if (onComplete) {
      setTimeout(() => {
        this.state = 'idle';
        onComplete();
      }, 2500);
    }
  }

  public playCustomAnimation(animName: string, durationMs = 1500, onComplete?: () => void): void {
    this.state = 'custom_anim';
    this.currentCustomAnimKey = animName;
    this.animFrame = 0;
    if (this.customAnimTimer) clearTimeout(this.customAnimTimer);
    this.customAnimTimer = setTimeout(() => {
      this.state = 'idle';
      this.currentCustomAnimKey = null;
      if (onComplete) onComplete();
    }, durationMs);
  }

  public pickUp(targetPos: Vector2D, onComplete?: () => void): void {
    this.faceTarget(targetPos);
    this.playCustomAnimation('pick_up', 1200, onComplete);
  }

  public holdItem(itemId: string | null): void {
    this.data.currentHoldingItemId = itemId || undefined;
    if (itemId) {
      this.playCustomAnimation(`hold_${itemId}`, 1000);
    } else {
      this.state = 'idle';
      this.currentCustomAnimKey = null;
    }
  }

  public update(delta: number, walkPath?: WalkPath): void {
    // Movement logic
    if (this.state === 'walking' && this.path.length > 0) {
      const target = this.path[this.currentPathIndex];
      const dx = target.x - this.container.x;
      const dy = target.y - this.container.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 4) {
        this.container.x = target.x;
        this.container.y = target.y;
        this.currentPathIndex++;

        if (this.currentPathIndex >= this.path.length) {
          this.state = 'idle';
          this.path = [];
          if (this.onWalkCompleteCallback) {
            const cb = this.onWalkCompleteCallback;
            this.onWalkCompleteCallback = null;
            cb();
          }
        }
      } else {
        const step = this.data.speed * delta * 60;
        const vx = (dx / dist) * Math.min(step, dist);
        const vy = (dy / dist) * Math.min(step, dist);

        this.container.x += vx;
        this.container.y += vy;

        // Determine 8-way facing direction
        this.direction8Way = calculate8WayDirection({ x: 0, y: 0 }, { x: dx, y: dy });
        this.isFacingLeft = this.direction8Way === 'left' || this.direction8Way === 'up_left' || this.direction8Way === 'down_left';
      }
    }

    // Perspective scaling based on WalkPath Y position
    if (walkPath) {
      const calculatedScale = walkPath.getScaleAt(this.container.y);
      const finalScale = calculatedScale * this.data.scale;
      this.container.scale.set(this.isFacingLeft ? -finalScale : finalScale, finalScale);
    } else {
      this.container.scale.set(this.isFacingLeft ? -this.data.scale : this.data.scale, this.data.scale);
    }

    // Animation frame update
    this.animTimer += delta;
    if (this.animTimer >= this.animSpeed) {
      this.animTimer = 0;
      this.animFrame++;
      this.updateSpriteFrame();
    }
  }

  private resolveAnimFrames(animEntry: AnimFrameRef[] | AnimationClipConfig | undefined): AnimFrameRef[] {
    if (!animEntry) return [0];
    if (Array.isArray(animEntry)) return animEntry.length > 0 ? animEntry : [0];
    return animEntry.frames && animEntry.frames.length > 0 ? animEntry.frames : [0];
  }

  private updateSpriteFrame(): void {
    if (!this.textureSheet) return;

    const anims = this.data.animations || {};
    let frames: AnimFrameRef[] = [0];

    const dir = this.direction8Way;
    const dir4 = (dir === 'left' || dir === 'right' || dir.includes('side')) ? 'side' : (dir.includes('up') ? 'up' : 'down');

    if (this.currentCustomAnimKey && anims[this.currentCustomAnimKey]) {
      frames = this.resolveAnimFrames(anims[this.currentCustomAnimKey]);
    } else if (this.state === 'walking') {
      frames = this.resolveAnimFrames(
        anims[`walk_${dir}`] || anims[`walk_${dir4}`] || (dir4 === 'side' ? anims.walkSide : (dir4 === 'up' ? anims.walkUp : anims.walkDown))
      );
    } else if (this.state === 'talking') {
      frames = this.resolveAnimFrames(
        anims[`talk_${dir}`] || anims[`talk_${dir4}`] || anims.talk
      );
    } else if (this.state === 'picking_up') {
      frames = this.resolveAnimFrames(
        anims[`pick_up_${dir}`] || anims['pick_up']
      );
    } else if (this.data.currentHoldingItemId && anims[`hold_${this.data.currentHoldingItemId}`]) {
      frames = this.resolveAnimFrames(anims[`hold_${this.data.currentHoldingItemId}`]);
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
      // Custom drawn bounding rectangle frame!
      const f = currentFrame as any;
      frameRect = new PIXI.Rectangle(f.x, f.y, f.w, f.h);
    } else {
      // Grid index frame
      const frameIndex = typeof currentFrame === 'number' ? currentFrame : 0;
      const texWidth = this.textureSheet.width || 256;
      const cols = Math.max(1, Math.floor(texWidth / (this.data.frameWidth || 64)));
      const fw = this.data.frameWidth || 64;
      const fh = this.data.frameHeight || 64;
      const col = frameIndex % cols;
      const row = Math.floor(frameIndex / cols);

      frameRect = new PIXI.Rectangle(col * fw, row * fh, fw, fh);
    }

    this.sprite.texture = new PIXI.Texture({
      source: this.textureSheet.source,
      frame: frameRect
    });
  }
}
