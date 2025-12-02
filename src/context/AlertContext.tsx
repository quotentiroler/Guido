import { createContext } from 'react';

export interface ChoiceOption {
  label: string;
  value: string;
  type?: 'primary' | 'secondary' | 'primary-text' | 'secondary-text';
}

export interface AlertContextProps {
  alert: (message: string) => void;
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
  choice: (message: string, options: ChoiceOption[], onChoice: (value: string) => void, onCancel?: () => void) => void;
}

export const AlertContext = createContext<AlertContextProps | undefined>(undefined);