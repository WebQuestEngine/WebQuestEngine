import { Graphics } from 'pixi.js';
import { Vector2D, ProjectData } from '../../engine/types';
import { Scene } from '../../engine/scene/Scene';
import { Camera } from '../../engine/core/Camera';

export interface CanvasGizmoRenderParams {
  debugOverlay: Graphics;
  currentScene: Scene | null;
  project: ProjectData | null;
  camera: Camera;
  isDrawingPolygon: boolean;
  drawingPoints: Vector2D[];
  mouseWorldPos: Vector2D | null;
  selectedElement: { type: string; id: string } | null;
  selectedHotspotId: string | null;
  selectedCharacterId: string | null;
  selectedLayerId: string | null;
}

export class CanvasGizmoRenderer {
  public static render(params: CanvasGizmoRenderParams): void {
    const {
      debugOverlay,
      currentScene,
      project,
      camera,
      isDrawingPolygon,
      drawingPoints,
      mouseWorldPos,
      selectedElement,
      selectedHotspotId,
      selectedCharacterId,
      selectedLayerId
    } = params;

    if (!debugOverlay || (debugOverlay as any).destroyed || (debugOverlay as any).context === null || !currentScene) return;

    // Always keep debug overlay on top of all layers and entity sprites (like the cauldron)
    if (currentScene.container && debugOverlay.parent === currentScene.container) {
      currentScene.container.setChildIndex(debugOverlay, currentScene.container.children.length - 1);
    }

    debugOverlay.clear();

    const scene = currentScene.data;

    // 1. Viewport Reference Frame Gizmo
    const vpSettings = project?.viewportSettings || { aspectRatio: '16:9', width: 1920, height: 1080 };
    const vW = vpSettings.width || 1920;
    const vH = vpSettings.height || 1080;
    const vX = vpSettings.x ?? 0;
    const vY = vpSettings.y ?? 0;

    debugOverlay.rect(vX, vY, vW, vH);
    debugOverlay.stroke({ color: 0x64748b, width: 2, alpha: 0.6 });

    const vpCorners = [
      { x: vX, y: vY },
      { x: vX + vW, y: vY },
      { x: vX + vW, y: vY + vH },
      { x: vX, y: vY + vH }
    ];

    for (const c of vpCorners) {
      debugOverlay.rect(c.x - 6 / camera.zoom, c.y - 6 / camera.zoom, 12 / camera.zoom, 12 / camera.zoom);
      debugOverlay.fill({ color: 0x38bdf8 });
      debugOverlay.stroke({ color: 0x0f172a, width: 2 });
    }

    // 2. Draw Polygon in Progress
    if (isDrawingPolygon && drawingPoints.length > 0) {
      debugOverlay.poly(drawingPoints.flatMap(p => [p.x, p.y]));
      debugOverlay.stroke({ color: 0xec4899, width: 2.5, alpha: 0.9 });
      debugOverlay.fill({ color: 0xec4899, alpha: 0.25 });

      for (let i = 0; i < drawingPoints.length; i++) {
        const pt = drawingPoints[i];
        debugOverlay.circle(pt.x, pt.y, (i === 0 ? 8 : 5) / camera.zoom);
        debugOverlay.fill({ color: i === 0 ? 0x22c55e : 0xf472b6 });
        debugOverlay.stroke({ color: 0xffffff, width: 2 });
      }

      if (mouseWorldPos) {
        const lastPt = drawingPoints[drawingPoints.length - 1];
        debugOverlay.moveTo(lastPt.x, lastPt.y);
        debugOverlay.lineTo(mouseWorldPos.x, mouseWorldPos.y);
        debugOverlay.stroke({ color: 0xf472b6, width: 2, alpha: 0.8 });
      }
    }

    // 3. 2.5D Perspective Scaling Lines & Floor Grid
    const activeWp = scene.walkPaths?.[0];
    if (activeWp?.scaling) {
      const { minY, maxY, vanishX } = activeWp.scaling;
      const sceneW = scene.width || 1920;
      const vx = vanishX ?? (sceneW / 2);

      // Horizon line (minY) - Cyan
      debugOverlay.moveTo(0, minY);
      debugOverlay.lineTo(sceneW, minY);
      debugOverlay.stroke({ color: 0x06b6d4, width: 2, alpha: 0.9 });

      // Foreground line (maxY) - Gold
      debugOverlay.moveTo(0, maxY);
      debugOverlay.lineTo(sceneW, maxY);
      debugOverlay.stroke({ color: 0xf59e0b, width: 2, alpha: 0.9 });

      // Converging rays to vanishing point (vx, minY)
      const numRays = 8;
      for (let i = 0; i <= numRays; i++) {
        const rayX = (sceneW / numRays) * i;
        debugOverlay.moveTo(rayX, maxY);
        debugOverlay.lineTo(vx, minY);
        debugOverlay.stroke({ color: 0x38bdf8, width: 1, alpha: 0.35 });
      }

      // Horizontal depth floor grid lines
      for (let i = 1; i < 5; i++) {
        const depthY = minY + (maxY - minY) * Math.pow(i / 5, 1.4);
        debugOverlay.moveTo(0, depthY);
        debugOverlay.lineTo(sceneW, depthY);
        debugOverlay.stroke({ color: 0x38bdf8, width: 1, alpha: 0.25 });
      }

      // Interactive Horizon & Foreground drag handles
      debugOverlay.circle(vx, minY, 8 / camera.zoom);
      debugOverlay.fill({ color: 0x06b6d4 });
      debugOverlay.stroke({ color: 0xffffff, width: 2 });

      debugOverlay.circle(vx, maxY, 8 / camera.zoom);
      debugOverlay.fill({ color: 0xf59e0b });
      debugOverlay.stroke({ color: 0xffffff, width: 2 });
    }

    // 4. Draw WalkPaths
    if (scene.walkPaths) {
      for (const wp of scene.walkPaths) {
        if (wp.points.length < 3) continue;
        const isSelected = selectedElement?.type === 'walkpath';

        debugOverlay.poly(wp.points.flatMap((p: Vector2D) => [p.x, p.y]));
        debugOverlay.stroke({ color: isSelected ? 0x38bdf8 : 0x06b6d4, width: isSelected ? 3 : 2, alpha: 0.85 });
        debugOverlay.fill({ color: isSelected ? 0x38bdf8 : 0x06b6d4, alpha: isSelected ? 0.25 : 0.12 });

        for (const pt of wp.points) {
          debugOverlay.circle(pt.x, pt.y, 6 / camera.zoom);
          debugOverlay.fill({ color: 0x22d3ee });
          debugOverlay.stroke({ color: 0xffffff, width: 1.5 });
        }
      }
    }

    // 5. Draw Hotspots
    if (scene.hotspots) {
      for (const hs of scene.hotspots) {
        if (hs.points.length < 3) continue;
        const isSelected = selectedHotspotId === hs.id;

        debugOverlay.poly(hs.points.flatMap((p: Vector2D) => [p.x, p.y]));
        debugOverlay.stroke({ color: isSelected ? 0xa855f7 : 0xd97706, width: isSelected ? 3.5 : 1.5, alpha: 0.9 });
        debugOverlay.fill({ color: isSelected ? 0x8b5cf6 : 0xfbbf24, alpha: isSelected ? 0.35 : 0.15 });

        for (const pt of hs.points) {
          debugOverlay.circle(pt.x, pt.y, (isSelected ? 7 : 5) / camera.zoom);
          debugOverlay.fill({ color: isSelected ? 0xc084fc : 0xfef08a });
          debugOverlay.stroke({ color: isSelected ? 0x7e22ce : 0xd97706, width: 1.5 });
        }
      }
    }

    // 6. Draw Selected Character Highlight & Scale Handles
    if (selectedCharacterId && currentScene) {
      const charObj = currentScene.characters.get(selectedCharacterId);
      if (charObj) {
        const cx = charObj.container.x;
        const cy = charObj.container.y;
        const hw = (charObj.data.frameWidth * charObj.data.scale) / 2;
        const hh = charObj.data.frameHeight * charObj.data.scale;
        debugOverlay.rect(cx - hw, cy - hh, hw * 2, hh);
        debugOverlay.stroke({ color: 0x8b5cf6, width: 3, alpha: 0.9 });
        debugOverlay.fill({ color: 0x8b5cf6, alpha: 0.12 });

        const handles = [
          { x: cx - hw, y: cy - hh },
          { x: cx + hw, y: cy - hh },
          { x: cx + hw, y: cy },
          { x: cx - hw, y: cy }
        ];

        for (const h of handles) {
          debugOverlay.rect(h.x - 7 / camera.zoom, h.y - 7 / camera.zoom, 14 / camera.zoom, 14 / camera.zoom);
          debugOverlay.fill({ color: 0xc084fc });
          debugOverlay.stroke({ color: 0xffffff, width: 2 });
        }
      }
    }

    // 7. Draw Selected Layer Aspect-Ratio Scale & Move Handles
    if (selectedLayerId && currentScene) {
      const selectedLayer = currentScene.layers.find(l => l.data.id === selectedLayerId);
      if (selectedLayer?.sprite) {
        const lx = selectedLayer.data.x || 0;
        const ly = selectedLayer.data.y || 0;
        const baseW = selectedLayer.sprite.texture?.width > 1 ? selectedLayer.sprite.texture.width : 1920;
        const baseH = selectedLayer.sprite.texture?.height > 1 ? selectedLayer.sprite.texture.height : 1080;
        const lw = baseW * (selectedLayer.data.scaleX ?? 1);
        const lh = baseH * (selectedLayer.data.scaleY ?? 1);

        debugOverlay.rect(lx, ly, lw, lh);
        debugOverlay.stroke({ color: 0xa855f7, width: 3, alpha: 0.9 });
        debugOverlay.fill({ color: 0xa855f7, alpha: 0.12 });

        const handles = [
          { x: lx, y: ly },
          { x: lx + lw, y: ly },
          { x: lx + lw, y: ly + lh },
          { x: lx + lw, y: ly + lh }
        ];

        for (const h of handles) {
          debugOverlay.rect(h.x - 7 / camera.zoom, h.y - 7 / camera.zoom, 14 / camera.zoom, 14 / camera.zoom);
          debugOverlay.fill({ color: 0xc084fc });
          debugOverlay.stroke({ color: 0xffffff, width: 2 });
        }
      }
    }
  }
}
