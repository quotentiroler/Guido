import React, { useState } from "react";
import Button from "./shared/Button";
import SettingsFieldsList from "./SettingsFieldsList";
import { useFieldContext } from "@/hooks/useFieldContext";
import { useAppContext } from "@/hooks/useAppContext";
import { Field } from "@guido/types";
import AddFieldModal from "./AddFieldModal";
import { useTemplateContext } from "@/hooks/useTemplateContext";

const FieldsTab: React.FC = () => {
  const { handleDeleteFields } = useFieldContext();
  const { fields } = useTemplateContext();
  const { isExpertMode } = useAppContext();
  const [showFieldModal, setShowFieldModal] = useState(false);
    const [newField, setNewField] = useState<Field>({
      name: "",
      value: "",
      info: "",
      example: "",
      range: "",
    });
  return (
    <>      {showFieldModal && (
        <AddFieldModal
          newField={newField}
          setNewField={setNewField}
          handleClose={() => setShowFieldModal(false)}
        />
      )}
      {isExpertMode && (
        <div className="flex justify-between items-center gap-4 my-4">
          {/* Left part */}
          <div className="flex-1 flex justify-end">
            <Button
              onClick={() => setShowFieldModal(true)}
              type="secondary"
              size="small"
            >
              Add Field
            </Button>
          </div>
        
          {/* Right part */}
          <div className="flex-1 flex justify-start">
            {fields && fields.length > 0 && (
              <Button
                onClick={handleDeleteFields}
                type="error-text"
                size="small"
              >
                Delete All Fields
              </Button>
            )}
          </div>
        </div>
      )}
      <SettingsFieldsList fields={fields || []} />
    </>
  );
};

export default FieldsTab;