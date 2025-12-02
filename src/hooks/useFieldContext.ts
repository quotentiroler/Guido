import { useContext } from 'react';
import { FieldContext, FieldContextProps } from '@/context/FieldContext';

export const useFieldContext = (): FieldContextProps => {
  const context = useContext(FieldContext);
  if (!context) {
    throw new Error('useFieldContext must be used within a FieldProvider');
  }
  return context;
};