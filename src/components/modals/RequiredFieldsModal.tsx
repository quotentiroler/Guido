import React, { useState } from "react";
import Button from "@/components/shared/Button";
import ModalShell from "./ModalShell";
import { useRuleContext } from "@/hooks/useRuleContext";
import { RuleState, type Rule } from "@quotentiroler/guido-types";
import { useTemplateContext } from "@/hooks/useTemplateContext";

type StateOption = RuleState | "None";

interface FieldState {
  state: StateOption;
  not: boolean;
  value?: string;
}

const STATE_OPTIONS: { value: StateOption; label: string }[] = [
  { value: "None", label: "None" },
  { value: RuleState.Set, label: "Set" },
  { value: RuleState.SetToValue, label: "Set to Value" },
  { value: RuleState.Contains, label: "Contains" },
];

const STATE_BY_VALUE = new Map<string, StateOption>(STATE_OPTIONS.map(({ value }) => [value, value]));

const toStateOption = (value: string): StateOption => STATE_BY_VALUE.get(value) ?? "None";

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
  
  const rules = React.useMemo(
    () => ruleSets[selectedRuleSetIndex]?.rules ?? [],
    [ruleSets, selectedRuleSetIndex]
  );
  
  const initialFieldStates = React.useMemo(() => {
    const noConditionRules = rules.filter(rule => !rule.conditions || rule.conditions.length === 0);
    const states: Record<string, FieldState> = {};

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

  const [fieldStates, setFieldStates] = useState(initialFieldStates);

  // Reset editable state when the derived initial value changes, adjusting during
  // render instead of in an effect (React's recommended pattern for prop-derived state).
  const [prevInitialFieldStates, setPrevInitialFieldStates] = useState(initialFieldStates);
  if (prevInitialFieldStates !== initialFieldStates) {
    setPrevInitialFieldStates(initialFieldStates);
    setFieldStates(initialFieldStates);
  }

  const updateFieldState = (fieldName: string, patch: (current: FieldState) => Partial<FieldState>) => {
    setFieldStates(prevState => ({
      ...prevState,
      [fieldName]: { ...prevState[fieldName], ...patch(prevState[fieldName]) },
    }));
  };

  const handleSaveRule = () => {
    const updatedTargets = Object.entries(fieldStates).flatMap(([name, { state, not, value }]) =>
      state === "None"
        ? []
        : [{ name, state, not, value: (state === RuleState.SetToValue || state === RuleState.Contains) ? value : undefined }]
    );

    const noConditionRuleIndex = rules.findIndex(rule => !rule.conditions || rule.conditions.length === 0);
    const newTargets: Rule = {
      conditions: [],
      targets: updatedTargets,
    };
    
    handleAddOrEditRule(newTargets, noConditionRuleIndex);
    handleClose();
  };

  return (
    <ModalShell panelClassName="bg-surface-0 p-6 rounded-lg shadow-lg w-full max-w-3xl h-3/4 flex flex-col mx-4">
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
                    onChange={() => updateFieldState(fieldName, (current) => ({ not: !current.not }))}
                  />
                </td>
                <td>
                  <select
                    id={`required-state-${index}`}
                    name={`required-state-${index}`}
                    aria-label={`State for ${fieldName}`}
                    value={fieldStates[fieldName]?.state || "None"}
                    onChange={(e) => updateFieldState(fieldName, () => ({ state: toStateOption(e.target.value) }))}
                    className="bg-surface-0 border  rounded text-text-primary"
                  >
                    {STATE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
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
                      onChange={(e) => updateFieldState(fieldName, () => ({ value: e.target.value }))}
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
    </ModalShell>
  );
}

export default RequiredFieldsModal;