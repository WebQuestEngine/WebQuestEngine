import * as PIXI from 'pixi.js';
import { MovableElement } from './MovableElement';
import { Vector2D, CharacterData, Direction8Way, VerbType, HotspotAction, resolveCharacterVisualConfig } from '../types';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';
import { WalkPath } from './WalkPath';
import { ICharacterVisualizer, CharacterRenderState, CharacterVisualFactory } from '../visualization';

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
  public visualizer!: ICharacterVisualizer;

  public path: Vector2D[] = [];
  private currentPathIndex = 0;
  private currentCustomAnimKey: string | null = null;
  private customAnimTimer: any = null;
  private onWalkCompleteCallback: (() => void) | null = null;

  constructor(data: CharacterData) {
    const pos = data.position || { x: 0, y: 0 };
    super(data.id, data.name, pos);

    // Ensure visual config is populated
    const visual = resolveCharacterVisualConfig(data);
    this.data = { ...data, position: pos, visual };
    this.imageUrl = (visual as any).spriteSheetUrl || data.spriteSheetUrl;
    this.cursor = data.cursor || 'talk';
    this.actions = data.actions || [];
    this.speed = data.speed;
  }

  public override containsPointInEditor(p: Vector2D): boolean {
    if (this.points && this.points.length >= 3) {
      return super.containsPointInEditor(p);
    }
    if (this.visualizer) {
      const localPoint = {
        x: (p.x - this.position.x) / (this.data.scale || 1),
        y: (p.y - this.position.y) / (this.data.scale || 1)
      };
      if (this.isFacingLeft) localPoint.x = -localPoint.x;
      return this.visualizer.containsPoint(localPoint);
    }
    const fw = (this.data.frameWidth || 64) * (this.data.scale || 1);
    const fh = (this.data.frameHeight || 96) * (this.data.scale || 1);
    const hw = fw / 2;
    return p.x >= this.position.x - hw && p.x <= this.position.x + hw && p.y >= this.position.y - fh && p.y <= this.position.y;
  }

  public async init(): Promise<void> {
    const pos = this.data.position || { x: 0, y: 0 };
    this.container.x = pos.x;
    this.container.y = pos.y;
    this.container.scale.set(this.data.scale || 1);

    if (!this.visualizer) {
      this.visualizer = CharacterVisualFactory.create(this.data);
    }

    await this.visualizer.init();
    if ((this.visualizer as any)?.sprite) {
      this.sprite = (this.visualizer as any).sprite;
    }
    if (!this.container.children.includes(this.visualizer.container)) {
      this.container.addChild(this.visualizer.container);
    }
  }

  public async setVisualizer(visualizer: ICharacterVisualizer): Promise<void> {
    if (this.visualizer) {
      if (this.container.children.includes(this.visualizer.container)) {
        this.container.removeChild(this.visualizer.container);
      }
      this.visualizer.destroy();
    }
    this.visualizer = visualizer;
    await this.visualizer.init();
    if ((this.visualizer as any)?.sprite) {
      this.sprite = (this.visualizer as any).sprite;
    }
    this.container.addChild(this.visualizer.container);
  }

  public faceTarget(target: Vector2D): void {
    const current = { x: this.container.x, y: this.container.y };
    this.direction8Way = calculate8WayDirection(current, target);
    this.isFacingLeft = this.direction8Way === 'left' || this.direction8Way === 'up_left' || this.direction8Way === 'down_left';
    this.updateVisualizer(0);
  }

  public walkTo(target: Vector2D, walkPath?: WalkPath, onComplete?: () => void): void {
    const start = { x: this.container.x, y: this.container.y };

    if (walkPath && walkPath.data.enabled && walkPath.data.points && walkPath.data.points.length >= 3) {
      this.path = walkPath.findPath(start, target);
    } else {
      this.path = [target];
    }

    this.currentPathIndex = 0;
    this.state = 'walking';
    this.currentCustomAnimKey = null;
    if (this.customAnimTimer) {
      clearTimeout(this.customAnimTimer);
      this.customAnimTimer = null;
    }
    this.onWalkCompleteCallback = onComplete || null;

    if (this.path.length > 0) {
      this.faceTarget(this.path[0]);
    }
  }

  public talk(onComplete?: () => void): void {
    this.state = 'talking';
    this.currentCustomAnimKey = null;
    setTimeout(() => {
      if (this.state === 'talking') {
        this.state = 'idle';
      }
      if (onComplete) onComplete();
    }, 3000);
  }

  public playCustomAnimation(animName: string, durationMs = 1500, onComplete?: () => void): void {
    this.state = 'custom_anim';
    this.currentCustomAnimKey = animName;
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
    if (!this.container || (this.container as any).destroyed || !this.container.position) return;

    // Movement logic along path
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
            return;
          }
        } else {
          this.faceTarget(this.path[this.currentPathIndex]);
        }
      } else {
        const step = this.data.speed * delta * 60;
        const vx = (dx / dist) * Math.min(step, dist);
        const vy = (dy / dist) * Math.min(step, dist);

        this.container.x += vx;
        this.container.y += vy;

        this.direction8Way = calculate8WayDirection({ x: 0, y: 0 }, { x: dx, y: dy });
        this.isFacingLeft = this.direction8Way === 'left' || this.direction8Way === 'up_left' || this.direction8Way === 'down_left';
      }
    }

    if (!this.container || (this.container as any).destroyed || !this.container.position) return;

    // Perspective scaling based on WalkPath Y position
    let walkPathScale = 1;
    if (walkPath) {
      walkPathScale = walkPath.getScaleAt(this.container.y);
      const finalScale = walkPathScale * this.data.scale;
      this.container.scale.set(this.isFacingLeft ? -finalScale : finalScale, finalScale);
    } else {
      this.container.scale.set(this.isFacingLeft ? -this.data.scale : this.data.scale, this.data.scale);
    }

    (this.container as any).depthY = this.getDepthY();

    this.updateVisualizer(delta, walkPathScale);
  }

  private getRenderState(walkPathScale = 1): CharacterRenderState {
    return {
      state: this.state,
      direction8Way: this.direction8Way,
      isFacingLeft: this.isFacingLeft,
      currentCustomAnimKey: this.currentCustomAnimKey,
      holdingItemId: this.data.currentHoldingItemId,
      scale: this.data.scale,
      depthY: this.getDepthY(),
      walkPathScale
    };
  }

  private updateVisualizer(delta: number, walkPathScale = 1): void {
    if (!this.visualizer) return;
    this.visualizer.update(delta, this.getRenderState(walkPathScale));
  }

  public getDepthY(): number {
    if (this.data.depthY !== undefined) return this.data.depthY;
    if (!this.container || (this.container as any).destroyed || !this.container.position) return 0;
    return this.container.y;
  }

  public getBestAction(activeVerb?: VerbType, selectedItemId?: string | null): HotspotAction | undefined {
    if (!this.data.actions || this.data.actions.length === 0) return undefined;
    const storySystem = StoryGraphSystem.getInstance();

    if (selectedItemId) {
      const itemAction = this.data.actions.find(a => {
        if (a.requireItemId !== selectedItemId) return false;
        if (a.requiredFlag && !storySystem?.getFlag(a.requiredFlag)) return false;
        if (a.notFlag && storySystem?.getFlag(a.notFlag)) return false;
        return true;
      });
      if (itemAction) return itemAction;
    }

    if (activeVerb && activeVerb !== 'walk') {
      const effectiveVerb = activeVerb === 'use' ? 'interact' : activeVerb;
      const matched = this.data.actions.find(a => {
        if (a.requireItemId) return false;
        const actVerb = a.verb === 'use' ? 'interact' : a.verb;
        if (effectiveVerb === 'interact') {
          if (actVerb !== 'interact') return false;
        } else {
          if (actVerb !== effectiveVerb) return false;
        }
        if (a.requiredFlag && !storySystem?.getFlag(a.requiredFlag)) return false;
        if (a.notFlag && storySystem?.getFlag(a.notFlag)) return false;
        return true;
      });
      if (matched) return matched;
    }

    return this.data.actions.find(a => {
      if (a.requireItemId && !selectedItemId) return false;
      if (a.requiredFlag && !storySystem?.getFlag(a.requiredFlag)) return false;
      if (a.notFlag && storySystem?.getFlag(a.notFlag)) return false;
      return true;
    });
  }

  public freezeFrame(walkPath?: WalkPath): void {
    if (!this.container || (this.container as any).destroyed || !this.container.position) return;
    this.state = 'idle';
    const pos = this.data.position || { x: 0, y: 0 };
    this.container.x = pos.x;
    this.container.y = pos.y;
    let walkPathScale = 1;
    if (walkPath) {
      walkPathScale = walkPath.getScaleAt(this.container.y);
      const finalScale = walkPathScale * (this.data.scale || 1);
      this.container.scale.set(this.isFacingLeft ? -finalScale : finalScale, finalScale);
    } else {
      this.container.scale.set(this.isFacingLeft ? -(this.data.scale || 1) : (this.data.scale || 1), this.data.scale || 1);
    }
    if (this.visualizer) {
      this.visualizer.freezeFrame(this.getRenderState(walkPathScale));
    }
  }

  public destroy(): void {
    if (this.visualizer) {
      this.visualizer.destroy();
    }
    this.container.destroy({ children: true, texture: false });
  }
}
