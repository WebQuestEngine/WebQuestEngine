import { AnatomicalJointDef, AnatomicalJointId, StudioView, SpineDocument, SpineBoneData, BonePartAttachment } from '../types';

export const ANATOMICAL_JOINTS: AnatomicalJointDef[] = [
  { id: 'head', name: 'Head', color: '#22c55e', parentId: 'neck', isCenter: true },
  { id: 'neck', name: 'Neck', color: '#4ade80', parentId: 'chest', isCenter: true },
  { id: 'chest', name: 'Chest', color: '#38bdf8', isCenter: true },
  { id: 'shoulder_l', name: 'Shoulder L', color: '#eab308', parentId: 'chest', symmetricWith: 'shoulder_r' },
  { id: 'shoulder_r', name: 'Shoulder R', color: '#eab308', parentId: 'chest', symmetricWith: 'shoulder_l' },
  { id: 'elbow_l', name: 'Elbow L', color: '#f97316', parentId: 'shoulder_l', symmetricWith: 'elbow_r' },
  { id: 'elbow_r', name: 'Elbow R', color: '#f97316', parentId: 'shoulder_r', symmetricWith: 'elbow_l' },
  { id: 'wrist_l', name: 'Wrist L', color: '#a855f7', parentId: 'elbow_l', symmetricWith: 'wrist_r' },
  { id: 'wrist_r', name: 'Wrist R', color: '#a855f7', parentId: 'elbow_r', symmetricWith: 'wrist_l' },
  { id: 'hand_l', name: 'Hand Tip L', color: '#c084fc', parentId: 'wrist_l', symmetricWith: 'hand_r' },
  { id: 'hand_r', name: 'Hand Tip R', color: '#c084fc', parentId: 'wrist_r', symmetricWith: 'hand_l' },
  { id: 'hip_l', name: 'Hip L', color: '#3b82f6', parentId: 'chest', symmetricWith: 'hip_r' },
  { id: 'hip_r', name: 'Hip R', color: '#3b82f6', parentId: 'chest', symmetricWith: 'hip_l' },
  { id: 'knee_l', name: 'Knee L', color: '#ef4444', parentId: 'hip_l', symmetricWith: 'knee_r' },
  { id: 'knee_r', name: 'Knee R', color: '#ef4444', parentId: 'hip_r', symmetricWith: 'knee_l' },
  { id: 'ankle_l', name: 'Ankle L', color: '#d97706', parentId: 'knee_l', symmetricWith: 'ankle_r' },
  { id: 'ankle_r', name: 'Ankle R', color: '#d97706', parentId: 'knee_r', symmetricWith: 'ankle_l' },
  { id: 'foot_l', name: 'Foot Tip L', color: '#f59e0b', parentId: 'ankle_l', symmetricWith: 'foot_r' },
  { id: 'foot_r', name: 'Foot Tip R', color: '#f59e0b', parentId: 'ankle_r', symmetricWith: 'foot_l' },
];

export const BONE_CONNECTIONS: [AnatomicalJointId, AnatomicalJointId][] = [
  ['chest', 'neck'],
  ['neck', 'head'],
  ['chest', 'shoulder_l'],
  ['shoulder_l', 'elbow_l'],
  ['elbow_l', 'wrist_l'],
  ['wrist_l', 'hand_l'],
  ['chest', 'shoulder_r'],
  ['shoulder_r', 'elbow_r'],
  ['elbow_r', 'wrist_r'],
  ['wrist_r', 'hand_r'],
  ['hip_l', 'knee_l'],
  ['knee_l', 'ankle_l'],
  ['ankle_l', 'foot_l'],
  ['hip_r', 'knee_r'],
  ['knee_r', 'ankle_r'],
  ['ankle_r', 'foot_r'],
  ['hip_l', 'hip_r'], // pelvis bridge
];

export interface AnatomicalBoneDef {
  id: AnatomicalJointId; // Unique bone slot identifier
  name: string;          // Clear user-facing bone name
  originJointId: AnatomicalJointId | 'hip_mid';
  targetJointId?: AnatomicalJointId;
  defaultLength?: number;
  category: 'spine' | 'arm' | 'leg';
  description: string;
}

export const ANATOMICAL_BONES: AnatomicalBoneDef[] = [
  { id: 'head', name: 'Head Bone', originJointId: 'neck', targetJointId: 'head', category: 'spine', description: 'Starts from Neck joint, extends to head crown' },
  { id: 'neck', name: 'Neck Bone', originJointId: 'chest', targetJointId: 'neck', category: 'spine', description: 'Starts from Chest joint, extends to Neck / chin pivot' },
  { id: 'chest', name: 'Torso Bone', originJointId: 'hip_mid', targetJointId: 'chest', category: 'spine', description: 'Starts from Hip midpoint, extends to Chest joint' },
  { id: 'shoulder_l', name: 'Left Upper Arm Bone', originJointId: 'shoulder_l', targetJointId: 'elbow_l', category: 'arm', description: 'Starts from Shoulder L joint, extends to Elbow L joint' },
  { id: 'elbow_l', name: 'Left Forearm Bone', originJointId: 'elbow_l', targetJointId: 'wrist_l', category: 'arm', description: 'Starts from Elbow L joint, extends to Wrist L joint' },
  { id: 'wrist_l', name: 'Left Hand Bone', originJointId: 'wrist_l', targetJointId: 'hand_l', defaultLength: 28, category: 'arm', description: 'Starts from Wrist L joint to Hand Tip L' },
  { id: 'shoulder_r', name: 'Right Upper Arm Bone', originJointId: 'shoulder_r', targetJointId: 'elbow_r', category: 'arm', description: 'Starts from Shoulder R joint, extends to Elbow R joint' },
  { id: 'elbow_r', name: 'Right Forearm Bone', originJointId: 'elbow_r', targetJointId: 'wrist_r', category: 'arm', description: 'Starts from Elbow R joint, extends to Wrist R joint' },
  { id: 'wrist_r', name: 'Right Hand Bone', originJointId: 'wrist_r', targetJointId: 'hand_r', defaultLength: 28, category: 'arm', description: 'Starts from Wrist R joint to Hand Tip R' },
  { id: 'hip_l', name: 'Left Thigh Bone', originJointId: 'hip_l', targetJointId: 'knee_l', category: 'leg', description: 'Starts from Hip L joint, extends to Knee L joint' },
  { id: 'knee_l', name: 'Left Calf Bone', originJointId: 'knee_l', targetJointId: 'ankle_l', category: 'leg', description: 'Starts from Knee L joint, extends to Ankle L joint' },
  { id: 'ankle_l', name: 'Left Foot Bone', originJointId: 'ankle_l', targetJointId: 'foot_l', defaultLength: 36, category: 'leg', description: 'Starts from Ankle L joint to Foot Tip L' },
  { id: 'hip_r', name: 'Right Thigh Bone', originJointId: 'hip_r', targetJointId: 'knee_r', category: 'leg', description: 'Starts from Hip R joint, extends to Knee R joint' },
  { id: 'knee_r', name: 'Right Calf Bone', originJointId: 'knee_r', targetJointId: 'ankle_r', category: 'leg', description: 'Starts from Knee R joint, extends to Ankle R joint' },
  { id: 'ankle_r', name: 'Right Foot Bone', originJointId: 'ankle_r', targetJointId: 'foot_r', defaultLength: 36, category: 'leg', description: 'Starts from Ankle R joint to Foot Tip R' },
];

