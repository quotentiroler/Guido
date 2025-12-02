import { useContext } from 'react';
import { AIContext, AIContextType } from '@/context/AIContext';

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
