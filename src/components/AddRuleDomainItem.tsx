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
}

const RuleDomainItem: React.FC<AddRuleDomainItemProps> = ({
  item,
  index,
  onChange,
  onRemove,
}) => {
  const handleChange = (field: keyof RuleDomain, value: string | boolean) => {
    const updatedItem = { ...item, [field]: value };
    onChange(index, updatedItem);
  };

  const { fields } = useTemplateContext();
  const fieldNames = fields.map((field) => field.name);
  const parentPaths = generateParentPaths(fieldNames);

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
        </select>
      </div>
      {(item.state === RuleState.SetToValue || item.state === RuleState.Contains) && (
        <label className="flex mb-2" htmlFor={`rule-domain-value-${index}`}>
          <span className="text-text-secondary mr-2">Value:</span>
          <input
            id={`rule-domain-value-${index}`}
            name={`rule-domain-value-${index}`}
            type="text"
            value={item.value || ""}
            onChange={(e) => handleChange("value", e.target.value)}
            className="block w-full border rounded-default shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-surface-0 text-text-primary"
          />
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