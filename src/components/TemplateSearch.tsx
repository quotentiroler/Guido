import React, { useState, useRef, useEffect } from "react";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { useAlert } from "@/hooks/useAlert";
import { useAI } from "@/hooks/useAI";
import { useTheme } from "@/hooks/useTheme";
import useRegistry, { SearchResultItem, NoGuidoTemplatesError, AlternativeFile } from "@/hooks/useRegistry";
import SearchInput from "./SearchInput";
import AIChatInput from "./AIChatInput";
import DropdownItems from "./SearchDropdown";
import { Template } from "@guido/types";
import { mergeTemplates } from "@guido/core";
import { parseSettingsFromText } from "@/utils/settingsUtils";

interface TemplateSearchProps {
  showAIChat?: boolean;
}

const TemplateSearch: React.FC<TemplateSearchProps> = ({ showAIChat = true }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<SearchResultItem | undefined>(undefined);
  const [packageVersions, setPackageVersions] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [alternativeFiles, setAlternativeFiles] = useState<{ files: AlternativeFile[], tarball: ArrayBuffer, isRawContent: boolean } | null>(null);
  const { 
    isLoading, 
    searchResults, 
    searchAllRegistries, 
    getPackageVersions,
    fetchPackageTemplates,
    extractFileFromTarball
  } = useRegistry();
  const { alert, choice } = useAlert();
  const { updateTemplate, template, isEmpty } = useTemplateContext();
  const { isConfigured } = useAI();
  const { secretSpaceMode } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPackage(undefined);
    setPackageVersions([]);
    setShowDropdown(false);
    const term = e.target.value;
    setSearchTerm(term);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!searchTerm || searchTerm.length < 1) {
        setShowDropdown(false);
        return;
      }
      // Reset all selection states and perform a fresh search
      setSelectedPackage(undefined);
      setPackageVersions([]);
      setTemplates([]);
      setAlternativeFiles(null);
      setShowDropdown(true);
      void searchAllRegistries(searchTerm);
    }
  };

  const handleSelectPackage = async (pkg: SearchResultItem) => {
    // For built-in templates, skip version selection and load directly
    if (pkg.source === 'builtIn') {
      try {
        const templates = await fetchPackageTemplates(pkg);
        if (templates.length === 1) {
          // Single template - load it directly
          handleSelectTemplate(templates[0]);
        } else if (templates.length > 1) {
          // Multiple templates - show template picker
          setTemplates(templates);
          setShowDropdown(true);
        } else {
          alert("No template found");
        }
      } catch (error) {
        alert("Failed to load built-in template: " + String(error));
      }
      return;
    }
    
    setSelectedPackage(pkg);
    // Fetch versions for this package
    const versions = await getPackageVersions(pkg);
    setPackageVersions(versions);
  };

  const handleSelectVersion = async (version: string) => {
    if (!selectedPackage) return;
    try {
      setShowDropdown(false);
      setAlternativeFiles(null);
      const templates = await fetchPackageTemplates(selectedPackage, version);
      if (templates.length > 0) {
        setShowDropdown(true);
        setSelectedPackage(undefined);
        setPackageVersions([]);
        setTemplates(templates);
      } else {
        alert("No templates found for the selected version.");
      }
    } catch (error) {
      if (error instanceof NoGuidoTemplatesError && error.alternatives.length > 0) {
        // Show alternative files that can be imported as settings
        setAlternativeFiles({ 
          files: error.alternatives, 
          tarball: error.tarballData,
          isRawContent: error.isRawContent 
        });
        setShowDropdown(true);
        setSelectedPackage(undefined);
        setPackageVersions([]);
      } else {
        alert("Failed to load templates. \n" + String(error));
        setSelectedPackage(undefined);
        setPackageVersions([]);
      }
    }
  };

  const handleImportAlternativeFile = async (file: AlternativeFile) => {
    if (!alternativeFiles) return;
    
    try {
      let content: string | null = null;
      
      // If the file has a direct download URL (e.g., from GitHub), fetch it directly
      if (file.downloadUrl) {
        const response = await fetch(file.downloadUrl);
        if (response.ok) {
          content = await response.text();
        }
      } else {
        // Otherwise, extract from the tarball/raw content
        content = await extractFileFromTarball(
          alternativeFiles.tarball, 
          file.path,
          alternativeFiles.isRawContent
        );
      }
      
      if (!content) {
        alert("Failed to extract file content");
        return;
      }

      const template = parseSettingsFromText(content, file.name);
      if (template) {
        updateTemplate(template);
        alert(`Imported settings from ${file.name}`);
        setSearchTerm("");
        setTemplates([]);
        setAlternativeFiles(null);
        setShowDropdown(false);
      } else {
        alert("Failed to parse settings from the file");
      }
    } catch (error) {
      alert("Failed to import file: " + String(error));
    }
  };
  
  const handleSelectTemplate = (incomingTemplate: Template) => {
    // Check if current template has content
    if (!isEmpty()) {
      const currentName = template.name || 'current template';
      const incomingName = incomingTemplate.name || 'imported template';
      
      choice(
        `Do you want to replace "${currentName}" with "${incomingName}" or merge them?`,
        [
          { label: `Replace with "${incomingName}"`, value: 'replace', type: 'primary' },
          { label: `Merge "${incomingName}" into "${currentName}"`, value: 'merge', type: 'secondary' }
        ],
        (value) => {
          if (value === 'replace') {
            updateTemplate(incomingTemplate);
          } else if (value === 'merge') {
            const mergedTemplate = mergeTemplates(template, incomingTemplate);
            updateTemplate(mergedTemplate);
          }
          setSearchTerm("");
          setTemplates([]);
          setShowDropdown(false);
        }
      );
    } else {
      // No existing template, just load
      updateTemplate(incomingTemplate);
      setSearchTerm("");
      setTemplates([]);
      setShowDropdown(false);
    }
  };

  const handleFocus = () => {
    if (searchTerm && searchTerm.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSelectedPackage(undefined);
    setPackageVersions([]);
    setTemplates([]);
    setAlternativeFiles(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedPackage(undefined);
        setPackageVersions([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative rounded-default border p-4 bg-surface-0 space-y-4 mb-4">
      {/* AI Chat Input - only show in secret space mode when configured and showAIChat is true */}
      {isConfigured && secretSpaceMode && showAIChat && (
        <>
          <AIChatInput />
          <div className="border-t border-border" />
        </>
      )}
      
      {/* Registry Search */}
      <SearchInput
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        inputRef={inputRef}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
      {isLoading ? (
        <div className="loader">Loading...</div>
      ) : (
        showDropdown && (
          <ul
            ref={dropdownRef}
            className="absolute left-0 right-0 mt-2 bg-surface-0 border rounded shadow-lg z-10 max-h-80 overflow-y-auto"
          >
            {alternativeFiles && alternativeFiles.files.length > 0 ? (
              <>
                <li className="p-3 bg-surface-1 border-b text-text-secondary text-sm">
                  <div className="font-medium text-text-primary mb-1">No Guido templates found</div>
                  <div>The following config files can be imported as settings:</div>
                </li>
                {alternativeFiles.files.map((file, index) => (
                  <li
                    key={index}
                    className="border-b p-2 hover:bg-surface-hover cursor-pointer text-text-primary flex items-center justify-between group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-xs text-text-tertiary truncate">{file.path}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleImportAlternativeFile(file)}
                      className="ml-2 p-1.5 hover:bg-primary-default hover:text-white rounded transition-colors"
                      title="Import as settings"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </>
            ) : templates.length > 0 ? (
              templates.map((template, index) => (
                <li
                  key={index}
                  className="border-b  p-2 hover:bg-surface-hover cursor-pointer text-text-primary"
                  onClick={() => handleSelectTemplate(template)}
                >
                  {template.name}
                </li>
              ))
            ) : (
              <DropdownItems
                selectedPackage={selectedPackage}
                packageVersions={packageVersions}
                packages={searchResults}
                onSelectPackage={handleSelectPackage}
                onSelectVersion={handleSelectVersion}
              />
            )}
          </ul>
        )
      )}
    </div>
  );
};

export default TemplateSearch;