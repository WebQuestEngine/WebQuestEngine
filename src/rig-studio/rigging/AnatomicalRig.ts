import { AnatomicalJointDef, AnatomicalJointId, StudioView, SpineDocument, SpineBoneData } from '../types';

export const ANATOMICAL_JOINTS: AnatomicalJointDef[] = [
  { id: 'head', name: 'Head', color: '#22c55e', parentId: 'neck', isCenter: true },
  { id: 'neck', name: 'Neck', color: '#4ade80', isCenter: true },
  { id: 'shoulder_l', name: 'Shoulder L', color: '#eab308', parentId: 'neck', symmetricWith: 'shoulder_r' },
  { id: 'shoulder_r', name: 'Shoulder R', color: '#eab308', parentId: 'neck', symmetricWith: 'shoulder_l' },
  { id: 'elbow_l', name: 'Elbow L', color: '#f97316', parentId: 'shoulder_l', symmetricWith: 'elbow_r' },
  { id: 'elbow_r', name: 'Elbow R', color: '#f97316', parentId: 'shoulder_r', symmetricWith: 'elbow_l' },
  { id: 'wrist_l', name: 'Wrist L', color: '#a855f7', parentId: 'elbow_l', symmetricWith: 'wrist_r' },
  { id: 'wrist_r', name: 'Wrist R', color: '#a855f7', parentId: 'elbow_r', symmetricWith: 'wrist_l' },
  { id: 'hip_l', name: 'Hip L', color: '#3b82f6', parentId: 'neck', symmetricWith: 'hip_r' },
  { id: 'hip_r', name: 'Hip R', color: '#3b82f6', parentId: 'neck', symmetricWith: 'hip_l' },
  { id: 'knee_l', name: 'Knee L', color: '#ef4444', parentId: 'hip_l', symmetricWith: 'knee_r' },
  { id: 'knee_r', name: 'Knee R', color: '#ef4444', parentId: 'hip_r', symmetricWith: 'knee_l' },
  { id: 'ankle_l', name: 'Ankle L', color: '#d97706', parentId: 'knee_l', symmetricWith: 'ankle_r' },
  { id: 'ankle_r', name: 'Ankle R', color: '#d97706', parentId: 'knee_r', symmetricWith: 'ankle_l' },
];

