import {
  AnatomicalJointId,
  StudioAnimationDefinition,
  StudioKeyframe,
  StudioSideTrack,
  StudioView,
  BonePropertyKey,
  BonePropertyValues,
  FacialPoseData,
  VisemePreset
} from '../types';
import { ANATOMICAL_JOINTS } from '../rigging/AnatomicalRig';

export interface KeyframeTimelineEvents {
  onPoseInterpolated?: (joints: Record<AnatomicalJointId, { x: number; y: number }>) => void;
  onTimeChange?: (time: number) => void;
  onPlayToggle?: (isPlaying: boolean) => void;
  onKeyframeAdded?: (time: number, joints: Record<AnatomicalJointId, { x: number; y: number }>, jointId?: AnatomicalJointId) => void;
  onKeyframeDeleted?: (index: number, jointId?: AnatomicalJointId) => void;
  onKeyframeMoved?: (index: number, oldTime: number, newTime: number, jointId?: AnatomicalJointId) => void;
  onKeyframeCopied?: (keyframe: { name?: string; joints: Record<AnatomicalJointId, { x: number; y: number }> }) => void;
  onKeyframePasted?: (time: number, keyframe: StudioKeyframe) => void;
  onCycleClosed?: (duration: number) => void;
  onAnimationSelected?: (animName: string) => void;
  onRequestNewAnimation?: () => void;
  onAutoKeyToggled?: (enabled: boolean) => void;
  onEnableSideRequested?: (animName: string, side: StudioView) => void;
  onDurationChanged?: (duration: number) => void;
  onZoomChanged?: (zoom: number) => void;
  onKeyframeSelected?: (index: number, keyframe: StudioKeyframe | null, jointId?: AnatomicalJointId) => void;
  onSelectionChanged?: (selectedCount: number) => void;
  onKinematicsModeChanged?: (mode: 'ik' | 'fk') => void;
  onHeightPresetRequested?: (height: number) => void;
  onRequestEyeSetupWizard?: () => void;
  onRequestMouthSetupWizard?: () => void;
}

export interface MultiClipboardItem {
  relTime: number;
  jointId?: AnatomicalJointId;
  propKey?: BonePropertyKey;
  propValue?: number;
  pos?: { x: number; y: number };
  joints?: Record<AnatomicalJointId, { x: number; y: number }>;
  name?: string;
}

export interface DraggingKeyEntry {
  keyId: string;
  originalTime: number;
  jointId?: AnatomicalJointId;
  propKey?: BonePropertyKey;
  propValue?: number;
  pos?: { x: number; y: number };
  joints?: Record<AnatomicalJointId, { x: number; y: number }>;
  name?: string;
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

export const JOINT_LIMB_ALIASES: Partial<Record<AnatomicalJointId, string>> = {
  hip_l: 'Hip L (Thigh)',
  hip_r: 'Hip R (Thigh)',
  knee_l: 'Knee L (Calf)',
  knee_r: 'Knee R (Calf)',
  shoulder_l: 'Shoulder L (Arm)',
  shoulder_r: 'Shoulder R (Arm)',
  elbow_l: 'Elbow L (Forearm)',
  elbow_r: 'Elbow R (Forearm)',
  wrist_l: 'Wrist L (Hand)',
  wrist_r: 'Wrist R (Hand)',
  chest: 'Chest (Torso)',
  ankle_l: 'Ankle L (Foot)',
  ankle_r: 'Ankle R (Foot)',
  foot_l: 'Foot L (Tip)',
  foot_r: 'Foot R (Tip)'
};

/**
 * Helper to interpolate a single scalar channel (e.g. Position X, Position Y, Rotation, Scale) across keyframe markers.
 */
export function interpolateScalarChannel(
  keys: { time: number; val: number }[],
  time: number,
  duration: number,
  loop = true,
  fallbackVal = 0
): number {
  if (!keys || keys.length === 0) return fallbackVal;
  if (keys.length === 1) return keys[0].val;

  const clampedTime = loop && duration > 0
    ? (time % duration)
    : Math.max(0, Math.min(duration, time));

  if (clampedTime <= keys[0].time) {
    if (!loop || keys[keys.length - 1].time <= keys[0].time) {
      return keys[0].val;
    }
    const k0 = keys[keys.length - 1];
    const k1 = keys[0];
    const segmentDuration = (duration - k0.time) + k1.time;
    if (segmentDuration <= 0) return keys[0].val;
    const tInSeg = clampedTime + (duration - k0.time);
    const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
    const ease = alpha * alpha * (3 - 2 * alpha);
    return k0.val + (k1.val - k0.val) * ease;
  }

  if (clampedTime >= keys[keys.length - 1].time) {
    if (!loop) return keys[keys.length - 1].val;
    const k0 = keys[keys.length - 1];
    const k1 = keys[0];
    const segmentDuration = (duration - k0.time) + k1.time;
    if (segmentDuration <= 0) return keys[keys.length - 1].val;
    const tInSeg = clampedTime - k0.time;
    const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
    const ease = alpha * alpha * (3 - 2 * alpha);
    return k0.val + (k1.val - k0.val) * ease;
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (clampedTime >= k0.time && clampedTime <= k1.time) {
      const dt = k1.time - k0.time;
      const alpha = dt > 0 ? (clampedTime - k0.time) / dt : 0;
      const ease = alpha * alpha * (3 - 2 * alpha);
      return k0.val + (k1.val - k0.val) * ease;
    }
  }

  return keys[0].val;
}

/**
 * Computes rotation angle (relative to rest pose) and bone stretch factor.
 */
export function getBoneMetrics(
  jointId: AnatomicalJointId,
  joints: Record<string, { x: number; y: number }>,
  restJoints: Record<string, { x: number; y: number }>
): { rotDeg: number; scale: number } {
  const targetMap: Partial<Record<AnatomicalJointId, AnatomicalJointId>> = {
    hip_l: 'knee_l',
    knee_l: 'ankle_l',
    ankle_l: 'foot_l',
    hip_r: 'knee_r',
    knee_r: 'ankle_r',
    ankle_r: 'foot_r',
    shoulder_l: 'elbow_l',
    elbow_l: 'wrist_l',
    wrist_l: 'hand_l',
    shoulder_r: 'elbow_r',
    elbow_r: 'wrist_r',
    wrist_r: 'hand_r',
    neck: 'head',
    chest: 'neck',
  };

  const tgtId = targetMap[jointId];
  const p1 = joints[jointId];
  const p2 = tgtId ? joints[tgtId] : undefined;
  const r1 = restJoints[jointId];
  const r2 = tgtId ? restJoints[tgtId] : undefined;

  if (!p1 || !p2 || !r1 || !r2) {
    return { rotDeg: 0, scale: 1.0 };
  }

  const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const restAngle = Math.atan2(r2.y - r1.y, r2.x - r1.x);
  let diff = (curAngle - restAngle) * (180 / Math.PI);
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  const curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const restLen = Math.hypot(r2.x - r1.x, r2.y - r1.y) || 1;
  const scale = Math.round((curLen / restLen) * 100) / 100;

  return {
    rotDeg: Math.round(diff * 10) / 10,
    scale
  };
}

/**
 * Interpolates joint positions smoothly between keyframes across time.
 * Evaluates each joint independently against its own keyed timestamps,
 * allowing fine-tuned independent track keyframing while seamlessly preserving full-body poses.
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

  // Find all jointIds present in fallbackJoints and in any keyframe
  const allJointIds = new Set<AnatomicalJointId>([
    ...(Object.keys(fallbackJoints) as AnatomicalJointId[])
  ]);
  for (const kf of keyframes) {
    if (kf.joints) {
      for (const jId of Object.keys(kf.joints) as AnatomicalJointId[]) {
        allJointIds.add(jId);
      }
    }
  }

  const result: Record<AnatomicalJointId, { x: number; y: number }> = {} as any;
  const clampedTime = loop && duration > 0
    ? (time % duration)
    : Math.max(0, Math.min(duration, time));

  for (const jId of allJointIds) {
    const fallbackPos = fallbackJoints[jId] || { x: 0, y: 0 };

    // Check if property-level channel keyframes exist for this joint
    const hasCustomProps = keyframes.some(k => k.boneProps?.[jId] !== undefined);
    if (hasCustomProps) {
      const xKeys = keyframes
        .filter(k => {
          if (k.boneProps && k.boneProps[jId] !== undefined) {
            return k.boneProps[jId]!.x !== undefined;
          }
          return k.joints && k.joints[jId] !== undefined;
        })
        .map(k => ({ time: k.time, val: (k.boneProps?.[jId]?.x !== undefined) ? k.boneProps[jId]!.x! : k.joints[jId].x }))
        .sort((a, b) => a.time - b.time);

      const yKeys = keyframes
        .filter(k => {
          if (k.boneProps && k.boneProps[jId] !== undefined) {
            return k.boneProps[jId]!.y !== undefined;
          }
          return k.joints && k.joints[jId] !== undefined;
        })
        .map(k => ({ time: k.time, val: (k.boneProps?.[jId]?.y !== undefined) ? k.boneProps[jId]!.y! : k.joints[jId].y }))
        .sort((a, b) => a.time - b.time);

      const posX = interpolateScalarChannel(xKeys, clampedTime, duration, loop, fallbackPos.x);
      const posY = interpolateScalarChannel(yKeys, clampedTime, duration, loop, fallbackPos.y);

      result[jId] = { x: posX, y: posY };
      continue;
    }

    // Find all keyframes containing this specific joint
    const jKeys = keyframes
      .filter(k => k.joints && k.joints[jId] !== undefined)
      .sort((a, b) => a.time - b.time);

    if (jKeys.length === 0) {
      result[jId] = { ...fallbackPos };
      continue;
    }

    if (jKeys.length === 1) {
      result[jId] = { ...jKeys[0].joints[jId] };
      continue;
    }

    // Multiple keyframes for this joint
    if (clampedTime <= jKeys[0].time) {
      if (!loop || jKeys[jKeys.length - 1].time <= jKeys[0].time) {
        result[jId] = { ...jKeys[0].joints[jId] };
      } else {
        const k0 = jKeys[jKeys.length - 1];
        const k1 = jKeys[0];
        const segmentDuration = (duration - k0.time) + k1.time;
        if (segmentDuration <= 0) {
          result[jId] = { ...jKeys[0].joints[jId] };
        } else {
          const tInSeg = clampedTime + (duration - k0.time);
          const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
          const ease = alpha * alpha * (3 - 2 * alpha);
          result[jId] = {
            x: k0.joints[jId].x + (k1.joints[jId].x - k0.joints[jId].x) * ease,
            y: k0.joints[jId].y + (k1.joints[jId].y - k0.joints[jId].y) * ease
          };
        }
      }
      continue;
    }

    if (clampedTime >= jKeys[jKeys.length - 1].time) {
      if (!loop) {
        result[jId] = { ...jKeys[jKeys.length - 1].joints[jId] };
      } else {
        const k0 = jKeys[jKeys.length - 1];
        const k1 = jKeys[0];
        const segmentDuration = (duration - k0.time) + k1.time;
        if (segmentDuration <= 0) {
          result[jId] = { ...jKeys[jKeys.length - 1].joints[jId] };
        } else {
          const tInSeg = clampedTime - k0.time;
          const alpha = Math.max(0, Math.min(1, tInSeg / segmentDuration));
          const ease = alpha * alpha * (3 - 2 * alpha);
          result[jId] = {
            x: k0.joints[jId].x + (k1.joints[jId].x - k0.joints[jId].x) * ease,
            y: k0.joints[jId].y + (k1.joints[jId].y - k0.joints[jId].y) * ease
          };
        }
      }
      continue;
    }

    // Between keyframes
    let interpolated = false;
    for (let i = 0; i < jKeys.length - 1; i++) {
      const k0 = jKeys[i];
      const k1 = jKeys[i + 1];
      if (clampedTime >= k0.time && clampedTime <= k1.time) {
        const dt = k1.time - k0.time;
        const alpha = dt > 0 ? (clampedTime - k0.time) / dt : 0;
        const ease = alpha * alpha * (3 - 2 * alpha);
        result[jId] = {
          x: k0.joints[jId].x + (k1.joints[jId].x - k0.joints[jId].x) * ease,
          y: k0.joints[jId].y + (k1.joints[jId].y - k0.joints[jId].y) * ease
        };
        interpolated = true;
        break;
      }
    }
    if (!interpolated) {
      result[jId] = { ...jKeys[0].joints[jId] };
    }
  }

  return result;
}

/**
 * Smoothly interpolates facial controls (eyebrows, eyelids, and lips) across timeline keyframes.
 */
export function interpolateFacialPose(
  keyframes: StudioKeyframe[],
  time: number,
  duration: number,
  loop = true
): FacialPoseData {
  const result: FacialPoseData = {};
  if (!keyframes || keyframes.length === 0) return result;

  const clampedTime = loop && duration > 0
    ? (time % duration)
    : Math.max(0, Math.min(duration, time));

  const scalarProps: (keyof FacialPoseData)[] = [
    'eyebrows_height_l', 'eyebrows_height_r', 'eyebrows_angle_l', 'eyebrows_angle_r', 'eyebrows_furrow',
    'eyelids_blink_l', 'eyelids_blink_r', 'eyelids_squint',
    'lips_open', 'lips_wide', 'lips_smile', 'lips_pucker', 'lips_jaw_drop',
    'browHeightL', 'browHeightR', 'browAngleL', 'browAngleR', 'browFurrow',
    'blinkL', 'blinkR', 'squint',
    'mouthOpen', 'mouthWidth', 'mouthSmile', 'mouthPucker'
  ];

  for (const prop of scalarProps) {
    const keys = keyframes
      .filter(k => k.face && (k.face as any)[prop] !== undefined)
      .map(k => ({ time: k.time, val: (k.face as any)[prop] as number }))
      .sort((a, b) => a.time - b.time);

    if (keys.length > 0) {
      (result as any)[prop] = interpolateScalarChannel(keys, clampedTime, duration, loop, 0);
    }
  }

  // Viseme is discrete: take the nearest preceding or current keyframe
  const visemeKeys = keyframes
    .filter(k => k.face && k.face.viseme !== undefined)
    .sort((a, b) => a.time - b.time);

  if (visemeKeys.length > 0) {
    if (clampedTime < visemeKeys[0].time) {
      result.viseme = loop ? visemeKeys[visemeKeys.length - 1].face!.viseme : visemeKeys[0].face!.viseme;
    } else {
      let activeViseme = visemeKeys[0].face!.viseme;
      for (const vk of visemeKeys) {
        if (clampedTime >= vk.time) {
          activeViseme = vk.face!.viseme;
        } else {
          break;
        }
      }
      result.viseme = activeViseme;
    }
  } else {
    result.viseme = 'rest';
  }

  return result;
}

export class KeyframeTimeline {
  private container: HTMLElement;
  private animations: Record<string, StudioAnimationDefinition> = {};
  private activeAnimKey = 'idle';
  private activeView: StudioView = 'front';
  private restJoints: Record<AnatomicalJointId, { x: number; y: number }> = {} as any;

  public currentTime = 0;
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
  private expandedBoneTracks: Set<AnatomicalJointId> = new Set();

  // Facial tracks state
  private isFacialTracksExpanded = true;
  private isEyebrowsExpanded = false;
  private isEyesExpanded = false;
  private isMouthExpanded = false;

  // Selected joint/track
  private selectedJointId: AnatomicalJointId | null = null;

  // Multi-keyframe selection state
  // Key ID formats:
  // "joint:${jointId}:${time.toFixed(3)}" for individual track keyframes
  // "master:${time.toFixed(3)}" for master full keyframes
  private selectedKeyframeKeys = new Set<string>();

  // Rubberband selection state
  private isRubberbanding = false;
  private rubberbandStartX = 0;
  private rubberbandStartY = 0;
  private rubberbandBoxEl: HTMLElement | null = null;
  private rubberbandInitialKeys: Set<string> | null = null;

  // Keyframe dragging state (supports multi-selection drag)
  private isDraggingKeyframes = false;
  private dragStartClientX = 0;
  private dragStartTime = 0;
  private hasDraggedKeyframe = false;
  private draggingEntries: DraggingKeyEntry[] = [];
  private dragGhostElement: HTMLElement | null = null;

  // Clipboard across animation clips and orientations (single and multi-select)
  private static clipboardKeyframe: {
    name?: string;
    joints: Record<AnatomicalJointId, { x: number; y: number }>;
  } | null = null;
  private static multiClipboard: MultiClipboardItem[] = [];

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
    this.isFacialTracksExpanded = true;
    this.renderElementTracks();
  }

  public collapseAllElementGroups(): void {
    this.isElementTracksExpanded = true;
    for (const g of ELEMENT_GROUPS) {
      this.collapsedGroups.add(g.id);
    }
    this.isFacialTracksExpanded = false;
    this.expandedBoneTracks.clear();
    this.renderElementTracks();
  }

  public toggleBoneExpanded(jointId: AnatomicalJointId, expanded?: boolean): void {
    if (expanded === true) {
      this.expandedBoneTracks.add(jointId);
    } else if (expanded === false) {
      this.expandedBoneTracks.delete(jointId);
    } else {
      if (this.expandedBoneTracks.has(jointId)) {
        this.expandedBoneTracks.delete(jointId);
      } else {
        this.expandedBoneTracks.add(jointId);
      }
    }
    this.renderElementTracks();
  }

  public isBoneExpanded(jointId: AnatomicalJointId): boolean {
    return this.expandedBoneTracks.has(jointId);
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

  public getCurrentPose(): Record<AnatomicalJointId, { x: number; y: number }> {
    const track = this.getActiveTrack();
    if (!track) return { ...this.restJoints };
    return interpolateJointPoses(track.keyframes, this.currentTime, this.duration, this.isLooping, this.restJoints);
  }

  public addKeyframe(joints: Record<AnatomicalJointId, { x: number; y: number }>, name?: string, time?: number): void {
    const track = this.getActiveTrack();
    if (!track) return;

    const t = time !== undefined ? Math.round(time * 100) / 100 : Math.round(this.currentTime * 100) / 100;
    const clonedJoints = JSON.parse(JSON.stringify(joints));

    // Check if keyframe already exists near this timestamp (threshold 0.03s)
    const existingIndex = track.keyframes.findIndex(k => Math.abs(k.time - t) < 0.03);
    if (existingIndex >= 0) {
      track.keyframes[existingIndex].joints = { ...track.keyframes[existingIndex].joints, ...clonedJoints };
      if (name) track.keyframes[existingIndex].name = name;
      this.selectedKeyframeIndex = existingIndex;
    } else {
      track.keyframes.push({ time: t, name: name || undefined, joints: clonedJoints });
      track.keyframes.sort((a, b) => a.time - b.time);
      this.selectedKeyframeIndex = track.keyframes.findIndex(k => k.time === t);
    }

    this.duration = Math.max(this.duration, t);
    track.duration = this.duration;

    this.clearSelection();
    this.selectedKeyframeKeys.add(this.makeKeyId(t));
    if (this.selectedKeyframeIndex !== null) {
      const curKf = track.keyframes[this.selectedKeyframeIndex];
      for (const jId of Object.keys(curKf.joints || {}) as AnatomicalJointId[]) {
        this.selectedKeyframeKeys.add(this.makeKeyId(t, jId));
      }
    }

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();
    this.events.onKeyframeAdded?.(t, clonedJoints);
    if (this.selectedKeyframeIndex !== null) {
      this.events.onKeyframeSelected?.(this.selectedKeyframeIndex, track.keyframes[this.selectedKeyframeIndex]);
    }
  }

  /**
   * Adds a keyframe for a specific track (joint) at the specified time or current playhead.
   */
  public addTrackKeyframe(jointId: AnatomicalJointId, pos?: { x: number; y: number }, time?: number): void {
    const track = this.getActiveTrack();
    if (!track) return;

    const t = time !== undefined ? Math.round(time * 100) / 100 : Math.round(this.currentTime * 100) / 100;

    let targetPos = pos;
    if (!targetPos) {
      const currentPosed = interpolateJointPoses(
        track.keyframes,
        t,
        this.duration,
        this.isLooping,
        this.restJoints
      );
      targetPos = currentPosed[jointId] || this.restJoints[jointId] || { x: 0, y: 0 };
    }

    const clonedPos = { x: Math.round(targetPos.x), y: Math.round(targetPos.y) };

    let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.03);
    if (kf) {
      if (!kf.joints) kf.joints = {} as any;
      kf.joints[jointId] = clonedPos;
    } else {
      kf = {
        time: t,
        joints: {
          [jointId]: clonedPos
        } as any
      };
      track.keyframes.push(kf);
      track.keyframes.sort((a, b) => a.time - b.time);
    }

    this.duration = Math.max(this.duration, t);
    track.duration = this.duration;

    this.clearSelection();
    this.selectedKeyframeKeys.add(this.makeKeyId(t, jointId));
    this.selectedKeyframeIndex = track.keyframes.indexOf(kf);

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();

    this.events.onKeyframeAdded?.(t, kf.joints, jointId);
    this.events.onKeyframeSelected?.(this.selectedKeyframeIndex, kf, jointId);
  }

  /**
   * Adds or updates a specific property keyframe (Position X, Position Y, Rotation, Scale) for a bone.
   */
  public addTrackPropertyKeyframe(
    jointId: AnatomicalJointId,
    propKey: BonePropertyKey,
    val?: number,
    time?: number
  ): void {
    const track = this.getActiveTrack();
    if (!track) return;

    const t = time !== undefined ? Math.round(time * 100) / 100 : Math.round(this.currentTime * 100) / 100;
    const currentPosed = interpolateJointPoses(
      track.keyframes,
      t,
      this.duration,
      this.isLooping,
      this.restJoints
    );

    let targetVal = val;
    if (targetVal === undefined) {
      if (propKey === 'x') targetVal = currentPosed[jointId]?.x ?? this.restJoints[jointId]?.x ?? 0;
      else if (propKey === 'y') targetVal = currentPosed[jointId]?.y ?? this.restJoints[jointId]?.y ?? 0;
      else if (propKey === 'rotation') {
        const metrics = getBoneMetrics(jointId, currentPosed, this.restJoints);
        targetVal = metrics.rotDeg;
      } else if (propKey === 'scale') {
        const metrics = getBoneMetrics(jointId, currentPosed, this.restJoints);
        targetVal = metrics.scale;
      }
    }

    const roundedVal = Math.round((targetVal ?? 0) * 100) / 100;

    let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.03);
    if (!kf) {
      const curPos = currentPosed[jointId] || this.restJoints[jointId] || { x: 0, y: 0 };
      kf = {
        time: t,
        joints: {
          [jointId]: { ...curPos }
        } as any,
        boneProps: {
          [jointId]: {
            [propKey]: roundedVal
          }
        }
      };
      track.keyframes.push(kf);
      track.keyframes.sort((a, b) => a.time - b.time);
    } else {
      if (!kf.boneProps) kf.boneProps = {};
      if (!kf.boneProps[jointId]) kf.boneProps[jointId] = {};
      kf.boneProps[jointId]![propKey] = roundedVal;
    }

    if (propKey === 'x' || propKey === 'y') {
      if (!kf.joints) kf.joints = {} as any;
      if (!kf.joints[jointId]) {
        kf.joints[jointId] = { ...(currentPosed[jointId] || this.restJoints[jointId] || { x: 0, y: 0 }) };
      }
      kf.joints[jointId][propKey] = Math.round(roundedVal);
    }

    this.duration = Math.max(this.duration, t);
    track.duration = this.duration;

    this.clearSelection();
    this.selectedKeyframeKeys.add(this.makeKeyId(t, jointId, propKey));
    this.selectedKeyframeIndex = track.keyframes.indexOf(kf);

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();

