import {
  AnatomicalJointId,
  StudioAnimationDefinition,
  StudioKeyframe,
  StudioSideTrack,
  StudioView
} from '../types';
import { ANATOMICAL_JOINTS } from '../rigging/AnatomicalRig';

export interface KeyframeTimelineEvents {
  onPoseInterpolated?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onTimeChange?: (time: number) => void;
  onPlayToggle?: (isPlaying: boolean) => void;
  onKeyframeAdded?: (time: number, joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onKeyframeDeleted?: (index: number) => void;
  onKeyframeMoved?: (index: number, oldTime: number, newTime: number) => void;
  onKeyframeCopied?: (keyframe: { name?: string; joints: Record<AnatomicalJointId, { x: number; y: number }> }) => void;
  onKeyframePasted?: (time: number, keyframe: StudioKeyframe) => void;
  onCycleClosed?: (duration: number) => void;
  onAnimationSelected?: (animName: string) => void;
  onRequestNewAnimation?: () => void;
  onAutoKeyToggled?: (enabled: boolean) => void;
  onEnableSideRequested?: (animName: string, side: StudioView) => void;
  onDurationChanged?: (duration: number) => void;
  onZoomChanged?: (zoom: number) => void;
  onKeyframeSelected?: (index: number, keyframe: StudioKeyframe | null) => void;
  onKinematicsModeChanged?: (mode: 'ik' | 'fk') => void;
  onHeightPresetRequested?: (height: number) => void;
}

export interface ElementGroupDef {
  id: string;
  name: string;
  icon: string;
  jointIds: AnatomicalJointId[];
}

export const ELEMENT_GROUPS: ElementGroupDef[] = [
  {
    id: 'spine',
    name: 'Spine & Head',
    icon: '👤',
    jointIds: ['head', 'neck', 'chest']
  },
  {
    id: 'arm_l',
    name: 'Left Arm',
    icon: '💪',
    jointIds: ['shoulder_l', 'elbow_l', 'wrist_l', 'hand_l']
  },
  {
    id: 'arm_r',
    name: 'Right Arm',
    icon: '💪',
    jointIds: ['shoulder_r', 'elbow_r', 'wrist_r', 'hand_r']
  },
  {
    id: 'leg_l',
    name: 'Left Leg',
    icon: '🦵',
    jointIds: ['hip_l', 'knee_l', 'ankle_l', 'foot_l']
  },
  {
    id: 'leg_r',
    name: 'Right Leg',
    icon: '🦵',
    jointIds: ['hip_r', 'knee_r', 'ankle_r', 'foot_r']
  }
];

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
  private kinematicsMode: 'ik' | 'fk' = 'ik';

  // Zoom level (1.0 = 100%)
  private zoomLevel = 1.0;

  // Collapsible tracks state
  private isElementTracksExpanded = true;
  private collapsedGroups: Set<string> = new Set();

  // Keyframe dragging state
  private isDraggingKeyframe = false;
  private draggedKeyframeIndex: number | null = null;
  private dragStartClientX = 0;
  private dragStartTime = 0;
  private hasDraggedKeyframe = false;
  private dragGhostElement: HTMLElement | null = null;

  // Static clipboard across animation clips and orientations
  private static clipboardKeyframe: {
    name?: string;
    joints: Record<AnatomicalJointId, { x: number; y: number }>;
  } | null = null;

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

  public getDuration(): number {
    return this.duration;
  }

  /**
   * Sets the animation timeline duration/length in seconds.
   */
  public setDuration(newDuration: number, scaleKeyframes = false): void {
    const clamped = Math.max(0.1, Math.min(60.0, Math.round(newDuration * 100) / 100));
    const oldDuration = this.duration;
    if (Math.abs(oldDuration - clamped) < 0.005) return;

    this.duration = clamped;
    const track = this.getActiveTrack();
    if (track) {
      if (scaleKeyframes && oldDuration > 0) {
        const scale = clamped / oldDuration;
        for (const kf of track.keyframes) {
          kf.time = Math.round(kf.time * scale * 100) / 100;
        }
        track.keyframes.sort((a, b) => a.time - b.time);
      }
      track.duration = clamped;
    }

    if (this.currentTime > clamped) {
      this.currentTime = clamped;
    }

    // Update DOM inputs and labels
    const durInput = this.container.querySelector('.input-timeline-duration') as HTMLInputElement | null;
    if (durInput) durInput.value = clamped.toFixed(2);
    const durLabel = this.container.querySelector('#time-duration-label');
    if (durLabel) durLabel.textContent = `${clamped.toFixed(2)}s`;

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();
    this.evaluatePoseAtCurrentTime();

    this.events.onDurationChanged?.(clamped);
  }

