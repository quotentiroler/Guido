import React from 'react';
import { Field, FieldValue } from '@guido/types';

export interface FieldContextProps {
  saveFields: () => void;
  /** 
   * Change a field's value and/or checked state. 
   * @param aiTool - Optional: if provided, marks this as an AI-initiated change for history tracking
   */
  handleFieldChange: (name: string, value: FieldValue, checked: boolean, aiTool?: string) => void;
  handleFieldChangeSilent: (name: string, value: FieldValue, checked: boolean) => void;
  handleUpdateField: (updatedField: Field) => void;
  handleDeleteField: (name: string) => void;
  disabledReasons: { [key: string]: string };
  setDisabledReasons: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  handleDeleteFields: () => void;
  handleAddField: (newField: Field, callback?: () => void) => void;
  handleUpdateFields: (updatedFields: Field[]) => void;
}

export const FieldContext = React.createContext<FieldContextProps | undefined>(undefined);