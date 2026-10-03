import { SaveGameData, SceneData, Vector2D } from '../types';
import { Scene } from '../scene/Scene';
import { RuntimeContext } from './RuntimeContext';

export interface SaveRestoreHost {
  readonly isDestroyed: boolean;
  readonly currentScene: Scene | null;
  readonly context: RuntimeContext;
  readonly visitedScenes: Set<string>;
  pause(): void;
  resume(): void;
  loadScene(sceneData: SceneData, spawnPoint?: Vector2D): Promise<void>;
  checkAndTriggerEvent(scope: 'game' | 'scene' | 'hotspot' | 'character' | 'item', targetId: string, eventName: string): boolean;
  setVisitedScenes(scenes: Set<string>): void;
}

export class SaveRestoreHandler {
  private host: SaveRestoreHost;
  private unsubscribers: (() => void)[] = [];

  constructor(host: SaveRestoreHost) {
    this.host = host;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const bus = this.host.context.eventBus;

    this.unsubscribers.push(
      bus.on('game:pause', () => this.host.pause()),
      bus.on('game:resume', () => this.host.resume()),
      bus.on('game:request_save', (payload: { slotId: number | string }) => {
        const playerPos = this.host.currentScene?.playerCharacter
          ? {
              x: Math.round(this.host.currentScene.playerCharacter.container.x),
              y: Math.round(this.host.currentScene.playerCharacter.container.y)
            }
          : (this.host.currentScene?.data.playerSpawn || { x: 100, y: 100 });
        this.host.context.save.createSaveSnapshot(payload.slotId, playerPos, this.host.visitedScenes);
      }),
      bus.on('game:request_load', async (saveData: SaveGameData) => {
        await this.restoreSaveGame(saveData);
      }),
      bus.on('game:restart_chapter', () => {
        const currentChapter = this.host.context.story.getCurrentChapter();
        if (currentChapter) {
          this.host.context.story.setChapter(currentChapter.id);
        }
      }),
      bus.on('game:restart_all', async () => {
        this.host.context.story.resetToInitialState();
        this.host.context.inventory.clear();
        const initScene = this.host.context.story.getCurrentScene();
        if (initScene) {
          await this.host.loadScene(initScene);
        }
        this.host.checkAndTriggerEvent('game', 'game', 'start');
      })
    );
  }

  public async restoreSaveGame(saveData: SaveGameData): Promise<void> {
    const scene = this.host.context.project.scenes.find(s => s.id === saveData.sceneId);
    if (!scene) {
      console.warn(`[SaveRestoreHandler] Target scene ${saveData.sceneId} not found in project.`);
      return;
    }

    if (saveData.chapterId) {
      this.host.context.story.setChapter(saveData.chapterId);
    }
    if (saveData.flags) {
      this.host.context.story.setAllFlags(saveData.flags);
    }
    if (saveData.inventoryItemIds) {
      this.host.context.inventory.setInventory(saveData.inventoryItemIds);
    }
    if (saveData.visitedScenes) {
      this.host.setVisitedScenes(new Set(saveData.visitedScenes));
    }
    if (saveData.uiPreset) {
      this.host.context.ui.setPreset(saveData.uiPreset);
    }
    if (saveData.audioConfig) {
      this.host.context.audio.setConfig(saveData.audioConfig);
    }

    await this.host.loadScene(scene, saveData.playerPos);

    this.host.checkAndTriggerEvent('game', 'game', 'loaded');
    this.host.context.eventBus.emit('ui:notify', `📂 Loaded: ${saveData.saveName}`);
  }

  public destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
