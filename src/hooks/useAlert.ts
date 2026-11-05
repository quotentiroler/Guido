import { createContextHook } from '@/utils/createContextHook';
import { AlertContext } from '@/context/AlertContext';

export const useAlert = createContextHook(AlertContext, 'useAlert', 'AlertProvider');
