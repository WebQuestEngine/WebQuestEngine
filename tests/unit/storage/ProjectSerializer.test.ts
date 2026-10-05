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

  it('normalizes legacy isRouterNode and single mutation flags during deserialization', () => {
    const rawJson = JSON.stringify({
      version: '1.0.0',
      title: 'Legacy Quest',
      author: 'Old Author',
      startChapterId: 'ch_1',
      chapters: [{ id: 'ch_1', title: 'Chapter 1' }],
      scenes: [
        {
          id: 'sc_1',
          name: 'Scene 1',
          hotspots: [
            {
              id: 'hs_chest',
              name: 'Chest',
              actions: [
                {
                  verb: 'interact',
                  setFlag: 'chest_opened',
                  clearFlag: 'chest_locked',
                  giveItemId: 'key_gold'
                }
              ]
            }
          ],
          characters: []
        }
      ],
      dialogs: [
        {
          id: 'dlg_1',
          title: 'Dialog 1',
          startNodeId: 'node_router',
          nodes: {
            node_router: {
              id: 'node_router',
              isRouterNode: true,
              choices: [
                {
                  id: 'c1',
                  text: 'Choice 1',
                  nextNodeId: 'node_beat',
                  setFlag: 'talked_to_guard',
                  giveItem: 'badge'
                }
              ]
            },
            node_beat: {
              id: 'node_beat',
              speaker: 'Guard',
              text: 'Move along.',
              setFlag: 'guard_dismissed'
            }
          }
        }
      ]
    });

    const project = ProjectSerializer.deserialize(rawJson);

    // 1. Hotspot actions normalized
    const action = project.scenes[0].hotspots[0].actions[0];
    expect(action.setFlags).toContain('chest_opened');
    expect(action.clearFlags).toContain('chest_locked');
    expect(action.giveItems).toContain('key_gold');

    // 2. Dialog nodeType normalized from isRouterNode
    const routerNode = project.dialogs[0].nodes['node_router'];
    expect(routerNode.nodeType).toBe('router');
    expect(routerNode.choices![0].setFlags).toContain('talked_to_guard');
    expect(routerNode.choices![0].giveItems).toContain('badge');

    // 3. Beat nodeType defaulted to 'beat' and flags normalized
    const beatNode = project.dialogs[0].nodes['node_beat'];
    expect(beatNode.nodeType).toBe('beat');
    expect(beatNode.setFlags).toContain('guard_dismissed');
  });
});