/**
 * Default standard layer stacking order for character bones (rendered from bottom to top).
 * Far limbs are drawn behind the torso, near limbs and head in front.
 */
export const DEFAULT_BONE_DRAW_ORDER: AnatomicalJointId[] = [
  'shoulder_r',
  'elbow_r',
  'wrist_r',
  'hip_r',
  'knee_r',
  'ankle_r',
  'chest',
  'neck',
  'hip_l',
  'knee_l',
  'ankle_l',
  'head',
  'shoulder_l',
  'elbow_l',
  'wrist_l'
];

/**
 * Returns default anatomical positions scaled and fitted to image bounds.
 * Origin (0,0) is at character ground center (between feet).
 */
export function getDefaultJointPositions(
  view: StudioView = 'front',
  charWidth = 254,
  charHeight = 380
): Record<AnatomicalJointId, { x: number; y: number }> {
  const scale = charHeight / 380;
  const wScale = charWidth / 254;

  // Base reference coords for standard A-pose character (height 380, ground at y=0)
  const baseFront: Record<AnatomicalJointId, { x: number; y: number }> = {
    head: { x: 0, y: -312 * scale },
    neck: { x: 0, y: -268 * scale },
    chest: { x: 0, y: -238 * scale },
    shoulder_l: { x: 28 * wScale, y: -238 * scale },
    shoulder_r: { x: -28 * wScale, y: -238 * scale },
    elbow_l: { x: 52 * wScale, y: -188 * scale },
    elbow_r: { x: -52 * wScale, y: -188 * scale },
    wrist_l: { x: 74 * wScale, y: -136 * scale },
    wrist_r: { x: -74 * wScale, y: -136 * scale },
    hand_l: { x: 86 * wScale, y: -110 * scale },
    hand_r: { x: -86 * wScale, y: -110 * scale },
    hip_l: { x: 20 * wScale, y: -155 * scale },
    hip_r: { x: -20 * wScale, y: -155 * scale },
    knee_l: { x: 24 * wScale, y: -95 * scale },
    knee_r: { x: -24 * wScale, y: -95 * scale },
    ankle_l: { x: 28 * wScale, y: -35 * scale },
    ankle_r: { x: -28 * wScale, y: -35 * scale },
    foot_l: { x: 32 * wScale, y: 0 },
    foot_r: { x: -32 * wScale, y: 0 },
  };

  if (view === 'back') {
    // Back view mirrors left/right perspective across X axis
    const back: Record<AnatomicalJointId, { x: number; y: number }> = { ...baseFront };
    for (const joint of ANATOMICAL_JOINTS) {
      if (joint.symmetricWith) {
        back[joint.id] = {
          x: -baseFront[joint.id].x,
          y: baseFront[joint.id].y
        };
      }
    }
    return back;
  }

  if (view === 'left' || view === 'right') {
    const isRight = view === 'right';
    const dir = isRight ? 1 : -1;
    return {
      head: { x: 4 * dir * wScale, y: -312 * scale },
      neck: { x: 2 * dir * wScale, y: -268 * scale },
      chest: { x: 0, y: -238 * scale },
      shoulder_l: { x: 4 * dir * wScale, y: -238 * scale },
      shoulder_r: { x: -4 * dir * wScale, y: -238 * scale },
      elbow_l: { x: 18 * dir * wScale, y: -188 * scale },
      elbow_r: { x: -16 * dir * wScale, y: -188 * scale },
      wrist_l: { x: 28 * dir * wScale, y: -136 * scale },
      wrist_r: { x: -24 * dir * wScale, y: -136 * scale },
      hand_l: { x: 34 * dir * wScale, y: -110 * scale },
      hand_r: { x: -28 * dir * wScale, y: -110 * scale },
      hip_l: { x: 4 * dir * wScale, y: -155 * scale },
      hip_r: { x: -4 * dir * wScale, y: -155 * scale },
      knee_l: { x: 8 * dir * wScale, y: -95 * scale },
      knee_r: { x: -6 * dir * wScale, y: -95 * scale },
      ankle_l: { x: 10 * dir * wScale, y: -35 * scale },
      ankle_r: { x: -8 * dir * wScale, y: -35 * scale },
      foot_l: { x: 14 * dir * wScale, y: 0 },
      foot_r: { x: -12 * dir * wScale, y: 0 },
    };
  }

  return baseFront;
}

/**
 * 2-Bone Analytical Inverse Kinematics solver.
 * Bends mid bone smoothly when dragging end effector.
 */
export function solveTwoBoneIK(
  root: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number },
  target: { x: number; y: number },
  bendPositive: boolean | 'auto' = true
): { mid: { x: number; y: number }; end: { x: number; y: number } } {
  const l1 = Math.hypot(mid.x - root.x, mid.y - root.y) || 60;
  const l2 = Math.hypot(end.x - mid.x, end.y - mid.y) || 55;

  const dx = target.x - root.x;
  const dy = target.y - root.y;
  let dist = Math.hypot(dx, dy);

  // Clamp distance within reachable envelope
  const maxReach = (l1 + l2) * 0.999;
  const minReach = Math.abs(l1 - l2) * 1.001;
  dist = Math.max(minReach, Math.min(maxReach, dist));

  const targetAngle = Math.atan2(dy, dx);

  // Law of Cosines for angle at root (cos alpha)
  const cosAlpha = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));

  let useBendPositive: boolean;
  if (bendPositive === 'auto') {
    const cross = (end.x - root.x) * (mid.y - root.y) - (end.y - root.y) * (mid.x - root.x);
    useBendPositive = Math.abs(cross) > 1e-2 ? cross < 0 : true;
  } else {
    useBendPositive = bendPositive;
  }

  const bendSign = useBendPositive ? 1 : -1;
  const bone1Angle = targetAngle + bendSign * alpha;

  const newMid = {
    x: root.x + Math.cos(bone1Angle) * l1,
    y: root.y + Math.sin(bone1Angle) * l1
  };

  const newEnd = {
    x: root.x + Math.cos(targetAngle) * dist,
    y: root.y + Math.sin(targetAngle) * dist
  };

  return { mid: newMid, end: newEnd };
}

