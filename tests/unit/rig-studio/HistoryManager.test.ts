import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../../../src/rig-studio/state/HistoryManager';

describe('HistoryManager', () => {
  it('initializes with a baseline state without enabling undo', () => {
    const history = new HistoryManager<{ count: number }>();
    history.init({ count: 1 }, 'Initial');

    expect(history.current).toEqual({ count: 1 });
    expect(history.currentDescription).toBe('Initial');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('records state transitions and supports undo and redo', () => {
    const history = new HistoryManager<{ text: string }>();
    history.init({ text: 'A' }, 'Start');

    history.push({ text: 'B' }, 'Typed B');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.current).toEqual({ text: 'B' });
    expect(history.currentDescription).toBe('Typed B');

    history.push({ text: 'C' }, 'Typed C');
    expect(history.undoCount).toBe(2);

    // Undo to B
    const stateB = history.undo();
    expect(stateB).toEqual({ text: 'B' });
    expect(history.current).toEqual({ text: 'B' });
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);
    expect(history.redoCount).toBe(1);

    // Undo to A
    const stateA = history.undo();
    expect(stateA).toEqual({ text: 'A' });
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    // Redo back to B
    const redoneB = history.redo();
    expect(redoneB).toEqual({ text: 'B' });
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);

    // Redo back to C
    const redoneC = history.redo();
    expect(redoneC).toEqual({ text: 'C' });
    expect(history.canRedo).toBe(false);
  });

  it('clears redo stack when pushing a new state after undo', () => {
    const history = new HistoryManager<number>();
    history.init(1);
    history.push(2);
    history.push(3);

    history.undo(); // back to 2
    expect(history.redoCount).toBe(1);

    history.push(4); // branch to 4; redo stack must be wiped
    expect(history.canRedo).toBe(false);
    expect(history.redoCount).toBe(0);
    expect(history.current).toBe(4);

    expect(history.undo()).toBe(2);
    expect(history.undo()).toBe(1);
    expect(history.undo()).toBeNull();
  });

  it('enforces maximum depth limit', () => {
    const maxDepth = 3;
    const history = new HistoryManager<number>(maxDepth);
    history.init(0);

    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);
    history.push(5);

    expect(history.undoCount).toBe(maxDepth);
    expect(history.undo()).toBe(4);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBeNull();
  });

  it('clears all history', () => {
    const history = new HistoryManager<string>();
    history.init('root');
    history.push('step 1');
    history.clear();

    expect(history.current).toBeNull();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(0);
  });
});
