import {
  SkeletalVisualConfig,
  SkeletalRigData,
  SkeletalBoneData,
  SkeletalSlotData,
  SkeletalAttachmentData,
  SkeletalAnimationTrack,
  SkeletalKeyframe
} from '../types';

export class SkeletalImporter {
  /**
   * Detects the skeletal format from the parsed JSON object.
   */
  public static detectFormat(data: any): 'spine' | 'dragonbones' | 'native' | null {
    if (!data || typeof data !== 'object') return null;
    if (data.skeleton || (Array.isArray(data.bones) && data.animations)) {
      return 'spine';
    }
    if (Array.isArray(data.armature) || data.armature) {
      return 'dragonbones';
    }
    if (data.type === 'skeletal' && data.skeleton) {
      return 'native';
    }
    return null;
  }

  /**
   * Imports a Spine 2D JSON export into a unified SkeletalVisualConfig.
   */
  public static importSpineJson(json: any, textureUrl = ''): SkeletalVisualConfig {
    const rawBones = Array.isArray(json.bones) ? json.bones : [];
    const rawSlots = Array.isArray(json.slots) ? json.slots : [];
    const rawAnimations = json.animations || {};

    const bones: SkeletalBoneData[] = rawBones.map((b: any) => ({
      name: b.name || 'unnamed_bone',
      parent: b.parent,
      length: b.length || 0,
      x: b.x || 0,
      y: b.y || 0,
      rotation: b.rotation || 0,
      scaleX: b.scaleX !== undefined ? b.scaleX : 1,
      scaleY: b.scaleY !== undefined ? b.scaleY : 1
    }));

    const slots: SkeletalSlotData[] = rawSlots.map((s: any) => ({
      name: s.name,
      bone: s.bone,
      attachment: s.attachment,
      color: s.color
    }));

    // Parse attachments from skins (Spine supports skins array or skins object)
    const attachments: Record<string, Record<string, SkeletalAttachmentData>> = {};

    if (json.skins) {
      if (Array.isArray(json.skins)) {
        for (const skin of json.skins) {
          const skinName = skin.name || 'default';
          attachments[skinName] = {};
          const slotMap = skin.attachments || {};
          for (const [slotName, attachDict] of Object.entries(slotMap)) {
            if (attachDict && typeof attachDict === 'object') {
              for (const [attachName, att] of Object.entries(attachDict as any)) {
                attachments[skinName][slotName] = {
                  name: attachName,
                  type: (att as any).type || 'region',
                  x: (att as any).x || 0,
                  y: (att as any).y || 0,
                  scaleX: (att as any).scaleX ?? 1,
                  scaleY: (att as any).scaleY ?? 1,
                  rotation: (att as any).rotation || 0,
                  width: (att as any).width || 32,
                  height: (att as any).height || 32,
                  textureUrl
                };
              }
            }
          }
        }
      } else if (typeof json.skins === 'object') {
        for (const [skinName, slotMap] of Object.entries(json.skins)) {
          attachments[skinName] = {};
          if (slotMap && typeof slotMap === 'object') {
            for (const [slotName, attachDict] of Object.entries(slotMap as any)) {
              if (attachDict && typeof attachDict === 'object') {
                for (const [attachName, att] of Object.entries(attachDict as any)) {
                  attachments[skinName][slotName] = {
                    name: attachName,
                    type: (att as any).type || 'region',
                    x: (att as any).x || 0,
                    y: (att as any).y || 0,
                    scaleX: (att as any).scaleX ?? 1,
                    scaleY: (att as any).scaleY ?? 1,
                    rotation: (att as any).rotation || 0,
                    width: (att as any).width || 32,
                    height: (att as any).height || 32,
                    textureUrl
                  };
                }
              }
            }
          }
        }
      }
    }

    // Parse animation tracks
    const animations: Record<string, SkeletalAnimationTrack> = {};
    for (const [animName, animData] of Object.entries(rawAnimations)) {
      let maxDuration = 0;
      const boneTracks: Record<string, { rotate?: SkeletalKeyframe[]; translate?: SkeletalKeyframe[]; scale?: SkeletalKeyframe[] }> = {};

      const animBones = (animData as any)?.bones || {};
      for (const [boneName, timelines] of Object.entries(animBones)) {
        const t = timelines as any;
        const track: { rotate?: SkeletalKeyframe[]; translate?: SkeletalKeyframe[]; scale?: SkeletalKeyframe[] } = {};

        if (Array.isArray(t.rotate)) {
          track.rotate = t.rotate.map((k: any) => {
            const time = k.time || 0;
            if (time > maxDuration) maxDuration = time;
            return {
              time,
              rotation: k.value !== undefined ? k.value : (k.angle || 0)
            };
          });
        }

        if (Array.isArray(t.translate)) {
          track.translate = t.translate.map((k: any) => {
            const time = k.time || 0;
            if (time > maxDuration) maxDuration = time;
            return {
              time,
              x: k.x || 0,
              y: k.y || 0
            };
          });
        }

        if (Array.isArray(t.scale)) {
          track.scale = t.scale.map((k: any) => {
            const time = k.time || 0;
            if (time > maxDuration) maxDuration = time;
            return {
              time,
              scaleX: k.x !== undefined ? k.x : 1,
              scaleY: k.y !== undefined ? k.y : 1
            };
          });
        }

        boneTracks[boneName] = track;
      }

      animations[animName] = {
        duration: Math.max(maxDuration, 0.1),
        bones: boneTracks
      };
    }

    const defaultAnim = Object.keys(animations)[0] || 'idle';
    const firstSkin = Object.keys(attachments)[0] || 'default';

    return {
      type: 'skeletal',
      format: 'spine',
      textureUrl,
      skeleton: {
        bones,
        slots,
        attachments
      },
      animations,
      defaultAnimation: defaultAnim,
      skin: firstSkin
    };
  }

