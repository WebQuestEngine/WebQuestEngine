import { describe, it, expect } from 'vitest';
import { SkeletalImporter } from '../../../src/engine/visualization/SkeletalImporter';

describe('SkeletalImporter', () => {
  const sampleSpineJson = {
    skeleton: { hash: 'abc123', spine: '3.8.75', width: 64, height: 96 },
    bones: [
      { name: 'root', x: 0, y: 0 },
      { name: 'hip', parent: 'root', x: 0, y: -40, length: 20 },
      { name: 'head', parent: 'hip', x: 0, y: -30, length: 15 }
    ],
    slots: [
      { name: 'head_slot', bone: 'head', attachment: 'head_att' },
      { name: 'hip_slot', bone: 'hip', attachment: 'hip_att' }
    ],
    skins: [
      {
        name: 'default',
        attachments: {
          head_slot: {
            head_att: { x: 0, y: 0, rotation: 0, width: 32, height: 32 }
          }
        }
      }
    ],
    animations: {
      idle: {
        bones: {
          hip: {
            rotate: [{ time: 0, value: 0 }, { time: 0.5, value: 10 }, { time: 1.0, value: 0 }],
            translate: [{ time: 0, x: 0, y: 0 }, { time: 0.5, x: 0, y: -2 }, { time: 1.0, x: 0, y: 0 }]
          }
        }
      },
      walk: {
        bones: {
          hip: {
            rotate: [{ time: 0, value: -15 }, { time: 0.4, value: 15 }, { time: 0.8, value: -15 }]
          }
        }
      }
    }
  };

  const sampleDragonBonesJson = {
    armature: [
      {
        name: 'armatureName',
        bone: [
          { name: 'root', transform: { x: 0, y: 0 } },
          { name: 'torso', parent: 'root', transform: { x: 0, y: -50 } }
        ],
        slot: [
          { name: 'torso_slot', parent: 'torso', color: 'ff0000' }
        ],
        skin: [
          {
            name: 'default',
            slot: [
              {
                name: 'torso_slot',
                display: [{ name: 'torso_display', type: 'image', transform: { x: 0, y: 0 } }]
              }
            ]
          }
        ],
        animation: [
          {
            name: 'walk',
            duration: 24,
            frameRate: 24,
            bone: [
              {
                name: 'torso',
                rotateFrame: [{ rotate: 0 }, { rotate: 10 }, { rotate: 0 }]
              }
            ]
          }
        ]
      }
    ]
  };

  it('detects Spine 2D JSON format correctly', () => {
    expect(SkeletalImporter.detectFormat(sampleSpineJson)).toBe('spine');
  });

  it('detects DragonBones JSON format correctly', () => {
    expect(SkeletalImporter.detectFormat(sampleDragonBonesJson)).toBe('dragonbones');
  });

  it('imports Spine 2D JSON correctly into SkeletalVisualConfig', () => {
    const config = SkeletalImporter.importSpineJson(sampleSpineJson);

    expect(config.type).toBe('skeletal');
    expect(config.format).toBe('spine');
    expect(config.skeleton.bones.length).toBe(3);
    expect(config.skeleton.bones[1].name).toBe('hip');
    expect(config.skeleton.bones[1].parent).toBe('root');
    expect(config.skeleton.slots.length).toBe(2);
    expect(config.animations.idle).toBeDefined();
    expect(config.animations.walk).toBeDefined();
    expect(config.animations.idle.bones.hip.rotate?.length).toBe(3);
    expect(config.animations.idle.bones.hip.translate?.length).toBe(3);
  });

  it('imports DragonBones JSON correctly into SkeletalVisualConfig', () => {
    const config = SkeletalImporter.importDragonBonesJson(sampleDragonBonesJson);

    expect(config.type).toBe('skeletal');
    expect(config.format).toBe('dragonbones');
    expect(config.skeleton.bones.length).toBe(2);
    expect(config.skeleton.bones[1].name).toBe('torso');
    expect(config.skeleton.bones[1].parent).toBe('root');
    expect(config.animations.walk).toBeDefined();
  });

  it('auto-detects and imports via importFromContent', () => {
    const imported = SkeletalImporter.importFromContent(JSON.stringify(sampleSpineJson));
    expect(imported.format).toBe('spine');
    expect(imported.skeleton.bones.length).toBe(3);
  });

  it('throws descriptive error on unsupported format', () => {
    expect(() => SkeletalImporter.importFromContent({ foo: 'bar' })).toThrow(/Unsupported skeletal format/);
  });
});
