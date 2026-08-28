import { GameRuntime } from '../engine/runtime/GameRuntime';
import { ProjectData } from '../engine/types';
import { ProjectSerializer } from '../engine/storage/ProjectSerializer';
import bundledGameProject from '../../demo/the_alchemist\'s_mystery.json';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container');
  if (!container) return;

  let gameData: ProjectData = bundledGameProject as unknown as ProjectData;

  try {
    const res = await fetch('./the_alchemist\'s_mystery.json?t=' + Date.now());
    if (res.ok) {
      const jsonText = await res.text();
      gameData = ProjectSerializer.deserialize(jsonText);
    }
  } catch (e) {
    console.log('Running from bundled game project data');
  }

  const runtime = new GameRuntime(container, gameData);
  await runtime.init();
});
