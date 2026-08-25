import * as PIXI from 'pixi.js';
import { MovableElement } from './MovableElement';
import { Vector2D, CharacterData } from '../types';
import { AssetManager } from '../core/AssetManager';
import { WalkPath } from './WalkPath';

export type CharacterState = 'idle' | 'walking' | 'talking';
export type CharacterDirection = 'down' | 'side' | 'up';

export class Character extends MovableElement {
  public data: CharacterData;
  public state: CharacterState = 'idle';
  public direction: CharacterDirection = 'down';
  public isFacingLeft = false;

  private path: Vector2D[] = [];
  private currentPathIndex = 0;
  private animFrame = 0;
  private animTimer = 0;
  private animSpeed = 0.15;
  private textureSheet: PIXI.Texture | null = null;
  private onWalkCompleteCallback: (() => void) | null = null;

  constructor(data: CharacterData) {
    super(data.id, data.name, data.position);
    this.data = data;
    this.imageUrl = data.spriteSheetUrl;
    this.sprite.anchor.set(0.5, 0.9); // Bottom-center anchor for foot placement
  }

  public async init(): Promise<void> {
    const assetManager = AssetManager.getInstance();
    this.textureSheet = await assetManager.loadTexture(this.data.spriteSheetUrl);
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
    this.onWalkCompleteCallback = onComplete || null;
  }

  public talk(onComplete?: () => void): void {
    this.state = 'talking';
    this.animFrame = 0;
    if (onComplete) {
      setTimeout(() => {
        this.state = 'idle';
        onComplete();
      }, 2500);
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

        // Determine facing direction
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = 'side';
          this.isFacingLeft = dx < 0;
        } else {
          this.direction = dy > 0 ? 'down' : 'up';
        }
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

  private updateSpriteFrame(): void {
    if (!this.textureSheet) return;

    let frames: number[] = [0];
    const anims = this.data.animations;

    if (this.state === 'walking') {
      frames = this.direction === 'side' ? anims.walkSide : (this.direction === 'up' ? anims.walkUp : anims.walkDown);
    } else if (this.state === 'talking') {
      frames = anims.talk;
    } else {
      frames = this.direction === 'side' ? anims.idleSide : (this.direction === 'up' ? anims.idleUp : anims.idleDown);
    }

    if (frames.length === 0) frames = [0];
    const frameIndex = frames[this.animFrame % frames.length];

    // Calculate sub-texture frame (assuming grid layout)
    const cols = 4;
    const fw = this.data.frameWidth;
    const fh = this.data.frameHeight;
    const col = frameIndex % cols;
    const row = Math.floor(frameIndex / cols);

    const frameRect = new PIXI.Rectangle(col * fw, row * fh, fw, fh);
    this.sprite.texture = new PIXI.Texture({
      source: this.textureSheet.source,
      frame: frameRect
    });
  }
}
