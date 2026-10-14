import {
  AnatomicalJointId,
  StudioAnimationDefinition,
  StudioKeyframe,
  StudioSideTrack,
  StudioView
} from '../types';

export interface KeyframeTimelineEvents {
  onPoseInterpolated?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onTimeChange?: (time: number) => void;
  onPlayToggle?: (isPlaying: boolean) => void;
  onKeyframeAdded?: (time: number, joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onKeyframeDeleted?: (index: number) => void;
  onAnimationSelected?: (animName: string) => void;
  onRequestNewAnimation?: () => void;
  onAutoKeyToggled?: (enabled: boolean) => void;
  onEnableSideRequested?: (animName: string, side: StudioView) => void;
  onDurationChanged?: (duration: number) => void;
  onKeyframeSelected?: (index: number, keyframe: StudioKeyframe | null) => void;
}

/**
 * Interpolates joint positions smoothly between keyframes across time.
 */
export function interpolateJointPoses(
  keyframes: StudioKeyframe[],
  time: number,
  duration: number,
  loop = true,
  fallbackJoints: Record<string, { x: number; y: number }> = {}
): Record<AnatomicalJointId, { x: number; y: number }> {
  if (!keyframes || keyframes.length === 0) {
    return JSON.parse(JSON.stringify(fallbackJoints));
  }
  if (keyframes.length === 1) {
    return JSON.parse(JSON.stringify(keyframes[0].joints));
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const clampedTime = loop && duration > 0
    ? (time % duration)
    : Math.max(0, Math.min(duration, time));

  // If time is before or at first keyframe
  if (clampedTime <= sorted[0].time) {
    if (!loop || sorted[sorted.length - 1].time <= sorted[0].time) {
      return JSON.parse(JSON.stringify(sorted[0].joints));
    }
    const k0 = sorted[sorted.length - 1];
    const k1 = sorted[0];
    const segmentDuration = (duration - k0.time) + k1.time;
    if (segmentDuration <= 0) return JSON.parse(JSON.stringify(sorted[0].joints));
    const tInSeg = clampedTime + (duration - k0.time);
    const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
    return lerpJointDict(k0.joints, k1.joints, alpha, fallbackJoints);
  }

  // If time is after or at last keyframe
  if (clampedTime >= sorted[sorted.length - 1].time) {
    if (!loop) {
      return JSON.parse(JSON.stringify(sorted[sorted.length - 1].joints));
    }
    const k0 = sorted[sorted.length - 1];
    const k1 = sorted[0];
    const segmentDuration = (duration - k0.time) + k1.time;
    if (segmentDuration <= 0) return JSON.parse(JSON.stringify(sorted[0].joints));
    const tInSeg = clampedTime - k0.time;
    const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
    return lerpJointDict(k0.joints, k1.joints, alpha, fallbackJoints);
  }

  // Find bounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (clampedTime >= k0.time && clampedTime <= k1.time) {
      const dt = k1.time - k0.time;
      const alpha = dt > 0 ? (clampedTime - k0.time) / dt : 0;
      return lerpJointDict(k0.joints, k1.joints, alpha, fallbackJoints);
    }
  }

  return JSON.parse(JSON.stringify(sorted[0].joints));
}

function lerpJointDict(
  j0: Record<string, { x: number; y: number }>,
  j1: Record<string, { x: number; y: number }>,
  alpha: number,
  fallback: Record<string, { x: number; y: number }>
): Record<AnatomicalJointId, { x: number; y: number }> {
  // Smoothstep for organic, continuous motion
  const ease = alpha * alpha * (3 - 2 * alpha);
  const result: any = {};
  const allKeys = new Set([
    ...Object.keys(j0 || {}),
    ...Object.keys(j1 || {}),
    ...Object.keys(fallback || {})
  ]);

  for (const k of allKeys) {
    const p0 = j0?.[k] || fallback[k] || { x: 0, y: 0 };
    const p1 = j1?.[k] || fallback[k] || { x: 0, y: 0 };
    result[k] = {
      x: p0.x + (p1.x - p0.x) * ease,
      y: p0.y + (p1.y - p0.y) * ease
    };
  }

  return result;
}