    this.events.onKeyframeAdded?.(t, kf.joints, jointId);
    this.events.onKeyframeSelected?.(this.selectedKeyframeIndex, kf, jointId);
  }

  public getCurrentFacialPose(): FacialPoseData {
    const track = this.getActiveTrack();
    if (!track) return {};
    return interpolateFacialPose(track.keyframes, this.currentTime, this.duration, this.isLooping);
  }

  public addFacialKeyframe(
    timeOrFaceValues: number | Partial<FacialPoseData>,
    maybeFaceValuesOrTime?: Partial<FacialPoseData> | number
  ): void {
    const track = this.getActiveTrack();
    if (!track) return;

    let faceValues: Partial<FacialPoseData> = {};
    let targetTime: number = this.currentTime;

    if (typeof timeOrFaceValues === 'number') {
      targetTime = timeOrFaceValues;
      if (typeof maybeFaceValuesOrTime === 'object' && maybeFaceValuesOrTime !== null) {
        faceValues = maybeFaceValuesOrTime;
      }
    } else {
      faceValues = timeOrFaceValues || {};
      if (typeof maybeFaceValuesOrTime === 'number') {
        targetTime = maybeFaceValuesOrTime;
      }
    }

    const t = Math.round(targetTime * 100) / 100;
    let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.03);
    if (!kf) {
      const currentPosed = interpolateJointPoses(
        track.keyframes,
        t,
        this.duration,
        this.isLooping,
        this.restJoints
      );
      kf = {
        time: t,
        joints: { ...currentPosed },
        face: { ...faceValues }
      };
      track.keyframes.push(kf);
      track.keyframes.sort((a, b) => a.time - b.time);
    } else {
      if (!kf.face) kf.face = {};
      Object.assign(kf.face, faceValues);
    }

    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();
  }

  public renderTimeline(): void {
    this.renderRuler();
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.updatePlayheadPosition();
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public toggleFacialTracks(expanded?: boolean): void {
    this.isFacialTracksExpanded = expanded !== undefined ? expanded : !this.isFacialTracksExpanded;
    this.renderElementTracks();
  }

  public toggleEyebrowsExpanded(expanded?: boolean): void {
    this.isEyebrowsExpanded = expanded !== undefined ? expanded : !this.isEyebrowsExpanded;
    this.renderElementTracks();
  }

  public toggleEyesExpanded(expanded?: boolean): void {
    this.isEyesExpanded = expanded !== undefined ? expanded : !this.isEyesExpanded;
    this.renderElementTracks();
  }

  public toggleMouthExpanded(expanded?: boolean): void {
    this.isMouthExpanded = expanded !== undefined ? expanded : !this.isMouthExpanded;
    this.renderElementTracks();
  }

  public makeKeyId(time: number, jointId?: AnatomicalJointId, propKey?: BonePropertyKey): string {
    if (jointId && propKey) return `prop:${jointId}:${propKey}:${time.toFixed(3)}`;
    return jointId ? `joint:${jointId}:${time.toFixed(3)}` : `master:${time.toFixed(3)}`;
  }

  public isKeyframeSelected(jointId: AnatomicalJointId, time: number, propKey?: BonePropertyKey): boolean {
    if (propKey) {
      return this.selectedKeyframeKeys.has(this.makeKeyId(time, jointId, propKey)) ||
             this.selectedKeyframeKeys.has(this.makeKeyId(time, jointId)) ||
             this.selectedKeyframeKeys.has(this.makeKeyId(time));
    }
    return this.selectedKeyframeKeys.has(this.makeKeyId(time, jointId)) ||
           this.selectedKeyframeKeys.has(this.makeKeyId(time));
  }

  public isMasterKeyframeSelected(time: number): boolean {
    return this.selectedKeyframeKeys.has(this.makeKeyId(time));
  }

  public clearSelection(): void {
    this.selectedKeyframeKeys.clear();
    this.selectedKeyframeIndex = null;
    this.events.onSelectionChanged?.(0);
  }

  public getSelectedKeyframeKeys(): string[] {
    return Array.from(this.selectedKeyframeKeys);
  }

  public setSelectedJoint(jointId: AnatomicalJointId | null): void {
    if (this.selectedJointId === jointId) return;
    this.selectedJointId = jointId;

    this.container.querySelectorAll('.timeline-element-row').forEach(row => {
      const rowJoint = row.getAttribute('data-joint');
      row.classList.toggle('active-track', rowJoint === jointId);
    });

    const trackBtn = this.container.querySelector('.btn-timeline-add-track-key') as HTMLElement | null;
    if (trackBtn) {
      const alias = jointId ? (JOINT_LIMB_ALIASES[jointId] || jointId) : 'Track Key';
      trackBtn.textContent = `🦴 ＋${alias}`;
      trackBtn.setAttribute('title', jointId ? `Add keyframe specifically for ${alias} at current playhead time` : 'Select a joint or click "+" on any track row to add a keyframe');
    }

    const resetBtn = this.container.querySelector('.btn-timeline-reset-rest') as HTMLElement | null;
    if (resetBtn) {
      const alias = jointId ? (JOINT_LIMB_ALIASES[jointId] || jointId) : 'Rest';
      resetBtn.textContent = jointId ? `↺ Reset ${alias}` : '↺ Reset Pose';
      resetBtn.setAttribute('title', jointId ? `Reset ${alias} to rest pose position at current playhead time` : 'Reset all joints to rest pose position at playhead');
    }
  }

  public getSelectedJoint(): AnatomicalJointId | null {
    return this.selectedJointId;
  }

  public selectAllKeyframes(): void {
    const track = this.getActiveTrack();
    if (!track) return;
    this.selectedKeyframeKeys.clear();
    for (const kf of track.keyframes) {
      this.selectedKeyframeKeys.add(this.makeKeyId(kf.time));
      if (kf.joints) {
        for (const jId of Object.keys(kf.joints) as AnatomicalJointId[]) {
          this.selectedKeyframeKeys.add(this.makeKeyId(kf.time, jId));
        }
      }
      if (kf.boneProps) {
        for (const jId of Object.keys(kf.boneProps) as AnatomicalJointId[]) {
          for (const pKey of Object.keys(kf.boneProps[jId] || {}) as BonePropertyKey[]) {
            this.selectedKeyframeKeys.add(this.makeKeyId(kf.time, jId, pKey));
          }
        }
      }
    }
    this.renderKeyframeTrack();
    this.renderElementTracks();
    this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
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

  public deleteSelectedKeyframes(): boolean {
    const track = this.getActiveTrack();
    if (!track) return false;

    if (this.selectedKeyframeKeys.size > 0) {
      let deletedCount = 0;
      for (const keyId of Array.from(this.selectedKeyframeKeys)) {
        if (keyId.startsWith('prop:')) {
          const parts = keyId.split(':');
          const jId = parts[1] as AnatomicalJointId;
          const pKey = parts[2] as BonePropertyKey;
          const t = parseFloat(parts[3]);
          const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (kf && kf.boneProps?.[jId]?.[pKey] !== undefined) {
            delete kf.boneProps[jId]![pKey];
            deletedCount++;
            if (Object.keys(kf.boneProps[jId]!).length === 0) {
              delete kf.boneProps[jId];
            }
          }
        } else if (keyId.startsWith('joint:')) {
          const parts = keyId.split(':');
          const jId = parts[1] as AnatomicalJointId;
          const t = parseFloat(parts[2]);
          const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (kf && kf.joints) {
            delete kf.joints[jId];
            deletedCount++;
            if (Object.keys(kf.joints).length === 0) {
              const idx = track.keyframes.indexOf(kf);
              if (idx >= 0) track.keyframes.splice(idx, 1);
            }
          }
        } else if (keyId.startsWith('master:')) {
          const t = parseFloat(keyId.split(':')[1]);
          const idx = track.keyframes.findIndex(k => Math.abs(k.time - t) < 0.005);
          if (idx >= 0) {
            track.keyframes.splice(idx, 1);
            deletedCount++;
          }
        }
      }

      this.clearSelection();
      this.renderRuler();
      this.renderKeyframeTrack();
      this.renderElementTracks();
      this.evaluatePoseAtCurrentTime();
      this.events.onKeyframeDeleted?.(0);
      return deletedCount > 0;
    }

    if (this.selectedKeyframeIndex !== null && track.keyframes[this.selectedKeyframeIndex]) {
      const idx = this.selectedKeyframeIndex;
      track.keyframes.splice(idx, 1);
      this.events.onKeyframeDeleted?.(idx);
      this.selectedKeyframeIndex = null;
      this.renderRuler();
      this.renderKeyframeTrack();
      this.renderElementTracks();
      this.evaluatePoseAtCurrentTime();
      return true;
    }

    const t = this.currentTime;
    const idx = track.keyframes.findIndex(k => Math.abs(k.time - t) < 0.04);
    if (idx >= 0) {
      track.keyframes.splice(idx, 1);
      this.events.onKeyframeDeleted?.(idx);
      this.renderRuler();
      this.renderKeyframeTrack();
      this.renderElementTracks();
      this.evaluatePoseAtCurrentTime();
      return true;
    }

    return false;
  }

  public deleteSelectedKeyframe(): void {
    this.deleteSelectedKeyframes();
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
   * Copies the keyframe at the given index, the currently selected keyframe(s),
   * or a snapshot of the current pose at the playhead.
   */
  public copyKeyframe(index?: number): boolean {
    const track = this.getActiveTrack();
    if (!track) return false;

    // Explicit index passed (e.g. from tests or API)
    if (index !== undefined && track.keyframes[index]) {
      const target = track.keyframes[index];
      KeyframeTimeline.clipboardKeyframe = {
        name: target.name,
        joints: JSON.parse(JSON.stringify(target.joints))
      };
      KeyframeTimeline.multiClipboard = [{
        relTime: 0,
        joints: JSON.parse(JSON.stringify(target.joints)),
        name: target.name
      }];
      this.events.onKeyframeCopied?.(target);
      return true;
    }

    // Multi-selected keyframes
    if (this.selectedKeyframeKeys.size > 0) {
      const items: { time: number; jointId?: AnatomicalJointId; propKey?: BonePropertyKey; propValue?: number; pos?: { x: number; y: number }; joints?: Record<AnatomicalJointId, { x: number; y: number }>; name?: string }[] = [];
      for (const keyId of this.selectedKeyframeKeys) {
        if (keyId.startsWith('prop:')) {
          const parts = keyId.split(':');
          const jId = parts[1] as AnatomicalJointId;
          const pKey = parts[2] as BonePropertyKey;
          const t = parseFloat(parts[3]);
          const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (kf && kf.boneProps?.[jId]?.[pKey] !== undefined) {
            items.push({
              time: kf.time,
              jointId: jId,
              propKey: pKey,
              propValue: kf.boneProps[jId]![pKey]
            });
          }
        } else if (keyId.startsWith('joint:')) {
          const parts = keyId.split(':');
          const jId = parts[1] as AnatomicalJointId;
          const t = parseFloat(parts[2]);
          const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (kf && kf.joints && kf.joints[jId]) {
            items.push({
              time: kf.time,
              jointId: jId,
              pos: { ...kf.joints[jId] }
            });
          }
        } else if (keyId.startsWith('master:')) {
          const t = parseFloat(keyId.split(':')[1]);
          const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (kf) {
            items.push({
              time: kf.time,
              joints: JSON.parse(JSON.stringify(kf.joints)),
              name: kf.name
            });
          }
        }
      }

      if (items.length > 0) {
        const minTime = Math.min(...items.map(it => it.time));
        KeyframeTimeline.multiClipboard = items.map(it => ({
          relTime: Math.round((it.time - minTime) * 100) / 100,
          jointId: it.jointId,
          propKey: it.propKey,
          propValue: it.propValue,
          pos: it.pos,
          joints: it.joints,
          name: it.name
        }));

        const firstWithJoints = items.find(it => it.joints);
        if (firstWithJoints && firstWithJoints.joints) {
          KeyframeTimeline.clipboardKeyframe = {
            name: firstWithJoints.name,
            joints: JSON.parse(JSON.stringify(firstWithJoints.joints))
          };
        } else if (items.length > 0) {
          const poseDict: any = {};
          for (const it of items) {
            if (it.jointId && it.pos) poseDict[it.jointId] = it.pos;
          }
          KeyframeTimeline.clipboardKeyframe = {
            joints: poseDict
          };
        }

        const notifyTarget = {
          time: minTime,
          joints: KeyframeTimeline.clipboardKeyframe?.joints || ({} as any)
        };
        this.events.onKeyframeCopied?.(notifyTarget);
        return true;
      }
    }

    // Fallback: copy pose at playhead
    const currentPosed = interpolateJointPoses(
      track.keyframes,
      this.currentTime,
      this.duration,
      this.isLooping,
      this.restJoints
    );
    const targetKeyframe = {
      time: this.currentTime,
      joints: currentPosed
    };
    KeyframeTimeline.clipboardKeyframe = {
      joints: JSON.parse(JSON.stringify(currentPosed))
    };
    KeyframeTimeline.multiClipboard = [{
      relTime: 0,
      joints: JSON.parse(JSON.stringify(currentPosed))
    }];
    this.events.onKeyframeCopied?.(targetKeyframe);
    return true;
  }

  /**
   * Pastes the copied keyframe(s) at targetTime (or current playhead position).
   * Supports multi-track keyframe pasting with relative timing preserved.
   */
  public pasteKeyframe(targetTime?: number): boolean {
    const track = this.getActiveTrack();
    if (!track) return false;

    const baseTime = targetTime !== undefined ? targetTime : this.currentTime;
    const roundedBaseTime = Math.round(baseTime * 100) / 100;

    if (KeyframeTimeline.multiClipboard && KeyframeTimeline.multiClipboard.length > 0) {
      const newSelected = new Set<string>();
      for (const item of KeyframeTimeline.multiClipboard) {
        const t = Math.max(0, Math.min(this.duration, Math.round((roundedBaseTime + item.relTime) * 100) / 100));
        if (item.jointId && item.propKey && item.propValue !== undefined) {
          let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (!kf) {
            kf = {
              time: t,
              joints: {} as any,
              boneProps: { [item.jointId]: { [item.propKey]: item.propValue } }
            };
            track.keyframes.push(kf);
          } else {
            if (!kf.boneProps) kf.boneProps = {};
            if (!kf.boneProps[item.jointId]) kf.boneProps[item.jointId] = {};
            kf.boneProps[item.jointId]![item.propKey] = item.propValue;
          }
          if (item.propKey === 'x' || item.propKey === 'y') {
            if (!kf.joints) kf.joints = {} as any;
            if (!kf.joints[item.jointId]) {
              kf.joints[item.jointId] = { ...(this.restJoints[item.jointId] || { x: 0, y: 0 }) };
            }
            kf.joints[item.jointId][item.propKey] = Math.round(item.propValue);
          }
          newSelected.add(this.makeKeyId(t, item.jointId, item.propKey));
        } else if (item.jointId && item.pos) {
          let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (!kf) {
            kf = { time: t, joints: {} as any };
            track.keyframes.push(kf);
          }
          kf.joints[item.jointId] = { ...item.pos };
          newSelected.add(this.makeKeyId(t, item.jointId));
        } else if (item.joints) {
          let kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
          if (!kf) {
            kf = { time: t, joints: JSON.parse(JSON.stringify(item.joints)), name: item.name };
            track.keyframes.push(kf);
          } else {
            kf.joints = { ...kf.joints, ...JSON.parse(JSON.stringify(item.joints)) };
            if (item.name) kf.name = item.name;
          }
          newSelected.add(this.makeKeyId(t));
        }
      }

      track.keyframes.sort((a, b) => a.time - b.time);
      this.currentTime = roundedBaseTime;
      this.selectedKeyframeKeys = newSelected;

      this.renderRuler();
      this.renderKeyframeTrack();
      this.renderElementTracks();
      this.updatePlayheadPosition();
      this.evaluatePoseAtCurrentTime();

      const lastKf = track.keyframes.find(k => Math.abs(k.time - roundedBaseTime) < 0.01) || track.keyframes[0];
      this.events.onKeyframePasted?.(roundedBaseTime, lastKf);
      return true;
    }

    if (KeyframeTimeline.clipboardKeyframe) {
      const clonedJoints = JSON.parse(JSON.stringify(KeyframeTimeline.clipboardKeyframe.joints));
      const name = KeyframeTimeline.clipboardKeyframe.name;
      this.currentTime = roundedBaseTime;
      this.addKeyframe(clonedJoints, name, roundedBaseTime);
      this.events.onKeyframePasted?.(roundedBaseTime, { time: roundedBaseTime, name, joints: clonedJoints });
      return true;
    }

    return false;
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
          <button class="tool-btn btn-timeline-add-key" title="Record full pose keyframe (all joints) at current playhead time" ${!isRelevantForView ? 'disabled' : ''}>
            🔑 ＋Key
          </button>
          <button class="tool-btn btn-timeline-add-track-key" title="${this.selectedJointId ? `Record keyframe for '${JOINT_LIMB_ALIASES[this.selectedJointId] || this.selectedJointId}' at current time` : 'Select a joint or click [+] on any track row to add a track key'}" ${!isRelevantForView ? 'disabled' : ''}>
            🦴 ${this.selectedJointId ? `＋${JOINT_LIMB_ALIASES[this.selectedJointId] || this.selectedJointId}` : '＋Track Key'}
          </button>
          <button class="tool-btn btn-timeline-reset-rest" title="${this.selectedJointId ? `Reset '${JOINT_LIMB_ALIASES[this.selectedJointId] || this.selectedJointId}' to rest position at playhead` : 'Reset all joints to rest position at playhead'}" ${!isRelevantForView ? 'disabled' : ''}>
            ↺ ${this.selectedJointId ? `Reset ${JOINT_LIMB_ALIASES[this.selectedJointId] || this.selectedJointId}` : 'Reset to Rest'}
          </button>
          <button class="tool-btn btn-timeline-copy-key" title="Copy Keyframe(s) (Ctrl+C). Copies selected markers on any track, or full pose" ${!isRelevantForView ? 'disabled' : ''}>
            📋 Copy
          </button>
          <button class="tool-btn btn-timeline-paste-key" title="Paste Keyframe(s) at Playhead (Ctrl+V)" ${!isRelevantForView ? 'disabled' : ''}>
            📄 Paste
          </button>
          <button class="tool-btn btn-timeline-close-cycle" title="Close Loop Cycle: Copy 0.00s initial pose to duration end (${this.duration.toFixed(2)}s) for seamless looping" ${!isRelevantForView ? 'disabled' : ''}>
            🔁 Close Cycle
          </button>
          <button class="tool-btn btn-timeline-del-key" title="Delete selected keyframe(s) or keyframe at current playhead (Del)" ${!isRelevantForView ? 'disabled' : ''}>
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
      const keyId = this.makeKeyId(k.time);
      const isSelected = this.selectedKeyframeKeys.has(keyId) || this.selectedKeyframeIndex === idx;
      const poseTitle = k.name ? `Pose "${k.name}" at ${k.time.toFixed(2)}s` : `Pose Keyframe at ${k.time.toFixed(2)}s`;

      return `
        <div class="keyframe-diamond ${isSelected ? 'selected' : ''}"
          data-index="${idx}"
          data-time="${k.time}"
          data-keyid="${keyId}"
          title="${poseTitle} (Click: Select / Ctrl+Click: Toggle / Shift+Click: Multi-select / Drag: Move)"
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
          this.handleMasterDiamondMouseDown(e as MouseEvent, el as HTMLElement);
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
            const displayName = JOINT_LIMB_ALIASES[jointId] || jointDef.name;

            const rest = this.restJoints[jointId] || { x: 0, y: 0 };
            const cur = currentPosed[jointId] || rest;
            const curDx = Math.round(cur.x - rest.x);
            const curDy = Math.round(cur.y - rest.y);
            const curDist = Math.round(Math.hypot(curDx, curDy));
            const isCurMoved = curDist >= 1;

            const jointKeyframes = keyframes.filter(k => (k.joints && k.joints[jointId] !== undefined) || (k.boneProps && k.boneProps[jointId] !== undefined));
            const isTrackActive = this.selectedJointId === jointId;
            const isBoneExpanded = this.expandedBoneTracks.has(jointId);

            html += `
              <div class="timeline-element-row ${isTrackActive ? 'active-track' : ''}" data-joint="${jointId}">
                <div class="timeline-element-header" data-joint="${jointId}" title="${displayName} (${jointId}) - Click to select track">
                  <span style="display:flex; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis;">
                    <button class="btn-toggle-bone-props" data-joint="${jointId}" title="Toggle property channels (X, Y, Rotation, Scale)">${isBoneExpanded ? '▼' : '▶'}</button>
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${jointDef.color}; flex-shrink:0;"></span>
                    <span style="overflow:hidden; text-overflow:ellipsis; font-weight:${isTrackActive ? '700' : '500'};">${displayName}</span>
                  </span>
                  <div style="display:flex; align-items:center; gap:3px;">
                    <span class="element-change-badge ${isCurMoved ? 'moved' : 'rest'}" title="${isCurMoved ? `Offset from rest: X ${curDx >= 0 ? '+' : ''}${curDx}px, Y ${curDy >= 0 ? '+' : ''}${curDy}px` : 'At rest position'}">
                      ${isCurMoved ? `Δ ${curDx >= 0 ? '+' : ''}${curDx}, ${curDy >= 0 ? '+' : ''}${curDy}` : 'Rest'}
                    </span>
                    <button class="btn-track-reset-key" data-joint="${jointId}" title="Reset ${displayName} to rest position at playhead (${this.currentTime.toFixed(2)}s)" style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border:none; background:#334155; color:#94a3b8; border-radius:3px; font-size:0.65rem; cursor:pointer; line-height:1;" onmouseover="this.style.background='#dc2626';this.style.color='#fff';" onmouseout="this.style.background='#334155';this.style.color='#94a3b8';">↺</button>
                    <button class="btn-track-add-key" data-joint="${jointId}" title="Add keyframe specifically for ${displayName} at playhead (${this.currentTime.toFixed(2)}s)">＋</button>
                  </div>
                </div>
                <div class="element-track-lane" data-joint="${jointId}" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                  ${jointKeyframes.map((k) => {
                    const leftPx = Math.round(k.time * pixelsPerSec);
                    const keyId = this.makeKeyId(k.time, jointId);
                    const isSelected = this.selectedKeyframeKeys.has(keyId) || this.selectedKeyframeKeys.has(this.makeKeyId(k.time));
                    const pos = k.joints?.[jointId] || rest;
                    const dx = Math.round(pos.x - rest.x);
                    const dy = Math.round(pos.y - rest.y);
                    const dist = Math.round(Math.hypot(dx, dy));
                    const isModified = dist >= 1;

                    const desc = `${displayName} @ ${k.time.toFixed(2)}s:\n` +
                      `• Pos: (${Math.round(pos.x)}, ${Math.round(pos.y)})\n` +
                      `• Shift from Rest: X: ${dx >= 0 ? '+' : ''}${dx}px, Y: ${dy >= 0 ? '+' : ''}${dy}px (${isModified ? `${dist}px offset` : 'At Rest'})\n` +
                      `[Click: Select / Ctrl+Click: Toggle / Shift+Click: Multi-select / Drag: Move]`;

                    return `
                      <div class="element-key-marker ${isSelected ? 'selected' : ''} ${isModified ? 'modified' : 'at-rest'}"
                        data-time="${k.time}"
                        data-joint="${jointId}"
                        data-keyid="${keyId}"
                        title="${desc}"
                        style="left:${leftPx - 5}px; background:${jointDef.color};">
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;

            if (isBoneExpanded) {
              const metrics = getBoneMetrics(jointId, currentPosed, this.restJoints);
              const propSubtracks: { key: BonePropertyKey; name: string; colorClass: string; icon: string; curValText: string }[] = [
                { key: 'x', name: 'Pos X', colorClass: 'prop-x', icon: '🔴', curValText: `X: ${curDx >= 0 ? '+' : ''}${curDx}px` },
                { key: 'y', name: 'Pos Y', colorClass: 'prop-y', icon: '🟢', curValText: `Y: ${curDy >= 0 ? '+' : ''}${curDy}px` },
                { key: 'rotation', name: 'Rotation', colorClass: 'prop-rotation', icon: '🔵', curValText: `${metrics.rotDeg > 0 ? '+' : ''}${metrics.rotDeg}°` },
                { key: 'scale', name: 'Scale', colorClass: 'prop-scale', icon: '🟠', curValText: `${metrics.scale}x` }
              ];

              for (const sub of propSubtracks) {
                html += `
                  <div class="timeline-element-row property-subtrack" data-joint="${jointId}" data-prop="${sub.key}">
                    <div class="timeline-element-header" data-joint="${jointId}" data-prop="${sub.key}" title="${displayName} - ${sub.name}">
                      <span style="display:flex; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis;">
                        <span style="font-size:0.6rem;">${sub.icon}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${sub.name}</span>
                      </span>
                      <div style="display:flex; align-items:center; gap:3px;">
                        <span class="element-change-badge rest" style="font-size:0.52rem; padding:1px 3px;">
                          ${sub.curValText}
                        </span>
                        <button class="btn-track-prop-reset-key" data-joint="${jointId}" data-prop="${sub.key}" title="Reset ${sub.name} to rest value at playhead" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#94a3b8; border-radius:3px; font-size:0.6rem; cursor:pointer; line-height:1;" onmouseover="this.style.background='#dc2626';this.style.color='#fff';" onmouseout="this.style.background='#334155';this.style.color='#94a3b8';">↺</button>
                        <button class="btn-track-prop-add-key" data-joint="${jointId}" data-prop="${sub.key}" title="Add keyframe specifically for ${displayName} ${sub.name} at playhead (${this.currentTime.toFixed(2)}s)" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#38bdf8; border-radius:3px; font-size:0.6rem; cursor:pointer; line-height:1;">＋</button>
                      </div>
                    </div>
                    <div class="element-track-lane" data-joint="${jointId}" data-prop="${sub.key}" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                      ${keyframes.filter(k => k.boneProps?.[jointId]?.[sub.key] !== undefined).map(k => {
                        const leftPx = Math.round(k.time * pixelsPerSec);
                        const keyId = this.makeKeyId(k.time, jointId, sub.key);
                        const isSelected = this.selectedKeyframeKeys.has(keyId) || this.selectedKeyframeKeys.has(this.makeKeyId(k.time, jointId)) || this.selectedKeyframeKeys.has(this.makeKeyId(k.time));
                        const val = k.boneProps![jointId]![sub.key];
                        const desc = `${displayName} [${sub.name}] @ ${k.time.toFixed(2)}s: ${val}\n[Click: Select / Drag: Move]`;
                        return `
                          <div class="element-key-marker prop-marker ${sub.colorClass} ${isSelected ? 'selected' : ''}"
                            data-time="${k.time}"
                            data-joint="${jointId}"
                            data-prop="${sub.key}"
                            data-keyid="${keyId}"
                            title="${desc}"
                            style="left:${leftPx - 4}px;">
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
      }

      // Facial Controls Track Group
    const currentFace = this.getCurrentFacialPose();
    html += `
      <div class="timeline-group-row">
        <div class="timeline-group-header btn-toggle-facial-group" style="cursor:pointer;" title="Toggle Facial Controls (Eyebrows, Eyes, Mouth)">
          <span style="display:flex; align-items:center; gap:5px;">
            <span>${this.isFacialTracksExpanded ? '▼' : '▶'}</span>
            <span>🎭 Facial Controls</span>
            <span style="font-size:0.55rem; color:#64748b; font-weight:500;">(Visemes & Expressions)</span>
          </span>
          <span style="font-size:0.55rem; color:#38bdf8; font-weight:600;">
            ${currentFace.viseme ? `[${currentFace.viseme}]` : 'Neutral'}
          </span>
        </div>
        <div class="master-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px; background:rgba(15,23,42,0.3);"></div>
      </div>
    `;

    if (this.isFacialTracksExpanded) {
      // 1. Eyebrows Row
      html += `
        <div class="timeline-element-row">
          <div class="timeline-element-header" title="Eyebrow height, tilt, and furrow">
            <span style="display:flex; align-items:center; gap:5px;">
              <button class="btn-toggle-eyebrows" style="border:none; background:transparent; color:#64748b; font-size:0.55rem; cursor:pointer;">${this.isEyebrowsExpanded ? '▼' : '▶'}</button>
              <span>🤨 Eyebrows</span>
            </span>
            <div style="display:flex; align-items:center; gap:3px;">
              <button class="btn-face-prop-reset" data-facetype="brow" title="Reset eyebrows to neutral" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#94a3b8; border-radius:3px; font-size:0.6rem; cursor:pointer;">↺</button>
              <button class="btn-face-prop-add" data-facetype="brow" title="Add eyebrow keyframe at playhead" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#38bdf8; border-radius:3px; font-size:0.6rem; cursor:pointer;">＋</button>
            </div>
          </div>
          <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
            ${keyframes.filter(k => k.face && (k.face.browHeightL !== undefined || k.face.browAngleL !== undefined || k.face.browFurrow !== undefined)).map(k => {
              const leftPx = Math.round(k.time * pixelsPerSec);
              return `<div class="element-key-marker prop-marker prop-x" data-time="${k.time}" title="Eyebrows @ ${k.time.toFixed(2)}s" style="left:${leftPx - 4}px; background:#fbbf24 !important;"></div>`;
            }).join('')}
          </div>
        </div>
      `;

      if (this.isEyebrowsExpanded) {
        const browSubtracks: { key: keyof FacialPoseData; name: string; curVal: number }[] = [
          { key: 'browHeightL', name: 'Height L', curVal: currentFace.browHeightL || 0 },
          { key: 'browHeightR', name: 'Height R', curVal: currentFace.browHeightR || 0 },
          { key: 'browAngleL', name: 'Angle / Slant', curVal: currentFace.browAngleL || 0 },
          { key: 'browFurrow', name: 'Furrow', curVal: currentFace.browFurrow || 0 }
        ];
        for (const sub of browSubtracks) {
          html += `
            <div class="timeline-element-row property-subtrack">
              <div class="timeline-element-header" style="padding-left:28px;">
                <span>• ${sub.name}</span>
                <span class="element-change-badge rest" style="font-size:0.52rem;">${sub.curVal.toFixed(1)}</span>
              </div>
              <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                ${keyframes.filter(k => k.face && (k.face as any)[sub.key] !== undefined).map(k => {
                  const leftPx = Math.round(k.time * pixelsPerSec);
                  return `<div class="element-key-marker prop-marker" data-time="${k.time}" style="left:${leftPx - 4}px; background:#fbbf24 !important;"></div>`;
                }).join('')}
              </div>
            </div>
          `;
        }
      }

      // 2. Eyes & Eyelids Row
      html += `
        <div class="timeline-element-row">
          <div class="timeline-element-header" title="Eye blinking, winking, and squinting">
            <span style="display:flex; align-items:center; gap:5px;">
              <button class="btn-toggle-eyes" style="border:none; background:transparent; color:#64748b; font-size:0.55rem; cursor:pointer;">${this.isEyesExpanded ? '▼' : '▶'}</button>
              <span>👀 Eyes & Eyelids</span>
            </span>
            <div style="display:flex; align-items:center; gap:3px;">
              <button class="btn-studio btn-open-eye-wizard" style="font-size:0.55rem; padding:1px 5px; color:#38bdf8;" title="Open Eye Setup Wizard (Choose mode: Sclera Window, Sprite Swap, or Procedural)">Setup Eyes...</button>
              <button class="btn-face-prop-reset" data-facetype="eyes" title="Reset eyes to open" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#94a3b8; border-radius:3px; font-size:0.6rem; cursor:pointer;">↺</button>
              <button class="btn-face-prop-add" data-facetype="eyes" title="Add blink keyframe at playhead" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#38bdf8; border-radius:3px; font-size:0.6rem; cursor:pointer;">＋</button>
            </div>
          </div>
          <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
            ${keyframes.filter(k => k.face && (k.face.blinkL !== undefined || k.face.squint !== undefined)).map(k => {
              const leftPx = Math.round(k.time * pixelsPerSec);
              return `<div class="element-key-marker prop-marker" data-time="${k.time}" title="Blink @ ${k.time.toFixed(2)}s" style="left:${leftPx - 4}px; background:#38bdf8 !important;"></div>`;
            }).join('')}
          </div>
        </div>
      `;

      if (this.isEyesExpanded) {
        const eyeSubtracks: { key: keyof FacialPoseData; name: string; curVal: number }[] = [
          { key: 'blinkL', name: 'Blink Left', curVal: currentFace.blinkL || 0 },
          { key: 'blinkR', name: 'Blink Right', curVal: currentFace.blinkR || 0 },
          { key: 'squint', name: 'Squint', curVal: currentFace.squint || 0 }
        ];
        for (const sub of eyeSubtracks) {
          html += `
            <div class="timeline-element-row property-subtrack">
              <div class="timeline-element-header" style="padding-left:28px;">
                <span>• ${sub.name}</span>
                <span class="element-change-badge rest" style="font-size:0.52rem;">${Math.round(sub.curVal * 100)}%</span>
              </div>
              <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                ${keyframes.filter(k => k.face && (k.face as any)[sub.key] !== undefined).map(k => {
                  const leftPx = Math.round(k.time * pixelsPerSec);
                  return `<div class="element-key-marker prop-marker" data-time="${k.time}" style="left:${leftPx - 4}px; background:#38bdf8 !important;"></div>`;
                }).join('')}
              </div>
            </div>
          `;
        }
      }

      // 3. Mouth & Lips Row
      html += `
        <div class="timeline-element-row">
          <div class="timeline-element-header" title="Mouth shapes, speech visemes, and expressions">
            <span style="display:flex; align-items:center; gap:5px;">
              <button class="btn-toggle-mouth" style="border:none; background:transparent; color:#64748b; font-size:0.55rem; cursor:pointer;">${this.isMouthExpanded ? '▼' : '▶'}</button>
              <span>👄 Mouth & Lips</span>
            </span>
            <div style="display:flex; align-items:center; gap:3px;">
              <button class="btn-studio btn-open-mouth-wizard" style="font-size:0.55rem; padding:1px 5px; color:#f43f5e;" title="Open Mouth Setup Wizard (Choose mode: Sliced Visemes, Cavity Sandwich, Mesh Warp, or Procedural)">Setup Mouth...</button>
              <button class="btn-face-prop-reset" data-facetype="mouth" title="Reset mouth to neutral" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#94a3b8; border-radius:3px; font-size:0.6rem; cursor:pointer;">↺</button>
              <button class="btn-face-prop-add" data-facetype="mouth" title="Add mouth keyframe at playhead" style="display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border:none; background:#334155; color:#38bdf8; border-radius:3px; font-size:0.6rem; cursor:pointer;">＋</button>
            </div>
          </div>
          <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
            ${keyframes.filter(k => k.face && (k.face.viseme !== undefined || k.face.mouthOpen !== undefined)).map(k => {
              const leftPx = Math.round(k.time * pixelsPerSec);
              const label = k.face?.viseme || (k.face?.mouthOpen ? 'Open' : 'Mouth');
              return `
                <div class="viseme-chip" data-time="${k.time}" style="position:absolute; top:2px; left:${leftPx - 10}px; z-index:12;" title="${label} @ ${k.time.toFixed(2)}s">
                  ${label}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Quick Viseme Palette row
      const quickVisemes: { key: VisemePreset; label: string }[] = [
        { key: 'rest', label: 'Rest' },
        { key: 'smile', label: 'Smile' },
        { key: 'ah', label: 'Ah' },
        { key: 'oh', label: 'Oh' },
        { key: 'ee', label: 'Ee' },
        { key: 'frown', label: 'Frown' },
        { key: 'ooh', label: 'Ooh' },
        { key: 'fv', label: 'F/V' },
        { key: 'l', label: 'L' }
      ];

      html += `
        <div class="timeline-element-row property-subtrack" style="height:24px;">
          <div class="timeline-element-header" style="padding-left:28px; font-size:0.56rem; color:#94a3b8;">
            <span>Phonemes:</span>
          </div>
          <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px; display:flex; align-items:center; gap:4px; padding-left:8px;">
            ${quickVisemes.map(qv => `
              <button class="viseme-chip btn-quick-drop-viseme" data-viseme="${qv.key}" title="Set ${qv.label} viseme at playhead (${this.currentTime.toFixed(2)}s)">
                ${qv.label}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      if (this.isMouthExpanded) {
        const mouthSubtracks: { key: keyof FacialPoseData; name: string; curVal: number }[] = [
          { key: 'mouthOpen', name: 'Open (Jaw Drop)', curVal: currentFace.mouthOpen || 0 },
          { key: 'mouthSmile', name: 'Smile / Frown', curVal: currentFace.mouthSmile || 0 },
          { key: 'mouthWidth', name: 'Mouth Width', curVal: currentFace.mouthWidth !== undefined ? currentFace.mouthWidth : 1.0 }
        ];
        for (const sub of mouthSubtracks) {
          html += `
            <div class="timeline-element-row property-subtrack">
              <div class="timeline-element-header" style="padding-left:28px;">
                <span>• ${sub.name}</span>
                <span class="element-change-badge rest" style="font-size:0.52rem;">${sub.curVal.toFixed(2)}</span>
              </div>
              <div class="element-track-lane" style="width:${trackWidth}px; min-width:${trackWidth}px;">
                ${keyframes.filter(k => k.face && (k.face as any)[sub.key] !== undefined).map(k => {
                  const leftPx = Math.round(k.time * pixelsPerSec);
                  return `<div class="element-key-marker prop-marker" data-time="${k.time}" style="left:${leftPx - 4}px; background:#f43f5e !important;"></div>`;
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

    // Bone expand/collapse toggles
    container.querySelectorAll('.btn-toggle-bone-props').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jointId = btn.getAttribute('data-joint') as AnatomicalJointId;
        if (jointId) {
          this.toggleBoneExpanded(jointId);
        }
      });
    });

    // Track row header clicks to set selected joint
    container.querySelectorAll('.timeline-element-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains('btn-track-add-key') ||
          target.classList.contains('btn-track-reset-key') ||
          target.classList.contains('btn-track-prop-add-key') ||
          target.classList.contains('btn-track-prop-reset-key') ||
          target.classList.contains('btn-toggle-bone-props')
        ) return;
        const jointId = header.getAttribute('data-joint') as AnatomicalJointId;
        if (jointId) {
          this.setSelectedJoint(jointId);
        }
      });
    });

    // Track "Reset" buttons (resets joint to rest position at playhead)
    container.querySelectorAll('.btn-track-reset-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jointId = btn.getAttribute('data-joint') as AnatomicalJointId;
        if (jointId && this.restJoints[jointId]) {
          this.setSelectedJoint(jointId);
          this.addTrackKeyframe(jointId, this.restJoints[jointId]);
          this.evaluatePoseAtCurrentTime();
          this.renderElementTracks();
          this.renderKeyframeTrack();
        }
      });
    });

    // Track "+Key" buttons
    container.querySelectorAll('.btn-track-add-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jointId = btn.getAttribute('data-joint') as AnatomicalJointId;
        if (jointId) {
          this.setSelectedJoint(jointId);
          this.addTrackKeyframe(jointId);
        }
      });
    });

    // Property Subtrack Reset buttons
    container.querySelectorAll('.btn-track-prop-reset-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jointId = btn.getAttribute('data-joint') as AnatomicalJointId;
        const propKey = btn.getAttribute('data-prop') as BonePropertyKey;
        if (jointId && propKey) {
          let resetVal = 0;
          if (propKey === 'x') resetVal = this.restJoints[jointId]?.x ?? 0;
          else if (propKey === 'y') resetVal = this.restJoints[jointId]?.y ?? 0;
          else if (propKey === 'rotation') resetVal = 0;
          else if (propKey === 'scale') resetVal = 1.0;
          this.addTrackPropertyKeyframe(jointId, propKey, resetVal);
        }
      });
    });

    // Property Subtrack "+Key" buttons
    container.querySelectorAll('.btn-track-prop-add-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jointId = btn.getAttribute('data-joint') as AnatomicalJointId;
        const propKey = btn.getAttribute('data-prop') as BonePropertyKey;
        if (jointId && propKey) {
          this.addTrackPropertyKeyframe(jointId, propKey);
        }
      });
    });

    // Facial Controls toggles and actions
    container.querySelector('.btn-toggle-facial-group')?.addEventListener('click', () => {
      this.toggleFacialTracks();
    });

    container.querySelector('.btn-toggle-eyebrows')?.addEventListener('click', () => {
      this.toggleEyebrowsExpanded();
    });

    container.querySelector('.btn-toggle-eyes')?.addEventListener('click', () => {
      this.toggleEyesExpanded();
    });

    container.querySelector('.btn-toggle-mouth')?.addEventListener('click', () => {
      this.toggleMouthExpanded();
    });

    container.querySelector('.btn-open-eye-wizard')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.events.onRequestEyeSetupWizard?.();
    });

    container.querySelector('.btn-open-mouth-wizard')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.events.onRequestMouthSetupWizard?.();
    });

    container.querySelectorAll('.btn-quick-drop-viseme').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = btn.getAttribute('data-viseme') as VisemePreset;
        if (v) {
          let open = 0;
          let smile = 0;
          if (v === 'ah') open = 0.8;
          else if (v === 'oh') open = 0.6;
          else if (v === 'smile') smile = 0.8;
          else if (v === 'frown') smile = -0.8;
          this.addFacialKeyframe({ viseme: v, mouthOpen: open, mouthSmile: smile });
        }
      });
    });

    container.querySelectorAll('.btn-face-prop-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fType = btn.getAttribute('data-facetype');
        if (fType === 'brow') {
          this.addFacialKeyframe({ browHeightL: 5, browHeightR: 5 });
        } else if (fType === 'eyes') {
          this.addFacialKeyframe({ blinkL: 1.0, blinkR: 1.0 });
        } else if (fType === 'mouth') {
          this.addFacialKeyframe({ mouthOpen: 0.5, mouthSmile: 0.2 });
        }
      });
    });

    container.querySelectorAll('.btn-face-prop-reset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fType = btn.getAttribute('data-facetype');
        if (fType === 'brow') {
          this.addFacialKeyframe({ browHeightL: 0, browHeightR: 0, browAngleL: 0, browAngleR: 0, browFurrow: 0 });
        } else if (fType === 'eyes') {
          this.addFacialKeyframe({ blinkL: 0, blinkR: 0, squint: 0 });
        } else if (fType === 'mouth') {
          this.addFacialKeyframe({ viseme: 'rest', mouthOpen: 0, mouthSmile: 0, mouthWidth: 1.0 });
        }
      });
    });

    // Bind marker clicks / drag starts
    container.querySelectorAll('.element-key-marker').forEach(marker => {
      marker.addEventListener('mousedown', (e) => {
        if ((e as MouseEvent).button === 0) {
          this.handleMarkerMouseDown(e as MouseEvent, marker as HTMLElement);
        }
      });
    });
  }

  private handleMarkerMouseDown(e: MouseEvent, targetEl: HTMLElement): void {
    e.stopPropagation();
    e.preventDefault();

    const time = parseFloat(targetEl.getAttribute('data-time')!);
    const jointId = targetEl.getAttribute('data-joint') as AnatomicalJointId;
    const propKey = targetEl.getAttribute('data-prop') as BonePropertyKey | undefined;
    const keyId = targetEl.getAttribute('data-keyid') || this.makeKeyId(time, jointId, propKey);

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl) {
      if (this.selectedKeyframeKeys.has(keyId)) {
        this.selectedKeyframeKeys.delete(keyId);
        targetEl.classList.remove('selected');
      } else {
        this.selectedKeyframeKeys.add(keyId);
        targetEl.classList.add('selected');
      }
      this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      return;
    }

    if (isShift) {
      this.selectedKeyframeKeys.add(keyId);
      targetEl.classList.add('selected');
      this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      return;
    }

    if (!this.selectedKeyframeKeys.has(keyId)) {
      this.clearSelection();
      this.selectedKeyframeKeys.add(keyId);
      this.container.querySelectorAll('.element-key-marker.selected, .keyframe-diamond.selected').forEach(el => el.classList.remove('selected'));
      targetEl.classList.add('selected');
    }

    this.startMultiKeyframeDrag(e, time);
  }

  private handleMasterDiamondMouseDown(e: MouseEvent, targetEl: HTMLElement): void {
    e.stopPropagation();
    e.preventDefault();

    const time = parseFloat(targetEl.getAttribute('data-time')!);
    const keyId = targetEl.getAttribute('data-keyid') || this.makeKeyId(time);
    const idx = parseInt(targetEl.getAttribute('data-index') || '0', 10);

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl) {
      if (this.selectedKeyframeKeys.has(keyId)) {
        this.selectedKeyframeKeys.delete(keyId);
        targetEl.classList.remove('selected');
      } else {
        this.selectedKeyframeKeys.add(keyId);
        targetEl.classList.add('selected');
      }
      this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      return;
    }

    if (isShift) {
      this.selectedKeyframeKeys.add(keyId);
      targetEl.classList.add('selected');
      this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      return;
    }

    if (!this.selectedKeyframeKeys.has(keyId)) {
      this.clearSelection();
      this.selectedKeyframeKeys.add(keyId);
      this.selectedKeyframeIndex = idx;
      this.container.querySelectorAll('.element-key-marker.selected, .keyframe-diamond.selected').forEach(el => el.classList.remove('selected'));
      targetEl.classList.add('selected');
    }

    this.startMultiKeyframeDrag(e, time);
  }

  private startMultiKeyframeDrag(e: MouseEvent, referenceTime: number): void {
    const track = this.getActiveTrack();
    if (!track) return;

    this.isDraggingKeyframes = true;
    this.dragStartClientX = e.clientX;
    this.dragStartTime = referenceTime;
    this.hasDraggedKeyframe = false;

    this.draggingEntries = [];
    for (const kId of this.selectedKeyframeKeys) {
      if (kId.startsWith('prop:')) {
        const parts = kId.split(':');
        const jId = parts[1] as AnatomicalJointId;
        const pKey = parts[2] as BonePropertyKey;
        const t = parseFloat(parts[3]);
        const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
        if (kf && kf.boneProps?.[jId]?.[pKey] !== undefined) {
          this.draggingEntries.push({
            keyId: kId,
            originalTime: kf.time,
            jointId: jId,
            propKey: pKey,
            propValue: kf.boneProps[jId]![pKey]
          });
        }
      } else if (kId.startsWith('joint:')) {
        const parts = kId.split(':');
        const jId = parts[1] as AnatomicalJointId;
        const t = parseFloat(parts[2]);
        const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
        if (kf && kf.joints && kf.joints[jId]) {
          this.draggingEntries.push({
            keyId: kId,
            originalTime: kf.time,
            jointId: jId,
            pos: { ...kf.joints[jId] }
          });
        }
      } else if (kId.startsWith('master:')) {
        const t = parseFloat(kId.split(':')[1]);
        const kf = track.keyframes.find(k => Math.abs(k.time - t) < 0.005);
        if (kf) {
          this.draggingEntries.push({
            keyId: kId,
            originalTime: kf.time,
            joints: JSON.parse(JSON.stringify(kf.joints)),
            name: kf.name
          });
        }
      }
    }

    if (this.draggingEntries.length === 0) {
      const nearKf = track.keyframes.find(k => Math.abs(k.time - referenceTime) < 0.005);
      if (nearKf) {
        this.draggingEntries.push({
          keyId: this.makeKeyId(nearKf.time),
          originalTime: nearKf.time,
          joints: JSON.parse(JSON.stringify(nearKf.joints)),
          name: nearKf.name
        });
      }
    }

    let badge = document.querySelector('.timeline-drag-badge') as HTMLElement | null;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'timeline-drag-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = `${referenceTime.toFixed(2)}s`;
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
      this.container.querySelectorAll('.timeline-element-row:not(.property-subtrack)').forEach(row => {
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
      this.container.querySelectorAll('.timeline-element-row.property-subtrack').forEach(row => {
        const jointId = row.getAttribute('data-joint') as AnatomicalJointId;
        const propKey = row.getAttribute('data-prop') as BonePropertyKey;
        const badge = row.querySelector('.element-change-badge');
        if (jointId && propKey && badge) {
          const rest = this.restJoints[jointId] || { x: 0, y: 0 };
          const cur = currentPosed[jointId] || rest;
          const dx = Math.round(cur.x - rest.x);
          const dy = Math.round(cur.y - rest.y);
          if (propKey === 'x') badge.textContent = `X: ${dx >= 0 ? '+' : ''}${dx}px`;
          else if (propKey === 'y') badge.textContent = `Y: ${dy >= 0 ? '+' : ''}${dy}px`;
          else if (propKey === 'rotation' || propKey === 'scale') {
            const metrics = getBoneMetrics(jointId, currentPosed, this.restJoints);
            if (propKey === 'rotation') badge.textContent = `${metrics.rotDeg > 0 ? '+' : ''}${metrics.rotDeg}°`;
            else badge.textContent = `${metrics.scale}x`;
          }
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

    // Add Track Keyframe button
    this.container.querySelector('.btn-timeline-add-track-key')?.addEventListener('click', () => {
      const jointId = this.selectedJointId || 'chest';
      this.addTrackKeyframe(jointId);
      this.events.onKeyframeAdded?.(this.currentTime, this.restJoints, jointId);
    });

    // Reset to Rest button (resets selected track joint or full pose to rest position)
    this.container.querySelector('.btn-timeline-reset-rest')?.addEventListener('click', () => {
      const jointId = this.selectedJointId;
      if (jointId && this.restJoints[jointId]) {
        this.addTrackKeyframe(jointId, this.restJoints[jointId]);
        this.evaluatePoseAtCurrentTime();
        this.renderElementTracks();
        this.renderKeyframeTrack();
      } else {
        const fullRest = { ...this.restJoints };
        this.addKeyframe(fullRest);
      }
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
      this.deleteSelectedKeyframes();
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

    // Rubberband Box Selection on empty tracks area
    const tracksList = this.container.querySelector('.timeline-tracks-list') as HTMLElement | null;
    tracksList?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('.keyframe-diamond') ||
        target.closest('.element-key-marker') ||
        target.closest('.timeline-row-header') ||
        target.closest('.btn-track-add-key')
      ) {
        return;
      }

      this.isRubberbanding = true;
      this.rubberbandStartX = e.clientX;
      this.rubberbandStartY = e.clientY;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      if (!isCtrl && !isShift) {
        this.clearSelection();
        this.container.querySelectorAll('.element-key-marker.selected, .keyframe-diamond.selected').forEach(el => el.classList.remove('selected'));
      }
      this.rubberbandInitialKeys = new Set(this.selectedKeyframeKeys);

      if (!this.rubberbandBoxEl) {
        this.rubberbandBoxEl = document.createElement('div');
        this.rubberbandBoxEl.className = 'timeline-rubberband-box';
        document.body.appendChild(this.rubberbandBoxEl);
      }
      this.rubberbandBoxEl.style.display = 'block';
      this.rubberbandBoxEl.style.left = `${e.clientX}px`;
      this.rubberbandBoxEl.style.top = `${e.clientY}px`;
      this.rubberbandBoxEl.style.width = '0px';
      this.rubberbandBoxEl.style.height = '0px';
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingPlayhead) {
        this.scrubFromEvent(e);
      } else if (this.isRubberbanding && this.rubberbandBoxEl) {
        const minX = Math.min(this.rubberbandStartX, e.clientX);
        const maxX = Math.max(this.rubberbandStartX, e.clientX);
        const minY = Math.min(this.rubberbandStartY, e.clientY);
        const maxY = Math.max(this.rubberbandStartY, e.clientY);

        this.rubberbandBoxEl.style.left = `${minX}px`;
        this.rubberbandBoxEl.style.top = `${minY}px`;
        this.rubberbandBoxEl.style.width = `${maxX - minX}px`;
        this.rubberbandBoxEl.style.height = `${maxY - minY}px`;

        const boxRect = { left: minX, right: maxX, top: minY, bottom: maxY };

        const allKeyEls = this.container.querySelectorAll('.element-key-marker, .keyframe-diamond');
        allKeyEls.forEach(el => {
          const keyId = el.getAttribute('data-keyid');
          if (!keyId) return;
          const r = el.getBoundingClientRect();
          const intersects = !(r.right < boxRect.left || r.left > boxRect.right || r.bottom < boxRect.top || r.top > boxRect.bottom);

          if (intersects) {
            this.selectedKeyframeKeys.add(keyId);
            el.classList.add('selected');
          } else if (!this.rubberbandInitialKeys?.has(keyId)) {
            this.selectedKeyframeKeys.delete(keyId);
            el.classList.remove('selected');
          }
        });

        this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      } else if (this.isDraggingKeyframes) {
        const dx = e.clientX - this.dragStartClientX;
        if (Math.abs(dx) > 3) {
          this.hasDraggedKeyframe = true;
        }
        if (this.hasDraggedKeyframe) {
          const trackWidth = this.getTrackWidth();
          const pixelsPerSec = trackWidth / this.duration;
          const dt = dx / pixelsPerSec;
          let newRefTime = Math.max(0, Math.min(this.duration, this.dragStartTime + dt));
          newRefTime = Math.round(newRefTime * 100) / 100;

          if (this.dragGhostElement) {
            const count = this.draggingEntries.length;
            this.dragGhostElement.textContent = count > 1 ? `${newRefTime.toFixed(2)}s (${count} keys)` : `${newRefTime.toFixed(2)}s`;
            this.dragGhostElement.style.left = `${e.clientX}px`;
            this.dragGhostElement.style.top = `${e.clientY - 24}px`;
          }

          this.currentTime = newRefTime;
          this.updatePlayheadPosition();
          this.evaluatePoseAtCurrentTime();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDraggingPlayhead) {
        this.isDraggingPlayhead = false;
      }

      if (this.isRubberbanding) {
        this.isRubberbanding = false;
        if (this.rubberbandBoxEl) {
          this.rubberbandBoxEl.style.display = 'none';
        }
        this.events.onSelectionChanged?.(this.selectedKeyframeKeys.size);
      }

      if (this.isDraggingKeyframes) {
        if (this.dragGhostElement) {
          this.dragGhostElement.remove();
          this.dragGhostElement = null;
        }

        const track = this.getActiveTrack();
        if (track && this.hasDraggedKeyframe && this.draggingEntries.length > 0) {
          const trackWidth = this.getTrackWidth();
          const pixelsPerSec = trackWidth / this.duration;
          const dx = e.clientX - this.dragStartClientX;
          const dt = dx / pixelsPerSec;
          const oldRefTime = this.dragStartTime;
          const newRefTime = Math.max(0, Math.min(this.duration, Math.round((oldRefTime + dt) * 100) / 100));
          const effectiveDt = newRefTime - oldRefTime;

          this.applyKeyframeMovement(track, this.draggingEntries, effectiveDt);

          this.events.onKeyframeMoved?.(-1, oldRefTime, newRefTime);
          this.renderRuler();
          this.renderKeyframeTrack();
          this.renderElementTracks();
          this.updatePlayheadPosition();
          this.evaluatePoseAtCurrentTime();
        } else if (!this.hasDraggedKeyframe) {
          this.setTime(this.dragStartTime);
          this.renderKeyframeTrack();
          this.renderElementTracks();
        }

        this.container.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        this.isDraggingKeyframes = false;
        this.hasDraggedKeyframe = false;
        this.draggingEntries = [];
      }
    });

    // Global timeline keyboard shortcuts (Space: play/pause, Del: delete, Ctrl+C: copy, Ctrl+V: paste, Ctrl+A: select all, K: kinematics)
    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedKeyframes();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.selectAllKeyframes();
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

  private applyKeyframeMovement(track: StudioSideTrack, entries: DraggingKeyEntry[], dt: number): void {
    if (entries.length === 0) return;

    // 1. Remove/detach all moved joint or master entries from their original keyframes
    const newItems: { time: number; jointId?: AnatomicalJointId; propKey?: BonePropertyKey; propValue?: number; pos?: { x: number; y: number }; joints?: Record<AnatomicalJointId, { x: number; y: number }>; name?: string }[] = [];

    for (const entry of entries) {
      const newTime = Math.max(0, Math.min(this.duration, Math.round((entry.originalTime + dt) * 100) / 100));

      if (entry.jointId && entry.propKey && entry.propValue !== undefined) {
        const origKf = track.keyframes.find((k: StudioKeyframe) => Math.abs(k.time - entry.originalTime) < 0.005);
        if (origKf && origKf.boneProps?.[entry.jointId]) {
          delete origKf.boneProps[entry.jointId]![entry.propKey];
          if (Object.keys(origKf.boneProps[entry.jointId]!).length === 0) {
            delete origKf.boneProps[entry.jointId];
          }
        }
        newItems.push({
          time: newTime,
          jointId: entry.jointId,
          propKey: entry.propKey,
          propValue: entry.propValue
        });
      } else if (entry.jointId && entry.pos) {
        const origKf = track.keyframes.find((k: StudioKeyframe) => Math.abs(k.time - entry.originalTime) < 0.005);
        if (origKf && origKf.joints) {
          delete origKf.joints[entry.jointId];
          if (Object.keys(origKf.joints).length === 0) {
            const idx = track.keyframes.indexOf(origKf);
            if (idx >= 0) track.keyframes.splice(idx, 1);
          }
        }
        newItems.push({
          time: newTime,
          jointId: entry.jointId,
          pos: { ...entry.pos }
        });
      } else if (entry.joints) {
        const origIdx = track.keyframes.findIndex((k: StudioKeyframe) => Math.abs(k.time - entry.originalTime) < 0.005);
        if (origIdx >= 0) {
          track.keyframes.splice(origIdx, 1);
        }
        newItems.push({
          time: newTime,
          joints: JSON.parse(JSON.stringify(entry.joints)),
          name: entry.name
        });
      }
    }

    // 2. Re-insert items at their new timestamps, merging with any existing keyframe at that timestamp
    this.clearSelection();

    for (const item of newItems) {
      let destKf = track.keyframes.find((k: StudioKeyframe) => Math.abs(k.time - item.time) < 0.005);
      if (item.jointId && item.propKey && item.propValue !== undefined) {
        if (!destKf) {
          destKf = {
            time: item.time,
            joints: {} as any,
            boneProps: {
              [item.jointId]: { [item.propKey]: item.propValue }
            }
          };
          track.keyframes.push(destKf);
        } else {
          if (!destKf.boneProps) destKf.boneProps = {};
          if (!destKf.boneProps[item.jointId]) destKf.boneProps[item.jointId] = {};
          destKf.boneProps[item.jointId]![item.propKey] = item.propValue;
        }
        if (item.propKey === 'x' || item.propKey === 'y') {
          if (!destKf.joints) destKf.joints = {} as any;
          if (!destKf.joints[item.jointId]) {
            destKf.joints[item.jointId] = { ...(this.restJoints[item.jointId] || { x: 0, y: 0 }) };
          }
          destKf.joints[item.jointId][item.propKey] = Math.round(item.propValue);
        }
        this.selectedKeyframeKeys.add(this.makeKeyId(item.time, item.jointId, item.propKey));
      } else if (item.jointId && item.pos) {
        if (!destKf) {
          destKf = {
            time: item.time,
            joints: { [item.jointId]: { ...item.pos } } as any
          };
          track.keyframes.push(destKf);
        } else {
          if (!destKf.joints) destKf.joints = {} as any;
          destKf.joints[item.jointId] = { ...item.pos };
        }
        this.selectedKeyframeKeys.add(`joint:${item.jointId}:${item.time.toFixed(3)}`);
      } else if (item.joints) {
        if (!destKf) {
          destKf = {
            time: item.time,
            name: item.name,
            joints: { ...item.joints }
          };
          track.keyframes.push(destKf);
        } else {
          destKf.joints = { ...destKf.joints, ...item.joints };
          if (item.name) destKf.name = item.name;
        }
        this.selectedKeyframeKeys.add(this.makeKeyId(item.time));
      }
    }

    track.keyframes.sort((a: StudioKeyframe, b: StudioKeyframe) => a.time - b.time);
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
    if (this.rubberbandBoxEl) this.rubberbandBoxEl.remove();
  }
}
