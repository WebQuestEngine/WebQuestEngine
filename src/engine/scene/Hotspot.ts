import * as PIXI from 'pixi.js';
import { InteractableElement } from './InteractableElement';
import { Vector2D, HotspotData, VerbType, HotspotAction } from '../types';
import { AssetManager } from '../core/AssetManager';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';

export class Hotspot extends InteractableElement {
  public data: HotspotData;

  constructor(data: HotspotData) {
    const center = Hotspot.calcCenter(data.points);
    const pos = data.position || center;
    super(data.id, data.name, pos);

    this.data = data;
    this.imageUrl = data.imageUrl;
    this.cursor = data.cursor;
    this.points = data.points;
    this.actions = data.actions;
    this.enabled = data.enabled;
    this.requiredFlag = data.requiredFlag;
    this.notFlag = data.notFlag;
    this.scaleX = data.scaleX ?? 1;
    this.scaleY = data.scaleY ?? 1;
    this.visible = data.visible ?? true;
  }

  private static calcCenter(pts: Vector2D[]): Vector2D {
    if (!pts || pts.length === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0;
    for (const p of pts) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / pts.length, y: sumY / pts.length };
  }

  public override async init(): Promise<void> {
    if (!this.data.imageUrl) return;

    const assetManager = AssetManager.getInstance();
    if (this.data.imageUrl.startsWith('procedural:')) {
      const type = this.data.imageUrl.replace('procedural:', '');
      this.sprite.texture = this.createProceduralHotspotTexture(type);
    } else {
      this.sprite.texture = await assetManager.loadTexture(this.data.imageUrl);
    }
  }

  public getDepthY(): number {
    if (this.data.depthY !== undefined) return this.data.depthY;
    if (this.points && this.points.length > 0) {
      return Math.max(...this.points.map(p => p.y));
    }
    return this.position.y;
  }

  public override update(_delta?: number): void {
    const center = this.getCenter();
    const pos = this.data.position || center;
    this.position.x = pos.x;
    this.position.y = pos.y;
    this.scaleX = this.data.scaleX ?? 1;
    this.scaleY = this.data.scaleY ?? 1;
    this.visible = this.data.visible ?? true;
    this.cursor = this.data.cursor;
    this.points = this.data.points;
    this.actions = this.data.actions;
    this.enabled = this.data.enabled;
    this.requiredFlag = this.data.requiredFlag;
    this.notFlag = this.data.notFlag;

    (this.container as any).depthY = this.getDepthY();

    super.update(_delta);
  }

  public getActionForItemId(itemId: string): HotspotAction | undefined {
    return this.data.actions.find(a => a.requireItemId === itemId && this.isActionValid(a, itemId));
  }

  private isActionValid(action: HotspotAction, selectedItemId?: string | null): boolean {
    if (action.requireItemId && selectedItemId !== undefined && action.requireItemId !== selectedItemId) {
      return false;
    }
    const storySystem = StoryGraphSystem.getInstance();
    if (storySystem) {
      if (action.requiredFlag && !storySystem.getFlag(action.requiredFlag)) return false;
      if (action.notFlag && storySystem.getFlag(action.notFlag)) return false;
    }
    return true;
  }

  public isExamined = false;

  public getBestAction(activeVerb: VerbType, selectedItemId?: string | null): HotspotAction | undefined {
    if (selectedItemId) {
      const itemAction = this.getActionForItemId(selectedItemId);
      if (itemAction) return itemAction;
    }

    const verbAction = this.getActionForVerb(activeVerb);
    if (verbAction) return verbAction;

    const validActions = this.data.actions.filter(a => this.isActionValid(a, selectedItemId));
    const nonLookAction = validActions.find(a => a.verb !== 'look');
    const lookAction = validActions.find(a => a.verb === 'look');

    return nonLookAction || lookAction || validActions[0];
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
