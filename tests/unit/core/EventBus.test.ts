import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/engine/core/EventBus';

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
    bus.on('scene:loaded', handler);
    bus.off('scene:loaded', handler);

    bus.emit('scene:loaded');
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes via returned cleanup function', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('dialog:start', handler);

    unsubscribe();
    bus.emit('dialog:start');
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles multiple listeners for the same event in order', () => {
    const callOrder: number[] = [];
    bus.on('test:event', () => callOrder.push(1));
    bus.on('test:event', () => callOrder.push(2));

    bus.emit('test:event');
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
});
