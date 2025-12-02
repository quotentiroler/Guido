import React from "react";
import {
  saveSettingsRules,
} from "@/utils/settingsUtils";
import { RuleContext } from "@/context/RuleContext";
import { useAlert } from "@/hooks/useAlert";
import { Rule, RuleDomain, RuleSet } from "@guido/types";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { createDefaultRuleSet } from "@guido/core";

interface RuleProviderProps {
  children: React.ReactNode;
}

export const RuleProvider: React.FC<RuleProviderProps> = ({ children }) => {
  const { alert, confirm } = useAlert();
  const { ruleSets, setRuleSets, selectedRuleSetIndex, setSelectedRuleSetIndex } = useTemplateContext();

  // Get the currently selected ruleset (first one is default)
  const currentRuleSet = ruleSets[selectedRuleSetIndex] || ruleSets[0] || createDefaultRuleSet();
  const currentRules = currentRuleSet.rules;

  // Helper to update rules in the current ruleset
  const updateCurrentRules = (updater: (rules: Rule[]) => Rule[]) => {
    setRuleSets(prevRuleSets => {
      const newRuleSets = [...prevRuleSets];
      const idx = selectedRuleSetIndex;
      if (newRuleSets[idx]) {
        newRuleSets[idx] = {
          ...newRuleSets[idx],
          rules: updater(newRuleSets[idx].rules)
        };
      }
      return newRuleSets;
    });
  };

  const saveRules = () => {
    void saveSettingsRules(currentRules);
  };

  const isValidRule = (rule: Rule) => {
    return (
      rule.targets.length > 0 &&
      rule.targets.every((target) => target.name && target.state)
    );
  };

  const handleAddOrEditRule = (newRule: Rule, index?: number, callback?: () => void) => {
    if (!isValidRule(newRule)) {
      alert(
        "A rule must have at least one target with both name and state set."
      );
      return;
    }

    if (index !== undefined && index >= 0) {
      // Edit rule
      updateCurrentRules((prevRules) => {
        const updatedRules = [...prevRules];
        updatedRules[index] = newRule;
        return updatedRules;
      });
      if (callback) callback();
      return;
    }

    const ruleExists = currentRules.some((rule: Rule) =>
      JSON.stringify(rule) === JSON.stringify(newRule)
    );

    if (ruleExists) {
      alert('This rule already exists.');
      return;
    }

    updateCurrentRules((prevRules) => [...prevRules, newRule]);
    if (callback) callback();
  };

  const handleDeleteRule = (index: number) => {
    updateCurrentRules((rules) => rules.filter((_, i) => i !== index));
  };

  const handleDeleteRules = () => {
    confirm("Are you sure you want to delete all rules in this ruleset?", () => {
      updateCurrentRules(() => []);
    });
  };

  const mergeRules = (rulesToMerge: Rule[]) => {
    if (rulesToMerge.length < 1) {
      alert("Provide at least 2 valid indexes to merge rules.");
      return;
    }

    const conditionMap = new Map<string, RuleDomain>();
    const targetMap = new Map<string, RuleDomain>();

    rulesToMerge.forEach(rule => {
      rule.conditions?.forEach(condition => {
        const key = JSON.stringify({ name: condition.name, state: condition.state, not: condition.not });
        if (!conditionMap.has(key)) {
          conditionMap.set(key, condition);
        }
      });

      rule.targets.forEach(target => {
        const key = JSON.stringify({ name: target.name, state: target.state, not: target.not });
        if (!targetMap.has(key)) {
          targetMap.set(key, target);
        }
      });
    });

    const mergedConditions = Array.from(conditionMap.values());
    const mergedTargets = Array.from(targetMap.values());

    const mergedRule: Rule = {
      conditions: mergedConditions,
      targets: mergedTargets,
    };

    if (!isValidRule(mergedRule)) {
      alert(
        "A rule must have at least one target with both name and state set."
      );
      return;
    }

    updateCurrentRules((rules) => {
      const updatedRules = rules.filter((rule) => !rulesToMerge.includes(rule));
      updatedRules.push(mergedRule);
      return updatedRules;
    });
  };

  // RuleSet operations
  const handleAddRuleSet = (ruleSet: RuleSet) => {
    setRuleSets(prev => [...prev, ruleSet]);
  };

  const handleDeleteRuleSet = (index: number) => {
    if (ruleSets.length <= 1) {
      alert("Cannot delete the last ruleset. At least one ruleset is required.");
      return;
    }
    if (index === 0) {
      alert("Cannot delete the default ruleset (first one).");
      return;
    }
    confirm(`Are you sure you want to delete ruleset "${ruleSets[index]?.name}"?`, () => {
      setRuleSets(prev => prev.filter((_, i) => i !== index));
      // If we deleted the selected one, go back to default
      if (selectedRuleSetIndex >= index) {
        setSelectedRuleSetIndex(Math.max(0, selectedRuleSetIndex - 1));
      }
    });
  };

  const handleUpdateRuleSet = (index: number, updates: Partial<RuleSet>) => {
    setRuleSets(prev => {
      const newRuleSets = [...prev];
      if (newRuleSets[index]) {
        newRuleSets[index] = { ...newRuleSets[index], ...updates };
      }
      return newRuleSets;
    });
  };

  return (
    <RuleContext.Provider
      value={{
        currentRuleSet,
        currentRules,
        saveRules,
        handleAddOrEditRule,
        handleDeleteRules,
        handleDeleteRule,
        mergeRules,
        handleAddRuleSet,
        handleDeleteRuleSet,
        handleUpdateRuleSet,
      }}
    >
      {children}
    </RuleContext.Provider>
  );
};
