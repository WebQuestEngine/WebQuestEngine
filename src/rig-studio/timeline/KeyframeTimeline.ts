import { SpineDocument, SpineAnimationTrack, SpineRotateKeyframe, SpineTranslateKeyframe } from '../types';

export interface TimelineEvents {
  onTimeChange?: (time: number) => void;
  onAnimationModified?: () => void;
  onPlayToggle?: (isPlaying: boolean) => void;
}

export class KeyframeTimeline {
  private container: HTMLElement;
  private doc: SpineDocument;
  private activeAnimKey = 'idle';

  private currentTime = 0;
  private duration = 1.0;
  private isPlaying = false;
  private isLooping = true;
  private playbackSpeed = 1.0;

  private selectedBone: string | null = null;
  private selectedKeyframe: { bone: string; type: 'rotate' | 'translate'; index: number } | null = null;

  private isDraggingPlayhead = false;
  private isDraggingKeyframe = false;

  private animTimerId: any = null;
  private lastTimestamp = 0;

  private events: TimelineEvents;

  constructor(container: HTMLElement, doc: SpineDocument, events: TimelineEvents = {}) {
    this.container = container;
    this.doc = doc;
    this.events = events;

    this.ensureDefaultAnimation();
    this.render();
    this.startPlaybackLoop();
  }

  public setDocument(doc: SpineDocument): void {
    this.doc = doc;
    this.ensureDefaultAnimation();
    this.render();
  }

  public setSelectedBone(boneName: string | null): void {
    this.selectedBone = boneName;
    this.renderTracks();
  }

  public setTime(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updatePlayheadPosition();
    if (this.events.onTimeChange) this.events.onTimeChange(this.currentTime);
  }

  public getTime(): number {
    return this.currentTime;
  }

  public getActiveAnimation(): string {
    return this.activeAnimKey;
  }

  public setActiveAnimation(animKey: string): void {
    if (!this.doc.animations[animKey]) return;
    this.activeAnimKey = animKey;
    this.duration = this.computeAnimDuration(this.doc.animations[animKey]);
    this.currentTime = 0;
    this.render();
    if (this.events.onTimeChange) this.events.onTimeChange(this.currentTime);
  }

  public addKeyframe(boneName: string, rotation?: number, x?: number, y?: number): void {
    const track = this.getActiveTrack();
    if (!track.bones) track.bones = {};
    if (!track.bones[boneName]) track.bones[boneName] = {};

    const t = Math.round(this.currentTime * 100) / 100;

    if (rotation !== undefined) {
      if (!track.bones[boneName].rotate) track.bones[boneName].rotate = [];
      const rotates = track.bones[boneName].rotate!;
      const existing = rotates.find(k => Math.abs(k.time - t) < 0.02);
      if (existing) {
        existing.angle = rotation;
      } else {
        rotates.push({ time: t, angle: rotation });
        rotates.sort((a, b) => a.time - b.time);
      }
    }

    if (x !== undefined || y !== undefined) {
      if (!track.bones[boneName].translate) track.bones[boneName].translate = [];
      const translates = track.bones[boneName].translate!;
      const existing = translates.find(k => Math.abs(k.time - t) < 0.02);
      if (existing) {
        if (x !== undefined) existing.x = x;
        if (y !== undefined) existing.y = y;
      } else {
        translates.push({ time: t, x, y });
        translates.sort((a, b) => a.time - b.time);
      }
    }

    this.duration = Math.max(this.duration, t);
    this.renderTracks();
    if (this.events.onAnimationModified) this.events.onAnimationModified();
  }

  public deleteSelectedKeyframe(): void {
    if (!this.selectedKeyframe) return;
    const track = this.getActiveTrack();
    const { bone, type, index } = this.selectedKeyframe;
    const boneTrack = track.bones?.[bone];
    if (boneTrack) {
      if (type === 'rotate' && boneTrack.rotate) {
        boneTrack.rotate.splice(index, 1);
      } else if (type === 'translate' && boneTrack.translate) {
        boneTrack.translate.splice(index, 1);
      }
    }
    this.selectedKeyframe = null;
    this.renderTracks();
    if (this.events.onAnimationModified) this.events.onAnimationModified();
  }

  private getActiveTrack(): SpineAnimationTrack {
    if (!this.doc.animations[this.activeAnimKey]) {
      this.doc.animations[this.activeAnimKey] = { bones: {} };
    }
    return this.doc.animations[this.activeAnimKey];
  }

  private computeAnimDuration(track: SpineAnimationTrack): number {
    let max = 0.8;
    for (const b of Object.values(track.bones || {})) {
      for (const r of b.rotate || []) {
        if (r.time > max) max = r.time;
      }
      for (const t of b.translate || []) {
        if (t.time > max) max = t.time;
      }
    }
    return Math.round(max * 100) / 100;
  }

