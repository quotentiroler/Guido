import { type Rule, type Field, type FieldValue, type Template } from "@guido/types";

/**
 * Represents a recursively nested settings object.
 * Values can be primitives, arrays of primitives, or nested objects.
 */
export type NestedSettings = {
  [key: string]: FieldValue | NestedSettings | NestedSettings[] | null;
};

/**
 * JSON-serializable value types for download functions.
 */
export type JsonSerializable = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonSerializable[] 
  | { [key: string]: JsonSerializable };

/**
 * File System Access API types for modern browsers.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */
interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FilePickerAcceptType {
  description: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface FileSystemAccessWindow extends Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

/**
 * File type configuration for saveBlob helper.
 */
interface FileTypeConfig {
  mimeType: string;
  description: string;
  extensions: string[];
}

/**
 * Common file type configurations.
 */
const FILE_TYPES: Record<string, FileTypeConfig> = {
  json: { mimeType: 'application/json', description: 'JSON Files', extensions: ['.json'] },
  yaml: { mimeType: 'application/x-yaml', description: 'YAML Files', extensions: ['.yaml', '.yml'] },
  csv: { mimeType: 'text/csv', description: 'CSV Files', extensions: ['.csv'] },
  text: { mimeType: 'text/plain', description: 'Text Files', extensions: ['.txt'] },
};

/**
 * Generic blob saver that uses File System Access API when available,
 * with fallback to traditional download link.
 * 
 * @param blob - The blob to save
 * @param filename - Suggested filename
 * @param fileType - File type configuration
 * @returns Promise with success/failure message
 */
const saveBlob = async (
  blob: Blob, 
  filename: string, 
  fileType: FileTypeConfig
): Promise<string> => {
  // Check if the File System Access API is available
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as FileSystemAccessWindow).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: fileType.description,
          accept: { [fileType.mimeType]: fileType.extensions },
        }],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return `File <code>${filename}</code> saved successfully.`;
    } catch (error) {
      console.error('Error saving file:', error);
      return `Failed to save file <code>${filename}</code>`;
    }
  } else {
    // Fallback for browsers that do not support the File System Access API
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return `File <code>${filename}</code> downloaded successfully.`;
    } catch (error) {
      console.error('Error downloading file:', error);
      return `Failed to download file <code>${filename}</code>`;
    }
  }
};

import Papa from 'papaparse';

// Import from @guido/core for local use
import {
  detectFormat,
  fieldsToNestedObject,
  flattenObject,
  formatMeta,
  parseSettings,
  serializeFields,
} from '@guido/core';

export const loadTemplateFromPublicFolder = async (
  templateName: string,
  removeTemplate: () => void,
  updateTemplate: (template: Template) => void,
): Promise<string> => {
  try {
    if (templateName === "") {
      removeTemplate();
      return "No template selected.";
    }

    const templateResponse = await fetch(
      `/Guido/templates/${templateName}.guido.json`
    );

    const templateData = await templateResponse.json() as Record<string, unknown>;

    const templateFields = templateData.fields as Field[] | undefined;
    if (!templateFields || !Array.isArray(templateFields)) {
      throw new Error('Invalid template format: missing fields');
    }

    const updatedTemplate = {
      ...templateData,
      fields: templateFields.map((field: Field) => ({
        ...field,
        value: Array.isArray(field.value)
          ? JSON.stringify(field.value)
          : field.value,
      })),
    };

    updateTemplate(updatedTemplate as Template);
    return `Template loaded successfully: ${templateName}`;

  } catch (error) {
    if (error instanceof SyntaxError) {
      return `Template not found: ${templateName}`;
    } else if (error instanceof Error) {
      return `Failed to load template: ${error.message}`;
    } else {
      return "Failed to load template: Unknown error";
    }
  }
};

const csvToJson = (csv: string): Record<string, unknown> => {
  const delimitersToTry = [",", "\t", " "]; // Comma, tab, and space delimiters
  let result;
  let errorMessage = "";

  for (const delimiter of delimitersToTry) {
    result = Papa.parse(csv, { header: true, delimiter, skipEmptyLines: true });

    if (!result.errors.length) {
      // Rows keyed 1..n, so flattening yields the same "1.column" names as before.
      return Object.fromEntries(result.data.map((row, index) => [String(index + 1), row]));
    }

    // Log errors for this attempt
    errorMessage += `Failed to parse CSV with delimiter "${delimiter}":\n`;
    errorMessage += result.errors.map((error) => error.message).join("\n") + "\n\n";
  }

  // If all attempts fail, throw an error with the accumulated messages
  throw new Error(`Failed to parse CSV:\n${errorMessage}`);
};

/**
 * Core parsing logic - converts text content to a Template.
 * Shared between parseSettingsFromFile and parseSettingsFromText.
 */
