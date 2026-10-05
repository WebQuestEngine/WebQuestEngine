import { describe, it, expect } from 'vitest';
import { MarchingSquares } from '../../../src/rig-studio/slicer/MarchingSquares';

describe('MarchingSquares Contour Auto-Tracer', () => {
  it('simplifies polyline with Douglas-Peucker', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0.1 },
      { x: 2, y: -0.1 },
      { x: 10, y: 0 }
    ];

    const simplified = MarchingSquares.douglasPeucker(points, 0.5);
    expect(simplified.length).toBe(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 10, y: 0 });
  });

  it('preserves sharp corners in Douglas-Peucker simplification', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 }
    ];

    const simplified = MarchingSquares.douglasPeucker(points, 0.5);
    expect(simplified.length).toBeGreaterThanOrEqual(4);
  });

  it('traces a solid rectangle island', () => {
    // 20x20 image with a 10x10 solid box from (5,5) to (14,14)
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 255;     // R
        data[idx + 1] = 0;   // G
        data[idx + 2] = 0;   // B
        data[idx + 3] = 255; // A (opaque)
      }
    }

    const imgData = {
      width,
      height,
      data
    } as ImageData;

    const contour = MarchingSquares.traceContour(imgData, 7, 7, 25, 1.0);
    expect(contour).not.toBeNull();
    expect(contour!.length).toBeGreaterThanOrEqual(4);

    // Bounding box of contour should cover roughly (5,5) to (14,14)
    const xs = contour!.map(p => p.x);
    const ys = contour!.map(p => p.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(6);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(13);
    expect(Math.min(...ys)).toBeLessThanOrEqual(6);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(13);
  });

  it('returns null when clicking on fully transparent image without opaque pixels', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4); // all 0 alpha
    const imgData = { width, height, data } as ImageData;

    const contour = MarchingSquares.traceContour(imgData, 5, 5, 25);
    expect(contour).toBeNull();
  });
});
