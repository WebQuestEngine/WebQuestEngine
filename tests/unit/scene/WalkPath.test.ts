import { describe, it, expect } from 'vitest';
import { WalkPath } from '../../../src/engine/scene/WalkPath';
import { WalkPathData } from '../../../src/engine/types';

describe('WalkPath', () => {
  const createRectWalkPath = (points = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 300 },
    { x: 0, y: 300 }
  ]): WalkPath => {
    const data: WalkPathData = {
      id: 'wp_test',
      name: 'Test Path',
      enabled: true,
      points,
      scaling: {
        minY: 100,
        maxY: 300,
        minScale: 0.5,
        maxScale: 1.5
      }
    };
    return new WalkPath(data);
  };

  describe('containsPoint', () => {
    it('returns true for points inside convex polygon', () => {
      const wp = createRectWalkPath();
      expect(wp.containsPoint({ x: 100, y: 200 })).toBe(true);
      expect(wp.containsPoint({ x: 50, y: 150 })).toBe(true);
    });

    it('returns false for points outside polygon', () => {
      const wp = createRectWalkPath();
      expect(wp.containsPoint({ x: 250, y: 200 })).toBe(false);
      expect(wp.containsPoint({ x: 100, y: 50 })).toBe(false);
      expect(wp.containsPoint({ x: -10, y: 200 })).toBe(false);
    });

    it('returns true on polygon boundary', () => {
      const wp = createRectWalkPath();
      expect(wp.containsPoint({ x: 100, y: 100 })).toBe(true);
      expect(wp.containsPoint({ x: 200, y: 200 })).toBe(true);
    });

    it('returns false for points inside the void of a concave (L-shaped) polygon', () => {
      // L-shaped polygon:
      // (0,0) ---- (200,0)
      // |            |
      // |         (100,100) - (200,100) (cutout)
      // |            |
      // (0,200) -- (100,200)
      const lPolygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 0, y: 200 }
      ];
      const wp = createRectWalkPath(lPolygon);

      // (50, 50) is inside
      expect(wp.containsPoint({ x: 50, y: 50 })).toBe(true);
      // (150, 50) is in the cutout (outside)
      expect(wp.containsPoint({ x: 150, y: 50 })).toBe(false);
    });
  });

  describe('getScaleAt', () => {
    it('calculates linear scale correctly between minY and maxY', () => {
      const wp = createRectWalkPath();
      expect(wp.getScaleAt(100)).toBeCloseTo(0.5);
      expect(wp.getScaleAt(200)).toBeCloseTo(1.0);
      expect(wp.getScaleAt(300)).toBeCloseTo(1.5);
    });

    it('clamps scale at minY and maxY bounds', () => {
      const wp = createRectWalkPath();
      expect(wp.getScaleAt(0)).toBeCloseTo(0.5);
      expect(wp.getScaleAt(500)).toBeCloseTo(1.5);
    });

    it('handles degenerate min/max bounds without divide by zero', () => {
      const data: WalkPathData = {
        id: 'wp_flat',
        name: 'Flat',
        enabled: true,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        scaling: { minY: 200, maxY: 200, minScale: 1.0, maxScale: 1.0 }
      };
      const wp = new WalkPath(data);
      expect(wp.getScaleAt(200)).toBe(1.0);
      expect(wp.getScaleAt(500)).toBe(1.0);
    });
  });

  describe('clampToWalkable', () => {
    it('returns original point if already inside', () => {
      const wp = createRectWalkPath();
      const point = { x: 100, y: 200 };
      expect(wp.clampToWalkable(point)).toEqual(point);
    });

    it('projects outside point to nearest boundary segment', () => {
      const wp = createRectWalkPath();
      // Point (250, 200) is right of edge (200, 100)-(200, 300)
      const clamped = wp.clampToWalkable({ x: 250, y: 200 });
      expect(clamped.x).toBeCloseTo(200);
      expect(clamped.y).toBeCloseTo(200);
    });
  });

  describe('findPath', () => {
    it('returns direct single waypoint when destination is in direct line of sight', () => {
      const wp = createRectWalkPath();
      const start = { x: 50, y: 200 };
      const target = { x: 150, y: 200 };

      const path = wp.findPath(start, target);
      expect(path).toHaveLength(1);
      expect(path[0].x).toBeCloseTo(150);
      expect(path[0].y).toBeCloseTo(200);
    });

    it('routes around concave obstacle corners via Dijkstra', () => {
      // U-shaped corridor:
      // (0,0) ---------- (300,0)
      // |   (100,100)-(200,100)   | (obstacle in middle)
      // |   (100,300)-(200,300)   |
      // (0,300) -------- (300,300)
      // Simplified: L-shaped obstacle requiring path to navigate corner
      const polygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 0, y: 200 }
      ];
      const wp = createRectWalkPath(polygon);

      // Start at (50, 20), End at (180, 180). Direct line crosses the empty cutout at (150, 50).
      const start = { x: 50, y: 20 };
      const target = { x: 180, y: 180 };

      const path = wp.findPath(start, target);
      // Path must have intermediate waypoint around corner
      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[path.length - 1].x).toBeCloseTo(180);
      expect(path[path.length - 1].y).toBeCloseTo(180);
    });

    it('falls back safely for degenerate polygons (< 3 points)', () => {
      const data: WalkPathData = {
        id: 'wp_degen',
        name: 'Degenerate',
        enabled: true,
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        scaling: { minY: 0, maxY: 100, minScale: 1, maxScale: 1 }
      };
      const wp = new WalkPath(data);
      const path = wp.findPath({ x: 0, y: 0 }, { x: 50, y: 50 });
      expect(path).toEqual([{ x: 50, y: 50 }]);
    });
  });
});
