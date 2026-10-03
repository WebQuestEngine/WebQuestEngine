import { describe, it, expect } from 'vitest';
import demoProject from '../../demo/the_alchemist\'s_mystery.json';
import { ProjectData } from '../../src/engine/types';

describe('Project Referential Integrity (The Alchemist\'s Mystery)', () => {
  const project = demoProject as unknown as ProjectData;

  it('has valid top-level metadata', () => {
    expect(project.version).toBeDefined();
    expect(project.title).toBeTruthy();
    expect(project.startChapterId).toBeTruthy();
    expect(project.chapters.length).toBeGreaterThan(0);
    expect(project.scenes.length).toBeGreaterThan(0);
  });

  it('ensures startChapterId exists in chapters', () => {
    const startChapter = project.chapters.find(c => c.id === project.startChapterId);
    expect(startChapter, `Chapter with id "${project.startChapterId}" must exist`).toBeDefined();
  });

  it('ensures each chapter startStoryNodeId exists in storyNodes', () => {
    for (const chapter of project.chapters) {
      if (chapter.startStoryNodeId) {
        const node = project.storyNodes.find(n => n.id === chapter.startStoryNodeId);
        expect(node, `Chapter "${chapter.id}" references missing storyNode "${chapter.startStoryNodeId}"`).toBeDefined();
      }
    }
  });

  it('ensures every storyNode references an existing sceneId', () => {
    const sceneIds = new Set(project.scenes.map(s => s.id));
    for (const node of project.storyNodes) {
      if (node.sceneId) {
        expect(sceneIds.has(node.sceneId), `StoryNode "${node.id}" references nonexistent scene "${node.sceneId}"`).toBe(true);
      }
    }
  });

  it('validates walkPaths have at least 3 points in each scene', () => {
    for (const scene of project.scenes) {
      for (const wp of scene.walkPaths || []) {
        if (wp.enabled) {
          expect(wp.points.length, `Scene "${scene.id}" walkPath "${wp.id}" must have >= 3 points`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('validates hotspots have >= 3 points', () => {
    for (const scene of project.scenes) {
      for (const hs of scene.hotspots || []) {
        if (hs.points) {
          expect(hs.points.length, `Scene "${scene.id}" hotspot "${hs.id}" has < 3 points`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('verifies all dialog trees have valid startNodeId and internal references', () => {
    for (const tree of project.dialogs || []) {
      expect(tree.nodes, `DialogTree "${tree.id}" has no nodes`).toBeDefined();
      expect(tree.nodes[tree.startNodeId], `DialogTree "${tree.id}" startNodeId "${tree.startNodeId}" not found in nodes`).toBeDefined();

      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (node.nextNodeId) {
          expect(tree.nodes[node.nextNodeId], `Node "${nodeId}" in tree "${tree.id}" points to missing nextNodeId "${node.nextNodeId}"`).toBeDefined();
        }
        for (const choice of node.choices || []) {
          if (choice.nextNodeId) {
            expect(tree.nodes[choice.nextNodeId], `Choice "${choice.id}" in node "${nodeId}" points to missing nextNodeId "${choice.nextNodeId}"`).toBeDefined();
          }
        }
      }
    }
  });

  it('verifies item actions in dialogs reference defined items', () => {
    const itemIds = new Set((project.items || []).map(it => it.id));
    for (const tree of project.dialogs || []) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (node.giveItem) {
          expect(itemIds.has(node.giveItem), `Dialog node "${nodeId}" gives undefined item "${node.giveItem}"`).toBe(true);
        }
        for (const choice of node.choices || []) {
          if (choice.giveItem) {
            expect(itemIds.has(choice.giveItem), `Choice "${choice.id}" in node "${nodeId}" gives undefined item "${choice.giveItem}"`).toBe(true);
          }
        }
      }
    }
  });
});
