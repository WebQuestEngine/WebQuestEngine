import { CharacterData, AnimFrameRef, ProjectData } from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';
import { EventBus } from '../../engine/core/EventBus';

export class VisualSpritePickerModal {
  public static open(opts: {
    character: CharacterData;
    animKey: string;
    project: ProjectData | null;
    onSave?: (savedFrames: AnimFrameRef[]) => void;
  }): void {
    const { character: char, animKey, project, onSave } = opts;
    const anims = char.animations || {};
    const currentVal = anims[animKey];
    let rawFrames: AnimFrameRef[] = Array.isArray(currentVal)
      ? JSON.parse(JSON.stringify(currentVal))
      : JSON.parse(JSON.stringify(currentVal?.frames || [0]));

    const overlay = document.createElement('div');
    overlay.className = 'sprite-picker-overlay';

    let gridW = char.frameWidth || 64;
    let gridH = char.frameHeight || 64;
    let gridOffsetX = char.gridOffsetX || 0;
    let gridOffsetY = char.gridOffsetY || 0;
    let showGridOverlay = true;
    let snapToGrid = true;
    let currentZoom = 1; // 1 = 100%, 2 = 200%, 4 = 400%
    let selectedFrameIndex = rawFrames.length > 0 ? 0 : -1;

    const rawUrl = char.spriteSheetUrl || '';
    const imgUrl = AssetManager.getInstance().resolveImageSrc(rawUrl);

    const otherClipKeys = Object.keys(anims).filter(k => k !== animKey);

    overlay.innerHTML = `
      <div class="sprite-picker-modal" style="width:1080px; max-width:96vw; height:92vh; max-height:92vh; display:flex; flex-direction:column;">
        <div class="sprite-picker-header">
          <span>🖼️ Visual Frame Studio - ${char.name} (${animKey})</span>
          <button class="btn btn-del-action" id="btn-close-sprite-picker" style="font-size:0.8rem; padding:4px 8px;">✕ Close</button>
        </div>

        <!-- Studio Control Bar -->
        <div style="padding:8px 16px; background:#0f172a; border-bottom:1px solid var(--panel-border); display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
          <!-- Grid Settings -->
          <div style="display:flex; align-items:center; gap:8px; font-size:0.75rem;">
            <span style="font-weight:700; color:var(--accent-gold);">Grid:</span>
            <input type="number" id="input-grid-w" value="${gridW}" style="width:46px; font-size:0.75rem; padding:2px 4px;" title="Cell Width" /> x
            <input type="number" id="input-grid-h" value="${gridH}" style="width:46px; font-size:0.75rem; padding:2px 4px;" title="Cell Height" />
            <span style="font-weight:700; color:var(--text-muted); margin-left:4px;">Offset:</span>
            X:<input type="number" id="input-grid-off-x" value="${gridOffsetX}" style="width:40px; font-size:0.75rem; padding:2px 4px;" />
            Y:<input type="number" id="input-grid-off-y" value="${gridOffsetY}" style="width:40px; font-size:0.75rem; padding:2px 4px;" />

            <button class="btn ${showGridOverlay ? 'btn-gold' : 'btn-primary'}" id="btn-toggle-grid" style="font-size:0.7rem; padding:3px 8px;">
              ${showGridOverlay ? '👁️ Grid ON' : '🙈 Grid OFF'}
            </button>
            <button class="btn ${snapToGrid ? 'btn-gold' : 'btn-primary'}" id="btn-toggle-snap" style="font-size:0.7rem; padding:3px 8px;">
              ${snapToGrid ? '🧲 Snap ON' : '🔓 Snap OFF'}
            </button>
          </div>

          <!-- Zoom Controls -->
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Zoom:</span>
            <button class="btn btn-primary btn-zoom" data-zoom="1" style="font-size:0.7rem; padding:2px 6px;">100%</button>
            <button class="btn btn-primary btn-zoom" data-zoom="2" style="font-size:0.7rem; padding:2px 6px;">200%</button>
            <button class="btn btn-primary btn-zoom" data-zoom="4" style="font-size:0.7rem; padding:2px 6px;">400%</button>
          </div>
        </div>

        <!-- Main Workspace (Canvas Left + Properties Right) -->
        <div style="flex:1; display:grid; grid-template-columns:1fr 280px; gap:12px; padding:12px; min-height:0; overflow:hidden;">
          <!-- Main Canvas Container -->
          <div class="sprite-picker-grid-container" style="user-select:none; height:100%; width:100%; overflow:auto; display:flex; justify-content:center;">
            <div id="picker-zoom-wrapper" style="transform-origin:0 0; transition:transform 0.1s ease; display:inline-block;">
              <div id="picker-sheet-wrapper" style="position:relative; display:inline-block;">
                <img id="picker-sheet-img" src="${imgUrl}" style="display:block; image-rendering:pixelated; pointer-events:none;" />
                <div id="picker-grid-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair; pointer-events:auto;"></div>
              </div>
            </div>
          </div>

          <!-- Properties Panel (Right) -->
          <div style="display:flex; flex-direction:column; gap:10px; background:rgba(15,23,42,0.6); padding:12px; border-radius:8px; border:1px solid var(--panel-border); overflow-y:auto; height:100%;">
            <!-- Selected Frame Edit & Pixel Nudging -->
            <div id="frame-edit-panel" style="background:rgba(30,41,59,0.9); padding:10px; border-radius:6px; border:1px solid var(--panel-border);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--accent-gold); margin-bottom:6px;">
                🎯 Edit Frame #${selectedFrameIndex + 1}
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                <div><label style="font-size:0.65rem; color:var(--text-muted);">X</label><input type="number" id="edit-frame-x" class="form-input" style="font-size:0.75rem;" /></div>
                <div><label style="font-size:0.65rem; color:var(--text-muted);">Y</label><input type="number" id="edit-frame-y" class="form-input" style="font-size:0.75rem;" /></div>
                <div><label style="font-size:0.65rem; color:var(--text-muted);">Width</label><input type="number" id="edit-frame-w" class="form-input" style="font-size:0.75rem;" /></div>
                <div><label style="font-size:0.65rem; color:var(--text-muted);">Height</label><input type="number" id="edit-frame-h" class="form-input" style="font-size:0.75rem;" /></div>
              </div>
              <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                <span style="font-size:0.65rem; color:var(--text-muted);">Nudge:</span>
                <button class="btn btn-primary btn-nudge" data-dir="left" style="font-size:0.7rem; padding:2px 6px;">◄ Left</button>
                <button class="btn btn-primary btn-nudge" data-dir="up" style="font-size:0.7rem; padding:2px 6px;">▲ Up</button>
                <button class="btn btn-primary btn-nudge" data-dir="down" style="font-size:0.7rem; padding:2px 6px;">▼ Down</button>
                <button class="btn btn-primary btn-nudge" data-dir="right" style="font-size:0.7rem; padding:2px 6px;">► Right</button>
              </div>
            </div>

            <!-- Quick Duplication -->
            <div style="background:rgba(30,41,59,0.7); padding:8px; border-radius:6px; border:1px solid var(--panel-border);">
              <div style="font-size:0.7rem; font-weight:700; color:var(--accent-gold); margin-bottom:6px;">➕ Duplicate Frame Box</div>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-gold" id="btn-dup-frame-right" style="flex:1; font-size:0.7rem; padding:4px 6px;">Right →</button>
                <button class="btn btn-gold" id="btn-dup-frame-down" style="flex:1; font-size:0.7rem; padding:4px 6px;">Down ↓</button>
              </div>
            </div>

            <!-- Copy Frames From Another Animation -->
            <div style="background:rgba(30,41,59,0.7); padding:8px; border-radius:6px; border:1px solid var(--panel-border);">
              <div style="font-size:0.7rem; font-weight:700; color:var(--accent-gold); margin-bottom:4px;">📋 Copy From Clip</div>
              <div style="display:flex; gap:6px;">
                <select id="select-copy-clip" class="form-input" style="font-size:0.7rem; flex:1; padding:3px 4px;">
                  ${otherClipKeys.length > 0
                    ? otherClipKeys.map(k => `<option value="${k}">${k}</option>`).join('')
                    : '<option value="">(No other clips)</option>'}
                </select>
                <button class="btn btn-primary" id="btn-copy-clip-frames" style="font-size:0.7rem; padding:2px 8px;">📥 Copy</button>
              </div>
            </div>

            <div style="display:flex; gap:6px; margin-top:auto;">
              <button class="btn btn-primary" id="btn-picker-clear" style="flex:1; font-size:0.75rem;">🧹 Clear All</button>
              <button class="btn btn-gold" id="btn-picker-save" style="flex:1; font-size:0.75rem; font-weight:700;">💾 Save Clip</button>
            </div>
          </div>
        </div>

        <!-- Bottom Bar: Horizontal Frame Timeline Strip (Left) & Live Preview (Right) -->
        <div style="background:rgba(15,23,42,0.95); border-top:1px solid var(--panel-border); padding:10px 16px; display:grid; grid-template-columns:1fr 220px; gap:16px; align-items:center;">
          <div style="display:flex; flex-direction:column; gap:6px; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--accent-gold);">🎞️ Frame Sequence (${rawFrames.length} Frames)</span>
              <span style="font-size:0.65rem; color:var(--text-muted);">Click thumbnail to select • Drag box on sheet to reposition</span>
            </div>
            <div id="picker-frames-list" class="horizontal-frames-strip"></div>
          </div>

          <div style="background:rgba(30,41,59,0.8); padding:8px; border-radius:6px; border:1px solid var(--panel-border); display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:0.7rem; font-weight:700; color:var(--accent-gold); margin-bottom:4px;">▶ Live Preview</div>
            <div style="width:100%; height:90px; background:#000; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              <canvas id="picker-preview-canvas" width="${gridW}" height="${gridH}" style="image-rendering:pixelated; width:${gridW * 1.4}px; height:${gridH * 1.4}px;"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const sheetImg = overlay.querySelector('#picker-sheet-img') as HTMLImageElement;
    const zoomWrapper = overlay.querySelector('#picker-zoom-wrapper') as HTMLElement;
    const gridOverlay = overlay.querySelector('#picker-grid-overlay') as HTMLElement;
    const framesListEl = overlay.querySelector('#picker-frames-list') as HTMLElement;
    const previewCanvas = overlay.querySelector('#picker-preview-canvas') as HTMLCanvasElement;
    const ctx = previewCanvas?.getContext('2d');

    const inputGridW = overlay.querySelector('#input-grid-w') as HTMLInputElement;
    const inputGridH = overlay.querySelector('#input-grid-h') as HTMLInputElement;
    const inputGridOffX = overlay.querySelector('#input-grid-off-x') as HTMLInputElement;
    const inputGridOffY = overlay.querySelector('#input-grid-off-y') as HTMLInputElement;
    const btnToggleGrid = overlay.querySelector('#btn-toggle-grid') as HTMLButtonElement;
    const btnToggleSnap = overlay.querySelector('#btn-toggle-snap') as HTMLButtonElement;

    const editFrameX = overlay.querySelector('#edit-frame-x') as HTMLInputElement;
    const editFrameY = overlay.querySelector('#edit-frame-y') as HTMLInputElement;
    const editFrameW = overlay.querySelector('#edit-frame-w') as HTMLInputElement;
    const editFrameH = overlay.querySelector('#edit-frame-h') as HTMLInputElement;

    let previewTimer: any = null;
    let previewIdx = 0;

    // Drag-to-draw rectangle state
    let isDrawingRect = false;
    let drawStartPos = { x: 0, y: 0 };
    let tempDrawRect: { x: number; y: number; w: number; h: number } | null = null;

    // Drag to move or resize selected box state
    let isMovingBox = false;
    let isResizingBox = false;
    let dragStartPos = { x: 0, y: 0 };
    let initialBoxRect = { x: 0, y: 0, w: gridW, h: gridH };

    const saveCharacterGridConfig = () => {
      char.frameWidth = gridW;
      char.frameHeight = gridH;
      char.gridOffsetX = gridOffsetX;
      char.gridOffsetY = gridOffsetY;
    };

    const snapVal = (val: number, step: number, offset: number): number => {
      if (!snapToGrid || step <= 0) return val;
      return offset + Math.round((val - offset) / step) * step;
    };

    const getFrameRect = (f: AnimFrameRef): { x: number; y: number; w: number; h: number } => {
      if (typeof f === 'object' && f !== null && 'x' in f) {
        return { x: f.x, y: f.y, w: f.h !== undefined ? f.w : gridW, h: f.h !== undefined ? f.h : gridH };
      }
      const idx = typeof f === 'number' ? f : 0;
      const nw = sheetImg.naturalWidth || 256;
      const cols = Math.max(1, Math.floor((nw - gridOffsetX) / gridW));
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      return { x: gridOffsetX + c * gridW, y: gridOffsetY + r * gridH, w: gridW, h: gridH };
    };

    const updateEditPanelInputs = () => {
      if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) {
        editFrameX.value = '0'; editFrameY.value = '0'; editFrameW.value = `${gridW}`; editFrameH.value = `${gridH}`;
        return;
      }
      const rect = getFrameRect(rawFrames[selectedFrameIndex]);
      editFrameX.value = `${rect.x}`;
      editFrameY.value = `${rect.y}`;
      editFrameW.value = `${rect.w}`;
      editFrameH.value = `${rect.h}`;
    };

    const renderFramesList = () => {
      framesListEl.innerHTML = rawFrames.map((f, i) => {
        const isSel = i === selectedFrameIndex;
        const rect = getFrameRect(f);
        return `
          <div class="frame-thumb-card ${isSel ? 'active' : ''}" data-idx="${i}">
            <div class="frame-thumb-badge">#${i + 1}</div>
            <div class="frame-thumb-canvas-box">
              <canvas class="frame-mini-canvas" data-idx="${i}" width="${rect.w}" height="${rect.h}"></canvas>
            </div>
            <div class="frame-thumb-coords">${rect.x},${rect.y}</div>
            <div class="frame-thumb-actions">
              <button class="btn btn-dup-frame-thumb" data-idx="${i}" title="Duplicate Frame">📋</button>
              <button class="btn btn-del-frame-thumb" data-idx="${i}" title="Delete Frame">🗑️</button>
            </div>
          </div>
        `;
      }).join('') + `
        <button class="btn-add-frame-thumb" id="btn-add-frame-end" title="Add Frame">+ Add Frame</button>
      `;

      // Render mini frame canvas images
      framesListEl.querySelectorAll('.frame-mini-canvas').forEach((cvs) => {
        const canvas = cvs as HTMLCanvasElement;
        const idx = parseInt(canvas.dataset.idx!);
        const rect = getFrameRect(rawFrames[idx]);
        const ctxMini = canvas.getContext('2d');
        if (ctxMini && sheetImg.complete) {
          ctxMini.clearRect(0, 0, canvas.width, canvas.height);
          ctxMini.drawImage(sheetImg, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
        }
      });

      framesListEl.querySelectorAll('.frame-thumb-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON') return;
          selectedFrameIndex = parseInt((card as HTMLElement).dataset.idx!);
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
        });
      });

      framesListEl.querySelectorAll('.btn-dup-frame-thumb').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
          const rect = getFrameRect(rawFrames[idx]);
          const dupRect = { x: rect.x + rect.w, y: rect.y, w: rect.w, h: rect.h };
          rawFrames.splice(idx + 1, 0, dupRect);
          selectedFrameIndex = idx + 1;
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
          startPreview();
        });
      });

      framesListEl.querySelectorAll('.btn-del-frame-thumb').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx!);
          rawFrames.splice(idx, 1);
          if (selectedFrameIndex >= rawFrames.length) selectedFrameIndex = rawFrames.length - 1;
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
          startPreview();
        });
      });

      framesListEl.querySelector('#btn-add-frame-end')?.addEventListener('click', () => {
        if (rawFrames.length > 0) {
          const lastRect = getFrameRect(rawFrames[rawFrames.length - 1]);
          rawFrames.push({ x: lastRect.x + lastRect.w, y: lastRect.y, w: lastRect.w, h: lastRect.h });
        } else {
          rawFrames.push({ x: gridOffsetX, y: gridOffsetY, w: gridW, h: gridH });
        }
        selectedFrameIndex = rawFrames.length - 1;
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
      });
    };

    const renderOverlayBoxes = () => {
      if (!sheetImg.complete || !sheetImg.naturalWidth) return;
      const nw = sheetImg.naturalWidth;
      const nh = sheetImg.naturalHeight;
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const scaleX = dispW / nw;
      const scaleY = dispH / nh;

      gridOverlay.innerHTML = '';

      // Render customizable Grid Overlay lines if enabled
      if (showGridOverlay && gridW > 0 && gridH > 0) {
        const cols = Math.max(1, Math.floor((nw - gridOffsetX) / gridW));
        const rows = Math.max(1, Math.floor((nh - gridOffsetY) / gridH));

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const gridIdx = r * cols + c;
            const gridCell = document.createElement('div');
            gridCell.style.position = 'absolute';
            gridCell.style.left = `${(gridOffsetX + c * gridW) * scaleX}px`;
            gridCell.style.top = `${(gridOffsetY + r * gridH) * scaleY}px`;
            gridCell.style.width = `${gridW * scaleX}px`;
            gridCell.style.height = `${gridH * scaleY}px`;
            gridCell.style.border = '1px dashed rgba(255, 255, 255, 0.22)';
            gridCell.style.boxSizing = 'border-box';
            gridCell.style.pointerEvents = 'none';
            gridCell.style.fontSize = '0.55rem';
            gridCell.style.color = 'rgba(255,255,255,0.35)';
            gridCell.style.padding = '1px';
            gridCell.textContent = `#${gridIdx}`;
            gridOverlay.appendChild(gridCell);
          }
        }
      }

      // Render defined Frame Bounding Boxes
      rawFrames.forEach((f, i) => {
        const rect = getFrameRect(f);
        const isSel = i === selectedFrameIndex;

        const rectBox = document.createElement('div');
        rectBox.className = 'studio-frame-box';
        rectBox.style.position = 'absolute';
        rectBox.style.left = `${rect.x * scaleX}px`;
        rectBox.style.top = `${rect.y * scaleY}px`;
        rectBox.style.width = `${rect.w * scaleX}px`;
        rectBox.style.height = `${rect.h * scaleY}px`;
        rectBox.style.border = isSel ? '2px solid #3b82f6' : '2px solid var(--accent-gold)';
        rectBox.style.background = isSel ? 'rgba(59, 130, 246, 0.4)' : 'rgba(245, 158, 11, 0.25)';
        rectBox.style.boxSizing = 'border-box';
        rectBox.style.color = '#ffffff';
        rectBox.style.fontSize = '0.7rem';
        rectBox.style.fontWeight = '800';
        rectBox.style.padding = '2px 4px';
        rectBox.style.cursor = 'move';
        rectBox.style.borderRadius = '3px';
        rectBox.textContent = `#${i + 1}`;

        // Interactive Resize Handle on Selected Frame Box
        if (isSel) {
          const resizeHandle = document.createElement('div');
          resizeHandle.style.position = 'absolute';
          resizeHandle.style.right = '-6px';
          resizeHandle.style.bottom = '-6px';
          resizeHandle.style.width = '10px';
          resizeHandle.style.height = '10px';
          resizeHandle.style.background = '#3b82f6';
          resizeHandle.style.border = '1px solid #ffffff';
          resizeHandle.style.cursor = 'se-resize';
          resizeHandle.style.zIndex = '10';

          resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            selectedFrameIndex = i;
            isResizingBox = true;
            const overlayRect = gridOverlay.getBoundingClientRect();
            dragStartPos = {
              x: Math.round((e.clientX - overlayRect.left) * (nw / dispW)),
              y: Math.round((e.clientY - overlayRect.top) * (nh / dispH))
            };
            initialBoxRect = { ...rect };
          });

          rectBox.appendChild(resizeHandle);
        }

        rectBox.addEventListener('mousedown', (e) => {
          if (isResizingBox) return;
          e.stopPropagation();
          selectedFrameIndex = i;
          isMovingBox = true;
          const overlayRect = gridOverlay.getBoundingClientRect();
          dragStartPos = {
            x: Math.round((e.clientX - overlayRect.left) * (nw / dispW)),
            y: Math.round((e.clientY - overlayRect.top) * (nh / dispH))
          };
          initialBoxRect = { ...rect };
          renderFramesList();
          renderOverlayBoxes();
          updateEditPanelInputs();
        });

        gridOverlay.appendChild(rectBox);
      });

      // Render live drag rectangle preview if drawing
      if (tempDrawRect) {
        const liveBox = document.createElement('div');
        liveBox.style.position = 'absolute';
        liveBox.style.left = `${tempDrawRect.x * scaleX}px`;
        liveBox.style.top = `${tempDrawRect.y * scaleY}px`;
        liveBox.style.width = `${tempDrawRect.w * scaleX}px`;
        liveBox.style.height = `${tempDrawRect.h * scaleY}px`;
        liveBox.style.border = '2px dashed #22c55e';
        liveBox.style.background = 'rgba(34, 197, 94, 0.3)';
        liveBox.style.boxSizing = 'border-box';
        liveBox.style.pointerEvents = 'none';
        gridOverlay.appendChild(liveBox);
      }
    };

    // Mouse Dragging to Draw, Move, or Resize
    gridOverlay.addEventListener('mousedown', (e) => {
      if (isMovingBox || isResizingBox) return;
      const rect = gridOverlay.getBoundingClientRect();
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const nw = sheetImg.naturalWidth || 1;
      const nh = sheetImg.naturalHeight || 1;
      const scaleX = nw / dispW;
      const scaleY = nh / dispH;

      const clickX = Math.round((e.clientX - rect.left) * scaleX);
      const clickY = Math.round((e.clientY - rect.top) * scaleY);

      isDrawingRect = true;
      drawStartPos = { x: clickX, y: clickY };
    });

    overlay.addEventListener('mousemove', (e) => {
      const rect = gridOverlay.getBoundingClientRect();
      const dispW = sheetImg.clientWidth;
      const dispH = sheetImg.clientHeight;
      const nw = sheetImg.naturalWidth || 1;
      const nh = sheetImg.naturalHeight || 1;
      const scaleX = nw / dispW;
      const scaleY = nh / dispH;

      const currentX = Math.round((e.clientX - rect.left) * scaleX);
      const currentY = Math.round((e.clientY - rect.top) * scaleY);

      if (isResizingBox && selectedFrameIndex >= 0 && selectedFrameIndex < rawFrames.length) {
        const dx = currentX - dragStartPos.x;
        const dy = currentY - dragStartPos.y;
        let newW = Math.max(5, initialBoxRect.w + dx);
        let newH = Math.max(5, initialBoxRect.h + dy);

        if (snapToGrid) {
          newW = Math.max(gridW, Math.round(newW / gridW) * gridW);
          newH = Math.max(gridH, Math.round(newH / gridH) * gridH);
        }

        rawFrames[selectedFrameIndex] = {
          x: initialBoxRect.x,
          y: initialBoxRect.y,
          w: newW,
          h: newH
        };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        return;
      }

      if (isMovingBox && selectedFrameIndex >= 0 && selectedFrameIndex < rawFrames.length) {
        const dx = currentX - dragStartPos.x;
        const dy = currentY - dragStartPos.y;
        let newX = Math.max(0, initialBoxRect.x + dx);
        let newY = Math.max(0, initialBoxRect.y + dy);

        if (snapToGrid) {
          newX = snapVal(newX, gridW, gridOffsetX);
          newY = snapVal(newY, gridH, gridOffsetY);
        }

        rawFrames[selectedFrameIndex] = {
          x: newX,
          y: newY,
          w: initialBoxRect.w,
          h: initialBoxRect.h
        };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        return;
      }

      if (isDrawingRect) {
        let x = Math.min(drawStartPos.x, currentX);
        let y = Math.min(drawStartPos.y, currentY);
        let w = Math.max(5, Math.abs(currentX - drawStartPos.x));
        let h = Math.max(5, Math.abs(currentY - drawStartPos.y));

        if (snapToGrid) {
          x = snapVal(x, gridW, gridOffsetX);
          y = snapVal(y, gridH, gridOffsetY);
          w = Math.max(gridW, Math.round(w / gridW) * gridW);
          h = Math.max(gridH, Math.round(h / gridH) * gridH);
        }

        tempDrawRect = { x, y, w, h };
        renderOverlayBoxes();
      }
    });

    overlay.addEventListener('mouseup', () => {
      if (isMovingBox || isResizingBox) {
        isMovingBox = false;
        isResizingBox = false;
        startPreview();
        return;
      }
      if (isDrawingRect && tempDrawRect) {
        rawFrames.push({ ...tempDrawRect });
        selectedFrameIndex = rawFrames.length - 1;
        tempDrawRect = null;
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
      }
      isDrawingRect = false;
    });

    // Zoom Buttons
    overlay.querySelectorAll('.btn-zoom').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const z = parseFloat((e.currentTarget as HTMLElement).dataset.zoom!);
        currentZoom = z;
        zoomWrapper.style.transform = `scale(${currentZoom})`;
      });
    });

    // Grid Inputs with Persistence
    inputGridW?.addEventListener('input', () => { gridW = parseInt(inputGridW.value) || 64; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridH?.addEventListener('input', () => { gridH = parseInt(inputGridH.value) || 64; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridOffX?.addEventListener('input', () => { gridOffsetX = parseInt(inputGridOffX.value) || 0; saveCharacterGridConfig(); renderOverlayBoxes(); });
    inputGridOffY?.addEventListener('input', () => { gridOffsetY = parseInt(inputGridOffY.value) || 0; saveCharacterGridConfig(); renderOverlayBoxes(); });

    btnToggleGrid?.addEventListener('click', () => {
      showGridOverlay = !showGridOverlay;
      btnToggleGrid.textContent = showGridOverlay ? '👁️ Grid ON' : '🙈 Grid OFF';
      btnToggleGrid.className = `btn ${showGridOverlay ? 'btn-gold' : 'btn-primary'}`;
      renderOverlayBoxes();
    });

    btnToggleSnap?.addEventListener('click', () => {
      snapToGrid = !snapToGrid;
      btnToggleSnap.textContent = snapToGrid ? '🧲 Snap ON' : '🔓 Snap OFF';
      btnToggleSnap.className = `btn ${snapToGrid ? 'btn-gold' : 'btn-primary'}`;
    });

    // Direct Frame Inputs
    const updateSelectedFrameFromEditInputs = () => {
      if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) return;
      const x = parseInt(editFrameX.value) || 0;
      const y = parseInt(editFrameY.value) || 0;
      const w = parseInt(editFrameW.value) || gridW;
      const h = parseInt(editFrameH.value) || gridH;
      rawFrames[selectedFrameIndex] = { x, y, w, h };
      renderFramesList();
      renderOverlayBoxes();
      startPreview();
    };

    editFrameX?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameY?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameW?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameH?.addEventListener('input', updateSelectedFrameFromEditInputs);

    // Pixel Nudge Buttons
    overlay.querySelectorAll('.btn-nudge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) return;
        const dir = (e.currentTarget as HTMLElement).dataset.dir;
        const rect = getFrameRect(rawFrames[selectedFrameIndex]);
        if (dir === 'left') rect.x = Math.max(0, rect.x - 1);
        if (dir === 'right') rect.x += 1;
        if (dir === 'up') rect.y = Math.max(0, rect.y - 1);
        if (dir === 'down') rect.y += 1;

        rawFrames[selectedFrameIndex] = { ...rect };
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
      });
    });

    // Copy Frames From Another Animation Clip
    overlay.querySelector('#btn-copy-clip-frames')?.addEventListener('click', () => {
      const srcSelect = overlay.querySelector('#select-copy-clip') as HTMLSelectElement;
      const srcKey = srcSelect?.value;
      if (srcKey && anims[srcKey]) {
        const srcVal = anims[srcKey];
        const srcFrames = Array.isArray(srcVal) ? srcVal : (srcVal?.frames || [0]);
        rawFrames = JSON.parse(JSON.stringify(srcFrames));
        selectedFrameIndex = rawFrames.length > 0 ? 0 : -1;
        renderFramesList();
        renderOverlayBoxes();
        updateEditPanelInputs();
        startPreview();
        EventBus.getInstance().emit('ui:notify', `📋 Copied ${rawFrames.length} frames from clip '${srcKey}'!`);
      }
    });

    // Duplicate Next Frame Buttons
    overlay.querySelector('#btn-dup-frame-right')?.addEventListener('click', () => {
      if (rawFrames.length === 0) {
        rawFrames.push({ x: gridOffsetX, y: gridOffsetY, w: gridW, h: gridH });
      } else {
        const last = getFrameRect(rawFrames[rawFrames.length - 1]);
        rawFrames.push({ x: last.x + last.w, y: last.y, w: last.w, h: last.h });
      }
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    overlay.querySelector('#btn-dup-frame-down')?.addEventListener('click', () => {
      if (rawFrames.length === 0) {
        rawFrames.push({ x: gridOffsetX, y: gridOffsetY, w: gridW, h: gridH });
      } else {
        const last = getFrameRect(rawFrames[rawFrames.length - 1]);
        rawFrames.push({ x: last.x, y: last.y + last.h, w: last.w, h: last.h });
      }
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    const startPreview = () => {
      if (previewTimer) clearInterval(previewTimer);
      if (!ctx || rawFrames.length === 0 || !sheetImg.complete) return;

      previewIdx = 0;
      previewTimer = setInterval(() => {
        if (rawFrames.length === 0) return;
        const currentFrame = rawFrames[previewIdx % rawFrames.length];
        previewIdx++;

        const rect = getFrameRect(currentFrame);
        previewCanvas.width = rect.w;
        previewCanvas.height = rect.h;
        ctx.clearRect(0, 0, rect.w, rect.h);
        ctx.drawImage(sheetImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      }, 150);
    };

    sheetImg.onload = () => {
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    };
    if (sheetImg.complete) {
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    }

    overlay.querySelector('#btn-picker-clear')?.addEventListener('click', () => {
      rawFrames = [];
      selectedFrameIndex = -1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    overlay.querySelector('#btn-picker-save')?.addEventListener('click', () => {
      saveCharacterGridConfig();
      char.animations[animKey] = rawFrames.length > 0 ? rawFrames : [0];
      VisualSpritePickerModal.syncCharacterAcrossScenes(project, char);
      if (previewTimer) clearInterval(previewTimer);
      overlay.remove();
      if (onSave) onSave(rawFrames);
      EventBus.getInstance().emit('editor:project_updated');
      EventBus.getInstance().emit('ui:notify', `💾 Saved clip '${animKey}' with ${rawFrames.length} frames!`);
    });

    overlay.querySelector('#btn-close-sprite-picker')?.addEventListener('click', () => {
      if (previewTimer) clearInterval(previewTimer);
      overlay.remove();
    });
  }

  public static syncCharacterAcrossScenes(project: ProjectData | null, targetChar: CharacterData): void {
    if (!project) return;
    const charId = targetChar.id;
    for (const scene of project.scenes) {
      if (scene.characters) {
        for (const c of scene.characters) {
          if (c.id === charId) {
            c.spriteSheetUrl = targetChar.spriteSheetUrl;
            c.frameWidth = targetChar.frameWidth;
            c.frameHeight = targetChar.frameHeight;
            c.gridOffsetX = targetChar.gridOffsetX;
            c.gridOffsetY = targetChar.gridOffsetY;
            c.speed = targetChar.speed;
            c.talkColor = targetChar.talkColor;
            if (targetChar.animations) {
              c.animations = JSON.parse(JSON.stringify(targetChar.animations));
            }
          }
        }
      }
    }
  }
}
