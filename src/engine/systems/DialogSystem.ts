import { DialogTree, DialogNode, DialogChoice } from '../types';
import { EventBus } from '../core/EventBus';
import { AudioSystem } from './AudioSystem';

export class DialogSystem {
  private static instance: DialogSystem;
  private currentTree: DialogTree | null = null;
  private currentNode: DialogNode | null = null;
  private dialogs: Map<string, DialogTree> = new Map();
  private isExecuting = false;

  private constructor() {}

  public static getInstance(): DialogSystem {
    if (!DialogSystem.instance) {
      DialogSystem.instance = new DialogSystem();
    }
    return DialogSystem.instance;
  }

  private autoAdvanceChoiceId: string | null = null;

  public clear(): void {
    AudioSystem.getInstance().stopVoice();
    this.dialogs.clear();
    this.currentTree = null;
    this.currentNode = null;
    this.autoAdvanceChoiceId = null;
    this.isExecuting = false;
  }

  public registerDialog(tree: DialogTree): void {
    this.dialogs.set(tree.id, tree);
  }

  public startDialog(dialogId: string, getFlagState?: (flag: string) => boolean): boolean {
    const tree = this.dialogs.get(dialogId);
    if (!tree) {
      console.warn(`Dialog ID '${dialogId}' not found.`);
      return false;
    }

    this.currentTree = tree;
    this.currentNode = tree.nodes[tree.startNodeId];
    this.autoAdvanceChoiceId = null;
    this.isExecuting = true;

    EventBus.getInstance().emit('dialog:start', { tree, node: this.currentNode });
    this.presentNode(getFlagState);
    return true;
  }

  public presentNode(getFlagState?: (flag: string) => boolean): void {
    if (!this.currentNode) {
      this.endDialog();
      return;
    }

    // Process flag changes or item rewards attached to node
    if (this.currentNode.setFlag) {
      EventBus.getInstance().emit('flag:set', this.currentNode.setFlag);
    }
    if (this.currentNode.giveItem) {
      EventBus.getInstance().emit('inventory:give', this.currentNode.giveItem);
    }

    // Filter available choices based on required & not flags
    let availableChoices: DialogChoice[] = [];
    if (this.currentNode.choices) {
      availableChoices = this.currentNode.choices.filter(choice => {
        if (choice.requiredFlag && getFlagState && !getFlagState(choice.requiredFlag)) return false;
        if (choice.notFlag && getFlagState && getFlagState(choice.notFlag)) return false;
        return true;
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
      EventBus.getInstance().emit('dialog:node', {
        speaker: this.currentNode.speaker,
        text: this.currentNode.text,
        portraitUrl: this.currentNode.portraitUrl,
        choices: [],
        hasNext: true
      });
    } else {
      this.autoAdvanceChoiceId = null;
      EventBus.getInstance().emit('dialog:node', {
        speaker: this.currentNode.speaker,
        text: this.currentNode.text,
        portraitUrl: this.currentNode.portraitUrl,
        choices: availableChoices,
        hasNext: Boolean(this.currentNode.nextNodeId)
      });
    }
  }

  private pendingNextNodeId: string | null = null;

  public selectChoice(choiceId: string, getFlagState?: (flag: string) => boolean): void {
    if (!this.currentNode || !this.currentTree) return;

    const choice = this.currentNode.choices?.find(c => c.id === choiceId);
    if (!choice) return;

    if (choice.setFlag) {
      EventBus.getInstance().emit('flag:set', choice.setFlag);
    }
    if (choice.giveItem) {
      EventBus.getInstance().emit('inventory:give', choice.giveItem);
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
      speaker: 'Sir Ronald',
      text: choice.text,
      choices: [],
      hasNext: true,
      isResponseSpeech: true
    });
  }

  public advanceNextNode(getFlagState?: (flag: string) => boolean): void {
    if (!this.currentTree) {
      this.endDialog();
      return;
    }

    if (this.pendingNextNodeId) {
      const nextId = this.pendingNextNodeId;
      this.pendingNextNodeId = null;
      if (this.currentTree.nodes[nextId]) {
        this.currentNode = this.currentTree.nodes[nextId];
        this.presentNode(getFlagState);
        return;
      }
    }

    if (this.autoAdvanceChoiceId) {
      const choiceId = this.autoAdvanceChoiceId;
      this.autoAdvanceChoiceId = null;
      this.selectChoice(choiceId, getFlagState);
      return;
    }

    if (this.currentNode && this.currentNode.nextNodeId && this.currentTree.nodes[this.currentNode.nextNodeId]) {
      this.currentNode = this.currentTree.nodes[this.currentNode.nextNodeId];
      this.presentNode(getFlagState);
    } else if (this.currentNode && this.currentNode.choices && this.currentNode.choices.length > 0) {
      this.selectChoice(this.currentNode.choices[0].id, getFlagState);
    } else {
      this.endDialog();
    }
  }

  public endDialog(): void {
    AudioSystem.getInstance().stopVoice();
    this.isExecuting = false;
    this.currentTree = null;
    this.currentNode = null;
    this.autoAdvanceChoiceId = null;
    EventBus.getInstance().emit('dialog:end');
  }

  public isActive(): boolean {
    return this.isExecuting;
  }
}
