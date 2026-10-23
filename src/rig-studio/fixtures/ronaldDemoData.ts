import { AnatomicalJointId, VectorOutlineElement } from '../types';
import ronaldJson from './sir_ronald_parts.json';

export interface DemoCharacterPartDefinition {
  name: string;
  boneId?: AnatomicalJointId;
  bounds: { x: number; y: number; width: number; height: number };
  pivot: { x: number; y: number };
}

export interface DemoCharacterDefinition {
  characterName: string;
  textureUrl: string;
  fileName: string;
  fileSize: string;
  parts: DemoCharacterPartDefinition[];
}

export const RONALD_DEMO_DATA: DemoCharacterDefinition = ronaldJson as DemoCharacterDefinition;

/**
 * Creates VectorOutlineElement list from external demo parts definition.
 */
export function createRonaldSlicerElements(): VectorOutlineElement[] {
  // Use primary body parts (excluding overlapping alternates) for slicer
  const slicerParts = RONALD_DEMO_DATA.parts.filter(
    p => p.name !== 'Torso Chest (f_torso)' && p.name !== 'Hip / Belt (f_hip)'
  );

  return slicerParts.map((p, i) => {
    const b = p.bounds;
    return {
      id: `ronald_slicer_elem_${i + 1}`,
      name: p.name,
      assignedBoneId: p.boneId,
      polygon: [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height }
      ],
      bounds: b,
      pivot: p.pivot,
      deformationMode: 'cutout'
    };
  });
}
