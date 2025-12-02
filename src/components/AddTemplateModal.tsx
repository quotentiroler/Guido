import React, { useState } from "react";
import Button from "./shared/Button";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { Template } from "@guido/types";

interface AddTemplateModalProps {
    handleClose: () => void;
    edit?: boolean;
}

const AddTemplateModal: React.FC<AddTemplateModalProps> = ({ handleClose, edit }) => {
    const { updateTemplate } = useTemplateContext();
    const [newTemplate, setNewTemplate] = useState<Template>({
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewTemplate((prevTemplate) => ({ ...prevTemplate, [name]: value }));
    };

    const handleSaveTemplate = () => {
        updateTemplate(newTemplate);
        handleClose();
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-surface-0 p-6 rounded-default shadow-lg w-full max-w-xl h-3/4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text-primary"> {edit ? "Edit" : "Add"} Template</h2>
                    <Button onClick={handleClose} type="secondary-text" size="small">
                        Close
                    </Button>
                </div>
                <div className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 ">
                            Template Name
                        </label>
                        <input
                            type="text"
                            id="template-name"
                            name="name"
                            value={newTemplate.name}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-fileName" className="block text-sm font-medium text-gray-700 ">
                            File Name
                        </label>
                        <input
                            type="text"
                            id="template-fileName"
                            name="fileName"
                            value={newTemplate.fileName}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-version" className="block text-sm font-medium text-gray-700 ">
                            Version
                        </label>
                        <input
                            type="text"
                            id="template-version"
                            name="version"
                            value={newTemplate.version}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-description" className="block text-sm font-medium text-gray-700 ">
                            Description
                        </label>
                        <textarea
                            id="template-description"
                            name="description"
                            value={newTemplate.description}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full h-24 bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-owner" className="block text-sm font-medium text-gray-700 ">
                            Owner
                        </label>
                        <input
                            type="text"
                            id="template-owner"
                            name="owner"
                            value={newTemplate.owner}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-application" className="block text-sm font-medium text-gray-700 ">
                            Application
                        </label>
                        <input
                            type="text"
                            id="template-application"
                            name="application"
                            value={newTemplate.application}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-command" className="block text-sm font-medium text-gray-700 ">
                            Command
                        </label>
                        <input
                            type="text"
                            id="template-command"
                            name="command"
                            value={newTemplate.command}
                            onChange={handleChange}
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="template-docs" className="block text-sm font-medium text-gray-700 ">
                            Documentation URL
                        </label>
                        <input
                            type="url"
                            id="template-docs"
                            name="docs"
                            value={newTemplate.docs || ''}
                            onChange={handleChange}
                            placeholder="https://docs.example.com/..."
                            className="mt-1 p-2 border rounded-default w-full bg-surface-0 text-text-primary"
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-8 gap-4">
                    <Button onClick={handleClose} type="primary-text">
                        Cancel
                    </Button>
                    <Button onClick={handleSaveTemplate} type="primary">
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddTemplateModal;