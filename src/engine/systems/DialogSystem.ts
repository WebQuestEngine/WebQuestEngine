import { DialogTree, DialogNode, DialogChoice } from '../types';
import { EventBus } from '../core/EventBus';
import { AudioSystem } from './AudioSystem';

export class DialogSystem {
  private static instance: DialogSystem;
  private currentTree: DialogTree | null = null;
  private currentNode: DialogNode | null = null;
  private dialogs: Map<string, DialogTree> = new Map();
  private isExecuting = false;

  public constructor() {}

  public static getInstance(): DialogSystem {
    if (!DialogSystem.instance) {
      DialogSystem.instance = new DialogSystem();
    }
    return DialogSystem.instance;
  }

  public static setInstance(inst: DialogSystem | null): void {
    DialogSystem.instance = inst as any;
  }

  private autoAdvanceChoiceId: string | null = null;
  private activeFlagGetter: ((flag: string) => boolean) | null = null;
  private playerName: string = 'Player';

  public setPlayerName(name: string): void {
    this.playerName = name;
  }

  public clear(): void {
    AudioSystem.getInstance().stopVoice();
    this.dialogs.clear();
    this.currentTree = null;
    this.currentNode = null;
    this.autoAdvanceChoiceId = null;
    this.activeFlagGetter = null;
    this.isExecuting = false;
  }

  public registerDialog(tree: DialogTree): void {
    this.dialogs.set(tree.id, tree);
  }

  public startDialog(dialogId: string, getFlagState?: (flag: string) => boolean, startNodeId?: string): boolean {
    const tree = this.dialogs.get(dialogId);
    if (!tree) {
      console.warn(`[DialogSystem] ⚠️ Dialog ID '${dialogId}' not found.`);
      return false;
    }

    if (getFlagState) {
      this.activeFlagGetter = getFlagState;
    }

    this.currentTree = tree;
    const initialNodeId = (startNodeId && tree.nodes[startNodeId]) ? startNodeId : tree.startNodeId;
    this.currentNode = tree.nodes[initialNodeId] || Object.values(tree.nodes)[0];
    this.autoAdvanceChoiceId = null;
    this.isExecuting = true;

    console.group(`%c[DialogSystem] 💬 Started Sequence: "%c${tree.id}%c" (Node: "${initialNodeId}")`, 'color: #8b5cf6; font-weight: bold;', 'color: #38bdf8; font-weight: bold;', 'color: #8b5cf6; font-weight: bold;');

    EventBus.getInstance().emit('dialog:start', { tree, node: this.currentNode });
    this.presentNode(getFlagState || this.activeFlagGetter || undefined);
    return true;
  }