  /**
   * Imports a DragonBones JSON export into a unified SkeletalVisualConfig.
   */
  public static importDragonBonesJson(json: any, textureUrl = ''): SkeletalVisualConfig {
    const armatures = Array.isArray(json.armature) ? json.armature : (json.armature ? [json.armature] : []);
    const arm = armatures[0] || {};
    const rawBones = Array.isArray(arm.bone) ? arm.bone : [];
    const rawSlots = Array.isArray(arm.slot) ? arm.slot : [];
    const rawSkins = Array.isArray(arm.skin) ? arm.skin : [];
    const rawAnimations = Array.isArray(arm.animation) ? arm.animation : [];

    const bones: SkeletalBoneData[] = rawBones.map((b: any) => {
      const transform = b.transform || {};
      return {
        name: b.name || 'unnamed_bone',
        parent: b.parent,
        length: b.length || 0,
        x: transform.x || 0,
        y: transform.y || 0,
        rotation: transform.skX || transform.rotate || 0,
        scaleX: transform.scX !== undefined ? transform.scX : 1,
        scaleY: transform.scY !== undefined ? transform.scY : 1
      };
    });

    const slots: SkeletalSlotData[] = rawSlots.map((s: any) => ({
      name: s.name,
      bone: s.parent || '',
      color: s.color ? `#${s.color}` : undefined
    }));

    const attachments: Record<string, Record<string, SkeletalAttachmentData>> = {};
    for (const skin of rawSkins) {
      const skinName = skin.name || 'default';
      attachments[skinName] = {};
      const skinSlots = Array.isArray(skin.slot) ? skin.slot : [];
      for (const slot of skinSlots) {
        const slotName = slot.name;
        const displays = Array.isArray(slot.display) ? slot.display : [];
        const disp = displays[0] || {};
        const transform = disp.transform || {};
        attachments[skinName][slotName] = {
          name: disp.name || slotName,
          type: disp.type === 'mesh' ? 'mesh' : 'region',
          x: transform.x || 0,
          y: transform.y || 0,
          scaleX: transform.scX ?? 1,
          scaleY: transform.scY ?? 1,
          rotation: transform.skX ?? 0,
          width: 32,
          height: 32,
          textureUrl
        };
      }
    }

    const animations: Record<string, SkeletalAnimationTrack> = {};
    for (const anim of rawAnimations) {
      const animName = anim.name || 'anim';
      const duration = (anim.duration || 30) / (anim.frameRate || 30);
      const boneTracks: Record<string, { rotate?: SkeletalKeyframe[]; translate?: SkeletalKeyframe[]; scale?: SkeletalKeyframe[] }> = {};

      const animBones = Array.isArray(anim.bone) ? anim.bone : [];
      for (const b of animBones) {
        const boneName = b.name;
        const track: { rotate?: SkeletalKeyframe[]; translate?: SkeletalKeyframe[]; scale?: SkeletalKeyframe[] } = {};

        if (Array.isArray(b.translateFrame)) {
          track.translate = b.translateFrame.map((f: any, idx: number) => ({
            time: (idx / b.translateFrame.length) * duration,
            x: f.x || 0,
            y: f.y || 0
          }));
        }

        if (Array.isArray(b.rotateFrame)) {
          track.rotate = b.rotateFrame.map((f: any, idx: number) => ({
            time: (idx / b.rotateFrame.length) * duration,
            rotation: f.rotate || f.skX || 0
          }));
        }

        if (Array.isArray(b.scaleFrame)) {
          track.scale = b.scaleFrame.map((f: any, idx: number) => ({
            time: (idx / b.scaleFrame.length) * duration,
            scaleX: f.x !== undefined ? f.x : 1,
            scaleY: f.y !== undefined ? f.y : 1
          }));
        }

        boneTracks[boneName] = track;
      }

      animations[animName] = {
        duration,
        bones: boneTracks
      };
    }

    const defaultAnim = Object.keys(animations)[0] || 'idle';
    const firstSkin = Object.keys(attachments)[0] || 'default';

    return {
      type: 'skeletal',
      format: 'dragonbones',
      textureUrl,
      skeleton: {
        bones,
        slots,
        attachments
      },
      animations,
      defaultAnimation: defaultAnim,
      skin: firstSkin
    };
  }

  /**
   * Universal loader that detects format and imports automatically.
   */
  public static importFromContent(content: string | object, textureUrl = ''): SkeletalVisualConfig {
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    const format = this.detectFormat(data);
    if (format === 'spine') {
      return this.importSpineJson(data, textureUrl);
    }
    if (format === 'dragonbones') {
      return this.importDragonBonesJson(data, textureUrl);
    }
    if (format === 'native') {
      return data as SkeletalVisualConfig;
    }
    throw new Error('Unsupported skeletal format: Expected Spine 2D JSON or DragonBones JSON structure.');
  }
}
