import React from "react";
import Button from "./shared/Button";
import FileInput from "./shared/FileInput";
import { CopyButton, PasteButton } from "./shared/ClipboardButtons";
import { parseSettingsFromFile, saveSettings } from "@/utils/settingsUtils";
import { validateValue } from "@guido/core";
import { useAlert } from "@/hooks/useAlert";
import { useTemplateContext } from "@/hooks/useTemplateContext";


const SettingsButtons: React.FC = () => {
  const { template, fields, updateTemplate } = useTemplateContext();
  const { alert } = useAlert();

  const handleSaveAppSettings = async () => {
    const checkedFields = fields.filter((field) => field.checked);
    const invalidFields = checkedFields.filter(
      (field) => !validateValue(field.value, field.range)
    );

    if (invalidFields.length > 0) {
      alert(
        `The following fields have invalid values: <br> ${invalidFields
          .map((field) => field.name)
          .join(",<br>")} <br> <br> Please correct them before saving.`
      );
      return;
    }
    const result = await saveSettings(checkedFields, template?.fileName === '' ? undefined : template?.fileName);
    if (result) {
      alert(result);
    }
  };

  const handleImportSettings = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const result = await parseSettingsFromFile(event);
    if (!result) {
      alert("Invalid file format. Please upload a valid settings file.");
      return;
    }

    applyImportedSettings(result);
    input.value = "";
  };

  const handlePasteSettings = async () => {
    if (!navigator.clipboard) {
      alert("Clipboard API not available");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const result = await parseSettingsFromFile(null, text);
      if (!result) {
        alert("Invalid clipboard content. Please copy valid settings data.");
        return;
      }
      applyImportedSettings(result);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      alert("Failed to read clipboard. Please try again.");
    }
  };

  const applyImportedSettings = (result: Awaited<ReturnType<typeof parseSettingsFromFile>>) => {
    if (!result) return;

    const updatedFields = fields.map((field) => {
      const matchingField = result.fields.find((resField) => resField.name === field.name);
      return matchingField
        ? { ...field, value: matchingField.value, checked: true }
        : field;
    });

    const newFields = result.fields
      .filter((resField) => !fields.some((field) => field.name === resField.name))
      .map((newField) => ({ ...newField, checked: true }));

    const finalFields = [...updatedFields, ...newFields];
    const newTemplate = {
      ...template,
      fileName: result.fileName,
      fields: finalFields,
    };
    updateTemplate(newTemplate);

    const updatedFieldNames = updatedFields.filter(f => result.fields.some(rf => rf.name === f.name)).map((field) => field.name).join("<br>");
    const newFieldNames = newFields.map((field) => field.name).join("<br>");
    let message = "Settings imported successfully!<br>";
    if (newFieldNames) {
      message += `<br>New fields added:<br>${newFieldNames}<br>`;
    }
    if (updatedFieldNames) {
      message += `<br>Updated fields:<br>${updatedFieldNames}`;
    }
    alert(message);
  };

  const handleCopySettings = async () => {
    if (!navigator.clipboard) {
      alert("Clipboard API not available");
      return;
    }

    const checkedFields = fields.filter((field) => field.checked);
    const invalidFields = checkedFields.filter(
      (field) => !validateValue(field.value, field.range)
    );

    if (invalidFields.length > 0) {
      alert(
        `The following fields have invalid values: <br> ${invalidFields
          .map((field) => field.name)
          .join(",<br>")} <br> <br> Please correct them before copying.`
      );
      return;
    }

    const settingsText = await saveSettings(checkedFields, template?.fileName === '' ? undefined : template?.fileName, true);
    if (typeof settingsText === 'string' && !settingsText.startsWith('Settings')) {
      try {
        await navigator.clipboard.writeText(settingsText);
        alert("Settings copied to clipboard successfully!");
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        alert("Failed to copy to clipboard. Please try again.");
      }
    } else {
      alert(settingsText || "Failed to generate settings");
    }
  };

  return (
    <div className="mb-4">
      {/* Mobile: 2x2 grid, Desktop: left group + right group */}
      <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        {/* Left group: Import + Paste */}
        <div className="contents sm:flex sm:items-center sm:gap-2">
          {/* Import Settings */}
          <FileInput label="Import Settings" onChange={(e) => void handleImportSettings(e)} formats=".json,.csv,.yml,.yaml,.txt,.properties,.env" />
          
          {/* Paste */}
          <PasteButton onClick={() => void handlePasteSettings()} showLabel />
        </div>

        {/* Right group: Copy + Download */}
        <div className="contents sm:flex sm:items-center sm:gap-2">
          {/* Copy */}
          <CopyButton onClick={() => void handleCopySettings()} showLabel />

          {/* Download Settings */}
          <Button onClick={() => void handleSaveAppSettings()}>Download</Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsButtons;