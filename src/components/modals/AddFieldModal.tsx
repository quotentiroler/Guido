import React from "react";
import Button from "@/components/shared/Button";
import ModalShell from "./ModalShell";
import { useFieldContext } from "@/hooks/useFieldContext";
import { type Field } from "@quotentiroler/guido-types";
import { fieldValueToString } from "@quotentiroler/guido-core";
import { createEmptyField } from "@/utils/drafts";

interface AddFieldModalProps {
  edit?: boolean;
  newField: Field;
  setNewField: React.Dispatch<React.SetStateAction<Field>>;
  handleClose: () => void;
}

const INPUT_CLASS = "mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default";
const HINT_CLASS = "text-xs text-text-secondary mt-1 block";

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="bg-surface-2 px-1 rounded">{children}</code>
);

const EDITABLE_PROPERTIES: { key: "value" | "info" | "example" | "range" | "link"; label: string; placeholder: string; hint: React.ReactNode }[] = [
  { key: "value", label: "Value", placeholder: "e.g., SQL or 8080", hint: "Default or current value for this field" },
  { key: "info", label: "Info", placeholder: "Description of what this field does", hint: "Description shown in tooltip (ℹ️ icon)" },
  { key: "example", label: "Example", placeholder: "e.g., Server=localhost;Database=mydb;", hint: "Example value shown in tooltip (📄 icon)" },
  {
    key: "range",
    label: "Range",
    placeholder: "string, boolean, integer, string[], opt1||opt2, or regex",
    hint: (
      <>
        Valid formats: <Code>string</Code>, <Code>boolean</Code>, <Code>integer</Code>, <Code>integer(1..65535)</Code>, <Code>url</Code>, <Code>string[]</Code>, <Code>opt1||opt2||opt3</Code>, or a regex pattern
      </>
    ),
  },
  { key: "link", label: "Link", placeholder: "https://docs.example.com/config", hint: "URL to documentation. Clicking the ℹ️ icon opens this link" },
];

const AddFieldModal: React.FC<AddFieldModalProps> = ({
  edit,
  newField,
  setNewField,
  handleClose,
}) => {
  const { handleAddField, handleUpdateField } = useFieldContext();
  const onAddField = () => {
    if (edit) {
      handleUpdateField(newField);
      handleClose();
      return;
    }
    handleAddField(newField, () => {
      handleClose();
      setNewField(createEmptyField());
    });
  };

  return (
    <ModalShell panelClassName="bg-surface-0 p-8 rounded-default shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto mx-4 border border-border">
      <h2 className="text-xl font-bold mb-4 text-text-primary">
        {edit ? "Edit" : "Add"} Field
      </h2>
      <label className="block mb-2 text-text-primary" htmlFor="field-name">
        Name:
        {!edit ? (
          <>
            <input
              id="field-name"
              name="field-name"
              type="text"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              placeholder="e.g., DatabaseType or Server.Port"
              className={INPUT_CLASS}
            />
            <span className={HINT_CLASS}>
              Field identifier. Use dots for nested properties (e.g., <Code>Logging.Level</Code>)
            </span>
          </>
        ) : (
          <span className="mt-1 block w-full px-3 py-2 border border-field-border bg-surface-2 rounded-default shadow-sm text-text-disabled">
            {newField.name}
          </span>
        )}
      </label>
      {EDITABLE_PROPERTIES.map(({ key, label, placeholder, hint }) => (
        <label key={key} className="block mb-2 text-text-primary" htmlFor={`field-${key}`}>
          {label}:
          <input
            id={`field-${key}`}
            name={`field-${key}`}
            type="text"
            value={key === "value" ? fieldValueToString(newField.value) : newField[key]}
            onChange={(e) => setNewField({ ...newField, [key]: e.target.value })}
            placeholder={placeholder}
            className={INPUT_CLASS}
          />
          <span className={HINT_CLASS}>{hint}</span>
        </label>
      ))}
      <div className="flex justify-end mt-4 gap-4">
        <Button onClick={handleClose} type="primary-text">
          Cancel
        </Button>
        <Button onClick={onAddField}>{edit ? "Update" : "Add"} Field</Button>
      </div>
    </ModalShell>
  );
};

export default AddFieldModal;
