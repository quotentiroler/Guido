import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Field, FieldValue } from "@guido/types";
import { resolveRuleSetRules } from "@guido/core";
import { saveSettingsFields } from "@/utils/settingsUtils";
import { FieldContext } from "@/context/FieldContext";
import { applyRules, isFieldRequired } from "@/utils/applyRules";
import { useAlert } from "@/hooks/useAlert";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { TriggerAction } from "@/context/HistoryContext";

interface FieldProviderProps {
  children: React.ReactNode;
}

export const FieldProvider: React.FC<FieldProviderProps> = ({ children }) => {
  const { alert, confirm } = useAlert();
  const [disabledReasons, setDisabledReasons] = useState<{
    [key: string]: string;
  }>({});
  const { template, ruleSets, selectedRuleSetIndex, fields, setFields } = useTemplateContext();
  
  // Get the current rules from the selected ruleset, including inherited rules via 'extends'
  const rules = useMemo(
    () => {
      try {
        // Construct template with current ruleSets to ensure we use the latest rules
        // (ruleSets state may be updated before template state syncs)
        const currentTemplate = { ...template, ruleSets };
        // Use resolveRuleSetRules to include inherited rules from parent rulesets
        return resolveRuleSetRules(currentTemplate, selectedRuleSetIndex);
      } catch (e) {
        // Fall back to just the ruleset's own rules if inheritance resolution fails
        console.warn('Failed to resolve ruleset inheritance:', e);
        return ruleSets[selectedRuleSetIndex]?.rules ?? [];
      }
    },
    [template, ruleSets, selectedRuleSetIndex]
  );
  const [fieldsToReindex, setFieldsToReindex] = useState<string | null>(null); // Track fields needing re-indexing

  // Apply rules on initial load and when rules/fields change from template loading
  useEffect(() => {
    if (fields.length > 0 && rules.length > 0) {
      const { updatedFields, disabledReasons: newDisabledReasons } = applyRules(
        fields,
        rules
      );
      // Only update if there are actual changes to avoid infinite loops
      const hasFieldChanges = updatedFields.some((f, i) => 
        f.checked !== fields[i]?.checked || f.value !== fields[i]?.value
      );
      const hasDisabledChanges = Object.keys(newDisabledReasons).length > 0 || 
        Object.keys(disabledReasons).length > 0;
      
      if (hasFieldChanges) {
        setFields(updatedFields);
      }
      if (hasDisabledChanges && JSON.stringify(newDisabledReasons) !== JSON.stringify(disabledReasons)) {
        setDisabledReasons(newDisabledReasons);
      }
    }
  // Run when rules change (template loaded or ruleset selected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, selectedRuleSetIndex]);

  const saveFields = useCallback(() => {
    void saveSettingsFields(fields);
  }, [fields]);

  const handleUpdateFields = useCallback((newFields: Field[]) => {
    setFields(newFields);
  }, [setFields]);

  const handleFieldChange = useCallback((name: string, value: FieldValue, checked: boolean, aiTool?: string) => {
    // Find the original field to detect what changed
    const originalField = fields.find(f => f.name === name);
    
    // Determine what triggered this change
    let trigger: TriggerAction;
    if (aiTool) {
      // AI-initiated change
      trigger = {
        type: 'ai_change',
        fieldName: name,
        oldValue: originalField?.value,
        newValue: value,
        aiTool,
      };
    } else if (originalField) {
      if (originalField.checked !== checked) {
        // Checkbox toggled
        trigger = {
          type: checked ? 'field_check' : 'field_uncheck',
          fieldName: name,
          oldValue: originalField.checked,
          newValue: checked,
        };
      } else {
        // Value changed
        trigger = {
          type: 'field_value_change',
          fieldName: name,
          oldValue: originalField.value,
          newValue: value,
        };
      }
    } else {
      trigger = { type: 'rules_changed' };
    }
    
    const updatedFields = fields.map((field) =>
      field.name === name ? { ...field, value, checked } : field
    );
    const { updatedFields: newFields, disabledReasons: newDisabledReasons } = applyRules(
      updatedFields,
      rules,
      trigger
    );
    handleUpdateFields(newFields);
    setDisabledReasons(newDisabledReasons);
  }, [fields, rules, handleUpdateFields]);

  // Silent version that doesn't create history entries (for undo operations)
  const handleFieldChangeSilent = useCallback((name: string, value: FieldValue, checked: boolean) => {
    const updatedFields = fields.map((field) =>
      field.name === name ? { ...field, value, checked } : field
    );
    // Apply rules without trigger to avoid creating history entry
    const { updatedFields: newFields, disabledReasons: newDisabledReasons } = applyRules(
      updatedFields,
      rules
    );
    handleUpdateFields(newFields);
    setDisabledReasons(newDisabledReasons);
  }, [fields, rules, handleUpdateFields]);

  const handleUpdateField = useCallback((updatedField: Field) => {
    const updatedFields = fields.map((field) =>
      field.name === updatedField.name ? updatedField : field
    );
    handleUpdateFields(updatedFields);
  }, [fields, handleUpdateFields]);

  const handleDeleteField = useCallback((name: string) => {
    if (isFieldRequired(name, rules)) {
      alert(`Field "${name}" cannot be deleted because it is required`);
      return;
    }

    setFields((prevFields) =>
      prevFields.filter((field) => field.name !== name)
    );
    setFieldsToReindex(name); // Mark the field's array for re-indexing
  }, [rules, alert, setFields]);

  const handleDeleteFields = useCallback(() => {
    confirm("Are you sure you want to delete all fields?", () => {
      setFields([]);
      window.location.reload();
    });
  }, [confirm, setFields]);

  const isValidField = useCallback((field: Field): boolean => {
    return field.name.length > 0;
  }, []);

  const handleAddField = useCallback((newField: Field, callback?: () => void) => {
    const fieldExists = fields.some((field) => field.name === newField.name);

    if (!isValidField(newField)) {
      alert("Field name cannot be empty.");
      return;
    }
    if (fieldExists) {
      alert("A field with this name already exists.");
      return;
    }

    const updatedFields = [...fields, newField];
    setFields(updatedFields);
    setFieldsToReindex(newField.name); // Mark the new field's array for re-indexing
    if (callback) callback();
  }, [fields, isValidField, alert, setFields]);

  // Re-index fields when `fieldsToReindex` changes
  useEffect(() => {
    if (!fieldsToReindex) return;

    const baseName = fieldsToReindex.split(".").slice(0, -1).join(".");

    setFields((prevFields) => {
      const updatedFields = prevFields.map((field) => {
        if (field.name.startsWith(`${baseName}.`)) {
          const parts = field.name.split(".");
          const index = parseInt(parts[parts.length - 1], 10);

          if (!isNaN(index)) {
            const siblings = prevFields.filter((f) =>
              f.name.startsWith(`${baseName}.`)
            );
            const newIndex = siblings.indexOf(field) + 1;
            parts[parts.length - 1] = newIndex.toString();
            return { ...field, name: parts.join(".") };
          }
        }
        return field;
      });

      return updatedFields;
    });

    // Use a microtask to reset the reindex flag after the current render cycle
    queueMicrotask(() => setFieldsToReindex(null));
  }, [fieldsToReindex, setFields]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    saveFields,
    handleFieldChange,
    handleFieldChangeSilent,
    handleUpdateField,
    handleDeleteField,
    handleDeleteFields,
    handleAddField,
    handleUpdateFields,
    disabledReasons,
    setDisabledReasons,
  }), [
    saveFields,
    handleFieldChange,
    handleFieldChangeSilent,
    handleUpdateField,
    handleDeleteField,
    handleDeleteFields,
    handleAddField,
    handleUpdateFields,
    disabledReasons,
  ]);

  return (
    <FieldContext.Provider value={contextValue}>
      {children}
    </FieldContext.Provider>
  );
};
