import { createContext } from "react";

// Import base types from logger package
import type { TriggerAction, FieldChange as BaseFieldChange } from "@guido/logger";
export { UNDOABLE_ACTIONS } from "@guido/logger";
export type { TriggerAction };

// Re-export BaseFieldChange as FieldChangeInput for backwards compatibility
export type FieldChangeInput = BaseFieldChange;

// FieldChange with timestamp (stored in history)
export interface FieldChange extends BaseFieldChange {
  timestamp: Date;
}

export interface HistoryEntry {
  id: string;
  trigger: TriggerAction;
  changes: FieldChange[];
  timestamp: Date;
  canUndo: boolean;
}

export interface HistoryContextType {
  history: HistoryEntry[];
  addEntry: (trigger: TriggerAction, changes: FieldChangeInput[]) => void;
  clearHistory: () => void;
  undoLast: () => HistoryEntry | null;
  /** Undo a specific entry and all entries that came after it (newer entries) */
  undoEntry: (entryId: string) => HistoryEntry[];
}

export const HistoryContext = createContext<HistoryContextType | undefined>(undefined);
