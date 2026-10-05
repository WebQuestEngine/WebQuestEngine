import { describe, it, expect } from 'vitest';
import { CharacterVisualFactory } from '../../../src/engine/visualization/CharacterVisualFactory';
import { ProceduralCharacterVisualizer } from '../../../src/engine/visualization/ProceduralCharacterVisualizer';
import { SkeletalCharacterVisualizer } from '../../../src/engine/visualization/SkeletalCharacterVisualizer';
import { SpriteSheetCharacterVisualizer } from '../../../src/engine/visualization/SpriteSheetCharacterVisualizer';
import { Character } from '../../../src/engine/scene/Character';
import { CharacterData } from '../../../src/engine/types';

describe('CharacterVisualFactory & Decoupled Character', () => {
  it('instantiates ProceduralCharacterVisualizer for procedural visual configs', () => {
    const visualizer = CharacterVisualFactory.create({
      id: 'char_proc',
      name: 'Procedural Hero',
      visual: {
        type: 'procedural',
        archetype: 'robot',
        palette: { skin: '#cbd5e1', hair: '#38bdf8', torso: '#1e293b', legs: '#0f172a', feet: '#020617', accent: '#06b6d4' },
        proportions: { headScale: 1, bodyWidth: 32, bodyHeight: 48, limbLength: 30, limbThickness: 10 }
      }
    } as any);

    expect(visualizer).toBeInstanceOf(ProceduralCharacterVisualizer);
  });

  it('instantiates SkeletalCharacterVisualizer for skeletal visual configs', () => {
    const visualizer = CharacterVisualFactory.create({
      id: 'char_skel',
      name: 'Skeletal Monster',
      visual: {
        type: 'skeletal',
        format: 'native',
        skeleton: { bones: [], slots: [], attachments: {} },
        animations: {}
      }
    } as any);

    expect(visualizer).toBeInstanceOf(SkeletalCharacterVisualizer);
  });

  it('instantiates SpriteSheetCharacterVisualizer for standard spritesheet data', () => {
    const visualizer = CharacterVisualFactory.create({
      id: 'char_sprite',
      name: 'Sprite Guy',
      spriteSheetUrl: 'assets/hero.png',
      frameWidth: 64,
      frameHeight: 96
    });

    expect(visualizer).toBeInstanceOf(SpriteSheetCharacterVisualizer);
  });

  it('allows registering and creating custom visualizers', () => {
    class CustomVisualizer extends SpriteSheetCharacterVisualizer {}
    CharacterVisualFactory.register('custom_mesh', (config) => new CustomVisualizer(config));

    const visualizer = CharacterVisualFactory.createFromConfig({
      type: 'custom_mesh',
      spriteSheetUrl: '',
      frameWidth: 32,
      frameHeight: 32,
      animations: {}
    } as any);

    expect(visualizer).toBeInstanceOf(CustomVisualizer);
  });

  it('integrates cleanly with Character and allows swapping visualizers dynamically', async () => {
    const charData: CharacterData = {
      id: 'char_test',
      name: 'Tester',
      speed: 200,
      scale: 1,
      talkColor: '#ffffff',
      visual: {
        type: 'procedural',
        archetype: 'humanoid',
        palette: { skin: '#fed7aa', hair: '#78350f', torso: '#2563eb', legs: '#1e293b', feet: '#0f172a', accent: '#e11d48' },
        proportions: { headScale: 1, bodyWidth: 32, bodyHeight: 48, limbLength: 30, limbThickness: 10 }
      }
    };

    const character = new Character(charData);
    await character.init();

    expect(character.visualizer).toBeInstanceOf(ProceduralCharacterVisualizer);

    // Swap visualizer dynamically at runtime
    const newVisualizer = new SpriteSheetCharacterVisualizer({
      type: 'spritesheet',
      spriteSheetUrl: '',
      frameWidth: 64,
      frameHeight: 96,
      animations: {}
    });

    await character.setVisualizer(newVisualizer);
    expect(character.visualizer).toBeInstanceOf(SpriteSheetCharacterVisualizer);
  });
});
