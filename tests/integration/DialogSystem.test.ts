import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogSystem } from '../../src/engine/systems/DialogSystem';
import { EventBus } from '../../src/engine/core/EventBus';
import { DialogTree } from '../../src/engine/types';

describe('DialogSystem Integration', () => {
  let dialogSys: DialogSystem;

  beforeEach(() => {
    EventBus.getInstance().clear();
    dialogSys = new DialogSystem();
    DialogSystem.setInstance(dialogSys);
  });

  const testTree: DialogTree = {
    id: 'tree_alchemist',
    title: 'Alchemist Conversation',
    startNodeId: 'node_greeting',
    nodes: {
      node_greeting: {
        id: 'node_greeting',
        speaker: 'Alchemist',
        text: 'Greetings, traveler. Have you brought the ingredients?',
        choices: [
          {
            id: 'c_yes',
            text: 'Yes, here is the blue potion.',
            requiredFlag: 'has_potion',
            nextNodeId: 'node_success',
            setFlag: 'given_potion'
          },
          {
            id: 'c_no',
            text: 'Not yet, still searching.',
            nextNodeId: 'node_farewell'
          }
        ]
      },
      node_success: {
        id: 'node_success',
        speaker: 'Alchemist',
        text: 'Magnificent! Here is your reward.',
        giveItem: 'magic_amulet',
        choices: []
      },
      node_farewell: {
        id: 'node_farewell',
        speaker: 'Alchemist',
        text: 'Return when you have it.',
        choices: []
      }
    }
  };

  it('starts dialog and filters conditional choices based on flags', () => {
    dialogSys.registerDialog(testTree);

    let presentedNodePayload: any = null;
    EventBus.getInstance().on('dialog:node', (payload) => {
      presentedNodePayload = payload;
    });

    // Flag has_potion is false
    const started = dialogSys.startDialog('tree_alchemist', (f) => f === 'has_potion_wrong');
    expect(started).toBe(true);

    expect(presentedNodePayload).not.toBeNull();
    expect(presentedNodePayload.speaker).toBe('Alchemist');
    // Choice c_yes should be filtered out because has_potion is false
    expect(presentedNodePayload.choices).toHaveLength(1);
    expect(presentedNodePayload.choices[0].id).toBe('c_no');
  });

  it('reveals conditional choice when required flag is met', () => {
    dialogSys.registerDialog(testTree);

    let presentedNodePayload: any = null;
    EventBus.getInstance().on('dialog:node', (payload) => {
      presentedNodePayload = payload;
    });

    // Flag has_potion is true
    dialogSys.startDialog('tree_alchemist', (f) => f === 'has_potion');

    expect(presentedNodePayload.choices).toHaveLength(2);
    expect(presentedNodePayload.choices.map((c: any) => c.id)).toEqual(['c_yes', 'c_no']);
  });

  it('selects choice, emits setFlag and navigates to target node with giveItem', () => {
    dialogSys.registerDialog(testTree);

    const flagSetSpy = vi.fn();
    const inventoryGiveSpy = vi.fn();
    EventBus.getInstance().on('flag:set', flagSetSpy);
    EventBus.getInstance().on('inventory:give', inventoryGiveSpy);

    let currentNodePayload: any = null;
    EventBus.getInstance().on('dialog:node', (payload) => {
      currentNodePayload = payload;
    });

    dialogSys.startDialog('tree_alchemist', (f) => f === 'has_potion');

    // Player picks c_yes
    dialogSys.selectChoice('c_yes', (f) => f === 'has_potion');
    expect(flagSetSpy).toHaveBeenCalledWith('given_potion');

    // Player advances past their own spoken response line to the NPC node
    dialogSys.advanceNextNode((f) => f === 'has_potion');

    // Advances to node_success which awards magic_amulet
    expect(dialogSys.getCurrentNode()?.id).toBe('node_success');
    expect(inventoryGiveSpy).toHaveBeenCalledWith('magic_amulet');
  });

  it('ends dialog cleanly when reaching terminal node', () => {
    dialogSys.registerDialog(testTree);

    const dialogEndSpy = vi.fn();
    EventBus.getInstance().on('dialog:end', dialogEndSpy);

    dialogSys.startDialog('tree_alchemist');
    dialogSys.endDialog();

    expect(dialogEndSpy).toHaveBeenCalled();
    expect(dialogSys.getCurrentNode()).toBeNull();
  });
});
