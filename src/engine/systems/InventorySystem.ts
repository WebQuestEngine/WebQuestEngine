import { InventoryItemData } from '../types';
import { EventBus, EngineEventMap } from '../core/EventBus';

export class InventorySystem {
  private static instance: InventorySystem;
  private items: Map<string, InventoryItemData> = new Map();
  private playerInventory: Set<string> = new Set();
  private selectedItemId: string | null = null;
  private eventBus: EventBus<EngineEventMap>;

  public constructor(eventBus?: EventBus<EngineEventMap>) {
    this.eventBus = eventBus || (EventBus.getInstance() as unknown as EventBus<EngineEventMap>);
  }

  public setEventBus(bus: EventBus<EngineEventMap>): void {
    this.eventBus = bus;
  }

  public static getInstance(): InventorySystem {
    if (!InventorySystem.instance) {
      InventorySystem.instance = new InventorySystem();
    }
    return InventorySystem.instance;
  }

  public static setInstance(inst: InventorySystem | null): void {
    InventorySystem.instance = inst as any;
  }

  public registerItem(item: InventoryItemData): void {
    this.items.set(item.id, item);
  }

  public addItem(itemId: string): boolean {
    if (this.items.has(itemId)) {
      this.playerInventory.add(itemId);
      this.eventBus.emit('inventory:updated', this.getItems());
      this.eventBus.emit('inventory:item_added', itemId);
      this.eventBus.emit('ui:notify', `Added to inventory: ${this.items.get(itemId)?.name}`);
      return true;
    }
    return false;
  }

  public removeItem(itemId: string): void {
    this.playerInventory.delete(itemId);
    if (this.selectedItemId === itemId) {
      this.selectedItemId = null;
    }
    this.eventBus.emit('inventory:updated', this.getItems());
  }

  public hasItem(itemId: string): boolean {
    return this.playerInventory.has(itemId);
  }

  public getItems(): InventoryItemData[] {
    const list: InventoryItemData[] = [];
    for (const id of this.playerInventory) {
      const item = this.items.get(id);
      if (item) list.push(item);
    }
    return list;
  }

  public selectItem(itemId: string | null): void {
    this.selectedItemId = itemId;
    this.eventBus.emit('inventory:selected', itemId ? this.items.get(itemId) : null);
  }

  public getSelectedItem(): InventoryItemData | null {
    return this.selectedItemId ? (this.items.get(this.selectedItemId) || null) : null;
  }

  public combineItems(itemAId: string, itemBId: string): boolean {
    const itemA = this.items.get(itemAId);
    if (!itemA || !itemA.combineWith) return false;

    const combination = itemA.combineWith[itemBId];
    if (combination) {
      if (combination.resultItemId) {
        this.removeItem(itemAId);
        this.removeItem(itemBId);
        this.addItem(combination.resultItemId);
      }
      if (combination.message) {
        this.eventBus.emit('ui:notify', combination.message);
      }
      if (combination.triggerFlag) {
        this.eventBus.emit('flag:set', combination.triggerFlag);
      }
      this.selectItem(null);
      return true;
    }
    return false;
  }

  public clear(): void {
    this.playerInventory.clear();
    this.selectedItemId = null;
    this.eventBus.emit('inventory:updated', []);
  }

  public setInventory(itemIds: string[]): void {
    this.playerInventory.clear();
    this.selectedItemId = null;
    for (const id of itemIds) {
      if (this.items.has(id)) {
        this.playerInventory.add(id);
      }
    }
    this.eventBus.emit('inventory:updated', this.getItems());
  }
}