export const DEFAULT_ENVELOPES: Record<AnatomicalJointId, number> = {
  head: 48,
  neck: 24,
  chest: 52,
  shoulder_l: 25,
  shoulder_r: 25,
  elbow_l: 22,
  elbow_r: 22,
  wrist_l: 22,
  wrist_r: 22,
  hand_l: 24,
  hand_r: 24,
  hip_l: 26,
  hip_r: 26,
  knee_l: 24,
  knee_r: 24,
  ankle_l: 24,
  ankle_r: 24,
  foot_l: 26,
  foot_r: 26,
};

/**
 * Creates a rounded capsule path between two points.
 */
export function pathCapsule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * radius;
  const ny = (dx / len) * radius;

  const a1 = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.arc(x1, y1, radius, a1, a1 + Math.PI);
  ctx.arc(x2, y2, radius, a1 + Math.PI, a1 + Math.PI * 2);
  ctx.closePath();
}

/**
 * Poses a joint while strictly preserving all bone lengths.
 */
export function poseJointPreservingBones(
  jointId: AnatomicalJointId,
  targetX: number,
  targetY: number,
  restJoints: Record<AnatomicalJointId, { x: number; y: number }>,
  currentPosed: Record<AnatomicalJointId, { x: number; y: number }>
): Record<AnatomicalJointId, { x: number; y: number }> {
  const result: Record<AnatomicalJointId, { x: number; y: number }> = JSON.parse(JSON.stringify(currentPosed));
  const target = { x: targetX, y: targetY };

  // 1. Wrists (2-Bone IK)
  if (jointId === 'wrist_l') {
    const root = result.shoulder_l;
    const mid = result.elbow_l;
    const end = result.wrist_l;
    const cross = (end.x - root.x) * (mid.y - root.y) - (end.y - root.y) * (mid.x - root.x);
    const bendDir = Math.abs(cross) > 2 ? cross < 0 : true;
    const ik = solveTwoBoneIK(root, mid, end, target, bendDir);
    result.elbow_l = ik.mid;
    result.wrist_l = ik.end;
    if (result.hand_l && restJoints.hand_l && restJoints.wrist_l) {
      result.hand_l = {
        x: result.wrist_l.x + (restJoints.hand_l.x - restJoints.wrist_l.x),
        y: result.wrist_l.y + (restJoints.hand_l.y - restJoints.wrist_l.y)
      };
    }
    return result;
  }
  if (jointId === 'wrist_r') {
    const root = result.shoulder_r;
    const mid = result.elbow_r;
    const end = result.wrist_r;
    const cross = (end.x - root.x) * (mid.y - root.y) - (end.y - root.y) * (mid.x - root.x);
    const bendDir = Math.abs(cross) > 2 ? cross < 0 : false;
    const ik = solveTwoBoneIK(root, mid, end, target, bendDir);
    result.elbow_r = ik.mid;
    result.wrist_r = ik.end;
    if (result.hand_r && restJoints.hand_r && restJoints.wrist_r) {
      result.hand_r = {
        x: result.wrist_r.x + (restJoints.hand_r.x - restJoints.wrist_r.x),
        y: result.wrist_r.y + (restJoints.hand_r.y - restJoints.wrist_r.y)
      };
    }
    return result;
  }

  // 2. Ankles (2-Bone IK)
  if (jointId === 'ankle_l') {
    const root = result.hip_l;
    const mid = result.knee_l;
    const end = result.ankle_l;
    const cross = (end.x - root.x) * (mid.y - root.y) - (end.y - root.y) * (mid.x - root.x);
    const bendDir = Math.abs(cross) > 2 ? cross < 0 : false;
    const ik = solveTwoBoneIK(root, mid, end, target, bendDir);
    result.knee_l = ik.mid;
    result.ankle_l = ik.end;
    if (result.foot_l && restJoints.foot_l && restJoints.ankle_l) {
      result.foot_l = {
        x: result.ankle_l.x + (restJoints.foot_l.x - restJoints.ankle_l.x),
        y: result.ankle_l.y + (restJoints.foot_l.y - restJoints.ankle_l.y)
      };
    }
    return result;
  }
  if (jointId === 'ankle_r') {
    const root = result.hip_r;
    const mid = result.knee_r;
    const end = result.ankle_r;
    const cross = (end.x - root.x) * (mid.y - root.y) - (end.y - root.y) * (mid.x - root.x);
    const bendDir = Math.abs(cross) > 2 ? cross < 0 : true;
    const ik = solveTwoBoneIK(root, mid, end, target, bendDir);
    result.knee_r = ik.mid;
    result.ankle_r = ik.end;
    if (result.foot_r && restJoints.foot_r && restJoints.ankle_r) {
      result.foot_r = {
        x: result.ankle_r.x + (restJoints.foot_r.x - restJoints.ankle_r.x),
        y: result.ankle_r.y + (restJoints.foot_r.y - restJoints.ankle_r.y)
      };
    }
    return result;
  }

  // 3. Elbows (Maintain Upper Arm bone length and carry Forearm/Wrist)
  if (jointId === 'elbow_l' || jointId === 'elbow_r') {
    const isLeft = jointId === 'elbow_l';
    const shoulder = isLeft ? result.shoulder_l : result.shoulder_r;
    const elbow = isLeft ? result.elbow_l : result.elbow_r;
    const wrist = isLeft ? result.wrist_l : result.wrist_r;
    const restShoulder = isLeft ? restJoints.shoulder_l : restJoints.shoulder_r;
    const restElbow = isLeft ? restJoints.elbow_l : restJoints.elbow_r;
    const restWrist = isLeft ? restJoints.wrist_l : restJoints.wrist_r;

    const upperLen = Math.hypot(restElbow.x - restShoulder.x, restElbow.y - restShoulder.y);
    const lowerLen = Math.hypot(restWrist.x - restElbow.x, restWrist.y - restElbow.y);

    const oldAngle = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x);
    const newAngle = Math.atan2(target.y - shoulder.y, target.x - shoulder.x);
    const deltaAngle = newAngle - oldAngle;

    const newElbow = {
      x: shoulder.x + Math.cos(newAngle) * upperLen,
      y: shoulder.y + Math.sin(newAngle) * upperLen
    };

    const oldWristAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const newWristAngle = oldWristAngle + deltaAngle;
    const newWrist = {
      x: newElbow.x + Math.cos(newWristAngle) * lowerLen,
      y: newElbow.y + Math.sin(newWristAngle) * lowerLen
    };

    const hand = isLeft ? result.hand_l : result.hand_r;
    let newHand = hand;
    if (hand) {
      const handDist = Math.hypot(hand.x - wrist.x, hand.y - wrist.y);
      const oldHandAngle = Math.atan2(hand.y - wrist.y, hand.x - wrist.x);
      const newHandAngle = oldHandAngle + deltaAngle;
      newHand = {
        x: newWrist.x + Math.cos(newHandAngle) * handDist,
        y: newWrist.y + Math.sin(newHandAngle) * handDist
      };
    }

    if (isLeft) {
      result.elbow_l = newElbow;
      result.wrist_l = newWrist;
      if (hand) result.hand_l = newHand;
    } else {
      result.elbow_r = newElbow;
      result.wrist_r = newWrist;
      if (hand) result.hand_r = newHand;
    }
    return result;
  }

  // 4. Knees (Maintain Thigh bone length and carry Calf/Ankle)
  if (jointId === 'knee_l' || jointId === 'knee_r') {
    const isLeft = jointId === 'knee_l';
    const hip = isLeft ? result.hip_l : result.hip_r;
    const knee = isLeft ? result.knee_l : result.knee_r;
    const ankle = isLeft ? result.ankle_l : result.ankle_r;
    const restHip = isLeft ? restJoints.hip_l : restJoints.hip_r;
    const restKnee = isLeft ? restJoints.knee_l : restJoints.knee_r;
    const restAnkle = isLeft ? restJoints.ankle_l : restJoints.ankle_r;

    const thighLen = Math.hypot(restKnee.x - restHip.x, restKnee.y - restHip.y);
    const calfLen = Math.hypot(restAnkle.x - restKnee.x, restAnkle.y - restKnee.y);

    const oldAngle = Math.atan2(knee.y - hip.y, knee.x - hip.x);
    const newAngle = Math.atan2(target.y - hip.y, target.x - hip.x);
    const deltaAngle = newAngle - oldAngle;

    const newKnee = {
      x: hip.x + Math.cos(newAngle) * thighLen,
      y: hip.y + Math.sin(newAngle) * thighLen
    };

    const oldAnkleAngle = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
    const newAnkleAngle = oldAnkleAngle + deltaAngle;
    const newAnkle = {
      x: newKnee.x + Math.cos(newAnkleAngle) * calfLen,
      y: newKnee.y + Math.sin(newAnkleAngle) * calfLen
    };

    const foot = isLeft ? result.foot_l : result.foot_r;
    let newFoot = foot;
    if (foot) {
      const footDist = Math.hypot(foot.x - ankle.x, foot.y - ankle.y);
      const oldFootAngle = Math.atan2(foot.y - ankle.y, foot.x - ankle.x);
      const newFootAngle = oldFootAngle + deltaAngle;
      newFoot = {
        x: newAnkle.x + Math.cos(newFootAngle) * footDist,
        y: newAnkle.y + Math.sin(newFootAngle) * footDist
      };
    }

    if (isLeft) {
      result.knee_l = newKnee;
      result.ankle_l = newAnkle;
      if (foot) result.foot_l = newFoot;
    } else {
      result.knee_r = newKnee;
      result.ankle_r = newAnkle;
      if (foot) result.foot_r = newFoot;
    }
    return result;
  }

  // 5. Head (Maintain Neck -> Head bone length and rotate around neck)
  if (jointId === 'head') {
    const neck = result.neck;
    const restNeck = restJoints.neck;
    const restHead = restJoints.head;
    const headLen = Math.hypot(restHead.x - restNeck.x, restHead.y - restNeck.y);

    let headAngle = Math.atan2(target.y - neck.y, target.x - neck.x);
    const restAngle = Math.atan2(restHead.y - restNeck.y, restHead.x - restNeck.x);
    let angleDiff = headAngle - restAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const clampedDiff = Math.max(-1.15, Math.min(1.15, angleDiff));
    headAngle = restAngle + clampedDiff;

    result.head = {
      x: neck.x + Math.cos(headAngle) * headLen,
      y: neck.y + Math.sin(headAngle) * headLen
    };
    return result;
  }

  // 6. Shoulders (Maintain Clavicle distance and rotate arm chain)
  if (jointId === 'shoulder_l' || jointId === 'shoulder_r') {
    const isLeft = jointId === 'shoulder_l';
    const shoulder = isLeft ? result.shoulder_l : result.shoulder_r;
    const anchor = result.chest || result.neck;
    const restAnchor = restJoints.chest || restJoints.neck;
    const restShoulder = isLeft ? restJoints.shoulder_l : restJoints.shoulder_r;
    const clavicleLen = Math.hypot(restShoulder.x - restAnchor.x, restShoulder.y - restAnchor.y);

    const angle = Math.atan2(target.y - anchor.y, target.x - anchor.x);
    const newShoulder = {
      x: anchor.x + Math.cos(angle) * clavicleLen,
      y: anchor.y + Math.sin(angle) * clavicleLen
    };
    const dx = newShoulder.x - shoulder.x;
    const dy = newShoulder.y - shoulder.y;

    if (isLeft) {
      result.shoulder_l = newShoulder;
      result.elbow_l = { x: result.elbow_l.x + dx, y: result.elbow_l.y + dy };
      result.wrist_l = { x: result.wrist_l.x + dx, y: result.wrist_l.y + dy };
      if (result.hand_l) result.hand_l = { x: result.hand_l.x + dx, y: result.hand_l.y + dy };
    } else {
      result.shoulder_r = newShoulder;
      result.elbow_r = { x: result.elbow_r.x + dx, y: result.elbow_r.y + dy };
      result.wrist_r = { x: result.wrist_r.x + dx, y: result.wrist_r.y + dy };
      if (result.hand_r) result.hand_r = { x: result.hand_r.x + dx, y: result.hand_r.y + dy };
    }
    return result;
  }

  // 7. Hips / Root (Translate entire skeleton in unison, preserving complete anatomical structure)
  if (jointId === 'hip_l' || jointId === 'hip_r') {
    const isLeft = jointId === 'hip_l';
    const hip = isLeft ? result.hip_l : result.hip_r;
    const dx = target.x - hip.x;
    const dy = target.y - hip.y;

    for (const key of Object.keys(result) as AnatomicalJointId[]) {
      if (result[key]) {
        result[key] = { x: result[key].x + dx, y: result[key].y + dy };
      }
    }
    return result;
  }

  // 8. Neck (Tilts around Chest, preserving Neck Bone length and carrying Head)
  if (jointId === 'neck') {
    const chest = result.chest || { x: 0, y: result.neck.y + 28 };
    const restChest = restJoints.chest || { x: 0, y: restJoints.neck.y + 28 };
    const restNeck = restJoints.neck;
    const neckLen = Math.hypot(restNeck.x - restChest.x, restNeck.y - restChest.y);

    let neckAngle = Math.atan2(target.y - chest.y, target.x - chest.x);
    const restAngle = Math.atan2(restNeck.y - restChest.y, restNeck.x - restChest.x);
    let angleDiff = neckAngle - restAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const clampedDiff = Math.max(-0.85, Math.min(0.85, angleDiff));
    neckAngle = restAngle + clampedDiff;

    const newNeck = {
      x: chest.x + Math.cos(neckAngle) * neckLen,
      y: chest.y + Math.sin(neckAngle) * neckLen
    };

    const dx = newNeck.x - result.neck.x;
    const dy = newNeck.y - result.neck.y;
    result.neck = newNeck;
    result.head = { x: result.head.x + dx, y: result.head.y + dy };
    return result;
  }

  // Chest / Torso (Tilts around Hip midpoint, strictly preserving Torso Bone length and rotating upper body)
  if (jointId === 'chest') {
    const hipMid = { x: (result.hip_l.x + result.hip_r.x) / 2, y: (result.hip_l.y + result.hip_r.y) / 2 };
    const restHipMid = { x: (restJoints.hip_l.x + restJoints.hip_r.x) / 2, y: (restJoints.hip_l.y + restJoints.hip_r.y) / 2 };
    const restChest = restJoints.chest || { x: 0, y: restJoints.neck.y + 28 };
    const torsoLen = Math.hypot(restChest.x - restHipMid.x, restChest.y - restHipMid.y);

    let torsoAngle = Math.atan2(target.y - hipMid.y, target.x - hipMid.x);
    const restAngle = Math.atan2(restChest.y - restHipMid.y, restChest.x - restHipMid.x);
    let angleDiff = torsoAngle - restAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const clampedDiff = Math.max(-0.75, Math.min(0.75, angleDiff));

    const cos = Math.cos(clampedDiff);
    const sin = Math.sin(clampedDiff);
    const rot = (rPt: { x: number; y: number }) => {
      const rx = rPt.x - restHipMid.x;
      const ry = rPt.y - restHipMid.y;
      return {
        x: hipMid.x + rx * cos - ry * sin,
        y: hipMid.y + rx * sin + ry * cos
      };
    };

    if (result.chest && restJoints.chest) result.chest = rot(restJoints.chest);
    result.neck = rot(restJoints.neck);
    result.head = rot(restJoints.head);
    result.shoulder_l = rot(restJoints.shoulder_l);
    result.shoulder_r = rot(restJoints.shoulder_r);
    result.elbow_l = rot(restJoints.elbow_l);
    result.elbow_r = rot(restJoints.elbow_r);
    result.wrist_l = rot(restJoints.wrist_l);
    result.wrist_r = rot(restJoints.wrist_r);
    if (result.hand_l && restJoints.hand_l) result.hand_l = rot(restJoints.hand_l);
    if (result.hand_r && restJoints.hand_r) result.hand_r = rot(restJoints.hand_r);
    return result;
  }

  // 9. Hand tips (drag hand edge to aim hand and drive entire arm chain via IK)
  if (jointId === 'hand_l' || jointId === 'hand_r') {
    const isLeft = jointId === 'hand_l';
    const shoulder = isLeft ? result.shoulder_l : result.shoulder_r;
    const elbow = isLeft ? result.elbow_l : result.elbow_r;
    const wrist = isLeft ? result.wrist_l : result.wrist_r;
    const restWrist = isLeft ? restJoints.wrist_l : restJoints.wrist_r;
    const restHand = isLeft ? restJoints.hand_l : restJoints.hand_r;
    const handLen = (restHand && restWrist) ? Math.hypot(restHand.x - restWrist.x, restHand.y - restWrist.y) : 28;

    // Vector from shoulder to target
    const armAngle = Math.atan2(target.y - shoulder.y, target.x - shoulder.x);
    const wristTarget = {
      x: target.x - Math.cos(armAngle) * handLen,
      y: target.y - Math.sin(armAngle) * handLen
    };

    // Solve 2-bone IK on shoulder -> elbow -> wrist
    const ik = solveTwoBoneIK(shoulder, elbow, wrist, wristTarget, isLeft);
    if (isLeft) {
      result.elbow_l = ik.mid;
      result.wrist_l = ik.end;
      const aimAngle = Math.atan2(target.y - ik.end.y, target.x - ik.end.x);
      result.hand_l = {
        x: ik.end.x + Math.cos(aimAngle) * handLen,
        y: ik.end.y + Math.sin(aimAngle) * handLen
      };
    } else {
      result.elbow_r = ik.mid;
      result.wrist_r = ik.end;
      const aimAngle = Math.atan2(target.y - ik.end.y, target.x - ik.end.x);
      result.hand_r = {
        x: ik.end.x + Math.cos(aimAngle) * handLen,
        y: ik.end.y + Math.sin(aimAngle) * handLen
      };
    }
    return result;
  }

  // 10. Foot tips (drag foot edge to aim foot and drive entire leg chain via IK)
  if (jointId === 'foot_l' || jointId === 'foot_r') {
    const isLeft = jointId === 'foot_l';
    const hip = isLeft ? result.hip_l : result.hip_r;
    const knee = isLeft ? result.knee_l : result.knee_r;
    const ankle = isLeft ? result.ankle_l : result.ankle_r;
    const restAnkle = isLeft ? restJoints.ankle_l : restJoints.ankle_r;
    const restFoot = isLeft ? restJoints.foot_l : restJoints.foot_r;
    const footLen = (restFoot && restAnkle) ? Math.hypot(restFoot.x - restAnkle.x, restFoot.y - restAnkle.y) : 35;

    // Vector from hip to target
    const legAngle = Math.atan2(target.y - hip.y, target.x - hip.x);
    const ankleTarget = {
      x: target.x - Math.cos(legAngle) * footLen,
      y: target.y - Math.sin(legAngle) * footLen
    };

    // Solve 2-bone IK on hip -> knee -> ankle
    const ik = solveTwoBoneIK(hip, knee, ankle, ankleTarget, !isLeft);
    if (isLeft) {
      result.knee_l = ik.mid;
      result.ankle_l = ik.end;
      const aimAngle = Math.atan2(target.y - ik.end.y, target.x - ik.end.x);
      result.foot_l = {
        x: ik.end.x + Math.cos(aimAngle) * footLen,
        y: ik.end.y + Math.sin(aimAngle) * footLen
      };
    } else {
      result.knee_r = ik.mid;
      result.ankle_r = ik.end;
      const aimAngle = Math.atan2(target.y - ik.end.y, target.x - ik.end.x);
      result.foot_r = {
        x: ik.end.x + Math.cos(aimAngle) * footLen,
        y: ik.end.y + Math.sin(aimAngle) * footLen
      };
    }
    return result;
  }

  return result;
}

