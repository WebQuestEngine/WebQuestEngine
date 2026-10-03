import { Vector2D } from '../../engine/types';
import { Scene } from '../../engine/scene/Scene';
import { CanvasInteractionUtils } from './CanvasInteractionUtils';

export class PolygonEditorController {
  public isDrawingPolygon = false;
  public drawingPoints: Vector2D[] = [];
  public drawingPolygonTarget: { type: 'hotspot' | 'walkpath'; hIdx?: number } | null = null;

  public startDrawing(targetType: 'hotspot' | 'walkpath', hIdx?: number): void {
    this.isDrawingPolygon = true;
    this.drawingPoints = [];
    this.drawingPolygonTarget = {
      type: targetType,
      hIdx
    };
  }

  public cancelDrawing(): void {
    this.isDrawingPolygon = false;
    this.drawingPoints = [];
    this.drawingPolygonTarget = null;
  }

  public addDrawingPoint(worldPt: Vector2D, zoom: number, currentScene: Scene | null): { finished: boolean; count?: number } {
    if (this.drawingPoints.length >= 3) {
      const firstPt = this.drawingPoints[0];
      if (Math.hypot(worldPt.x - firstPt.x, worldPt.y - firstPt.y) < 15 / zoom) {
        const count = this.finishDrawing(currentScene);
        return { finished: true, count };
      }
    }
    this.drawingPoints.push({ x: Math.round(worldPt.x), y: Math.round(worldPt.y) });
    this.updateTarget(currentScene);
    return { finished: false };
  }

  public undoDrawingPoint(currentScene: Scene | null): boolean {
    if (this.drawingPoints.length > 0) {
      this.drawingPoints.pop();
      this.updateTarget(currentScene);
      return true;
    }
    return false;
  }

  public finishDrawing(currentScene: Scene | null): number {
    if (!this.drawingPolygonTarget || !currentScene || this.drawingPoints.length < 3) return 0;

    if (this.drawingPolygonTarget.type === 'walkpath') {
      const wp = currentScene.data.walkPaths?.[0];
      if (wp) wp.points = [...this.drawingPoints];
    } else if (this.drawingPolygonTarget.type === 'hotspot' && this.drawingPolygonTarget.hIdx !== undefined) {
      const hs = currentScene.data.hotspots[this.drawingPolygonTarget.hIdx];
      if (hs) hs.points = [...this.drawingPoints];
    }

    const count = this.drawingPoints.length;
    this.isDrawingPolygon = false;
    this.drawingPolygonTarget = null;
    this.drawingPoints = [];
    return count;
  }

  public updateTarget(currentScene: Scene | null): void {
    if (!this.drawingPolygonTarget || !currentScene) return;

    if (this.drawingPolygonTarget.type === 'walkpath') {
      const wp = currentScene.data.walkPaths?.[0];
      if (wp) wp.points = [...this.drawingPoints];
    } else if (this.drawingPolygonTarget.type === 'hotspot' && this.drawingPolygonTarget.hIdx !== undefined) {
      const hs = currentScene.data.hotspots[this.drawingPolygonTarget.hIdx];
      if (hs) hs.points = [...this.drawingPoints];
    }
  }

  public tryInsertEdgeVertex(
    worldPt: Vector2D,
    zoom: number,
    currentScene: Scene | null,
    selectedHotspotId: string | null
  ): { type: 'hotspot_vertex' | 'walkpath_vertex'; hIdx?: number; index: number; point: Vector2D } | null {
    if (!currentScene) return null;

    // 1. Hotspot edge insertion
    if (selectedHotspotId && !CanvasInteractionUtils.isElementLocked(null, currentScene, 'hotspot', selectedHotspotId)) {
      const hsIdx = currentScene.data.hotspots.findIndex(h => h.id === selectedHotspotId);
      if (hsIdx !== -1) {
        const hs = currentScene.data.hotspots[hsIdx];
        for (let i = 0; i < hs.points.length; i++) {
          const ptA = hs.points[i];
          const ptB = hs.points[(i + 1) % hs.points.length];
          if (CanvasInteractionUtils.distanceToSegment(worldPt, ptA, ptB) < 10 / zoom) {
            const newPt = { x: Math.round(worldPt.x), y: Math.round(worldPt.y) };
            hs.points.splice(i + 1, 0, newPt);
            return { type: 'hotspot_vertex', hIdx: hsIdx, index: i + 1, point: newPt };
          }
        }
      }
    }

    // 2. Walkpath edge insertion
    if (!CanvasInteractionUtils.isElementLocked(null, currentScene, 'walkpath') && currentScene.data.walkPaths) {
      for (const wp of currentScene.data.walkPaths) {
        for (let i = 0; i < wp.points.length; i++) {
          const ptA = wp.points[i];
          const ptB = wp.points[(i + 1) % wp.points.length];
          if (CanvasInteractionUtils.distanceToSegment(worldPt, ptA, ptB) < 10 / zoom) {
            const newPt = { x: Math.round(worldPt.x), y: Math.round(worldPt.y) };
            wp.points.splice(i + 1, 0, newPt);
            return { type: 'walkpath_vertex', index: i + 1, point: newPt };
          }
        }
      }
    }

    return null;
  }

  public tryDeleteVertex(
    worldPt: Vector2D,
    zoom: number,
    currentScene: Scene | null,
    selectedHotspotId: string | null
  ): { success: boolean; message: string } | null {
    if (!currentScene) return null;

    // Right-clicking a vertex of selected hotspot -> Delete vertex
    if (selectedHotspotId) {
      const hsIdx = currentScene.data.hotspots.findIndex(h => h.id === selectedHotspotId);
      if (hsIdx !== -1) {
        const hs = currentScene.data.hotspots[hsIdx];
        for (let i = 0; i < hs.points.length; i++) {
          if (Math.hypot(worldPt.x - hs.points[i].x, worldPt.y - hs.points[i].y) < 14 / zoom) {
            if (hs.points.length > 3) {
              hs.points.splice(i, 1);
              return { success: true, message: `🗑️ Deleted vertex point #${i + 1}` };
            } else {
              return { success: false, message: '⚠️ Polygon must have at least 3 vertices.' };
            }
          }
        }
      }
    }

    // Right-clicking a WalkPath vertex -> Delete vertex
    if (currentScene.data.walkPaths) {
      for (const wp of currentScene.data.walkPaths) {
        for (let i = 0; i < wp.points.length; i++) {
          if (Math.hypot(worldPt.x - wp.points[i].x, worldPt.y - wp.points[i].y) < 14 / zoom) {
            if (wp.points.length > 3) {
              wp.points.splice(i, 1);
              return { success: true, message: `🗑️ Deleted WalkPath vertex #${i + 1}` };
            } else {
              return { success: false, message: '⚠️ WalkPath polygon must have at least 3 vertices.' };
            }
          }
        }
      }
    }

    return null;
  }
}
