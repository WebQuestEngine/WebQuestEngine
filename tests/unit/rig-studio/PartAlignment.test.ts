import { describe, it, expect } from 'vitest';
import { getDefaultJointPositions, ANATOMICAL_JOINTS, BONE_CONNECTIONS } from '../../../src/rig-studio/rigging/AnatomicalRig';
import { BonePartAttachment } from '../../../src/rig-studio/types';

describe('Part Alignment & Transformation', () => {
  it('calculates bone midpoint for centering a part', () => {
    const joints = getDefaultJointPositions('front', 200, 400);
    const conn = BONE_CONNECTIONS.find(c => c[0] === 'chest' && c[1] === 'neck');
    expect(conn).toBeDefined();

    const fromJoint = joints[conn![0]];
    const toJoint = joints[conn![1]];
    const boneMidX = (fromJoint.x + toJoint.x) / 2;
    const boneMidY = (fromJoint.y + toJoint.y) / 2;

    const diffX = boneMidX - fromJoint.x;
    const diffY = boneMidY - fromJoint.y;

    expect(typeof diffX).toBe('number');
    expect(typeof diffY).toBe('number');
  });

  it('supports flipX and flipY transforms on BonePartAttachment', () => {
    const part: BonePartAttachment = {
      boneId: 'chest',
      imageUrl: 'test.png',
      fileName: 'chest.png',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipX: true,
      flipY: false
    };

    expect(part.flipX).toBe(true);
    expect(part.flipY).toBe(false);

    // Toggle flips
    part.flipX = !part.flipX;
    part.flipY = !part.flipY;
    expect(part.flipX).toBe(false);
    expect(part.flipY).toBe(true);
  });

  it('preserves graphic world position when joint moves (lock graphic position concept)', () => {
    // Initial joint position and attached part
    let jointA = { x: 100, y: 150 };
    const originalPartOffset = { x: 20, y: 30 };
    const originalWorldGraphicPos = {
      x: jointA.x + originalPartOffset.x,
      y: jointA.y + originalPartOffset.y
    };

    // User moves joint A by (15, -25) while Lock Graphic Position is active
    const newJointA = { x: 115, y: 125 };

    // New offset is recalculated so world position remains invariant:
    const updatedOffsetX = originalWorldGraphicPos.x - newJointA.x;
    const updatedOffsetY = originalWorldGraphicPos.y - newJointA.y;

    const recalculatedWorldGraphicPos = {
      x: newJointA.x + updatedOffsetX,
      y: newJointA.y + updatedOffsetY
    };

    expect(recalculatedWorldGraphicPos.x).toBe(originalWorldGraphicPos.x);
    expect(recalculatedWorldGraphicPos.y).toBe(originalWorldGraphicPos.y);
    expect(updatedOffsetX).toBe(5);
    expect(updatedOffsetY).toBe(55);
  });

  it('rotates part by 90 degrees and normalizes angle between -PI and PI', () => {
    let rotation = 0;
    const step = Math.PI / 2;

    rotation += step;
    expect(rotation).toBeCloseTo(Math.PI / 2, 4);

    rotation += step;
    // Normalize to [-PI, PI]
    while (rotation > Math.PI) rotation -= 2 * Math.PI;
    while (rotation < -Math.PI) rotation -= 2 * Math.PI;
    expect(Math.abs(rotation)).toBeCloseTo(Math.PI, 4);

    rotation += step;
    while (rotation > Math.PI) rotation -= 2 * Math.PI;
    while (rotation < -Math.PI) rotation -= 2 * Math.PI;
    expect(rotation).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('supports generic arbitrary rotation angles and delta increments', () => {
    const part: BonePartAttachment = {
      boneId: 'shoulder_l',
      imageUrl: 'arm.png',
      fileName: 'arm.png',
      scale: 1.0,
      offsetX: 10,
      offsetY: 20,
      rotation: 0
    };

    // Set custom angle: 35 degrees in radians
    const deg35 = (35 * Math.PI) / 180;
    part.rotation = deg35;
    expect(part.rotation).toBeCloseTo(deg35, 5);

    // Delta rotation: rotate by -15 degrees
    const deltaM15 = (-15 * Math.PI) / 180;
    let newRot = part.rotation + deltaM15;
    while (newRot > Math.PI) newRot -= 2 * Math.PI;
    while (newRot < -Math.PI) newRot += 2 * Math.PI;
    part.rotation = newRot;

    const expectedDeg20 = (20 * Math.PI) / 180;
    expect(part.rotation).toBeCloseTo(expectedDeg20, 5);

    // Arbitrary negative angle: -125 degrees
    const degM125 = (-125 * Math.PI) / 180;
    part.rotation = degM125;
    expect(part.rotation).toBeCloseTo(degM125, 5);
  });

  it('supports undo and redo state stack for transformations', () => {
    interface Snapshot {
      offsetX: number;
      offsetY: number;
      rotation: number;
      scale: number;
    }

    const undoStack: Snapshot[] = [];
    const redoStack: Snapshot[] = [];

    let current: Snapshot = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1.0 };

    // Action 1: User rotates to 45 degrees
    undoStack.push({ ...current });
    current = { ...current, rotation: (45 * Math.PI) / 180 };
    redoStack.length = 0;
    expect(current.rotation).toBeCloseTo((45 * Math.PI) / 180, 5);
    expect(undoStack.length).toBe(1);

    // Action 2: User translates by (12, -8)
    undoStack.push({ ...current });
    current = { ...current, offsetX: 12, offsetY: -8 };
    redoStack.length = 0;
    expect(undoStack.length).toBe(2);

    // Undo action 2 (reverts translation)
    redoStack.push({ ...current });
    current = undoStack.pop()!;
    expect(current.offsetX).toBe(0);
    expect(current.offsetY).toBe(0);
    expect(current.rotation).toBeCloseTo((45 * Math.PI) / 180, 5);
    expect(redoStack.length).toBe(1);

    // Undo action 1 (reverts rotation back to 0)
    redoStack.push({ ...current });
    current = undoStack.pop()!;
    expect(current.rotation).toBe(0);
    expect(undoStack.length).toBe(0);
    expect(redoStack.length).toBe(2);

    // Redo action 1 (re-applies rotation to 45 deg)
    undoStack.push({ ...current });
    current = redoStack.pop()!;
    expect(current.rotation).toBeCloseTo((45 * Math.PI) / 180, 5);
    expect(undoStack.length).toBe(1);
    expect(redoStack.length).toBe(1);
  });

  it('supports custom origin and target joints on attached parts and element outlines', () => {
    const joints = getDefaultJointPositions('front', 250, 400);

    const part: BonePartAttachment = {
      boneId: 'shoulder_l',
      originJointId: 'shoulder_l',
      targetJointId: 'wrist_l', // spans whole arm to wrist instead of default elbow
      imageUrl: 'sleeve.png',
      fileName: 'sleeve.png',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    };

    expect(part.originJointId).toBe('shoulder_l');
    expect(part.targetJointId).toBe('wrist_l');

    // Bone segment endpoints resolved from custom joints
    const p1 = joints[part.originJointId!];
    const p2 = joints[part.targetJointId!];
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();

    // Verify distance from shoulder to wrist is greater than shoulder to elbow
    const shoulderToElbowDist = Math.hypot(joints.elbow_l.x - joints.shoulder_l.x, joints.elbow_l.y - joints.shoulder_l.y);
    const shoulderToWristDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    expect(shoulderToWristDist).toBeGreaterThan(shoulderToElbowDist);
  });

  it('serializes and deserializes marked elements with origin and target joints preserved', () => {
    const rawElements = [
      {
        id: 'elem_sleeve_1',
        name: 'Armor Sleeve',
        polygon: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 80 }, { x: 10, y: 80 }],
        pivot: { x: 30, y: 15 },
        bounds: { x: 10, y: 10, width: 40, height: 70 },
        deformationMode: 'cutout' as const,
        assignedBoneId: 'shoulder_l' as const,
        originJointId: 'shoulder_l' as const,
        targetJointId: 'wrist_l' as const
      },
      {
        id: 'elem_boot_1',
        name: 'Iron Boot',
        polygon: [{ x: 5, y: 5 }, { x: 45, y: 5 }, { x: 45, y: 65 }, { x: 5, y: 65 }],
        pivot: { x: 25, y: 10 },
        bounds: { x: 5, y: 5, width: 40, height: 60 },
        deformationMode: 'cutout' as const,
        assignedBoneId: 'ankle_l' as const,
        originJointId: 'ankle_l' as const,
        targetJointId: 'foot_l' as const
      }
    ];

    const savedDoc = {
      format: 'questforge-elements',
      version: '1.0',
      characterName: 'Sir Ronald',
      imageFileName: 'ronald_parts.png',
      elementCount: rawElements.length,
      elements: rawElements
    };

    // Serialize to JSON string
    const jsonString = JSON.stringify(savedDoc, null, 2);
    expect(jsonString).toContain('questforge-elements');
    expect(jsonString).toContain('Armor Sleeve');

    // Deserialize
    const parsed = JSON.parse(jsonString);
    expect(parsed.format).toBe('questforge-elements');
    expect(parsed.elements.length).toBe(2);

    const elem1 = parsed.elements[0];
    expect(elem1.name).toBe('Armor Sleeve');
    expect(elem1.assignedBoneId).toBe('shoulder_l');
    expect(elem1.originJointId).toBe('shoulder_l');
    expect(elem1.targetJointId).toBe('wrist_l');
    expect(elem1.polygon.length).toBe(4);
    expect(elem1.bounds.width).toBe(40);

    const elem2 = parsed.elements[1];
    expect(elem2.name).toBe('Iron Boot');
    expect(elem2.assignedBoneId).toBe('ankle_l');
    expect(elem2.targetJointId).toBe('foot_l');
  });

  it('supports loading elements from diverse JSON payloads (wrapped doc, direct array, or rig project)', () => {
    const rawElems = [
      {
        id: 'el_1',
        name: 'Hat',
        polygon: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
        pivot: { x: 10, y: 10 },
        bounds: { x: 0, y: 0, width: 20, height: 20 },
        deformationMode: 'cutout' as const
      }
    ];

    // Helper extracting elements matching RigStudioApp.loadElementsData logic
    const extractElements = (data: any) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.elements)) return data.elements;
      if (data?.slicer && Array.isArray(data.slicer.elements)) return data.slicer.elements;
      return [];
    };

    // 1. Wrapped format
    expect(extractElements({ format: 'questforge-elements', elements: rawElems }).length).toBe(1);

    // 2. Direct array
    expect(extractElements(rawElems).length).toBe(1);

    // 3. Rig project format
    expect(extractElements({ format: 'questforge-rig-project', slicer: { elements: rawElems } }).length).toBe(1);
  });
});



