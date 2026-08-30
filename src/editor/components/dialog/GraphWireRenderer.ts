import { DialogTree } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';

export interface WireRenderContext {
  tree: DialogTree;
  svgEl: SVGElement;
  transformLayer: HTMLElement;
  zoomLevel: number;
  isWiring: boolean;
  tempWirePath: string | null;
  onWireDeleted: () => void;
}

export class GraphWireRenderer {
  public static renderConnectionLines(ctx: WireRenderContext): void {
    const { tree, svgEl, transformLayer, zoomLevel, isWiring, tempWirePath, onWireDeleted } = ctx;
    if (!svgEl || !transformLayer) return;
    const layerRect = transformLayer.getBoundingClientRect();

    let pathsHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24"/>
        </marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
        </marker>
        <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c084fc"/>
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/>
        </marker>
        <marker id="arrow-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981"/>
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444"/>
        </marker>
      </defs>
    `;

    const nodes = tree.nodes;
    for (const sourceNode of Object.values(nodes)) {
      const isRouter = Boolean(sourceNode.isRouterNode || sourceNode.nodeType === 'router');

      if (sourceNode.choices && sourceNode.choices.length > 0) {
        sourceNode.choices.forEach((c, cIdx) => {
          if (!c.nextNodeId || !nodes[c.nextNodeId]) return;

          const outPort = transformLayer.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"][data-cidx="${cIdx}"]`);
          const inPort = transformLayer.querySelector(`.node-port-in[data-nodeid="${c.nextNodeId}"]`);

          if (outPort && inPort) {
            const rOut = outPort.getBoundingClientRect();
            const rIn = inPort.getBoundingClientRect();

            const x1 = (rOut.left + rOut.width / 2 - layerRect.left) / zoomLevel;
            const y1 = (rOut.top + rOut.height / 2 - layerRect.top) / zoomLevel;
            const x2 = (rIn.left + rIn.width / 2 - layerRect.left) / zoomLevel;
            const y2 = (rIn.top + rIn.height / 2 - layerRect.top) / zoomLevel;

            const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            const strokeColor = isRouter ? '#c084fc' : '#fbbf24';
            const markerId = isRouter ? 'arrow-purple' : 'arrow';

            // Position disconnect button at 15% along the Bezier curve
            const t = 0.15;
            const t1 = 1 - t;
            const btnX = (t1 * t1 * t1 * x1) + (3 * t1 * t1 * t * (x1 + dx)) + (3 * t1 * t * t * (x2 - dx)) + (t * t * t * x2);
            const btnY = (t1 * t1 * t1 * y1) + (3 * t1 * t1 * t * y1) + (3 * t1 * t * t * y2) + (t * t * t * y2);

            pathsHTML += `
              <g class="wire-group" data-srcnode="${sourceNode.id}" data-cidx="${cIdx}" data-targetnode="${c.nextNodeId}">
                <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" marker-end="url(#${markerId})" style="filter: drop-shadow(0 0 4px ${strokeColor}88);" />
                <circle cx="${btnX}" cy="${btnY}" r="9" fill="#0f172a" stroke="#ef4444" stroke-width="1.5" style="cursor:pointer; pointer-events:auto;" class="wire-delete-btn" data-srcnode="${sourceNode.id}" data-cidx="${cIdx}" />
                <text x="${btnX}" y="${btnY + 3}" fill="#ef4444" font-size="10" font-weight="900" text-anchor="middle" style="pointer-events:none; user-select:none;">✕</text>
              </g>
            `;
          }
        });
      } else if (sourceNode.nextNodeId && nodes[sourceNode.nextNodeId]) {
        const outPort = transformLayer.querySelector(`.node-port-out[data-nodeid="${sourceNode.id}"]`);
        const inPort = transformLayer.querySelector(`.node-port-in[data-nodeid="${sourceNode.nextNodeId}"]`);

        if (outPort && inPort) {
          const rOut = outPort.getBoundingClientRect();
          const rIn = inPort.getBoundingClientRect();

          const x1 = (rOut.left + rOut.width / 2 - layerRect.left) / zoomLevel;
          const y1 = (rOut.top + rOut.height / 2 - layerRect.top) / zoomLevel;
          const x2 = (rIn.left + rIn.width / 2 - layerRect.left) / zoomLevel;
          const y2 = (rIn.top + rIn.height / 2 - layerRect.top) / zoomLevel;

          const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
          const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          let strokeColor = '#38bdf8';
          let markerId = 'arrow-blue';
          if (sourceNode.nodeType === 'event_listener') {
            strokeColor = '#f59e0b';
            markerId = 'arrow-amber';
          } else if (sourceNode.nodeType === 'action') {
            strokeColor = '#10b981';
            markerId = 'arrow-emerald';
          } else if (sourceNode.nodeType === 'router' || sourceNode.isRouterNode) {
            strokeColor = '#c084fc';
            markerId = 'arrow-purple';
          }

          // Position disconnect button at 15% along the Bezier curve
          const t = 0.15;
          const t1 = 1 - t;
          const btnX = (t1 * t1 * t1 * x1) + (3 * t1 * t1 * t * (x1 + dx)) + (3 * t1 * t * t * (x2 - dx)) + (t * t * t * x2);
          const btnY = (t1 * t1 * t1 * y1) + (3 * t1 * t1 * t * y1) + (3 * t1 * t * t * y2) + (t * t * t * y2);

          pathsHTML += `
            <g class="wire-group" data-srcnode="${sourceNode.id}" data-targetnode="${sourceNode.nextNodeId}">
              <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" marker-end="url(#${markerId})" style="filter: drop-shadow(0 0 4px ${strokeColor}88);" />
              <circle cx="${btnX}" cy="${btnY}" r="9" fill="#0f172a" stroke="#ef4444" stroke-width="1.5" style="cursor:pointer; pointer-events:auto;" class="wire-delete-btn" data-srcnode="${sourceNode.id}" />
              <text x="${btnX}" y="${btnY + 3}" fill="#ef4444" font-size="10" font-weight="900" text-anchor="middle" style="pointer-events:none; user-select:none;">✕</text>
            </g>
          `;
        }
      }
    }

    if (isWiring && tempWirePath) {
      pathsHTML += `
        <path d="${tempWirePath}" fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="6,4" stroke-linecap="round" marker-end="url(#arrow)" style="filter: drop-shadow(0 0 6px #22c55e);" />
      `;
    }

    svgEl.innerHTML = pathsHTML;

    svgEl.querySelectorAll('.wire-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const srcNodeId = target.dataset.srcnode;
        const cIdxStr = target.dataset.cidx;

        if (srcNodeId && tree.nodes[srcNodeId]) {
          if (cIdxStr !== undefined && cIdxStr !== '') {
            const cIdx = parseInt(cIdxStr);
            if (tree.nodes[srcNodeId].choices && tree.nodes[srcNodeId].choices![cIdx]) {
              tree.nodes[srcNodeId].choices![cIdx].nextNodeId = '';
            }
          } else {
            tree.nodes[srcNodeId].nextNodeId = undefined;
          }
          onWireDeleted();
          EventBus.getInstance().emit('editor:project_updated');
        }
      });
    });
  }
}