  private ensureDefaultAnimation(): void {
    if (!this.doc.animations || Object.keys(this.doc.animations).length === 0) {
      this.doc.animations = {
        idle: {
          bones: {
            torso: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 3 }, { time: 1.6, angle: 0 }] }
          }
        },
        walk: {
          bones: {
            leg_l: { rotate: [{ time: 0, angle: -25 }, { time: 0.4, angle: 25 }, { time: 0.8, angle: -25 }] }
          }
        }
      };
    }
    this.activeAnimKey = Object.keys(this.doc.animations)[0] || 'idle';
    this.duration = this.computeAnimDuration(this.doc.animations[this.activeAnimKey]);
  }

  public render(): void {
    const animNames = Object.keys(this.doc.animations);

    this.container.innerHTML = `
      <div class="timeline-toolbar">
        <div class="tool-group">
          <button class="tool-btn btn-play-toggle">
            <span>${this.isPlaying ? '⏸' : '▶'}</span> ${this.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button class="tool-btn btn-rewind" title="Rewind to start">⏪</button>
          <button class="tool-btn btn-step-back" title="Previous Frame">⏮</button>
          <button class="tool-btn btn-step-fwd" title="Next Frame">⏭</button>
          <div class="tool-separator"></div>
          <span style="font-family:var(--studio-font-mono); font-size:0.75rem; color:#38bdf8;">
            <span id="time-current-label">0.00s</span> / <span id="time-duration-label">${this.duration.toFixed(2)}s</span>
          </span>
        </div>

        <div class="tool-group">
          <span style="font-size:0.7rem; color:var(--studio-text-muted);">Clip:</span>
          <select class="studio-select select-timeline-clip" style="padding:2px 6px;">
            ${animNames.map(k => `<option value="${k}" ${k === this.activeAnimKey ? 'selected' : ''}>${k}</option>`).join('')}
          </select>
          <button class="tool-btn btn-add-clip" title="New Animation Clip">＋ Clip</button>
          <div class="tool-separator"></div>
          <label style="font-size:0.7rem; color:var(--studio-text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="checkbox" class="chk-loop" ${this.isLooping ? 'checked' : ''} /> Loop
          </label>
        </div>
      </div>

      <!-- Tracks Viewport -->
      <div class="timeline-viewport" style="flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; background:#040814;">
        <!-- Time Ruler -->
        <div class="timeline-ruler" style="height:24px; background:#0b1120; border-bottom:1px solid var(--studio-border); position:relative; cursor:pointer;">
          <canvas id="ruler-canvas" style="width:100%; height:100%;"></canvas>
          <div id="playhead-line" style="position:absolute; top:0; bottom:-500px; width:2px; background:#ef4444; z-index:50; pointer-events:none; left:180px;">
            <div style="width:10px; height:10px; background:#ef4444; transform:translateX(-4px) rotate(45deg); border-radius:2px;"></div>
          </div>
        </div>

        <!-- Tracks List -->
        <div class="timeline-tracks-list" style="flex:1; overflow-y:auto; position:relative;">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;

    this.renderRuler();
    this.renderTracks();
    this.bindDOMEvents();
    this.updatePlayheadPosition();
  }

  private renderRuler(): void {
    const canvas = this.container.querySelector('#ruler-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const trackWidth = rect.width - 180;
    const pixelsPerSec = trackWidth / this.duration;

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';

    // Track header separator line
    ctx.beginPath();
    ctx.moveTo(180, 0);
    ctx.lineTo(180, rect.height);
    ctx.stroke();

    // Seconds and Frame ticks
    const step = pixelsPerSec > 200 ? 0.1 : (pixelsPerSec > 100 ? 0.2 : 0.5);
    for (let t = 0; t <= this.duration + 0.01; t += step) {
      const x = 180 + t * pixelsPerSec;
      const isMajor = Math.abs(t - Math.round(t)) < 0.02;

      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 6 : 14);
      ctx.lineTo(x, rect.height);
      ctx.stroke();

      if (isMajor || step >= 0.2) {
        ctx.fillText(`${t.toFixed(1)}s`, x + 3, 14);
      }
    }
  }

  private renderTracks(): void {
    const listEl = this.container.querySelector('.timeline-tracks-list');
    if (!listEl) return;

    const track = this.getActiveTrack();
    const bones = this.doc.bones || [];
    const trackWidth = this.container.clientWidth - 180;
    const pixelsPerSec = trackWidth / this.duration;

    listEl.innerHTML = bones.map(bone => {
      const isSelected = bone.name === this.selectedBone;
      const bTrack = track.bones?.[bone.name];
      const rotateKeys = bTrack?.rotate || [];

      return `
        <div class="timeline-row ${isSelected ? 'selected' : ''}" style="height:26px; border-bottom:1px solid rgba(148,163,184,0.1); display:flex; align-items:center; background:${isSelected ? 'rgba(2,132,199,0.1)' : 'transparent'};">
          <!-- Row Header -->
          <div style="width:180px; padding:0 8px; font-size:0.75rem; font-weight:600; color:${isSelected ? '#38bdf8' : '#cbd5e1'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
            <span>🦴</span>
            <span>${bone.name}</span>
          </div>

          <!-- Keyframe Track Line -->
          <div class="bone-track-lane" data-bone="${bone.name}" style="flex:1; height:100%; position:relative; background:${isSelected ? 'rgba(56,189,248,0.03)' : 'transparent'};">
            ${rotateKeys.map((k, idx) => {
              const leftPx = Math.round(k.time * pixelsPerSec);
              const isKSelected = this.selectedKeyframe?.bone === bone.name && this.selectedKeyframe?.index === idx;
              return `
                <div class="keyframe-diamond ${isKSelected ? 'active' : ''}" 
                  data-bone="${bone.name}" 
                  data-index="${idx}" 
                  data-type="rotate"
                  style="position:absolute; left:${leftPx - 4}px; top:8px; width:8px; height:8px; background:${isKSelected ? '#f59e0b' : '#38bdf8'}; transform:rotate(45deg); cursor:pointer; z-index:10; border-radius:1px; box-shadow:0 0 4px rgba(56,189,248,0.5);">
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Bind keyframe click
    listEl.querySelectorAll('.keyframe-diamond').forEach(d => {
      d.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const bone = d.getAttribute('data-bone')!;
        const index = parseInt(d.getAttribute('data-index')!, 10);
        this.selectedKeyframe = { bone, type: 'rotate', index };
        this.renderTracks();
      });
    });
  }

  private updatePlayheadPosition(): void {
    const playhead = this.container.querySelector('#playhead-line') as HTMLElement;
    const timeLabel = this.container.querySelector('#time-current-label');
    if (!playhead) return;

    const trackWidth = this.container.clientWidth - 180;
    const pixelsPerSec = trackWidth / this.duration;
    const x = 180 + this.currentTime * pixelsPerSec;

    playhead.style.left = `${Math.round(x)}px`;
    if (timeLabel) timeLabel.textContent = `${this.currentTime.toFixed(2)}s`;
  }

  private bindDOMEvents(): void {
    // Play / Pause
    const playBtn = this.container.querySelector('.btn-play-toggle');
    playBtn?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      playBtn.innerHTML = `<span>${this.isPlaying ? '⏸' : '▶'}</span> ${this.isPlaying ? 'Pause' : 'Play'}`;
      if (this.events.onPlayToggle) this.events.onPlayToggle(this.isPlaying);
    });

    // Rewind
    this.container.querySelector('.btn-rewind')?.addEventListener('click', () => {
      this.setTime(0);
    });

    // Step Forward / Back
    this.container.querySelector('.btn-step-fwd')?.addEventListener('click', () => {
      this.setTime(this.currentTime + 1 / 30);
    });
    this.container.querySelector('.btn-step-back')?.addEventListener('click', () => {
      this.setTime(this.currentTime - 1 / 30);
    });

    // Clip Switcher
    const clipSelect = this.container.querySelector('.select-timeline-clip') as HTMLSelectElement;
    clipSelect?.addEventListener('change', () => {
      this.setActiveAnimation(clipSelect.value);
    });

    // Ruler Scrubbing
    const ruler = this.container.querySelector('.timeline-ruler') as HTMLElement;
    ruler?.addEventListener('mousedown', (e) => {
      this.isDraggingPlayhead = true;
      this.scrubFromEvent(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingPlayhead) {
        this.scrubFromEvent(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingPlayhead = false;
    });

    // Delete keyframe
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedKeyframe) {
        this.deleteSelectedKeyframe();
      }
    });
  }

  private scrubFromEvent(e: MouseEvent): void {
    const rect = this.container.querySelector('.timeline-viewport')?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const trackWidth = rect.width - 180;
    const t = Math.max(0, Math.min(this.duration, ((clientX - 180) / trackWidth) * this.duration));
    this.setTime(t);
  }

  private startPlaybackLoop(): void {
    const loop = (timestamp: number) => {
      if (this.lastTimestamp && this.isPlaying) {
        const delta = ((timestamp - this.lastTimestamp) / 1000) * this.playbackSpeed;
        let nextTime = this.currentTime + delta;
        if (nextTime > this.duration) {
          if (this.isLooping) {
            nextTime = nextTime % this.duration;
          } else {
            nextTime = this.duration;
            this.isPlaying = false;
          }
        }
        this.setTime(nextTime);
      }
      this.lastTimestamp = timestamp;
      this.animTimerId = requestAnimationFrame(loop);
    };
    this.animTimerId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.animTimerId) cancelAnimationFrame(this.animTimerId);
  }
}
