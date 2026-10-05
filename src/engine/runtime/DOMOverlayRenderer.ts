import { Vector2D } from '../types';

export interface DialogOverlayCallbacks {
  onChoice: (choiceId: string) => void;
  onNext: () => void;
  onEnd: () => void;
}

export interface IOverlayRenderer {
  setContainerElement(containerElement: HTMLElement): void;
  renderDialogOverlay(
    data: any,
    screenPos: Vector2D | null,
    viewportSize: { width: number; height: number },
    callbacks: DialogOverlayCallbacks
  ): void;
  clearDialogOverlay(): void;
  showEmoteBubble(screenPos: Vector2D, text: string): void;
  clearEmoteBubbles(): void;
  showVideoOverlay(videoUrl: string, skippable: boolean, onComplete: () => void): () => void;
  showScreenEffect(
    effect: 'fade_in' | 'fade_out' | 'flash' | 'tint' | string,
    duration: number,
    color: string,
    onComplete: () => void
  ): void;
  clearScreenEffect(): void;
  destroy(): void;
}

export class DOMOverlayRenderer implements IOverlayRenderer {
  private containerElement: HTMLElement;
  private dialogOverlayEl: HTMLElement | null = null;
  private activeVideoCleanup: (() => void) | null = null;
  private activeScreenFxEl: HTMLElement | null = null;

  constructor(containerElement: HTMLElement) {
    this.containerElement = containerElement;
  }

  public setContainerElement(containerElement: HTMLElement): void {
    this.containerElement = containerElement;
  }

