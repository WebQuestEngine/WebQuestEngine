import { Vector2D, HotspotData, VerbType, HotspotAction } from '../types';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';

export class Hotspot {
  public data: HotspotData;

  constructor(data: HotspotData) {
    this.data = data;
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

    // Smart fallback order among valid actions
    const validActions = this.data.actions.filter(a => this.isActionValid(a));
    return validActions.find(a => a.verb === 'interact') ||
           validActions.find(a => a.verb === 'pick_up') ||
           validActions.find(a => a.verb === 'talk') ||
           validActions.find(a => a.verb === 'use') ||
           validActions[0];
  }
}
