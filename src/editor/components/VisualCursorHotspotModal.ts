import { AssetManager } from '../../engine/core/AssetManager';

export interface CursorHotspotResult {
  hotspotX: number;
  hotspotY: number;
}

export interface CursorHotspotParams {
  verb: string;
  cursorUrl: string;
  initialHotspotX?: number;
  initialHotspotY?: number;
  onSave: (result: CursorHotspotResult) => void;
  onCancel?: () => void;
}

export class VisualCursorHotspotModal {
  private overlay: HTMLElement;
  private cursorName: string;
  private imageUrl: string;
  private resolvedSrc: string;
  private currentX: number;
  private currentY: number;
  private imageWidth: number = 32;
  private imageHeight: number = 32;
  private zoom: number = 1;
  private showGrid: boolean = true;
  private isDragging: boolean = false;
  private onConfirm: (result: CursorHotspotResult) => void;
  private onCancel?: () => void;
  private isDestroyed: boolean = false;

  private readonly MAX_BOX_SIZE = 512;

  public static open(params: CursorHotspotParams): VisualCursorHotspotModal {
    return new VisualCursorHotspotModal(
      params.verb,
      params.cursorUrl,
      { x: params.initialHotspotX ?? 0, y: params.initialHotspotY ?? 0 },
      params.onSave,
      params.onCancel
    );
  }

