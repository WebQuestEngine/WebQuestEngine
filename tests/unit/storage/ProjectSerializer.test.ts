import { describe, it, expect } from 'vitest';
import { ProjectSerializer } from '../../../src/engine/storage/ProjectSerializer';

describe('ProjectSerializer', () => {
  it('creates a valid starter project conforming to ProjectData schema', () => {
    const starter = ProjectSerializer.createStarterProject('My Epic Quest', 'Adventure Guy', 'lucasarts');

    expect(starter.title).toBe('My Epic Quest');
    expect(starter.author).toBe('Adventure Guy');
    expect(starter.uiConfig.preset).toBe('lucasarts');
    expect(starter.version).toBe('1.0.0');
    expect(starter.chapters).toHaveLength(1);
    expect(starter.scenes).toHaveLength(1);
    expect(starter.scenes[0].characters).toHaveLength(1);
    expect(starter.scenes[0].walkPaths).toHaveLength(1);
  });

  it('performs roundtrip serialization preserving full fidelity', () => {
    const original = ProjectSerializer.createStarterProject('Roundtrip Test', 'Tester', 'sierra');
    original.scenes[0].hotspots.push({
      id: 'hs_door',
      name: 'Door',
      polygon: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 90 }, { x: 10, y: 90 }],
      actions: {
        lookAt: { text: 'A heavy oak door.' }
      }
    });

    const serialized = ProjectSerializer.serialize(original);
    expect(typeof serialized).toBe('string');

    const deserialized = ProjectSerializer.deserialize(serialized);
    expect(deserialized).toEqual(original);
    expect(deserialized.scenes[0].hotspots[0].id).toBe('hs_door');
  });

  it('throws descriptive error on malformed or missing required fields', () => {
    expect(() => ProjectSerializer.deserialize('{}')).toThrow('Invalid project structure');
    expect(() => ProjectSerializer.deserialize('{"version": "1.0.0"}')).toThrow('Invalid project structure');
    expect(() => ProjectSerializer.deserialize('{"version": "1.0.0", "scenes": []}')).toThrow('Invalid project structure');
  });
});
