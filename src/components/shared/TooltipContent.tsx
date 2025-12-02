import React from 'react';

interface TooltipContentProps {
  text: string;
}

const TooltipContent: React.FC<TooltipContentProps> = ({ text }) => {
  const lines = text.split('\n');
  const isLongContent = text.length > 200 || lines.length > 5;

  const formattedText = lines.map((line, index) => (
    <React.Fragment key={index}>
      {line}
      {index < lines.length - 1 && <br />}
    </React.Fragment>
  ));

  return (
    <div
      className={`
        tooltip-content absolute z-50
        bg-surface-0 dark:bg-surface-2
        border border-strong
        shadow-lg rounded-lg
        p-3
        top-full left-1/2 transform -translate-x-1/2
        mt-2
        text-sm text-text-primary
        ${isLongContent ? 'max-h-48 overflow-y-auto' : ''}
        min-w-[150px] max-w-[320px] w-max
      `}
      style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
    >
      {/* Arrow pointer */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-strong" />
      <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-surface-0 dark:border-b-surface-2" />
      
      {formattedText}
      
      {isLongContent && (
        <div className="text-[10px] text-text-disabled mt-2 pt-2 border-t border-weak text-center">
          Scroll for more
        </div>
      )}
    </div>
  );
};

export default TooltipContent;