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
  poseJointFK,
  pathCapsule,
  mirrorJointPositions,
  mirrorAttachedParts,
  mirrorBoneLayerOrder,
  mirrorEnvelopes,
  suggestMirroredPoseName,
  suggestMirroredPoseId
} from '../../../src/rig-studio/rigging/AnatomicalRig';
import { BonePartAttachment } from '../../../src/rig-studio/types';

describe('AnatomicalRig', () => {
  it('defines the anatomical joints and draggable bone edges', () => {
    expect(ANATOMICAL_JOINTS.length).toBe(19);
    const ids = ANATOMICAL_JOINTS.map(j => j.id);
    expect(ids).toContain('head');
    expect(ids).toContain('neck');
    expect(ids).toContain('chest');
    expect(ids).toContain('shoulder_l');
    expect(ids).toContain('shoulder_r');
    expect(ids).toContain('elbow_l');
    expect(ids).toContain('elbow_r');
    expect(ids).toContain('wrist_l');
    expect(ids).toContain('wrist_r');
    expect(ids).toContain('hand_l');
    expect(ids).toContain('hand_r');
    expect(ids).toContain('hip_l');
    expect(ids).toContain('hip_r');
    expect(ids).toContain('knee_l');
    expect(ids).toContain('knee_r');
    expect(ids).toContain('ankle_l');
    expect(ids).toContain('ankle_r');
    expect(ids).toContain('foot_l');
    expect(ids).toContain('foot_r');
  });

  it('configures symmetrical counterpart pairs correctly', () => {
    const shoulderL = ANATOMICAL_JOINTS.find(j => j.id === 'shoulder_l');
    expect(shoulderL?.symmetricWith).toBe('shoulder_r');

    const elbowL = ANATOMICAL_JOINTS.find(j => j.id === 'elbow_l');
    expect(elbowL?.symmetricWith).toBe('elbow_r');

    const wristL = ANATOMICAL_JOINTS.find(j => j.id === 'wrist_l');
    expect(wristL?.symmetricWith).toBe('wrist_r');

    const handL = ANATOMICAL_JOINTS.find(j => j.id === 'hand_l');
    expect(handL?.symmetricWith).toBe('hand_r');

    const hipL = ANATOMICAL_JOINTS.find(j => j.id === 'hip_l');
    expect(hipL?.symmetricWith).toBe('hip_r');

    const kneeL = ANATOMICAL_JOINTS.find(j => j.id === 'knee_l');
    expect(kneeL?.symmetricWith).toBe('knee_r');

    const ankleL = ANATOMICAL_JOINTS.find(j => j.id === 'ankle_l');
    expect(ankleL?.symmetricWith).toBe('ankle_r');

    const footL = ANATOMICAL_JOINTS.find(j => j.id === 'foot_l');
    expect(footL?.symmetricWith).toBe('foot_r');
  });

  it('provides default envelope radii for all 19 joints', () => {
    for (const joint of ANATOMICAL_JOINTS) {
      expect(DEFAULT_ENVELOPES[joint.id]).toBeGreaterThan(10);
    }
  });

  it('generates symmetric default joint positions for front view', () => {
    const frontJoints = getDefaultJointPositions('front', 200, 400);

    // Center joints must have X = 0
    expect(frontJoints.head.x).toBe(0);
    expect(frontJoints.neck.x).toBe(0);
    expect(frontJoints.chest.x).toBe(0);

    // Left and Right limbs must have opposite X coords
    expect(frontJoints.shoulder_l.x).toBeCloseTo(-frontJoints.shoulder_r.x, 1);
    expect(frontJoints.elbow_l.x).toBeCloseTo(-frontJoints.elbow_r.x, 1);
    expect(frontJoints.wrist_l.x).toBeCloseTo(-frontJoints.wrist_r.x, 1);
    expect(frontJoints.hand_l.x).toBeCloseTo(-frontJoints.hand_r.x, 1);
    expect(frontJoints.hip_l.x).toBeCloseTo(-frontJoints.hip_r.x, 1);
    expect(frontJoints.knee_l.x).toBeCloseTo(-frontJoints.knee_r.x, 1);
    expect(frontJoints.ankle_l.x).toBeCloseTo(-frontJoints.ankle_r.x, 1);
    expect(frontJoints.foot_l.x).toBeCloseTo(-frontJoints.foot_r.x, 1);
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
    expect(boneNames).toContain('neck');
    expect(boneNames).toContain('head');
    expect(boneNames).toContain('arm_upper_l');
    expect(boneNames).toContain('arm_lower_l');
    expect(boneNames).toContain('hand_l');
    expect(boneNames).toContain('leg_upper_l');
    expect(boneNames).toContain('leg_lower_l');
    expect(boneNames).toContain('foot_l');
  });

  it('strictly preserves torso bone length when dragging chest/spine in preview mode', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const restHipMid = { x: (rest.hip_l.x + rest.hip_r.x) / 2, y: (rest.hip_l.y + rest.hip_r.y) / 2 };
    const restTorsoLen = Math.hypot(rest.chest.x - restHipMid.x, rest.chest.y - restHipMid.y);

    // Attempt to drag chest 500px away into space
    const posed = poseJointPreservingBones('chest', 120, -500, rest, rest);
    const posedHipMid = { x: (posed.hip_l.x + posed.hip_r.x) / 2, y: (posed.hip_l.y + posed.hip_r.y) / 2 };
    const posedTorsoLen = Math.hypot(posed.chest.x - posedHipMid.x, posed.chest.y - posedHipMid.y);

    expect(posedTorsoLen).toBeCloseTo(restTorsoLen, 1);
  });

  it('strictly preserves neck bone length when dragging neck in preview mode', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const restNeckLen = Math.hypot(rest.neck.x - rest.chest.x, rest.neck.y - rest.chest.y);

    const posed = poseJointPreservingBones('neck', 40, -320, rest, rest);
    const posedNeckLen = Math.hypot(posed.neck.x - posed.chest.x, posed.neck.y - posed.chest.y);

    expect(posedNeckLen).toBeCloseTo(restNeckLen, 1);
  });

  it('translates entire skeleton in unison when dragging hips, preventing body separation', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const posed = poseJointPreservingBones('hip_l', rest.hip_l.x + 50, rest.hip_l.y + 30, rest, rest);

    expect(posed.hip_l.x).toBe(rest.hip_l.x + 50);
    expect(posed.hip_l.y).toBe(rest.hip_l.y + 30);
    expect(posed.chest.x).toBe(rest.chest.x + 50);
    expect(posed.chest.y).toBe(rest.chest.y + 30);
    expect(posed.head.x).toBe(rest.head.x + 50);
    expect(posed.head.y).toBe(rest.head.y + 30);
  });

  it('drives entire arm chain via IK when dragging hand tip', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const origUpperLen = Math.hypot(rest.elbow_l.x - rest.shoulder_l.x, rest.elbow_l.y - rest.shoulder_l.y);
    const origLowerLen = Math.hypot(rest.wrist_l.x - rest.elbow_l.x, rest.wrist_l.y - rest.elbow_l.y);
    const origHandLen = Math.hypot(rest.hand_l.x - rest.wrist_l.x, rest.hand_l.y - rest.wrist_l.y);

    // Drag hand edge outwards to the right and down
    const posed = poseJointPreservingBones('hand_l', 110, -90, rest, rest);

    // Wrist and elbow must move, following the hand
    expect(posed.wrist_l.x).not.toBe(rest.wrist_l.x);
    expect(posed.elbow_l.x).not.toBe(rest.elbow_l.x);

    // All 3 bone lengths in the arm chain must be strictly preserved
    const newUpperLen = Math.hypot(posed.elbow_l.x - posed.shoulder_l.x, posed.elbow_l.y - posed.shoulder_l.y);
    const newLowerLen = Math.hypot(posed.wrist_l.x - posed.elbow_l.x, posed.wrist_l.y - posed.elbow_l.y);
    const newHandLen = Math.hypot(posed.hand_l.x - posed.wrist_l.x, posed.hand_l.y - posed.wrist_l.y);

    expect(newUpperLen).toBeCloseTo(origUpperLen, 1);
    expect(newLowerLen).toBeCloseTo(origLowerLen, 1);
    expect(newHandLen).toBeCloseTo(origHandLen, 1);
  });

  it('drives entire leg chain via IK when dragging foot tip', () => {
    const rest = getDefaultJointPositions('front', 200, 400);
    const origThighLen = Math.hypot(rest.knee_l.x - rest.hip_l.x, rest.knee_l.y - rest.hip_l.y);
    const origCalfLen = Math.hypot(rest.ankle_l.x - rest.knee_l.x, rest.ankle_l.y - rest.knee_l.y);
    const origFootLen = Math.hypot(rest.foot_l.x - rest.ankle_l.x, rest.foot_l.y - rest.ankle_l.y);

    // Drag foot edge out to step forward
    const posed = poseJointPreservingBones('foot_l', 65, -15, rest, rest);

    // Ankle and knee must move, following the foot
    expect(posed.ankle_l.x).not.toBe(rest.ankle_l.x);
    expect(posed.knee_l.x).not.toBe(rest.knee_l.x);

    // All 3 bone lengths in the leg chain must be strictly preserved
    const newThighLen = Math.hypot(posed.knee_l.x - posed.hip_l.x, posed.knee_l.y - posed.hip_l.y);
    const newCalfLen = Math.hypot(posed.ankle_l.x - posed.knee_l.x, posed.ankle_l.y - posed.knee_l.y);
    const newFootLen = Math.hypot(posed.foot_l.x - posed.ankle_l.x, posed.foot_l.y - posed.ankle_l.y);

    expect(newThighLen).toBeCloseTo(origThighLen, 1);
    expect(newCalfLen).toBeCloseTo(origCalfLen, 1);
    expect(newFootLen).toBeCloseTo(origFootLen, 1);
  });

  describe('Pose Mirroring', () => {
    it('mirrors joints horizontally, swapping symmetrical counterparts and reflecting X coordinates', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      // Create an asymmetrical pose: raise left hand high to the right, tilt head right
      const asymmetrical = {
        ...rest,
        head: { x: 15, y: rest.head.y },
        hand_l: { x: 95, y: -250 },
        hand_r: { x: -60, y: -100 }
      };

      const mirrored = mirrorJointPositions(asymmetrical, 'horizontal');

      // Center joints invert X
      expect(mirrored.head.x).toBe(-15);
      expect(mirrored.head.y).toBe(asymmetrical.head.y);

      // Hand L should receive Hand R's position with negated X
      expect(mirrored.hand_l.x).toBe(60); // -(-60)
      expect(mirrored.hand_l.y).toBe(-100);

      // Hand R should receive Hand L's position with negated X
      expect(mirrored.hand_r.x).toBe(-95); // -(95)
      expect(mirrored.hand_r.y).toBe(-250);

      // Shoulder L and R should swap and reflect X
      expect(mirrored.shoulder_l.x).toBeCloseTo(-asymmetrical.shoulder_r.x, 1);
      expect(mirrored.shoulder_r.x).toBeCloseTo(-asymmetrical.shoulder_l.x, 1);
    });

    it('mirrors side view stride by swapping limbs without inverting X', () => {
      const side = getDefaultJointPositions('left', 200, 400);
      // Left leg is forward (x < 0), right leg is back (x > 0)
      const stridePose = {
        ...side,
        foot_l: { x: -30, y: 0 },
        foot_r: { x: 25, y: 0 }
      };

      const mirroredStride = mirrorJointPositions(stridePose, 'swap_limbs');

      // Head should stay facing the same side direction
      expect(mirroredStride.head.x).toBe(side.head.x);

      // Foot L should now take Foot R's position (backwards)
      expect(mirroredStride.foot_l.x).toBe(25);
      expect(mirroredStride.foot_l.y).toBe(0);

      // Foot R should now take Foot L's position (forwards)
      expect(mirroredStride.foot_r.x).toBe(-30);
      expect(mirroredStride.foot_r.y).toBe(0);
    });

    it('mirrors attached parts across counterpart bones with flipped X and negated offsets', () => {
      const parts: Record<string, BonePartAttachment> = {
        shoulder_l: {
          boneId: 'shoulder_l',
          originJointId: 'shoulder_l',
          targetJointId: 'elbow_l',
          image: null as any,
          imageUrl: 'test_arm_l.png',
          fileName: 'test_arm_l.png',
          offsetX: 12,
          offsetY: -5,
          rotation: 0.2,
          pivotX: 0.3,
          pivotY: 0.5,
          flipX: false
        }
      };

      const mirroredParts = mirrorAttachedParts(parts);

      expect(mirroredParts.shoulder_r).toBeDefined();
      expect(mirroredParts.shoulder_l).toBeUndefined();

      const rPart = mirroredParts.shoulder_r;
      expect(rPart.boneId).toBe('shoulder_r');
      expect(rPart.originJointId).toBe('shoulder_r');
      expect(rPart.targetJointId).toBe('elbow_r');
      expect(rPart.offsetX).toBe(-12);
      expect(rPart.offsetY).toBe(-5);
      expect(rPart.rotation).toBeCloseTo(-0.2, 2);
      expect(rPart.pivotX).toBeCloseTo(0.7, 2); // 1 - 0.3
      expect(rPart.flipX).toBe(true);
    });

    it('mirrors bone layer draw order preserving far-to-near limb hierarchy', () => {
      const originalOrder = ['shoulder_r', 'elbow_r', 'chest', 'shoulder_l', 'elbow_l'];
      const mirroredOrder = mirrorBoneLayerOrder(originalOrder as any);

      expect(mirroredOrder).toEqual(['shoulder_l', 'elbow_l', 'chest', 'shoulder_r', 'elbow_r']);
    });

    it('mirrors joint envelope radii across symmetrical pairs', () => {
      const envelopes = {
        shoulder_l: 35,
        shoulder_r: 20,
        chest: 50
      };

      const mirroredEnvelopes = mirrorEnvelopes(envelopes as any);

      expect(mirroredEnvelopes.shoulder_l).toBe(20);
      expect(mirroredEnvelopes.shoulder_r).toBe(35);
      expect(mirroredEnvelopes.chest).toBe(50);
    });

    it('suggests intelligent mirrored names for poses', () => {
      expect(suggestMirroredPoseName('Front-Right')).toBe('Front-Left');
      expect(suggestMirroredPoseName('Back-Right')).toBe('Back-Left');
      expect(suggestMirroredPoseName('Right Side')).toBe('Left Side');
      expect(suggestMirroredPoseName('Walk_Left')).toBe('Walk_Right');
      expect(suggestMirroredPoseName('Walk_R')).toBe('Walk_L');
      expect(suggestMirroredPoseName('Crouch')).toBe('Crouch (Mirrored)');
    });

    it('allows making changes on a mirrored pose using IK bone solver smoothly', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      // Mirror the pose
      const mirrored = mirrorJointPositions(rest, 'horizontal');

      // Now drag wrist_r on the mirrored pose to a reachable position
      const changed = poseJointPreservingBones('wrist_r', -60, -170, mirrored, mirrored);

      expect(changed.wrist_r.x).toBeCloseTo(-60, 0);
      expect(changed.wrist_r.y).toBeCloseTo(-170, 0);
      expect(Number.isFinite(changed.elbow_r.x)).toBe(true);
      expect(Number.isFinite(changed.elbow_r.y)).toBe(true);
    });
  });

  describe('Forward Kinematics (FK / No-IK) Posing', () => {
    it('rotates feet directly without moving ankle, knee, or hip', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      const origAnkleL = { ...rest.ankle_l };
      const origKneeL = { ...rest.knee_l };
      const origHipL = { ...rest.hip_l };
      const restFootLen = Math.hypot(rest.foot_l.x - rest.ankle_l.x, rest.foot_l.y - rest.ankle_l.y);

      // Drag foot_l to point upward/forward (e.g. toe-lift / heel-strike in walk cycle)
      const targetX = rest.ankle_l.x + 30;
      const targetY = rest.ankle_l.y - 10;
      const posed = poseJointFK('foot_l', targetX, targetY, rest, rest);

      // Ankle, Knee, Hip MUST remain completely stationary in FK
      expect(posed.ankle_l.x).toBeCloseTo(origAnkleL.x, 2);
      expect(posed.ankle_l.y).toBeCloseTo(origAnkleL.y, 2);
      expect(posed.knee_l.x).toBeCloseTo(origKneeL.x, 2);
      expect(posed.knee_l.y).toBeCloseTo(origKneeL.y, 2);
      expect(posed.hip_l.x).toBeCloseTo(origHipL.x, 2);
      expect(posed.hip_l.y).toBeCloseTo(origHipL.y, 2);

      // Foot bone length must be preserved exactly
      const posedFootLen = Math.hypot(posed.foot_l.x - posed.ankle_l.x, posed.foot_l.y - posed.ankle_l.y);
      expect(posedFootLen).toBeCloseTo(restFootLen, 1);

      // Foot angle must aim towards target
      const expectedAngle = Math.atan2(targetY - origAnkleL.y, targetX - origAnkleL.x);
      const actualAngle = Math.atan2(posed.foot_l.y - posed.ankle_l.y, posed.foot_l.x - posed.ankle_l.x);
      expect(actualAngle).toBeCloseTo(expectedAngle, 2);
    });

    it('bends calf and rotates ankle around knee without moving knee or hip, carrying foot', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      const origKneeL = { ...rest.knee_l };
      const origHipL = { ...rest.hip_l };
      const restCalfLen = Math.hypot(rest.ankle_l.x - rest.knee_l.x, rest.ankle_l.y - rest.knee_l.y);
      const restFootLen = Math.hypot(rest.foot_l.x - rest.ankle_l.x, rest.foot_l.y - rest.ankle_l.y);

      // Drag ankle_l to bend calf backwards (e.g. walk cycle pass phase)
      const targetX = rest.knee_l.x - 30;
      const targetY = rest.knee_l.y + 40;
      const posed = poseJointFK('ankle_l', targetX, targetY, rest, rest);

      // Knee and Hip must remain stationary
      expect(posed.knee_l.x).toBeCloseTo(origKneeL.x, 2);
      expect(posed.knee_l.y).toBeCloseTo(origKneeL.y, 2);
      expect(posed.hip_l.x).toBeCloseTo(origHipL.x, 2);
      expect(posed.hip_l.y).toBeCloseTo(origHipL.y, 2);

      // Calf bone length and foot bone length must be preserved exactly
      const posedCalfLen = Math.hypot(posed.ankle_l.x - posed.knee_l.x, posed.ankle_l.y - posed.knee_l.y);
      expect(posedCalfLen).toBeCloseTo(restCalfLen, 1);

      const posedFootLen = Math.hypot(posed.foot_l.x - posed.ankle_l.x, posed.foot_l.y - posed.ankle_l.y);
      expect(posedFootLen).toBeCloseTo(restFootLen, 1);
    });

    it('raises knee and rotates thigh around hip, carrying calf and foot without moving hip', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      const origHipL = { ...rest.hip_l };
      const restThighLen = Math.hypot(rest.knee_l.x - rest.hip_l.x, rest.knee_l.y - rest.hip_l.y);
      const restCalfLen = Math.hypot(rest.ankle_l.x - rest.knee_l.x, rest.ankle_l.y - rest.knee_l.y);

      // Drag knee_l to raise knee forward/upward (e.g. walk cycle apex / high knee)
      const targetX = rest.hip_l.x + 35;
      const targetY = rest.hip_l.y + 20;
      const posed = poseJointFK('knee_l', targetX, targetY, rest, rest);

      // Hip must remain stationary
      expect(posed.hip_l.x).toBeCloseTo(origHipL.x, 2);
      expect(posed.hip_l.y).toBeCloseTo(origHipL.y, 2);

      // Thigh bone length and calf bone length must be preserved
      const posedThighLen = Math.hypot(posed.knee_l.x - posed.hip_l.x, posed.knee_l.y - posed.hip_l.y);
      expect(posedThighLen).toBeCloseTo(restThighLen, 1);

      const posedCalfLen = Math.hypot(posed.ankle_l.x - posed.knee_l.x, posed.ankle_l.y - posed.knee_l.y);
      expect(posedCalfLen).toBeCloseTo(restCalfLen, 1);
    });

    it('rotates hands and bends wrists around elbows in FK without displacing upper arm', () => {
      const rest = getDefaultJointPositions('front', 200, 400);
      const origShoulderL = { ...rest.shoulder_l };
      const origElbowL = { ...rest.elbow_l };
      const restHandLen = Math.hypot(rest.hand_l.x - rest.wrist_l.x, rest.hand_l.y - rest.wrist_l.y);

      // Rotate hand_l
      const posedHand = poseJointFK('hand_l', rest.wrist_l.x - 20, rest.wrist_l.y - 10, rest, rest);
      expect(posedHand.wrist_l.x).toBeCloseTo(rest.wrist_l.x, 2);
      expect(posedHand.wrist_l.y).toBeCloseTo(rest.wrist_l.y, 2);
      expect(posedHand.elbow_l.x).toBeCloseTo(origElbowL.x, 2);
      expect(posedHand.elbow_l.y).toBeCloseTo(origElbowL.y, 2);

      const posedHandLen = Math.hypot(posedHand.hand_l.x - posedHand.wrist_l.x, posedHand.hand_l.y - posedHand.wrist_l.y);
      expect(posedHandLen).toBeCloseTo(restHandLen, 1);

      // Bend wrist_l around elbow
      const posedWrist = poseJointFK('wrist_l', rest.elbow_l.x - 40, rest.elbow_l.y - 10, rest, rest);
      expect(posedWrist.elbow_l.x).toBeCloseTo(origElbowL.x, 2);
      expect(posedWrist.elbow_l.y).toBeCloseTo(origElbowL.y, 2);
      expect(posedWrist.shoulder_l.x).toBeCloseTo(origShoulderL.x, 2);
      expect(posedWrist.shoulder_l.y).toBeCloseTo(origShoulderL.y, 2);
    });
  });
});
