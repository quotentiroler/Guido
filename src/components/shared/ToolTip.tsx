import React, { useState, useRef } from 'react';
import TooltipContent from './TooltipContent';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, delay = 300 }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!text || text.length === 0) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && <TooltipContent text={text} />}
    </div>
  );
};

export default Tooltip;