/**
 * Poses a joint using pure Forward Kinematics (FK / No-IK), directly rotating bones around
 * their parent joints while strictly preserving bone lengths and carrying descendant child bones.
 * - Dragging foot rotates foot around ankle (tilt / toe-roll / heel-strike).
 * - Dragging ankle rotates calf around knee (carrying foot) without moving knee or hip.
 * - Dragging knee rotates thigh around hip (carrying calf & foot) without moving hip.
 * - Dragging hand rotates hand around wrist without moving wrist, elbow, or shoulder.
 * - Dragging wrist rotates forearm around elbow (carrying hand) without moving elbow or shoulder.
 * - Dragging elbow rotates upper arm around shoulder (carrying forearm & hand).
 */
export function poseJointFK(
  jointId: AnatomicalJointId,
  targetX: number,
  targetY: number,
  restJoints: Record<AnatomicalJointId, { x: number; y: number }>,
  currentPosed: Record<AnatomicalJointId, { x: number; y: number }>
): Record<AnatomicalJointId, { x: number; y: number }> {
  const result: Record<AnatomicalJointId, { x: number; y: number }> = JSON.parse(JSON.stringify(currentPosed));
  const target = { x: targetX, y: targetY };

  // 1. Foot Tips: Rotates foot around ankle pin without moving ankle, knee, or hip
  if (jointId === 'foot_l' || jointId === 'foot_r') {
    const isLeft = jointId === 'foot_l';
    const ankle = isLeft ? result.ankle_l : result.ankle_r;
    const foot = isLeft ? result.foot_l : result.foot_r;
    const restAnkle = isLeft ? restJoints.ankle_l : restJoints.ankle_r;
    const restFoot = isLeft ? restJoints.foot_l : restJoints.foot_r;
    const footLen = (restFoot && restAnkle)
      ? Math.hypot(restFoot.x - restAnkle.x, restFoot.y - restAnkle.y)
      : (foot ? Math.hypot(foot.x - ankle.x, foot.y - ankle.y) : 35);

    const angle = Math.atan2(target.y - ankle.y, target.x - ankle.x);
    const newFoot = {
      x: ankle.x + Math.cos(angle) * footLen,
      y: ankle.y + Math.sin(angle) * footLen
    };

    if (isLeft) {
      result.foot_l = newFoot;
    } else {
      result.foot_r = newFoot;
    }
    return result;
  }

  // 2. Ankles: Rotates calf around knee pin and carries foot along, without moving knee or hip
  if (jointId === 'ankle_l' || jointId === 'ankle_r') {
    const isLeft = jointId === 'ankle_l';
    const knee = isLeft ? result.knee_l : result.knee_r;
    const ankle = isLeft ? result.ankle_l : result.ankle_r;
    const foot = isLeft ? result.foot_l : result.foot_r;
    const restKnee = isLeft ? restJoints.knee_l : restJoints.knee_r;
    const restAnkle = isLeft ? restJoints.ankle_l : restJoints.ankle_r;
    const calfLen = (restAnkle && restKnee)
      ? Math.hypot(restAnkle.x - restKnee.x, restAnkle.y - restKnee.y)
      : Math.hypot(ankle.x - knee.x, ankle.y - knee.y);

    const oldAngle = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
    const newAngle = Math.atan2(target.y - knee.y, target.x - knee.x);
    const deltaAngle = newAngle - oldAngle;

    const newAnkle = {
      x: knee.x + Math.cos(newAngle) * calfLen,
      y: knee.y + Math.sin(newAngle) * calfLen
    };

    let newFoot = foot;
    if (foot) {
      const footDist = Math.hypot(foot.x - ankle.x, foot.y - ankle.y);
      const oldFootAngle = Math.atan2(foot.y - ankle.y, foot.x - ankle.x);
      const newFootAngle = oldFootAngle + deltaAngle;
      newFoot = {
        x: newAnkle.x + Math.cos(newFootAngle) * footDist,
        y: newAnkle.y + Math.sin(newFootAngle) * footDist
      };
    }

    if (isLeft) {
      result.ankle_l = newAnkle;
      if (foot) result.foot_l = newFoot;
    } else {
      result.ankle_r = newAnkle;
      if (foot) result.foot_r = newFoot;
    }
    return result;
  }

  // 3. Hand Tips: Rotates hand around wrist pin without moving wrist, elbow, or shoulder
  if (jointId === 'hand_l' || jointId === 'hand_r') {
    const isLeft = jointId === 'hand_l';
    const wrist = isLeft ? result.wrist_l : result.wrist_r;
    const hand = isLeft ? result.hand_l : result.hand_r;
    const restWrist = isLeft ? restJoints.wrist_l : restJoints.wrist_r;
    const restHand = isLeft ? restJoints.hand_l : restJoints.hand_r;
    const handLen = (restHand && restWrist)
      ? Math.hypot(restHand.x - restWrist.x, restHand.y - restWrist.y)
      : (hand ? Math.hypot(hand.x - wrist.x, hand.y - wrist.y) : 28);

    const angle = Math.atan2(target.y - wrist.y, target.x - wrist.x);
    const newHand = {
      x: wrist.x + Math.cos(angle) * handLen,
      y: wrist.y + Math.sin(angle) * handLen
    };

    if (isLeft) {
      result.hand_l = newHand;
    } else {
      result.hand_r = newHand;
    }
    return result;
  }

  // 4. Wrists: Rotates forearm around elbow pin and carries hand along, without moving elbow or shoulder
  if (jointId === 'wrist_l' || jointId === 'wrist_r') {
    const isLeft = jointId === 'wrist_l';
    const elbow = isLeft ? result.elbow_l : result.elbow_r;
    const wrist = isLeft ? result.wrist_l : result.wrist_r;
    const hand = isLeft ? result.hand_l : result.hand_r;
    const restElbow = isLeft ? restJoints.elbow_l : restJoints.elbow_r;
    const restWrist = isLeft ? restJoints.wrist_l : restJoints.wrist_r;
    const lowerLen = (restWrist && restElbow)
      ? Math.hypot(restWrist.x - restElbow.x, restWrist.y - restElbow.y)
      : Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);

    const oldAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    const newAngle = Math.atan2(target.y - elbow.y, target.x - elbow.x);
    const deltaAngle = newAngle - oldAngle;

    const newWrist = {
      x: elbow.x + Math.cos(newAngle) * lowerLen,
      y: elbow.y + Math.sin(newAngle) * lowerLen
    };

    let newHand = hand;
    if (hand) {
      const handDist = Math.hypot(hand.x - wrist.x, hand.y - wrist.y);
      const oldHandAngle = Math.atan2(hand.y - wrist.y, hand.x - wrist.x);
      const newHandAngle = oldHandAngle + deltaAngle;
      newHand = {
        x: newWrist.x + Math.cos(newHandAngle) * handDist,
        y: newWrist.y + Math.sin(newHandAngle) * handDist
      };
    }

    if (isLeft) {
      result.wrist_l = newWrist;
      if (hand) result.hand_l = newHand;
    } else {
      result.wrist_r = newWrist;
      if (hand) result.hand_r = newHand;
    }
    return result;
  }

  // 5. For all other joints (knees, elbows, head, neck, shoulders, chest, hips),
  // poseJointPreservingBones is already pure Forward Kinematics!
  return poseJointPreservingBones(jointId, targetX, targetY, restJoints, currentPosed);
}

