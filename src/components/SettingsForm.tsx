import React, { useState } from "react";
import SettingsButtons from "./SettingsButtons";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { useFieldContext } from "@/hooks/useFieldContext";
import { useAppContext } from "@/hooks/useAppContext";
import { useTheme } from "@/hooks/useTheme";
import { useEasterEgg } from "@/hooks/useEasterEgg";
import TemplateMetadata from "./TemplateMetadata";
import TemplateSearch from "./TemplateSearch";
import SettingsTabs from "./SettingsTabs";
import ChangeHistory from "./ChangeHistory";
import GuidoMascot from "./GuidoMascot";
import guidoImage from "@/assets/guido_transparent.png";
import { HistoryEntry } from "@/hooks/useHistory";

const SettingsForm: React.FC = () => {
  const { isEmpty, fields } = useTemplateContext();
  const { handleUpdateFields, setDisabledReasons } = useFieldContext();
  const { isExpertMode } = useAppContext();
  const { secretSpaceMode } = useTheme();
  const { setIsActive: setEasterEggActive } = useEasterEgg();
  const [clickCount, setClickCount] = useState(0);
  const [showAIChat, setShowAIChat] = useState(true);

  const handleGuidoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    // Activate after 5 clicks on "Guido"
    if (newCount >= 5) {
      setEasterEggActive(true);
      setClickCount(0);
    }

    // Reset count after 2 seconds of no clicks
    setTimeout(() => {
      setClickCount((prev) => (prev === newCount ? 0 : prev));
    }, 2000);
  };

  const handleUndo = (entry: HistoryEntry) => {
    // Revert ALL changes in the entry (both user action and rule-applied changes)
    // by applying the old values directly
    const updatedFields = fields.map((field) => {
      const change = entry.changes.find((c) => c.fieldName === field.name);
      if (change) {
        return {
          ...field,
          [change.property]: change.oldValue,
        };
      }
      return field;
    });

    // Update fields directly without triggering new history entries
    handleUpdateFields(updatedFields);

    // Clear disabled reasons for the fields that were changed by rules
    // (they should be re-evaluated on next user action)
    setDisabledReasons((prev) => {
      const newReasons = { ...prev };
      entry.changes.forEach((change) => {
        if (change.reason !== 'User action' &&
          change.reason !== 'Checked all fields' &&
          change.reason !== 'Unchecked all fields') {
          delete newReasons[change.fieldName];
        }
      });
      return newReasons;
    });
  };

  return (
    <div className="container mx-auto px-2 sm:px-6 lg:px-8 max-w-full sm:max-w-[95%] md:max-w-[90%] lg:max-w-6xl">
      {secretSpaceMode ? (
        <div className="flex flex-col items-center my-4 sm:my-6">
          <GuidoMascot onToggleChat={() => setShowAIChat(prev => !prev)} />
          <p className="text-base sm:text-lg text-text-secondary mb-6 sm:mb-8 text-center">
            Configuration Template Manager
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center my-4 sm:my-6">
          <img
            onClick={handleGuidoClick}
            src={guidoImage}
            alt="Guido"
            className="w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-lg cursor-pointer"
          />

          <p className="text-base sm:text-lg text-text-secondary mb-6 sm:mb-8 text-center">
            Configuration Template Manager
          </p>
        </div>
      )}

      <TemplateSearch showAIChat={showAIChat} />

      <div className="rounded-default border border-strong shadow-lg p-3 sm:p-6 md:p-8 lg:p-12 w-full bg-surface-1/85 backdrop-blur-sm transition-all duration-300 blend-glass">
        <SettingsButtons />

        {(!isEmpty() || isExpertMode) && (
          <TemplateMetadata />
        )}

        <SettingsTabs />
      </div>

      <ChangeHistory onUndo={handleUndo} />
    </div>
  );
};

export default SettingsForm;