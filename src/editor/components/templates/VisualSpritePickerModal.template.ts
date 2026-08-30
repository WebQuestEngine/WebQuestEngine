import { CharacterData, AnimFrameRef } from '../../../engine/types';
import { TemplateUtils } from '../../utils/TemplateUtils';
import modalHtml from './VisualSpritePickerModal.html?raw';

export class VisualSpritePickerModalTemplate {
  public static render(params: {
    character: CharacterData;
    animKey: string;
    imgUrl: string;
    gridW: number;
    gridH: number;
    gridOffsetX: number;
    gridOffsetY: number;
    showGridOverlay: boolean;
    snapToGrid: boolean;
    selectedFrameIndex: number;
    otherClipKeys: string[];
    frameCount: number;
  }): string {
    const {
      character,
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
      frameCount,
    } = params;

    const copyClipOptionsHtml = otherClipKeys.length > 0
      ? TemplateUtils.renderList(otherClipKeys, k => `<option value="${k}">${k}</option>`)
      : '<option value="">(No other clips)</option>';

    return TemplateUtils.populate(modalHtml, {
      charName: TemplateUtils.escapeHtml(character.name),
      animKey: TemplateUtils.escapeHtml(animKey),
      imgUrl: TemplateUtils.escapeHtml(imgUrl),
      gridW,
      gridH,
      gridOffsetX,
      gridOffsetY,
      gridBtnClass: showGridOverlay ? 'btn-gold' : 'btn-primary',
      gridBtnText: showGridOverlay ? '👁️ Grid ON' : '🙈 Grid OFF',
      snapBtnClass: snapToGrid ? 'btn-gold' : 'btn-primary',
      snapBtnText: snapToGrid ? '🧲 Snap ON' : '🔓 Snap OFF',
      selectedFrameNum: selectedFrameIndex + 1,
      copyClipOptionsHtml,
      frameCount,
      previewCanvasW: gridW * 1.4,
      previewCanvasH: gridH * 1.4,
    });
  }

  public static renderFramesList(params: {
    rawFrames: AnimFrameRef[];
    selectedFrameIndex: number;
    getFrameRect: (f: AnimFrameRef) => { x: number; y: number; w: number; h: number };
  }): string {
    const { rawFrames, selectedFrameIndex, getFrameRect } = params;

    const thumbsHtml = TemplateUtils.renderList(rawFrames, (f, i) => {
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
    });

    return thumbsHtml + '<button class="btn-add-frame-thumb" id="btn-add-frame-end" title="Add Frame">+ Add Frame</button>';
  }
}
