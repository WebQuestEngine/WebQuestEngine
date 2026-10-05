export interface Point2D {
  x: number;
  y: number;
}

export class MarchingSquares {
  /**
   * Traces the contour of contiguous opaque pixels starting from a click coordinate.
   */
  public static traceContour(
    imageData: ImageData,
    clickX: number,
    clickY: number,
    alphaThreshold = 25,
    epsilon = 2.0
  ): Point2D[] | null {
    const { width, height, data } = imageData;
    const cx = Math.floor(clickX);
    const cy = Math.floor(clickY);

    if (cx < 0 || cx >= width || cy < 0 || cy >= height) return null;

    const getAlpha = (x: number, y: number): number => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return data[(y * width + x) * 4 + 3];
    };

    // If clicked on transparent pixel, search a small neighborhood (radius 8)
    let startX = cx;
    let startY = cy;
    if (getAlpha(startX, startY) <= alphaThreshold) {
      let found = false;
      for (let r = 1; r <= 8 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            if (getAlpha(cx + dx, cy + dy) > alphaThreshold) {
              startX = cx + dx;
              startY = cy + dy;
              found = true;
            }
          }
        }
      }
      if (!found) return null;
    }

    // Step 1: Flood fill to find all connected pixels belonging to this element
    const visited = new Uint8Array(width * height);
    const queue: [number, number][] = [[startX, startY]];
    visited[startY * width + startX] = 1;

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    let queueHead = 0;
    while (queueHead < queue.length) {
      const [qx, qy] = queue[queueHead++];
      if (qx < minX) minX = qx;
      if (qx > maxX) maxX = qx;
      if (qy < minY) minY = qy;
      if (qy > maxY) maxY = qy;

      const neighbors: [number, number][] = [
        [qx + 1, qy],
        [qx - 1, qy],
        [qx, qy + 1],
        [qx, qy - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          if (!visited[idx] && getAlpha(nx, ny) > alphaThreshold) {
            visited[idx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    if (queue.length < 9) return null; // Too small

    // Step 2: Moore-Neighbor Tracing on the connected island
    // Find top-leftmost pixel of the island
    let topX = minX;
    let topY = minY;
    let foundTop = false;
    for (let y = minY; y <= maxY && !foundTop; y++) {
      for (let x = minX; x <= maxX && !foundTop; x++) {
        if (visited[y * width + x]) {
          topX = x;
          topY = y;
          foundTop = true;
        }
      }
    }

    // Moore neighborhood 8 directions clockwise (starting from top)
    const dirs: [number, number][] = [
      [0, -1],  // 0: N
      [1, -1],  // 1: NE
      [1, 0],   // 2: E
      [1, 1],   // 3: SE
      [0, 1],   // 4: S
      [-1, 1],  // 5: SW
      [-1, 0],  // 6: W
      [-1, -1]  // 7: NW
    ];

    const isIslandPixel = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return visited[y * width + x] === 1;
    };

    const rawContour: Point2D[] = [];
    let currX = topX;
    let currY = topY;
    rawContour.push({ x: currX, y: currY });

    // backtrack direction
    let backDir = 6; // West
    const maxSteps = (maxX - minX + maxY - minY) * 16;
    let steps = 0;

    while (steps++ < maxSteps) {
      // Start checking clockwise from (backDir + 2) % 8
      let nextFound = false;
      let checkDir = (backDir + 2) % 8;

      for (let i = 0; i < 8; i++) {
        const d = (checkDir + i) % 8;
        const nx = currX + dirs[d][0];
        const ny = currY + dirs[d][1];

        if (isIslandPixel(nx, ny)) {
          currX = nx;
          currY = ny;
          rawContour.push({ x: currX, y: currY });
          backDir = (d + 4) % 8; // opposite direction
          nextFound = true;
          break;
        }
      }

      if (!nextFound || (currX === topX && currY === topY && rawContour.length > 3)) {
        break;
      }
    }

    if (rawContour.length < 3) return null;

    // Step 3: Douglas-Peucker polygon simplification
    return this.douglasPeucker(rawContour, epsilon);
  }

  /**
   * Douglas-Peucker polyline simplification algorithm.
   */
  public static douglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
    if (points.length <= 3) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const rec1 = this.douglasPeucker(points.slice(0, index + 1), epsilon);
      const rec2 = this.douglasPeucker(points.slice(index), epsilon);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
      return [points[0], points[end]];
    }
  }

  private static perpendicularDistance(p: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
    const u = ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / (mag * mag);
    const clampedU = Math.max(0, Math.min(1, u));
    const projX = lineStart.x + clampedU * dx;
    const projY = lineStart.y + clampedU * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }
}
