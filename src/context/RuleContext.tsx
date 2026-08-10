import { createContext } from 'react';
import { type Rule, type RuleSet } from '@quotentiroler/guido-types';

export interface RuleContextProps {
  // Current ruleset operations
  currentRuleSet: RuleSet;
  currentRules: Rule[];
  saveRules: () => void;
  handleAddOrEditRule: (newRule: Rule, index?: number, callback?: () => void) => void;
  handleDeleteRule: (index: number) => void;
  handleDeleteRules: () => void;
  mergeRules: (newRules: Rule[]) => void;
  // RuleSet operations
  handleAddRuleSet: (ruleSet: RuleSet) => void;
  handleDeleteRuleSet: (index: number) => void;
  handleUpdateRuleSet: (index: number, ruleSet: Partial<RuleSet>) => void;
}

export const RuleContext = createContext<RuleContextProps | undefined>(undefined);