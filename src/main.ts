import { EditorApp } from './editor/EditorApp';
import alchemistProject from '../demo/the_alchemist\'s_mystery.json';
import { ProjectData } from './engine/types';
import { ProjectSerializer } from './engine/storage/ProjectSerializer';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  let initialProject: ProjectData = alchemistProject as unknown as ProjectData;

  try {
    const res = await fetch('./the_alchemist\'s_mystery.json?t=' + Date.now());
    if (res.ok) {
      const jsonText = await res.text();
      initialProject = ProjectSerializer.deserialize(jsonText);
    }
  } catch (err) {
    console.warn('Could not fetch dynamic project JSON from disk, falling back to bundled default', err);
  }

  const app = new EditorApp(appContainer, initialProject);
  await app.init();
});
