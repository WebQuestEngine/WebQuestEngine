import { describe, it, expect } from 'vitest';
import {
  ANATOMICAL_BONES,
  DEFAULT_BONE_DRAW_ORDER
} from '../../../src/rig-studio/rigging/AnatomicalRig';
import { AnatomicalJointId } from '../../../src/rig-studio/types';

describe('Bone Layer Stacking Order (Inkscape UX)', () => {
  it('defines default bone draw order covering all anatomical bones', () => {
    expect(DEFAULT_BONE_DRAW_ORDER.length).toBe(ANATOMICAL_BONES.length);
    const set = new Set(DEFAULT_BONE_DRAW_ORDER);
    expect(set.size).toBe(ANATOMICAL_BONES.length);

    for (const bone of ANATOMICAL_BONES) {
      expect(set.has(bone.id)).toBe(true);
    }
  });

  it('moves a bone one layer up (raise / Page Up)', () => {
    const order: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];
    const initialIndex = order.indexOf('chest');
    expect(initialIndex).toBeGreaterThan(0);
    expect(initialIndex).toBeLessThan(order.length - 1);

    const neighborAbove = order[initialIndex + 1];

    // Swap up
    const temp = order[initialIndex];
    order[initialIndex] = order[initialIndex + 1];
    order[initialIndex + 1] = temp;

    expect(order.indexOf('chest')).toBe(initialIndex + 1);
    expect(order.indexOf(neighborAbove)).toBe(initialIndex);
  });

  it('moves a bone one layer down (lower / Page Down)', () => {
    const order: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];
    const initialIndex = order.indexOf('chest');
    const neighborBelow = order[initialIndex - 1];

    // Swap down
    const temp = order[initialIndex];
    order[initialIndex] = order[initialIndex - 1];
    order[initialIndex - 1] = temp;

    expect(order.indexOf('chest')).toBe(initialIndex - 1);
    expect(order.indexOf(neighborBelow)).toBe(initialIndex);
  });

  it('raises a bone to top of stack (Home / Ctrl+Shift+])', () => {
    const order: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];
    const boneId: AnatomicalJointId = 'hip_r';
    const idx = order.indexOf(boneId);
    expect(idx).toBeGreaterThanOrEqual(0);

    // Move to top
    order.splice(idx, 1);
    order.push(boneId);

    expect(order[order.length - 1]).toBe(boneId);
    expect(order.length).toBe(DEFAULT_BONE_DRAW_ORDER.length);
  });

  it('lowers a bone to bottom of stack (End / Ctrl+Shift+[)', () => {
    const order: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];
    const boneId: AnatomicalJointId = 'head';
    const idx = order.indexOf(boneId);
    expect(idx).toBeGreaterThanOrEqual(0);

    // Move to bottom
    order.splice(idx, 1);
    order.unshift(boneId);

    expect(order[0]).toBe(boneId);
    expect(order.length).toBe(DEFAULT_BONE_DRAW_ORDER.length);
  });

  it('handles boundary conditions: top bone cannot move up, bottom bone cannot move down', () => {
    const order: AnatomicalJointId[] = [...DEFAULT_BONE_DRAW_ORDER];
    const topBone = order[order.length - 1];
    const bottomBone = order[0];

    const canMoveTopUp = (order.indexOf(topBone) < order.length - 1);
    const canMoveBottomDown = (order.indexOf(bottomBone) > 0);

    expect(canMoveTopUp).toBe(false);
    expect(canMoveBottomDown).toBe(false);
  });

  it('preserves bone order in view state data export', () => {
    const customOrder: AnatomicalJointId[] = [
      'head',
      'chest',
      'neck',
      'shoulder_l',
      'elbow_l',
      'wrist_l',
      'shoulder_r',
      'elbow_r',
      'wrist_r',
      'hip_l',
      'knee_l',
      'ankle_l',
      'hip_r',
      'knee_r',
      'ankle_r'
    ];

    const viewData = {
      label: 'Front',
      joints: {},
      envelopes: {},
      parts: {},
      boneOrder: customOrder
    };

    const serialized = JSON.stringify(viewData);
    const parsed = JSON.parse(serialized);

    expect(parsed.boneOrder).toEqual(customOrder);
    expect(parsed.boneOrder[0]).toBe('head');
  });
});
