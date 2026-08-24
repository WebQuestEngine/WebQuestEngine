import { ProjectData } from '../engine/types';
import { ProjectSerializer } from '../engine/storage/ProjectSerializer';
import { EventBus } from '../engine/core/EventBus';

export class HistoryManager {
  private static instance: HistoryManager;
  private past: string[] = [];
  private future: string[] = [];
  private maxHistory = 50;
  private isDebouncing = false;

  private constructor() {}

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  public init(initialProject: ProjectData): void {
    this.past = [ProjectSerializer.serialize(initialProject)];
    this.future = [];
  }

  public pushState(project: ProjectData): void {
    const currentJson = ProjectSerializer.serialize(project);
    const lastJson = this.past[this.past.length - 1];

    if (currentJson === lastJson) return; // Don't push duplicate states

    this.past.push(currentJson);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.future = []; // Clear redo stack on new action
    EventBus.getInstance().emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  public undo(): ProjectData | null {
    if (!this.canUndo()) return null;

    const current = this.past.pop()!;
    this.future.push(current);

    const previousJson = this.past[this.past.length - 1];
    EventBus.getInstance().emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return ProjectSerializer.deserialize(previousJson);
  }

  public redo(): ProjectData | null {
    if (!this.canRedo()) return null;

    const nextJson = this.future.pop()!;
    this.past.push(nextJson);

    EventBus.getInstance().emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    return ProjectSerializer.deserialize(nextJson);
  }

  public canUndo(): boolean {
    return this.past.length > 1;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }
}
