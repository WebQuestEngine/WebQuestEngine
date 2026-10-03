import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionExecutor, ActionHost } from '../../src/engine/runtime/ActionExecutor';
import { RuntimeContext } from '../../src/engine/runtime/RuntimeContext';
import { ProjectSerializer } from '../../src/engine/storage/ProjectSerializer';
import { EventBus } from '../../src/engine/core/EventBus';

describe('ActionExecutor Integration', () => {
  let executor: ActionExecutor;
  let context: RuntimeContext;
  let host: ActionHost;

  beforeEach(() => {
    EventBus.getInstance().clear();

    const project = ProjectSerializer.createStarterProject('Action Executor Quest');
    project.items = [
      { id: 'rusty_key', name: 'Rusty Key', iconUrl: 'assets/key.png' },
      { id: 'potion', name: 'Potion', iconUrl: 'assets/potion.png' }
    ];
    project.scenes.push({
      id: 'scene_dungeon',
      name: 'Dungeon',
      width: 1920,
      height: 1080,
      layers: [],
      walkPaths: [],
      hotspots: [],
      characters: [],
      playerSpawn: { x: 200, y: 300 }
    });

    const container = document.createElement('div');
    context = new RuntimeContext(project, container);
    host = {
      currentScene: null,
      context
    };
    executor = new ActionExecutor(host);
  });

  it('executes text and notification actions', () => {
    const notifySpy = vi.fn();
    EventBus.getInstance().on('ui:notify', notifySpy);

    executor.executeAction({
      verb: 'look',
      text: 'A dark and damp corridor.'
    });

    expect(notifySpy).toHaveBeenCalledWith('A dark and damp corridor.');
  });

  it('sets and clears flags when specified in action', () => {
    executor.executeAction({
      verb: 'use',
      setFlag: 'lever_pulled',
      setFlags: ['gate_unlocked', 'secret_found']
    });

    expect(context.story.getFlag('lever_pulled')).toBe(true);
    expect(context.story.getFlag('gate_unlocked')).toBe(true);
    expect(context.story.getFlag('secret_found')).toBe(true);

    executor.executeAction({
      verb: 'use',
      clearFlag: 'lever_pulled'
    });
    expect(context.story.getFlag('lever_pulled')).toBe(false);
  });

  it('adds and removes items via action directives', () => {
    executor.executeAction({
      verb: 'pick_up',
      giveItemId: 'rusty_key',
      giveItems: ['potion']
    });

    expect(context.inventory.hasItem('rusty_key')).toBe(true);
    expect(context.inventory.hasItem('potion')).toBe(true);

    executor.executeAction({
      verb: 'use',
      takeItems: ['rusty_key']
    });
    expect(context.inventory.hasItem('rusty_key')).toBe(false);
  });

  it('triggers scene transition on action with targetSceneId', () => {
    const sceneChangeSpy = vi.fn();
    EventBus.getInstance().on('scene:change', sceneChangeSpy);

    executor.executeAction({
      verb: 'use',
      targetSceneId: 'scene_dungeon',
      targetSpawnPoint: { x: 200, y: 300 }
    });

    expect(context.story.getCurrentScene()?.id).toBe('scene_dungeon');
    expect(sceneChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
      spawnPoint: { x: 200, y: 300 }
    }));
  });

  it('blocks action when requiredFlag is not met', () => {
    const notifySpy = vi.fn();
    EventBus.getInstance().on('ui:notify', notifySpy);

    executor.executeAction({
      verb: 'use',
      requiredFlag: 'has_permission',
      setFlag: 'vault_opened'
    });

    expect(context.story.getFlag('vault_opened')).toBe(false);
    expect(notifySpy).toHaveBeenCalledWith('You cannot do that right now.');
  });
});
