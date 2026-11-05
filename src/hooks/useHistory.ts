import { createContextHook } from '@/utils/createContextHook';
import { HistoryContext } from '@/context/HistoryContext';

export const useHistory = createContextHook(HistoryContext, 'useHistory', 'HistoryProvider');
