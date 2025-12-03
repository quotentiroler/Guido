import React, { useState, useEffect, useCallback } from "react";
import Button from "./shared/Button";
import Portal from "./shared/Portal";
import { useAI } from "@/hooks/useAI";
import { LLMProvider, PROVIDER_LABELS, PROVIDER_PLACEHOLDER_KEYS } from "@/context/AIContext";
import { fetchModels, checkOllamaAvailable, ModelInfo } from "@/services/llmService";

interface AISetupModalProps {
  onClose: () => void;
}

const AISetupModal: React.FC<AISetupModalProps> = ({ onClose }) => {
  const { config, setConfig, speechRate, setSpeechRate, speechVolume, setSpeechVolume, speechEnabled, setSpeechEnabled } = useAI();
  
  const [provider, setProvider] = useState<LLMProvider>(config?.provider || 'ollama');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || 'http://localhost:11434');
  const [model, setModel] = useState(config?.model || '');
  
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);

  // Load models function
  const loadModels = useCallback(async () => {
    if (provider !== 'ollama' && !apiKey) {
      setModels([]);
      return;
    }

    setIsLoadingModels(true);
    setModelError(null);

    try {
      const fetchedModels = await fetchModels(provider, apiKey, baseUrl);
      setModels(fetchedModels);
      
      // Auto-select first model if none selected or current not in list
      if (fetchedModels.length > 0) {
        const currentModelExists = fetchedModels.some(m => m.id === model);
        if (!model || !currentModelExists) {
          setModel(fetchedModels[0].id);
        }
      }
    } catch (e) {
      setModelError(e instanceof Error ? e.message : 'Failed to fetch models');
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [provider, apiKey, baseUrl, model]);

  // Check Ollama availability on mount and when baseUrl changes
  useEffect(() => {
    if (provider === 'ollama') {
      const checkOllama = async () => {
        const available = await checkOllamaAvailable(baseUrl);
        setOllamaAvailable(available);
        if (available) {
          void loadModels();
        }
      };
      void checkOllama();
    }
  }, [provider, baseUrl, loadModels]);

  const handleSave = () => {
    if (!model) {
      setModelError('Please select a model');
      return;
    }

    setConfig({
      provider,
      apiKey,
      model,
      baseUrl: provider === 'ollama' ? baseUrl : undefined,
    });
    onClose();
  };

  const handleClear = () => {
    setConfig(null);
    onClose();
  };

  const needsApiKey = provider !== 'ollama';
  const canFetchModels = provider === 'ollama' ? ollamaAvailable : apiKey.length > 0;

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-surface-0 p-8 rounded-default shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto mx-4 border border-border">
          <h2 className="text-xl font-bold mb-2 text-text-primary flex items-center gap-2">
            <span className="text-2xl">🤖</span> AI Assistant Setup
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Configure an LLM to chat with Guido and edit your configuration using natural language.
          </p>

          {/* Provider Selection */}
          <label className="block mb-4 text-text-primary">
            Provider:
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as LLMProvider);
                setModels([]);
                setModel('');
                setModelError(null);
              }}
              className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
            >
              {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          {/* Ollama Base URL */}
          {provider === 'ollama' && (
            <label className="block mb-4 text-text-primary">
              Ollama URL:
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
              />
              <span className="text-xs text-text-secondary mt-1 block">
                {ollamaAvailable === null && "Checking Ollama availability..."}
                {ollamaAvailable === true && (
                  <span className="text-success-600">✓ Ollama is running</span>
                )}
                {ollamaAvailable === false && (
                  <span className="text-error-600">
                    ✗ Ollama not found. Make sure it's running at {baseUrl}
                  </span>
                )}
              </span>
            </label>
          )}

          {/* API Key */}
          {needsApiKey && (
            <label className="block mb-4 text-text-primary">
              API Key:
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDER_PLACEHOLDER_KEYS[provider]}
                className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default font-mono"
              />
              <span className="text-xs text-text-secondary mt-1 block">
                🔒 Your API key is stored locally in your browser and never sent to our servers.
              </span>
            </label>
          )}

          {/* Fetch Models Button */}
          {canFetchModels && models.length === 0 && !isLoadingModels && (
            <Button 
              onClick={() => void loadModels()}
              type="secondary"
              className="mb-4 w-full"
            >
              {provider === 'ollama' ? 'Load Local Models' : 'Validate Key & Load Models'}
            </Button>
          )}

          {/* Loading State */}
          {isLoadingModels && (
            <div className="flex items-center gap-2 text-text-secondary mb-4">
              <div className="animate-spin w-4 h-4 border-2 border-primary-default border-t-transparent rounded-full" />
              Fetching models...
            </div>
          )}

          {/* Model Error */}
          {modelError && (
            <div className="text-error-600 text-sm mb-4 p-2 bg-error-50 rounded-default border border-error-200">
              {modelError}
            </div>
          )}

          {/* Model Selection */}
          {models.length > 0 && (
            <label className="block mb-4 text-text-primary">
              Model:
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-field-border rounded-default shadow-sm bg-surface-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-default focus:border-primary-default"
              >
                <option value="">Select a model...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.description && `(${m.description})`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Speech Settings Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-lg font-semibold mb-4 text-text-primary flex items-center gap-2">
              <span>🔊</span> Speech Settings
            </h3>
            
            {/* Speech Enabled Toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-primary">Enable Speech</span>
              <button
                type="button"
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  speechEnabled ? 'bg-primary-default' : 'bg-surface-3'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    speechEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Volume Slider */}
            <label className="block mb-4 text-text-primary">
              <div className="flex items-center justify-between mb-1">
                <span>Volume</span>
                <span className="text-sm text-text-secondary">{Math.round(speechVolume * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔈</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={speechVolume}
                  onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-surface-4 rounded-lg appearance-none cursor-pointer accent-primary-default"
                />
                <span className="text-lg">🔊</span>
              </div>
            </label>

            {/* Speed Slider */}
            <label className="block mb-4 text-text-primary">
              <div className="flex items-center justify-between mb-1">
                <span>Speed</span>
                <span className="text-sm text-text-secondary">{speechRate.toFixed(1)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🐢</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-surface-4 rounded-lg appearance-none cursor-pointer accent-primary-default"
                />
                <span className="text-lg">🐇</span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-6">
            <div>
              {config && (
                <Button onClick={handleClear} type="error-text">
                  Clear Config
                </Button>
              )}
            </div>
            <div className="flex gap-4">
              <Button onClick={onClose} type="primary-text">
                Cancel
              </Button>
              <button 
                onClick={handleSave}
                disabled={!model}
                className={`px-6 py-3 rounded-default font-medium transition-opacity duration-200 ${
                  model 
                    ? 'bg-primary-default text-white hover:opacity-70' 
                    : 'bg-surface-2 text-text-disabled cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AISetupModal;
