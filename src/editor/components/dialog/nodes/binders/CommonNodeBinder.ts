import { NodeBinderParams } from './NodeBinderTypes';

export class CommonNodeBinder {
  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    // Node Type Selector
    container.querySelectorAll('.node-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const newType = (e.target as HTMLSelectElement).value as 'beat' | 'router' | 'event_listener' | 'action';
        const node = tree.nodes[nid];
        if (!node) return;

        node.nodeType = newType;
        node.isRouterNode = newType === 'router';

        if (newType === 'event_listener') {
          if (!node.eventScope) node.eventScope = 'scene';
          if (!node.eventTargetId) node.eventTargetId = project?.scenes[0]?.id || '';
          if (!node.eventName) node.eventName = 'enter';
        } else if (newType === 'action') {
          if (!node.actionCategory) node.actionCategory = 'screen_effect';
          if (!node.screenEffectType) node.screenEffectType = 'fade_in';
          if (node.screenEffectDuration === undefined) node.screenEffectDuration = 1.0;
        } else if (newType === 'router') {
          if (!node.choices || node.choices.length === 0) {
            node.choices = [
              { id: 'branch_1', text: 'If Has Flag...', nextNodeId: '' },
              { id: 'branch_2', text: 'Else (Fallback)', nextNodeId: '' }
            ];
          }
        }

        onReRender();
        onUpdate();
      });
    });

    // Make Start Node
    container.querySelectorAll('.btn-make-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        tree.startNodeId = nid;
        onReRender();
        onUpdate();
      });
    });

    // Delete Node
    container.querySelectorAll('.btn-del-node').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        delete tree.nodes[nid];
        if (tree.startNodeId === nid) {
          tree.startNodeId = Object.keys(tree.nodes)[0] || '';
        }
        onReRender();
        onUpdate();
      });
    });
  }
}
