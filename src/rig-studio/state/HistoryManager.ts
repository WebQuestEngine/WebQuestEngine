/**
 * Generic, headless undo/redo history manager with fixed depth limit.
 */
export interface HistoryEntry<T> {
  state: T;
  description: string;
  timestamp: number;
}

export class HistoryManager<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private currentState: HistoryEntry<T> | null = null;
  private maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = Math.max(1, maxDepth);
  }

  /**
   * Initializes or sets the baseline state without adding to undo stack.
   */
  public init(initialState: T, description = 'Initial State'): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = {
      state: initialState,
      description,
      timestamp: Date.now()
    };
  }

  /**
   * Pushes a new state transition onto the undo stack.
   * Clears redo history.
   */
  public push(newState: T, description = 'Action'): void {
    if (this.currentState) {
      this.undoStack.push(this.currentState);
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }
    }
    this.currentState = {
      state: newState,
      description,
      timestamp: Date.now()
    };
    this.redoStack = [];
  }

  /**
   * Reverts to the previous state on the undo stack, moving current state to redo.
   */
  public undo(): T | null {
    if (!this.canUndo || !this.currentState) return null;

    this.redoStack.push(this.currentState);
    this.currentState = this.undoStack.pop()!;
    return this.currentState.state;
  }

  /**
   * Re-applies the next state on the redo stack, moving current state to undo.
   */
  public redo(): T | null {
    if (!this.canRedo || !this.currentState) return null;

    this.undoStack.push(this.currentState);
    this.currentState = this.redoStack.pop()!;
    return this.currentState.state;
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public get current(): T | null {
    return this.currentState ? this.currentState.state : null;
  }

  public get currentDescription(): string | null {
    return this.currentState ? this.currentState.description : null;
  }

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
  }
}
