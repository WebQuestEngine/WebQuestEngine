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
    return data;
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
          characters: [
            {
              id: 'char_player',
              name: 'Hero',
              spriteSheetUrl: '',
              frameWidth: 64,
              frameHeight: 96,
              position: { x: 400, y: 850 },
              speed: 200,
              scale: 1,
              talkColor: '#fbbf24',
              animations: {}
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

