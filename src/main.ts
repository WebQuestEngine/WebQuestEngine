import { EditorApp } from './editor/EditorApp';
import { sampleProject } from './demo/sampleProject';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const app = new EditorApp(appContainer, sampleProject);
  await app.init();
});
