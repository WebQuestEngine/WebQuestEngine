import { describe, it, expect } from 'vitest';
import { ConditionEvaluator } from '../../../src/engine/utils/ConditionEvaluator';

describe('ConditionEvaluator', () => {
  it('passes when requiredFlag is set to true', () => {
    const flags: Record<string, boolean> = { chest_unlocked: true };
    const getter = (f: string) => Boolean(flags[f]);

    const result = ConditionEvaluator.evaluate({ requiredFlag: 'chest_unlocked' }, getter);
    expect(result.valid).toBe(true);
    expect(result.reqPass).toBe(true);
    expect(result.notPass).toBe(true);
    expect(ConditionEvaluator.isMet({ requiredFlag: 'chest_unlocked' }, getter)).toBe(true);
  });

  it('fails when requiredFlag is false or missing', () => {
    const flags: Record<string, boolean> = { chest_unlocked: false };
    const getter = (f: string) => Boolean(flags[f]);

    const result = ConditionEvaluator.evaluate({ requiredFlag: 'chest_unlocked' }, getter);
    expect(result.valid).toBe(false);
    expect(result.reqPass).toBe(false);

    const missingResult = ConditionEvaluator.evaluate({ requiredFlag: 'has_crystal' }, getter);
    expect(missingResult.valid).toBe(false);
    expect(missingResult.reqPass).toBe(false);
  });

  it('passes when notFlag is false or missing', () => {
    const flags: Record<string, boolean> = { spoke_to_guard: false };
    const getter = (f: string) => Boolean(flags[f]);

    const result = ConditionEvaluator.evaluate({ notFlag: 'spoke_to_guard' }, getter);
    expect(result.valid).toBe(true);
    expect(result.notPass).toBe(true);
  });

  it('fails when notFlag is true', () => {
    const flags: Record<string, boolean> = { spoke_to_guard: true };
    const getter = (f: string) => Boolean(flags[f]);

    const result = ConditionEvaluator.evaluate({ notFlag: 'spoke_to_guard' }, getter);
    expect(result.valid).toBe(false);
    expect(result.notPass).toBe(false);
  });

  it('evaluates compound conditions correctly', () => {
    const flags: Record<string, boolean> = { has_key: true, door_opened: false };
    const getter = (f: string) => Boolean(flags[f]);

    // required true AND notFlag false => valid
    expect(ConditionEvaluator.isMet({ requiredFlag: 'has_key', notFlag: 'door_opened' }, getter)).toBe(true);

    // required true AND notFlag true => invalid
    flags.door_opened = true;
    expect(ConditionEvaluator.isMet({ requiredFlag: 'has_key', notFlag: 'door_opened' }, getter)).toBe(false);

    // required false AND notFlag false => invalid
    flags.has_key = false;
    flags.door_opened = false;
    expect(ConditionEvaluator.isMet({ requiredFlag: 'has_key', notFlag: 'door_opened' }, getter)).toBe(false);
  });

  it('handles empty condition and undefined flagGetter safely', () => {
    expect(ConditionEvaluator.isMet({})).toBe(true);
    expect(ConditionEvaluator.isMet({ requiredFlag: 'foo' }, undefined)).toBe(true);
  });
});
