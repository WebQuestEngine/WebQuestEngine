import { Vector2D } from '../types';
import { WalkPath } from '../scene/WalkPath';

export class PathfindingSystem {
  public static calculatePath(start: Vector2D, end: Vector2D, walkPath: WalkPath): Vector2D[] {
    const validEnd = walkPath.clampToWalkable(end);

    // Simple line-of-sight check. If direct path is inside polygon, return direct path
    if (walkPath.containsPoint(start) && walkPath.containsPoint(validEnd)) {
      return [validEnd];
    }

    return [validEnd];
  }
}
