import { describe, it, expect } from 'vitest';
import { ProceduralCharacterVisualizer } from '../../../src/engine/visualization/ProceduralCharacterVisualizer';
import { ProceduralVisualConfig } from '../../../src/engine/types';

describe('ProceduralCharacterVisualizer', () => {
  const sampleConfig: ProceduralVisualConfig = {
    type: 'procedural',
    archetype: 'humanoid',
    palette: {
      skin: '#fed7aa',
      hair: '#78350f',
      torso: '#2563eb',
      legs: '#1e293b',
      feet: '#0f172a',
      accent: '#e11d48'
    },
    proportions: {
      headScale: 1,
      bodyWidth: 32,
      bodyHeight: 48,
      limbLength: 30,
      limbThickness: 10
    },
    features: {
      hat: true,
      glasses: true,
      beard: true,
      backpack: true
    }
  };

  it('initializes and constructs container with graphics children', async () => {
    const visualizer = new ProceduralCharacterVisualizer(sampleConfig);
    await visualizer.init();

    expect(visualizer.container).toBeDefined();
    expect(visualizer.container.children.length).toBeGreaterThanOrEqual(5);
  });

  it('calculates correct visual bounds based on body proportions', () => {
    const visualizer = new ProceduralCharacterVisualizer(sampleConfig);
    const bounds = visualizer.getBounds();

    // totalHeight = (headScale * 32) + bodyHeight + limbLength = 32 + 48 + 30 = 110
    expect(bounds.height).toBe(110);
    expect(bounds.width).toBeGreaterThanOrEqual(32);
    expect(bounds.anchorX).toBe(0.5);
    expect(bounds.anchorY).toBe(1.0);
  });

  it('performs accurate containsPoint hit testing', () => {
    const visualizer = new ProceduralCharacterVisualizer(sampleConfig);
    // Point inside the body bounds
    expect(visualizer.containsPoint({ x: 0, y: -50 })).toBe(true);
    // Point far outside
    expect(visualizer.containsPoint({ x: 200, y: -50 })).toBe(false);
    expect(visualizer.containsPoint({ x: 0, y: -200 })).toBe(false);
  });

  it('updates animation states without error (idle, walking, talking)', () => {
    const visualizer = new ProceduralCharacterVisualizer(sampleConfig);

    // Idle
    visualizer.update(0.016, {
      state: 'idle',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });

    // Walking
    visualizer.update(0.016, {
      state: 'walking',
      direction8Way: 'right',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });

    // Talking
    visualizer.update(0.016, {
      state: 'talking',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });

    expect(visualizer.container.children.length).toBeGreaterThan(0);
  });

  it('supports robot archetype rendering', async () => {
    const robotConfig: ProceduralVisualConfig = {
      ...sampleConfig,
      archetype: 'robot'
    };
    const visualizer = new ProceduralCharacterVisualizer(robotConfig);
    await visualizer.init();
    visualizer.update(0.016, {
      state: 'idle',
      direction8Way: 'down',
      isFacingLeft: false,
      currentCustomAnimKey: null,
      scale: 1,
      depthY: 0
    });
    expect(visualizer.container.children.length).toBeGreaterThan(0);
  });
});
