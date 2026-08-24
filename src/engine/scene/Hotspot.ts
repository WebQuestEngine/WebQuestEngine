import { Vector2D, HotspotData, VerbType, HotspotAction } from '../types';

export class Hotspot {
  public data: HotspotData;

  constructor(data: HotspotData) {
    this.data = data;
  }

  public containsPoint(p: Vector2D): boolean {
    if (!this.data.enabled || this.data.points.length < 3) return false;

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

  public getActionForVerb(verb: VerbType): HotspotAction | undefined {
    return this.data.actions.find(a => a.verb === verb);
  }
}
