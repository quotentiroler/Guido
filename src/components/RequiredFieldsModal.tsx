import React, { useState } from "react";
import Button from "./shared/Button";
import Portal from "./shared/Portal";
import { useRuleContext } from "@/hooks/useRuleContext";
import { RuleState, Rule } from "@guido/types";
import { useTemplateContext } from "@/hooks/useTemplateContext";

interface RequiredFieldsModalProps {
  handleClose: () => void;
  fieldNames: string[];
}

const RequiredFieldsModal: React.FC<RequiredFieldsModalProps> = ({
  handleClose,
  fieldNames,
}) => {
  const { handleAddOrEditRule } = useRuleContext();
  const { ruleSets, selectedRuleSetIndex } = useTemplateContext();
  
  // Get the current rules from the selected ruleset (memoized to prevent dependency issues)
  const rules = React.useMemo(
    () => ruleSets[selectedRuleSetIndex]?.rules ?? [],
    [ruleSets, selectedRuleSetIndex]
  );
  
  const [fieldStates, setFieldStates] = useState<{ [key: string]: { state: RuleState | "None"; not: boolean; value?: string } }>({});

  const initialFieldStates = React.useMemo(() => {
    const noConditionRules = rules.filter(rule => !rule.conditions || rule.conditions.length === 0);
    const states: { [key: string]: { state: RuleState | "None"; not: boolean; value?: string } } = {};

    fieldNames.forEach(fieldName => {
      const target = noConditionRules.flatMap(rule => rule.targets).find(target => target.name === fieldName);
      if (target) {
        states[fieldName] = { state: target.state, not: target.not ?? false, value: target.value };
      } else {
        states[fieldName] = { state: "None", not: false };
      }
    });

    return states;
  }, [rules, fieldNames]);

  // Initialize state from memoized value
  React.useEffect(() => {
    setFieldStates(initialFieldStates);
  }, [initialFieldStates]);

  const handleCheckboxChange = (fieldName: string) => {
    setFieldStates(prevState => ({
      ...prevState,
      [fieldName]: {
        ...prevState[fieldName],
        not: !prevState[fieldName].not,
      },
    }));
  };

  const handleStateChange = (fieldName: string, state: RuleState | "None") => {
    setFieldStates(prevState => ({
      ...prevState,
      [fieldName]: {
        ...prevState[fieldName],
        state,
      },
    }));
  };

  const handleValueChange = (fieldName: string, value: string) => {
    setFieldStates(prevState => ({
      ...prevState,
      [fieldName]: {
        ...prevState[fieldName],
        value,
      },
    }));
  };

  const handleSaveRule = () => {
    const updatedTargets = Object.entries(fieldStates)
      .filter(([, { state }]) => state !== "None")
      .map(([name, { state, not, value }]) => ({
        name,
        state: state as RuleState,
        not,
        value: (state === RuleState.SetToValue || state === RuleState.Contains) ? value : undefined,
      }));

    const noConditionRuleIndex = rules.findIndex(rule => !rule.conditions || rule.conditions.length === 0);
    const newTargets: Rule = {
      conditions: [],
      targets: updatedTargets,
    };
    
    handleAddOrEditRule(newTargets, noConditionRuleIndex);
    handleClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-surface-0 p-6 rounded-lg shadow-lg w-full max-w-3xl h-3/4 flex flex-col mx-4">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Required Fields</h2>
        <p className="mb-4 text-gray-700 "> Set state other than "None" to make a field required</p>
        <div className="flex-grow overflow-y-auto mb-4">
          <table className="w-full">
            <thead>
              <tr className="text-text-primary">
                <th className="text-left">Field Name</th>
                <th className="text-left pr-4">Not</th>
                <th className="text-left">State</th>
                <th className="text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {fieldNames.map((fieldName, index) => (
                <tr key={index} className="text-text-primary">
                  <td><label htmlFor={`required-not-${index}`}>{fieldName}</label></td>
                  <td>
                    <input
                      id={`required-not-${index}`}
                      name={`required-not-${index}`}
                      type="checkbox"
                      checked={fieldStates[fieldName]?.not || false}
                      onChange={() => handleCheckboxChange(fieldName)}
                    />
                  </td>
                  <td>
                    <select
                      id={`required-state-${index}`}
                      name={`required-state-${index}`}
                      aria-label={`State for ${fieldName}`}
                      value={fieldStates[fieldName]?.state || "None"}
                      onChange={(e) => handleStateChange(fieldName, e.target.value as RuleState | "None")}
                      className="bg-surface-0 border  rounded text-text-primary"
                    >
                      <option value="None">None</option>
                      <option value={RuleState.Set}>Set</option>
                      <option value={RuleState.SetToValue}>Set to Value</option>
                      <option value={RuleState.Contains}>Contains</option>
                    </select>
                  </td>
                  <td>
                    {(fieldStates[fieldName]?.state === RuleState.SetToValue || fieldStates[fieldName]?.state === RuleState.Contains) && (
                      <input
                        id={`required-value-${index}`}
                        name={`required-value-${index}`}
                        aria-label={`Value for ${fieldName}`}
                        type="text"
                        value={fieldStates[fieldName]?.value || ""}
                        onChange={(e) => handleValueChange(fieldName, e.target.value)}
                        className="border rounded p-1 bg-surface-0  text-text-primary"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 justify-end mt-4">
          <Button
            onClick={handleClose}
            type="primary-text"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveRule}
            type="primary"
          >
            Save Rule
          </Button>
        </div>
        </div>
      </div>
    </Portal>
  );
}

export default RequiredFieldsModal;