  public renderDialogOverlay(
    data: any,
    screenPos: Vector2D | null,
    viewportSize: { width: number; height: number },
    callbacks: DialogOverlayCallbacks
  ): void {
    if (!this.containerElement) return;

    this.clearDialogOverlay();

    const overlay = document.createElement('div');
    overlay.className = `dialog-box-overlay ${screenPos ? 'in-world-bubble' : ''}`;

    if (screenPos) {
      const viewW = viewportSize.width || window.innerWidth;
      const viewH = viewportSize.height || window.innerHeight;
      const clampedX = Math.max(180, Math.min(viewW - 180, screenPos.x));
      const clampedY = Math.max(140, Math.min(viewH - 40, screenPos.y));
      overlay.style.left = `${clampedX}px`;
      overlay.style.top = `${clampedY}px`;
      overlay.style.transform = 'translate(-50%, -100%)';
      overlay.style.bottom = 'auto';
    }

    overlay.innerHTML = `
      ${data.portraitUrl ? `<img src="${data.portraitUrl}" class="dialog-portrait" onError="this.style.display='none'" />` : ''}
      <div class="dialog-content">
        <div class="dialog-speaker">${data.speaker}</div>
        <div class="dialog-text">${data.text}</div>
        ${data.choices && data.choices.length > 0 ? `
          <div class="dialog-choices">
            ${data.choices.map((c: any) => `
              <button class="dialog-choice-btn" data-choiceid="${c.id}">${c.text}</button>
            `).join('')}
          </div>
        ` : (data.hasNext ? `<button class="btn btn-gold" id="btn-dlg-next" style="margin-top:8px;">Continue ➔</button>` : `<button class="btn btn-primary" id="btn-dlg-end" style="margin-top:8px;">Close</button>`)}
      </div>
    `;

    overlay.querySelectorAll('.dialog-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.choiceid!;
        callbacks.onChoice(id);
      });
    });

    overlay.querySelector('#btn-dlg-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onNext();
    });

    overlay.querySelector('#btn-dlg-end')?.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onEnd();
    });

    this.dialogOverlayEl = overlay;
    this.containerElement.appendChild(overlay);
  }

  public clearDialogOverlay(): void {
    if (this.dialogOverlayEl) {
      this.dialogOverlayEl.remove();
      this.dialogOverlayEl = null;
    }
    if (this.containerElement) {
      this.containerElement.querySelectorAll('.dialog-box-overlay').forEach(el => el.remove());
    }
  }

  public showEmoteBubble(screenPos: Vector2D, text: string): void {
    if (!this.containerElement) return;

    const bubble = document.createElement('div');
    bubble.className = 'character-emote-bubble';
    bubble.style.cssText = `
      position: absolute;
      left: ${screenPos.x}px;
      top: ${screenPos.y}px;
      transform: translate(-50%, -100%);
      background: rgba(15, 23, 42, 0.92);
      border: 2px solid var(--accent-gold, #f59e0b);
      color: #fff;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 14px;
      font-size: 0.8rem;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      animation: emotePop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    bubble.innerHTML = text;
    this.containerElement.appendChild(bubble);

    setTimeout(() => {
      bubble.style.transition = 'opacity 0.3s, transform 0.3s';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translate(-50%, -120%)';
      setTimeout(() => bubble.remove(), 350);
    }, 2400);
  }

  public clearEmoteBubbles(): void {
    if (this.containerElement) {
      this.containerElement.querySelectorAll('.character-emote-bubble').forEach(el => el.remove());
    }
  }

  public showVideoOverlay(videoUrl: string, skippable: boolean, onComplete: () => void): () => void {
    if (!this.containerElement) {
      onComplete();
      return () => {};
    }

    if (this.activeVideoCleanup) {
      this.activeVideoCleanup();
      this.activeVideoCleanup = null;
    }

    const videoOverlay = document.createElement('div');
    videoOverlay.className = 'cinematic-video-overlay';
    videoOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: #000000;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    const videoEl = document.createElement('video');
    videoEl.src = videoUrl;
    videoEl.autoplay = true;
    videoEl.controls = false;
    videoEl.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; width: 100%; height: 100%;';

    let isFinished = false;
    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoOverlay.remove();
      this.activeVideoCleanup = null;
      onComplete();
    };

    this.activeVideoCleanup = () => {
      if (!isFinished) {
        isFinished = true;
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoOverlay.remove();
      }
    };

    if (skippable !== false) {
      const skipBtn = document.createElement('button');
      skipBtn.className = 'btn btn-gold';
      skipBtn.innerText = 'Skip ⏭️';
      skipBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 9001;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid var(--accent-gold);
        color: var(--accent-gold);
        font-weight: 700;
        font-size: 0.85rem;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
      `;
      skipBtn.onclick = finish;
      videoOverlay.appendChild(skipBtn);
    }

    videoEl.onended = finish;
    videoEl.onerror = () => {
      console.warn(`[DOMOverlayRenderer] ⚠️ Video cutscene failed to load: ${videoUrl}`);
      finish();
    };

    videoOverlay.appendChild(videoEl);
    this.containerElement.appendChild(videoOverlay);

    videoEl.play().catch(() => {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-gold';
      playBtn.innerText = '▶️ Play Video';
      playBtn.style.cssText = `
        position: absolute;
        z-index: 9002;
        font-size: 1.1rem;
        padding: 10px 22px;
        background: rgba(15, 23, 42, 0.9);
        border: 2px solid var(--accent-gold);
        color: var(--accent-gold);
        border-radius: 8px;
        cursor: pointer;
      `;
      playBtn.onclick = () => {
        playBtn.remove();
        videoEl.play().catch(() => finish());
      };
      videoOverlay.appendChild(playBtn);
    });

    return this.activeVideoCleanup;
  }

  public showScreenEffect(
    effect: 'fade_in' | 'fade_out' | 'flash' | 'tint' | string,
    duration: number,
    color: string,
    onComplete: () => void
  ): void {
    if (!this.containerElement) {
      onComplete();
      return;
    }

    if (this.activeScreenFxEl) {
      this.activeScreenFxEl.remove();
      this.activeScreenFxEl = null;
    }

    const fxOverlay = document.createElement('div');
    fxOverlay.className = 'screen-fx-overlay';
    fxOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: ${color};
      z-index: 8999;
      pointer-events: none;
      transition: opacity ${duration}s ease;
    `;
    this.activeScreenFxEl = fxOverlay;

    if (effect === 'fade_out') {
      fxOverlay.style.opacity = '0';
      this.containerElement.appendChild(fxOverlay);
      requestAnimationFrame(() => {
        fxOverlay.style.opacity = '1';
      });
      setTimeout(() => {
        onComplete();
      }, duration * 1000);
    } else if (effect === 'fade_in') {
      fxOverlay.style.opacity = '1';
      this.containerElement.appendChild(fxOverlay);
      requestAnimationFrame(() => {
        fxOverlay.style.opacity = '0';
      });
      setTimeout(() => {
        fxOverlay.remove();
        if (this.activeScreenFxEl === fxOverlay) {
          this.activeScreenFxEl = null;
        }
        onComplete();
      }, duration * 1000);
    } else if (effect === 'flash') {
      fxOverlay.style.background = '#ffffff';
      fxOverlay.style.opacity = '1';
      this.containerElement.appendChild(fxOverlay);
      setTimeout(() => {
        fxOverlay.style.opacity = '0';
        setTimeout(() => {
          fxOverlay.remove();
          if (this.activeScreenFxEl === fxOverlay) {
            this.activeScreenFxEl = null;
          }
          onComplete();
        }, 300);
      }, 150);
    } else if (effect === 'tint') {
      fxOverlay.style.opacity = '0.4';
      this.containerElement.appendChild(fxOverlay);
      setTimeout(() => {
        onComplete();
      }, duration * 1000);
    } else {
      onComplete();
    }
  }

  public clearScreenEffect(): void {
    if (this.activeScreenFxEl) {
      this.activeScreenFxEl.remove();
      this.activeScreenFxEl = null;
    }
    if (this.containerElement) {
      this.containerElement.querySelectorAll('.screen-fx-overlay').forEach(el => el.remove());
    }
  }

  public clearAll(): void {
    this.clearDialogOverlay();
    this.clearEmoteBubbles();

    if (this.activeVideoCleanup) {
      this.activeVideoCleanup();
      this.activeVideoCleanup = null;
    }

    this.clearScreenEffect();

    if (this.containerElement) {
      this.containerElement.querySelectorAll('.cinematic-video-overlay').forEach(el => el.remove());
    }
  }

  public destroy(): void {
    this.clearAll();
  }
}
