import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem } from '../../../src/engine/systems/SaveSystem';
import { StoryGraphSystem } from '../../../src/engine/systems/StoryGraphSystem';
import { InventorySystem } from '../../../src/engine/systems/InventorySystem';
import { ProjectSerializer } from '../../../src/engine/storage/ProjectSerializer';
import { EventBus } from '../../../src/engine/core/EventBus';

class MemoryStorage {
  private store: Map<string, string> = new Map();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
}

describe('SaveSystem', () => {
  let saveSys: SaveSystem;
  let mockStorage: MemoryStorage;

  beforeEach(() => {
    mockStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });

    EventBus.getInstance().clear();

    const project = ProjectSerializer.createStarterProject('Save System Quest');
    const story = new StoryGraphSystem();
    StoryGraphSystem.setInstance(story);
    story.loadProject(project);

    const inv = new InventorySystem();
    InventorySystem.setInstance(inv);

    saveSys = new SaveSystem(project);
    SaveSystem.setInstance(saveSys);
  });

  it('creates and writes save snapshot to localStorage', () => {
    const visited = new Set(['scene_start']);
    const snapshot = saveSys.createSaveSnapshot(1, { x: 450, y: 850 }, visited, 'Before Boss');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.saveName).toBe('Before Boss');
    expect(snapshot?.playerPos).toEqual({ x: 450, y: 850 });
    expect(snapshot?.visitedScenes).toContain('scene_start');

    // Retrieve by slot
    const retrieved = saveSys.getSaveBySlot(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.saveName).toBe('Before Boss');
    expect(retrieved?.playerPos).toEqual({ x: 450, y: 850 });
  });

  it('returns null for empty save slots', () => {
    expect(saveSys.getSaveBySlot(5)).toBeNull();
    expect(saveSys.getAutoSave()).toBeNull();
  });

  it('deletes saved slot from localStorage', () => {
    saveSys.createSaveSnapshot(2, { x: 100, y: 200 }, new Set());
    expect(saveSys.getSaveBySlot(2)).not.toBeNull();

    const deleted = saveSys.deleteSave(2);
    expect(deleted).toBe(true);
    expect(saveSys.getSaveBySlot(2)).toBeNull();
  });

  it('handles corrupted localStorage JSON gracefully without throwing', () => {
    const key = (saveSys as any).getStorageKey(3);
    mockStorage.setItem(key, '{ invalid json');

    const result = saveSys.getSaveBySlot(3);
    expect(result).toBeNull();
  });
});
