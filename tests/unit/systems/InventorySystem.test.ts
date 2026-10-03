import { describe, it, expect, beforeEach } from 'vitest';
import { InventorySystem } from '../../../src/engine/systems/InventorySystem';
import { EventBus } from '../../../src/engine/core/EventBus';
import { InventoryItemData } from '../../../src/engine/types';

describe('InventorySystem', () => {
  let inv: InventorySystem;

  beforeEach(() => {
    EventBus.getInstance().clear();
    inv = new InventorySystem();
    InventorySystem.setInstance(inv);
  });

  const sampleKey: InventoryItemData = {
    id: 'iron_key',
    name: 'Iron Key',
    description: 'An old rusty key.',
    iconUrl: 'assets/key.png'
  };

  const sampleChest: InventoryItemData = {
    id: 'locked_box',
    name: 'Locked Box',
    description: 'A wooden box with a keyhole.',
    iconUrl: 'assets/box.png',
    combineWith: {
      iron_key: {
        resultItemId: 'open_box',
        message: 'The key unlocks the box!'
      }
    }
  };

  const sampleOpenBox: InventoryItemData = {
    id: 'open_box',
    name: 'Open Box',
    description: 'An open wooden box containing a jewel.',
    iconUrl: 'assets/open_box.png'
  };

  it('registers and adds items to player inventory', () => {
    inv.registerItem(sampleKey);

    expect(inv.hasItem('iron_key')).toBe(false);
    const added = inv.addItem('iron_key');
    expect(added).toBe(true);
    expect(inv.hasItem('iron_key')).toBe(true);
    expect(inv.getItems()).toEqual([sampleKey]);
  });

  it('fails to add unregistered item', () => {
    const added = inv.addItem('non_existent');
    expect(added).toBe(false);
    expect(inv.hasItem('non_existent')).toBe(false);
  });

  it('removes item from inventory and clears selected item if matching', () => {
    inv.registerItem(sampleKey);
    inv.addItem('iron_key');
    inv.selectItem('iron_key');

    expect(inv.getSelectedItem()?.id).toBe('iron_key');

    inv.removeItem('iron_key');
    expect(inv.hasItem('iron_key')).toBe(false);
    expect(inv.getSelectedItem()).toBeNull();
  });

  it('combines items when a valid combination recipe exists', () => {
    inv.registerItem(sampleKey);
    inv.registerItem(sampleChest);
    inv.registerItem(sampleOpenBox);

    inv.addItem('iron_key');
    inv.addItem('locked_box');

    // Combine locked_box with iron_key
    const combined = inv.combineItems('locked_box', 'iron_key');
    expect(combined).toBe(true);

    // Constituents removed, result item added
    expect(inv.hasItem('locked_box')).toBe(false);
    expect(inv.hasItem('iron_key')).toBe(false);
    expect(inv.hasItem('open_box')).toBe(true);
  });

  it('returns false for invalid item combinations', () => {
    inv.registerItem(sampleKey);
    inv.addItem('iron_key');

    const combined = inv.combineItems('iron_key', 'iron_key');
    expect(combined).toBe(false);
  });

  it('resets and bulk sets inventory state', () => {
    inv.registerItem(sampleKey);
    inv.registerItem(sampleOpenBox);

    inv.setInventory(['iron_key', 'open_box']);
    expect(inv.hasItem('iron_key')).toBe(true);
    expect(inv.hasItem('open_box')).toBe(true);

    inv.clear();
    expect(inv.getItems()).toHaveLength(0);
  });
});
