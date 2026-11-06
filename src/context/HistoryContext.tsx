import { createContext } from "react";
import type { TriggerAction, FieldChange } from "@quotentiroler/guido-logger";

export interface TimestampedFieldChange extends FieldChange {
  timestamp: Date;
}

export interface HistoryEntry {
  id: string;
  trigger: TriggerAction;
  changes: TimestampedFieldChange[];
  timestamp: Date;
  canUndo: boolean;
}

export interface HistoryContextType {
  history: HistoryEntry[];
  addEntry: (trigger: TriggerAction, changes: FieldChange[]) => void;
  clearHistory: () => void;
  undoLast: () => HistoryEntry | null;
  undoEntry: (entryId: string) => HistoryEntry[];
}

export const HistoryContext = createContext<HistoryContextType | undefined>(undefined);
