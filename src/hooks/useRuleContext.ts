import { createContextHook } from '@/utils/createContextHook';
import { RuleContext } from '@/context/RuleContext';

export const useRuleContext = createContextHook(RuleContext, 'useRuleContext', 'RuleProvider');
