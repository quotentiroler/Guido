import { createContextHook } from '@/utils/createContextHook';
import { EasterEggContext } from '@/context/EasterEggContext';

export const useEasterEgg = createContextHook(EasterEggContext, 'useEasterEgg', 'EasterEggProvider');