export const BONE_CONNECTIONS: [AnatomicalJointId, AnatomicalJointId][] = [
  ['neck', 'head'],
  ['neck', 'shoulder_l'],
  ['shoulder_l', 'elbow_l'],
  ['elbow_l', 'wrist_l'],
  ['neck', 'shoulder_r'],
  ['shoulder_r', 'elbow_r'],
  ['elbow_r', 'wrist_r'],
  ['hip_l', 'knee_l'],
  ['knee_l', 'ankle_l'],
  ['hip_r', 'knee_r'],
  ['knee_r', 'ankle_r'],
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
  { id: 'head', name: 'Head Bone', originJointId: 'neck', targetJointId: 'head', category: 'spine', description: 'Starts from Neck joint, extends to head pivot' },
  { id: 'neck', name: 'Torso Bone', originJointId: 'hip_mid', targetJointId: 'neck', category: 'spine', description: 'Starts from Hip midpoint, extends to Neck joint' },
  { id: 'shoulder_l', name: 'Left Upper Arm Bone', originJointId: 'shoulder_l', targetJointId: 'elbow_l', category: 'arm', description: 'Starts from Shoulder L joint, extends to Elbow L joint' },
  { id: 'elbow_l', name: 'Left Forearm Bone', originJointId: 'elbow_l', targetJointId: 'wrist_l', category: 'arm', description: 'Starts from Elbow L joint, extends to Wrist L joint' },
  { id: 'wrist_l', name: 'Left Hand Bone', originJointId: 'wrist_l', defaultLength: 28, category: 'arm', description: 'Starts from Wrist L joint, wrapped in Hand envelope' },
  { id: 'shoulder_r', name: 'Right Upper Arm Bone', originJointId: 'shoulder_r', targetJointId: 'elbow_r', category: 'arm', description: 'Starts from Shoulder R joint, extends to Elbow R joint' },
  { id: 'elbow_r', name: 'Right Forearm Bone', originJointId: 'elbow_r', targetJointId: 'wrist_r', category: 'arm', description: 'Starts from Elbow R joint, extends to Wrist R joint' },
  { id: 'wrist_r', name: 'Right Hand Bone', originJointId: 'wrist_r', defaultLength: 28, category: 'arm', description: 'Starts from Wrist R joint, wrapped in Hand envelope' },
  { id: 'hip_l', name: 'Left Thigh Bone', originJointId: 'hip_l', targetJointId: 'knee_l', category: 'leg', description: 'Starts from Hip L joint, extends to Knee L joint' },
  { id: 'knee_l', name: 'Left Calf Bone', originJointId: 'knee_l', targetJointId: 'ankle_l', category: 'leg', description: 'Starts from Knee L joint, extends to Ankle L joint' },
  { id: 'ankle_l', name: 'Left Foot Bone', originJointId: 'ankle_l', defaultLength: 36, category: 'leg', description: 'Starts from Ankle L joint, wrapped in Foot envelope' },
  { id: 'hip_r', name: 'Right Thigh Bone', originJointId: 'hip_r', targetJointId: 'knee_r', category: 'leg', description: 'Starts from Hip R joint, extends to Knee R joint' },
  { id: 'knee_r', name: 'Right Calf Bone', originJointId: 'knee_r', targetJointId: 'ankle_r', category: 'leg', description: 'Starts from Knee R joint, extends to Ankle R joint' },
  { id: 'ankle_r', name: 'Right Foot Bone', originJointId: 'ankle_r', defaultLength: 36, category: 'leg', description: 'Starts from Ankle R joint, wrapped in Foot envelope' },
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
    head: { x: 0, y: -305 * scale },
    neck: { x: 0, y: -245 * scale },
    shoulder_l: { x: 28 * wScale, y: -238 * scale },
    shoulder_r: { x: -28 * wScale, y: -238 * scale },
    elbow_l: { x: 52 * wScale, y: -188 * scale },
    elbow_r: { x: -52 * wScale, y: -188 * scale },
    wrist_l: { x: 74 * wScale, y: -136 * scale },
    wrist_r: { x: -74 * wScale, y: -136 * scale },
    hip_l: { x: 20 * wScale, y: -155 * scale },
    hip_r: { x: -20 * wScale, y: -155 * scale },
    knee_l: { x: 24 * wScale, y: -95 * scale },
    knee_r: { x: -24 * wScale, y: -95 * scale },
    ankle_l: { x: 28 * wScale, y: -35 * scale },
    ankle_r: { x: -28 * wScale, y: -35 * scale },
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
      head: { x: 4 * dir * wScale, y: -305 * scale },
      neck: { x: 0, y: -245 * scale },
      shoulder_l: { x: 4 * dir * wScale, y: -238 * scale },
      shoulder_r: { x: -4 * dir * wScale, y: -238 * scale },
      elbow_l: { x: 18 * dir * wScale, y: -188 * scale },
      elbow_r: { x: -16 * dir * wScale, y: -188 * scale },
      wrist_l: { x: 28 * dir * wScale, y: -136 * scale },
      wrist_r: { x: -24 * dir * wScale, y: -136 * scale },
      hip_l: { x: 4 * dir * wScale, y: -155 * scale },
      hip_r: { x: -4 * dir * wScale, y: -155 * scale },
      knee_l: { x: 8 * dir * wScale, y: -95 * scale },
      knee_r: { x: -6 * dir * wScale, y: -95 * scale },
      ankle_l: { x: 10 * dir * wScale, y: -35 * scale },
      ankle_r: { x: -8 * dir * wScale, y: -35 * scale },
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
  bendPositive = true
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

  const bendSign = bendPositive ? 1 : -1;
  const bone1Angle = targetAngle + bendSign * alpha;

  const newMid = {
    x: root.x + Math.cos(bone1Angle) * l1,
    y: root.y + Math.sin(bone1Angle) * l1
  };

  // Law of Cosines for angle at mid (cos beta)
  const cosBeta = (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2);
  const beta = Math.acos(Math.max(-1, Math.min(1, cosBeta)));
  const bone2Angle = bone1Angle + Math.PI - bendSign * beta;

  const newEnd = {
    x: newMid.x + Math.cos(bone2Angle) * l2,
    y: newMid.y + Math.sin(bone2Angle) * l2
  };

  return { mid: newMid, end: newEnd };
}

