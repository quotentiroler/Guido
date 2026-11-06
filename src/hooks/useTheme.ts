import { createContextHook } from '@/utils/createContextHook';
import { ThemeContext } from '@/context/ThemeContext';

export const useTheme = createContextHook(ThemeContext, 'useTheme', 'ThemeProvider');
