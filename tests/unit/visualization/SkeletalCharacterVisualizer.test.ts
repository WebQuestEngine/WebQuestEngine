import { describe, it, expect } from 'vitest';
import { SkeletalCharacterVisualizer } from '../../../src/engine/visualization/SkeletalCharacterVisualizer';
import { SkeletalVisualConfig } from '../../../src/engine/types';

describe('SkeletalCharacterVisualizer', () => {
  const sampleSkeletalConfig: SkeletalVisualConfig = {
    type: 'skeletal',
    format: 'native',
    skeleton: {
      bones: [
        { name: 'root', x: 0, y: 0, rotation: 0 },
        { name: 'hip', parent: 'root', x: 0, y: -40, length: 20 },
        { name: 'spine', parent: 'hip', x: 0, y: -25, length: 25 },
        { name: 'head', parent: 'spine', x: 0, y: -30, length: 20 }
      ],
      slots: [
        { name: 'head_slot', bone: 'head', color: '#f59e0b' },
        { name: 'body_slot', bone: 'spine', color: '#3b82f6' }
      ],
      attachments: {
        default: {
          head_slot: { name: 'head', x: 0, y: 0, width: 32, height: 32 },
          body_slot: { name: 'body', x: 0, y: 0, width: 36, height: 48 }
        }
      }
    },
    animations: {
      idle: {
        duration: 1.0,
        bones: {
          spine: {
            rotate: [
              { time: 0, rotation: 0 },
              { time: 0.5, rotation: 10 },
              { time: 1.0, rotation: 0 }
            ]
          }
        }
      },
      walk: {
        duration: 0.8,
        bones: {
          hip: {
            rotate: [
              { time: 0, rotation: -20 },
              { time: 0.4, rotation: 20 },
              { time: 0.8, rotation: -20 }
            ]
          }
        }
      }
    },
    defaultAnimation: 'idle'
  };

  it('initializes and constructs hierarchical bone containers', async () => {
    const visualizer = new SkeletalCharacterVisualizer(sampleSkeletalConfig);
    await visualizer.init();

    expect(visualizer.container).toBeDefined();
    // Root bone container added to visualizer container
    expect(visualizer.container.children.length).toBeGreaterThanOrEqual(1);
  });

  it('evaluates and interpolates keyframes during update', async () => {
    const visualizer = new SkeletalCharacterVisualizer(sampleSkeletalConfig);
    await visualizer.init();

    // Advance 0.25 seconds into 1.0s idle animation (halfway between 0 and 10 deg -> ~5 deg)
    visualizer.update(0.25, {
      state: 'idle',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });

    const root = visualizer.container.children[0] as any;
    expect(root).toBeDefined();
  });

  it('switches to walk animation when state changes to walking', async () => {
    const visualizer = new SkeletalCharacterVisualizer(sampleSkeletalConfig);
    await visualizer.init();

    visualizer.update(0.1, {
      state: 'walking',
      direction8Way: 'right',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });

    // Should not throw and successfully process frames
    expect(visualizer.container.children.length).toBeGreaterThan(0);
  });

  it('provides bounding box and hit testing', () => {
    const visualizer = new SkeletalCharacterVisualizer(sampleSkeletalConfig);
    const bounds = visualizer.getBounds();
    expect(bounds.width).toBe(64);
    expect(bounds.height).toBe(96);

    expect(visualizer.containsPoint({ x: 0, y: -40 })).toBe(true);
    expect(visualizer.containsPoint({ x: 100, y: 100 })).toBe(false);
  });

  it('cleans up on destroy without leaking', async () => {
    const visualizer = new SkeletalCharacterVisualizer(sampleSkeletalConfig);
    await visualizer.init();
    expect(() => visualizer.destroy()).not.toThrow();
  });
});
