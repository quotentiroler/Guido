import { createContextHook } from '@/utils/createContextHook';
import { TemplateContext } from '@/context/TemplateContext';

export const useTemplateContext = createContextHook(TemplateContext, 'useTemplateContext', 'TemplateProvider');
