import { DialogTree, DialogNode, ProjectData } from '../../../../engine/types';
import { NodeViewsTemplate } from '../templates/NodeViews.template';
import { NodeBinderParams } from './binders/NodeBinderTypes';
import { CommonNodeBinder } from './binders/CommonNodeBinder';
import { SpeechNodeBinder } from './binders/SpeechNodeBinder';
import { RouterNodeBinder } from './binders/RouterNodeBinder';
import { DirectiveNodeBinder } from './binders/DirectiveNodeBinder';
import { ActionNodeBinder } from './binders/ActionNodeBinder';
import { EventListenerNodeBinder } from './binders/EventListenerNodeBinder';

export class NodeViewFactory {
  public static renderConditionPicker(opts: {
    nodeId: string;
    choiceIdx?: number;
    requiredFlag?: string;
    notFlag?: string;
    allowFallback?: boolean;
  }): string {
    return NodeViewsTemplate.renderConditionPicker(opts);
  }

  public static renderNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    return NodeViewsTemplate.renderNodeCard(params);
  }

  public static attachNodeEvents(params: {
    container: HTMLElement;
    tree: DialogTree;
    project: ProjectData | null;
    onReRender: () => void;
    onUpdate: () => void;
  }): void {
    CommonNodeBinder.bind(params);
    SpeechNodeBinder.bind(params);
    RouterNodeBinder.bind(params);
    DirectiveNodeBinder.bind(params);
    ActionNodeBinder.bind(params);
    EventListenerNodeBinder.bind(params);
  }
}
