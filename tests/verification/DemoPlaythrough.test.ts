import { describe, it, expect, beforeEach } from 'vitest';
import demoProject from '../../demo/the_alchemist\'s_mystery.json';
import { ProjectData } from '../../src/engine/types';
import { DialogSystem } from '../../src/engine/systems/DialogSystem';
import { StoryGraphSystem } from '../../src/engine/systems/StoryGraphSystem';
import { InventorySystem } from '../../src/engine/systems/InventorySystem';
import { EventBus } from '../../src/engine/core/EventBus';

describe('Demo Game Playthrough Simulation (The Alchemist\'s Mystery)', () => {
  const project = demoProject as unknown as ProjectData;
  let dialogSys: DialogSystem;
  let storySys: StoryGraphSystem;
  let invSys: InventorySystem;

  beforeEach(() => {
    EventBus.getInstance().clear();

    storySys = new StoryGraphSystem();
    StoryGraphSystem.setInstance(storySys);
    storySys.loadProject(project);

    invSys = new InventorySystem();
    InventorySystem.setInstance(invSys);
    for (const item of project.items || []) {
      invSys.registerItem(item);
    }

    dialogSys = new DialogSystem();
    DialogSystem.setInstance(dialogSys);
    for (const tree of project.dialogs || []) {
      dialogSys.registerDialog(tree);
    }

    // Connect EventBus inventory & flag updates
    EventBus.getInstance().on('flag:set', (payload: any) => {
      const flagName = typeof payload === 'string' ? payload : payload.flag;
      const flagVal = typeof payload === 'string' ? true : payload.value;
      storySys.setFlag(flagName, flagVal);
    });

    EventBus.getInstance().on('inventory:give', (itemId: string) => {
      invSys.addItem(itemId);
    });
  });

  it('progresses through Master Eldrin dialog, sets flags, and receives glowing crystal item', () => {
    const flagGetter = (flag: string) => {
      if (flag.startsWith('hasItem:')) {
        return invSys.hasItem(flag.substring(8));
      }
      return storySys.getFlag(flag);
    };

    // Initial state
    expect(storySys.getFlag('eldrinFirstTalkDone')).toBe(false);
    expect(invSys.hasItem('item_crystal')).toBe(false);

    // 1. Start Eldrin conversation (enters router_5 -> branch_1 -> node_1)
    const started = dialogSys.startDialog('dlg_eldrin', flagGetter);
    expect(started).toBe(true);

    // router_5 routes to node_1 because notFlag 'eldrinFirstTalkDone' is true
    expect(dialogSys.getCurrentNode()?.id).toBe('node_1');
    expect(dialogSys.getCurrentNode()?.speaker).toBe('Master Eldrin');

    // 2. Select choice c1: "I seek the legendary Elixir of Wisdom!"
    dialogSys.selectChoice('c1', flagGetter);
    // Player finishes saying the line, advances to Eldrin's response node
    dialogSys.advanceNextNode(flagGetter);

    // Should arrive at node_2
    expect(dialogSys.getCurrentNode()?.id).toBe('node_2');
    expect(invSys.hasItem('item_crystal')).toBe(true);

    // 3. Complete conversation via choice c3: "Thank you, Master Eldrin! I shall do so at once."
    dialogSys.selectChoice('c3', flagGetter);
    dialogSys.advanceNextNode(flagGetter);
    expect(dialogSys.getCurrentNode()?.id).toBe('node_end');

    // End dialog
    dialogSys.endDialog();

    // Verify flag was set during conversation
    expect(storySys.getFlag('eldrinFirstTalkDone')).toBe(true);

    // 4. Talking to Eldrin a second time: router_5 routes to node_6 because eldrinFirstTalkDone is now true
    dialogSys.startDialog('dlg_eldrin', flagGetter);
    expect(dialogSys.getCurrentNode()?.id).toBe('node_6');
    expect(dialogSys.getCurrentNode()?.text).toBe('Yes, Sir Ronald?');

    // In node_6, since player has item_crystal, branch_2 ("Remind me what I should do now?") is available
    const node6Choices = dialogSys.getCurrentNode()?.choices || [];
    const validChoices = node6Choices.filter(c => {
      if (c.requiredFlag) return flagGetter(c.requiredFlag);
      if (c.notFlag) return !flagGetter(c.notFlag);
      return true;
    });
    expect(validChoices.some(c => c.id === 'branch_2')).toBe(true);
    expect(validChoices.some(c => c.id === 'branch_1')).toBe(false); // notFlag hasItem:item_crystal blocks branch_1
  });
});
