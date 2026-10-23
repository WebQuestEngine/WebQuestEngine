import { MarchingSquares, Point2D } from './MarchingSquares';

export interface EdgeProjection {
  edgeIndex: number;
  point: Point2D;
  distance: number;
}

export interface SplitResult {
  poly1: Point2D[];
  poly2: Point2D[];
}

export class PolygonGeometry {
  /**
   * Calculates perpendicular projection of a point onto a line segment.
   */
  public static projectPointToSegment(p: Point2D, a: Point2D, b: Point2D): { point: Point2D; t: number; distance: number } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return {
        point: { x: a.x, y: a.y },
        t: 0,
        distance: Math.hypot(p.x - a.x, p.y - a.y)
      };
    }

    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const projX = Math.round(a.x + t * dx);
    const projY = Math.round(a.y + t * dy);
    const dist = Math.hypot(p.x - projX, p.y - projY);

    return {
      point: { x: projX, y: projY },
      t,
      distance: dist
    };
  }

  /**
   * Finds the closest edge on a polygon to a given point.
   */
  public static findClosestEdge(p: Point2D, polygon: Point2D[]): EdgeProjection | null {
    if (polygon.length < 2) return null;

    let closestEdge = 0;
    let closestDist = Infinity;
    let closestPoint: Point2D = polygon[0];

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const res = this.projectPointToSegment(p, a, b);

      if (res.distance < closestDist) {
        closestDist = res.distance;
        closestEdge = i;
        closestPoint = res.point;
      }
    }

    return {
      edgeIndex: closestEdge,
      point: closestPoint,
      distance: closestDist
    };
  }

  /**
   * Inserts a node into a polygon on the specified edge index.
   */
  public static insertNodeOnEdge(polygon: Point2D[], edgeIndex: number, point: Point2D): Point2D[] {
    const updated = [...polygon];
    const insertIdx = edgeIndex + 1;
    updated.splice(insertIdx, 0, { x: Math.round(point.x), y: Math.round(point.y) });
    return updated;
  }

  /**
   * Deletes a node from a polygon at the specified index.
   * Returns null if polygon would have fewer than 3 vertices.
   */
  public static deleteNode(polygon: Point2D[], nodeIndex: number): Point2D[] | null {
    if (polygon.length <= 3) return null;
    if (nodeIndex < 0 || nodeIndex >= polygon.length) return null;

    const updated = [...polygon];
    updated.splice(nodeIndex, 1);
    return updated;
  }

  /**
   * Line-segment intersection between segment (p1, p2) and segment (p3, p4).
   */
  public static getSegmentIntersection(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D
  ): { point: Point2D; t: number; u: number } | null {
    const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(d) < 1e-6) return null;

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return {
        point: {
          x: Math.round(p1.x + ua * (p2.x - p1.x)),
          y: Math.round(p1.y + ua * (p2.y - p1.y))
        },
        t: ua,
        u: ub
      };
    }
    return null;
  }

  /**
   * Slices a polygon across a cut line (p1 -> p2).
   * Extends the cut line across the polygon bounding box so the user doesn't have to draw far outside.
   * Returns two valid polygons with >= 3 vertices, or null if cut line did not cleanly bisect the polygon.
   */
  public static splitPolygon(polygon: Point2D[], p1: Point2D, p2: Point2D): SplitResult | null {
    if (polygon.length < 3) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return null;

    const ux = dx / len;
    const uy = dy / len;

    // Extend cut line by 4000 pixels in each direction
    const cutStart: Point2D = { x: p1.x - ux * 4000, y: p1.y - uy * 4000 };
    const cutEnd: Point2D = { x: p2.x + ux * 4000, y: p2.y + uy * 4000 };

    interface IntersectionInfo {
      edgeIndex: number;
      point: Point2D;
      t: number;
    }

    const intersections: IntersectionInfo[] = [];

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const inter = this.getSegmentIntersection(cutStart, cutEnd, a, b);
      if (inter) {
        intersections.push({
          edgeIndex: i,
          point: inter.point,
          t: inter.t
        });
      }
    }

    // Require at least 2 intersections
    if (intersections.length < 2) return null;

    // Sort along cut line
    intersections.sort((a, b) => a.t - b.t);

    const intA = intersections[0];
    const intB = intersections[intersections.length - 1];

    let idx1 = intA.edgeIndex;
    let pt1 = intA.point;
    let idx2 = intB.edgeIndex;
    let pt2 = intB.point;

    if (idx1 === idx2) return null;

    if (idx1 > idx2) {
      [idx1, idx2] = [idx2, idx1];
      [pt1, pt2] = [pt2, pt1];
    }

    const n = polygon.length;

    // Piece 1: [pt1, polygon[idx1+1 ... idx2], pt2]
    const poly1: Point2D[] = [pt1];
    let curr = (idx1 + 1) % n;
    while (curr !== (idx2 + 1) % n) {
      poly1.push({ ...polygon[curr] });
      curr = (curr + 1) % n;
    }
    poly1.push(pt2);

    // Piece 2: [pt2, polygon[idx2+1 ... idx1], pt1]
    const poly2: Point2D[] = [pt2];
    curr = (idx2 + 1) % n;
    while (curr !== (idx1 + 1) % n) {
      poly2.push({ ...polygon[curr] });
      curr = (curr + 1) % n;
    }
    poly2.push(pt1);

    // Filter duplicate consecutive points
    const clean1 = this.removeDuplicatePoints(poly1);
    const clean2 = this.removeDuplicatePoints(poly2);

    if (clean1.length >= 3 && clean2.length >= 3) {
      return { poly1: clean1, poly2: clean2 };
    }

    return null;
  }

  /**
   * Applies Chaikin's corner-cutting smoothing algorithm.
   */
  public static smoothChaikin(polygon: Point2D[], iterations = 1): Point2D[] {
    if (polygon.length < 3) return polygon;
    let current = [...polygon];

    for (let it = 0; it < iterations; it++) {
      const next: Point2D[] = [];
      const n = current.length;

      for (let i = 0; i < n; i++) {
        const p0 = current[i];
        const p1 = current[(i + 1) % n];

        const q: Point2D = {
          x: Math.round(0.75 * p0.x + 0.25 * p1.x),
          y: Math.round(0.75 * p0.y + 0.25 * p1.y)
        };
        const r: Point2D = {
          x: Math.round(0.25 * p0.x + 0.75 * p1.x),
          y: Math.round(0.25 * p0.y + 0.75 * p1.y)
        };

        next.push(q, r);
      }
      current = this.removeDuplicatePoints(next);
    }

    return current;
  }

  /**
   * Subdivides polygon by placing a midpoint on every edge.
   */
  public static subdivide(polygon: Point2D[]): Point2D[] {
    if (polygon.length < 3) return polygon;
    const next: Point2D[] = [];
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
      const p0 = polygon[i];
      const p1 = polygon[(i + 1) % n];
      const mid: Point2D = {
        x: Math.round((p0.x + p1.x) / 2),
        y: Math.round((p0.y + p1.y) / 2)
      };
      next.push({ ...p0 }, mid);
    }

    return this.removeDuplicatePoints(next);
  }

  /**
   * Removes consecutive duplicate points from a polygon.
   */
  public static removeDuplicatePoints(polygon: Point2D[]): Point2D[] {
    if (polygon.length <= 1) return polygon;
    const result: Point2D[] = [];

    for (let i = 0; i < polygon.length; i++) {
      const curr = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      if (curr.x !== next.x || curr.y !== next.y) {
        result.push(curr);
      }
    }

    return result.length >= 3 ? result : polygon;
  }

  /**
   * Douglas-Peucker polygon simplification for closed polygons.
   */
  public static simplifyPolygon(polygon: Point2D[], epsilon = 2.0): Point2D[] {
    if (polygon.length <= 3) return polygon;

    // Find the two vertices furthest apart
    let maxDist = 0;
    let idxA = 0;
    let idxB = Math.floor(polygon.length / 2);

    for (let i = 0; i < polygon.length; i++) {
      for (let j = i + 1; j < polygon.length; j++) {
        const d = Math.hypot(polygon[i].x - polygon[j].x, polygon[i].y - polygon[j].y);
        if (d > maxDist) {
          maxDist = d;
          idxA = i;
          idxB = j;
        }
      }
    }

    if (idxA > idxB) [idxA, idxB] = [idxB, idxA];

    // Path 1: from idxA to idxB
    const path1: Point2D[] = [];
    for (let i = idxA; i <= idxB; i++) {
      path1.push(polygon[i]);
    }

    // Path 2: from idxB to idxA around loop
    const path2: Point2D[] = [];
    for (let i = idxB; i < polygon.length; i++) {
      path2.push(polygon[i]);
    }
    for (let i = 0; i <= idxA; i++) {
      path2.push(polygon[i]);
    }

    const simp1 = MarchingSquares.douglasPeucker(path1, epsilon);
    const simp2 = MarchingSquares.douglasPeucker(path2, epsilon);

    const merged = simp1.slice(0, simp1.length - 1).concat(simp2.slice(0, simp2.length - 1));
    const cleaned = this.removeDuplicatePoints(merged);

    return cleaned.length >= 3 ? cleaned : polygon;
  }
}
