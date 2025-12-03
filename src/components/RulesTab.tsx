import React, { useState, useMemo } from "react";
import Button from "./shared/Button";
import RulesList from "./RulesList";
import { useRuleContext } from "@/hooks/useRuleContext";
import { useAppContext } from "@/hooks/useAppContext";
import { Rule, RuleState, RuleSet } from "@guido/types";
import { resolveRuleSetRules } from "@guido/core";
import AddOrEditRuleModal from "./AddRuleModal";
import { useTemplateContext } from "@/hooks/useTemplateContext";

const RulesTab: React.FC = () => {
  const { handleDeleteRule, handleDeleteRules, currentRules, handleUpdateRuleSet, handleAddRuleSet, handleDeleteRuleSet } = useRuleContext();
  const { template, ruleSets, selectedRuleSetIndex, setSelectedRuleSetIndex } = useTemplateContext();
  const { isExpertMode } = useAppContext();
  const [newRule, setNewRule] = useState<Rule>({
    targets: [{ name: "", state: RuleState.Set }],
    conditions: [],
  });
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRuleSetEditor, setShowRuleSetEditor] = useState(false);
  const [editingRuleSet, setEditingRuleSet] = useState<Partial<RuleSet>>({});

  const currentRuleSet = ruleSets[selectedRuleSetIndex];
  
  // Calculate inherited rules count for each ruleset
  // Use a derived template with current ruleSets to avoid stale data after rule edits
  const ruleSetStats = useMemo(() => {
    const currentTemplate = { ...template, ruleSets };
    return ruleSets.map((rs, index) => {
      const ownRules = rs.rules.length;
      let totalRules = ownRules;
      try {
        totalRules = resolveRuleSetRules(currentTemplate, index).length;
      } catch {
        // Ignore inheritance errors for display
      }
      const inheritedRules = totalRules - ownRules;
      return { ownRules, inheritedRules, totalRules };
    });
  }, [template, ruleSets]);

  const handleEditRuleSet = () => {
    if (currentRuleSet) {
      setEditingRuleSet({
        name: currentRuleSet.name,
        description: currentRuleSet.description,
        tags: [...(currentRuleSet.tags || [])],
        extends: currentRuleSet.extends,
      });
      setShowRuleSetEditor(true);
    }
  };

  const handleSaveRuleSet = () => {
    handleUpdateRuleSet(selectedRuleSetIndex, editingRuleSet);
    setShowRuleSetEditor(false);
  };

  const handleCreateNewRuleSet = () => {
    const newRuleSet: RuleSet = {
      name: `RuleSet ${ruleSets.length + 1}`,
      description: '',
      tags: [],
      rules: [],
    };
    handleAddRuleSet(newRuleSet);
    setSelectedRuleSetIndex(ruleSets.length); // Select the new one
  };

  return (
    <>
      {showRuleModal && (
        <AddOrEditRuleModal
          newRule={newRule}
          setNewRule={setNewRule}
          handleClose={() => setShowRuleModal(false)}
        />
      )}
      
      {/* RuleSet Selector */}
      <div className="my-4 p-3 bg-surface-2 rounded-lg border">
        {/* Selector row with buttons inline */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="text-sm font-medium text-text-secondary shrink-0">RuleSet:</label>
          <select
            value={selectedRuleSetIndex}
            onChange={(e) => setSelectedRuleSetIndex(Number(e.target.value))}
            className="flex-1 px-3 py-1.5 bg-surface-1 border rounded text-sm text-text-primary"
          >
            {ruleSets.map((ruleSet, index) => {
              const stats = ruleSetStats[index];
              const inheritedText = stats?.inheritedRules > 0 ? ` (+${stats.inheritedRules} inherited)` : '';
              return (
                <option key={index} value={index}>
                  {ruleSet.name} {index === 0 ? '(Default)' : ''} — {ruleSet.rules.length} rules{inheritedText}
                </option>
              );
            })}
          </select>
          {/* Action buttons - inline with dropdown, only in expert mode */}
          {isExpertMode && (
            <div className="flex gap-2 shrink-0">
              <Button onClick={handleEditRuleSet} type="secondary" size="small" title="Edit RuleSet">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <Button onClick={handleCreateNewRuleSet} type="secondary" size="small" title="New RuleSet">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Button>
              {selectedRuleSetIndex > 0 && (
                <Button onClick={() => handleDeleteRuleSet(selectedRuleSetIndex)} type="error-text" size="small" title="Delete RuleSet">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RuleSet description (non-edit mode) */}
      {!showRuleSetEditor && currentRuleSet && (currentRuleSet.description || currentRuleSet.extends || (currentRuleSet.tags && currentRuleSet.tags.length > 0)) && (
        <div className="text-xs text-text-tertiary mb-2 px-1 flex flex-wrap gap-x-3 gap-y-1">
          {currentRuleSet.description && <span>{currentRuleSet.description}</span>}
          {currentRuleSet.extends && (
            <span className="text-vibrant-blue">
              ↳ extends: {currentRuleSet.extends}
            </span>
          )}
          {currentRuleSet.tags && currentRuleSet.tags.length > 0 && (
            <span>
              Tags: {currentRuleSet.tags.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* RuleSet Editor */}
      {showRuleSetEditor && (
        <div className="my-4 p-3 sm:p-4 bg-surface-2 rounded-lg border space-y-3">
          <h3 className="font-medium text-text-primary">Edit RuleSet</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="ruleset-name" className="block text-sm text-text-secondary mb-1">Name</label>
              <input
                id="ruleset-name"
                name="ruleset-name"
                type="text"
                value={editingRuleSet.name || ''}
                onChange={(e) => setEditingRuleSet({ ...editingRuleSet, name: e.target.value })}
                className="w-full px-3 py-1.5 bg-surface-1 border rounded text-sm"
                disabled={selectedRuleSetIndex === 0} // Can't rename default
              />
            </div>
            <div>
              <label htmlFor="ruleset-tags" className="block text-sm text-text-secondary mb-1">Tags (comma-separated)</label>
              <input
                id="ruleset-tags"
                name="ruleset-tags"
                type="text"
                value={editingRuleSet.tags?.join(', ') || ''}
                onChange={(e) => setEditingRuleSet({ 
                  ...editingRuleSet, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
                className="w-full px-3 py-1.5 bg-surface-1 border rounded text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label htmlFor="ruleset-extends" className="block text-sm text-text-secondary mb-1">Extends (inherit from)</label>
              <select
                id="ruleset-extends"
                name="ruleset-extends"
                value={editingRuleSet.extends || ''}
                onChange={(e) => setEditingRuleSet({ 
                  ...editingRuleSet, 
                  extends: e.target.value || undefined 
                })}
                className="w-full px-3 py-1.5 bg-surface-1 border rounded text-sm text-text-primary"
              >
                <option value="">None</option>
                {ruleSets
                  .filter((rs, idx) => idx !== selectedRuleSetIndex) // Can't extend self
                  .map((rs, idx) => (
                    <option key={idx} value={rs.name}>
                      {rs.name}
                    </option>
                  ))
                }
              </select>
              <p className="text-xs text-text-tertiary mt-1">Inherit rules from another ruleset</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Description</label>
            <textarea
              value={editingRuleSet.description || ''}
              onChange={(e) => setEditingRuleSet({ ...editingRuleSet, description: e.target.value })}
              className="w-full px-3 py-1.5 bg-surface-1 border rounded text-sm"
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveRuleSet} type="primary" size="small">
              Save
            </Button>
            <Button onClick={() => setShowRuleSetEditor(false)} type="secondary" size="small">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add/Delete buttons - only in expert mode */}
      {isExpertMode && (
        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-2 sm:gap-4 my-4">
          <Button
            onClick={() => setShowRuleModal(true)}
            type="secondary"
            size="small"
          >
            Add Rule
          </Button>
          {currentRules && currentRules.length > 0 && (
            <Button onClick={handleDeleteRules} type="error-text" size="small">
              Delete All Rules
            </Button>
          )}
        </div>
      )}
      <RulesList onDeleteRule={handleDeleteRule} />
    </>
  );
};

export default RulesTab;
