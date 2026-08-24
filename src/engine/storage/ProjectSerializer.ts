import { ProjectData } from '../types';

export class ProjectSerializer {
  public static serialize(project: ProjectData): string {
    return JSON.stringify(project, null, 2);
  }

  public static deserialize(jsonString: string): ProjectData {
    const data = JSON.parse(jsonString) as ProjectData;
    if (!data.version || !data.scenes || !data.chapters) {
      throw new Error('Invalid project structure. Missing essential fields.');
    }
    return data;
  }
}
