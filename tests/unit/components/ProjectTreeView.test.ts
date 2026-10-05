import { describe, it, expect } from 'vitest';
import { ProjectTreeViewTemplate } from '../../../src/editor/components/templates/ProjectTreeView.template';
import demoProject from '../../../demo/the_alchemist\'s_mystery.json';
import { ProjectData } from '../../../src/engine/types';
import { ProjectSerializer } from '../../../src/engine/storage/ProjectSerializer';

describe('ProjectTreeView Characters Section', () => {
  it('renders characters folder with count and list of characters from project.characters', () => {
    const project = ProjectSerializer.normalize(demoProject as unknown as ProjectData);

    const html = ProjectTreeViewTemplate.renderTreeContent({
      project,
      selectedNodeId: null,
      collapsedNodes: new Set(),
      isNodeLocked: () => false
    });

    // Check folder header
    expect(html).toContain('📂 Characters (2)');

    // Check individual characters
    expect(html).toContain('👤 Sir Ronald');
    expect(html).toContain('👤 Master Eldrin');
    expect(html).toContain('data-type="character" data-id="player"');
    expect(html).toContain('data-type="character" data-id="npc_eldrin"');
  });

  it('automatically extracts and displays characters even if raw project had no root characters array', () => {
    const legacyProject: any = {
      version: '1.0.0',
      title: 'Legacy Quest',
      author: 'Tester',
      startChapterId: 'ch1',
      chapters: [{ id: 'ch1', title: 'Chapter 1' }],
      scenes: [
        {
          id: 'sc1',
          name: 'Scene 1',
          characters: [
            { id: 'sam', name: 'Sam', spriteSheetUrl: 'sam.png' },
            { id: 'max', name: 'Max', spriteSheetUrl: 'max.png' }
          ]
        }
      ],
      items: [],
      dialogs: []
    };

    // Passing without manual normalize
    const html = ProjectTreeViewTemplate.renderTreeContent({
      project: legacyProject,
      selectedNodeId: null,
      collapsedNodes: new Set(),
      isNodeLocked: () => false
    });

    expect(html).toContain('📂 Characters (2)');
    expect(html).toContain('👤 Sam');
    expect(html).toContain('👤 Max');
  });
});
