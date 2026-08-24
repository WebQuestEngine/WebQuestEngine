import { Vector2D, WalkPathData } from '../types';

export class WalkPath {
  public data: WalkPathData;

  constructor(data: WalkPathData) {
    this.data = data;
  }

  public containsPoint(p: Vector2D): boolean {
    if (!this.data.enabled || this.data.points.length < 3) return true; // Fallback if no polygon defined

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

  public getScaleAt(y: number): number {
    const { minY, maxY, minScale, maxScale } = this.data.scaling;
    if (maxY <= minY) return minScale;

    const clampedY = Math.max(minY, Math.min(maxY, y));
    const factor = (clampedY - minY) / (maxY - minY);
    return minScale + factor * (maxScale - minScale);
  }

  public clampToWalkable(target: Vector2D): Vector2D {
    if (this.containsPoint(target)) return target;

    // Find closest point on polygon edge
    let closestPoint = target;
    let minDistance = Infinity;
    const pts = this.data.points;

    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const proj = this.closestPointOnSegment(p1, p2, target);
      const dist = Math.hypot(proj.x - target.x, proj.y - target.y);

      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = proj;
      }
    }

    return closestPoint;
  }

  private closestPointOnSegment(p1: Vector2D, p2: Vector2D, p: Vector2D): Vector2D {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return { ...p1 };

    const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy)));
    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
  }
}
