import { ProjectData, UIPresetType } from '../types';

export class ProjectSerializer {
  public static serialize(project: ProjectData): string {
    return JSON.stringify(project, null, 2);
  }

  public static deserialize(jsonString: string): ProjectData {
    const data = JSON.parse(jsonString) as ProjectData;
    if (!data.version || !data.scenes || !data.chapters) {
      throw new Error('Invalid project structure. Missing essential fields.');
    }
    return this.normalize(data);
  }

  /**
   * Normalizes legacy project fields into the standardized discriminated schema:
   * - Converts `isRouterNode: true` to `nodeType: 'router'`, defaults missing nodeType to `'beat'`.
   * - Normalizes single string mutations (`setFlag`, `clearFlag`, `giveItem`, `giveItemId`) into array fields (`setFlags`, `clearFlags`, `giveItems`).
   */
  public static normalize(project: ProjectData): ProjectData {
    // 0. Ensure root characters array
    if (!project.characters) {
      project.characters = [];
    }
    const defMap = new Map<string, any>();
    for (const c of project.characters) {
      if (c && c.id) defMap.set(c.id, c);
    }

    // 1. Normalize scene hotspots & character placements
    for (const scene of project.scenes || []) {
      if (!scene.characters) scene.characters = [];
      if (!scene.layers) scene.layers = [];
      if (!scene.hotspots) scene.hotspots = [];
      if (!scene.walkPaths) scene.walkPaths = [];

      for (const ch of scene.characters as any[]) {
        const charId = ch.characterId || ch.id;
        if (charId) {
          ch.characterId = charId;
          // If not already in project.characters, extract definition
          if (!defMap.has(charId)) {
            const newDef = {
              id: charId,
              name: ch.name || (charId === 'player' ? 'Hero' : charId),
              spriteSheetUrl: ch.spriteSheetUrl || '',
              frameWidth: ch.frameWidth || 64,
              frameHeight: ch.frameHeight || 96,
              rows: ch.rows,
              cols: ch.cols,
              gridOffsetX: ch.gridOffsetX,
              gridOffsetY: ch.gridOffsetY,
              speed: ch.speed !== undefined ? ch.speed : 200,
              scale: ch.scale !== undefined ? ch.scale : 1,
              talkColor: ch.talkColor || '#fbbf24',
              cursor: ch.cursor,
              customCursorUrl: ch.customCursorUrl,
              customCursorHotspotX: ch.customCursorHotspotX,
              customCursorHotspotY: ch.customCursorHotspotY,
              animations: ch.animations || {}
            };
            project.characters.push(newDef);
            defMap.set(charId, newDef);
          }
        }

        const actionsList = Array.isArray(ch.actions)
          ? ch.actions
          : ch.actions && typeof ch.actions === 'object'
          ? Object.values(ch.actions)
          : [];
        for (const act of actionsList) {
          this.normalizeAction(act);
        }
      }

      // If characters list is still empty, ensure default playable character is defined
      if (project.characters.length === 0) {
        project.characters.push({
          id: 'player',
          name: 'Hero',
          spriteSheetUrl: 'procedural_hero',
          frameWidth: 64,
          frameHeight: 96,
          speed: 4,
          scale: 1,
          talkColor: '#fef08a',
          animations: {
            idleDown: [0],
            idleSide: [4],
            idleUp: [8],
            walkDown: [0, 1, 2, 3],
            walkSide: [4, 5, 6, 7],
            walkUp: [8, 9, 10, 11],
            talk: [12, 13, 14, 15]
          }
        });
      }

      // Default scene playable character to first defined character
      if (!scene.playerCharacterId) {
        scene.playerCharacterId = project.characters[0]?.id || 'player';
      }

      for (const hs of scene.hotspots || []) {
        const actionsList = Array.isArray(hs.actions)
          ? hs.actions
          : hs.actions && typeof hs.actions === 'object'
          ? Object.values(hs.actions)
          : [];
        for (const act of actionsList) {
          this.normalizeAction(act);
        }
      }
    }

    // 2. Normalize dialog trees, nodes, and choices
    for (const tree of project.dialogs || []) {
      for (const node of Object.values(tree.nodes || {})) {
        this.normalizeDialogNode(node);
      }
    }

    return project;
  }

