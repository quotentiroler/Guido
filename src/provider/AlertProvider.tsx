import React, { useState } from 'react';
import { AlertContext, AlertContextProps, ChoiceOption } from '@/context/AlertContext';
import FancyAlert from '@/components/shared/FancyAlert';
import FancyConfirm from '@/components/shared/FancyConfirm';
import FancyChoice from '@/components/shared/FancyChoice';

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);
  const [onCancel, setOnCancel] = useState<(() => void) | null>(null);
  
  // Choice dialog state
  const [choiceMessage, setChoiceMessage] = useState<string | null>(null);
  const [choiceOptions, setChoiceOptions] = useState<ChoiceOption[]>([]);
  const [onChoice, setOnChoice] = useState<((value: string) => void) | null>(null);
  const [onChoiceCancel, setOnChoiceCancel] = useState<(() => void) | null>(null);

  const alert = (message: string) => {
    setAlertMessage(message);
  };

  const confirm = (message: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmMessage(message);
    setOnConfirm(() => onConfirm);
    setOnCancel(() => onCancel);
  };
  
  const choice = (message: string, options: ChoiceOption[], onChoice: (value: string) => void, onCancel?: () => void) => {
    setChoiceMessage(message);
    setChoiceOptions(options);
    setOnChoice(() => onChoice);
    setOnChoiceCancel(() => onCancel);
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    setConfirmMessage(null);
    setOnConfirm(null);
  };

  const handleCloseConfirm = () => {
    setConfirmMessage(null);
    setOnConfirm(null);
    if (onCancel) onCancel();
    setOnCancel(null);
  };

  const handleClose = () => {
    setAlertMessage(null);
  };
  
  const handleChoice = (value: string) => {
    if (onChoice) onChoice(value);
    setChoiceMessage(null);
    setChoiceOptions([]);
    setOnChoice(null);
    setOnChoiceCancel(null);
  };
  
  const handleCloseChoice = () => {
    setChoiceMessage(null);
    setChoiceOptions([]);
    setOnChoice(null);
    if (onChoiceCancel) onChoiceCancel();
    setOnChoiceCancel(null);
  };

  const contextValue: AlertContextProps = { alert, confirm, choice };


  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <div className="relative z-50">
        {alertMessage && <FancyAlert message={alertMessage} onClose={handleClose} />}
        {confirmMessage && (
          <FancyConfirm
            message={confirmMessage}
            onConfirm={handleConfirm}
            onClose={handleCloseConfirm}
          />
        )}
        {choiceMessage && (
          <FancyChoice
            message={choiceMessage}
            options={choiceOptions}
            onChoice={handleChoice}
            onClose={handleCloseChoice}
          />
        )}
      </div>
      {//<div className={`fixed top-0 left-0 w-full h-full bg-black bg-opacity-80 z-50 transition-opacity duration-1000 ${isChristmasMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        //{isChristmasMode && <Snowfall />}
        //</div>
      }
    </AlertContext.Provider>
  );
};