/**
 * Copies joints from front view to target view, performing proper anatomical symmetry reflection.
 */
export function copyJointsFromFront(
  frontJoints: Record<AnatomicalJointId, { x: number; y: number }>,
  targetView: StudioView
): Record<AnatomicalJointId, { x: number; y: number }> {
  const res = {} as Record<AnatomicalJointId, { x: number; y: number }>;

  if (targetView === 'back') {
    // Back view perspective: swap or negate X coordinates so screen-left is character's left limb
    for (const joint of ANATOMICAL_JOINTS) {
      const orig = frontJoints[joint.id] || { x: 0, y: 0 };
      if (joint.isCenter) {
        res[joint.id] = { x: 0, y: orig.y };
      } else {
        res[joint.id] = { x: -orig.x, y: orig.y };
      }
    }
    return res;
  }

// Side view adaptation
  for (const joint of ANATOMICAL_JOINTS) {
    const orig = frontJoints[joint.id] || { x: 0, y: 0 };
    res[joint.id] = { x: orig.x * 0.35, y: orig.y };
  }
  return res;
}

/**
 * Mirrors joint positions across Left and Right sides.
 * - 'horizontal': Mirrors symmetrically across center X axis (swaps symmetrical limbs & negates X, negates center joints X).
 * - 'swap_limbs': Swaps symmetrical limbs' positions without negating X (ideal for walk/run strides on a single side view).
 */
