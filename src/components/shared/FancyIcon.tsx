import React from "react";
import Tooltip from "./ToolTip";

interface IconWithTooltipProps {
  text: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const IconWithTooltip: React.FC<IconWithTooltipProps> = ({ text, icon, onClick, className }) => {
  return (
    <Tooltip text={text}>
      <span onClick={onClick} className={`${className} cursor-help`}>
        {icon}
      </span>
    </Tooltip>
  );
};

export default IconWithTooltip;