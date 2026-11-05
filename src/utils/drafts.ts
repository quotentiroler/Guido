import { RuleState, type Field, type Rule, type RuleDomain } from "@quotentiroler/guido-types";

export const createEmptyField = (): Field => ({
  name: "",
  value: "",
  info: "",
  example: "",
  range: "",
  checked: false,
});

export const createEmptyRuleDomain = (): RuleDomain => ({ name: "", state: RuleState.Set, not: false });

export const createEmptyRule = (): Rule => ({
  conditions: [],
  targets: [createEmptyRuleDomain()],
});
