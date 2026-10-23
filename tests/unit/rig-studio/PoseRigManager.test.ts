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

  it('provides distinct bone structures per pose with mirror reversal in back pose and profile alignment in side pose', () => {
    const doc = createMockDoc();
    doc.bones = []; // let it initialize from humanoid presets
    const manager = new PoseRigManager(doc);

    // 1. FRONT POSE
    expect(manager.getActivePose()).toBe('front');
    const frontBones = manager.getBones();
    const frontArmR = frontBones.find(b => b.name === 'arm_upper_r');
    const frontArmL = frontBones.find(b => b.name === 'arm_upper_l');
    const frontLegR = frontBones.find(b => b.name === 'leg_upper_r');
    const frontLegL = frontBones.find(b => b.name === 'leg_upper_l');

    // In Front pose: Right limbs are on viewer's LEFT (negative Y in parent's local space = negative X world)
    expect(frontArmR?.y).toBeLessThan(0);
    expect(frontLegR?.y).toBeLessThan(0);
    // Left limbs are on viewer's RIGHT (positive Y in parent's local space = positive X world)
    expect(frontArmL?.y).toBeGreaterThan(0);
    expect(frontLegL?.y).toBeGreaterThan(0);

    // 2. BACK POSE
    manager.setActivePose('back');
    expect(manager.getActivePose()).toBe('back');
    const backBones = manager.getBones();
    const backArmR = backBones.find(b => b.name === 'arm_upper_r');
    const backArmL = backBones.find(b => b.name === 'arm_upper_l');
    const backLegR = backBones.find(b => b.name === 'leg_upper_r');
    const backLegL = backBones.find(b => b.name === 'leg_upper_l');

    // In Back pose: Reversed! Right limbs are on viewer's RIGHT, Left limbs are on viewer's LEFT
    expect(backArmR?.y).toBeGreaterThan(0);
    expect(backLegR?.y).toBeGreaterThan(0);
    expect(backArmL?.y).toBeLessThan(0);
    expect(backLegL?.y).toBeLessThan(0);

    // 3. SIDE POSE
    manager.setActivePose('side');
    expect(manager.getActivePose()).toBe('side');
    const sideBones = manager.getBones();
    const sideFootL = sideBones.find(b => b.name === 'foot_l');
    const sideFootR = sideBones.find(b => b.name === 'foot_r');

    // In Side pose: Feet point forward horizontally (rotation near -90 from lower leg)
    expect(sideFootL?.rotation).toBeLessThan(-80);
    expect(sideFootR?.rotation).toBeLessThan(-80);

    // 4. Custom bone modification in one pose does not corrupt another pose
    const headSide = sideBones.find(b => b.name === 'head')!;
    headSide.x = 99; // modify in side
    manager.saveActivePoseBones();

    manager.setActivePose('front');
    const headFront = manager.getBones().find(b => b.name === 'head')!;
    expect(headFront.x).not.toBe(99);

    manager.setActivePose('side');
    expect(manager.getBones().find(b => b.name === 'head')?.x).toBe(99);
  });

  it('computes smart default alignment rotation and scale for elements', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    // Torso (upward body part) -> rotation: 90
    const torsoElem: VectorOutlineElement = {
      id: 'torso_1',
      name: 'f_torso',
      polygon: [],
      pivot: { x: 50, y: 80 },
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      deformationMode: 'cutout'
    };
    const torsoTransform = manager.computeDefaultElementTransform('torso', torsoElem);
    expect(torsoTransform.rotation).toBe(90);

    // Limb element (e.g. arm or leg pointing downward) -> rotation: -90
    const armBone = manager.addBone('arm_upper_r', 'torso', 10, 0, 25);
    const armElem: VectorOutlineElement = {
      id: 'arm_1',
      name: 'f_arm_upper_r',
      polygon: [],
      pivot: { x: 20, y: 10 },
      bounds: { x: 0, y: 0, width: 40, height: 100 },
      deformationMode: 'cutout'
    };
    const armTransform = manager.computeDefaultElementTransform('arm_upper_r', armElem);
    expect(armTransform.rotation).toBe(-90);
    // 25 / 100 = 0.25 scale
    expect(armTransform.scaleX).toBe(0.25);
  });

  it('auto-aligns all attachments and updates global scale', () => {
    const doc = createMockDoc();
    const manager = new PoseRigManager(doc);

    const torsoElem: VectorOutlineElement = {
      id: 'torso_1',
      name: 'f_torso',
      polygon: [],
      pivot: { x: 50, y: 80 },
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      deformationMode: 'cutout'
    };
    doc.skeleton.questforge!.elements = [torsoElem];

    // Bind with raw default
    manager.bindElementToSlot('torso', torsoElem, 0, 0, 0, 1, 1);
    expect(manager.getSlotAttachment('torso')?.rotation).toBe(0);

    // Auto-align all
    manager.autoAlignAllAttachments(0.25);
    const updated = manager.getSlotAttachment('torso');
    expect(updated?.rotation).toBe(90);
    expect(updated?.scaleX).toBe(0.25);

    // Global scale change
    manager.setGlobalAttachmentScale(0.5);
    expect(manager.getSlotAttachment('torso')?.scaleX).toBe(0.5);
  });

  it('sets default draw order where legs are behind torso and hips, and head/arms are in front', () => {
    const doc = createMockDoc();
    // Add humanoid slots
    doc.slots = [
      { name: 'head', bone: 'head' },
      { name: 'torso', bone: 'torso' },
      { name: 'hip', bone: 'hip' },
      { name: 'arm_upper_r', bone: 'arm_upper_r' },
      { name: 'arm_lower_r', bone: 'arm_lower_r' },
      { name: 'hand_r', bone: 'hand_r' },
      { name: 'arm_upper_l', bone: 'arm_upper_l' },
      { name: 'arm_lower_l', bone: 'arm_lower_l' },
      { name: 'hand_l', bone: 'hand_l' },
      { name: 'leg_upper_r', bone: 'leg_upper_r' },
      { name: 'leg_lower_r', bone: 'leg_lower_r' },
      { name: 'foot_r', bone: 'foot_r' },
      { name: 'leg_upper_l', bone: 'leg_upper_l' },
      { name: 'leg_lower_l', bone: 'leg_lower_l' },
      { name: 'foot_l', bone: 'foot_l' }
    ];

    const manager = new PoseRigManager(doc);

    // Front pose check
    expect(manager.getActivePose()).toBe('front');
    const frontSlots = manager.getSlots().map(s => s.name);
    const torsoIdx = frontSlots.indexOf('torso');
    const hipIdx = frontSlots.indexOf('hip');
    const legUpperR = frontSlots.indexOf('leg_upper_r');
    const legUpperL = frontSlots.indexOf('leg_upper_l');
    const armUpperR = frontSlots.indexOf('arm_upper_r');
    const headIdx = frontSlots.indexOf('head');

    // Legs behind torso & hips (lower slot indices)
    expect(legUpperR).toBeLessThan(torsoIdx);
    expect(legUpperL).toBeLessThan(torsoIdx);
    expect(legUpperR).toBeLessThan(hipIdx);
    expect(legUpperL).toBeLessThan(hipIdx);

    // Head & Arms in front of torso & hips (higher slot indices)
    expect(armUpperR).toBeGreaterThan(torsoIdx);
    expect(headIdx).toBeGreaterThan(torsoIdx);

    // Back pose check
    manager.setActivePose('back');
    const backSlots = manager.getSlots().map(s => s.name);
    const backTorsoIdx = backSlots.indexOf('torso');
    const backHipIdx = backSlots.indexOf('hip');
    const backLegUpperR = backSlots.indexOf('leg_upper_r');
    const backLegUpperL = backSlots.indexOf('leg_upper_l');
    const backHeadIdx = backSlots.indexOf('head');

    expect(backLegUpperR).toBeLessThan(backTorsoIdx);
    expect(backLegUpperL).toBeLessThan(backTorsoIdx);
    expect(backLegUpperR).toBeLessThan(backHipIdx);
    expect(backHeadIdx).toBeGreaterThan(backTorsoIdx);
  });

  it('reorders slots using moveSlot, moveSlotToTop, and moveSlotToBottom', () => {
    const doc = createMockDoc();
    doc.slots = [
      { name: 'slot_a', bone: 'a' },
      { name: 'slot_b', bone: 'b' },
      { name: 'slot_c', bone: 'c' },
      { name: 'slot_d', bone: 'd' }
    ];
    const manager = new PoseRigManager(doc);

    // Initial state: slot_a (0), slot_b (1), slot_c (2), slot_d (3)
    expect(manager.getSlots().map(s => s.name)).toEqual(['slot_a', 'slot_b', 'slot_c', 'slot_d']);

    // Move slot_a forward by 1 (or moveSlot(0, 1))
    manager.moveSlotForward('slot_a');
    expect(manager.getSlots().map(s => s.name)).toEqual(['slot_b', 'slot_a', 'slot_c', 'slot_d']);

    // Move slot_a to top
    manager.moveSlotToTop('slot_a');
    expect(manager.getSlots().map(s => s.name)).toEqual(['slot_b', 'slot_c', 'slot_d', 'slot_a']);

    // Move slot_a backward by 1
    manager.moveSlotBackward('slot_a');
    expect(manager.getSlots().map(s => s.name)).toEqual(['slot_b', 'slot_c', 'slot_a', 'slot_d']);

    // Move slot_d to bottom
    manager.moveSlotToBottom('slot_d');
    expect(manager.getSlots().map(s => s.name)).toEqual(['slot_d', 'slot_b', 'slot_c', 'slot_a']);
  });
});

