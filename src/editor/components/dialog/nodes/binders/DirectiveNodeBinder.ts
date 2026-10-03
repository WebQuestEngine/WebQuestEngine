import { NodeBinderParams } from './NodeBinderTypes';
import { DirectiveActionType } from '../../../../../engine/types';
import { DialogEditorUtils } from '../../DialogEditorUtils';
import { resolvePickedAssetPath } from '../../../../utils/AssetPathUtils';

export class DirectiveNodeBinder {
  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    // Stage Directives Add
    container.querySelectorAll('.btn-add-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].directives) tree.nodes[nid].directives = [];
          tree.nodes[nid].directives!.push({
            id: `dir_${Date.now()}`,
            type: 'animation',
            actorId: 'player',
            animationName: 'gesture'
          });
          onReRender();
          onUpdate();
        }
      });
    });

    // Stage Directives Delete
    container.querySelectorAll('.btn-del-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);
        if (tree.nodes[nid]?.directives) {
          tree.nodes[nid].directives!.splice(didx, 1);
          onReRender();
          onUpdate();
        }
      });
    });

    // Directive Type Select
    container.querySelectorAll('.dir-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].type = target.value as DirectiveActionType;
          onReRender();
          onUpdate();
        }
      });
    });

    // Directive Actor Select
    container.querySelectorAll('.dir-actor-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].actorId = target.value;
          const anims = DialogEditorUtils.getActorAnimations(project, target.value);
          if (anims.length > 0) tree.nodes[nid].directives![didx].animationName = anims[0];
          onReRender();
          onUpdate();
        }
      });
    });

    // Directive Animation Select
    container.querySelectorAll('.dir-anim-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].animationName = target.value;
          onUpdate();
        }
      });
    });

    // Directive Loop Animation Checkbox
    container.querySelectorAll('.dir-loop-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        const didx = parseInt((chk as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].loopAnimation = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    // Directive Delay Input
    container.querySelectorAll('.dir-delay-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].delaySeconds = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    // Directive Choreography Group
    container.querySelectorAll('.dir-choreo-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].choreographyGroupId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Directive Item Select
    container.querySelectorAll('.dir-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].itemId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Directive Emote Text
    container.querySelectorAll('.dir-emote-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].emoteText = (input as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    // Directive Target Actor
    container.querySelectorAll('.dir-target-actor').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].targetActorId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Directive Walk Target X & Y
    container.querySelectorAll('.dir-walk-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.x = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-walk-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.y = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-walk-ignore-walkpath').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        const didx = parseInt((chk as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].ignoreWalkPath = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    // Viewport Pick Walk Target
    container.querySelectorAll('.btn-pick-dir-pos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nid = (btn as HTMLElement).dataset.nodeid!;
        const didx = parseInt((btn as HTMLElement).dataset.didx!);
        DialogEditorUtils.startViewportPick((pt) => {
          if (!tree.nodes[nid]?.directives?.[didx]) return;
          if (!tree.nodes[nid].directives![didx].targetPosition) {
            tree.nodes[nid].directives![didx].targetPosition = { x: 0, y: 0 };
          }
          tree.nodes[nid].directives![didx].targetPosition!.x = pt.x;
          tree.nodes[nid].directives![didx].targetPosition!.y = pt.y;

          const xInput = container.querySelector(`.dir-walk-x[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          const yInput = container.querySelector(`.dir-walk-y[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          if (xInput) xInput.value = String(pt.x);
          if (yInput) yInput.value = String(pt.y);
          onUpdate();
        });
      });
    });

    // Directive SFX URL & File
    container.querySelectorAll('.dir-sfx-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].sfxUrl = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-sfx-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);

        if (file && tree.nodes[nid]?.directives?.[didx]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].directives![didx].sfxUrl = relPath;
          const urlInput = container.querySelector(`.dir-sfx-url[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    // Directive Camera Action & Zoom
    container.querySelectorAll('.dir-camera-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraAction = target.value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-camera-zoom').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraZoom = parseFloat((input as HTMLInputElement).value) || 1.0;
          onUpdate();
        }
      });
    });

    // Directive Event Name & Payload
    container.querySelectorAll('.dir-event-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventName = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-event-payload').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventPayload = (input as HTMLInputElement).value || undefined;
          onUpdate();
        }
      });
    });

    // Drag & Drop Re-ordering for Stage Directives
    let draggedDirNid: string | null = null;
    let draggedDirIdx: number | null = null;

    container.querySelectorAll('.stage-directive-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const didx = parseInt(el.dataset.didx || '-1');
        if (nid && didx >= 0) {
          draggedDirNid = nid;
          draggedDirIdx = didx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${didx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedDirNid = null;
        draggedDirIdx = null;
        el.style.opacity = '1';
        container.querySelectorAll('.stage-directive-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedDirNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #f59e0b';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetDIdx = parseInt(el.dataset.didx || '-1');

        if (draggedDirNid && draggedDirNid === targetNid && draggedDirIdx !== null && targetDIdx >= 0 && draggedDirIdx !== targetDIdx) {
          const dirs = tree.nodes[targetNid]?.directives;
          if (dirs) {
            const [moved] = dirs.splice(draggedDirIdx, 1);
            dirs.splice(targetDIdx, 0, moved);
            onReRender();
            onUpdate();
          }
        }
        draggedDirNid = null;
        draggedDirIdx = null;
      });
    });
  }
}
