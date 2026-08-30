import { ProjectData, SaveGameData, Vector2D, AudioConfig, UIPresetType } from '../types';
import { EventBus } from '../core/EventBus';
import { StoryGraphSystem } from './StoryGraphSystem';
import { InventorySystem } from './InventorySystem';
import { AudioSystem } from './AudioSystem';
import { UISystem } from './UISystem';

export class SaveSystem {
  private static instance: SaveSystem;
  private project: ProjectData | null = null;
  private currentSlotCount: number = 6;

  constructor(project?: ProjectData) {
    if (project) this.project = project;
  }

  public static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  public static setInstance(inst: SaveSystem | null): void {
    SaveSystem.instance = inst as any;
  }

  public setProject(project: ProjectData): void {
    this.project = project;
  }

  private getStorageKey(slotId: number | string): string {
    const projId = (this.project?.title || 'quest_game').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return `webquest_save_${projId}_slot_${slotId}`;
  }

  public getSavedSlots(): (SaveGameData | null)[] {
    const slots: (SaveGameData | null)[] = [];
    for (let i = 1; i <= this.currentSlotCount; i++) {
      slots.push(this.getSaveBySlot(i));
    }
    return slots;
  }

  public getAutoSave(): SaveGameData | null {
    return this.getSaveBySlot('auto');
  }

  public getSaveBySlot(slotId: number | string): SaveGameData | null {
    try {
      const raw = localStorage.getItem(this.getStorageKey(slotId));
      if (!raw) return null;
      return JSON.parse(raw) as SaveGameData;
    } catch (e) {
      console.error(`[SaveSystem] Failed to read save slot ${slotId}:`, e);
      return null;
    }
  }

  public createSaveSnapshot(
    slotId: number | string,
    playerPos: Vector2D,
    visitedScenes: Set<string>,
    customName?: string
  ): SaveGameData | null {
    if (!this.project) return null;

    const currentScene = StoryGraphSystem.getInstance().getCurrentScene() || this.project.scenes[0];
    const currentChapter = StoryGraphSystem.getInstance().getCurrentChapter() || this.project.chapters[0];
    const flags = StoryGraphSystem.getInstance().getAllFlags();
    const inventoryItems = InventorySystem.getInstance().getItems();
    const audioConfig = AudioSystem.getInstance().getConfig();
    const uiConfig = UISystem.getInstance().getConfig();

    const now = Date.now();
    const dateFormatted = new Date(now).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const defaultTitle = slotId === 'auto' ? 'Auto-Save' : `Save ${slotId}: ${currentScene?.name || 'Unknown Location'}`;

    // Get background or thumbnail preview if available
    let thumbnailUrl: string | undefined = undefined;
    if (currentScene?.layers && currentScene.layers.length > 0) {
      const bgLayer = currentScene.layers.find(l => Boolean(l.imageUrl));
      if (bgLayer) thumbnailUrl = bgLayer.imageUrl;
    }

    const saveData: SaveGameData = {
      version: this.project.version || '1.0.0',
      slotId,
      saveName: customName || defaultTitle,
      timestamp: now,
      dateFormatted,
      projectTitle: this.project.title || 'Untitled Quest',
      chapterId: currentChapter?.id || 'ch_1',
      chapterTitle: currentChapter?.title || 'Chapter 1',
      sceneId: currentScene?.id || 'scene_1',
      sceneName: currentScene?.name || 'Scene',
      playerPos: { x: playerPos.x, y: playerPos.y },
      inventoryItemIds: inventoryItems.map(it => it.id),
      flags,
      visitedScenes: Array.from(visitedScenes),
      audioConfig,
      uiPreset: uiConfig.preset,
      thumbnailUrl
    };

    try {
      localStorage.setItem(this.getStorageKey(slotId), JSON.stringify(saveData));
      console.log(`%c[SaveSystem] 💾 Game Saved to Slot [${slotId}]: "${saveData.saveName}"`, 'color: #10b981; font-weight: bold;');
      EventBus.getInstance().emit('ui:notify', `💾 Game Saved to Slot ${slotId}`);
      EventBus.getInstance().emit('game:saved', saveData);
      return saveData;
    } catch (e) {
      console.error(`[SaveSystem] Failed to write save slot ${slotId}:`, e);
      EventBus.getInstance().emit('ui:notify', `⚠️ Failed to save: ${e}`);
      return null;
    }
  }

  public deleteSave(slotId: number | string): boolean {
    try {
      localStorage.removeItem(this.getStorageKey(slotId));
      EventBus.getInstance().emit('ui:notify', `🗑️ Deleted Save Slot ${slotId}`);
      return true;
    } catch (e) {
      console.error(`[SaveSystem] Failed to delete save slot ${slotId}:`, e);
      return false;
    }
  }

  public exportSaveFile(slotId: number | string): void {
    const save = this.getSaveBySlot(slotId);
    if (!save) {
      EventBus.getInstance().emit('ui:notify', '⚠️ No save data found in this slot.');
      return;
    }

    const jsonStr = JSON.stringify(save, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (save.projectTitle || 'quest').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeTitle}_slot_${slotId}_${save.timestamp}.questsave`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    EventBus.getInstance().emit('ui:notify', '📥 Exported save file successfully.');
  }

  public importSaveFromJSON(jsonText: string): SaveGameData | null {
    try {
      const parsed = JSON.parse(jsonText) as SaveGameData;
      if (!parsed.sceneId || !parsed.flags) {
        throw new Error('Invalid save game format: missing scene or flags.');
      }
      return parsed;
    } catch (e) {
      console.error('[SaveSystem] Invalid import JSON:', e);
      EventBus.getInstance().emit('ui:notify', '❌ Failed to import save: Invalid format');
      return null;
    }
  }
}