const parseContentToTemplate = (
  textContent: string,
  fileName: string,
  fileExtension: string
): Template | null => {
  try {
    const flattenedSettings =
      fileExtension.toLowerCase() === '.csv'
        ? flattenObject(csvToJson(textContent))
        : parseSettings(textContent, detectFormat(fileExtension) ?? 'json');

    const template: Template = {
      name: "",
      fields: Object.keys(flattenedSettings).map((key) => ({
        name: key,
        value: (Array.isArray(flattenedSettings[key])
          ? JSON.stringify(flattenedSettings[key])
          : flattenedSettings[key]) as FieldValue,
        info: "",
        example: "",
        range: "",
      })),
      fileName: fileName,
      version: "",
      description: "",
      owner: "",
      ruleSets: [{
        name: "Default",
        description: "Default rule set",
        tags: [],
        rules: [],
      }],
    };

    return template;
  } catch (error) {
    console.error("Failed to parse settings:", error);
    return null;
  }
};

/**
 * Detect file format from content when extension is unknown
 */
const detectFileExtension = (content: string): string => {
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    return ".json";
  } else if (content.includes(":\n") || content.includes(": ")) {
    return ".yaml";
  } else if (content.includes("=")) {
    return ".properties";
  }
  return ".json";
};

export const parseSettingsFromFile = async (
  event: React.ChangeEvent<HTMLInputElement> | null,
  textContent?: string
): Promise<Template | null> => {
  let fileContent: string;
  let fileName = "clipboard-settings";
  let fileExtension: string;

  if (textContent) {
    // Parse from clipboard text
    fileContent = textContent;
    fileExtension = detectFileExtension(textContent);
  } else if (event) {
    // Parse from file upload
    const file = event.target.files?.[0];
    if (!file) {
      console.error("No file selected.");
      return null;
    }
    fileContent = await file.text();
    fileName = file.name;
    fileExtension = file.name.substring(file.name.lastIndexOf("."));
  } else {
    console.error("No input provided.");
    return null;
  }

  return parseContentToTemplate(fileContent, fileName, fileExtension);
};

/**
 * Parse settings from text content with a known filename
 * Useful for importing config files extracted from tarballs
 */
export const parseSettingsFromText = (
  textContent: string,
  fileName: string
): Template | null => {
  const fileExtension = fileName.includes('.') 
    ? fileName.substring(fileName.lastIndexOf("."))
    : '.json';

  return parseContentToTemplate(textContent, fileName, fileExtension);
};

const downloadJson = async (data: JsonSerializable, filename: string): Promise<string> => {
  const fileData = JSON.stringify(data, null, 2);
  const blob = new Blob([fileData], { type: FILE_TYPES.json.mimeType });
  return saveBlob(blob, filename, FILE_TYPES.json);
};

/**
 * Fields hold array values as JSON strings while being edited; restore the real
 * array before serializing so the output is a list, not a quoted string.
 */
const restoreArrayValues = (fields: Field[]): Field[] =>
  fields.map((field) => {
    if (typeof field.value !== 'string') return field;
    try {
      const parsed: unknown = JSON.parse(field.value);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return { ...field, value: parsed };
      }
    } catch {
      // Not JSON - keep the string as typed.
    }
    return field;
  });

export const saveSettings = async (fields: Field[], filename?: string, returnText = false): Promise<string> => {
  if (fields.length === 0) {
    return "Please check some fields to save!";
  }

  const targetName = filename ?? "appsettings.instance.json";
  const exportFields = restoreArrayValues(fields);

  // CSV is tabular rather than key/value, so it stays outside the format registry.
  if (targetName.toLowerCase().endsWith('.csv')) {
    const rows = fieldsToNestedObject(exportFields.map((field) => ({ ...field, checked: true })));
    if (returnText) return Papa.unparse(Object.values(rows) as Record<string, unknown>[]);
    return downloadCsv(rows as Record<string, JsonSerializable>, targetName);
  }

  const format = detectFormat(targetName);
  if (!format) {
    return "File type not supported.";
  }

  const content = serializeFields(exportFields, format, { onlyChecked: false });
  if (returnText) {
    return content;
  }

  const meta = formatMeta(format);
  const blob = new Blob([content], { type: meta.mimeType });
  return saveBlob(blob, targetName, {
    mimeType: meta.mimeType,
    description: meta.description,
    extensions: meta.extensions,
  });
};

const downloadCsv = async (data: Record<string, JsonSerializable>, filename: string): Promise<string> => {
  const dataArray = Object.keys(data).map(key => data[key]);
  const csv = Papa.unparse(dataArray as Record<string, unknown>[]);
  const blob = new Blob([csv], { type: FILE_TYPES.csv.mimeType });
  return saveBlob(blob, filename, FILE_TYPES.csv);
}

export const saveSettingsFields = (fields: Field[]) => {
   
  const cleanedFields = fields.map(({ checked, ...rest }) => rest);
  void downloadJson(cleanedFields, "appsettings.fields.json");
};
export const saveSettingsRules = (rules: Rule[]) => {
  // Serialize to JSON and back to strip type information
  void downloadJson(JSON.parse(JSON.stringify({ rules })) as JsonSerializable, "appsettings.rules.json");
};


export const downloadTemplate = async (template: Template | null) => {
  if (!template) {
    console.error("No template to download.");
    return "No template to download.";
  }
  const cleanedTemplate = {
    ...template,
    fields: template.fields.map((field) => ({
      ...field,
      // Keep value as-is (already the correct type)
      value: field.value,
    })),
  };
  // Serialize to JSON and back to strip type information
  return downloadJson(JSON.parse(JSON.stringify(cleanedTemplate)) as JsonSerializable, (template.name || "unnamed") + ".guido.json");
}