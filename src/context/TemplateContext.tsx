import { createContext, Dispatch, SetStateAction } from 'react';
import { Template, RuleSet, Field } from '@guido/types';

export interface TemplateContextProps {
  template: Template;
  ruleSets: RuleSet[];
  setRuleSets: Dispatch<SetStateAction<RuleSet[]>>;
  selectedRuleSetIndex: number;
  setSelectedRuleSetIndex: Dispatch<SetStateAction<number>>;
  fields: Field[];
  setFields: Dispatch<SetStateAction<Field[]>>;
  updateTemplate: (template: Template) => void;
  loadTemplateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeTemplate: () => void;
  isEmpty: () => boolean;
}

export const TemplateContext = createContext<TemplateContextProps | undefined>(undefined);
