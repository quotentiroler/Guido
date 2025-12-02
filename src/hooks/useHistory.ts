import { useContext } from "react";
import { HistoryContext, HistoryContextType } from "@/context/HistoryContext";

export function useHistory(): HistoryContextType {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}

export type { FieldChange, FieldChangeInput, HistoryEntry, TriggerAction } from "@/context/HistoryContext";
