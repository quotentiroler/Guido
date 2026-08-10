import { useContext } from 'react';
import { RuleContext, type RuleContextProps } from '@/context/RuleContext';

export const useRuleContext = (): RuleContextProps => {
  const context = useContext(RuleContext);
  if (!context) {
    throw new Error('useRuleContext must be used within a RuleProvider');
  }
  return context;
};