  /**
   * Moves a keyframe at fromIndex to a new timestamp.
   */
  public moveKeyframe(fromIndex: number, newTime: number): boolean {
    const track = this.getActiveTrack();
    if (!track || !track.keyframes[fromIndex]) return false;

    const clampedTime = Math.max(0, Math.min(this.duration, Math.round(newTime * 100) / 100));
    const kf = track.keyframes[fromIndex];
    const oldTime = kf.time;
    if (Math.abs(oldTime - clampedTime) < 0.005) return false;

    kf.time = clampedTime;
    track.keyframes.sort((a, b) => a.time - b.time);
    this.selectedKeyframeIndex = track.keyframes.indexOf(kf);

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();
    this.evaluatePoseAtCurrentTime();

    this.events.onKeyframeMoved?.(this.selectedKeyframeIndex, oldTime, clampedTime);
    return true;
  }

  // Zoom options API
  public getZoom(): number {
    return this.zoomLevel;
  }

  public setZoom(zoom: number): void {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(zoom * 100) / 100));
    if (Math.abs(this.zoomLevel - clamped) < 0.01) return;
    this.zoomLevel = clamped;

    const resetBtn = this.container.querySelector('.btn-timeline-zoom-reset');
    if (resetBtn) resetBtn.textContent = `${Math.round(this.zoomLevel * 100)}%`;

    const trackWidth = this.getTrackWidth();
    const totalWidth = 200 + trackWidth;
    const scrollContent = this.container.querySelector('.timeline-scroll-content') as HTMLElement | null;
    if (scrollContent) scrollContent.style.minWidth = `${totalWidth}px`;

    const rulerEl = this.container.querySelector('.timeline-ruler') as HTMLElement | null;
    if (rulerEl) {
      rulerEl.style.width = `${trackWidth}px`;
      rulerEl.style.minWidth = `${trackWidth}px`;
    }
    const masterLane = this.container.querySelector('.master-track-lane') as HTMLElement | null;
    if (masterLane) {
      masterLane.style.width = `${trackWidth}px`;
      masterLane.style.minWidth = `${trackWidth}px`;
    }

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();

    this.events.onZoomChanged?.(this.zoomLevel);
  }

  public zoomIn(): void {
    const nextZoom = this.zoomLevel < 1.0 ? this.zoomLevel + 0.25 : this.zoomLevel + 0.5;
    this.setZoom(nextZoom);
  }

  public zoomOut(): void {
    const nextZoom = this.zoomLevel <= 1.0 ? this.zoomLevel - 0.25 : this.zoomLevel - 0.5;
    this.setZoom(nextZoom);
  }

  public resetZoom(): void {
    this.setZoom(1.0);
  }

  // Collapsible tracks API
  public toggleElementTracks(expanded?: boolean): void {
    this.isElementTracksExpanded = expanded !== undefined ? expanded : !this.isElementTracksExpanded;
    this.renderElementTracks();
  }

  public toggleElementGroup(groupId: string, expanded?: boolean): void {
    if (expanded === true) {
      this.collapsedGroups.delete(groupId);
    } else if (expanded === false) {
      this.collapsedGroups.add(groupId);
    } else {
      if (this.collapsedGroups.has(groupId)) {
        this.collapsedGroups.delete(groupId);
      } else {
        this.collapsedGroups.add(groupId);
      }
    }
    this.renderElementTracks();
  }

  public expandAllElementGroups(): void {
    this.isElementTracksExpanded = true;
    this.collapsedGroups.clear();
    this.renderElementTracks();
  }

  public collapseAllElementGroups(): void {
    this.isElementTracksExpanded = true;
    for (const g of ELEMENT_GROUPS) {
      this.collapsedGroups.add(g.id);
    }
    this.renderElementTracks();
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
    this.renderElementTracks();
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
      this.renderElementTracks();
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
      this.renderElementTracks();
      this.evaluatePoseAtCurrentTime();
    }
  }

  public static getClipboard(): { name?: string; joints: Record<AnatomicalJointId, { x: number; y: number }> } | null {
    return KeyframeTimeline.clipboardKeyframe
      ? JSON.parse(JSON.stringify(KeyframeTimeline.clipboardKeyframe))
      : null;
  }

  public static setClipboard(keyframe: { name?: string; joints: Record<AnatomicalJointId, { x: number; y: number }> } | null): void {
    KeyframeTimeline.clipboardKeyframe = keyframe
      ? JSON.parse(JSON.stringify(keyframe))
      : null;
  }

  public setKinematicsMode(mode: 'ik' | 'fk'): void {
    this.kinematicsMode = mode;
    const btn = this.container.querySelector('.btn-timeline-kinematics');
    if (btn) {
      btn.innerHTML = `<span>${mode === 'fk' ? '🦴' : '⚡'}</span> ${mode === 'fk' ? 'FK (No-IK)' : 'IK Mode'}`;
      btn.setAttribute('title', `Toggle Kinematics: ${mode === 'fk' ? 'FK (No-IK)' : 'IK Mode'} [HotKey: K or Hold Shift/Alt while dragging]`);
    }
  }

  public getKinematicsMode(): 'ik' | 'fk' {
    return this.kinematicsMode;
  }

  /**
   * Copies the keyframe at the given index, the currently selected keyframe,
   * or a snapshot of the current pose at the playhead.
   */
  public copyKeyframe(index?: number): boolean {
    const track = this.getActiveTrack();
    if (!track) return false;

    let targetKeyframe: StudioKeyframe | null = null;
    if (index !== undefined && track.keyframes[index]) {
      targetKeyframe = track.keyframes[index];
    } else if (this.selectedKeyframeIndex !== null && track.keyframes[this.selectedKeyframeIndex]) {
      targetKeyframe = track.keyframes[this.selectedKeyframeIndex];
    } else {
      // Find keyframe near playhead
      const t = this.currentTime;
      const near = track.keyframes.find(k => Math.abs(k.time - t) < 0.04);
      if (near) {
        targetKeyframe = near;
      } else {
        // Snapshot pose at playhead time
        const currentPosed = interpolateJointPoses(
          track.keyframes,
          this.currentTime,
          this.duration,
          this.isLooping,
          this.restJoints
        );
        targetKeyframe = {
          time: this.currentTime,
          joints: currentPosed
        };
      }
    }

    if (!targetKeyframe) return false;

    KeyframeTimeline.clipboardKeyframe = {
      name: targetKeyframe.name,
      joints: JSON.parse(JSON.stringify(targetKeyframe.joints))
    };
    this.events.onKeyframeCopied?.(targetKeyframe);
    return true;
  }

  /**
   * Pastes the copied keyframe at targetTime (or current playhead position).
   */
  public pasteKeyframe(targetTime?: number): boolean {
    const track = this.getActiveTrack();
    if (!track || !KeyframeTimeline.clipboardKeyframe) return false;

    const t = targetTime !== undefined ? targetTime : this.currentTime;
    const roundedTime = Math.round(t * 100) / 100;
    const clonedJoints = JSON.parse(JSON.stringify(KeyframeTimeline.clipboardKeyframe.joints));
    const name = KeyframeTimeline.clipboardKeyframe.name;

    this.currentTime = roundedTime;
    this.addKeyframe(clonedJoints, name);

    this.events.onKeyframePasted?.(roundedTime, { time: roundedTime, name, joints: clonedJoints });
    return true;
  }

  /**
   * Closes the animation loop for seamless walk/run cycles.
   * Copies the initial pose at 0.00s and pastes it at the duration end timestamp.
   */
  public closeCycle(): boolean {
    const track = this.getActiveTrack();
    if (!track) return false;

    // Find first keyframe (at or nearest to 0.00s)
    let firstKey = track.keyframes.find(k => Math.abs(k.time) < 0.04);
    if (!firstKey && track.keyframes.length > 0) {
      firstKey = track.keyframes[0];
    }

    const jointsToCopy = firstKey
      ? JSON.parse(JSON.stringify(firstKey.joints))
      : interpolateJointPoses(track.keyframes, 0, this.duration, this.isLooping, this.restJoints);

    const name = firstKey?.name ? `${firstKey.name} (Loop End)` : 'Loop End';

    // Store in clipboard
    KeyframeTimeline.clipboardKeyframe = {
      name,
      joints: JSON.parse(JSON.stringify(jointsToCopy))
    };

    // Paste at duration end
    const endT = Math.round(this.duration * 100) / 100;
    this.currentTime = endT;
    this.addKeyframe(jointsToCopy, name);

    this.events.onCycleClosed?.(endT);
    return true;
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
      this.duration = Math.max(0.1, track.duration || 1.0);
    } else {
      this.duration = 1.0;
    }
  }

  private getTrackWidth(): number {
    const containerWidth = (this.container.clientWidth || 600) - 220;
    const basePixelsPerSec = 260 * this.zoomLevel;
    const minWidthByDuration = Math.round(this.duration * basePixelsPerSec);
    return Math.max(minWidthByDuration, Math.round(containerWidth * this.zoomLevel));
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
            <span id="time-current-label">${this.currentTime.toFixed(2)}s</span>
          </span>
          <div class="tool-separator"></div>
          <div style="display:flex; align-items:center; gap:4px;" title="Set total animation length in seconds (Press Enter to apply)">
            <span style="font-size:0.7rem; color:var(--studio-text-muted); font-weight:600;">Length:</span>
            <input type="number" class="studio-input input-timeline-duration" min="0.1" max="60.0" step="0.1" value="${this.duration.toFixed(2)}" style="width:52px; padding:2px 4px; font-size:0.72rem; text-align:center; font-family:var(--studio-font-mono); background:#020617; border:1px solid rgba(255,255,255,0.15); border-radius:4px; color:#f8fafc;" />
            <span style="font-size:0.7rem; color:var(--studio-text-muted);">s</span>
          </div>
          <div class="tool-separator"></div>
          <div class="timeline-zoom-controls" style="display:flex; align-items:center; gap:2px;">
            <span style="font-size:0.7rem; color:var(--studio-text-muted); font-weight:600; margin-right:2px;">Zoom:</span>
            <button class="tool-btn btn-timeline-zoom-out" title="Zoom Out Timeline (Ctrl + MouseWheel)">🔍−</button>
            <button class="tool-btn btn-timeline-zoom-reset" title="Reset Zoom to 100%" style="font-size:0.65rem; font-family:var(--studio-font-mono); padding:2px 6px;">${Math.round(this.zoomLevel * 100)}%</button>
            <button class="tool-btn btn-timeline-zoom-in" title="Zoom In Timeline (Ctrl + MouseWheel)">🔍＋</button>
          </div>
          <div class="tool-separator"></div>
          <div class="timeline-height-controls" style="display:flex; align-items:center; gap:2px;" title="Adjust timeline panel height (S: 140px, M: 220px, L: 360px). You can also drag the top splitter bar!">
            <span style="font-size:0.7rem; color:var(--studio-text-muted); font-weight:600; margin-right:2px;">Height:</span>
            <button class="tool-btn btn-timeline-height-s" title="Compact Height (140px)" style="font-size:0.65rem; padding:2px 5px; font-weight:700;">S</button>
            <button class="tool-btn btn-timeline-height-m" title="Default Height (220px)" style="font-size:0.65rem; padding:2px 5px; font-weight:700;">M</button>
            <button class="tool-btn btn-timeline-height-l" title="Expanded Height (360px)" style="font-size:0.65rem; padding:2px 5px; font-weight:700;">L</button>
          </div>
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
          <button class="tool-btn btn-timeline-copy-key" title="Copy Keyframe (Ctrl+C)" ${!isRelevantForView ? 'disabled' : ''}>
            📋 Copy
          </button>
          <button class="tool-btn btn-timeline-paste-key" title="Paste Keyframe at Playhead (Ctrl+V)" ${!isRelevantForView ? 'disabled' : ''}>
            📄 Paste
          </button>
          <button class="tool-btn btn-timeline-close-cycle" title="Close Loop Cycle: Copy 0.00s initial pose to duration end (${this.duration.toFixed(2)}s) for seamless looping" ${!isRelevantForView ? 'disabled' : ''}>
            🔁 Close Cycle
          </button>
          <button class="tool-btn btn-timeline-del-key" title="Delete Keyframe at current playhead time (Del)" ${!isRelevantForView ? 'disabled' : ''}>
            🗑️ Del
          </button>
          <div class="tool-separator"></div>
          <button class="tool-btn btn-timeline-kinematics" title="Toggle Kinematics Mode: IK or FK (No-IK / Forward Kinematics for free knee/foot rotation) [HotKey: K or Hold Shift/Alt while dragging]">
            <span>${this.kinematicsMode === 'fk' ? '🦴' : '⚡'}</span> ${this.kinematicsMode === 'fk' ? 'FK (No-IK)' : 'IK Mode'}
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
              <div id="playhead-line" style="position:absolute; top:0; bottom:0; height:100%; min-height:100%; width:2px; background:#ef4444; z-index:50; pointer-events:none; left:0px;">
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

            <!-- Collapsible Bone & Element Tracks Container -->
            <div class="timeline-element-tracks-container">
              <!-- Element rows populated dynamically by renderElementTracks() -->
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
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

    // Step resolution based on zoom and duration
    const step = pixelsPerSec > 400 ? 0.05 : (pixelsPerSec > 180 ? 0.1 : (pixelsPerSec > 80 ? 0.2 : 0.5));

    for (let t = 0; t <= this.duration + 0.001; t += step) {
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
          title="${poseTitle} (Click to jump / Drag to move time / Del to delete)"
          style="left:${leftPx - 6}px;">
        </div>
        ${k.name ? `
          <span class="kf-name-tag" style="position:absolute; left:${leftPx}px; top:11px; font-size:0.55rem; color:#7dd3fc; pointer-events:none; white-space:nowrap; transform:translateX(-50%); font-weight:600; text-shadow:0 1px 2px #000;">
            ${k.name}
          </span>
        ` : ''}
      `;
    }).join('');

    // Bind mousedown for dragging & clicking master keyframe diamonds
    lane.querySelectorAll('.keyframe-diamond').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        if ((e as MouseEvent).button === 0) {
          this.startKeyframeDrag(e as MouseEvent, el as HTMLElement);
        }
      });
    });
  }

  private renderElementTracks(): void {
    const container = this.container.querySelector('.timeline-element-tracks-container') as HTMLElement;
    if (!container) return;

    const track = this.getActiveTrack();
    const keyframes = track?.keyframes || [];
    const trackWidth = this.getTrackWidth();
    const pixelsPerSec = trackWidth / this.duration;

    // Evaluate pose at playhead time for realtime header badges
    const currentPosed = interpolateJointPoses(
      keyframes,
      this.currentTime,
      this.duration,
      this.isLooping,
      this.restJoints
    );

    let html = `
      <div class="timeline-elements-header-row">
        <div class="timeline-row-header btn-toggle-all-elements" style="justify-content:space-between; cursor:pointer;" title="Click to toggle all bone element tracks">
          <span style="font-size:0.68rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:5px;">
            <span>${this.isElementTracksExpanded ? '▼' : '▶'}</span>
            <span>Bone & Element Tracks</span>
          </span>
          <div style="display:flex; gap:4px;" onclick="event.stopPropagation();">
            <button class="btn-studio btn-timeline-collapse-all" style="font-size:0.56rem; padding:1px 5px;" title="Collapse all element groups">Collapse</button>
            <button class="btn-studio btn-timeline-expand-all" style="font-size:0.56rem; padding:1px 5px;" title="Expand all element groups">Expand</button>
          </div>
        </div>
        <div class="master-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px; border-bottom:1px solid rgba(148,163,184,0.1); background:rgba(2,6,23,0.3);"></div>
      </div>
    `;

    if (this.isElementTracksExpanded) {
      for (const group of ELEMENT_GROUPS) {
        const isCollapsed = this.collapsedGroups.has(group.id);

        // Count how many joints in this group are moved from rest at current playhead
        let modifiedInGroupCount = 0;
        for (const jId of group.jointIds) {
          const rest = this.restJoints[jId] || { x: 0, y: 0 };
          const cur = currentPosed[jId] || rest;
          if (Math.hypot(cur.x - rest.x, cur.y - rest.y) >= 1) {
            modifiedInGroupCount++;
          }
        }

        html += `
          <div class="timeline-group-row">
            <div class="timeline-group-header btn-toggle-group" data-group="${group.id}">
              <span style="display:flex; align-items:center; gap:5px;">
                <span>${isCollapsed ? '▶' : '▼'}</span>
                <span>${group.icon} ${group.name}</span>
                <span style="font-size:0.55rem; color:#64748b; font-weight:500;">(${group.jointIds.length})</span>
              </span>
              <span style="font-size:0.55rem; color:${modifiedInGroupCount > 0 ? '#38bdf8' : '#64748b'}; font-weight:600;">
                ${modifiedInGroupCount > 0 ? `${modifiedInGroupCount} active` : 'Rest'}
              </span>
            </div>
            <div class="master-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px; background:rgba(15,23,42,0.3);"></div>
          </div>
        `;

        if (!isCollapsed) {
          for (const jointId of group.jointIds) {
            const jointDef = ANATOMICAL_JOINTS.find(j => j.id === jointId) || {
              id: jointId,
              name: jointId,
              color: '#38bdf8'
            };

            const rest = this.restJoints[jointId] || { x: 0, y: 0 };
            const cur = currentPosed[jointId] || rest;
            const curDx = Math.round(cur.x - rest.x);
            const curDy = Math.round(cur.y - rest.y);
            const curDist = Math.round(Math.hypot(curDx, curDy));
            const isCurMoved = curDist >= 1;

            html += `
              <div class="timeline-element-row" data-joint="${jointId}">
                <div class="timeline-element-header" title="${jointDef.name} (${jointId})">
                  <span style="display:flex; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis;">
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${jointDef.color}; flex-shrink:0;"></span>
                    <span style="overflow:hidden; text-overflow:ellipsis;">${jointDef.name}</span>
                  </span>
                  <span class="element-change-badge ${isCurMoved ? 'moved' : 'rest'}">
                    ${isCurMoved ? `Δ ${curDx >= 0 ? '+' : ''}${curDx}, ${curDy >= 0 ? '+' : ''}${curDy}` : 'Rest'}
                  </span>
                </div>
                <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                  ${keyframes.map((k, idx) => {
                    const leftPx = Math.round(k.time * pixelsPerSec);
                    const pos = k.joints[jointId] || rest;
                    const dx = Math.round(pos.x - rest.x);
                    const dy = Math.round(pos.y - rest.y);
                    const dist = Math.round(Math.hypot(dx, dy));
                    const isModified = dist >= 1;

                    const prevK = idx > 0 ? keyframes[idx - 1] : undefined;
                    const prevPos = prevK ? (prevK.joints[jointId] || rest) : undefined;
                    const pdx = prevPos ? Math.round(pos.x - prevPos.x) : 0;
                    const pdy = prevPos ? Math.round(pos.y - prevPos.y) : 0;

                    const desc = `${jointDef.name} @ ${k.time.toFixed(2)}s:\n` +
                      `• Pos: (${Math.round(pos.x)}, ${Math.round(pos.y)})\n` +
                      `• Shift from Rest: X: ${dx >= 0 ? '+' : ''}${dx}px, Y: ${dy >= 0 ? '+' : ''}${dy}px (${isModified ? `${dist}px offset` : 'At Rest'})\n` +
                      (prevPos ? `• Δ from Prev Keyframe: X: ${pdx >= 0 ? '+' : ''}${pdx}px, Y: ${pdy >= 0 ? '+' : ''}${pdy}px\n` : '') +
                      `[Click to jump / Drag to move keyframe]`;

                    return `
                      <div class="element-key-marker ${isModified ? 'modified' : 'at-rest'}"
                        data-index="${idx}"
                        data-time="${k.time}"
                        data-joint="${jointId}"
                        title="${desc}"
                        style="left:${leftPx - 5}px; background:${jointDef.color};">
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }
        }
      }
    }

    container.innerHTML = html;

    // Bind element tracks toggle events
    container.querySelector('.btn-toggle-all-elements')?.addEventListener('click', () => {
      this.toggleElementTracks();
    });

    container.querySelector('.btn-timeline-collapse-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapseAllElementGroups();
    });

    container.querySelector('.btn-timeline-expand-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandAllElementGroups();
    });

    container.querySelectorAll('.btn-toggle-group').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = btn.getAttribute('data-group')!;
        this.toggleElementGroup(gid);
      });
    });

    // Bind marker clicks / drag starts
    container.querySelectorAll('.element-key-marker').forEach(marker => {
      marker.addEventListener('mousedown', (e) => {
        if ((e as MouseEvent).button === 0) {
          this.startKeyframeDrag(e as MouseEvent, marker as HTMLElement);
        }
      });
    });
  }

  private startKeyframeDrag(e: MouseEvent, targetEl: HTMLElement): void {
    e.stopPropagation();
    e.preventDefault();
    const idx = parseInt(targetEl.getAttribute('data-index')!, 10);
    const track = this.getActiveTrack();
    if (!track || !track.keyframes[idx]) return;

    this.isDraggingKeyframe = true;
    this.draggedKeyframeIndex = idx;
    this.dragStartClientX = e.clientX;
    this.dragStartTime = track.keyframes[idx].time;
    this.hasDraggedKeyframe = false;

    this.selectedKeyframeIndex = idx;
    targetEl.classList.add('dragging');

    // Create or show drag badge
    let badge = document.querySelector('.timeline-drag-badge') as HTMLElement | null;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'timeline-drag-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = `${this.dragStartTime.toFixed(2)}s`;
    badge.style.display = 'block';
    badge.style.left = `${e.clientX}px`;
    badge.style.top = `${e.clientY - 24}px`;
    this.dragGhostElement = badge;
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

    // Realtime update of element track headers' change badges
    const track = this.getActiveTrack();
    if (track && this.isElementTracksExpanded) {
      const currentPosed = interpolateJointPoses(
        track.keyframes,
        this.currentTime,
        this.duration,
        this.isLooping,
        this.restJoints
      );
      this.container.querySelectorAll('.timeline-element-row').forEach(row => {
        const jointId = row.getAttribute('data-joint') as AnatomicalJointId;
        const badge = row.querySelector('.element-change-badge');
        if (jointId && badge && currentPosed[jointId]) {
          const rest = this.restJoints[jointId] || { x: 0, y: 0 };
          const pos = currentPosed[jointId];
          const dx = Math.round(pos.x - rest.x);
          const dy = Math.round(pos.y - rest.y);
          const isMoved = Math.hypot(dx, dy) >= 1;
          badge.className = `element-change-badge ${isMoved ? 'moved' : 'rest'}`;
          badge.textContent = isMoved ? `Δ ${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy}` : 'Rest';
        }
      });
    }
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

    // Duration / Length Input
    const durInput = this.container.querySelector('.input-timeline-duration') as HTMLInputElement | null;
    durInput?.addEventListener('change', () => {
      const val = parseFloat(durInput.value);
      if (!isNaN(val) && val > 0) {
        this.setDuration(val);
      } else {
        durInput.value = this.duration.toFixed(2);
      }
    });
    durInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        durInput.blur();
      }
    });

    // Zoom Controls
    this.container.querySelector('.btn-timeline-zoom-in')?.addEventListener('click', () => {
      this.zoomIn();
    });
    this.container.querySelector('.btn-timeline-zoom-out')?.addEventListener('click', () => {
      this.zoomOut();
    });
    this.container.querySelector('.btn-timeline-zoom-reset')?.addEventListener('click', () => {
      this.resetZoom();
    });

    // Height Presets (S / M / L)
    this.container.querySelector('.btn-timeline-height-s')?.addEventListener('click', () => {
      this.events.onHeightPresetRequested?.(140);
    });
    this.container.querySelector('.btn-timeline-height-m')?.addEventListener('click', () => {
      this.events.onHeightPresetRequested?.(220);
    });
    this.container.querySelector('.btn-timeline-height-l')?.addEventListener('click', () => {
      this.events.onHeightPresetRequested?.(360);
    });

    // MouseWheel Zooming (Ctrl / Meta + Wheel)
    const viewport = this.container.querySelector('.timeline-viewport') as HTMLElement | null;
    viewport?.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      }
    }, { passive: false });

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

    // Copy Keyframe button
    this.container.querySelector('.btn-timeline-copy-key')?.addEventListener('click', () => {
      this.copyKeyframe();
    });

    // Paste Keyframe button
    this.container.querySelector('.btn-timeline-paste-key')?.addEventListener('click', () => {
      this.pasteKeyframe();
    });

    // Close Cycle button
    this.container.querySelector('.btn-timeline-close-cycle')?.addEventListener('click', () => {
      this.closeCycle();
    });

    // Kinematics toggle button
    this.container.querySelector('.btn-timeline-kinematics')?.addEventListener('click', () => {
      const newMode = this.kinematicsMode === 'fk' ? 'ik' : 'fk';
      this.setKinematicsMode(newMode);
      this.events.onKinematicsModeChanged?.(newMode);
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
      } else if (this.isDraggingKeyframe && this.draggedKeyframeIndex !== null) {
        const dx = e.clientX - this.dragStartClientX;
        if (Math.abs(dx) > 3) {
          this.hasDraggedKeyframe = true;
        }
        if (this.hasDraggedKeyframe) {
          const track = this.getActiveTrack();
          if (track && track.keyframes[this.draggedKeyframeIndex]) {
            const trackWidth = this.getTrackWidth();
            const pixelsPerSec = trackWidth / this.duration;
            const dt = dx / pixelsPerSec;
            let newTime = Math.max(0, Math.min(this.duration, this.dragStartTime + dt));
            newTime = Math.round(newTime * 100) / 100;

            const kf = track.keyframes[this.draggedKeyframeIndex];
            kf.time = newTime;
            this.currentTime = newTime;

            if (this.dragGhostElement) {
              this.dragGhostElement.textContent = `${newTime.toFixed(2)}s`;
              this.dragGhostElement.style.left = `${e.clientX}px`;
              this.dragGhostElement.style.top = `${e.clientY - 24}px`;
            }

            // Visual feedback on playhead
            this.updatePlayheadPosition();
            this.evaluatePoseAtCurrentTime();
          }
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingPlayhead) {
        this.isDraggingPlayhead = false;
      }

      if (this.isDraggingKeyframe) {
        if (this.dragGhostElement) {
          this.dragGhostElement.remove();
          this.dragGhostElement = null;
        }

        const track = this.getActiveTrack();
        if (track && this.draggedKeyframeIndex !== null && track.keyframes[this.draggedKeyframeIndex]) {
          const kf = track.keyframes[this.draggedKeyframeIndex];
          if (this.hasDraggedKeyframe) {
            const oldTime = this.dragStartTime;
            const newTime = kf.time;
            track.keyframes.sort((a, b) => a.time - b.time);
            this.selectedKeyframeIndex = track.keyframes.indexOf(kf);

            this.events.onKeyframeMoved?.(this.selectedKeyframeIndex, oldTime, newTime);
            this.renderRuler();
            this.renderKeyframeTrack();
            this.renderElementTracks();
            this.updatePlayheadPosition();
          } else {
            // Click without dragging
            this.setTime(kf.time);
            this.renderKeyframeTrack();
            this.renderElementTracks();
            this.events.onKeyframeSelected?.(this.draggedKeyframeIndex, kf);
          }
        }

        this.container.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        this.isDraggingKeyframe = false;
        this.draggedKeyframeIndex = null;
        this.hasDraggedKeyframe = false;
      }
    });

    // Global timeline keyboard shortcuts (Space: play/pause, Del: delete, Ctrl+C: copy, Ctrl+V: paste, K: kinematics)
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this.copyKeyframe();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        this.pasteKeyframe();
      } else if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const newMode = this.kinematicsMode === 'fk' ? 'ik' : 'fk';
        this.setKinematicsMode(newMode);
        this.events.onKinematicsModeChanged?.(newMode);
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
    if (this.dragGhostElement) this.dragGhostElement.remove();
  }
}
