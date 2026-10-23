import {
  AnatomicalJointId,
  FacialRigConfig,
  SpineAnimationTrack,
  SpineDocument,
  StudioAnimationDefinition,
  StudioView,
  VectorOutlineElement,
  ViewArtworkData
} from '../types';
import { convertJointsToSpineBones, DEFAULT_BONE_DRAW_ORDER } from '../rigging/AnatomicalRig';

export interface SpineExportOptions {
  views: Record<string, ViewArtworkData>;
  activeView?: StudioView;
  boneDrawOrder?: AnatomicalJointId[];
  facialRig?: FacialRigConfig;
  animations?: Record<string, StudioAnimationDefinition>;
  elements?: VectorOutlineElement[];
  spineVersion?: string;
  width?: number;
  height?: number;
}

export const SPINE_BONE_NAME_MAP: Record<AnatomicalJointId, string> = {
  hip_l: 'leg_upper_l',
  knee_l: 'leg_lower_l',
  ankle_l: 'foot_l',
  foot_l: 'foot_tip_l',
  hip_r: 'leg_upper_r',
  knee_r: 'leg_lower_r',
  ankle_r: 'foot_r',
  foot_r: 'foot_tip_r',
  chest: 'torso',
  neck: 'neck',
  head: 'head',
  shoulder_l: 'arm_upper_l',
  elbow_l: 'arm_lower_l',
  wrist_l: 'hand_l',
  hand_l: 'hand_tip_l',
  shoulder_r: 'arm_upper_r',
  elbow_r: 'arm_lower_r',
  wrist_r: 'hand_r',
  hand_r: 'hand_tip_r'
};

/**
 * Converts studio keyframed animations to Spine 2D animation tracks.
 */
export function convertStudioAnimationsToSpineTracks(
  animations: Record<string, StudioAnimationDefinition> = {}
): Record<string, SpineAnimationTrack> {
  const spineAnimations: Record<string, SpineAnimationTrack> = {};

  for (const [animName, animDef] of Object.entries(animations)) {
    for (const side of animDef.relevantSides || []) {
      const sideTrack = animDef.tracks[side];
      if (!sideTrack || !sideTrack.keyframes || sideTrack.keyframes.length === 0) continue;

      const spineKey = side === 'front' ? animName : `${animName}_${side}`;
      const bonesTrack: Record<string, { rotate?: { time: number; angle: number }[] }> = {};

      for (const kf of sideTrack.keyframes) {
        if (!kf.joints) continue;

        const torsoAngle =
          kf.joints.chest && kf.joints.neck
            ? Math.atan2(kf.joints.neck.y - kf.joints.chest.y, kf.joints.neck.x - kf.joints.chest.x) * (180 / Math.PI) + 90
            : 0;
        const headAngle =
          kf.joints.head && kf.joints.neck
            ? Math.atan2(kf.joints.head.y - kf.joints.neck.y, kf.joints.head.x - kf.joints.neck.x) * (180 / Math.PI) + 90
            : 0;

        if (!bonesTrack.torso) bonesTrack.torso = { rotate: [] };
        bonesTrack.torso.rotate!.push({ time: kf.time, angle: Math.round(torsoAngle * 10) / 10 });

        if (!bonesTrack.head) bonesTrack.head = { rotate: [] };
        bonesTrack.head.rotate!.push({ time: kf.time, angle: Math.round(headAngle * 10) / 10 });
      }

      spineAnimations[spineKey] = { bones: bonesTrack };
    }
  }

  // Provide a fallback idle track if none defined
  if (Object.keys(spineAnimations).length === 0) {
    spineAnimations.idle = {
      bones: {
        torso: {
          rotate: [
            { time: 0, angle: 0 },
            { time: 0.8, angle: 2 },
            { time: 1.6, angle: 0 }
          ]
        }
      }
    };
  }

  return spineAnimations;
}

/**
 * Builds a valid, Spine 2D specification-compliant JSON document from studio state.
 */
export function buildSpineDocument(options: SpineExportOptions): SpineDocument {
  const frontView = options.views?.front;
  const frontJoints = frontView?.joints || {};
  const bones = convertJointsToSpineBones(frontJoints, 'front');

  const order =
    options.boneDrawOrder ||
    frontView?.boneOrder ||
    [...DEFAULT_BONE_DRAW_ORDER];

  const slots = order.map(bId => {
    const sName = SPINE_BONE_NAME_MAP[bId] || bId;
    return { name: sName, bone: sName };
  });

  return {
    skeleton: {
      spine: options.spineVersion || '3.8.99',
      width: options.width || 128,
      height: options.height || 256,
      questforge: {
        posePreset: '3-way',
        poseDirections: {
          front: ['down'],
          side: ['right', 'left'],
          back: ['up']
        },
        elements: options.elements ? JSON.parse(JSON.stringify(options.elements)) : [],
        facialRig: options.facialRig ? JSON.parse(JSON.stringify(options.facialRig)) : undefined,
        animations: options.animations ? JSON.parse(JSON.stringify(options.animations)) : undefined
      }
    },
    bones,
    slots,
    skins: [
      { name: 'front', attachments: {} },
      { name: 'back', attachments: {} },
      { name: 'side', attachments: {} }
    ],
    animations: convertStudioAnimationsToSpineTracks(options.animations)
  };
}
