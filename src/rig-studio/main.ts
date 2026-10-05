import { RigStudioApp } from './RigStudioApp';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('rig-studio-app');
  if (root) {
    new RigStudioApp(root);
  }
});