export function mirrorJointPositions(
  joints: Record<AnatomicalJointId, { x: number; y: number }>,
  mode: 'horizontal' | 'swap_limbs' = 'horizontal'
): Record<AnatomicalJointId, { x: number; y: number }> {
  const result = {} as Record<AnatomicalJointId, { x: number; y: number }>;

  for (const joint of ANATOMICAL_JOINTS) {
    const current = joints[joint.id] || { x: 0, y: 0 };
    if (mode === 'swap_limbs') {
      if (joint.isCenter) {
        result[joint.id] = { x: current.x, y: current.y };
      } else if (joint.symmetricWith) {
        const other = joints[joint.symmetricWith] || current;
        result[joint.id] = { x: other.x, y: other.y };
      } else {
        result[joint.id] = { x: current.x, y: current.y };
      }
    } else {
      // Horizontal reflection across center X=0
      if (joint.isCenter) {
        result[joint.id] = { x: -current.x, y: current.y };
      } else if (joint.symmetricWith) {
        const other = joints[joint.symmetricWith] || current;
        result[joint.id] = { x: -other.x, y: other.y };
      } else {
        result[joint.id] = { x: -current.x, y: current.y };
      }
    }
  }

  return result;
}

/**
 * Mirrors attached bone parts to their symmetrical bone counterparts with flipped X alignment.
 */