  public presentNode(getFlagState?: (flag: string) => boolean): void {
    const flagGetter = getFlagState || this.activeFlagGetter || undefined;

    if (!this.currentNode || !this.currentTree) {
      console.log('%c[DialogSystem] ⏹️ No current node or tree, ending dialog.', 'color: #8b5cf6;');
      this.endDialog();
      return;
    }

    console.log(
      `%c[DialogSystem] 📍 Presenting Node: "%c${this.currentNode.id}%c" | Speaker: "%c${this.currentNode.speaker || 'Narrator'}%c" | Type: %c${this.currentNode.isRouterNode ? '🔀 Router Node' : '💬 Speech Node'}%c`,
      'color: #94a3b8;',
      'color: #38bdf8; font-weight: bold;',
      'color: #94a3b8;',
      'color: #f59e0b; font-weight: bold;',
      'color: #94a3b8;',
      this.currentNode.isRouterNode ? 'color: #a855f7; font-weight: bold;' : 'color: #10b981; font-weight: bold;',
      'color: #94a3b8;'
    );

    // 1. Evaluate per-node flag testing conditions (optional)
    if (this.currentNode.requiredFlag && flagGetter) {
      const hasFlag = flagGetter(this.currentNode.requiredFlag);
      console.log(
        `  🔍 Node requiredFlag check: "%c${this.currentNode.requiredFlag}%c" -> %c${hasFlag ? 'PASS (True)' : 'FAIL (False)'}%c`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;',
        hasFlag ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;',
        'color: inherit;'
      );
      if (!hasFlag) {
        if (this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
          console.log(`  ↪️ Node skipped due to requiredFlag, advancing to fallback nextNodeId: "${this.currentNode.nextNodeId}"`);
          this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
          this.presentNode(flagGetter);
          return;
        }
        console.log('  ⏹️ Node skipped due to requiredFlag and no fallback nextNodeId, ending dialog.');
        this.endDialog();
        return;
      }
    }

    if (this.currentNode.notFlag && flagGetter) {
      const hasFlag = flagGetter(this.currentNode.notFlag);
      console.log(
        `  🔍 Node notFlag check: "%c${this.currentNode.notFlag}%c" -> %c${!hasFlag ? 'PASS (False)' : 'FAIL (True - blocked)'}%c`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;',
        !hasFlag ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;',
        'color: inherit;'
      );
      if (hasFlag) {
        if (this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
          console.log(`  ↪️ Node skipped due to notFlag, advancing to fallback nextNodeId: "${this.currentNode.nextNodeId}"`);
          this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
          this.presentNode(flagGetter);
          return;
        }
        console.log('  ⏹️ Node skipped due to notFlag and no fallback nextNodeId, ending dialog.');
        this.endDialog();
        return;
      }
    }

    // 2. Event Listener Node (Trigger anchor: immediately passes control to next connected node)
    if (this.currentNode.nodeType === 'event_listener') {
      if (this.currentNode.setFlag) EventBus.getInstance().emit('flag:set', this.currentNode.setFlag);
      if (this.currentNode.setFlags) this.currentNode.setFlags.forEach(f => EventBus.getInstance().emit('flag:set', f));
      if (this.currentNode.clearFlag) EventBus.getInstance().emit('flag:clear', this.currentNode.clearFlag);
      if (this.currentNode.clearFlags) this.currentNode.clearFlags.forEach(f => EventBus.getInstance().emit('flag:clear', f));
      if (this.currentNode.giveItem) EventBus.getInstance().emit('inventory:give', this.currentNode.giveItem);

      const nextId = this.currentNode.nextNodeId;
      if (nextId && this.currentTree.nodes[nextId]) {
        console.log(`%c[DialogSystem] ⚡ Event Node triggered, advancing to "${nextId}"`, 'color: #f59e0b;');
        this.currentNode = this.currentTree.nodes[nextId];
        this.presentNode(flagGetter);
      } else {
        this.endDialog();
      }
      return;
    }

    // 3. Action Node (Video, Screen FX, Camera, Audio, Delay, Scene Change)
    if (this.currentNode.nodeType === 'action') {
      const node = this.currentNode;
      if (node.setFlag) EventBus.getInstance().emit('flag:set', node.setFlag);
      if (node.setFlags) node.setFlags.forEach(f => EventBus.getInstance().emit('flag:set', f));
      if (node.clearFlag) EventBus.getInstance().emit('flag:clear', node.clearFlag);
      if (node.clearFlags) node.clearFlags.forEach(f => EventBus.getInstance().emit('flag:clear', f));
      if (node.giveItem) EventBus.getInstance().emit('inventory:give', node.giveItem);
      if (node.giveItems) node.giveItems.forEach(it => EventBus.getInstance().emit('inventory:give', it));
      if (node.takeItems) node.takeItems.forEach(it => EventBus.getInstance().emit('inventory:take', it));

      console.log(`%c[DialogSystem] ✨ Executing Action Node "${node.id}" (Category: ${node.actionCategory || 'screen_effect'})`, 'color: #10b981; font-weight: bold;');

      EventBus.getInstance().emit('dialog:action', {
        node,
        onComplete: () => {
          if (node.nextNodeId && this.currentTree?.nodes[node.nextNodeId]) {
            this.currentNode = this.currentTree.nodes[node.nextNodeId];
            this.presentNode(flagGetter);
          } else {
            this.endDialog();
          }
        }
      });
      return;
    }

    // 4. Router Node Processing (Invisible logic router: selects first matching condition & auto-starts conversation)
    if (this.currentNode.isRouterNode || this.currentNode.nodeType === 'router') {
      if (this.currentNode.setFlag) {
        console.log(`  🚩 Router Node setting flag: "${this.currentNode.setFlag}"`);
        EventBus.getInstance().emit('flag:set', this.currentNode.setFlag);
      }
      if (this.currentNode.giveItem) {
        console.log(`  🎒 Router Node giving item: "${this.currentNode.giveItem}"`);
        EventBus.getInstance().emit('inventory:give', this.currentNode.giveItem);
      }

      console.group(`%c[Dialog Router] 🔀 Evaluating routes for Router Node "${this.currentNode.id}" (${this.currentNode.choices?.length || 0} routes)`, 'color: #a855f7; font-weight: bold;');

      let matchingTargetNodeId: string | null = null;
      if (this.currentNode.choices && this.currentNode.choices.length > 0) {
        for (let idx = 0; idx < this.currentNode.choices.length; idx++) {
          const choice = this.currentNode.choices[idx];
          let valid = true;
          let reqPass = true;
          let notPass = true;

          if (choice.requiredFlag && flagGetter) {
            reqPass = flagGetter(choice.requiredFlag);
            if (!reqPass) valid = false;
          }
          if (choice.notFlag && flagGetter) {
            const hasNot = flagGetter(choice.notFlag);
            if (hasNot) {
              notPass = false;
              valid = false;
            }
          }

          console.log(
            `  ↳ Route #${idx + 1} -> Target Node: "%c${choice.nextNodeId || '(None)'}%c" | reqFlag: "%c${choice.requiredFlag || 'None'}%c" (${choice.requiredFlag ? (reqPass ? '✅ PASS' : '❌ FAIL') : 'N/A'}) | notFlag: "%c${choice.notFlag || 'None'}%c" (${choice.notFlag ? (notPass ? '✅ PASS' : '❌ FAIL') : 'N/A'}) -> %c${valid ? 'MATCHED' : 'SKIPPED'}%c`,
            'color: #38bdf8; font-weight: bold;',
            'color: inherit;',
            'color: #f59e0b;',
            'color: inherit;',
            'color: #f59e0b;',
            'color: inherit;',
            valid ? 'color: #10b981; font-weight: bold;' : 'color: #94a3b8;',
            'color: inherit;'
          );

          if (valid) {
            matchingTargetNodeId = choice.nextNodeId;
            console.log(`  🎯 Route #${idx + 1} chosen! Target Node: "${matchingTargetNodeId}"`);
            break;
          }
        }
      }

      if (!matchingTargetNodeId && this.currentNode.nextNodeId) {
        matchingTargetNodeId = this.currentNode.nextNodeId;
        console.log(`  ↩️ No route condition matched. Using default fallback nextNodeId: "${matchingTargetNodeId}"`);
      }

      console.groupEnd();

      if (matchingTargetNodeId && this.currentTree.nodes[matchingTargetNodeId]) {
        this.currentNode = this.currentTree.nodes[matchingTargetNodeId];
        this.presentNode(flagGetter);
        return;
      }

      console.warn(`[Dialog Router] ⚠️ Router Node "${this.currentNode.id}" could not find a valid matching target node (target: "${matchingTargetNodeId}"). Ending dialog.`);
      this.endDialog();
      return;
    }

    // 3. Process Multi-Flag and Item Outcomes for this Beat
    if (this.currentNode.setFlag) {
      EventBus.getInstance().emit('flag:set', this.currentNode.setFlag);
    }
    if (this.currentNode.setFlags && Array.isArray(this.currentNode.setFlags)) {
      this.currentNode.setFlags.forEach(f => EventBus.getInstance().emit('flag:set', f));
    }
    if (this.currentNode.clearFlag) {
      EventBus.getInstance().emit('flag:clear', this.currentNode.clearFlag);
    }
    if (this.currentNode.clearFlags && Array.isArray(this.currentNode.clearFlags)) {
      this.currentNode.clearFlags.forEach(f => EventBus.getInstance().emit('flag:clear', f));
    }
    if (this.currentNode.giveItem) {
      EventBus.getInstance().emit('inventory:give', this.currentNode.giveItem);
    }
    if (this.currentNode.giveItems && Array.isArray(this.currentNode.giveItems)) {
      this.currentNode.giveItems.forEach(it => EventBus.getInstance().emit('inventory:give', it));
    }
    if (this.currentNode.takeItems && Array.isArray(this.currentNode.takeItems)) {
      this.currentNode.takeItems.forEach(it => EventBus.getInstance().emit('inventory:take', it));
    }

    // 4. Dispatch Stage Directives & Speaker Choreography
    if (this.currentNode.speakerAnimation || this.currentNode.speakerGesture) {
      EventBus.getInstance().emit('dialog:speaker_anim', {
        speaker: this.currentNode.speaker,
        animation: this.currentNode.speakerAnimation,
        gesture: this.currentNode.speakerGesture
      });
    }

    if (this.currentNode.directives && this.currentNode.directives.length > 0) {
      console.log(`  🎭 Executing ${this.currentNode.directives.length} Stage Directives for Beat "${this.currentNode.id}"`);
      this.currentNode.directives.forEach((directive) => {
        const executeDirective = () => {
          EventBus.getInstance().emit('dialog:directive', directive);

          if (directive.type === 'sfx' && directive.sfxUrl) {
            AudioSystem.getInstance().playSFX(directive.sfxUrl);
          } else if (directive.type === 'give_item' && directive.itemId) {
            EventBus.getInstance().emit('inventory:give', directive.itemId);
          } else if (directive.type === 'take_item' && directive.itemId) {
            EventBus.getInstance().emit('inventory:take', directive.itemId);
          } else if (directive.type === 'custom_event' && directive.eventName) {
            EventBus.getInstance().emit(directive.eventName, directive.eventPayload);
          }
        };

        if (directive.delaySeconds && directive.delaySeconds > 0) {
          setTimeout(executeDirective, directive.delaySeconds * 1000);
        } else {
          executeDirective();
        }
      });
    }

    // Filter available choices based on required & not flags
    let availableChoices: DialogChoice[] = [];
    if (this.currentNode.choices && this.currentNode.choices.length > 0) {
      console.log(`  💬 Evaluating ${this.currentNode.choices.length} response choices:`);
      availableChoices = this.currentNode.choices.filter((choice, idx) => {
        let valid = true;
        let reqPass = true;
        let notPass = true;

        if (choice.requiredFlag && flagGetter) {
          reqPass = flagGetter(choice.requiredFlag);
          if (!reqPass) valid = false;
        }
        if (choice.notFlag && flagGetter) {
          const hasNot = flagGetter(choice.notFlag);
          if (hasNot) {
            notPass = false;
            valid = false;
          }
        }

        console.log(
          `    [Option #${idx + 1}] "%c${choice.text}%c" -> reqFlag: "${choice.requiredFlag || 'None'}" (${choice.requiredFlag ? (reqPass ? 'PASS' : 'FAIL') : 'N/A'}), notFlag: "${choice.notFlag || 'None'}" (${choice.notFlag ? (notPass ? 'PASS' : 'FAIL') : 'N/A'}) -> %c${valid ? 'AVAILABLE' : 'FILTERED OUT'}%c`,
          'color: #38bdf8;',
          'color: inherit;',
          valid ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;',
          'color: inherit;'
        );

        return valid;
      });
    }

    if (this.currentNode.voiceAudioUrl) {
      AudioSystem.getInstance().playVoice(this.currentNode.voiceAudioUrl);
    } else {
      AudioSystem.getInstance().stopVoice();
    }

    // Determine interactivity: if choices exist and isChoiceInteractive is explicitly false, auto-play next response node
    const isInteractive = this.currentNode.isChoiceInteractive !== false;

    if (availableChoices.length > 0 && !isInteractive) {
      this.autoAdvanceChoiceId = availableChoices[0].id;
      console.log(`  ⏩ Non-interactive choice auto-advancing to choice ID: "${availableChoices[0].id}"`);
      EventBus.getInstance().emit('dialog:node', {
        speaker: this.currentNode.speaker,
        text: this.currentNode.text,
        portraitUrl: this.currentNode.portraitUrl,
        speakerAnimation: this.currentNode.speakerAnimation,
        directives: this.currentNode.directives,
        choices: [],
        hasNext: true
      });
    } else {
      this.autoAdvanceChoiceId = null;
      EventBus.getInstance().emit('dialog:node', {
        speaker: this.currentNode.speaker,
        text: this.currentNode.text,
        portraitUrl: this.currentNode.portraitUrl,
        speakerAnimation: this.currentNode.speakerAnimation,
        directives: this.currentNode.directives,
        choices: availableChoices,
        hasNext: Boolean(this.currentNode.nextNodeId)
      });
    }
  }

