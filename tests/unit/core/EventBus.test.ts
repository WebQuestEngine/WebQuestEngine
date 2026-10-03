import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/engine/core/EventBus';
import { EngineEventMap } from '../../../src/engine/core/EventTypes';
import { RuntimeContext } from '../../../src/engine/runtime/RuntimeContext';
import { ProjectSerializer } from '../../../src/engine/storage/ProjectSerializer';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('subscribes to and receives emitted events with payloads', () => {
    const handler = vi.fn();
    bus.on('player:move', handler);

    bus.emit('player:move', { x: 100, y: 200 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  it('unsubscribes via off method', () => {
    const handler = vi.fn();
    bus.on('scene:change', handler);
    bus.off('scene:change', handler);

    bus.emit('scene:change', { scene: { id: 's1', name: 'Scene 1', width: 800, height: 600, layers: [], walkPaths: [], hotspots: [], characters: [] } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes via returned cleanup function', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('inventory:give', handler);

    unsubscribe();
    bus.emit('inventory:give', 'rusty_key');
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles multiple listeners for the same event in order', () => {
    const callOrder: number[] = [];
    bus.on('flag:set', () => callOrder.push(1));
    bus.on('flag:set', () => callOrder.push(2));

    bus.emit('flag:set', 'lever_pulled');
    expect(callOrder).toEqual([1, 2]);
  });

  it('clears all listeners on clear()', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.on('eventA', handlerA);
    bus.on('eventB', handlerB);

    bus.clear();
    bus.emit('eventA');
    bus.emit('eventB');

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('supports variable string identifiers for game entities', () => {
    const itemHandler = vi.fn();
    const flagHandler = vi.fn();

    bus.on('inventory:give', itemHandler);
    bus.on('flag:set', flagHandler);

    // Variable game entities are regular strings
    bus.emit('inventory:give', 'custom_crystal_shard_99');
    bus.emit('flag:set', 'has_unlocked_secret_chamber');

    expect(itemHandler).toHaveBeenCalledWith('custom_crystal_shard_99');
    expect(flagHandler).toHaveBeenCalledWith('has_unlocked_secret_chamber');
  });

  it('supports arbitrary custom events from dialog or script directives', () => {
    const customHandler = vi.fn();
    bus.on('custom:trigger_boss_intro', customHandler);

    bus.emit('custom:trigger_boss_intro', { bossId: 'shadow_dragon', phase: 2 });

    expect(customHandler).toHaveBeenCalledWith({ bossId: 'shadow_dragon', phase: 2 });
  });

  it('isolates runtime session listeners and wipes them on context destroy without leaking', () => {
    const project = ProjectSerializer.createStarterProject('Event Scope Test');
    const container = document.createElement('div');

    // Start session 1
    const ctx1 = new RuntimeContext(project, container);
    const audioSpy1 = vi.fn();
    EventBus.getInstance().on('audio:play_sfx', audioSpy1);

    EventBus.getInstance().emit('audio:play_sfx', { type: 'pickup' });
    expect(audioSpy1).toHaveBeenCalledTimes(1);

    // Destroy session 1 (cleans up all session listeners)
    ctx1.destroy();

    // Start session 2
    const ctx2 = new RuntimeContext(project, container);
    const audioSpy2 = vi.fn();
    EventBus.getInstance().on('audio:play_sfx', audioSpy2);

    EventBus.getInstance().emit('audio:play_sfx', { type: 'pickup' });

    // Spy 1 must NOT be called again (zero zombie listeners)
    expect(audioSpy1).toHaveBeenCalledTimes(1);
    // Spy 2 is called for session 2
    expect(audioSpy2).toHaveBeenCalledTimes(1);

    ctx2.destroy();
  });

  it('forwards editor domain events to the global editor bus even during an active runtime context', () => {
    const editorSpy = vi.fn();
    EventBus.getGlobal().on('editor:mode_changed', editorSpy);

    const project = ProjectSerializer.createStarterProject('Editor Forwarding Test');
    const container = document.createElement('div');
    const runtimeCtx = new RuntimeContext(project, container);

    // Emitting editor event from anywhere (even via getInstance during play) routes to editor bus
    EventBus.getInstance().emit('editor:mode_changed', { isPlayMode: false });

    expect(editorSpy).toHaveBeenCalledWith({ isPlayMode: false });

    runtimeCtx.destroy();
  });
});
