import React from 'react';
import Button from "./Button";
import { ChoiceOption } from '@/context/AlertContext';

interface FancyChoiceProps {
  message: string;
  options: ChoiceOption[];
  onChoice: (value: string) => void;
  onClose: () => void;
}

const FancyChoice: React.FC<FancyChoiceProps> = ({ message, options, onChoice, onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-surface-0 p-6 rounded-default shadow-lg max-w-md">
        <div className="flex justify-center mb-3">
          <img src="/Guido/guido_icon.png" alt="Guido" className="h-12 opacity-90" />
        </div>
        <p className="mb-4 text-text-primary text-center">{message}</p>
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              onClick={() => onChoice(option.value)}
              type={option.type || 'primary'}
              size="small"
              className="w-full"
            >
              {option.label}
            </Button>
          ))}
          <Button
            onClick={onClose}
            type="primary-text"
            size="small"
            className="w-full mt-2"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FancyChoice;
