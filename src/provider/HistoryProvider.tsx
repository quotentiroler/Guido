import React, { useState, useCallback, useEffect, ReactNode } from "react";
import { HistoryContext, HistoryEntry, FieldChangeInput, TriggerAction, UNDOABLE_ACTIONS } from "@/context/HistoryContext";
import { logger } from "@/utils/logger";

interface HistoryProviderProps {
  children: ReactNode;
  maxEntries?: number;
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({ 
  children, 
  maxEntries = 50 
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addEntry = useCallback((trigger: TriggerAction, changes: FieldChangeInput[]) => {
    if (changes.length === 0) return;

    const timestamp = new Date();
    const canUndo = UNDOABLE_ACTIONS.includes(trigger.type);
    
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      trigger,
      changes: changes.map(c => ({ ...c, timestamp })),
      timestamp,
      canUndo,
    };

    setHistory((prev) => {
      const updated = [entry, ...prev];
      // Keep only the last maxEntries
      return updated.slice(0, maxEntries);
    });
  }, [maxEntries]);

  // Register with logger to receive field changes
  useEffect(() => {
    logger.onFieldChanges(addEntry);
    return () => {
      logger.onFieldChanges(null);
    };
  }, [addEntry]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const undoLast = useCallback((): HistoryEntry | null => {
    // Find the first undoable entry
    const undoableIndex = history.findIndex(entry => entry.canUndo);
    if (undoableIndex === -1) return null;
    
    const entryToUndo = history[undoableIndex];
    setHistory((prev) => prev.filter((_, idx) => idx !== undoableIndex));
    return entryToUndo;
  }, [history]);

  const undoEntry = useCallback((entryId: string): HistoryEntry[] => {
    // Find the target entry
    const targetIndex = history.findIndex(entry => entry.id === entryId);
    if (targetIndex === -1) return [];
    
    // Get all entries from index 0 to targetIndex (inclusive) - these are the newer entries + target
    const entriesToUndo = history.slice(0, targetIndex + 1);
    
    // Remove all these entries from history
    setHistory((prev) => prev.slice(targetIndex + 1));
    
    return entriesToUndo;
  }, [history]);

  return (
    <HistoryContext.Provider value={{ history, addEntry, clearHistory, undoLast, undoEntry }}>
      {children}
    </HistoryContext.Provider>
  );
};