export class KeyframeTimeline {
  private container: HTMLElement;
  private animations: Record<string, StudioAnimationDefinition> = {};
  private activeAnimKey = 'idle';
  private activeView: StudioView = 'front';
  private restJoints: Record<AnatomicalJointId, { x: number; y: number }> = {} as any;

  private currentTime = 0;
  private duration = 1.0;
  private isPlaying = false;
  private isLooping = true;
  private isAutoKey = true;
  private playbackSpeed = 1.0;

  private selectedKeyframeIndex: number | null = null;
  private isDraggingPlayhead = false;
  private animTimerId: any = null;
  private lastTimestamp = 0;

  private events: KeyframeTimelineEvents;

  constructor(
    container: HTMLElement,
    animations: Record<string, StudioAnimationDefinition>,
    activeAnimKey: string,
    activeView: StudioView,
    restJoints: Record<AnatomicalJointId, { x: number; y: number }>,
    events: KeyframeTimelineEvents = {}
  ) {
    this.container = container;
    this.animations = animations;
    this.activeAnimKey = activeAnimKey;
    this.activeView = activeView;
    this.restJoints = restJoints;
    this.events = events;

    this.syncActiveTrack();
    this.render();
    this.startPlaybackLoop();
  }

  public setAnimationState(
    animations: Record<string, StudioAnimationDefinition>,
    activeAnimKey: string,
    activeView: StudioView,
    restJoints: Record<AnatomicalJointId, { x: number; y: number }>
  ): void {
    this.animations = animations;
    this.activeAnimKey = activeAnimKey;
    this.activeView = activeView;
    this.restJoints = restJoints;

    this.syncActiveTrack();
    this.render();
    this.evaluatePoseAtCurrentTime();
  }

  public setActiveView(view: StudioView, restJoints: Record<AnatomicalJointId, { x: number; y: number }>): void {
    this.activeView = view;
    this.restJoints = restJoints;
    this.syncActiveTrack();
    this.render();
    this.evaluatePoseAtCurrentTime();
  }

  public setActiveAnimation(animName: string): void {
    if (!this.animations[animName]) return;
    this.activeAnimKey = animName;
    this.currentTime = 0;
    this.syncActiveTrack();
    this.render();
    this.evaluatePoseAtCurrentTime();
  }

  public getActiveAnimation(): string {
    return this.activeAnimKey;
  }

  public getTime(): number {
    return this.currentTime;
  }

