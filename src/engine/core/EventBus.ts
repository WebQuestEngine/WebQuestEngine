import { EngineEventMap } from './EventTypes';

export type EventCallback<TPayload> = (payload: TPayload) => void | Promise<void>;

export class EventBus<TMap extends Record<string, any> = EngineEventMap> {
  private static globalInstance: EventBus<any>;
  private static activeBusGetter: (() => EventBus<any> | null) | null = null;
  private listeners: Map<string, Array<(payload?: any) => void>> = new Map();

  public constructor() {}

  public static getGlobal<T extends Record<string, any> = EngineEventMap>(): EventBus<T> {
    if (!EventBus.globalInstance) {
      EventBus.globalInstance = new EventBus<any>();
    }
    return EventBus.globalInstance as EventBus<T>;
  }

  public static setActiveBusGetter(getter: (() => EventBus<any> | null) | null): void {
    EventBus.activeBusGetter = getter;
  }

  public static getInstance<T extends Record<string, any> = EngineEventMap>(): EventBus<T> {
    if (EventBus.activeBusGetter) {
      const active = EventBus.activeBusGetter();
      if (active) return active as EventBus<T>;
    }
    return EventBus.getGlobal<T>();
  }

  public on<K extends keyof TMap & string>(
    event: K,
    callback: EventCallback<TMap[K]>
  ): () => void;
  public on<K extends string, P = any>(
    event: K,
    callback: (payload: P) => void | Promise<void>
  ): () => void;
  public on(event: string, callback: (payload?: any) => void): () => void {
    if (event.startsWith('editor:') || event.startsWith('history:') || event.startsWith('camera:')) {
      if (EventBus.globalInstance && this !== EventBus.globalInstance) {
        return EventBus.getGlobal().on(event, callback);
      }
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof TMap & string>(
    event: K,
    callback: EventCallback<TMap[K]>
  ): void;
  public off<K extends string, P = any>(
    event: K,
    callback: (payload: P) => void | Promise<void>
  ): void;
  public off(event: string, callback: (payload?: any) => void): void {
    if (event.startsWith('editor:') || event.startsWith('history:') || event.startsWith('camera:')) {
      if (EventBus.globalInstance && this !== EventBus.globalInstance) {
        EventBus.getGlobal().off(event, callback);
        return;
      }
    }

    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(cb => cb !== callback));
    }
  }

  public emit<K extends keyof TMap & string>(
    event: K,
    ...args: TMap[K] extends void ? [payload?: void] : [payload: TMap[K]]
  ): void;
  public emit<K extends string, P = any>(
    event: K,
    ...args: [payload?: P]
  ): void;
  public emit(event: string, ...args: any[]): void {
    if (event.startsWith('editor:') || event.startsWith('history:') || event.startsWith('camera:')) {
      if (EventBus.globalInstance && this !== EventBus.globalInstance) {
        EventBus.getGlobal().emit(event, ...args);
        return;
      }
    }

    const list = this.listeners.get(event);
    if (list) {
      const payload = args[0];
      list.forEach(cb => cb(payload));
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export type { EngineEventMap };
