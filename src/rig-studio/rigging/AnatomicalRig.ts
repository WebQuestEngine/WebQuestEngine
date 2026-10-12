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
  ['neck', 'hip_l'],
  ['hip_l', 'knee_l'],
  ['knee_l', 'ankle_l'],
  ['neck', 'hip_r'],
  ['hip_r', 'knee_r'],
  ['knee_r', 'ankle_r'],
  ['hip_l', 'hip_r'], // pelvis bridge line
];

/**
 * Returns default anatomical positions scaled and fitted to image bounds.
 * Origin (0,0) is at character ground center (between feet).
 */
export function getDefaultJointPositions(
  view: StudioView = 'front',
  charWidth = 180,
  charHeight = 360
): Record<AnatomicalJointId, { x: number; y: number }> {
  const scale = charHeight / 360;
  const wScale = charWidth / 180;

  // Base reference coords for front standing pose (height 360, ground at y=0, top of head at y=-340)
  const baseFront: Record<AnatomicalJointId, { x: number; y: number }> = {
    head: { x: 0, y: -295 * scale },
    neck: { x: 0, y: -245 * scale },
    shoulder_l: { x: 38 * wScale, y: -230 * scale },
    shoulder_r: { x: -38 * wScale, y: -230 * scale },
    elbow_l: { x: 55 * wScale, y: -160 * scale },
    elbow_r: { x: -55 * wScale, y: -160 * scale },
    wrist_l: { x: 62 * wScale, y: -95 * scale },
    wrist_r: { x: -62 * wScale, y: -95 * scale },
    hip_l: { x: 22 * wScale, y: -130 * scale },
    hip_r: { x: -22 * wScale, y: -130 * scale },
    knee_l: { x: 25 * wScale, y: -65 * scale },
    knee_r: { x: -25 * wScale, y: -65 * scale },
    ankle_l: { x: 28 * wScale, y: -10 * scale },
    ankle_r: { x: -28 * wScale, y: -10 * scale },
  };

  if (view === 'back') {
    // Back view mirrors left/right perspective across X axis
    const back: Record<AnatomicalJointId, { x: number; y: number }> = { ...baseFront };
    for (const joint of ANATOMICAL_JOINTS) {
      if (joint.symmetricWith) {
        // Swap or invert X coordinate for back perspective
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
      head: { x: 4 * dir * wScale, y: -295 * scale },
      neck: { x: 0, y: -245 * scale },
      shoulder_l: { x: 6 * dir * wScale, y: -230 * scale },
      shoulder_r: { x: -6 * dir * wScale, y: -230 * scale },
      elbow_l: { x: 12 * dir * wScale, y: -160 * scale },
      elbow_r: { x: -10 * dir * wScale, y: -160 * scale },
      wrist_l: { x: 18 * dir * wScale, y: -95 * scale },
      wrist_r: { x: -14 * dir * wScale, y: -95 * scale },
      hip_l: { x: 6 * dir * wScale, y: -130 * scale },
      hip_r: { x: -6 * dir * wScale, y: -130 * scale },
      knee_l: { x: 10 * dir * wScale, y: -65 * scale },
      knee_r: { x: -8 * dir * wScale, y: -65 * scale },
      ankle_l: { x: 14 * dir * wScale, y: -10 * scale },
      ankle_r: { x: -10 * dir * wScale, y: -10 * scale },
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
