import { describe, it, expect } from 'vitest';
import {
  ANATOMICAL_JOINTS,
  BONE_CONNECTIONS,
  DEFAULT_ENVELOPES,
  getDefaultJointPositions,
  solveTwoBoneIK,
  copyJointsFromFront,
  convertJointsToSpineBones,
  poseJointPreservingBones,
  pathCapsule
} from '../../../src/rig-studio/rigging/AnatomicalRig';

describe('AnatomicalRig', () => {
  it('defines exactly the 14 anatomical joints from the workflow mockup', () => {
    expect(ANATOMICAL_JOINTS.length).toBe(14);
    const ids = ANATOMICAL_JOINTS.map(j => j.id);
    expect(ids).toContain('head');
    expect(ids).toContain('neck');
    expect(ids).toContain('shoulder_l');
    expect(ids).toContain('shoulder_r');
    expect(ids).toContain('elbow_l');
    expect(ids).toContain('elbow_r');
    expect(ids).toContain('wrist_l');
    expect(ids).toContain('wrist_r');
    expect(ids).toContain('hip_l');
    expect(ids).toContain('hip_r');
    expect(ids).toContain('knee_l');
    expect(ids).toContain('knee_r');
    expect(ids).toContain('ankle_l');
    expect(ids).toContain('ankle_r');
  });

  it('configures symmetrical counterpart pairs correctly', () => {
    const shoulderL = ANATOMICAL_JOINTS.find(j => j.id === 'shoulder_l');
    expect(shoulderL?.symmetricWith).toBe('shoulder_r');

    const elbowL = ANATOMICAL_JOINTS.find(j => j.id === 'elbow_l');
    expect(elbowL?.symmetricWith).toBe('elbow_r');

    const wristL = ANATOMICAL_JOINTS.find(j => j.id === 'wrist_l');
    expect(wristL?.symmetricWith).toBe('wrist_r');

    const hipL = ANATOMICAL_JOINTS.find(j => j.id === 'hip_l');
    expect(hipL?.symmetricWith).toBe('hip_r');

    const kneeL = ANATOMICAL_JOINTS.find(j => j.id === 'knee_l');
    expect(kneeL?.symmetricWith).toBe('knee_r');

    const ankleL = ANATOMICAL_JOINTS.find(j => j.id === 'ankle_l');
    expect(ankleL?.symmetricWith).toBe('ankle_r');
  });

  it('provides default envelope radii for all 14 joints', () => {
    for (const joint of ANATOMICAL_JOINTS) {
      expect(DEFAULT_ENVELOPES[joint.id]).toBeGreaterThan(10);
    }
  });

  it('generates symmetric default joint positions for front view', () => {
    const frontJoints = getDefaultJointPositions('front', 200, 400);

    // Center joints must have X = 0
    expect(frontJoints.head.x).toBe(0);
    expect(frontJoints.neck.x).toBe(0);

    // Left and Right limbs must have opposite X coords
    expect(frontJoints.shoulder_l.x).toBeCloseTo(-frontJoints.shoulder_r.x, 1);
    expect(frontJoints.elbow_l.x).toBeCloseTo(-frontJoints.elbow_r.x, 1);
    expect(frontJoints.wrist_l.x).toBeCloseTo(-frontJoints.wrist_r.x, 1);
    expect(frontJoints.hip_l.x).toBeCloseTo(-frontJoints.hip_r.x, 1);
    expect(frontJoints.knee_l.x).toBeCloseTo(-frontJoints.knee_r.x, 1);
    expect(frontJoints.ankle_l.x).toBeCloseTo(-frontJoints.ankle_r.x, 1);
  });

  it('solves 2-bone IK without NaN or exploding distances', () => {
    const root = { x: 38, y: -230 };
    const mid = { x: 55, y: -160 };
    const end = { x: 62, y: -95 };

    const target = { x: 80, y: -140 };
    const ikResult = solveTwoBoneIK(root, mid, end, target, true);

    expect(Number.isFinite(ikResult.mid.x)).toBe(true);
    expect(Number.isFinite(ikResult.mid.y)).toBe(true);
    expect(Number.isFinite(ikResult.end.x)).toBe(true);
    expect(Number.isFinite(ikResult.end.y)).toBe(true);

    const origL1 = Math.hypot(mid.x - root.x, mid.y - root.y);
    const newL1 = Math.hypot(ikResult.mid.x - root.x, ikResult.mid.y - root.y);
    expect(newL1).toBeCloseTo(origL1, 1);
  });

  it('rotates head around neck while strictly preserving bone length in preview mode', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const restHeadLen = Math.hypot(rest.head.x - rest.neck.x, rest.head.y - rest.neck.y);

    // Drag head tilted to the right
    const posed = poseJointPreservingBones('head', 25, -290, rest, rest);
    const posedHeadLen = Math.hypot(posed.head.x - posed.neck.x, posed.head.y - posed.neck.y);

    expect(posed.head.x).not.toBe(rest.head.x);
    expect(posedHeadLen).toBeCloseTo(restHeadLen, 1);
  });

  it('rotates elbow and carries wrist while strictly preserving both upper and lower arm bone lengths', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const origUpperLen = Math.hypot(rest.elbow_l.x - rest.shoulder_l.x, rest.elbow_l.y - rest.shoulder_l.y);
    const origLowerLen = Math.hypot(rest.wrist_l.x - rest.elbow_l.x, rest.wrist_l.y - rest.elbow_l.y);

    // Drag elbow out
    const posed = poseJointPreservingBones('elbow_l', 90, -170, rest, rest);
    const newUpperLen = Math.hypot(posed.elbow_l.x - posed.shoulder_l.x, posed.elbow_l.y - posed.shoulder_l.y);
    const newLowerLen = Math.hypot(posed.wrist_l.x - posed.elbow_l.x, posed.wrist_l.y - posed.elbow_l.y);

    expect(newUpperLen).toBeCloseTo(origUpperLen, 1);
    expect(newLowerLen).toBeCloseTo(origLowerLen, 1);
  });

  it('rotates knee and carries ankle while strictly preserving thigh and calf bone lengths', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const origThighLen = Math.hypot(rest.knee_l.x - rest.hip_l.x, rest.knee_l.y - rest.hip_l.y);
    const origCalfLen = Math.hypot(rest.ankle_l.x - rest.knee_l.x, rest.ankle_l.y - rest.knee_l.y);

    // Drag knee out
    const posed = poseJointPreservingBones('knee_l', 60, -70, rest, rest);
    const newThighLen = Math.hypot(posed.knee_l.x - posed.hip_l.x, posed.knee_l.y - posed.hip_l.y);
    const newCalfLen = Math.hypot(posed.ankle_l.x - posed.knee_l.x, posed.ankle_l.y - posed.knee_l.y);

    expect(newThighLen).toBeCloseTo(origThighLen, 1);
    expect(newCalfLen).toBeCloseTo(origCalfLen, 1);
  });

  it('copies joints from front to back with symmetry perspective reflection', () => {
    const front = getDefaultJointPositions('front', 200, 400);
    const back = copyJointsFromFront(front, 'back');

    expect(back.head.x).toBe(0);
    expect(back.neck.x).toBe(0);

    expect(back.shoulder_l.x).toBeCloseTo(-front.shoulder_l.x, 1);
    expect(back.shoulder_r.x).toBeCloseTo(-front.shoulder_r.x, 1);
  });

  it('converts anatomical joints to valid Spine bones hierarchy', () => {
    const front = getDefaultJointPositions('front', 200, 400);
    const spineBones = convertJointsToSpineBones(front, 'front');

    expect(spineBones.length).toBeGreaterThan(10);
    const boneNames = spineBones.map(b => b.name);
    expect(boneNames).toContain('root');
    expect(boneNames).toContain('hip');
    expect(boneNames).toContain('torso');
    expect(boneNames).toContain('head');
    expect(boneNames).toContain('arm_upper_l');
    expect(boneNames).toContain('arm_lower_l');
    expect(boneNames).toContain('hand_l');
    expect(boneNames).toContain('leg_upper_l');
    expect(boneNames).toContain('leg_lower_l');
    expect(boneNames).toContain('foot_l');
  });
});
