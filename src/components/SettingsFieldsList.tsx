import React, { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import localforage from "localforage";
import SettingsField from "./SettingsField";
import ToggleSwitch from "./shared/ToggleSwitch";
import { useFieldContext } from "@/hooks/useFieldContext";
import { useAppContext } from "@/hooks/useAppContext";
import { applyRules } from "@/utils/applyRules";
import { Field, Rule } from "@guido/types";
import { resolveRuleSetRules } from "@guido/core";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { TriggerAction } from "@/context/HistoryContext";

interface SettingsFieldsListProps {
  fields: Field[];
}

interface GroupedFields {
  [key: string]: {
    children: GroupedFields;
    fields: Field[];
  };
}

const isEmptyObject = (obj: object): boolean => {
  return Object.keys(obj).length === 0;
};

const EXPANDED_SECTIONS_KEY = 'expanded-sections';

const SettingsFieldsList: React.FC<SettingsFieldsListProps> = ({
  fields,
}) => {
  const { isExpertMode } = useAppContext();
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  // Track sections that have ever been expanded (for lazy mounting)
  const [mountedSections, setMountedSections] = useState<Set<string>>(new Set());

  // Load expanded sections from localforage on mount
  useEffect(() => {
    void localforage.getItem<{ [key: string]: boolean }>(EXPANDED_SECTIONS_KEY).then((stored) => {
      if (stored) {
        setExpandedSections(stored);
        setMountedSections(new Set(Object.keys(stored).filter(key => stored[key])));
      }
    });
  }, []);

  // Persist expanded sections to localforage
  useEffect(() => {
    void localforage.setItem(EXPANDED_SECTIONS_KEY, expandedSections);
  }, [expandedSections]);

  const [searchQuery, setSearchQuery] = useState("");
  const [hideIllegal, setHideIllegal] = useState(false);
  const {
    handleFieldChange,
    setDisabledReasons,
    handleDeleteField,
    disabledReasons,
    handleUpdateFields,
    handleAddField,
  } = useFieldContext();
  const { template, ruleSets, selectedRuleSetIndex, fields: allFields } = useTemplateContext();
  
  // Get the current rules from the selected ruleset, including inherited rules via 'extends'
  const rules = useMemo(
    () => {
      try {
        // Construct template with current ruleSets to ensure we use the latest rules
        // (ruleSets state may be updated before template state syncs)
        const currentTemplate = { ...template, ruleSets };
        return resolveRuleSetRules(currentTemplate, selectedRuleSetIndex);
      } catch (e) {
        console.warn('Failed to resolve ruleset inheritance:', e);
        return ruleSets[selectedRuleSetIndex]?.rules ?? [];
      }
    },
    [template, ruleSets, selectedRuleSetIndex]
  );
  
  const allFieldsChecked =
    fields.length > 0 &&
    fields.every((field) => field.checked || disabledReasons[field.name]);

  // Pre-compute affecting rules for all fields using an efficient reverse index
  const affectingRulesMap = useMemo(() => {
    // First pass: build a reverse index from field/path names to rules that reference them
    const rulesByFieldName = new Map<string, Set<Rule>>();
    
    (rules || []).forEach((rule) => {
      // Add rule to all targets
      rule.targets.forEach((target: { name: string }) => {
        if (!rulesByFieldName.has(target.name)) {
          rulesByFieldName.set(target.name, new Set());
        }
        rulesByFieldName.get(target.name)!.add(rule);
      });
      
      // Add rule to all conditions
      rule.conditions?.forEach((condition: { name: string }) => {
        if (!rulesByFieldName.has(condition.name)) {
          rulesByFieldName.set(condition.name, new Set());
        }
        rulesByFieldName.get(condition.name)!.add(rule);
      });
    });
    
    // Second pass: for each field, collect rules from direct match and parent paths
    const map = new Map<string, Rule[]>();
    
    fields.forEach((field) => {
      const affectingRulesSet = new Set<Rule>();
      
      // Check direct match
      const directRules = rulesByFieldName.get(field.name);
      if (directRules) {
        directRules.forEach(rule => affectingRulesSet.add(rule));
      }
      
      // Check parent paths (e.g., for "A.B.C", check "A" and "A.B")
      const parts = field.name.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join(".");
        const parentRules = rulesByFieldName.get(parentPath);
        if (parentRules) {
          parentRules.forEach(rule => affectingRulesSet.add(rule));
        }
      }
      
      map.set(field.name, Array.from(affectingRulesSet));
    });
    
    return map;
  }, [fields, rules]);

  // Callback to handle adding array entries (moved from SettingsField to avoid fields dependency)
  const handleAddArrayEntry = useCallback((field: Field) => {
    const baseName = field.name.split(".").slice(0, -1).join(".");
    const existingFields = allFields.filter((f) => f.name.startsWith(baseName + "."));
    const newIndex = existingFields.length + 1;
    const newFieldName = `${baseName}.${newIndex}`;
    const newField = {
      ...field,
      name: newFieldName,
      value: "",
      checked: false,
      info: "",
    };
    handleAddField(newField);
  }, [allFields, handleAddField]);

  // Note: applyRules is now only called by FieldProvider when fields/rules change
  // This avoids duplicate calls that were causing performance issues

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const newExpanded = !prev[key];
      // Mark section as mounted when first expanded (lazy mounting)
      if (newExpanded) {
        setMountedSections((prevMounted) => {
          if (prevMounted.has(key)) return prevMounted;
          const newSet = new Set(prevMounted);
          newSet.add(key);
          return newSet;
        });
      }
      return { ...prev, [key]: newExpanded };
    });
  }, []);

  // Memoize the grouping function
  const groupFieldsHierarchically = useCallback((fields: Field[]): GroupedFields => {
    const grouped: GroupedFields = {};

    fields.forEach((field) => {
      const parts = field.name.split(".");
      let currentLevel = grouped;

      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = {
            children: {},
            fields: [],
          };
        }

        if (index === parts.length - 1) {
          currentLevel[part].fields.push(field);
        } else {
          currentLevel = currentLevel[part].children;
        }
      });
    });

    return grouped;
  }, []);

  const renderGroupedFields = (
    groupedFields: GroupedFields,
    parentKey = "",
    isTopLevel = false,
    level = 0
  ) => {
    // Sort keys alphabetically, handling numeric keys correctly
    const sortedKeys = Object.keys(groupedFields).sort((a, b) => {
      const isANumeric = /^\d+$/.test(a);
      const isBNumeric = /^\d+$/.test(b);

      if (isANumeric && isBNumeric) {
        // Compare numeric keys as numbers
        return parseInt(a, 10) - parseInt(b, 10);
      } else if (isANumeric) {
        // Numeric keys come before non-numeric keys
        return -1;
      } else if (isBNumeric) {
        // Non-numeric keys come after numeric keys
        return 1;
      } else {
        // Compare non-numeric keys alphabetically
        return a.localeCompare(b);
      }
    });

    return sortedKeys.map((key, index) => {
      const group = groupedFields[key];
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      const isExpanded = expandedSections[fullKey];
      const isMounted = mountedSections.has(fullKey);
      const hasNestedChildren = !isEmptyObject(group.children);

      // Handle first-level parent with accent bar
      if (isTopLevel) {
        // Use shades of blue for visual distinction
        const accentColors = [
          '#194960', // dark-blue
          '#226280', // mid-blue
          '#3AB0DB', // vibrant-blue
          '#194960', // dark-blue (repeat)
          '#226280', // mid-blue (repeat)
          '#3AB0DB', // vibrant-blue (repeat)
        ];
        const accentColor = accentColors[index % accentColors.length];
        
        // If no nested children, just render the fields directly with the accent bar (not expandable)
        if (!hasNestedChildren) {
          return (
            <div 
              key={fullKey} 
              className="mb-2 border-l-4 pl-3 py-0.5 bg-surface-1/30 rounded-r-lg"
              style={{ borderLeftColor: accentColor }}
            >
              {group.fields.map((field) => (
                <SettingsField
                  key={field.name}
                  field={field}
                  onChange={handleFieldChange}
                  onDelete={handleDeleteField}
                  onAddArrayEntry={handleAddArrayEntry}
                  disabledReason={disabledReasons[field.name]}
                  isExpertMode={isExpertMode}
                  isArrayField={/.*\.\d+$/.test(field.name)}
                  rules={rules || []}
                  rulesAffectingField={affectingRulesMap.get(field.name) || []}
                  nestingLevel={level + 1}
                />
              ))}
            </div>
          );
        }
        
        // Has nested children - make the entire bar clickable to expand/collapse
        return (
          <div 
            key={fullKey} 
            className="mb-2 border-l-4 pl-3 py-0.5 bg-surface-1/30 rounded-r-lg cursor-pointer hover:bg-surface-2/50 transition-colors"
            style={{ borderLeftColor: accentColor }}
            onClick={() => toggleSection(fullKey)}
          >
            <div className="flex items-center">
              <span className="mr-2 text-sm">
                {isExpanded ? "▼" : "▶"}
              </span>
              <h3 className="text-xl font-bold">{key}</h3>
            </div>
            {/* Lazy mount: only render content after first expansion, then use display:none */}
            {isMounted && (
              <div 
                className="ml-2 mt-1" 
                style={{ display: isExpanded ? 'block' : 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                {group.fields.map((field) => (
                  <SettingsField
                    key={field.name}
                    field={field}
                    onChange={handleFieldChange}
                    onDelete={handleDeleteField}
                    onAddArrayEntry={handleAddArrayEntry}
                    disabledReason={disabledReasons[field.name]}
                    isExpertMode={isExpertMode}
                    isArrayField={/.*\.\d+$/.test(field.name)}
                    rules={rules || []}
                    rulesAffectingField={affectingRulesMap.get(field.name) || []}
                    nestingLevel={level + 1}
                  />
                ))}
                {renderGroupedFields(group.children, fullKey, false, level + 1)}
              </div>
            )}
          </div>
        );
      }

      // Render fields directly if no array-like children exist
      if (isEmptyObject(group.children)) {
        return group.fields.map((field) => (
          <SettingsField
            key={field.name}
            field={field}
            onChange={handleFieldChange}
            onDelete={handleDeleteField}
            onAddArrayEntry={handleAddArrayEntry}
            disabledReason={disabledReasons[field.name]}
            isExpertMode={isExpertMode}
            isArrayField={/.*\.\d+$/.test(field.name)}
            rules={rules || []}
            rulesAffectingField={affectingRulesMap.get(field.name) || []}
            nestingLevel={level}
          />
        ));
      }

      // Handle non-numeric keys or nested groups
      const showToggle = !isEmptyObject(group.children);
      return (
        <div key={fullKey} className="mb-4">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => toggleSection(fullKey)}
          >
            <span className="mr-2">
              {showToggle && (isExpanded ? "▼" : "▶")}
            </span>
            <h3 className="text-xl font-bold">{key}</h3>
          </div>
          {/* Lazy mount: only render content after first expansion, then use display:none */}
          {isMounted && (
            <div className="ml-4" style={{ display: isExpanded ? 'block' : 'none' }}>
              {group.fields.map((field) => (
                <SettingsField
                  key={field.name}
                  field={field}
                  onChange={handleFieldChange}
                  onDelete={handleDeleteField}
                  onAddArrayEntry={handleAddArrayEntry}
                  disabledReason={disabledReasons[field.name]}
                  isExpertMode={isExpertMode}
                  isArrayField={/.*\.\d+$/.test(field.name)}
                  rules={rules || []}
                  rulesAffectingField={affectingRulesMap.get(field.name) || []}
                  nestingLevel={level + 1}
                />
              ))}
              {renderGroupedFields(group.children, fullKey, false, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Memoize filtered fields
  const filteredFields = useMemo(() => fields.filter(
    (field) => {
      // Filter by search query
      const matchesSearch = field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (field.value &&
          field.value
            .toString()
            .toLowerCase()
            .includes(searchQuery.toLowerCase()));
      
      // Filter by illegal state if hideIllegal is true (hide fields where rules say they must NOT be set)
      const disabledReason = disabledReasons[field.name];
      const isIllegal = disabledReason && disabledReason.includes('not set');
      const matchesIllegalFilter = !hideIllegal || !isIllegal;
      
      return matchesSearch && matchesIllegalFilter;
    }
  ), [fields, searchQuery, hideIllegal, disabledReasons]);

  // Memoize grouped fields
  const groupedFields = useMemo(() => groupFieldsHierarchically(filteredFields), [groupFieldsHierarchically, filteredFields]);
  const showExpandAllToggle = useMemo(() => Object.values(groupedFields).some(item => !isEmptyObject(item.children)), [groupedFields]);
  
  // Check if there are any illegal fields (fields where rules say they must NOT be set)
  const hasIllegalFields = useMemo(() => {
    return fields.some(field => {
      const reason = disabledReasons[field.name];
      return reason && reason.includes('not set');
    });
  }, [fields, disabledReasons]);
  
  // Memoize this value instead of recalculating on every render
  const allSectionsExpanded = useMemo(() => {
    if (fields.length === 0) return false;
    return Object.keys(groupedFields).every(
      (section) => expandedSections[section]
    );
  }, [fields.length, groupedFields, expandedSections]);

  // useTransition for non-blocking expand with loading state
  const [isExpandPending, startExpandTransition] = useTransition();

  const expandAllSections = useCallback(() => {
    const getAllSectionKeys = (
      groupedFields: GroupedFields,
      parentKey = ""
    ): string[] => {
      const keys: string[] = [];
      Object.keys(groupedFields).forEach((key) => {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        keys.push(fullKey);
        keys.push(...getAllSectionKeys(groupedFields[key].children, fullKey));
      });
      return keys;
    };

    const allKeys = getAllSectionKeys(groupedFields);
    const shouldExpand = !allSectionsExpanded;
    
    // Update expanded state immediately (for toggle UI)
    const newState: { [key: string]: boolean } = {};
    allKeys.forEach(key => { newState[key] = shouldExpand; });
    setExpandedSections(newState);
    
    // Defer the heavy mounting work to keep UI responsive
    if (shouldExpand) {
      startExpandTransition(() => {
        setMountedSections(new Set(allKeys));
      });
    }
  }, [allSectionsExpanded, groupedFields]);
  
  const handleToggleCheckAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const shouldCheck = event.target.checked;
    
    // Keep a copy of original fields for tracking user changes
    const originalFields = fields.map(f => ({ ...f }));
    
    const newFields = fields.map((field) => ({
      ...field,
      checked: !disabledReasons[field.name] ? shouldCheck : field.checked,
    }));

    const trigger: TriggerAction = { 
      type: shouldCheck ? 'check_all' : 'uncheck_all' 
    };
    // Apply rules to the updated fields and use the result
    const { updatedFields, disabledReasons: newDisabledReasons } = applyRules(newFields, rules || [], trigger, originalFields);
    handleUpdateFields(updatedFields);
    setDisabledReasons(newDisabledReasons);
  }, [fields, disabledReasons, rules, handleUpdateFields, setDisabledReasons]);

  return (
    <div className="mt-8">
      {fields.length > 0 && (
        <>
          {/* Top row: field count and search */}
          <div className="flex items-center my-4 gap-4">
            <div className="shrink-0">
              <h4>
                Total fields: <strong>{filteredFields.length}</strong>{hideIllegal && fields.length !== filteredFields.length && <span className="text-gray-500"> / {fields.length}</span>}
              </h4>
            </div>

            <div className="flex-1">
              <input
                id="fields-search"
                name="fields-search"
                type="text"
                placeholder="Search fields..."
                aria-label="Search fields"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 border rounded-default bg-surface-0 text-text-primary"
              />
            </div>
          </div>

          {/* Second row: toggles */}
          <div className="flex items-center justify-between gap-6 mb-4">
            {fields.length > 1 ? (
              <label 
                htmlFor="toggle-all-fields"
                className="flex items-center cursor-pointer text-sm"
                title={allFieldsChecked 
                  ? 'Uncheck means to remove the check mark from fields as controlled by rules' 
                  : 'Check means to set the check mark on fields according to rules'}
              >
                <input
                  id="toggle-all-fields"
                  name="toggle-all-fields"
                  type="checkbox"
                  checked={allFieldsChecked}
                  onChange={handleToggleCheckAll}
                  className="mr-2"
                />
                <span>{allFieldsChecked ? 'Uncheck all uncheckable fields' : 'Check all checkable fields'}</span>
              </label>
            ) : <div />}
            <div className="flex items-center gap-6">
              {hasIllegalFields && (
                <ToggleSwitch
                  onChange={() => setHideIllegal(!hideIllegal)}
                  text={hideIllegal ? "Show illegal" : "Hide illegal"}
                  checked={hideIllegal}
                />
              )}
              {showExpandAllToggle &&
                <ToggleSwitch
                  onChange={expandAllSections}
                  text={
                    (allSectionsExpanded ? "Collapse" : "Expand") +
                    " all sections"
                  }
                  checked={allSectionsExpanded}
                  isLoading={isExpandPending}
                />
              }
            </div>
          </div>
        </>
      )}
      {renderGroupedFields(groupedFields, "", true)}
    </div>
  );
};

export default SettingsFieldsList;
