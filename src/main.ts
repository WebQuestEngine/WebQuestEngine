import { EditorApp } from './editor/EditorApp';
import alchemistProject from './demo/the_alchemist\'s_mystery.json';
import { ProjectData } from './engine/types';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const app = new EditorApp(appContainer, alchemistProject as unknown as ProjectData);
  await app.init();
});
