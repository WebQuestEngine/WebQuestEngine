import { describe, it, expect } from 'vitest';
import {
  buildSpineDocument,
  convertStudioAnimationsToSpineTracks,
  SPINE_BONE_NAME_MAP
} from '../../../src/rig-studio/export/SpineExporter';
import { getDefaultJointPositions } from '../../../src/rig-studio/rigging/AnatomicalRig';
import { StudioAnimationDefinition, ViewArtworkData } from '../../../src/rig-studio/types';

describe('SpineExporter', () => {
  it('maps anatomical joints to standard Spine bone names', () => {
    expect(SPINE_BONE_NAME_MAP.chest).toBe('torso');
    expect(SPINE_BONE_NAME_MAP.head).toBe('head');
    expect(SPINE_BONE_NAME_MAP.shoulder_l).toBe('arm_upper_l');
    expect(SPINE_BONE_NAME_MAP.elbow_l).toBe('arm_lower_l');
    expect(SPINE_BONE_NAME_MAP.wrist_l).toBe('hand_l');
    expect(SPINE_BONE_NAME_MAP.hip_r).toBe('leg_upper_r');
  });

  it('generates a valid Spine document structure from minimal state', () => {
    const mockViews: Record<string, ViewArtworkData> = {
      front: {
        viewId: 'front',
        label: 'Front',
        image: null,
        imageUrl: '',
        fileName: '',
        fileSize: '',
        joints: getDefaultJointPositions('front'),
        envelopes: {},
        parts: {},
        visible: true
      }
    };

    const doc = buildSpineDocument({
      views: mockViews,
      facialRig: { scale: 1.0 },
      width: 200,
      height: 400
    });

    expect(doc.skeleton.spine).toBe('3.8.99');
    expect(doc.skeleton.width).toBe(200);
    expect(doc.skeleton.height).toBe(400);
    expect(doc.bones.length).toBeGreaterThan(5);
    expect(doc.slots.length).toBeGreaterThan(5);
    expect(doc.skins.length).toBe(3);
    expect(doc.skeleton.questforge?.facialRig).toEqual({ scale: 1.0 });
    expect(doc.animations.idle).toBeDefined();
  });

  it('converts multi-side studio animations to Spine animation tracks', () => {
    const frontJoints = getDefaultJointPositions('front');
    const mockAnimations: Record<string, StudioAnimationDefinition> = {
      walk: {
        name: 'walk',
        relevantSides: ['front', 'left'],
        tracks: {
          front: {
            duration: 0.8,
            keyframes: [
              { time: 0.0, joints: { ...frontJoints, chest: { x: 0, y: -200 }, neck: { x: 0, y: -230 } } },
              { time: 0.4, joints: { ...frontJoints, chest: { x: 5, y: -200 }, neck: { x: 5, y: -230 } } }
            ]
          },
          left: {
            duration: 0.8,
            keyframes: [
              { time: 0.0, joints: { ...frontJoints } }
            ]
          }
        }
      }
    };

    const tracks = convertStudioAnimationsToSpineTracks(mockAnimations);

    expect(tracks.walk).toBeDefined();
    expect(tracks.walk_left).toBeDefined();
    expect(tracks.walk.bones?.torso?.rotate?.length).toBe(2);
    expect(tracks.walk.bones?.torso?.rotate?.[0].time).toBe(0.0);
    expect(tracks.walk.bones?.torso?.rotate?.[1].time).toBe(0.4);
  });
});
