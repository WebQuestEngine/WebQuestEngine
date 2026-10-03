import { DialogTree, ProjectData } from '../../../../../engine/types';

export interface NodeBinderParams {
  container: HTMLElement;
  tree: DialogTree;
  project: ProjectData | null;
  onReRender: () => void;
  onUpdate: () => void;
}
