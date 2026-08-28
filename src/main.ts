import { EditorApp } from './editor/EditorApp';
import alchemistProject from '../demo/the_alchemist\'s_mystery.json';
import { ProjectData } from './engine/types';
import { ProjectSerializer } from './engine/storage/ProjectSerializer';
import { ProjectHubModal } from './editor/components/ProjectHubModal';
import { RecentProjectsManager } from './engine/storage/RecentProjectsManager';
import { FileAccessAdapter } from './engine/storage/FileAccessAdapter';

document.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  let projectToLoad: ProjectData | null = null;

  // If user selected not to show the popup on startup, load the most recent project automatically
  if (ProjectHubModal.isStartupSuppressed()) {
    const recents = RecentProjectsManager.getRecentProjects();
    if (recents.length > 0 && recents[0]?.data) {
      projectToLoad = recents[0].data;
      if (recents[0].filename) {
        FileAccessAdapter.setActiveFilename(recents[0].filename);
      }
    } else {
      projectToLoad = alchemistProject as unknown as ProjectData;
      FileAccessAdapter.setActiveFilename("the_alchemist's_mystery.json");
      try {
        const res = await fetch('./the_alchemist\'s_mystery.json?t=' + Date.now());
        if (res.ok) {
          const jsonText = await res.text();
          projectToLoad = ProjectSerializer.deserialize(jsonText);
        }
      } catch (err) {
        console.warn('Could not fetch dynamic project JSON from disk, falling back to bundled default', err);
      }
    }
  }

  // If startup popup is enabled, projectToLoad is null so no default project is loaded before user selection
  const app = new EditorApp(appContainer, projectToLoad);
  await app.init();
});
