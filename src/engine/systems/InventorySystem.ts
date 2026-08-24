import { InventoryItemData } from '../types';
import { EventBus } from '../core/EventBus';

export class InventorySystem {
  private static instance: InventorySystem;
  private items: Map<string, InventoryItemData> = new Map();
  private playerInventory: Set<string> = new Set();
  private selectedItemId: string | null = null;

  private constructor() {}

  public static getInstance(): InventorySystem {
    if (!InventorySystem.instance) {
      InventorySystem.instance = new InventorySystem();
    }
    return InventorySystem.instance;
  }

  public registerItem(item: InventoryItemData): void {
    this.items.set(item.id, item);
  }

  public addItem(itemId: string): boolean {
    if (this.items.has(itemId)) {
      this.playerInventory.add(itemId);
      EventBus.getInstance().emit('inventory:updated', this.getItems());
      EventBus.getInstance().emit('ui:notify', `Added to inventory: ${this.items.get(itemId)?.name}`);
      return true;
    }
    return false;
  }

  public removeItem(itemId: string): void {
    this.playerInventory.delete(itemId);
    if (this.selectedItemId === itemId) {
      this.selectedItemId = null;
    }
    EventBus.getInstance().emit('inventory:updated', this.getItems());
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
    EventBus.getInstance().emit('inventory:selected', itemId ? this.items.get(itemId) : null);
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
        EventBus.getInstance().emit('ui:notify', combination.message);
      }
      if (combination.triggerFlag) {
        EventBus.getInstance().emit('flag:set', combination.triggerFlag);
      }
      this.selectItem(null);
      return true;
    }
    return false;
  }

  public clear(): void {
    this.playerInventory.clear();
    this.selectedItemId = null;
    EventBus.getInstance().emit('inventory:updated', []);
  }
}