export function mirrorAttachedParts(
  parts: Record<string, BonePartAttachment>
): Record<string, BonePartAttachment> {
  const mirroredParts: Record<string, BonePartAttachment> = {};

  for (const [boneIdStr, part] of Object.entries(parts)) {
    const boneId = boneIdStr as AnatomicalJointId;
    const jointDef = ANATOMICAL_JOINTS.find(j => j.id === boneId);
    const targetBoneId = (jointDef?.symmetricWith || boneId) as AnatomicalJointId;

    let targetOrigin = part.originJointId;
    if (targetOrigin && targetOrigin !== 'hip_mid') {
      const origDef = ANATOMICAL_JOINTS.find(j => j.id === targetOrigin);
      if (origDef?.symmetricWith) {
        targetOrigin = origDef.symmetricWith;
      }
    }

    let targetTarget = part.targetJointId;
    if (targetTarget) {
      const tgtDef = ANATOMICAL_JOINTS.find(j => j.id === targetTarget);
      if (tgtDef?.symmetricWith) {
        targetTarget = tgtDef.symmetricWith;
      }
    }

    mirroredParts[targetBoneId] = {
      ...part,
      boneId: targetBoneId,
      originJointId: targetOrigin,
      targetJointId: targetTarget,
      offsetX: part.offsetX !== undefined ? -part.offsetX : 0,
      offsetY: part.offsetY ?? 0,
      rotation: part.rotation !== undefined ? -part.rotation : 0,
      pivotX: part.pivotX !== undefined ? Math.round((1 - part.pivotX) * 100) / 100 : undefined,
      flipX: !part.flipX
    };
  }

  return mirroredParts;
}

/**
 * Mirrors the bone layer rendering order, swapping symmetrical bone indices.
 */
export function mirrorBoneLayerOrder(boneOrder: AnatomicalJointId[]): AnatomicalJointId[] {
  return boneOrder.map(bId => {
    const def = ANATOMICAL_JOINTS.find(j => j.id === bId);
    return (def?.symmetricWith || bId) as AnatomicalJointId;
  });
}

/**
 * Mirrors envelope radii across symmetrical joints.
 */
export function mirrorEnvelopes(
  envelopes: Partial<Record<AnatomicalJointId, number>>
): Partial<Record<AnatomicalJointId, number>> {
  const result: Partial<Record<AnatomicalJointId, number>> = {};
  for (const joint of ANATOMICAL_JOINTS) {
    if (joint.symmetricWith && envelopes[joint.symmetricWith] !== undefined) {
      result[joint.id] = envelopes[joint.symmetricWith];
    } else if (envelopes[joint.id] !== undefined) {
      result[joint.id] = envelopes[joint.id];
    }
  }
  return result;
}

/**
 * Suggests an intelligent mirrored name for a character pose (e.g. Front-Right -> Front-Left).
 */
