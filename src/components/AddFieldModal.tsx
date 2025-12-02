import React from "react";
import Button from "./shared/Button";
import Portal from "./shared/Portal";
import { useFieldContext } from "@/hooks/useFieldContext";
import { Field } from "@guido/types";
import { fieldValueToString } from "@guido/core";

interface AddFieldModalProps {
  edit?: boolean;
  newField: Field;
  setNewField: React.Dispatch<React.SetStateAction<Field>>;
  handleClose: () => void;
}

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
    else
      handleAddField(newField, () => {
        handleClose();
        setNewField({
          name: "",
          value: "",
          info: "",
          example: "",
          range: "",
          checked: false,
        });
      });
  };

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-surface-0 p-8 rounded-default shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto mx-4 border border-border">
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
                className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
              />
              <span className="text-xs text-text-secondary mt-1 block">
                Field identifier. Use dots for nested properties (e.g., <code className="bg-surface-2 px-1 rounded">Logging.Level</code>)
              </span>
            </>
          ) : (
            <span className="mt-1 block w-full px-3 py-2 border border-field-border bg-surface-2 rounded-default shadow-sm text-text-disabled">
              {newField.name}
            </span>
          )}
        </label>
        <label className="block mb-2 text-text-primary" htmlFor="field-value">
          Value:
          <input
            id="field-value"
            name="field-value"
            type="text"
            value={fieldValueToString(newField.value)}
            onChange={(e) =>
              setNewField({ ...newField, value: e.target.value })
            }
            placeholder="e.g., SQL or 8080"
            className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
          />
          <span className="text-xs text-text-secondary mt-1 block">
            Default or current value for this field
          </span>
        </label>
        <label className="block mb-2 text-text-primary" htmlFor="field-info">
          Info:
          <input
            id="field-info"
            name="field-info"
            type="text"
            value={newField.info}
            onChange={(e) => setNewField({ ...newField, info: e.target.value })}
            placeholder="Description of what this field does"
            className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
          />
          <span className="text-xs text-text-secondary mt-1 block">
            Description shown in tooltip (ℹ️ icon)
          </span>
        </label>
        <label className="block mb-2 text-text-primary" htmlFor="field-example">
          Example:
          <input
            id="field-example"
            name="field-example"
            type="text"
            value={newField.example}
            onChange={(e) =>
              setNewField({ ...newField, example: e.target.value })
            }
            placeholder="e.g., Server=localhost;Database=mydb;"
            className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
          />
          <span className="text-xs text-text-secondary mt-1 block">
            Example value shown in tooltip (📄 icon)
          </span>
        </label>
        <label className="block mb-2 text-text-primary" htmlFor="field-range">
          Range:
          <input
            id="field-range"
            name="field-range"
            type="text"
            value={newField.range}
            onChange={(e) =>
              setNewField({ ...newField, range: e.target.value })
            }
            placeholder="string, boolean, integer, string[], opt1||opt2, or regex"
            className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
          />
          <span className="text-xs text-text-secondary mt-1 block">
            Valid formats: <code className="bg-surface-2 px-1 rounded">string</code>, <code className="bg-surface-2 px-1 rounded">boolean</code>, <code className="bg-surface-2 px-1 rounded">integer</code>, <code className="bg-surface-2 px-1 rounded">integer(1..65535)</code>, <code className="bg-surface-2 px-1 rounded">url</code>, <code className="bg-surface-2 px-1 rounded">string[]</code>, <code className="bg-surface-2 px-1 rounded">opt1||opt2||opt3</code>, or a regex pattern
          </span>
        </label>
        <label className="block mb-2 text-text-primary" htmlFor="field-link">
          Link:
          <input
            id="field-link"
            name="field-link"
            type="text"
            value={newField.link}
            onChange={(e) => setNewField({ ...newField, link: e.target.value })}
            placeholder="https://docs.example.com/config"
            className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
          />
          <span className="text-xs text-text-secondary mt-1 block">
            URL to documentation. Clicking the ℹ️ icon opens this link
          </span>
        </label>
        <div className="flex justify-end mt-4 gap-4">
          <Button onClick={handleClose} type="primary-text">
            Cancel
          </Button>
          <Button onClick={onAddField}>{edit ? "Update" : "Add"} Field</Button>
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default AddFieldModal;