  private pendingNextNodeId: string | null = null;

  public selectChoice(choiceId: string, getFlagState?: (flag: string) => boolean): void {
    const flagGetter = getFlagState || this.activeFlagGetter || undefined;
    if (!this.currentNode || !this.currentTree) return;

    const choice = this.currentNode.choices?.find(c => c.id === choiceId);
    if (!choice) {
      console.warn(`[DialogSystem] ⚠️ Selected choice ID "${choiceId}" not found in current node.`);
      return;
    }

    console.log(
      `%c[DialogSystem] 👤 Player Selected Choice: "%c${choice.text}%c" (Choice ID: "${choiceId}") -> Target Node: "%c${choice.nextNodeId || '(None)'}%c"`,
      'color: #38bdf8;',
      'color: #f59e0b; font-weight: bold;',
      'color: #38bdf8;',
      'color: #10b981; font-weight: bold;',
      'color: #38bdf8;'
    );

    if (choice.setFlag) {
      EventBus.getInstance().emit('flag:set', choice.setFlag);
    }
    if (choice.setFlags && Array.isArray(choice.setFlags)) {
      choice.setFlags.forEach(f => EventBus.getInstance().emit('flag:set', f));
    }
    if (choice.clearFlag) {
      EventBus.getInstance().emit('flag:clear', choice.clearFlag);
    }
    if (choice.clearFlags && Array.isArray(choice.clearFlags)) {
      choice.clearFlags.forEach(f => EventBus.getInstance().emit('flag:clear', f));
    }
    if (choice.giveItem) {
      EventBus.getInstance().emit('inventory:give', choice.giveItem);
    }
    if (choice.giveItems && Array.isArray(choice.giveItems)) {
      choice.giveItems.forEach(it => EventBus.getInstance().emit('inventory:give', it));
    }
    if (choice.takeItems && Array.isArray(choice.takeItems)) {
      choice.takeItems.forEach(it => EventBus.getInstance().emit('inventory:take', it));
    }

    if (choice.voiceAudioUrl) {
      AudioSystem.getInstance().playVoice(choice.voiceAudioUrl);
    } else {
      AudioSystem.getInstance().stopVoice();
    }

    this.pendingNextNodeId = choice.nextNodeId;
    this.autoAdvanceChoiceId = null;

    // Speak the player's selected response choice
    EventBus.getInstance().emit('dialog:node', {
      speaker: this.playerName || 'Player',
      text: choice.text,
      choices: [],
      hasNext: true,
      isResponseSpeech: true
    });
  }

