import React, { useState, useMemo } from "react";
import { useHistory, HistoryEntry, TriggerAction } from "@/hooks/useHistory";

interface ChangeHistoryProps {
  onUndo?: (entry: HistoryEntry) => void;
}

// Check if an entry has any rule-applied changes (not just user actions)
const hasRuleAppliedChanges = (entry: HistoryEntry): boolean => {
  return entry.changes.some(change => change.reason !== 'User action' && 
    change.reason !== 'Checked all fields' && 
    change.reason !== 'Unchecked all fields');
};

const ChangeHistory: React.FC<ChangeHistoryProps> = ({ onUndo }) => {
  const { history, clearHistory, undoEntry } = useHistory();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUserActions, setShowUserActions] = useState(false);

  // Filter history based on showUserActions toggle
  const filteredHistory = useMemo(() => {
    if (showUserActions) {
      return history;
    }
    // Only show entries that have rule-applied changes
    return history.filter(hasRuleAppliedChanges);
  }, [history, showUserActions]);

  // Count of rule-applied entries for the badge
  const ruleAppliedCount = useMemo(() => {
    return history.filter(hasRuleAppliedChanges).length;
  }, [history]);

  if (history.length === 0) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'string') {
      if (value.length > 30) return `"${value.slice(0, 30)}..."`;
      return `"${value}"`;
    }
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    // For any remaining primitive types (symbols, bigints)
    return typeof value === 'symbol' ? value.toString() : String(value as string | number | boolean | bigint);
  };

  const formatTrigger = (trigger: TriggerAction): string => {
    switch (trigger.type) {
      case 'field_check':
        return `Checked "${trigger.fieldName}"`;
      case 'field_uncheck':
        return `Unchecked "${trigger.fieldName}"`;
      case 'field_value_change':
        return `Changed "${trigger.fieldName}"`;
      case 'check_all':
        return 'Checked all fields';
      case 'uncheck_all':
        return 'Unchecked all fields';
      case 'import':
        return 'Imported settings';
      case 'template_load':
        return 'Loaded template';
      case 'rules_changed':
        return 'Rules changed';
      case 'ai_change':
        return trigger.aiTool 
          ? `🤖 AI: ${trigger.aiTool}` 
          : `🤖 AI changed "${trigger.fieldName}"`;
      default:
        return 'Rules applied';
    }
  };

  const handleUndo = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    const entries = undoEntry(entryId);
    // Call onUndo for each entry that was undone (in reverse order, oldest first)
    if (onUndo) {
      entries.reverse().forEach(entry => onUndo(entry));
    }
  };

  // Filter changes within an entry if not showing user actions
  const getDisplayChanges = (entry: HistoryEntry) => {
    if (showUserActions) {
      return entry.changes;
    }
    // Only show rule-applied changes
    return entry.changes.filter(change => 
      change.reason !== 'User action' && 
      change.reason !== 'Checked all fields' && 
      change.reason !== 'Unchecked all fields'
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-surface-0 border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-2 bg-surface-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <span className="font-medium text-text-primary">
              {showUserActions ? 'Change History' : 'Rules Applied'}
            </span>
            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {showUserActions ? history.length : ruleAppliedCount}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearHistory();
                }}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2"
              >
                Clear
              </button>
            )}
            <span className="text-text-disabled">
              {isExpanded ? '▼' : '▲'}
            </span>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <>
            {/* Guido icon */}
            <div className="flex justify-center py-3 bg-surface-1 border-b border">
              <img src="/Guido/guido_icon.png" alt="Guido" className="h-12" />
            </div>
            
            {/* Show user actions toggle */}
            <div className="px-4 py-2 bg-surface-2 border-b border">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={showUserActions}
                  onChange={(e) => setShowUserActions(e.target.checked)}
                  className="rounded"
                  onClick={(e) => e.stopPropagation()}
                />
                Show user actions
              </label>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-text-disabled">
                  No rules have been applied yet
                </div>
              ) : (
                filteredHistory.map((entry) => {
                  const displayChanges = getDisplayChanges(entry);
                  if (displayChanges.length === 0) return null;
                  
                  return (
                    <div 
                      key={entry.id} 
                      className="border-b border last:border-b-0"
                    >
                      <div className="px-4 py-2 bg-surface-2 text-xs text-text-disabled">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700 ">
                            {formatTrigger(entry.trigger)}
                          </span>
                          {onUndo && entry.canUndo && (
                            <button
                              onClick={(e) => handleUndo(e, entry.id)}
                              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              ↩ Undo
                            </button>
                          )}
                        </div>
                        <span>
                          {formatTime(entry.timestamp)} — {displayChanges.length} change{displayChanges.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="px-4 py-2 space-y-1">
                        {displayChanges.map((change, idx) => (
                          <div key={idx} className="text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-xs">
                                {change.property === 'checked' ? '☑️' : '📝'}
                              </span>
                              <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                {change.fieldName}
                              </code>
                            </div>
                            <div className="ml-5 text-xs text-text-secondary">
                              <span className="text-red-500 dark:text-red-400">
                                {formatValue(change.oldValue)}
                              </span>
                              <span className="mx-1">→</span>
                              <span className="text-success-700">
                                {formatValue(change.newValue)}
                              </span>
                            </div>
                            <div className="ml-5 text-xs text-text-disabled italic">
                              {change.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChangeHistory;