  private static normalizeAction(act: any): void {
    if (!act) return;
    if (act.setFlag) {
      if (!act.setFlags) act.setFlags = [];
      if (!act.setFlags.includes(act.setFlag)) act.setFlags.push(act.setFlag);
    }
    if (act.clearFlag) {
      if (!act.clearFlags) act.clearFlags = [];
      if (!act.clearFlags.includes(act.clearFlag)) act.clearFlags.push(act.clearFlag);
    }
    const singleGive = act.giveItemId || act.giveItem;
    if (singleGive) {
      if (!act.giveItems) act.giveItems = [];
      if (!act.giveItems.includes(singleGive)) act.giveItems.push(singleGive);
    }
  }

  private static normalizeDialogNode(node: any): void {
    if (!node) return;

    // Normalize nodeType from legacy isRouterNode
    if (node.isRouterNode === true && !node.nodeType) {
      node.nodeType = 'router';
    } else if (!node.nodeType) {
      node.nodeType = 'beat';
    }

    // Normalize outcomes
    if (node.setFlag) {
      if (!node.setFlags) node.setFlags = [];
      if (!node.setFlags.includes(node.setFlag)) node.setFlags.push(node.setFlag);
    }
    if (node.clearFlag) {
      if (!node.clearFlags) node.clearFlags = [];
      if (!node.clearFlags.includes(node.clearFlag)) node.clearFlags.push(node.clearFlag);
    }
    if (node.giveItem) {
      if (!node.giveItems) node.giveItems = [];
      if (!node.giveItems.includes(node.giveItem)) node.giveItems.push(node.giveItem);
    }

    // Normalize choices
    if (Array.isArray(node.choices)) {
      for (const choice of node.choices) {
        if (choice.setFlag) {
          if (!choice.setFlags) choice.setFlags = [];
          if (!choice.setFlags.includes(choice.setFlag)) choice.setFlags.push(choice.setFlag);
        }
        if (choice.clearFlag) {
          if (!choice.clearFlags) choice.clearFlags = [];
          if (!choice.clearFlags.includes(choice.clearFlag)) choice.clearFlags.push(choice.clearFlag);
        }
        if (choice.giveItem) {
          if (!choice.giveItems) choice.giveItems = [];
          if (!choice.giveItems.includes(choice.giveItem)) choice.giveItems.push(choice.giveItem);
        }
      }
    }
  }

  public static createStarterProject(
    title: string = 'New Adventure Quest',
    author: string = 'Quest Creator',
    preset: UIPresetType = 'lucasarts'
  ): ProjectData {
    return {
      version: '1.0.0',
      title: title.trim() || 'New Adventure Quest',
      author: author.trim() || 'Quest Creator',
      startChapterId: 'ch_1',
      initialFlags: {},
      uiConfig: {
        preset: preset,
        primaryColor: '#1e1b4b',
        accentColor: '#fbbf24',
        fontFamily: 'Inter, sans-serif',
        inventoryPosition: 'bottom',
        autoHideBars: false,
        showVerbText: true
      },
      chapters: [
        {
          id: 'ch_1',
          title: 'Chapter 1: The Beginning',
          description: 'The journey begins.',
          startStoryNodeId: 'sn_start',
          locked: false
        }
      ],
      storyNodes: [
        {
          id: 'sn_start',
          chapterId: 'ch_1',
          sceneId: 'scene_start',
          name: 'Starting Scene',
          description: 'Initial scene of the quest',
          position: { x: 140, y: 140 },
          connections: []
        }
      ],
      characters: [
        {
          id: 'char_player',
          name: 'Hero',
          spriteSheetUrl: '',
          frameWidth: 64,
          frameHeight: 96,
          speed: 200,
          scale: 1,
          talkColor: '#fbbf24',
          animations: {}
        }
      ],
      scenes: [
        {
          id: 'scene_start',
          name: 'Scene 1 - Courtyard',
          width: 1920,
          height: 1080,
          layers: [],
          walkPaths: [
            {
              id: 'wp_main',
              name: 'Main Walk Path',
              points: [
                { x: 100, y: 700 },
                { x: 1820, y: 700 },
                { x: 1820, y: 980 },
                { x: 100, y: 980 }
              ],
              scaling: {
                minY: 700,
                maxY: 980,
                minScale: 0.85,
                maxScale: 1.05
              },
              enabled: true
            }
          ],
          hotspots: [],
          playerCharacterId: 'char_player',
          characters: [
            {
              characterId: 'char_player',
              position: { x: 400, y: 850 }
            }
          ],
          playerSpawn: { x: 400, y: 850 }
        }
      ],
      items: [],
      dialogs: []
    };
  }
}