  public setTime(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updatePlayheadPosition();
    this.evaluatePoseAtCurrentTime();
    this.events.onTimeChange?.(this.currentTime);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public togglePlay(play?: boolean): void {
    this.isPlaying = play !== undefined ? play : !this.isPlaying;
    const playBtn = this.container.querySelector('.btn-timeline-play');
    if (playBtn) {
      playBtn.innerHTML = `<span>${this.isPlaying ? '⏸' : '▶'}</span> ${this.isPlaying ? 'Pause' : 'Play'}`;
    }
    this.events.onPlayToggle?.(this.isPlaying);
  }

  public setAutoKey(enabled: boolean): void {
    this.isAutoKey = enabled;
    const btn = this.container.querySelector('.chk-auto-key') as HTMLInputElement | null;
    if (btn) btn.checked = enabled;
    this.events.onAutoKeyToggled?.(enabled);
  }

  public getIsAutoKey(): boolean {
    return this.isAutoKey;
  }

  public addKeyframe(joints: Record<AnatomicalJointId, { x: number; y: number }>, name?: string): void {
    const track = this.getActiveTrack();
    if (!track) return;

    const t = Math.round(this.currentTime * 100) / 100;
    const clonedJoints = JSON.parse(JSON.stringify(joints));

    // Check if keyframe already exists near this timestamp (threshold 0.03s)
    const existingIndex = track.keyframes.findIndex(k => Math.abs(k.time - t) < 0.03);
    if (existingIndex >= 0) {
      track.keyframes[existingIndex].joints = clonedJoints;
      if (name) track.keyframes[existingIndex].name = name;
      this.selectedKeyframeIndex = existingIndex;
    } else {
      track.keyframes.push({ time: t, name: name || undefined, joints: clonedJoints });
      track.keyframes.sort((a, b) => a.time - b.time);
      this.selectedKeyframeIndex = track.keyframes.findIndex(k => k.time === t);
    }

    this.duration = Math.max(this.duration, t);
    track.duration = this.duration;

    this.renderRuler();
    this.renderKeyframeTrack();
    this.updatePlayheadPosition();
    this.events.onKeyframeAdded?.(t, clonedJoints);
    if (this.selectedKeyframeIndex !== null) {
      this.events.onKeyframeSelected?.(this.selectedKeyframeIndex, track.keyframes[this.selectedKeyframeIndex]);
    }
  }

  public setKeyframeName(index: number, name: string): void {
    const track = this.getActiveTrack();
    if (track && track.keyframes[index]) {
      track.keyframes[index].name = name.trim() || undefined;
      this.renderKeyframeTrack();
    }
  }

  public getSelectedKeyframe(): { index: number; keyframe: StudioKeyframe } | null {
    const track = this.getActiveTrack();
    if (track && this.selectedKeyframeIndex !== null && track.keyframes[this.selectedKeyframeIndex]) {
      return { index: this.selectedKeyframeIndex, keyframe: track.keyframes[this.selectedKeyframeIndex] };
    }
    return null;
  }

  public deleteSelectedKeyframe(): void {
    const track = this.getActiveTrack();
    if (!track) return;

    if (this.selectedKeyframeIndex !== null && track.keyframes[this.selectedKeyframeIndex]) {
      track.keyframes.splice(this.selectedKeyframeIndex, 1);
      this.events.onKeyframeDeleted?.(this.selectedKeyframeIndex);
      this.selectedKeyframeIndex = null;
      this.renderRuler();
      this.renderKeyframeTrack();
      this.evaluatePoseAtCurrentTime();
      return;
    }

    // Otherwise delete keyframe nearest to current playhead
    const t = this.currentTime;
    const idx = track.keyframes.findIndex(k => Math.abs(k.time - t) < 0.04);
    if (idx >= 0) {
      track.keyframes.splice(idx, 1);
      this.events.onKeyframeDeleted?.(idx);
      this.renderRuler();
      this.renderKeyframeTrack();
      this.evaluatePoseAtCurrentTime();
    }
  }

  public evaluatePoseAtCurrentTime(): void {
    const track = this.getActiveTrack();
    if (!track || track.keyframes.length === 0) {
      this.events.onPoseInterpolated?.(this.restJoints);
      return;
    }

    const posed = interpolateJointPoses(
      track.keyframes,
      this.currentTime,
      this.duration,
      this.isLooping,
      this.restJoints
    );
    this.events.onPoseInterpolated?.(posed);
  }

  private getActiveTrack(): StudioSideTrack | null {
    const anim = this.animations[this.activeAnimKey];
    if (!anim) return null;
    if (!anim.relevantSides.includes(this.activeView)) return null;

    if (!anim.tracks[this.activeView]) {
      anim.tracks[this.activeView] = {
        duration: 1.0,
        keyframes: [
          { time: 0, joints: JSON.parse(JSON.stringify(this.restJoints)) }
        ]
      };
    }
    return anim.tracks[this.activeView]!;
  }

  private syncActiveTrack(): void {
    const track = this.getActiveTrack();
    if (track) {
      this.duration = Math.max(0.2, track.duration || 1.0);
    } else {
      this.duration = 1.0;
    }
  }

  private getTrackWidth(): number {
    const containerWidth = this.container.clientWidth || 600;
    const minWidthByDuration = Math.round(this.duration * 240);
    const minTrackWidth = Math.max(700, minWidthByDuration);
    return Math.max(minTrackWidth, containerWidth - 220);
  }

  public render(): void {
    const animList = Object.values(this.animations);
    const activeAnim = this.animations[this.activeAnimKey];
    const isRelevantForView = activeAnim?.relevantSides.includes(this.activeView) ?? false;
    const trackWidth = this.getTrackWidth();
    const totalWidth = 200 + trackWidth;

    this.container.innerHTML = `
      <div class="timeline-toolbar">
        <div class="tool-group">
          <button class="tool-btn btn-timeline-play" title="Play / Pause Animation (Space)">
            <span>${this.isPlaying ? '⏸' : '▶'}</span> ${this.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button class="tool-btn btn-timeline-rewind" title="Rewind to start (0.00s)">⏪</button>
          <button class="tool-btn btn-timeline-step-back" title="Previous Frame (1/30s)">⏮</button>
          <button class="tool-btn btn-timeline-step-fwd" title="Next Frame (1/30s)">⏭</button>
          <div class="tool-separator"></div>
          <span class="timeline-time-display">
            <span id="time-current-label">${this.currentTime.toFixed(2)}s</span> / <span id="time-duration-label">${this.duration.toFixed(2)}s</span>
          </span>
        </div>

        <div class="tool-group">
          <span style="font-size:0.75rem; color:var(--studio-text-muted); font-weight:600;">Clip:</span>
          <select class="studio-select select-timeline-clip" style="padding:3px 8px; font-weight:600; font-size:0.75rem;">
            ${animList.map(a => {
              const rel = a.relevantSides.includes(this.activeView);
              const sidesBadge = a.relevantSides.map(s => s[0].toUpperCase()).join('/');
              return `<option value="${a.name}" ${a.name === this.activeAnimKey ? 'selected' : ''}>
                ${a.name} [${sidesBadge}] ${rel ? '✓' : '(inactive)'}
              </option>`;
            }).join('')}
          </select>
          <button class="tool-btn btn-timeline-new-clip" title="Create New Custom Animation Clip">＋ Clip</button>
          <div class="tool-separator"></div>
          <span class="timeline-side-badge ${isRelevantForView ? 'active' : 'warning'}" title="Active orientation for unique animation authoring">
            Side: <b>${this.activeView.toUpperCase()}</b>
          </span>
        </div>

        <div class="tool-group">
          <button class="tool-btn btn-timeline-add-key" title="Record Keyframe at current playhead time" ${!isRelevantForView ? 'disabled' : ''}>
            🔑 ＋Key
          </button>
          <button class="tool-btn btn-timeline-del-key" title="Delete Keyframe at current playhead time (Del)" ${!isRelevantForView ? 'disabled' : ''}>
            🗑️ Del
          </button>
          <div class="tool-separator"></div>
          <label class="timeline-toggle-label" title="When active, dragging any joint on canvas auto-records keyframe at current time">
            <input type="checkbox" class="chk-auto-key" ${this.isAutoKey ? 'checked' : ''} />
            <span class="auto-key-indicator ${this.isAutoKey ? 'active' : ''}">●</span> Auto-Key
          </label>
          <label class="timeline-toggle-label" title="Loop playback continuously">
            <input type="checkbox" class="chk-timeline-loop" ${this.isLooping ? 'checked' : ''} /> Loop
          </label>
        </div>
      </div>

      ${!isRelevantForView ? `
        <div class="timeline-side-warning-banner">
          <span>⚠️ Animation <b>"${this.activeAnimKey}"</b> is not configured for <b>${this.activeView.toUpperCase()}</b> side.</span>
          <button class="btn-studio btn-enable-side-timeline" style="font-size:0.72rem; padding:3px 10px; background:#0284c7; color:#fff;">
            ＋ Enable for ${this.activeView.toUpperCase()}
          </button>
        </div>
      ` : ''}

      <!-- Timeline Viewport (Ruler + Dope Sheet Tracks) -->
      <div class="timeline-viewport">
        <div class="timeline-scroll-content" style="min-width:${totalWidth}px; width:max-content; min-height:100%; display:flex; flex-direction:column; position:relative;">
          <!-- Time Ruler -->
          <div class="timeline-ruler-wrapper">
            <div class="timeline-corner-header">
              <span>DOPE SHEET / KEYS</span>
            </div>
            <div class="timeline-ruler" style="width:${trackWidth}px; min-width:${trackWidth}px;">
              <canvas id="ruler-canvas" style="display:block; width:100%; height:100%;"></canvas>
              <!-- Draggable Playhead Scrubber -->
              <div id="playhead-line" style="position:absolute; top:0; bottom:-500px; width:2px; background:#ef4444; z-index:50; pointer-events:none; left:0px;">
                <div class="playhead-head"></div>
              </div>
            </div>
          </div>

          <!-- Main Keyframe Track Line -->
          <div class="timeline-tracks-list">
            <div class="timeline-master-row">
              <div class="timeline-row-header master">
                <span>⭐ Poses / Master Track</span>
              </div>
              <div class="master-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                <!-- Diamonds populated dynamically -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderRuler();
    this.renderKeyframeTrack();
    this.bindDOMEvents();
    this.updatePlayheadPosition();
  }

  private renderRuler(): void {
    const canvas = this.container.querySelector('#ruler-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const trackWidth = this.getTrackWidth();
    canvas.width = trackWidth;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelsPerSec = trackWidth / this.duration;

    ctx.clearRect(0, 0, trackWidth, 24);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    // Step resolution based on width
    const step = pixelsPerSec > 250 ? 0.05 : (pixelsPerSec > 120 ? 0.1 : 0.2);

    for (let t = 0; t <= this.duration + 0.01; t += step) {
      const x = Math.round(t * pixelsPerSec);
      const isMajor = Math.abs(t - Math.round(t)) < 0.01;
      const isHalf = Math.abs(t * 2 - Math.round(t * 2)) < 0.01;

      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 6 : (isHalf ? 12 : 16));
      ctx.lineTo(x, 24);
      ctx.stroke();

      if (isMajor || (step <= 0.1 && isHalf)) {
        ctx.fillText(`${t.toFixed(1)}s`, x + 4, 13);
      }
    }
  }

  private renderKeyframeTrack(): void {
    const lane = this.container.querySelector('.master-track-lane') as HTMLElement;
    if (!lane) return;

    const track = this.getActiveTrack();
    const keyframes = track?.keyframes || [];
    const trackWidth = this.getTrackWidth();
    const pixelsPerSec = trackWidth / this.duration;

    lane.innerHTML = keyframes.map((k, idx) => {
      const leftPx = Math.round(k.time * pixelsPerSec);
      const isSelected = this.selectedKeyframeIndex === idx;
      const poseTitle = k.name ? `Pose "${k.name}" at ${k.time.toFixed(2)}s` : `Pose Keyframe at ${k.time.toFixed(2)}s`;

      return `
        <div class="keyframe-diamond ${isSelected ? 'selected' : ''}"
          data-index="${idx}"
          data-time="${k.time}"
          title="${poseTitle} (Click to jump / Del to delete)"
          style="left:${leftPx - 6}px;">
        </div>
        ${k.name ? `
          <span class="kf-name-tag" style="position:absolute; left:${leftPx}px; top:11px; font-size:0.55rem; color:#7dd3fc; pointer-events:none; white-space:nowrap; transform:translateX(-50%); font-weight:600; text-shadow:0 1px 2px #000;">
            ${k.name}
          </span>
        ` : ''}
      `;
    }).join('');

    // Bind keyframe clicks
    lane.querySelectorAll('.keyframe-diamond').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-index')!, 10);
        this.selectedKeyframeIndex = idx;
        const k = keyframes[idx];
        if (k) {
          this.setTime(k.time);
          this.renderKeyframeTrack();
          this.events.onKeyframeSelected?.(idx, k);
        }
      });
    });
  }

  private updatePlayheadPosition(): void {
    const playhead = this.container.querySelector('#playhead-line') as HTMLElement;
    const timeLabel = this.container.querySelector('#time-current-label');
    if (!playhead) return;

    const trackWidth = this.getTrackWidth();
    const pixelsPerSec = trackWidth / this.duration;
    const x = this.currentTime * pixelsPerSec;

    playhead.style.left = `${Math.round(x)}px`;
    if (timeLabel) timeLabel.textContent = `${this.currentTime.toFixed(2)}s`;
  }

  private bindDOMEvents(): void {
    // Play / Pause button
    this.container.querySelector('.btn-timeline-play')?.addEventListener('click', () => {
      this.togglePlay();
    });

    // Rewind
    this.container.querySelector('.btn-timeline-rewind')?.addEventListener('click', () => {
      this.setTime(0);
    });

    // Frame Steps
    this.container.querySelector('.btn-timeline-step-fwd')?.addEventListener('click', () => {
      this.setTime(this.currentTime + 1 / 30);
    });
    this.container.querySelector('.btn-timeline-step-back')?.addEventListener('click', () => {
      this.setTime(this.currentTime - 1 / 30);
    });

    // Clip Switcher
    const clipSelect = this.container.querySelector('.select-timeline-clip') as HTMLSelectElement;
    clipSelect?.addEventListener('change', () => {
      this.setActiveAnimation(clipSelect.value);
      this.events.onAnimationSelected?.(clipSelect.value);
    });

    // New Clip request
    this.container.querySelector('.btn-timeline-new-clip')?.addEventListener('click', () => {
      this.events.onRequestNewAnimation?.();
    });

    // Enable side requested from banner
    this.container.querySelector('.btn-enable-side-timeline')?.addEventListener('click', () => {
      this.events.onEnableSideRequested?.(this.activeAnimKey, this.activeView);
    });

    // Add Keyframe button
    this.container.querySelector('.btn-timeline-add-key')?.addEventListener('click', () => {
      this.addKeyframe(this.restJoints);
      this.events.onKeyframeAdded?.(this.currentTime, this.restJoints);
    });

    // Delete Keyframe button
    this.container.querySelector('.btn-timeline-del-key')?.addEventListener('click', () => {
      this.deleteSelectedKeyframe();
    });

    // Auto-Key toggle
    const autoKeyChk = this.container.querySelector('.chk-auto-key') as HTMLInputElement;
    autoKeyChk?.addEventListener('change', () => {
      this.setAutoKey(autoKeyChk.checked);
    });

    // Loop toggle
    const loopChk = this.container.querySelector('.chk-timeline-loop') as HTMLInputElement;
    loopChk?.addEventListener('change', () => {
      this.isLooping = loopChk.checked;
    });

    // Ruler Scrubbing
    const ruler = this.container.querySelector('.timeline-ruler') as HTMLElement;
    ruler?.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDraggingPlayhead = true;
        this.scrubFromEvent(e);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingPlayhead) {
        this.scrubFromEvent(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingPlayhead = false;
    });

    // Delete key shortcut
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedKeyframe();
      }
    });
  }

  private scrubFromEvent(e: MouseEvent): void {
    const ruler = this.container.querySelector('.timeline-ruler') as HTMLElement;
    if (!ruler) return;
    const rect = ruler.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const trackWidth = this.getTrackWidth();
    const t = Math.max(0, Math.min(this.duration, (clientX / trackWidth) * this.duration));
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
            const playBtn = this.container.querySelector('.btn-timeline-play');
            if (playBtn) playBtn.innerHTML = `<span>▶</span> Play`;
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
