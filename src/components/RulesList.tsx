import React, { useState, useEffect } from "react";
import Button from "./shared/Button";
import RuleItem from "./RuleItem";
import { validateRules, type ValidationResult } from "@guido/core";
import { useRuleContext } from "@/hooks/useRuleContext";
import { useAppContext } from "@/hooks/useAppContext";

interface RulesListProps {
  onDeleteRule: (index: number) => void;
}

const RulesList: React.FC<RulesListProps> = ({ onDeleteRule }) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const { mergeRules, currentRules } = useRuleContext();
  const { isExpertMode } = useAppContext();

  const handleMerge = (indexes: number[]) => {
    const safeRulesForMerge = currentRules ?? [];
    const rulesToMerge = indexes.map(index => safeRulesForMerge[index - 1]).filter(rule => rule !== undefined);
    mergeRules(rulesToMerge);
  };

  useEffect(() => {
    const result = validateRules(currentRules ?? []);
    // This is a valid pattern - updating derived state when source changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValidationResult(result);
    // Only auto-hide success message when there are no errors AND no warnings
    if (result.isValid && (!result.warnings || result.warnings.length === 0)) {
      const timer = setTimeout(() => {
        setValidationResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentRules]);

  const safeRules = currentRules ?? [];

  return (
    <div className="mt-4">
      <div className="space-y-4">
        {/* Errors */}
        {safeRules.length > 0 && validationResult && validationResult.errors.length > 0 && (
          <div className="p-4 rounded-default shadow-md mb-4 bg-validation-error-bg">
            <p className="text-validation-error-text font-medium">Validation errors:</p>
            <ul className="list-disc ml-4 text-validation-error-text">
              {validationResult.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Warnings (merge suggestions) - only shown in expert mode */}
        {isExpertMode && safeRules.length > 0 && validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
          <div className="p-4 rounded-default shadow-md mb-4 bg-validation-warning-bg">
            <p className="text-validation-warning-text font-medium">Suggestions:</p>
            <ul className="list-disc ml-4 text-validation-warning-text">
              {validationResult.warnings.map((warning, index) => (
                <li key={index} className="flex items-center gap-2 flex-wrap">
                  <span>{warning}</span>
                  {warning.includes("can be merged") && (
                    <Button
                      onClick={() => {
                        const indexes = warning.match(/\d+/g)?.map(Number) || [];
                        handleMerge(indexes);
                      }}
                      type="secondary"
                      size="small"
                    >
                      Merge
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Success message - only shown in expert mode */}
        {isExpertMode && safeRules.length > 0 && validationResult && validationResult.isValid && (!validationResult.warnings || validationResult.warnings.length === 0) && (
          <div className="p-4 rounded-default shadow-md mb-4 bg-validation-success-bg">
            <p className="text-validation-success-text">All rules are valid!</p>
          </div>
        )}
        
        {safeRules.length === 0 && <p className="text-text-secondary">No rules defined.</p>}
        {safeRules.map((rule, index) => (
          <RuleItem
            key={index}
            rule={rule}
            index={index}
            onDeleteRule={onDeleteRule}
          />
        ))}
      </div>
    </div>
  );
};

export default RulesList;