export function suggestMirroredPoseName(currentLabel: string): string {
  const trimmed = currentLabel.trim();
  if (/right/i.test(trimmed)) {
    return trimmed.replace(/right/i, match => (match[0] === 'R' ? 'Left' : 'left'));
  }
  if (/left/i.test(trimmed)) {
    return trimmed.replace(/left/i, match => (match[0] === 'L' ? 'Right' : 'right'));
  }
  if (/_r\b/i.test(trimmed)) {
    return trimmed.replace(/_r\b/i, match => (match[1] === 'R' ? '_L' : '_l'));
  }
  if (/_l\b/i.test(trimmed)) {
    return trimmed.replace(/_l\b/i, match => (match[1] === 'L' ? '_R' : '_r'));
  }
  if (/ r\b/i.test(trimmed)) {
    return trimmed.replace(/ r\b/i, match => (match[1] === 'R' ? ' L' : ' l'));
  }
  if (/ l\b/i.test(trimmed)) {
    return trimmed.replace(/ l\b/i, match => (match[1] === 'L' ? ' R' : ' r'));
  }
  return `${trimmed} (Mirrored)`;
}

/**
 * Suggests an intelligent mirrored identifier for a pose view.
 */
export function suggestMirroredPoseId(currentId: string): string {
  const lower = currentId.toLowerCase();
  if (lower.includes('right')) {
    return lower.replace('right', 'left');
  }
  if (lower.includes('left')) {
    return lower.replace('left', 'right');
  }
  if (lower.endsWith('_r')) {
    return lower.slice(0, -2) + '_l';
  }
  if (lower.endsWith('_l')) {
    return lower.slice(0, -2) + '_r';
  }
  return `${lower}_mirrored`;
}

/**
 * Converts anatomical joints dictionary into SpineBoneData structure for export & runtime engine.
 */
export function convertJointsToSpineBones(
  joints: Record<AnatomicalJointId, { x: number; y: number }>,
  view: StudioView
): SpineBoneData[] {
  const chestY = joints.chest ? joints.chest.y : joints.neck.y;
  const neckY = joints.neck.y;
  const torsoLen = Math.abs(chestY - joints.hip_l.y);
  const neckLen = Math.abs(neckY - chestY) || 28;

  const bones: SpineBoneData[] = [
    { name: 'root', x: 0, y: 0, length: 15, rotation: 0 },
    // Torso / Neck / Head
    {
      name: 'hip',
      parent: 'root',
      x: 0,
      y: (joints.hip_l.y + joints.hip_r.y) / 2,
      length: 20,
      rotation: -90
    },
    {
      name: 'torso',
      parent: 'hip',
      x: 20,
      y: 0,
      length: torsoLen,
      rotation: 0
    },
    {
      name: 'neck',
      parent: 'torso',
      x: torsoLen,
      y: 0,
      length: neckLen,
      rotation: 0
    },
    {
      name: 'head',
      parent: 'neck',
      x: neckLen,
      y: 0,
      length: Math.abs(joints.head.y - neckY) || 28,
      rotation: 0
    },
    // Left Arm
    {
      name: 'arm_upper_l',
      parent: 'torso',
      x: Math.hypot(joints.shoulder_l.x, joints.shoulder_l.y - joints.neck.y),
      y: joints.shoulder_l.x,
      length: Math.hypot(joints.elbow_l.x - joints.shoulder_l.x, joints.elbow_l.y - joints.shoulder_l.y),
      rotation: 170
    },
    {
      name: 'arm_lower_l',
      parent: 'arm_upper_l',
      x: Math.hypot(joints.elbow_l.x - joints.shoulder_l.x, joints.elbow_l.y - joints.shoulder_l.y),
      y: 0,
      length: Math.hypot(joints.wrist_l.x - joints.elbow_l.x, joints.wrist_l.y - joints.elbow_l.y),
      rotation: 5
    },
    {
      name: 'hand_l',
      parent: 'arm_lower_l',
      x: Math.hypot(joints.wrist_l.x - joints.elbow_l.x, joints.wrist_l.y - joints.elbow_l.y),
      y: 0,
      length: 16,
      rotation: 0
    },
    // Right Arm
    {
      name: 'arm_upper_r',
      parent: 'torso',
      x: Math.hypot(joints.shoulder_r.x, joints.shoulder_r.y - joints.neck.y),
      y: joints.shoulder_r.x,
      length: Math.hypot(joints.elbow_r.x - joints.shoulder_r.x, joints.elbow_r.y - joints.shoulder_r.y),
      rotation: 190
    },
    {
      name: 'arm_lower_r',
      parent: 'arm_upper_r',
      x: Math.hypot(joints.elbow_r.x - joints.shoulder_r.x, joints.elbow_r.y - joints.shoulder_r.y),
      y: 0,
      length: Math.hypot(joints.wrist_r.x - joints.elbow_r.x, joints.wrist_r.y - joints.elbow_r.y),
      rotation: -5
    },
    {
      name: 'hand_r',
      parent: 'arm_lower_r',
      x: Math.hypot(joints.wrist_r.x - joints.elbow_r.x, joints.wrist_r.y - joints.elbow_r.y),
      y: 0,
      length: 16,
      rotation: 0
    },
    // Left Leg
    {
      name: 'leg_upper_l',
      parent: 'hip',
      x: 0,
      y: joints.hip_l.x,
      length: Math.hypot(joints.knee_l.x - joints.hip_l.x, joints.knee_l.y - joints.hip_l.y),
      rotation: 180
    },
    {
      name: 'leg_lower_l',
      parent: 'leg_upper_l',
      x: Math.hypot(joints.knee_l.x - joints.hip_l.x, joints.knee_l.y - joints.hip_l.y),
      y: 0,
      length: Math.hypot(joints.ankle_l.x - joints.knee_l.x, joints.ankle_l.y - joints.knee_l.y),
      rotation: 0
    },
    {
      name: 'foot_l',
      parent: 'leg_lower_l',
      x: Math.hypot(joints.ankle_l.x - joints.knee_l.x, joints.ankle_l.y - joints.knee_l.y),
      y: 0,
      length: 16,
      rotation: -60
    },
    // Right Leg
    {
      name: 'leg_upper_r',
      parent: 'hip',
      x: 0,
      y: joints.hip_r.x,
      length: Math.hypot(joints.knee_r.x - joints.hip_r.x, joints.knee_r.y - joints.hip_r.y),
      rotation: 180
    },
    {
      name: 'leg_lower_r',
      parent: 'leg_upper_r',
      x: Math.hypot(joints.knee_r.x - joints.hip_r.x, joints.knee_r.y - joints.hip_r.y),
      y: 0,
      length: Math.hypot(joints.ankle_r.x - joints.knee_r.x, joints.ankle_r.y - joints.knee_r.y),
      rotation: 0
    },
    {
      name: 'foot_r',
      parent: 'leg_lower_r',
      x: Math.hypot(joints.ankle_r.x - joints.knee_r.x, joints.ankle_r.y - joints.knee_r.y),
      y: 0,
      length: 16,
      rotation: 60
    }
  ];

  return bones;
}
