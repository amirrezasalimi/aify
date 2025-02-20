import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

import OpenAI from "openai";
import useLocalStorage from "../hooks/useLocalStorage";
import { SETTINGS } from "../constants";
import SearchDropdown from "../components/search-dropdown";

const Popup = () => {
  const [endpoint, setEndpoint] = useLocalStorage(SETTINGS.ENDPOINT, "");
  const [apiKey, setApiKey] = useLocalStorage(SETTINGS.API_KEY, "");
  const [style, setStyle] = useLocalStorage(SETTINGS.STYLE, "");
  const [models, setModels] = useState<OpenAI.Models.Model[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string | undefined>(
    SETTINGS.SELECTED_MODEL,
    undefined
  );
  const [isEnabled, setIsEnabled] = useLocalStorage(SETTINGS.ENABLED, true);
  const [minWords, setMinWords] = useLocalStorage(SETTINGS.MIN_WORDS, 5);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");

  useEffect(() => {
    const loadModels = async () => {
      if (apiKey && endpoint) {
        try {
          const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: endpoint,
            dangerouslyAllowBrowser: true,
          });
          const modelList = await openai.models.list();
          setModels(modelList.data);
          if (
            modelList.data.length > 0 &&
            (selectedModel === undefined || selectedModel === null)
          ) {
            setSelectedModel(modelList.data[0].id);
          }
        } catch (error) {
          console.error("Error loading models:", error);
          setModels([]);
        }
      } else {
        setModels([]);
      }
    };

    loadModels();
  }, [apiKey, endpoint, setSelectedModel, selectedModel]);

  // Convert models to the format expected by SearchDropdown
  const modelOptions = models.map((model) => ({
    id: model.id,
    label: model.id,
  }));

  return (
    <div className="flex flex-col gap-6 bg-black p-6 min-w-[320px] text-white">
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">Aify</h1>
        <p className="text-gray-400 text-sm">
          Configure your Aify settings below
        </p>
      </div>

      <div className="flex gap-4 border-gray-800 border-b">
        <button
          className={`pb-2 text-sm ${
            activeTab === "settings"
              ? "text-teal-400 border-b-2 border-teal-400"
              : "text-gray-400"
          }`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
        <button
          className={`pb-2 text-sm ${
            activeTab === "info"
              ? "text-teal-400 border-b-2 border-teal-400"
              : "text-gray-400"
          }`}
          onClick={() => setActiveTab("info")}
        >
          How to use?
        </button>
      </div>

      {activeTab === "settings" ? (
        <>
          <div className="flex justify-between items-center">
            <label className="text-gray-200 text-sm">Enable Extension</label>
            <div
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer ${
                isEnabled ? "bg-teal-600" : "bg-gray-700"
              }`}
              onClick={() => setIsEnabled(!isEnabled)}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
                  isEnabled ? "translate-x-6" : ""
                }`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Endpoint"
              className="bg-gray-900 px-3 py-2 border border-gray-800 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 w-full text-sm placeholder-gray-500"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
            <input
              type="text"
              placeholder="API Key"
              className="bg-gray-900 px-3 py-2 border border-gray-800 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 w-full text-sm placeholder-gray-500"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />

            <SearchDropdown
              options={modelOptions}
              selectedOption={selectedModel}
              onSelect={setSelectedModel}
              placeholder="Select a model"
            />

            <button
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-4 py-2 rounded-md w-full font-medium text-sm transition-colors disabled:cursor-not-allowed"
              onClick={async () => {
                setLoading(true);
                try {
                  const openai = new OpenAI({
                    apiKey: apiKey,
                    baseURL: endpoint,
                    dangerouslyAllowBrowser: true,
                  });
                  await openai.completions.create({
                    model: selectedModel || models[0]?.id || "default",
                    prompt: "hi",
                    max_tokens: 5,
                  });
                  setSuccess(true);
                } catch (error) {
                  console.error("Error testing LLM:", error);
                  setSuccess(false);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? "Testing..." : "Test Connection"}
            </button>
            {success && (
              <div className="text-teal-400 text-sm text-center">Success!</div>
            )}
          </div>

          <div className="space-y-2">
            <button
              className="flex items-center gap-2 text-gray-200 hover:text-teal-400 text-sm transition-colors"
              onClick={() => setIsStyleOpen(!isStyleOpen)}
            >
              Advanced Settings
              {isStyleOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {isStyleOpen && (
              <div className="space-y-4">
                <textarea
                  rows={4}
                  placeholder="Style of Text"
                  className="bg-gray-900 px-3 py-2 border border-gray-800 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 w-full text-sm resize-y placeholder-gray-500"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
                <div className="space-y-2">
                  <label className="text-gray-200 text-sm">
                    Minimum Words for Popup
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="bg-gray-900 px-3 py-2 border border-gray-800 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 w-full text-sm placeholder-gray-500"
                    value={minWords}
                    onChange={(e) => setMinWords(parseInt(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4 text-gray-300 text-sm">
          <h3 className="font-medium text-gray-200">
            How to Configure Settings
          </h3>
          <div className="space-y-2">
            <p>
              <strong>Endpoint:</strong> Enter the base URL for your OpenAI or
              compatible API (e.g., https://api.openai.com/v1 or your custom
              endpoint).
            </p>
            <p>
              <strong>API Key:</strong> Obtain your API key from the OpenAI
              platform or your API provider and paste it here.
            </p>
            <p>
              <strong>Model:</strong> Select a model from the dropdown.
              Available models will load once a valid endpoint and API key are
              provided.
            </p>
            <p>
              <strong>Style:</strong> Optional custom text style instructions
              for the AI output.
            </p>
            <p>
              <strong>Minimum Words:</strong> Set the minimum number of words
              required to trigger the popup (default is 5).
            </p>
          </div>
        </div>
      )}

      <footer className="mt-auto text-gray-500 text-xs text-center">
        Created by{" "}
        <a
          href="https://github.com/amirrezasalimi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-400 hover:text-teal-300 transition-colors"
        >
          Amirreza
        </a>
      </footer>
    </div>
  );
};

export default Popup;
