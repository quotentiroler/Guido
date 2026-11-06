import { createContextHook } from '@/utils/createContextHook';
import { AIContext } from '@/context/AIContext';

export const useAI = createContextHook(AIContext, 'useAI', 'AIProvider');
