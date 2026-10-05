import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '../../../src/engine/scene/Scene';
import { CharacterData, SceneData } from '../../../src/engine/types';
import { EventBus } from '../../../src/engine/core/EventBus';

// Mock PIXI and AssetManager to run in Node environment
vi.mock('../../../src/engine/core/AssetManager', () => {
  return {
    AssetManager: {
      getInstance: () => ({
        loadTexture: vi.fn().mockResolvedValue({
          width: 256,
          height: 256,
          source: {}
        })
      })
    }
  };
});

describe('Character System & Character Switching', () => {
  const characterDefinitions: CharacterData[] = [
    {
      id: 'char_sam',
      name: 'Sam',
      spriteSheetUrl: 'sam.png',
      frameWidth: 64,
      frameHeight: 96,
      speed: 200,
      scale: 1
    },
    {
      id: 'char_max',
      name: 'Max',
      spriteSheetUrl: 'max.png',
      frameWidth: 48,
      frameHeight: 64,
      speed: 260,
      scale: 0.8
    }
  ];

  beforeEach(() => {
    EventBus.getInstance().clear();
  });

  it('initializes playable character from scene.playerCharacterId', async () => {
    const sceneData: SceneData = {
      id: 'sc_office',
      name: 'Freelance Police Office',
      playerCharacterId: 'char_max',
      characters: [
        { characterId: 'char_sam', position: { x: 100, y: 300 } },
        { characterId: 'char_max', position: { x: 200, y: 300 } }
      ],
      hotspots: []
    };

    const scene = new Scene(sceneData, characterDefinitions);
    await scene.init();

    expect(scene.playerCharacter).toBeDefined();
    expect(scene.playerCharacter?.id).toBe('char_max');
    expect(scene.characters).toHaveLength(2);
  });

  it('defaults playable character to the first defined character when playerCharacterId is not specified', async () => {
    const sceneData: SceneData = {
      id: 'sc_office',
      name: 'Freelance Police Office',
      characters: [
        { characterId: 'char_sam', position: { x: 100, y: 300 } },
        { characterId: 'char_max', position: { x: 200, y: 300 } }
      ],
      hotspots: []
    };

    const scene = new Scene(sceneData, characterDefinitions);
    await scene.init();

    expect(scene.playerCharacter).toBeDefined();
    expect(scene.playerCharacter?.id).toBe('char_sam');
  });

  it('switches playable character via scene.switchPlayerCharacter', async () => {
    const sceneData: SceneData = {
      id: 'sc_office',
      name: 'Freelance Police Office',
      playerCharacterId: 'char_sam',
      characters: [
        { characterId: 'char_sam', position: { x: 100, y: 300 } },
        { characterId: 'char_max', position: { x: 200, y: 300 } }
      ],
      hotspots: []
    };

    const scene = new Scene(sceneData, characterDefinitions);
    await scene.init();

    expect(scene.playerCharacter?.id).toBe('char_sam');

    const mockCamera = {
      follow: vi.fn()
    } as any;

    const switched = scene.switchPlayerCharacter('char_max', mockCamera);

    expect(switched).toBeDefined();
    expect(switched?.id).toBe('char_max');
    expect(scene.playerCharacter?.id).toBe('char_max');
    expect(scene.data.playerCharacterId).toBe('char_max');
    expect(mockCamera.follow).toHaveBeenCalledWith(switched?.container);
  });

  it('returns null and does not switch if target character is not in scene', async () => {
    const sceneData: SceneData = {
      id: 'sc_office',
      name: 'Freelance Police Office',
      playerCharacterId: 'char_sam',
      characters: [
        { characterId: 'char_sam', position: { x: 100, y: 300 } }
      ],
      hotspots: []
    };

    const scene = new Scene(sceneData, characterDefinitions);
    await scene.init();

    const mockCamera = { follow: vi.fn() } as any;
    const switched = scene.switchPlayerCharacter('non_existent', mockCamera);

    expect(switched).toBeNull();
    expect(scene.playerCharacter?.id).toBe('char_sam');
    expect(mockCamera.follow).not.toHaveBeenCalled();
  });
});
