import { useState, useEffect } from "react";
import OpenAI from "openai";
import useLocalStorage from "../hooks/useLocalStorage";

const Popup = () => {
  const [endpoint, setEndpoint] = useLocalStorage("endpoint", "");
  const [apiKey, setApiKey] = useLocalStorage("apiKey", "");
  const [style, setStyle] = useLocalStorage("style", "");
  const [models, setModels] = useState<OpenAI.Models.Model[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string | undefined>(
    "selectedModel",
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  return (
    <div className="flex flex-col justify-start items-center gap-6 bg-gradient-to-br from-purple-800 to-purple-900 shadow-2xl p-8 text-white">
      <h1 className="text-shadow m-0 font-bold text-3xl tracking-wider">
        Aify
      </h1>
      <p className="text-gray-200 text-sm text-center">
        Configure your Aify settings here. Enter your API endpoint and key to
        connect.
      </p>
      <input
        type="text"
        placeholder="Endpoint"
        className="bg-purple-700 shadow-inner px-4 py-2 border border-purple-900 rounded-md outline-none w-full text-white text-sm placeholder-gray-300"
        value={endpoint}
        onChange={(e) => setEndpoint(e.target.value)}
      />
      <input
        type="text"
        placeholder="API Key"
        className="bg-purple-700 shadow-inner px-4 py-2 border border-purple-900 rounded-md outline-none w-full text-white text-sm placeholder-gray-300"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <select
        className="bg-purple-700 shadow-inner px-4 py-2 border border-purple-900 rounded-md outline-none w-full text-white text-sm placeholder-gray-300"
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
      >
        <option value={undefined}>Select a model</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>
      <button
        className="bg-purple-400 hover:bg-purple-500 shadow-md px-8 py-4 border-none rounded-md text-white text-sm transition-colors duration-300 cursor-pointer"
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
        {loading ? "Testing..." : "Test"}
      </button>
      {success && <div className="text-green-500">Success!</div>}
      <textarea
        rows={4}
        placeholder="Style of Text"
        className="bg-purple-700 shadow-inner px-4 py-2 border border-purple-900 rounded-md outline-none w-full text-white text-sm resize-vertical placeholder-gray-300"
        value={style}
        onChange={(e) => setStyle(e.target.value)}
      />
    </div>
  );
};

export default Popup;
