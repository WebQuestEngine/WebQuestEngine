import * as PIXI from 'pixi.js';
import { Vector2D, HotspotData, VerbType, HotspotAction } from '../types';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';
import { AssetManager } from '../core/AssetManager';

export class Hotspot {
  public data: HotspotData;
  public container: PIXI.Container;
  public sprite: PIXI.Sprite;

  constructor(data: HotspotData) {
    this.data = data;
    this.container = new PIXI.Container();
    this.sprite = new PIXI.Sprite();
    this.container.addChild(this.sprite);

    const center = this.getCenter();
    const pos = data.position || center;
    this.container.x = pos.x;
    this.container.y = pos.y;
    this.container.scale.set(data.scaleX ?? 1, data.scaleY ?? 1);
    this.sprite.anchor.set(0.5, 0.5);
  }

  public async init(): Promise<void> {
    if (!this.data.imageUrl) return;

    const assetManager = AssetManager.getInstance();
    if (this.data.imageUrl.startsWith('procedural:')) {
      const type = this.data.imageUrl.replace('procedural:', '');
      this.sprite.texture = this.createProceduralHotspotTexture(type);
    } else {
      this.sprite.texture = await assetManager.loadTexture(this.data.imageUrl);
    }
  }

  public update(): void {
    const isVisible = this.isEnabled() && (this.data.visible ?? true);
    this.container.visible = isVisible;

    const center = this.getCenter();
    const pos = this.data.position || center;
    this.container.x = pos.x;
    this.container.y = pos.y;
    this.container.scale.set(this.data.scaleX ?? 1, this.data.scaleY ?? 1);
  }

  public isEnabled(): boolean {
    if (!this.data.enabled) return false;
    const storySystem = StoryGraphSystem.getInstance();
    if (this.data.requiredFlag && !storySystem.getFlag(this.data.requiredFlag)) return false;
    if (this.data.notFlag && storySystem.getFlag(this.data.notFlag)) return false;
    return true;
  }

  public containsPoint(p: Vector2D): boolean {
    if (!this.isEnabled() || this.data.points.length < 3) return false;

    let inside = false;
    const pts = this.data.points;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;

      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  public getCenter(): Vector2D {
    if (this.data.points.length === 0) return { x: 0, y: 0 };
    let sumX = 0;
    let sumY = 0;
    for (const pt of this.data.points) {
      sumX += pt.x;
      sumY += pt.y;
    }
    return {
      x: sumX / this.data.points.length,
      y: sumY / this.data.points.length
    };
  }

  private isActionValid(action: HotspotAction): boolean {
    const storySystem = StoryGraphSystem.getInstance();
    if (action.requiredFlag && !storySystem.getFlag(action.requiredFlag)) return false;
    if (action.notFlag && storySystem.getFlag(action.notFlag)) return false;
    return true;
  }

  public getActionForVerb(verb: VerbType): HotspotAction | undefined {
    return this.data.actions.find(a => a.verb === verb && this.isActionValid(a));
  }

  public getActionForItemId(itemId: string): HotspotAction | undefined {
    return this.data.actions.find(a => a.requireItemId === itemId && this.isActionValid(a));
  }

  public getBestAction(activeVerb: VerbType, selectedItemId?: string | null): HotspotAction | undefined {
    if (selectedItemId) {
      const itemAction = this.getActionForItemId(selectedItemId);
      if (itemAction) return itemAction;
    }

    const verbAction = this.getActionForVerb(activeVerb);
    if (verbAction) return verbAction;

    const validActions = this.data.actions.filter(a => this.isActionValid(a));
    return validActions.find(a => a.verb === 'interact') ||
           validActions.find(a => a.verb === 'pick_up') ||
           validActions.find(a => a.verb === 'talk') ||
           validActions.find(a => a.verb === 'use') ||
           validActions[0];
  }

  private createProceduralHotspotTexture(type: string): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    if (type === 'shrub') {
      ctx.fillStyle = '#059669';
      ctx.beginPath(); ctx.arc(64, 64, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.arc(45, 45, 30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(80, 50, 25, 0, Math.PI * 2); ctx.fill();
      // Gleaming Key Sparkle
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(70, 70, 8, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'cauldron') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.ellipse(64, 80, 50, 35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.ellipse(64, 60, 42, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(50, 55, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(75, 58, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(20, 20, 88, 88);
    }

    return PIXI.Texture.from(canvas);
  }
}
