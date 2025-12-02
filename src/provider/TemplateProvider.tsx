import { Field, RuleSet, Template, isTemplate } from '@guido/types';
import { mergeTemplates, createDefaultRuleSet } from '@guido/core';
import React, { useState, ReactNode, ReactElement, useEffect, useCallback } from 'react';
import { TemplateContext } from '@/context/TemplateContext';
import localforage from 'localforage';
import { useAlert } from '@/hooks/useAlert';
import useRegistry from '@/hooks/useRegistry';

// Ensure template has at least one ruleset (add default if empty)
const ensureRuleSets = (template: Template): Template => {
  if (!template.ruleSets || template.ruleSets.length === 0) {
    return {
      ...template,
      ruleSets: [createDefaultRuleSet()]
    };
  }
  return template;
};

export const TemplateProvider: React.FC<{ children: ReactNode }> = ({ children }): ReactElement => {

  const [ruleSets, setRuleSets] = useState<RuleSet[]>([createDefaultRuleSet()]);
  const [selectedRuleSetIndex, setSelectedRuleSetIndex] = useState<number>(0);
  const [fields, setFields] = useState<Field[]>([]);
  const { alert, confirm, choice } = useAlert();
  const { fetchTarballFromUrl } = useRegistry();
  
  const emptyTemplate: Template = React.useMemo(() => ({
    ruleSets: [createDefaultRuleSet()], 
    fields: [],
    name: '',
    fileName: '',
    version: '',
    description: '',
    owner: ''
  }), []);
  
  const [template, setTemplate] = useState<Template>(emptyTemplate);
  
  const isEmpty = useCallback((newTemplate?: Template) => {
    if (newTemplate) {
      const hasRules = newTemplate.ruleSets?.some(rs => rs.rules.length > 0) ?? false;
      return newTemplate.name === '' && newTemplate.fileName === '' && newTemplate.version === '' && newTemplate.description === '' && newTemplate.owner === '' && !hasRules;
    }
    else {
      const hasRules = ruleSets.some(rs => rs.rules.length > 0);
      return template.name === '' && template.fileName === '' && template.version === '' && template.description === '' && template.owner === '' && !hasRules;
    }
  }, [ruleSets, template]);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const storedTemplate = await localforage.getItem<Template>('template');
        if (storedTemplate && !isEmpty(storedTemplate)) {
          const normalized = ensureRuleSets(storedTemplate);
          setTemplate(normalized);
          setRuleSets(normalized.ruleSets);
          setSelectedRuleSetIndex(0);
          setFields((normalized.fields || []).map((field) => ({
            ...field,
            value: Array.isArray(field.value) ? JSON.stringify(field.value) : field.value,
          })));
        }
        else {
          const response = await fetch('/Guido/templates/registry.guido.json');
          if (!response.ok) {
            throw new Error('Failed to fetch the default template file.');
          }
          const jsonData: unknown = await response.json();
          if (!isTemplate(jsonData)) {
            throw new Error('Invalid template format');
          }
          const normalized = ensureRuleSets(jsonData);
          setTemplate(normalized);
          setRuleSets(normalized.ruleSets);
          setSelectedRuleSetIndex(0);
          setFields(normalized.fields.map((field: Field) => ({
            ...field,
            value: Array.isArray(field.value) ? JSON.stringify(field.value) : field.value,
          })));
        }
      } catch (error) {
        console.error('Error loading template from localforage:', error);
      }
    };

    void loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const updateLocalforageTemplate = async () => {
      try {
        const updatedTemplate: Template = {
          ...template,
          ruleSets,
          fields: fields.map((field) => ({
            ...field,
            value: field.value,
          })),
        };

        const currentTemplate = await localforage.getItem<Template>('template');
        if (JSON.stringify(currentTemplate) !== JSON.stringify(updatedTemplate)) {
          await localforage.setItem('template', updatedTemplate);
        }
      } catch (error) {
        console.error('Error updating template in localforage:', error);
      }
    };

    if (template) {
      void updateLocalforageTemplate();
    }
  }, [ruleSets, fields, template]);

  useEffect(() => {
    let hasRetried = false;

    const loadTemplateFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const packageUrl = urlParams.get("package");
      const templateUrl = urlParams.get("template");

      const url = packageUrl || templateUrl;

      if (url && !hasRetried) {
        try {
          let loadedTemplate: unknown;

          if (templateUrl) {
            const response = await fetch(templateUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch template from URL: ${templateUrl}`);
            }
            loadedTemplate = await response.json() as unknown;
          } else if (packageUrl) {
            loadedTemplate = await fetchTarballFromUrl(packageUrl);
          }

          if (!isTemplate(loadedTemplate)) {
            throw new Error('Invalid template format from URL');
          }
          updateTemplate(loadedTemplate);
          alert("Template loaded successfully from URL");
        } catch (error) {
          console.error("Error loading template from URL:", error);

          if (!hasRetried) {
            hasRetried = true;
            confirm(
              "Failed to load template from URL. Press Confirm to retry or Cancel to stop.",
              () => {
                window.location.reload();
              },
              () => {
                window.location.search = "";
              }
            );
          }
        }
      }
    };

    void loadTemplateFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeTemplate = useCallback(() => {
    setTemplate(emptyTemplate);
    setRuleSets([createDefaultRuleSet()]);
    setSelectedRuleSetIndex(0);
    setFields([]);
    void localforage.removeItem('template');
  }, [emptyTemplate]);

  const updateTemplate = useCallback((newTemplate: Template) => {
    const normalized = ensureRuleSets(newTemplate);
    setTemplate(normalized);
    setRuleSets(normalized.ruleSets);
    setSelectedRuleSetIndex(0);
    setFields(normalized.fields || []);
    void localforage.setItem('template', normalized);
  }, []);

  const loadTemplateFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result;
          if (content) {
            const parsed: unknown = JSON.parse(content as string);
            if (!parsed || typeof parsed !== 'object' || !('fields' in parsed) || !Array.isArray((parsed as { fields: unknown }).fields)) {
              alert('Invalid template format');
              return;
            }
            const importedTemplate = parsed as Template;
            const processedTemplate: Template = {
              ...importedTemplate,
              fields: importedTemplate.fields.map((field) => ({
                ...field,
                value: Array.isArray(field.value) ? JSON.stringify(field.value) : field.value,
              })),
            };
            
            // Check if current template has content
            if (!isEmpty()) {
              const currentName = template.name || 'current template';
              const incomingName = processedTemplate.name || 'imported template';
              
              choice(
                `Do you want to replace "${currentName}" with "${incomingName}" or merge them?`,
                [
                  { label: `Replace with "${incomingName}"`, value: 'replace', type: 'primary' },
                  { label: `Merge "${incomingName}" into "${currentName}"`, value: 'merge', type: 'secondary' }
                ],
                (value) => {
                  if (value === 'replace') {
                    updateTemplate(processedTemplate);
                  } else if (value === 'merge') {
                    const mergedTemplate = mergeTemplates(template, processedTemplate);
                    updateTemplate(mergedTemplate);
                  }
                }
              );
            } else {
              // No existing template, just load
              updateTemplate(processedTemplate);
            }
          }
        } catch (error) {
          console.error('Error loading template from file:', error);
          alert('Error loading template from file');
        }
      };
      reader.readAsText(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  }, [alert, choice, isEmpty, template, updateTemplate]);

  return (
    <TemplateContext.Provider
      value={{
        isEmpty,
        template,
        updateTemplate,
        ruleSets,
        setRuleSets,
        selectedRuleSetIndex,
        setSelectedRuleSetIndex,
        fields,
        setFields,
        loadTemplateFromFile,
        removeTemplate,
      }}
    >
      {children}
    </TemplateContext.Provider>
  );
};
