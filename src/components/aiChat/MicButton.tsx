import React from 'react';

const VARIANTS = {
  compact: {
    base: 'w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed',
    listening: 'bg-danger-100 dark:bg-danger-900/30 border border-danger-500 text-danger-500 animate-pulse',
    idle: 'bg-surface-1 border border-strong text-text-secondary hover:border-primary-500 hover:text-primary-500',
  },
  large: {
    base: 'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 text-lg',
    listening: 'bg-danger-100 dark:bg-danger-900/30 border-2 border-danger-500 text-danger-500 shadow-lg shadow-danger-500/30 animate-pulse',
    idle: 'bg-surface-1 border border-strong text-text-secondary hover:border-primary-500 hover:text-primary-500 hover:shadow-lg hover:shadow-primary-500/20',
  },
};

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  variant: keyof typeof VARIANTS;
  disabled?: boolean;
}

const MicButton: React.FC<MicButtonProps> = ({ isListening, onClick, variant, disabled }) => {
  const styles = VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles.base} ${isListening ? styles.listening : styles.idle}`}
      title={isListening ? 'Stop listening' : 'Start voice input'}
    >
      🎤
    </button>
  );
};

export default MicButton;
