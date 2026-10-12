import { describe, it, expect } from 'vitest';
import {
  ANATOMICAL_JOINTS,
  BONE_CONNECTIONS,
  getDefaultJointPositions,
  solveTwoBoneIK,
  copyJointsFromFront,
  convertJointsToSpineBones
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

    // Move wrist forward and up
    const target = { x: 80, y: -140 };
    const ikResult = solveTwoBoneIK(root, mid, end, target, true);

    expect(Number.isFinite(ikResult.mid.x)).toBe(true);
    expect(Number.isFinite(ikResult.mid.y)).toBe(true);
    expect(Number.isFinite(ikResult.end.x)).toBe(true);
    expect(Number.isFinite(ikResult.end.y)).toBe(true);

    // Length of root -> mid should remain constant
    const origL1 = Math.hypot(mid.x - root.x, mid.y - root.y);
    const newL1 = Math.hypot(ikResult.mid.x - root.x, ikResult.mid.y - root.y);
    expect(newL1).toBeCloseTo(origL1, 1);
  });

  it('copies joints from front to back with symmetry perspective reflection', () => {
    const front = getDefaultJointPositions('front', 200, 400);
    const back = copyJointsFromFront(front, 'back');

    expect(back.head.x).toBe(0);
    expect(back.neck.x).toBe(0);

    // X coordinates should be reflected for back perspective
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
