import { NodeBinderParams } from './NodeBinderTypes';
import { DialogEditorUtils } from '../../DialogEditorUtils';

export class EventListenerNodeBinder {
  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    container.querySelectorAll('.node-event-scope').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const scope = (e.target as HTMLSelectElement).value as any;
        const node = tree.nodes[nid];
        if (node) {
          node.eventScope = scope;
          if (scope === 'scene') node.eventTargetId = project?.scenes[0]?.id || '';
          else if (scope === 'hotspot') node.eventTargetId = DialogEditorUtils.getAllHotspots(project)[0]?.id || '';
          else if (scope === 'character') node.eventTargetId = DialogEditorUtils.getAllCharacters(project)[0]?.id || '';
          else if (scope === 'item') node.eventTargetId = DialogEditorUtils.getAllItems(project)[0]?.id || '';
          else node.eventTargetId = 'game';

          const availableEvents = DialogEditorUtils.getEventsForScope(scope);
          node.eventName = availableEvents[0]?.id || 'enter';
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-event-target').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const targetId = (e.target as HTMLSelectElement).value;
        if (tree.nodes[nid]) {
          tree.nodes[nid].eventTargetId = targetId;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-event-name').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const evName = (e.target as HTMLSelectElement).value;
        if (tree.nodes[nid]) {
          tree.nodes[nid].eventName = evName;
          onUpdate();
        }
      });
    });
  }
}
