import { createContextHook } from '@/utils/createContextHook';
import { AppContext } from '@/context/AppContext';

export const useAppContext = createContextHook(AppContext, 'useAppContext', 'AppProvider');
