import React from 'react';
import Button from "./Button";

interface FancyConfirmProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

const FancyConfirm: React.FC<FancyConfirmProps> = ({ message, onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-surface-0 p-6 rounded-default shadow-lg">
        <div className="flex justify-center mb-3">
          <img src="/Guido/guido_icon.png" alt="Guido" className="h-12 opacity-90" />
        </div>
        <p className="mb-4 text-text-primary text-center">{message}</p>
        <div className="flex justify-end gap-2">
          <Button
            onClick={onClose}
            type="primary-text"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            size="small"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FancyConfirm;