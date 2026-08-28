import { ProjectData, UIPresetType } from '../types';

export interface RecentProjectEntry {
  id: string;
  title: string;
  author: string;
  filename?: string;
  lastModified: number;
  sceneCount: number;
  chapterCount: number;
  itemCount: number;
  preset: UIPresetType;
  data: ProjectData;
}

const STORAGE_KEY = 'questforge_recent_projects_v1';
const MAX_RECENT_PROJECTS = 12;

export class RecentProjectsManager {
  public static getRecentProjects(): RecentProjectEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    } catch (err) {
      console.warn('Failed to read recent projects from localStorage', err);
      return [];
    }
  }

  public static addOrUpdateRecentProject(project: ProjectData, filename?: string): void {
    if (!project || !project.title) return;

    try {
      const existingList = this.getRecentProjects();
      const projectId = this.generateProjectId(project);
      const existingEntry = existingList.find(p => p.id === projectId || p.title.toLowerCase() === project.title.toLowerCase());

      const finalFilename = filename || existingEntry?.filename || `${project.title.toLowerCase().replace(/\s+/g, '_')}.json`;

      const entry: RecentProjectEntry = {
        id: projectId,
        title: project.title.trim() || 'Untitled Quest',
        author: project.author?.trim() || 'Quest Creator',
        filename: finalFilename,
        lastModified: Date.now(),
        sceneCount: project.scenes?.length || 0,
        chapterCount: project.chapters?.length || 0,
        itemCount: project.items?.length || 0,
        preset: project.uiConfig?.preset || 'lucasarts',
        data: JSON.parse(JSON.stringify(project))
      };

      // Filter out existing matching project by ID or title
      const filtered = existingList.filter(p => p.id !== projectId && p.title.toLowerCase() !== entry.title.toLowerCase());
      filtered.unshift(entry);

      const trimmed = filtered.slice(0, MAX_RECENT_PROJECTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err: any) {
      console.warn('Failed to save recent project to localStorage (quota or serialization):', err);
      // Attempt quota recovery by keeping only top 3
      try {
        const existingList = this.getRecentProjects();
        const top3 = existingList.slice(0, 3);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(top3));
      } catch (innerErr) {
        // ignore
      }
    }
  }

  public static removeRecentProject(id: string): void {
    try {
      const list = this.getRecentProjects().filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to remove recent project', err);
    }
  }

  public static clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear recent projects', err);
    }
  }

  private static generateProjectId(project: ProjectData): string {
    const slug = (project.title || 'quest').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `proj_${slug}`;
  }
}
