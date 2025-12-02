import React from "react";

interface ToggleSwitchProps {
  onChange: () => void;
  checked?: boolean;
  text: string;
  isLoading?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ onChange, text, checked, isLoading }) => {
  return (
    <label className="relative inline-flex flex-col items-center sm:flex-row sm:space-x-3">
      <input
        type="checkbox"
        onChange={onChange}
        checked={checked}
        className="sr-only peer"
        disabled={isLoading}
      />
      <div className="relative w-[40px] h-[24px] bg-surface-0 border border-strong rounded-default peer peer-checked:bg-primary-default peer-checked:after:translate-x-full peer-checked:after:bg-white peer-checked:border-primary-default after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-surface-4 after:rounded-default after:h-[16px] after:w-[16px] after:transition-all">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[14px] h-[14px] border-2 border-primary-default border-t-transparent rounded-full animate-spin" 
                 style={{ marginLeft: checked ? '20px' : '4px' }}></div>
          </div>
        )}
      </div>
      <span className="mt-2 text-sm font-medium text-text-primary sm:mt-0 whitespace-nowrap">
        {text}
      </span>
    </label>
  );
};

export default ToggleSwitch;