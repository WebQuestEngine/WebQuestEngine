import { GraphicalElement } from './GraphicalElement';
import { Vector2D, HotspotAction, VerbType } from '../types';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';

export class InteractableElement extends GraphicalElement {
  public cursor: string = 'interact';
  public points: Vector2D[] = [];
  public actions: HotspotAction[] = [];
  public enabled: boolean = true;
  public requiredFlag?: string;
  public notFlag?: string;

  constructor(id: string, name: string, position: Vector2D = { x: 0, y: 0 }) {
    super(id, name, position);
    this.sprite.anchor.set(0.5, 0.5);
  }

  public isEnabled(): boolean {
    if (!this.enabled) return false;
    const storySystem = StoryGraphSystem.getInstance();
    if (this.requiredFlag && !storySystem.getFlag(this.requiredFlag)) return false;
    if (this.notFlag && storySystem.getFlag(this.notFlag)) return false;
    return true;
  }

  public override update(delta?: number): void {
    super.update(delta);
    this.container.visible = this.isEnabled() && this.visible;
  }

  public containsPoint(p: Vector2D): boolean {
    if (!this.isEnabled()) return false;
    return this.containsPointInEditor(p);
  }

  public containsPointInEditor(p: Vector2D): boolean {
    if (this.points.length < 3) return false;
    let inside = false;
    const pts = this.points;
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
    if (this.points.length === 0) return { ...this.position };
    let sumX = 0, sumY = 0;
    for (const pt of this.points) {
      sumX += pt.x;
      sumY += pt.y;
    }
    return { x: sumX / this.points.length, y: sumY / this.points.length };
  }

  public getActionForVerb(verb: VerbType): HotspotAction | undefined {
    const storySystem = StoryGraphSystem.getInstance();
    const effectiveVerb = verb === 'use' ? 'interact' : verb;

    return this.actions.find(a => {
      if (a.requireItemId) return false;

      const actVerb = a.verb === 'use' ? 'interact' : a.verb;

      // Scene transition actions (doors/exits) trigger on interact/use/walk
      if (a.targetSceneId) {
        if (effectiveVerb !== 'interact' && effectiveVerb !== 'walk') return false;
      } else {
        if (effectiveVerb === 'interact') {
          if (actVerb !== 'interact') return false;
        } else {
          if (actVerb !== effectiveVerb) return false;
        }
      }

      if (a.requiredFlag && !storySystem.getFlag(a.requiredFlag)) return false;
      if (a.notFlag && storySystem.getFlag(a.notFlag)) return false;
      return true;
    });
  }

  public getActionForItemId(itemId: string): HotspotAction | undefined {
    const storySystem = StoryGraphSystem.getInstance();
    return this.actions.find(a => {
      if (a.requireItemId !== itemId) return false;
      if (a.requiredFlag && !storySystem.getFlag(a.requiredFlag)) return false;
      if (a.notFlag && storySystem.getFlag(a.notFlag)) return false;
      return true;
    });
  }

  public getBestAction(activeVerb?: VerbType, selectedItemId?: string | null): HotspotAction | undefined {
    if (selectedItemId) {
      const itemAction = this.getActionForItemId(selectedItemId);
      if (itemAction) return itemAction;
    }

    if (activeVerb && activeVerb !== 'walk') {
      const verbAction = this.getActionForVerb(activeVerb);
      if (verbAction) return verbAction;
    }

    const storySystem = StoryGraphSystem.getInstance();
    return this.actions.find(a => {
      if (a.requireItemId && !selectedItemId) return false;
      if (a.requiredFlag && !storySystem?.getFlag(a.requiredFlag)) return false;
      if (a.notFlag && storySystem?.getFlag(a.notFlag)) return false;
      return true;
    });
  }
}
