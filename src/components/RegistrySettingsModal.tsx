import React, { useState, useRef, useEffect } from "react";
import useRegistry from "@/hooks/useRegistry";
import { RegistryDefinition } from "@guido/types";
import { getBuiltInTemplates, verifyBuiltInTemplates } from "@/utils/builtInTemplates";
import Button from "./shared/Button";
import FileInput, { FileInputRef } from "./shared/FileInput";

interface RegistrySettingsModalProps {
  onClose: () => void;
}

type RegistryStatus = 'loaded' | 'loading' | 'error' | 'disabled';

interface RegistryStatusBadgeProps {
  status: RegistryStatus;
  name?: string;
}

const RegistryStatusBadge: React.FC<RegistryStatusBadgeProps> = ({ status, name }) => {
  const colors = {
    loaded: 'bg-validation-success-bg text-validation-success-text',
    loading: 'bg-validation-warning-bg text-validation-warning-text',
    error: 'bg-validation-error-bg text-validation-error-text',
    disabled: 'bg-surface-3 text-text-disabled',
  };
  const labels = {
    loaded: '✓ Connected',
    loading: '⏳ Loading...',
    error: '✗ Error',
    disabled: '○ Disabled',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status]}`} title={name}>
      {labels[status]}
    </span>
  );
};

const RegistrySettingsModal: React.FC<RegistrySettingsModalProps> = ({ onClose }) => {
  const {
    isGitHubEnabled,
    isNpmEnabled,
    isFhirEnabled,
    isBuiltInEnabled,
    customRegistryUrl,
    customRegistries,
    registryDefinitions,
    customRegistryDefinition,
    isLoadingDefinitions,
    setIsGitHubEnabled,
    setIsNpmEnabled,
    setIsFhirEnabled,
    setIsBuiltInEnabled,
    addCustomRegistry,
    removeCustomRegistry,
  } = useRegistry();

  const [newRegistryUrl, setNewRegistryUrl] = useState("");
  const [isAddingRegistry, setIsAddingRegistry] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [builtInTemplateCount, setBuiltInTemplateCount] = useState(getBuiltInTemplates().length);
  const [builtInTemplatesVerified, setBuiltInTemplatesVerified] = useState(false);
  const fileInputRef = useRef<FileInputRef>(null);

  // Verify built-in templates on mount
  useEffect(() => {
    if (isBuiltInEnabled) {
      verifyBuiltInTemplates().then(verified => {
        setBuiltInTemplateCount(verified.length);
        setBuiltInTemplatesVerified(true);
      }).catch(() => {
        setBuiltInTemplateCount(0);
        setBuiltInTemplatesVerified(true);
      });
    }
  }, [isBuiltInEnabled]);

  const getBuiltInStatus = (type: 'npm' | 'github' | 'simplifier', isEnabled: boolean): RegistryStatus => {
    if (!isEnabled) return 'disabled';
    if (isLoadingDefinitions) return 'loading';
    return registryDefinitions.has(type) ? 'loaded' : 'error';
  };

  const getBuiltInTemplatesStatus = (): RegistryStatus => {
    if (!isBuiltInEnabled) return 'disabled';
    if (!builtInTemplatesVerified) return 'loading';
    return builtInTemplateCount > 0 ? 'loaded' : 'error';
  };

  const handleAddRegistry = async () => {
    if (!newRegistryUrl.trim()) return;

    setIsAddingRegistry(true);
    setAddError(null);

    try {
      await addCustomRegistry(newRegistryUrl.trim());
      setNewRegistryUrl("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to add registry');
    } finally {
      setIsAddingRegistry(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      // Validate it has required fields
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid registry definition: not an object');
      }
      const definition = parsed as Record<string, unknown>;
      if (typeof definition.name !== 'string' || typeof definition.baseUrl !== 'string' || !definition.api) {
        throw new Error('Invalid registry definition: missing required fields (name, baseUrl, api)');
      }

      await addCustomRegistry(definition.baseUrl, definition as unknown as RegistryDefinition);
      setAddError(null);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to import registry file');
    }

    // Reset file input
    fileInputRef.current?.reset();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-surface-0 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-xl font-bold text-text-primary">
              Registry Settings
            </h2>
            <span className="text-sm text-text-disabled">
              {isLoadingDefinitions ? 'loading...' : `${registryDefinitions.size} loaded`}
            </span>
          </div>
        
          <div className="overflow-y-auto flex-1">

        {/* Built-in Registries */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            Built-in Registries
          </h3>
          <div className="space-y-3">
            <label htmlFor="registry-github" className="flex items-center justify-between p-2 rounded-default hover:bg-surface-hover">
              <div className="flex items-center space-x-3">
                <input
                  id="registry-github"
                  name="registry-github"
                  type="checkbox"
                  checked={isGitHubEnabled}
                  onChange={(e) => setIsGitHubEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-text-primary">GitHub</span>
              </div>
              <RegistryStatusBadge
                status={getBuiltInStatus('github', isGitHubEnabled)}
                name={registryDefinitions.get('github')?.name}
              />
            </label>
            <label htmlFor="registry-npm" className="flex items-center justify-between p-2 rounded-default hover:bg-surface-hover">
              <div className="flex items-center space-x-3">
                <input
                  id="registry-npm"
                  name="registry-npm"
                  type="checkbox"
                  checked={isNpmEnabled}
                  onChange={(e) => setIsNpmEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-text-primary">NPM</span>
              </div>
              <RegistryStatusBadge
                status={getBuiltInStatus('npm', isNpmEnabled)}
                name={registryDefinitions.get('npm')?.name}
              />
            </label>
            <label htmlFor="registry-simplifier" className="flex items-center justify-between p-2 rounded-default hover:bg-surface-hover">
              <div className="flex items-center space-x-3">
                <input
                  id="registry-simplifier"
                  name="registry-simplifier"
                  type="checkbox"
                  checked={isFhirEnabled}
                  onChange={(e) => setIsFhirEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-text-primary">Simplifier</span>
              </div>
              <RegistryStatusBadge
                status={getBuiltInStatus('simplifier', isFhirEnabled)}
                name={registryDefinitions.get('simplifier')?.name}
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-default hover:bg-surface-hover">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isBuiltInEnabled}
                  onChange={(e) => setIsBuiltInEnabled(e.target.checked)}
                  className="rounded"
                />
                <div>
                  <span className="text-text-primary">Built-in Templates</span>
                  <span className="text-xs text-text-disabled ml-2">({builtInTemplateCount} bundled)</span>
                </div>
              </div>
              <RegistryStatusBadge
                status={getBuiltInTemplatesStatus()}
                name="Bundled templates"
              />
            </label>
          </div>
        </div>

        {/* Custom Registries */}
        <div className="mb-6 pt-4 border-t border-strong">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            Custom Registries
          </h3>

          {/* Legacy single custom URL (for backward compatibility) */}
          {customRegistryUrl && !customRegistries?.length && (
            <div className="mb-3 p-3 bg-surface-2 rounded-default border border-strong">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {customRegistryDefinition?.name || 'Custom Registry'}
                  </p>
                  <p className="text-xs text-text-disabled truncate">
                    {customRegistryUrl}
                  </p>
                </div>
                <RegistryStatusBadge
                  status={customRegistryDefinition ? 'loaded' : 'error'}
                />
              </div>
            </div>
          )}

          {/* List of custom registries */}
          {customRegistries?.map((registry, index) => (
            <div
              key={registry.url || index}
              className="mb-2 p-3 bg-surface-2 rounded-default border border-strong"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {registry.definition?.name || 'Custom Registry'}
                  </p>
                  <p className="text-xs text-text-disabled truncate">
                    {registry.url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RegistryStatusBadge
                    status={registry.definition ? 'loaded' : 'error'}
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomRegistry(registry.url)}
                    className="text-error-600 hover:text-error-700 text-sm px-2"
                    title="Remove registry"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add new registry */}
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newRegistryUrl}
                onChange={(e) => setNewRegistryUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleAddRegistry()}
                placeholder="Enter registry URL"
                className="flex-1 p-2 text-sm border border-strong rounded-default bg-surface-1 text-text-primary placeholder:text-text-disabled"
                disabled={isAddingRegistry}
              />
              <button
                onClick={() => void handleAddRegistry()}
                disabled={isAddingRegistry || !newRegistryUrl.trim()}
                className="px-4 py-2 text-sm bg-secondary-default text-white rounded-default hover:bg-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingRegistry ? '...' : 'Add'}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-disabled">
              Auto-discovers via .well-known/guido.json
            </p>

            {/* Import from file */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-disabled">or</span>
              <FileInput
                ref={fileInputRef}
                label="Import Registry"
                onChange={(e) => void handleImportFile(e)}
                formats=".json"
              />
            </div>

            {addError && (
              <p className="mt-2 text-xs text-validation-error-text">{addError}</p>
            )}
          </div>
        </div>
          </div>

          {/* Close button */}
          <div className="flex justify-end pt-4 border-t border-strong flex-shrink-0">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrySettingsModal;
