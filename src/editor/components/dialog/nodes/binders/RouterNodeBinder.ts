import { NodeBinderParams } from './NodeBinderTypes';
import { DialogEditorUtils } from '../../DialogEditorUtils';
import { resolvePickedAssetPath } from '../../../../utils/AssetPathUtils';

export class RouterNodeBinder {
  public static enforceRouterFallbackLast(tree: any, nid: string): void {
    const node = tree.nodes[nid];
    if (!node || !node.isRouterNode || !node.choices) return;
    const fallbackIdx = node.choices.findIndex((c: any) => c.requiredFlag === undefined && c.notFlag === undefined);
    if (fallbackIdx !== -1 && fallbackIdx !== node.choices.length - 1) {
      const [fallback] = node.choices.splice(fallbackIdx, 1);
      node.choices.push(fallback);
    }
  }

  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    // Condition Flag Name & Op
    container.querySelectorAll('.cond-node-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const val = (input as HTMLInputElement).value;
          const opSel = container.querySelector(`.cond-node-op[data-nodeid="${nid}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            tree.nodes[nid].notFlag = val;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = val;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.cond-node-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const nameInput = container.querySelector(`.cond-node-name[data-nodeid="${nid}"]`) as HTMLInputElement;
          const flag = nameInput?.value.trim() || '';
          const op = (e.target as HTMLSelectElement).value;
          if (op === 'false') {
            tree.nodes[nid].notFlag = flag;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = flag;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          onReRender();
          onUpdate();
        }
      });
    });

    // Interactive Selection Box
    container.querySelectorAll('.node-interactive-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].isChoiceInteractive = (chk as HTMLInputElement).checked;
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices & Rules Add
    container.querySelectorAll('.btn-add-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].choices) tree.nodes[nid].choices = [];
          const isR = Boolean(tree.nodes[nid].isRouterNode);
          const cIdx = tree.nodes[nid].choices!.length + 1;
          const newChoice = {
            id: `branch_${cIdx}`,
            text: isR ? 'Flag is true' : 'Response option...',
            requiredFlag: isR ? '' : undefined,
            nextNodeId: ''
          };

          if (isR && tree.nodes[nid].choices!.length > 0) {
            const lastChoice = tree.nodes[nid].choices![tree.nodes[nid].choices!.length - 1];
            if (lastChoice && lastChoice.requiredFlag === undefined && lastChoice.notFlag === undefined) {
              tree.nodes[nid].choices!.splice(tree.nodes[nid].choices!.length - 1, 0, newChoice);
            } else {
              tree.nodes[nid].choices!.push(newChoice);
            }
          } else {
            tree.nodes[nid].choices!.push(newChoice);
          }

          RouterNodeBinder.enforceRouterFallbackLast(tree, nid);
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Delete
    container.querySelectorAll('.btn-del-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices) {
          tree.nodes[nid].choices!.splice(cIdx, 1);
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Text
    container.querySelectorAll('.choice-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].text = target.value;
          onUpdate();
        }
      });
    });

    // Choices Condition Flag
    container.querySelectorAll('.cond-choice-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const val = target.value;
          const opSel = container.querySelector(`.cond-choice-op[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            choice.notFlag = val;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = val;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
          }
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.cond-choice-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((sel as HTMLElement).dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const nameInput = container.querySelector(`.cond-choice-name[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          const flag = nameInput?.value || '';
          const op = target.value;
          if (op === 'false') {
            choice.notFlag = flag;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = flag;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = 'Else (Fallback)';
          }
          if (tree.nodes[nid].isRouterNode) {
            RouterNodeBinder.enforceRouterFallbackLast(tree, nid);
          }
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Voiceover
    container.querySelectorAll('.choice-voice-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.choice-voice-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);

        if (file && tree.nodes[nid]?.choices?.[cIdx]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = relPath;
          const urlInput = container.querySelector(`.choice-voice-url[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    // Drag & Drop Re-ordering for Rules and Choices
    let draggedChoiceNid: string | null = null;
    let draggedChoiceIdx: number | null = null;

    container.querySelectorAll('.router-branch-card, .choice-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const cidx = parseInt(el.dataset.cidx || '-1');
        if (nid && cidx >= 0) {
          draggedChoiceNid = nid;
          draggedChoiceIdx = cidx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${cidx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
        el.style.opacity = '1';
        container.querySelectorAll('.router-branch-card, .choice-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedChoiceNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #c084fc';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetCIdx = parseInt(el.dataset.cidx || '-1');

        if (draggedChoiceNid && draggedChoiceNid === targetNid && draggedChoiceIdx !== null && targetCIdx >= 0 && draggedChoiceIdx !== targetCIdx) {
          const choices = tree.nodes[targetNid]?.choices;
          if (choices) {
            const [moved] = choices.splice(draggedChoiceIdx, 1);
            choices.splice(targetCIdx, 0, moved);
            RouterNodeBinder.enforceRouterFallbackLast(tree, targetNid);
            onReRender();
            onUpdate();
          }
        }
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
      });
    });
  }
}
