import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryGraphSystem } from '../../../src/engine/systems/StoryGraphSystem';
import { ProjectSerializer } from '../../../src/engine/storage/ProjectSerializer';
import { EventBus } from '../../../src/engine/core/EventBus';

describe('StoryGraphSystem', () => {
  let story: StoryGraphSystem;

  beforeEach(() => {
    EventBus.getInstance().clear();
    story = new StoryGraphSystem();
    StoryGraphSystem.setInstance(story);
  });

  it('loads project with initial flags and sets start chapter/scene', () => {
    const project = ProjectSerializer.createStarterProject();
    project.initialFlags = { quest_started: true };

    const sceneChangeSpy = vi.fn();
    EventBus.getInstance().on('scene:change', sceneChangeSpy);

    story.loadProject(project);

    expect(story.getFlag('quest_started')).toBe(true);
    expect(story.getCurrentChapter()?.id).toBe('ch_1');
    expect(story.getCurrentScene()?.id).toBe('scene_start');
    expect(sceneChangeSpy).toHaveBeenCalled();
  });

  it('sets and updates game flags and emits flag events', () => {
    const project = ProjectSerializer.createStarterProject();
    story.loadProject(project);

    const flagChangedSpy = vi.fn();
    EventBus.getInstance().on('flag:changed', flagChangedSpy);

    story.setFlag('talked_to_wizard', true);
    expect(story.getFlag('talked_to_wizard')).toBe(true);
    expect(flagChangedSpy).toHaveBeenCalledWith({ flag: 'talked_to_wizard', value: true });

    story.setFlag('talked_to_wizard', false);
    expect(story.getFlag('talked_to_wizard')).toBe(false);
  });

  it('transitions scenes and emits target scene with spawn point', () => {
    const project = ProjectSerializer.createStarterProject();
    project.scenes.push({
      id: 'scene_crypt',
      name: 'Crypt',
      width: 1920,
      height: 1080,
      layers: [],
      walkPaths: [],
      hotspots: [],
      characters: [],
      playerSpawn: { x: 500, y: 800 }
    });

    story.loadProject(project);

    const sceneChangeSpy = vi.fn();
    EventBus.getInstance().on('scene:change', sceneChangeSpy);

    story.changeScene('scene_crypt', { x: 300, y: 700 });

    expect(story.getCurrentScene()?.id).toBe('scene_crypt');
    expect(sceneChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
      scene: expect.objectContaining({ id: 'scene_crypt' }),
      spawnPoint: { x: 300, y: 700 }
    }));
  });
});
