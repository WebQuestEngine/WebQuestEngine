import { describe, it, expect } from 'vitest';
import { PoseRigManager } from '../../../src/rig-studio/rigging/PoseRigManager';
import { SpineDocument, VectorOutlineElement } from '../../../src/rig-studio/types';

describe('PoseRigManager', () => {
  const createMockDoc = (): SpineDocument => ({
    skeleton: {
      spine: '3.8.99',
      questforge: {
        posePreset: '3-way',
        poseDirections: { front: ['down'], side: ['right', 'left'], back: ['up'] },
        elements: []
      }
    },
    bones: [
      { name: 'root', x: 0, y: 0 },
      { name: 'torso', parent: 'root', x: 0, y: -20 }
    ],
    slots: [
      { name: 'torso', bone: 'torso' }
    ],
    skins: [
      { name: 'front', attachments: {} },
      { name: 'side', attachments: {} },
      { name: 'back', attachments: {} }
    ],
    animations: {}
  });

  it('initializes with default skins and active pose', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    expect(manager.getActivePose()).toBe('front');
    expect(manager.getPoseList()).toEqual(['front', 'side', 'back']);
  });

  it('adds and removes directional poses', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    manager.addPose('three_quarter', ['down_right']);
    expect(manager.getPoseList()).toContain('three_quarter');
    expect(manager.getActivePose()).toBe('three_quarter');

    manager.removePose('three_quarter');
    expect(manager.getPoseList()).not.toContain('three_quarter');
  });

  it('adds a bone with unique name and auto-creates slot', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    const bone = manager.addBone('arm_l', 'torso', -10, -10, 25);
    expect(bone.name).toBe('arm_l');
    expect(bone.parent).toBe('torso');
    expect(manager.getBones().some(b => b.name === 'arm_l')).toBe(true);
    expect(manager.getSlots().some(s => s.name === 'arm_l')).toBe(true);
  });

  it('reparents children when deleting a bone', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    manager.addBone('neck', 'torso');
    manager.addBone('head', 'neck');

    manager.removeBone('neck');
    const head = manager.getBones().find(b => b.name === 'head');
    expect(head?.parent).toBe('torso');
  });

  it('binds and unbinds element to slot in active pose', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    const mockElement: VectorOutlineElement = {
      id: 'elem_1',
      name: 'torso_front',
      polygon: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }, { x: 0, y: 40 }],
      pivot: { x: 15, y: 20 },
      bounds: { x: 0, y: 0, width: 30, height: 40 },
      deformationMode: 'cutout'
    };

    manager.bindElementToSlot('torso', mockElement, 0, 0, 0);
    const attachment = manager.getSlotAttachment('torso');
    expect(attachment).not.toBeNull();
    expect(attachment?.name).toBe('torso_front');
    expect(attachment?.width).toBe(30);

    manager.unbindSlotAttachment('torso');
    expect(manager.getSlotAttachment('torso')).toBeNull();
  });

  it('reorders slots in draw order', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    manager.addSlot('slot_a', 'torso');
    manager.addSlot('slot_b', 'torso');

    const initialSlots = manager.getSlots().map(s => s.name);
    expect(initialSlots).toEqual(['torso', 'slot_a', 'slot_b']);

    manager.moveSlotDrawOrder(2, 0);
    const reorderedSlots = manager.getSlots().map(s => s.name);
    expect(reorderedSlots).toEqual(['slot_b', 'torso', 'slot_a']);
  });
});
