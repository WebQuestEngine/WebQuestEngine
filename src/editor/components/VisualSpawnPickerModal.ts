import * as PIXI from 'pixi.js';
import { ProjectData, SceneData, Vector2D } from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';
import { EventBus } from '../../engine/core/EventBus';

export interface SpawnPickerResult {
  x: number;
  y: number;
  scale?: number;
}

export class VisualSpawnPickerModal {
  private overlay: HTMLElement;
  private pixiApp: PIXI.Application | null = null;
  private project: ProjectData;
  private targetScene: SceneData;
  private initialSpawn: Vector2D;
  private currentPos: Vector2D;
  private currentScale: number = 1;
  private onConfirm: (result: SpawnPickerResult) => void;
  private onCancel: () => void;
  private isDestroyed = false;

  constructor(
    project: ProjectData,
    targetScene: SceneData,
    initialSpawn: Vector2D,
    onConfirm: (result: SpawnPickerResult) => void,
    onCancel: () => void
  ) {
    this.project = project;
    this.targetScene = targetScene;
    this.initialSpawn = { ...initialSpawn };
    this.currentPos = { ...initialSpawn };
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    const targetChar = targetScene.characters?.find(c => c.id === 'player') || project.scenes[0]?.characters?.find(c => c.id === 'player');
    if (targetChar && targetChar.scale) {
      this.currentScale = targetChar.scale;
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    `;

    this.render();
  }

  private render(): void {
    this.overlay.innerHTML = `
      <div class="modal-window" style="width: 90vw; max-width: 1280px; height: 85vh; display: flex; flex-direction: column; background: var(--bg-dark, #0f172a); border: 2px solid var(--accent-gold, #fbbf24); border-radius: 12px; overflow: hidden; box-shadow: 0 25px 70px rgba(0,0,0,0.9);">
        <div class="modal-header" style="padding: 12px 20px; background: rgba(15, 23, 42, 0.95); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2rem;">📍</span>
            <span style="font-weight: 700; font-size: 0.95rem; color: var(--accent-gold, #fbbf24);">
              Visual Teleport Spawn & Scale Picker — Destination Scene: <span style="color: #38bdf8;">${this.targetScene.name}</span>
            </span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span style="font-size: 0.72rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">
              💡 Click to position character | Scroll wheel to adjust scale
            </span>
            <button class="btn btn-primary" id="btn-modal-confirm-spawn" style="padding: 6px 16px; font-size: 0.8rem; font-weight: 700; background: #059669; border: none; border-radius: 6px; color: white; cursor: pointer;">
              💾 Confirm Spawn Point
            </button>
            <button class="btn" id="btn-modal-cancel-spawn" style="padding: 6px 12px; font-size: 0.8rem; background: #dc2626; border: none; border-radius: 6px; color: white; cursor: pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>

        <div id="spawn-picker-viewport" style="flex: 1; position: relative; overflow: hidden; background: #020617; cursor: crosshair; display: flex; align-items: center; justify-content: center;">
          <div id="spawn-picker-canvas-host" style="width: 100%; height: 100%;"></div>
        </div>

        <div class="modal-footer" style="padding: 10px 20px; background: rgba(15, 23, 42, 0.95); font-size: 0.78rem; color: #cbd5e1; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1);">
          <span id="picker-pos-text" style="font-weight: 600; color: #38bdf8;">📍 Position: X: ${this.currentPos.x}, Y: ${this.currentPos.y}</span>
          <span id="picker-scale-text" style="font-weight: 600; color: #a855f7;">🔍 Scale: ${this.currentScale.toFixed(2)}x</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.overlay.querySelector('#btn-modal-confirm-spawn')?.addEventListener('click', () => {
      this.confirm();
    });

    this.overlay.querySelector('#btn-modal-cancel-spawn')?.addEventListener('click', () => {
      this.cancel();
    });

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', handleKeyDown);
        this.cancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initialize Pixi canvas view inside modal
    setTimeout(() => this.initPixiView(), 50);
  }

  private async initPixiView(): Promise<void> {
    const host = this.overlay.querySelector('#spawn-picker-canvas-host') as HTMLElement;
    if (!host || this.isDestroyed) return;

    const width = host.clientWidth || 1280;
    const height = host.clientHeight || 720;

    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init({
      width,
      height,
      backgroundColor: 0x020617,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    if (this.isDestroyed) {
      this.pixiApp.destroy(true);
      return;
    }

    host.appendChild(this.pixiApp.canvas);

    const sceneWidth = this.targetScene.width || 1920;
    const sceneHeight = this.targetScene.height || 1080;

    // Create scene container and center/fit it inside modal viewport
    const sceneContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(sceneContainer);

    const fitScale = Math.min(width / sceneWidth, height / sceneHeight) * 0.95;
    sceneContainer.scale.set(fitScale);
    sceneContainer.x = (width - sceneWidth * fitScale) / 2;
    sceneContainer.y = (height - sceneHeight * fitScale) / 2;

    // Render Scene Parallax Layers
    const assetManager = AssetManager.getInstance();
    if (this.targetScene.layers) {
      const sortedLayers = [...this.targetScene.layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      for (const lData of sortedLayers) {
        if (!lData.imageUrl) continue;
        try {
          const texture = await assetManager.loadTexture(lData.imageUrl);
          const sprite = new PIXI.Sprite(texture);
          sprite.x = lData.x || 0;
          sprite.y = lData.y || 0;
          sprite.scale.set(lData.scaleX ?? 1, lData.scaleY ?? 1);
          sprite.alpha = lData.opacity ?? 1;
          sprite.visible = lData.visible !== false;
          sceneContainer.addChild(sprite);
        } catch (err) {
          console.warn('Failed to load layer texture in picker modal:', err);
        }
      }
    }

    // Render Scene Hotspots / Objects / Furniture
    if (this.targetScene.hotspots) {
      for (const hsData of this.targetScene.hotspots) {
        if (hsData.imageUrl) {
          try {
            const texture = await assetManager.loadTexture(hsData.imageUrl);
            const hsSprite = new PIXI.Sprite(texture);
            if (hsData.position) {
              hsSprite.x = hsData.position.x;
              hsSprite.y = hsData.position.y;
            } else if (hsData.points && hsData.points.length > 0) {
              hsSprite.x = hsData.points[0].x;
              hsSprite.y = hsData.points[0].y;
            }
            sceneContainer.addChild(hsSprite);
          } catch (err) {
            console.warn('Failed to load hotspot image in picker modal:', err);
          }
        }
        if (hsData.points && hsData.points.length >= 3) {
          const hsG = new PIXI.Graphics();
          hsG.poly(hsData.points.flatMap(p => [p.x, p.y]));
          hsG.fill({ color: 0xf59e0b, alpha: 0.12 });
          hsG.stroke({ color: 0xf59e0b, width: 1.5, alpha: 0.7 });
          sceneContainer.addChild(hsG);
        }
      }
    }

    // Render Scene NPCs / Other Characters
    if (this.targetScene.characters) {
      for (const cData of this.targetScene.characters) {
        if (cData.id === 'player') continue;
        try {
          const npcTexture = await assetManager.loadTexture(cData.spriteSheetUrl);
          const fw = cData.frameWidth || 64;
          const fh = cData.frameHeight || 96;
          const frameRect = new PIXI.Rectangle(0, 0, Math.min(fw, npcTexture.width), Math.min(fh, npcTexture.height));
          const frameTexture = new PIXI.Texture({ source: npcTexture.source, frame: frameRect });
          const npcSprite = new PIXI.Sprite(frameTexture);
          npcSprite.anchor.set(0.5, 0.9);
          npcSprite.x = cData.position.x;
          npcSprite.y = cData.position.y;
          npcSprite.scale.set(cData.scale || 1);
          sceneContainer.addChild(npcSprite);
        } catch (err) {
          console.warn('Failed to load NPC sprite in picker modal:', err);
        }
      }
    }

    // Render WalkPath overlay polygon (cyan line)
    if (this.targetScene.walkPaths && this.targetScene.walkPaths[0]) {
      const wp = this.targetScene.walkPaths[0];
      if (wp.points && wp.points.length >= 3) {
        const polyG = new PIXI.Graphics();
        polyG.poly(wp.points.flatMap(p => [p.x, p.y]));
        polyG.fill({ color: 0x06b6d4, alpha: 0.15 });
        polyG.stroke({ color: 0x0891b2, width: 2, alpha: 0.8 });
        sceneContainer.addChild(polyG);
      }
    }

    // Render Character Sprite Preview (Sir Ronald or target character)
    const targetCharData = this.targetScene.characters?.find(c => c.id === 'player')
      || this.project.scenes[0]?.characters?.find(c => c.id === 'player')
      || { spriteSheetUrl: 'assets/characters/sir_ronald.png', frameWidth: 86, frameHeight: 156, scale: 1 };

    const charContainer = new PIXI.Container();
    charContainer.x = this.currentPos.x;
    charContainer.y = this.currentPos.y;
    charContainer.scale.set(this.currentScale);
    sceneContainer.addChild(charContainer);

    let charSprite: PIXI.Sprite;
    try {
      const sheetTexture = await assetManager.loadTexture(targetCharData.spriteSheetUrl);
      const fw = targetCharData.frameWidth || 86;
      const fh = targetCharData.frameHeight || 156;

      const frameRect = new PIXI.Rectangle(0, 0, Math.min(fw, sheetTexture.width), Math.min(fh, sheetTexture.height));
      const frameTexture = new PIXI.Texture({ source: sheetTexture.source, frame: frameRect });
      charSprite = new PIXI.Sprite(frameTexture);
    } catch {
      // Fallback graphics rectangle if sprite fails
      const fallbackG = new PIXI.Graphics();
      fallbackG.rect(-25, -90, 50, 90);
      fallbackG.fill({ color: 0x8b5cf6, alpha: 0.8 });
      fallbackG.stroke({ color: 0xffffff, width: 2 });
      charContainer.addChild(fallbackG);
      charSprite = new PIXI.Sprite();
    }

    charSprite.anchor.set(0.5, 0.9);
    charContainer.addChild(charSprite);

    // Draw Character Selection Bounding Box & Target Crosshair Indicator
    const charOverlay = new PIXI.Graphics();
    const hw = (targetCharData.frameWidth || 86) / 2;
    const hh = targetCharData.frameHeight || 156;
    charOverlay.rect(-hw, -hh, hw * 2, hh);
    charOverlay.stroke({ color: 0xfbbf24, width: 2, alpha: 0.9 });
    charOverlay.fill({ color: 0xfbbf24, alpha: 0.15 });

    // Target position crosshair dot at feet
    charOverlay.circle(0, 0, 6);
    charOverlay.fill({ color: 0x22c55e });
    charOverlay.stroke({ color: 0xffffff, width: 2 });
    charContainer.addChild(charOverlay);

    // Mouse Movement & Wheel Tracking on Modal Viewport
    const posText = this.overlay.querySelector('#picker-pos-text');
    const scaleText = this.overlay.querySelector('#picker-scale-text');
    let isPlaced = false;

    const updateWorldPos = (e: MouseEvent) => {
      const canvasRect = this.pixiApp!.canvas.getBoundingClientRect();
      const screenX = e.clientX - canvasRect.left;
      const screenY = e.clientY - canvasRect.top;

      const worldX = Math.round((screenX - sceneContainer.x) / fitScale);
      const worldY = Math.round((screenY - sceneContainer.y) / fitScale);

      const clampedX = Math.max(0, Math.min(sceneWidth, worldX));
      const clampedY = Math.max(0, Math.min(sceneHeight, worldY));

      this.currentPos = { x: clampedX, y: clampedY };
      charContainer.x = clampedX;
      charContainer.y = clampedY;

      if (posText) {
        if (isPlaced) {
          posText.innerHTML = `📍 <b style="color:#22c55e;">Placed at:</b> X: ${clampedX}, Y: ${clampedY} (Click elsewhere to move)`;
        } else {
          posText.textContent = `📍 Position: X: ${clampedX}, Y: ${clampedY}`;
        }
      }
    };

    const hostViewport = this.overlay.querySelector('#spawn-picker-viewport') as HTMLElement;
    if (hostViewport) {
      hostViewport.addEventListener('mousemove', (e) => {
        if (!isPlaced) {
          updateWorldPos(e);
        }
      });

      hostViewport.addEventListener('click', (e) => {
        updateWorldPos(e);
        isPlaced = true;
        EventBus.getInstance().emit('ui:notify', `📌 Dropped character at (${this.currentPos.x}, ${this.currentPos.y}). Click 'Confirm Spawn Point' to save.`);
      });

      hostViewport.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        this.currentScale = Math.max(0.1, Math.min(5.0, Math.round((this.currentScale + delta) * 100) / 100));
        charContainer.scale.set(this.currentScale);
        if (scaleText) scaleText.textContent = `🔍 Scale: ${this.currentScale.toFixed(2)}x`;
      });
    }
  }

  private confirm(): void {
    if (this.isDestroyed) return;
    this.destroy();
    this.onConfirm({
      x: this.currentPos.x,
      y: this.currentPos.y,
      scale: this.currentScale
    });
  }

  private cancel(): void {
    if (this.isDestroyed) return;
    this.destroy();
    this.onCancel();
  }

  private destroy(): void {
    this.isDestroyed = true;
    if (this.pixiApp) {
      try {
        this.pixiApp.destroy(true);
      } catch (err) {
        console.warn('Error destroying picker modal Pixi app:', err);
      }
      this.pixiApp = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
