import { Vector2D, WalkPathData } from '../types';

export class WalkPath {
  public data: WalkPathData;

  constructor(data: WalkPathData) {
    this.data = data;
  }

  public getScaleAt(y: number): number {
    const { minY, maxY, minScale, maxScale } = this.data.scaling;
    if (maxY <= minY) return minScale;

    const clampedY = Math.max(minY, Math.min(maxY, y));
    const factor = (clampedY - minY) / (maxY - minY);
    return minScale + factor * (maxScale - minScale);
  }

  public containsPoint(p: Vector2D): boolean {
    if (!this.data.enabled || !this.data.points || this.data.points.length < 3) return true;
    return this.isPointInPolygon(p, this.data.points);
  }

  public clampToWalkable(target: Vector2D): Vector2D {
    if (this.containsPoint(target)) return target;

    let closestPoint = target;
    let minDistance = Infinity;
    const pts = this.data.points;
    if (!pts || pts.length < 3) return target;

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
    const l2 = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
    if (l2 === 0) return { ...p1 };
    let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  }

  // --- Pathfinding Algorithm Ported directly from pathfinder.html ---

  private distSq(p1: Vector2D, p2: Vector2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }

  private dist(p1: Vector2D, p2: Vector2D): number {
    return Math.sqrt(this.distSq(p1, p2));
  }

  private crossProduct(a: Vector2D, b: Vector2D, c: Vector2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  private dotProduct(a: Vector2D, b: Vector2D, c: Vector2D): number {
    return (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
  }

  private isPointOnSegment(c: Vector2D, a: Vector2D, b: Vector2D, epsilon = 1e-4): boolean {
    const cp = this.crossProduct(a, b, c);
    if (Math.abs(cp) > epsilon) return false;
    const dot = this.dotProduct(a, b, c);
    if (dot < -epsilon) return false;
    const sqLen = this.distSq(a, b);
    if (dot > sqLen + epsilon) return false;
    return true;
  }

  // Strict segment intersection check (excluding endpoints)
  private segmentsIntersectProper(a: Vector2D, b: Vector2D, c: Vector2D, d: Vector2D): boolean {
    const cp1 = this.crossProduct(a, b, c);
    const cp2 = this.crossProduct(a, b, d);
    const cp3 = this.crossProduct(c, d, a);
    const cp4 = this.crossProduct(c, d, b);

    if (((cp1 > 1e-5 && cp2 < -1e-5) || (cp1 < -1e-5 && cp2 > 1e-5)) &&
        ((cp3 > 1e-5 && cp4 < -1e-5) || (cp3 < -1e-5 && cp4 > 1e-5))) {
      return true;
    }
    return false;
  }

  private isPointInPolygon(p: Vector2D, poly: Vector2D[]): boolean {
    const n = poly.length;
    if (n < 3) return false;

    // Check boundary
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      if (this.isPointOnSegment(p, a, b)) return true;
    }

    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;

      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-10) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Check if line segment AB lies strictly inside (or on boundary of) polygon
  private isSegmentInsidePolygon(a: Vector2D, b: Vector2D, poly: Vector2D[]): boolean {
    const n = poly.length;

    // 1. Direct check: cannot cross any polygon edge strictly
    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      if (this.segmentsIntersectProper(a, b, p1, p2)) {
        return false;
      }
    }

    // 2. Dense interior point sampling
    const samples = 12;
    for (let k = 1; k < samples; k++) {
      const t = k / samples;
      const samplePoint = {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y)
      };
      if (!this.isPointInPolygon(samplePoint, poly)) {
        return false;
      }
    }

    return true;
  }

  public findPath(start: Vector2D, target: Vector2D): Vector2D[] {
    const polygon = this.data.points || [];
    if (polygon.length < 3) return [target];

    const startPoint = this.containsPoint(start) ? start : this.clampToWalkable(start);
    const endPoint = this.containsPoint(target) ? target : this.clampToWalkable(target);

    // Assemble graph nodes: Node 0 = Start, Node 1 = End, Nodes 2..N+1 = Polygon Vertices
    const nodes = [startPoint, endPoint, ...polygon];
    const numNodes = nodes.length;

    const adj: { node: number; weight: number }[][] = Array.from({ length: numNodes }, () => []);

    // Calculate visibility graph edges
    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        const pA = nodes[i];
        const pB = nodes[j];

        let isBoundaryEdge = false;
        if (i >= 2 && j >= 2) {
          const idxA = i - 2;
          const idxB = j - 2;
          const N = polygon.length;
          if ((idxA + 1) % N === idxB || (idxB + 1) % N === idxA) {
            isBoundaryEdge = true;
          }
        }

        if (isBoundaryEdge || this.isSegmentInsidePolygon(pA, pB, polygon)) {
          const d = this.dist(pA, pB);
          adj[i].push({ node: j, weight: d });
          adj[j].push({ node: i, weight: d });
        }
      }
    }

    // Dijkstra's Algorithm
    const distances = new Array(numNodes).fill(Infinity);
    const previous = new Array<number | null>(numNodes).fill(null);
    const visited = new Array(numNodes).fill(false);

    distances[0] = 0; // Start node index = 0

    for (let step = 0; step < numNodes; step++) {
      let minDist = Infinity;
      let u = -1;
      for (let i = 0; i < numNodes; i++) {
        if (!visited[i] && distances[i] < minDist) {
          minDist = distances[i];
          u = i;
        }
      }

      if (u === -1 || u === 1) break; // Reached end node or unreachable
      visited[u] = true;

      for (const edge of adj[u]) {
        if (!visited[edge.node]) {
          const alt = distances[u] + edge.weight;
          if (alt < distances[edge.node]) {
            distances[edge.node] = alt;
            previous[edge.node] = u;
          }
        }
      }
    }

    // Reconstruct path
    const path: Vector2D[] = [];
    if (distances[1] !== Infinity) {
      let curr: number | null = 1; // End node index
      while (curr !== null) {
        path.unshift(nodes[curr]);
        curr = previous[curr];
      }
      // Return waypoints without the initial start point (Node 0)
      return path.slice(1);
    }

    // Fallback if unreachable
    return [endPoint];
  }
}