  public advanceNextNode(getFlagState?: (flag: string) => boolean): void {
    const flagGetter = getFlagState || this.activeFlagGetter || undefined;

    if (!this.currentTree) {
      this.endDialog();
      return;
    }

    if (this.pendingNextNodeId) {
      const nextId = this.pendingNextNodeId;
      this.pendingNextNodeId = null;
      if (this.currentTree.nodes[nextId]) {
        console.log(`%c[DialogSystem] ⏩ Advancing to pending choice target node: "${nextId}"`, 'color: #38bdf8;');
        this.currentNode = this.currentTree.nodes[nextId];
        this.presentNode(flagGetter);
        return;
      }
    }

    if (this.autoAdvanceChoiceId) {
      const choiceId = this.autoAdvanceChoiceId;
      this.autoAdvanceChoiceId = null;
      console.log(`%c[DialogSystem] ⏩ Executing auto-advance choice: "${choiceId}"`, 'color: #38bdf8;');
      this.selectChoice(choiceId, flagGetter);
      return;
    }

    if (this.currentNode && this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
      console.log(`%c[DialogSystem] ⏩ Advancing to nextNodeId: "${this.currentNode.nextNodeId}"`, 'color: #38bdf8;');
      this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
      this.presentNode(flagGetter);
    } else if (this.currentNode && this.currentNode.choices && this.currentNode.choices.length > 0) {
      console.log(`%c[DialogSystem] ⏩ Auto-selecting first choice: "${this.currentNode.choices[0].id}"`, 'color: #38bdf8;');
      this.selectChoice(this.currentNode.choices[0].id, flagGetter);
    } else {
      console.log('%c[DialogSystem] ⏹️ No more nodes in dialog sequence.', 'color: #8b5cf6;');
      this.endDialog();
    }
  }

  public endDialog(): void {
    AudioSystem.getInstance().stopVoice();
    this.isExecuting = false;
    this.currentTree = null;
    this.currentNode = null;
    this.autoAdvanceChoiceId = null;
    this.activeFlagGetter = null;
    console.log('%c[DialogSystem] ⏹️ Dialog Ended.', 'color: #8b5cf6; font-weight: bold;');
    try {
      console.groupEnd();
    } catch (_) {}
    EventBus.getInstance().emit('dialog:end');
  }

  public isActive(): boolean {
    return this.isExecuting;
  }
}
