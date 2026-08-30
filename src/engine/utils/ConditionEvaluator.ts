export interface ConditionData {
  requiredFlag?: string;
  notFlag?: string;
}

export interface ConditionEvaluationResult {
  valid: boolean;
  reqPass: boolean;
  notPass: boolean;
}

export class ConditionEvaluator {
  /**
   * Evaluates flag conditions (requiredFlag and notFlag) against a flag-getter callback.
   * Returns a detailed result object with individual condition pass/fail flags and overall validity.
   */
  public static evaluate(
    condition: ConditionData,
    flagGetter?: (flagName: string) => boolean
  ): ConditionEvaluationResult {
    let reqPass = true;
    let notPass = true;

    if (condition.requiredFlag && flagGetter) {
      reqPass = Boolean(flagGetter(condition.requiredFlag));
    }
    if (condition.notFlag && flagGetter) {
      const hasNot = Boolean(flagGetter(condition.notFlag));
      if (hasNot) {
        notPass = false;
      }
    }

    const valid = reqPass && notPass;
    return { valid, reqPass, notPass };
  }

  /**
   * Convenience helper returning a boolean indicating if the condition is fully met.
   */
  public static isMet(
    condition: ConditionData,
    flagGetter?: (flagName: string) => boolean
  ): boolean {
    return ConditionEvaluator.evaluate(condition, flagGetter).valid;
  }
}
