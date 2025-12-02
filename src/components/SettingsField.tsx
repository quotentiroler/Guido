import React, { useState, useMemo, useRef, useCallback } from "react";
import Tooltip from "./shared/ToolTip";
import TooltipContent from "./shared/TooltipContent";
import AddFieldModal from "./AddFieldModal";
import { translateRule, validateValue, translateRangeToHumanReadable } from "@guido/core";
import IconWithTooltip from "./shared/FancyIcon";
import { useAlert } from "@/hooks/useAlert";
import { Field, FieldValue, Rule } from "@guido/types";
import { fieldValueToString, isFieldValueEmpty } from "@guido/core";

interface SettingsFieldProps {
  field: Field;
  onChange: (name: string, value: FieldValue, checked: boolean) => void;
  onDelete: (name: string) => void;
  onAddArrayEntry: (field: Field) => void;
  disabledReason?: string;
  isExpertMode: boolean;
  isArrayField?: boolean;
  rules: Rule[];
  rulesAffectingField: Rule[];
  nestingLevel?: number;
}

const SettingsField: React.FC<SettingsFieldProps> = ({
  field,
  onChange,
  onDelete,
  onAddArrayEntry,
  disabledReason,
  isExpertMode,
  isArrayField,
  rulesAffectingField,
  nestingLevel = 0,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editField, setEditField] = useState(field);
  const [showInvalidTooltip, setShowInvalidTooltip] = useState(false);
  const invalidTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm } = useAlert();

  const isValid = validateValue(field.value, field.range);
  // Show "checked but empty" warning when field is enabled but has no value (and isn't already invalid)
  const isCheckedButEmpty = field.checked && isFieldValueEmpty(field.value) && isValid;

  const handleInputMouseEnter = useCallback(() => {
    if (!isValid && field.checked) {
      invalidTooltipTimer.current = setTimeout(() => {
        setShowInvalidTooltip(true);
      }, 800);
    }
  }, [isValid, field.checked]);

  const handleInputMouseLeave = useCallback(() => {
    if (invalidTooltipTimer.current) {
      clearTimeout(invalidTooltipTimer.current);
      invalidTooltipTimer.current = null;
    }
    setShowInvalidTooltip(false);
  }, []);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(field.name, field.value, e.target.checked);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(field.name, e.target.value, field.checked!);
  };

  const handleDeleteClick = () => {
    if (!isExpertMode) {
      confirm("Are you sure you want to delete this field?", () =>
        onDelete(field.name)
      );
    } else {
      onDelete(field.name);
    }
  };

  const handleEditClick = () => {
    setEditField(field);
    setIsModalOpen(true);
  };

  const addArrayEntry = () => {
    onAddArrayEntry(field);
  };

  const displayValue = fieldValueToString(field.value);

  // Generate invalid tooltip message
  const invalidTooltipText = useMemo(() => {
    if (isValid || !field.checked) return '';
    return `Invalid value: "${fieldValueToString(field.value)}"\nExpected: ${translateRangeToHumanReadable(field.range)}`;
  }, [isValid, field.checked, field.value, field.range]);

  // Memoize parent paths computation
  const parentPaths = useMemo(() => {
    const parts = field.name.split(".");
    const paths = [];
    for (let i = 1; i < parts.length; i++) {
      paths.push(parts.slice(0, i).join("."));
    }
    return paths;
  }, [field.name]);

  // Memoize rules text computation - use pre-computed affecting rules from props
  const rulesText = useMemo(() => rulesAffectingField
    .map((rule) => {
      if (!rule.conditions || rule.conditions.length === 0) {
        const target = rule.targets.find(
          (target: { name: string }) =>
            target.name === field.name || parentPaths.includes(target.name)
        );
        if (target) {
          return translateRule({ ...rule, conditions: [] }, target.name);
        }
      } else if (
        rule.targets.some(
          (target: { name: string }) => target.name === field.name
        )
      ) {
        return translateRule(rule, field.name);
      } else {
        return translateRule(rule);
      }
    })
    .join("\n"), [rulesAffectingField, field.name, parentPaths]);

  // Extract just the last part of the field name for mobile display
  const shortName = useMemo(() => {
    const parts = field.name.split('.');
    return parts[parts.length - 1];
  }, [field.name]);

  // Calculate the accumulated indentation to compensate for on mobile
  // Each nesting level adds margin, we need to pull the card back
  const mobileNegativeMargin = useMemo(() => {
    // Level 0: no container, no indent
    // Level 1: inside accent bar with pl-3 (0.75rem)
    // Level 2+: adds ml-2 (0.5rem) per additional level
    if (nestingLevel === 0) return 0;
    const baseIndent = 0.75; // rem - from pl-3 on accent bar (applies at level 1+)
    const additionalIndent = Math.max(0, nestingLevel - 1) * 0.5; // ml-2 per level beyond first
    return baseIndent + additionalIndent;
  }, [nestingLevel]);

  return (
    <>
      {/* Mobile Layout - Card style - compensates for hierarchy indentation */}
      <div 
        className="sm:hidden mb-3 p-3 rounded-lg bg-surface-2/50 border border-border relative"
        style={{
          marginLeft: `-${mobileNegativeMargin}rem`,
          width: `calc(100% + ${mobileNegativeMargin}rem)`,
        }}
      >
        {/* Row 1: Checkbox + Field name + Action icons */}
        <div className="flex items-start gap-2 mb-2">
          <input
            type="checkbox"
            checked={field.checked ?? false}
            onChange={handleCheckboxChange}
            className="mt-1 min-w-4 h-4 w-4 shrink-0"
            disabled={!!disabledReason}
            aria-label={`Enable ${field.name}`}
          />
          <Tooltip text={disabledReason ?? ""}>
            <span className="text-sm font-medium break-all flex-1" title={field.name}>
              {shortName}
            </span>
          </Tooltip>
          {/* Compact action icons */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={field.link || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={field.link ? "cursor-pointer" : ""}
            >
              <IconWithTooltip
                text={`Info: ${field.info || "No info given"}`}
                icon={<span className="text-sm">ℹ️</span>}
              />
            </a>
            {field.range && (
              <IconWithTooltip
                text={`Accepted values: ${translateRangeToHumanReadable(field.range)}`}
                icon={<span className={`text-sm ${!isValid ? "bg-red-500 rounded px-0.5" : ""}`}>🔍</span>}
              />
            )}
            <IconWithTooltip
              text="Delete"
              icon={<button type="button" className="text-sm" onClick={handleDeleteClick}>🗑️</button>}
            />
            {isExpertMode && (
              <IconWithTooltip
                text="Edit"
                icon={<button type="button" className="text-sm" onClick={handleEditClick}>✏️</button>}
              />
            )}
          </div>
        </div>
        {/* Row 2: Input field */}
        <div className="relative">
          <input
            type="text"
            value={displayValue}
            onChange={handleValueChange}
            onMouseEnter={handleInputMouseEnter}
            onMouseLeave={handleInputMouseLeave}
            disabled={!field.checked}
            placeholder={field.example || "Enter value..."}
            aria-label={`Value for ${field.name}`}
            className={`w-full text-sm py-1.5 px-2 rounded ${
              !field.checked ? "text-text-disabled bg-surface-1" : "text-text-primary bg-surface-0"
            } ${
              !isValid && field.checked 
                ? "border-2 border-field-error" 
                : isCheckedButEmpty 
                  ? "border-2 border-field-warning" 
                  : "border border-field-border"
            }`}
          />
          {showInvalidTooltip && invalidTooltipText && (
            <TooltipContent text={invalidTooltipText} />
          )}
        </div>
        {/* Optional: Show full path in small text if different from shortName */}
        {field.name !== shortName && (
          <div className="mt-1 text-[10px] text-text-tertiary truncate" title={field.name}>
            {field.name}
          </div>
        )}
      </div>

      {/* Desktop Layout - Original horizontal style */}
      <div className="hidden sm:flex flex-row items-center mb-2.5">
        <label className="flex items-center mr-2.5">
          <input
            type="checkbox"
            checked={field.checked ?? false}
            onChange={handleCheckboxChange}
            className="mr-2 min-w-4 h-4 w-4"
            disabled={!!disabledReason}
          />
          <Tooltip text={disabledReason ?? ""}>
            <span className="whitespace-nowrap">{field.name}</span>
          </Tooltip>
        </label>
        <div className="flex flex-row w-full">
          <div className="relative flex-grow ml-2">
            <input
              type="text"
              value={displayValue}
              onChange={handleValueChange}
              onMouseEnter={handleInputMouseEnter}
              onMouseLeave={handleInputMouseLeave}
              disabled={!field.checked}
              aria-label={`Value for ${field.name}`}
              className={`w-full rounded-default ${
                !field.checked ? "text-text-disabled bg-surface-1" : "text-text-primary bg-surface-0"
              } ${
                !isValid && field.checked 
                  ? "border-2 border-field-error" 
                  : isCheckedButEmpty 
                    ? "border-2 border-field-warning" 
                    : "border border-field-border"
              }`}
            />
            {showInvalidTooltip && invalidTooltipText && (
              <TooltipContent text={invalidTooltipText} />
            )}
          </div>
          <div className="flex ml-2 flex-nowrap">
            <a
              href={field.link || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={field.link ? "cursor-pointer" : ""}
            >
              <IconWithTooltip
                text={`Info: ${field.info || "No info given"}`}
                icon={<span className="info-icon ml-2">ℹ️</span>}
              />
            </a>
            {field.example && (
              <IconWithTooltip
                text={`Example: ${field.example || "No example given"}`}
                icon={<span className="example-icon ml-2">📄</span>}
              />
            )}
            {field.range && (
              <IconWithTooltip
                text={`Accepted values: ${translateRangeToHumanReadable(field.range)}`}
                icon={<span className="range-icon ml-2">🔍</span>}
                className={!isValid ? "bg-red-500 rounded" : ""}
              />
            )}
            {rulesText && (
              <IconWithTooltip
                text={`Rules affecting this field: ${
                  rulesText ? "\n" + rulesText : "None"
                }`}
                icon={<span className="rules-icon ml-2">⚙️</span>}
              />
            )}
            <IconWithTooltip
              text="Click to delete this field"
              icon={<button type="button" className="ml-2">🗑️</button>}
              onClick={handleDeleteClick}
            />
            {isExpertMode && (
              <IconWithTooltip
                text="Click to edit this field"
                icon={<button type="button" className="ml-2">✏️</button>}
                onClick={handleEditClick}
              />
            )}
            {isArrayField && (
              <IconWithTooltip
                text={`Click to add another entry to ${field.name
                  .split(".")
                  .slice(0, -1)
                  .join(".")}`}
                icon={<button type="button" className="ml-2">➕</button>}
                onClick={addArrayEntry}
              />
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddFieldModal
          edit={true}
          newField={editField}
          setNewField={setEditField}
          handleClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

SettingsField.displayName = 'SettingsField';

export default SettingsField;
