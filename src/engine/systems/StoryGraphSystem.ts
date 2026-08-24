import { ProjectData, StoryNodeData, ChapterData, SceneData } from '../types';
import { EventBus } from '../core/EventBus';

export class StoryGraphSystem {
  private static instance: StoryGraphSystem;
  private project: ProjectData | null = null;
  private currentChapter: ChapterData | null = null;
  private currentStoryNode: StoryNodeData | null = null;
  private currentScene: SceneData | null = null;
  private flags: Map<string, boolean> = new Map();

  private constructor() {}

  public static getInstance(): StoryGraphSystem {
    if (!StoryGraphSystem.instance) {
      StoryGraphSystem.instance = new StoryGraphSystem();
    }
    return StoryGraphSystem.instance;
  }

  public loadProject(project: ProjectData): void {
    this.project = project;

    // Load initial flags
    this.flags.clear();
    if (project.initialFlags) {
      for (const [key, val] of Object.entries(project.initialFlags)) {
        this.flags.set(key, val);
      }
    }

    // Set starting chapter and story node
    const startChapter = project.chapters.find(c => c.id === project.startChapterId) || project.chapters[0];
    if (startChapter) {
      this.setChapter(startChapter.id);
    }
  }

  public setChapter(chapterId: string): void {
    if (!this.project) return;
    const chapter = this.project.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    this.currentChapter = chapter;
    const startNode = this.project.storyNodes.find(n => n.id === chapter.startStoryNodeId);
    if (startNode) {
      this.setStoryNode(startNode.id);
    }
  }

  public setStoryNode(nodeId: string): void {
    if (!this.project) return;
    const node = this.project.storyNodes.find(n => n.id === nodeId);
    if (!node) return;

    this.currentStoryNode = node;
    const scene = this.project.scenes.find(s => s.id === node.sceneId);
    if (scene) {
      this.currentScene = scene;
      EventBus.getInstance().emit('scene:change', scene);
    }
  }

  public changeScene(sceneId: string, spawnPoint?: { x: number; y: number }): void {
    if (!this.project) return;

    // Check if there is a matching story node for this scene
    const storyNode = this.project.storyNodes.find(n => n.sceneId === sceneId && (!n.conditionFlag || this.getFlag(n.conditionFlag)));
    const targetScene = this.project.scenes.find(s => s.id === sceneId);

    if (targetScene) {
      this.currentScene = targetScene;
      if (storyNode) this.currentStoryNode = storyNode;

      EventBus.getInstance().emit('scene:change', {
        scene: targetScene,
        spawnPoint: spawnPoint || targetScene.playerSpawn
      });
    }
  }

  public setFlag(flag: string, value = true): void {
    this.flags.set(flag, value);
    EventBus.getInstance().emit('flag:changed', { flag, value });
  }

  public getFlag(flag: string): boolean {
    return this.flags.get(flag) || false;
  }

  public getCurrentScene(): SceneData | null {
    return this.currentScene;
  }

  public getCurrentChapter(): ChapterData | null {
    return this.currentChapter;
  }

  public getStoryNodes(): StoryNodeData[] {
    return this.project ? this.project.storyNodes : [];
  }
}
