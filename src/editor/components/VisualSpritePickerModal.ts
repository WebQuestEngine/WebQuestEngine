import { CharacterData, AnimFrameRef, ProjectData } from '../../engine/types';
import { AssetManager } from '../../engine/core/AssetManager';
import { EventBus } from '../../engine/core/EventBus';
import { VisualSpritePickerModalTemplate } from './templates/VisualSpritePickerModal.template';

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
    // Grid overlay removed per new requirements
    let showGridOverlay = false;
    let snapToGrid = false; // snapping disabled as frames are uniform
    let currentZoom = 1; // 1 = 100%, 2 = 200%, 4 = 400%
    let selectedFrameIndex = rawFrames.length > 0 ? 0 : -1;

    const rawUrl = char.spriteSheetUrl || '';
    const imgUrl = AssetManager.getInstance().resolveImageSrc(rawUrl);

    const otherClipKeys = Object.keys(anims).filter(k => k !== animKey);

    overlay.innerHTML = VisualSpritePickerModalTemplate.render({
      character: char,
      animKey,
      imgUrl,
      gridW,
      gridH,
      gridOffsetX,
      gridOffsetY,
      showGridOverlay,
      snapToGrid,
      selectedFrameIndex,
      otherClipKeys,
      frameCount: rawFrames.length,
    });

    document.body.appendChild(overlay);

    const sheetImg = overlay.querySelector('#picker-sheet-img') as HTMLImageElement;
    const zoomWrapper = overlay.querySelector('#picker-zoom-wrapper') as HTMLElement;
    const gridContainer = overlay.querySelector('.sprite-picker-grid-container') as HTMLElement;
    const gridOverlay = overlay.querySelector('#picker-grid-overlay') as HTMLElement;
    const framesListEl = overlay.querySelector('#picker-frames-list') as HTMLElement;
    const previewCanvas = overlay.querySelector('#picker-preview-canvas') as HTMLCanvasElement;
    const ctx = previewCanvas?.getContext('2d');

    const inputFrameW = overlay.querySelector('#input-frame-w') as HTMLInputElement;
    const inputFrameH = overlay.querySelector('#input-frame-h') as HTMLInputElement;

    // Update character frame size when inputs change
    inputFrameW?.addEventListener('input', () => {
      const newW = parseInt(inputFrameW.value) || 64;
      gridW = newW;
      char.frameWidth = newW;
      renderOverlayBoxes();
      updateEditPanelInputs();
    });
    inputFrameH?.addEventListener('input', () => {
      const newH = parseInt(inputFrameH.value) || 64;
      gridH = newH;
      char.frameHeight = newH;
      renderOverlayBoxes();
      updateEditPanelInputs();
    });

    const editFrameX = overlay.querySelector('#edit-frame-x') as HTMLInputElement;
    const editFrameY = overlay.querySelector('#edit-frame-y') as HTMLInputElement;

    let previewTimer: any = null;
    let previewIdx = 0;

    // Drag-to-draw rectangle state
    let isDrawingRect = false;
    let drawStartPos = { x: 0, y: 0 };
    let tempDrawRect: { x: number; y: number; w: number; h: number } | null = null;

    // Drag to move or resize selected box state
    let isMovingBox = false;
    let isResizingBox = false;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
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
        editFrameX.value = '0'; editFrameY.value = '0';
        return;
      }
      const rect = getFrameRect(rawFrames[selectedFrameIndex]);
      editFrameX.value = `${rect.x}`;
      editFrameY.value = `${rect.y}`;

    };

    const renderFramesList = () => {
      const countEl = overlay.querySelector('#label-frame-sequence-count');
      if (countEl) countEl.textContent = `${rawFrames.length}`;
      const frameNumEl = overlay.querySelector('#label-selected-frame-num');
      if (frameNumEl) frameNumEl.textContent = `${selectedFrameIndex + 1}`;

      framesListEl.innerHTML = VisualSpritePickerModalTemplate.renderFramesList({
        rawFrames,
        selectedFrameIndex,
        getFrameRect,
      });

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
          // Duplicate the current frame index
          const dupIdx = typeof rawFrames[idx] === 'number' ? rawFrames[idx] + 1 : idx + 1;
          rawFrames.splice(idx + 1, 0, dupIdx);
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
        rectBox.textContent = `#${i + 1} (${rect.w}x${rect.h})`;

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
          if (isResizingBox || e.button === 1) return;
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
      if (e.button === 1) { // Middle click for pan
        e.preventDefault();
        isPanning = true;
        isDrawingRect = false; // ensure drawing mode is disabled
        panStart = { x: e.clientX, y: e.clientY };
        overlay.style.cursor = 'grabbing';
        return;
      }
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

      // Single click: place a frame of current size at click location
      const cols = Math.max(1, Math.floor((nw - gridOffsetX) / gridW));
      const c = Math.floor((clickX - gridOffsetX) / gridW);
      const r = Math.floor((clickY - gridOffsetY) / gridH);
      const newIdx = r * cols + c;
      rawFrames.push(newIdx);
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
      return;
      isDrawingRect = true;
      drawStartPos = { x: clickX, y: clickY };
    });

    overlay.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        // Scroll the outer container to achieve panning
        if (gridContainer) {
          gridContainer.scrollLeft -= dx;
          gridContainer.scrollTop -= dy;
        }
        panStart = { x: e.clientX, y: e.clientY };
        return;
      }
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
        let dx = currentX - dragStartPos.x;
        let dy = currentY - dragStartPos.y;
        if (e && (e as MouseEvent).ctrlKey) {
          if (Math.abs(dx) > Math.abs(dy)) {
            dy = 0;
          } else {
            dx = 0;
          }
        }
        let newX = Math.max(0, initialBoxRect.x + dx);
        let newY = Math.max(0, initialBoxRect.y + dy);
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
        tempDrawRect = { x, y, w, h };
        renderOverlayBoxes();
      }
    });

    overlay.addEventListener('mouseup', () => {
      isPanning = false;
      overlay.style.cursor = 'default';
      if (isMovingBox || isResizingBox) {
        isMovingBox = false;
        isResizingBox = false;
        startPreview();
        return;
      }
      if (isDrawingRect && tempDrawRect) {
        gridW = tempDrawRect.w;
        gridH = tempDrawRect.h;
        gridOffsetX = tempDrawRect.x;
        gridOffsetY = tempDrawRect.y;
        rawFrames = rawFrames.map(f => {
          if (typeof f === 'number') return f;
          const cols = Math.max(1, Math.floor((sheetImg.naturalWidth - gridOffsetX) / gridW));
          const c = Math.floor((f.x - gridOffsetX) / gridW);
          const r = Math.floor((f.y - gridOffsetY) / gridH);
          return r * cols + c;
        });
        const cols = Math.max(1, Math.floor((sheetImg.naturalWidth - gridOffsetX) / gridW));
        const c = Math.floor((tempDrawRect.x - gridOffsetX) / gridW);
        const r = Math.floor((tempDrawRect.y - gridOffsetY) / gridH);
        const newIdx = r * cols + c;
        rawFrames = [newIdx];
        selectedFrameIndex = rawFrames.length - 1;
        tempDrawRect = null;
        saveCharacterGridConfig();
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



    // Direct Frame Inputs
    const updateSelectedFrameFromEditInputs = () => {
      if (selectedFrameIndex < 0 || selectedFrameIndex >= rawFrames.length) return;
        const x = parseInt(editFrameX.value) || 0;
        const y = parseInt(editFrameY.value) || 0;
        // Force width/height to current character frame size for uniformity
        const w = gridW;
        const h = gridH;
        rawFrames[selectedFrameIndex] = { x, y, w, h };
      renderFramesList();
      renderOverlayBoxes();
      startPreview();
    };

    editFrameX?.addEventListener('input', updateSelectedFrameFromEditInputs);
    editFrameY?.addEventListener('input', updateSelectedFrameFromEditInputs);

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
        // first frame index is 0
        rawFrames.push(0);
      } else {
        const lastIdx = rawFrames[rawFrames.length - 1] as number;
        rawFrames.push(lastIdx + 1);
      }
      selectedFrameIndex = rawFrames.length - 1;
      renderFramesList();
      renderOverlayBoxes();
      updateEditPanelInputs();
      startPreview();
    });

    overlay.querySelector('#btn-dup-frame-down')?.addEventListener('click', () => {
      if (rawFrames.length === 0) {
        rawFrames.push(0);
      } else {
        const lastIdx = rawFrames[rawFrames.length - 1] as number;
        rawFrames.push(lastIdx + 1);
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
