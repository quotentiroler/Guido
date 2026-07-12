import React from "react";
import { generateParentPaths } from "@guido/core";
import Button from "./shared/Button";
import { RuleDomain, RuleState } from "@guido/types";
import { useTemplateContext } from "@/hooks/useTemplateContext";

interface AddRuleDomainItemProps {
  item: RuleDomain;
  index: number;
  onChange: (index: number, updatedItem: RuleDomain) => void;
  onRemove: (index: number) => void;
  /** Whether this domain is a rule condition or a target. Numeric comparison
   * predicates are condition-only, so they are hidden for targets. */
  role?: 'condition' | 'target';
}

const RuleDomainItem: React.FC<AddRuleDomainItemProps> = ({
  item,
  index,
  onChange,
  onRemove,
  role = 'condition',
}) => {
  const handleChange = (field: keyof RuleDomain, value: string | boolean) => {
    const updatedItem = { ...item, [field]: value };
    onChange(index, updatedItem);
  };

  const { fields } = useTemplateContext();
  const fieldNames = fields.map((field) => field.name);
  const parentPaths = generateParentPaths(fieldNames);

  const isComparison =
    item.state === RuleState.GreaterThan ||
    item.state === RuleState.LessThan ||
    item.state === RuleState.GreaterOrEqual ||
    item.state === RuleState.LessOrEqual;
  const valuePlaceholder =
    item.state === RuleState.Contains ? 'a single item, e.g. "pci"'
    : isComparison ? 'a number, e.g. 1024'
    : 'the exact value';
  const valueHint =
    item.state === RuleState.Contains ? 'One item to match: an array element, or the exact string value. Not a substring or a list.'
    : isComparison ? 'Compared numerically against the field value.'
    : undefined;

  return (
    <div className="mb-4 p-4 bg-surface-0 rounded-default shadow-md">
      <label className="block mb-3" htmlFor={`rule-domain-name-${index}`}>
        <span className="text-text-secondary">Name:</span>
        <select
          id={`rule-domain-name-${index}`}
          name={`rule-domain-name-${index}`}
          value={item.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="block w-full border rounded-default shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-surface-0 text-text-primary"
        >
          <option value="">Select a field</option>
          {parentPaths.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center mb-2">
        <label htmlFor={`rule-domain-not-${index}`} className="text-text-secondary">Not:</label>
        <input
          id={`rule-domain-not-${index}`}
          name={`rule-domain-not-${index}`}
          type="checkbox"
          checked={item.not || false}
          onChange={(e) => handleChange("not", e.target.checked)}
          className="ml-2 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <label htmlFor={`rule-domain-state-${index}`} className="text-text-secondary mr-2 ml-2">State:</label>
        <select
          id={`rule-domain-state-${index}`}
          name={`rule-domain-state-${index}`}
          value={item.state}
          onChange={(e) => handleChange("state", e.target.value as RuleState)}
          className="block border rounded-default shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-surface-0 text-text-primary"
        >
          <option value={RuleState.Set}>Set</option>
          <option value={RuleState.SetToValue}>Set to Value</option>
          <option value={RuleState.Contains}>Contains</option>
          {role !== 'target' && (
            <>
              <option value={RuleState.GreaterThan}>Greater Than (&gt;)</option>
              <option value={RuleState.LessThan}>Less Than (&lt;)</option>
              <option value={RuleState.GreaterOrEqual}>Greater or Equal (&ge;)</option>
              <option value={RuleState.LessOrEqual}>Less or Equal (&le;)</option>
            </>
          )}
        </select>
      </div>
      {item.state !== RuleState.Set && (
        <label className="block mb-2" htmlFor={`rule-domain-value-${index}`}>
          <div className="flex items-center">
            <span className="text-text-secondary mr-2">Value:</span>
            <input
              id={`rule-domain-value-${index}`}
              name={`rule-domain-value-${index}`}
              type={isComparison ? "number" : "text"}
              value={item.value || ""}
              placeholder={valuePlaceholder}
              onChange={(e) => handleChange("value", e.target.value)}
              className="block w-full border rounded-default shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-surface-0 text-text-primary"
            />
          </div>
          {valueHint && (
            <span className="block text-xs text-text-secondary mt-1">{valueHint}</span>
          )}
        </label>
      )}
      <div className="flex justify-end mt-4">
        <Button
          onClick={() => onRemove(index)}
          size="small"
          type="error-text"
        >
          Remove
        </Button>
      </div>
    </div>
  );
};

export default RuleDomainItem;