export const DEFAULT_ENVELOPES: Record<AnatomicalJointId, number> = {
  head: 32,
  neck: 36,
  shoulder_l: 18,
  shoulder_r: 18,
  elbow_l: 16,
  elbow_r: 16,
  wrist_l: 18,
  wrist_r: 18,
  hip_l: 22,
  hip_r: 22,
  knee_l: 18,
  knee_r: 18,
  ankle_l: 20,
  ankle_r: 20,
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
    const ik = solveTwoBoneIK(root, mid, end, target, true);
    result.elbow_l = ik.mid;
    result.wrist_l = ik.end;
    return result;
  }
  if (jointId === 'wrist_r') {
    const root = result.shoulder_r;
    const mid = result.elbow_r;
    const end = result.wrist_r;
    const ik = solveTwoBoneIK(root, mid, end, target, false);
    result.elbow_r = ik.mid;
    result.wrist_r = ik.end;
    return result;
  }

  // 2. Ankles (2-Bone IK)
  if (jointId === 'ankle_l') {
    const root = result.hip_l;
    const mid = result.knee_l;
    const end = result.ankle_l;
    const ik = solveTwoBoneIK(root, mid, end, target, false);
    result.knee_l = ik.mid;
    result.ankle_l = ik.end;
    return result;
  }
  if (jointId === 'ankle_r') {
    const root = result.hip_r;
    const mid = result.knee_r;
    const end = result.ankle_r;
    const ik = solveTwoBoneIK(root, mid, end, target, true);
    result.knee_r = ik.mid;
    result.ankle_r = ik.end;
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

    if (isLeft) {
      result.elbow_l = newElbow;
      result.wrist_l = newWrist;
    } else {
      result.elbow_r = newElbow;
      result.wrist_r = newWrist;
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

    if (isLeft) {
      result.knee_l = newKnee;
      result.ankle_l = newAnkle;
    } else {
      result.knee_r = newKnee;
      result.ankle_r = newAnkle;
    }
    return result;
  }

  // 5. Head (Maintain Neck -> Head bone length and rotate around neck)
  if (jointId === 'head') {
    const neck = result.neck;
    const restNeck = restJoints.neck;
    const restHead = restJoints.head;
    const headLen = Math.hypot(restHead.x - restNeck.x, restHead.y - restNeck.y);

    const headAngle = Math.atan2(target.y - neck.y, target.x - neck.x);
    result.head = {
      x: neck.x + Math.cos(headAngle) * headLen,
      y: neck.y + Math.sin(headAngle) * headLen
    };
    return result;
  }

  // 6. Shoulders (Maintain Clavicle distance and translate entire arm chain)
  if (jointId === 'shoulder_l' || jointId === 'shoulder_r') {
    const isLeft = jointId === 'shoulder_l';
    const shoulder = isLeft ? result.shoulder_l : result.shoulder_r;
    const neck = result.neck;
    const restNeck = restJoints.neck;
    const restShoulder = isLeft ? restJoints.shoulder_l : restJoints.shoulder_r;
    const clavicleLen = Math.hypot(restShoulder.x - restNeck.x, restShoulder.y - restNeck.y);

    const angle = Math.atan2(target.y - neck.y, target.x - neck.x);
    const newShoulder = {
      x: neck.x + Math.cos(angle) * clavicleLen,
      y: neck.y + Math.sin(angle) * clavicleLen
    };
    const dx = newShoulder.x - shoulder.x;
    const dy = newShoulder.y - shoulder.y;

    if (isLeft) {
      result.shoulder_l = newShoulder;
      result.elbow_l = { x: result.elbow_l.x + dx, y: result.elbow_l.y + dy };
      result.wrist_l = { x: result.wrist_l.x + dx, y: result.wrist_l.y + dy };
    } else {
      result.shoulder_r = newShoulder;
      result.elbow_r = { x: result.elbow_r.x + dx, y: result.elbow_r.y + dy };
      result.wrist_r = { x: result.wrist_r.x + dx, y: result.wrist_r.y + dy };
    }
    return result;
  }

  // 7. Hips (Translate entire pelvis and both legs together, preserving rigid pelvis structure)
  if (jointId === 'hip_l' || jointId === 'hip_r') {
    const isLeft = jointId === 'hip_l';
    const hip = isLeft ? result.hip_l : result.hip_r;
    const dx = target.x - hip.x;
    const dy = target.y - hip.y;

    // Both hips move together in lockstep so pelvis width never breaks
    result.hip_l = { x: result.hip_l.x + dx, y: result.hip_l.y + dy };
    result.knee_l = { x: result.knee_l.x + dx, y: result.knee_l.y + dy };
    result.ankle_l = { x: result.ankle_l.x + dx, y: result.ankle_l.y + dy };

    result.hip_r = { x: result.hip_r.x + dx, y: result.hip_r.y + dy };
    result.knee_r = { x: result.knee_r.x + dx, y: result.knee_r.y + dy };
    result.ankle_r = { x: result.ankle_r.x + dx, y: result.ankle_r.y + dy };
    return result;
  }

  // 8. Neck (Upper body translation carrying head and both arms rigidly)
  if (jointId === 'neck') {
    const dx = target.x - result.neck.x;
    const dy = target.y - result.neck.y;

    result.neck = { x: target.x, y: target.y };
    result.head = { x: result.head.x + dx, y: result.head.y + dy };
    result.shoulder_l = { x: result.shoulder_l.x + dx, y: result.shoulder_l.y + dy };
    result.elbow_l = { x: result.elbow_l.x + dx, y: result.elbow_l.y + dy };
    result.wrist_l = { x: result.wrist_l.x + dx, y: result.wrist_l.y + dy };
    result.shoulder_r = { x: result.shoulder_r.x + dx, y: result.shoulder_r.y + dy };
    result.elbow_r = { x: result.elbow_r.x + dx, y: result.elbow_r.y + dy };
    result.wrist_r = { x: result.wrist_r.x + dx, y: result.wrist_r.y + dy };
    return result;
  }

  return result;
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
 * Converts anatomical joints dictionary into SpineBoneData structure for export & runtime engine.
 */
export function convertJointsToSpineBones(
  joints: Record<AnatomicalJointId, { x: number; y: number }>,
  view: StudioView
): SpineBoneData[] {
  const bones: SpineBoneData[] = [
    { name: 'root', x: 0, y: 0, length: 15, rotation: 0 },
    // Torso / Neck
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
      length: Math.abs(joints.neck.y - joints.hip_l.y),
      rotation: 0
    },
    {
      name: 'head',
      parent: 'torso',
      x: Math.abs(joints.head.y - joints.neck.y),
      y: 0,
      length: 28,
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