  constructor(
    cursorName: string,
    imageUrl: string,
    initialHotspot: { x: number; y: number },
    onConfirm: (result: CursorHotspotResult) => void,
    onCancel?: () => void
  ) {
    this.cursorName = cursorName;
    this.imageUrl = imageUrl;
    this.resolvedSrc = AssetManager.getInstance().resolveImageSrc(imageUrl);
    this.currentX = Math.round(initialHotspot.x || 0);
    this.currentY = Math.round(initialHotspot.y || 0);
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

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
      animation: fadeIn 0.15s ease-out;
    `;

    this.initImageAndRender();
  }

  private initImageAndRender(): void {
    const img = new Image();
    img.onload = () => {
      if (this.isDestroyed) return;
      this.imageWidth = img.naturalWidth || 32;
      this.imageHeight = img.naturalHeight || 32;

      // Bound initial coords within image
      this.currentX = Math.max(0, Math.min(this.imageWidth, this.currentX));
      this.currentY = Math.max(0, Math.min(this.imageHeight, this.currentY));

      // Calculate initial zoom so image fits within the 512x512 box comfortably
      if (this.imageWidth > this.MAX_BOX_SIZE || this.imageHeight > this.MAX_BOX_SIZE) {
        this.zoom = Math.min(this.MAX_BOX_SIZE / this.imageWidth, this.MAX_BOX_SIZE / this.imageHeight);
      } else if (this.imageWidth <= 32 && this.imageHeight <= 32) {
        this.zoom = 8;
      } else if (this.imageWidth <= 64 && this.imageHeight <= 64) {
        this.zoom = 4;
      } else if (this.imageWidth <= 128 && this.imageHeight <= 128) {
        this.zoom = 2;
      } else {
        this.zoom = Math.min(this.MAX_BOX_SIZE / this.imageWidth, this.MAX_BOX_SIZE / this.imageHeight, 1);
      }

      this.zoom = Math.max(0.2, parseFloat(this.zoom.toFixed(2)));
      this.render();
    };
    img.onerror = () => {
      if (this.isDestroyed) return;
      this.render();
    };
    img.src = this.resolvedSrc;
  }

  private render(): void {
    const displayW = Math.round(this.imageWidth * this.zoom);
    const displayH = Math.round(this.imageHeight * this.zoom);

    this.overlay.innerHTML = `
      <div class="modal-window" id="hotspot-modal-window" style="width: 840px; max-width: 95vw; background: var(--bg-dark, #0f172a); border: 2px solid var(--accent-gold, #fbbf24); border-radius: 12px; overflow: hidden; box-shadow: 0 25px 70px rgba(0,0,0,0.9); display: flex; flex-direction: column;">
        <!-- Header -->
        <div class="modal-header" style="padding: 12px 20px; background: rgba(15, 23, 42, 0.95); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🎯</span>
            <span style="font-weight: 700; font-size: 0.95rem; color: var(--accent-gold, #fbbf24);">
              Visual Hotspot Editor — <span style="color: #38bdf8;">${this.cursorName}</span>
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-primary" id="btn-modal-save-hotspot" style="padding: 6px 14px; font-size: 0.8rem; font-weight: 700; background: #059669; border: none; border-radius: 6px; color: white; cursor: pointer;">
              💾 Apply Hotspot
            </button>
            <button class="btn" id="btn-modal-close-hotspot" style="padding: 6px 10px; font-size: 0.8rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; cursor: pointer;">
              ✕
            </button>
          </div>
        </div>

        <!-- Body -->
        <div style="display: flex; gap: 16px; padding: 16px; background: #020617; flex: 1; align-items: flex-start;">
          <!-- Left: 512x512 Canvas Box with Checkerboard & Draggable Reticle -->
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 512px; font-size: 0.75rem; color: var(--text-muted, #94a3b8);">
              <span>💡 Click or drag reticle 🎯 on the image</span>
              <div style="display: flex; gap: 4px; align-items: center;">
                <button class="btn" id="btn-zoom-fit" style="padding: 2px 6px; font-size: 0.7rem;" title="Fit inside 512px box">Fit</button>
                <button class="btn" id="btn-zoom-out" style="padding: 2px 6px; font-size: 0.7rem;">🔍 -</button>
                <span id="zoom-level-text" style="font-weight: 700; min-width: 32px; text-align: center;">${Math.round(this.zoom * 100)}%</span>
                <button class="btn" id="btn-zoom-in" style="padding: 2px 6px; font-size: 0.7rem;">🔍 +</button>
                <button class="btn" id="btn-toggle-grid" style="padding: 2px 8px; font-size: 0.7rem; margin-left: 6px;">${this.showGrid ? '🔲 Grid On' : '⬜ Grid Off'}</button>
              </div>
            </div>

            <!-- Viewport box strictly constrained to max 512x512 px -->
            <div id="hotspot-viewport" style="width: 512px; height: 512px; max-width: 512px; max-height: 512px; background-color: #1e293b; background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%), linear-gradient(-45deg, #0f172a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0f172a 75%), linear-gradient(-45deg, transparent 75%, #0f172a 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; position: relative; overflow: auto; display: flex; align-items: center; justify-content: center; user-select: none;">
              <!-- Magnified Image Container -->
              <div id="hotspot-image-wrapper" style="position: relative; width: ${displayW}px; height: ${displayH}px; flex-shrink: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.6); cursor: crosshair;">
                <img id="hotspot-target-img" src="${this.resolvedSrc}" style="width: 100%; height: 100%; object-fit: fill; image-rendering: pixelated; image-rendering: crisp-edges; display: block; pointer-events: none;" />

                <!-- Pixel Grid Overlay -->
                <div id="hotspot-grid-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; ${this.showGrid && this.zoom >= 2 ? `background-size: ${this.zoom}px ${this.zoom}px; background-image: linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px);` : 'display:none;'}"></div>

                <!-- Hotspot Crosshair Reticle -->
                <div id="hotspot-reticle" style="position: absolute; left: ${(this.currentX / this.imageWidth) * 100}%; top: ${(this.currentY / this.imageHeight) * 100}%; transform: translate(-50%, -50%); width: 24px; height: 24px; pointer-events: none;">
                  <!-- Outer Target Ring -->
                  <div style="position: absolute; top: 0; left: 0; width: 24px; height: 24px; border: 2px solid #ef4444; border-radius: 50%; box-shadow: 0 0 8px rgba(239, 68, 68, 0.8), inset 0 0 4px rgba(239, 68, 68, 0.5);"></div>
                  <!-- Inner Center Dot -->
                  <div style="position: absolute; top: 10px; left: 10px; width: 4px; height: 4px; background: #38bdf8; border-radius: 50%; box-shadow: 0 0 6px #38bdf8;"></div>
                  <!-- Horizontal Crosshair -->
                  <div style="position: absolute; top: 11px; left: -10px; width: 44px; height: 2px; background: rgba(239,68,68,0.7);"></div>
                  <!-- Vertical Crosshair -->
                  <div style="position: absolute; top: -10px; left: 11px; width: 2px; height: 44px; background: rgba(239,68,68,0.7);"></div>
                  <!-- Floating Coordinates Badge -->
                  <div style="position: absolute; top: 26px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); border: 1px solid #38bdf8; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: 700; color: #38bdf8; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
                    ${this.currentX}, ${this.currentY}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Controls, Coordinates & Presets -->
          <div style="width: 250px; display: flex; flex-direction: column; gap: 10px;">
            <!-- Coordinates Box -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-gold, #fbbf24); margin-bottom: 6px;">
                📍 Active Coordinates
              </div>
              <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 8px;">
                Native Size: <span style="color: white; font-weight: 600;">${this.imageWidth} × ${this.imageHeight} px</span>
              </div>
              <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                <div style="flex: 1;">
                  <label style="font-size: 0.65rem; color: #94a3b8;">Hotspot X (px)</label>
                  <input type="number" class="form-input" id="input-hotspot-x" min="0" max="${this.imageWidth}" value="${this.currentX}" style="font-size: 0.8rem; font-weight: 700; color: #38bdf8;" />
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 0.65rem; color: #94a3b8;">Hotspot Y (px)</label>
                  <input type="number" class="form-input" id="input-hotspot-y" min="0" max="${this.imageHeight}" value="${this.currentY}" style="font-size: 0.8rem; font-weight: 700; color: #38bdf8;" />
                </div>
              </div>
            </div>

            <!-- Quick Presets -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
              <div style="font-size: 0.78rem; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">
                ⚡ Quick Presets
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button class="btn btn-preset" data-px="0" data-py="0" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  ↖️ Top-Left (0, 0)
                </button>
                <button class="btn btn-preset" data-px="${Math.round(this.imageWidth / 2)}" data-py="${Math.round(this.imageHeight / 2)}" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  🎯 Center
                </button>
                <button class="btn btn-preset" data-px="${Math.round(this.imageWidth / 2)}" data-py="0" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  ⬆️ Top-Center
                </button>
                <button class="btn btn-preset" data-px="${Math.round(this.imageWidth / 2)}" data-py="${this.imageHeight}" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  ⬇️ Bottom-Center
                </button>
                <button class="btn btn-preset" data-px="0" data-py="${this.imageHeight}" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  ↙️ Bottom-Left
                </button>
                <button class="btn btn-preset" data-px="${this.imageWidth}" data-py="${this.imageHeight}" style="padding: 4px 6px; font-size: 0.7rem; text-align: left;">
                  ↘️ Bottom-Right
                </button>
              </div>
            </div>

            <!-- Live Test Area -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; flex: 1; display: flex; flex-direction: column;">
              <div style="font-size: 0.78rem; font-weight: 700; color: #a855f7; margin-bottom: 4px;">
                🖱️ Live Cursor Test Area
              </div>
              <div style="font-size: 0.65rem; color: #94a3b8; margin-bottom: 6px;">
                Move your mouse here to test the click feel:
              </div>
              <div id="live-test-area" style="height: 90px; background: rgba(0,0,0,0.5); border: 1px dashed rgba(255,255,255,0.2); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; position: relative; overflow: hidden; cursor: none;">
                <button class="btn btn-primary" id="btn-test-click" style="font-size: 0.65rem; padding: 4px 8px; pointer-events: auto;">
                  🎯 Click Me!
                </button>
                <span id="test-feedback-text" style="font-size: 0.65rem; color: #38bdf8; font-weight: 600;">Hover & Click to test</span>

                <!-- Live Floating Test Cursor Follower -->
                <div id="live-test-follower" style="position: absolute; pointer-events: none; display: none; z-index: 10;">
                  <img src="${this.resolvedSrc}" style="width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7)); display: block;" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="padding: 10px 20px; background: rgba(15, 23, 42, 0.95); font-size: 0.75rem; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1);">
          <span>💡 Tip: Clicking anywhere outside this window will automatically save your hotspot!</span>
          <button class="btn btn-primary" id="btn-modal-done" style="padding: 6px 18px; font-size: 0.8rem; font-weight: 700; background: #059669; border: none; border-radius: 6px; color: white; cursor: pointer;">
            ✅ Done
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.attachEvents();
  }

  private attachEvents(): void {
    // Backdrop click outside window -> Confirm and close!
    this.overlay.addEventListener('click', (e) => {
      const modalWindow = this.overlay.querySelector('#hotspot-modal-window');
      if (modalWindow && !modalWindow.contains(e.target as Node)) {
        this.confirm();
      }
    });

    // Save / Done buttons
    this.overlay.querySelector('#btn-modal-save-hotspot')?.addEventListener('click', () => this.confirm());
    this.overlay.querySelector('#btn-modal-done')?.addEventListener('click', () => this.confirm());

    // Close button
    this.overlay.querySelector('#btn-modal-close-hotspot')?.addEventListener('click', () => this.confirm());

    // Zoom Fit
    this.overlay.querySelector('#btn-zoom-fit')?.addEventListener('click', () => {
      this.zoom = Math.min(this.MAX_BOX_SIZE / this.imageWidth, this.MAX_BOX_SIZE / this.imageHeight);
      this.zoom = Math.max(0.2, parseFloat(this.zoom.toFixed(2)));
      this.updateZoomAndReticle();
    });

    // Zoom controls
    this.overlay.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      if (this.zoom < 16) {
        this.zoom = parseFloat((this.zoom * 1.25).toFixed(2));
        this.updateZoomAndReticle();
      }
    });
    this.overlay.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      if (this.zoom > 0.2) {
        this.zoom = parseFloat((this.zoom / 1.25).toFixed(2));
        this.updateZoomAndReticle();
      }
    });

    // Toggle grid
    this.overlay.querySelector('#btn-toggle-grid')?.addEventListener('click', () => {
      this.showGrid = !this.showGrid;
      const gridEl = this.overlay.querySelector('#hotspot-grid-overlay') as HTMLElement;
      const gridBtn = this.overlay.querySelector('#btn-toggle-grid') as HTMLElement;
      if (gridEl) {
        gridEl.style.display = this.showGrid ? 'block' : 'none';
      }
      if (gridBtn) {
        gridBtn.textContent = this.showGrid ? '🔲 Grid On' : '⬜ Grid Off';
      }
    });

    // Number Inputs
    const inputX = this.overlay.querySelector('#input-hotspot-x') as HTMLInputElement;
    const inputY = this.overlay.querySelector('#input-hotspot-y') as HTMLInputElement;

    inputX?.addEventListener('input', () => {
      this.currentX = Math.max(0, Math.min(this.imageWidth, parseFloat(inputX.value) || 0));
      this.updateReticle();
    });

    inputY?.addEventListener('input', () => {
      this.currentY = Math.max(0, Math.min(this.imageHeight, parseFloat(inputY.value) || 0));
      this.updateReticle();
    });

    // Presets
    this.overlay.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentX = parseFloat(target.dataset.px!) || 0;
        this.currentY = parseFloat(target.dataset.py!) || 0;
        this.updateReticle();
      });
    });

    // Interactive Image Wrapper Drag & Click
    const imgWrapper = this.overlay.querySelector('#hotspot-image-wrapper') as HTMLElement;

    const handlePointerToHotspot = (clientX: number, clientY: number) => {
      if (!imgWrapper) return;
      const rect = imgWrapper.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const rawX = ((clientX - rect.left) / rect.width) * this.imageWidth;
      const rawY = ((clientY - rect.top) / rect.height) * this.imageHeight;

      this.currentX = Math.round(Math.max(0, Math.min(this.imageWidth, rawX)));
      this.currentY = Math.round(Math.max(0, Math.min(this.imageHeight, rawY)));
      this.updateReticle();
    };

    imgWrapper?.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      handlePointerToHotspot(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        handlePointerToHotspot(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Live Test Area Interaction
    const testArea = this.overlay.querySelector('#live-test-area') as HTMLElement;
    const testFollower = this.overlay.querySelector('#live-test-follower') as HTMLElement;
    const testFeedback = this.overlay.querySelector('#test-feedback-text') as HTMLElement;
    const testBtn = this.overlay.querySelector('#btn-test-click') as HTMLElement;

    if (testArea && testFollower) {
      testArea.addEventListener('mouseenter', () => {
        testFollower.style.display = 'block';
      });
      testArea.addEventListener('mouseleave', () => {
        testFollower.style.display = 'none';
      });
      testArea.addEventListener('mousemove', (e) => {
        const rect = testArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Scale hotspot to the 32x32 test preview image
        const scaleX = 32 / (this.imageWidth || 32);
        const scaleY = 32 / (this.imageHeight || 32);
        const hX = this.currentX * scaleX;
        const hY = this.currentY * scaleY;

        testFollower.style.left = `${mouseX - hX}px`;
        testFollower.style.top = `${mouseY - hY}px`;
      });

      testBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (testFeedback) {
          testFeedback.textContent = `🎯 Hit! Exact Click Registered at (${this.currentX}, ${this.currentY})!`;
          testFeedback.style.color = '#4ade80';
          setTimeout(() => {
            if (testFeedback) {
              testFeedback.textContent = 'Hover & Click to test';
              testFeedback.style.color = '#38bdf8';
            }
          }, 1200);
        }
      });
    }
  }

  private updateZoomAndReticle(): void {
    const imgWrapper = this.overlay.querySelector('#hotspot-image-wrapper') as HTMLElement;
    const zoomText = this.overlay.querySelector('#zoom-level-text');
    const gridEl = this.overlay.querySelector('#hotspot-grid-overlay') as HTMLElement;

    const displayW = Math.round(this.imageWidth * this.zoom);
    const displayH = Math.round(this.imageHeight * this.zoom);

    if (imgWrapper) {
      imgWrapper.style.width = `${displayW}px`;
      imgWrapper.style.height = `${displayH}px`;
    }
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    if (gridEl) {
      if (this.showGrid && this.zoom >= 2) {
        gridEl.style.display = 'block';
        gridEl.style.backgroundSize = `${this.zoom}px ${this.zoom}px`;
      } else {
        gridEl.style.display = 'none';
      }
    }
    this.updateReticle();
  }

  private updateReticle(): void {
    const reticle = this.overlay.querySelector('#hotspot-reticle') as HTMLElement;
    const inputX = this.overlay.querySelector('#input-hotspot-x') as HTMLInputElement;
    const inputY = this.overlay.querySelector('#input-hotspot-y') as HTMLInputElement;

    if (reticle && this.imageWidth > 0 && this.imageHeight > 0) {
      reticle.style.left = `${(this.currentX / this.imageWidth) * 100}%`;
      reticle.style.top = `${(this.currentY / this.imageHeight) * 100}%`;
      const badge = reticle.querySelector('div:last-child');
      if (badge) {
        badge.textContent = `${this.currentX}, ${this.currentY}`;
      }
    }

    if (inputX && parseFloat(inputX.value) !== this.currentX) {
      inputX.value = this.currentX.toString();
    }
    if (inputY && parseFloat(inputY.value) !== this.currentY) {
      inputY.value = this.currentY.toString();
    }
  }

  public confirm(): void {
    if (this.isDestroyed) return;
    this.onConfirm({
      hotspotX: this.currentX,
      hotspotY: this.currentY
    });
    this.destroy();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.overlay.remove();
  }
}
