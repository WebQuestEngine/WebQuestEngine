import { describe, it, expect } from 'vitest';
import { PolygonGeometry } from '../../../src/rig-studio/slicer/PolygonGeometry';
import { Point2D } from '../../../src/rig-studio/slicer/MarchingSquares';

describe('PolygonGeometry', () => {
  const createSquare = (): Point2D[] => [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ];

  it('projects a point to the closest polygon edge', () => {
    const square = createSquare();
    const projection = PolygonGeometry.findClosestEdge({ x: 50, y: -5 }, square);
    expect(projection).not.toBeNull();
    expect(projection?.edgeIndex).toBe(0); // top edge from (0,0) to (100,0)
    expect(projection?.point).toEqual({ x: 50, y: 0 });
    expect(projection?.distance).toBe(5);
  });

  it('inserts a node on the edge properly', () => {
    const square = createSquare();
    const updated = PolygonGeometry.insertNodeOnEdge(square, 0, { x: 50, y: 0 });
    expect(updated.length).toBe(5);
    expect(updated[1]).toEqual({ x: 50, y: 0 });
    expect(updated[0]).toEqual({ x: 0, y: 0 });
    expect(updated[2]).toEqual({ x: 100, y: 0 });
  });

  it('deletes a node if polygon has more than 3 nodes, but refuses if 3 or fewer', () => {
    const square = createSquare();
    const pentagon = PolygonGeometry.insertNodeOnEdge(square, 0, { x: 50, y: 0 });
    expect(pentagon.length).toBe(5);

    const deleted = PolygonGeometry.deleteNode(pentagon, 1);
    expect(deleted?.length).toBe(4);
    expect(deleted).toEqual(square);

    // Cannot delete below 3 nodes
    const triangle: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const failDelete = PolygonGeometry.deleteNode(triangle, 0);
    expect(failDelete).toBeNull();
  });

  it('splits a polygon cleanly into two separate polygons using a knife cut line', () => {
    const square = createSquare();
    // Vertical cut down the middle from x=50, y=-10 to x=50, y=110
    const result = PolygonGeometry.splitPolygon(square, { x: 50, y: -10 }, { x: 50, y: 110 });
    expect(result).not.toBeNull();

    const { poly1, poly2 } = result!;
    expect(poly1.length).toBeGreaterThanOrEqual(3);
    expect(poly2.length).toBeGreaterThanOrEqual(3);

    // One half should have max X around 50, other half should have min X around 50
    const poly1Xs = poly1.map(p => p.x);
    const poly2Xs = poly2.map(p => p.x);

    expect(poly1Xs.includes(50)).toBe(true);
    expect(poly2Xs.includes(50)).toBe(true);
  });

  it('smooths a polygon using Chaikin corner cutting', () => {
    const square = createSquare();
    const smoothed = PolygonGeometry.smoothChaikin(square, 1);
    expect(smoothed.length).toBe(8); // 4 corners * 2
  });

  it('subdivides a polygon by adding midpoints', () => {
    const square = createSquare();
    const subdivided = PolygonGeometry.subdivide(square);
    expect(subdivided.length).toBe(8);
    expect(subdivided[1]).toEqual({ x: 50, y: 0 });
  });
});
