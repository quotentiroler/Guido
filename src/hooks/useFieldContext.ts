import { createContextHook } from '@/utils/createContextHook';
import { FieldContext } from '@/context/FieldContext';

export const useFieldContext = createContextHook(FieldContext, 'useFieldContext', 'FieldProvider');
