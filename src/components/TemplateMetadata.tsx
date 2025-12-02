import React, { useState } from "react";
import { Template } from "@guido/types";
import { useAlert } from "@/hooks/useAlert";
import { useAppContext } from "@/hooks/useAppContext";
import Button from "./shared/Button";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import FileInput from "./shared/FileInput";
import { CopyButton, PasteButton } from "./shared/ClipboardButtons";
import { downloadTemplate } from "@/utils/settingsUtils";

const TemplateMetadata: React.FC = () => {
  const { alert, confirm } = useAlert();
  const { isExpertMode } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const {
    template,
    updateTemplate,
    fields,
    ruleSets,
    loadTemplateFromFile,
    removeTemplate,
    isEmpty,
  } = useTemplateContext();
  const [editableTemplate, setEditableTemplate] = useState<Template>({
    name: "",
    fileName: "",
    version: "",
    description: "",
    owner: "",
    application: "",
    docs: "",
    command: "",
    fields: [],
    ruleSets: [],
  });

  const handleCommandClick = () => {
    if (!template) return;
    if (!navigator.clipboard) {
      alert("Clipboard API not available");
      return;
    }
    if (!template.command) {
      alert("No command to copy");
      return;
    }
    navigator.clipboard
      .writeText(template.command)
      .then(() => {
        alert("Command copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy command: ", err);
      });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditableTemplate((prevTemplate) => ({ ...prevTemplate, [name]: value }));
  };

  const handleSave = () => {
    updateTemplate({ ...editableTemplate, fields, ruleSets });
    setIsEditing(false);
  };

  const handleEdit = () => {
    if (template) setEditableTemplate(template);
    setIsEditing(!isEditing);
  };

  const handleRemove = () => {
    confirm("Are you sure you want to remove this template?", removeTemplate);
  };

  const handleDownloadTemplate = async () => {
    if (!template) return;
    try {
      const result = await downloadTemplate(template);
      if (result)
        alert(result);
    } catch (error) {
      console.error("Failed to download template:", error);
      alert("An error occurred while downloading the template.");
    }
  };

  const handleCopyTemplate = async () => {
    if (!template) return;
    if (!navigator.clipboard) {
      alert("Clipboard API not available");
      return;
    }

    try {
      const templateText = JSON.stringify(template, null, 2);
      await navigator.clipboard.writeText(templateText);
      alert("Template copied to clipboard successfully!");
    } catch (err) {
      console.error("Failed to copy template:", err);
      alert("Failed to copy template to clipboard. Please try again.");
    }
  };

  const handlePasteTemplate = async () => {
    if (!navigator.clipboard) {
      alert("Clipboard API not available");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const parsedTemplate = JSON.parse(text) as Template;
      
      // Validate it's a template
      if (!parsedTemplate.fields || !Array.isArray(parsedTemplate.fields)) {
        alert("Invalid template format in clipboard. Please copy a valid Guido template.");
        return;
      }

      updateTemplate(parsedTemplate);
      alert("Template imported from clipboard successfully!");
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      if (err instanceof SyntaxError) {
        alert("Invalid JSON in clipboard. Please copy a valid Guido template.");
      } else {
        alert("Failed to read clipboard. Please try again.");
      }
    }
  };

  if (!template) {
    return (
      <div className="my-4 p-6 border border-strong rounded-lg bg-surface-2 shadow-sm">
        <p className="text-center text-text-primary">No template selected</p>
      </div>
    );
  }
  return (
    <div className="my-4 p-6 border border-strong rounded-lg bg-surface-2 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-2xl font-bold mb-2 sm:mb-0 text-text-primary">
          {isEditing ? "Edit Template" : template.name}
        </h2>
        <div className="flex gap-4">
          {!isEditing && !isEmpty() && (
            <Button type="error-text" onClick={() => handleRemove()}>
              Remove
            </Button>
          )}
          {isExpertMode && (
            <>
              <Button type="primary-text" onClick={() => handleEdit()}>
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              {isEditing && (
                <Button type="primary" onClick={() => handleSave()}>
                  Save
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-4 mb-4">
          <label htmlFor="template-name" className="text-text-primary">
            <strong>Name:</strong>
            <input
              id="template-name"
              type="text"
              name="name"
              value={editableTemplate.name}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-application" className="text-text-primary">
            <strong>Application:</strong>
            <input
              id="template-application"
              type="text"
              name="application"
              value={editableTemplate.application}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-version" className="text-text-primary">
            <strong>Version:</strong>
            <input
              id="template-version"
              type="text"
              name="version"
              value={editableTemplate.version}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-owner" className="text-text-primary">
            <strong>Owner:</strong>
            <input
              id="template-owner"
              type="text"
              name="owner"
              value={editableTemplate.owner}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-fileName" className="text-text-primary">
            <strong>File Name:</strong>
            <input
              id="template-fileName"
              type="text"
              name="fileName"
              value={editableTemplate.fileName}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-description" className="text-text-primary">
            <strong>Description:</strong>
            <textarea
              id="template-description"
              name="description"
              value={editableTemplate.description}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full h-24 bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-command" className="text-text-primary">
            <strong>Command:</strong>
            <input
              id="template-command"
              type="text"
              name="command"
              value={editableTemplate.command}
              onChange={handleChange}
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
          <label htmlFor="template-docs" className="text-text-primary">
            <strong>Documentation URL:</strong>
            <input
              id="template-docs"
              type="url"
              name="docs"
              value={editableTemplate.docs || ''}
              onChange={handleChange}
              placeholder="https://docs.example.com/..."
              className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
            />
          </label>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap justify-between mb-4 pb-4 border-b border-strong">
            {template.application && (
              <p className="w-full sm:w-auto text-text-primary">
                <strong>Application:</strong> {template.application}
              </p>
            )}
            <p className="w-full sm:w-auto text-text-primary">
              <strong>Version:</strong> {template.version}
            </p>
            <p className="w-full sm:w-auto text-text-primary">
              <strong>Owner:</strong> {template.owner}
            </p>
            <p className="w-full sm:w-auto text-text-primary">
              <strong>File Name:</strong> {template.fileName}
            </p>
          </div>
          <div className="pb-4 mb-4 border-b border-strong">
            <p className="text-text-primary">
              <strong>Description:</strong> {template.description}
            </p>
          </div>
          {template.command && (
            <div className="mb-2">
              <strong className="text-text-primary">Command: </strong>
              <code onClick={handleCommandClick} style={{ cursor: "pointer" }} className="text-text-primary bg-surface-1 px-1 rounded">
                {template.command}
              </code>
            </div>
          )}
          {template.docs && (
            <div className="mb-4">
              <strong className="text-text-primary">Documentation: </strong>
              <a 
                href={template.docs} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600 underline"
              >
                {template.docs}
              </a>
            </div>
          )}
          {isExpertMode && (
            <div className="my-4">
              {/* Mobile: 2x2 grid, Desktop: left group + right group */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                {/* Left group: Load Template + Paste */}
                <div className="contents sm:flex sm:items-center sm:gap-2">
                  {/* Load Template */}
                  <FileInput label="Load Template" onChange={loadTemplateFromFile} />
                  
                  {/* Paste */}
                  <PasteButton onClick={() => void handlePasteTemplate()} showLabel />
                </div>

                {/* Right group: Copy + Download */}
                <div className="contents sm:flex sm:items-center sm:gap-2">
                  {/* Copy */}
                  <CopyButton onClick={() => void handleCopyTemplate()} showLabel />

                  {/* Download Template */}
                  <Button onClick={() => void handleDownloadTemplate()} size="small">
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TemplateMetadata;