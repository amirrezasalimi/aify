import {
  Stack,
  Switch,
  Textarea,
  NumberInput,
  Select,
  Text,
  TextInput,
  Button,
  Alert,
  Loader,
  MultiSelect,
  Tabs,
} from "@mantine/core";
import { useState } from "react";
import useLocalStorage from "../hooks/use-localstorage";
import {
  SETTINGS,
  defaultTextActions,
  defaultInputActions,
} from "../constants";
import { IconBan, IconInfoCircle, IconRobot, IconSettings, IconTarget } from "@tabler/icons-react";
import { BlockListSettings } from "./block-list-settings";
import { useModels } from "../hooks/use-models";
import { AgentSettings } from "./agent-settings";
import { ElementActionsSettings } from "./element-actions-settings";
import type { PickPageAttachment } from "../utils/page-attachment";
import type { AifyTheme } from "./aify-theme-provider";

export const SettingsPanel = ({ pickPageAttachment }: { pickPageAttachment: PickPageAttachment }) => {
  const [theme, setTheme] = useLocalStorage<AifyTheme>(SETTINGS.THEME, "auto");
  const [profiles] = useLocalStorage<import("../utils/agents").AgentProfile[]>(SETTINGS.AGENT_PROFILES, []);
  const [isEnabled, setIsEnabled] = useLocalStorage(SETTINGS.ENABLED, true);
  const [inputActions, setInputActions] = useLocalStorage(
    SETTINGS.INPUT_ACTIONS,
    defaultInputActions
  );
  const [textActions, setTextActions] = useLocalStorage(
    SETTINGS.TEXT_ACTIONS,
    defaultTextActions
  );
  const [defaultAction, setDefaultAction] = useLocalStorage<string | null>(
    SETTINGS.DEFAULT_ACTION,
    null
  );
  const [minWords, setMinWords] = useLocalStorage(SETTINGS.MIN_WORDS, 2);
  const [useCustomApi, setUseCustomApi] = useLocalStorage(
    SETTINGS.USE_CUSTOM_API,
    false
  );
  const [apiKey, setApiKey] = useLocalStorage(SETTINGS.API_KEY, "");
  const [apiEndpoint, setApiEndpoint] = useLocalStorage(
    SETTINGS.API_ENDPOINT,
    "https://api.openai.com/v1"
  );
  const [selectedModel, setSelectedModel] = useLocalStorage(
    SETTINGS.SELECTED_MODEL,
    "gpt-3.5-turbo"
  );
  const [selectedLanguages, setSelectedLanguages] = useLocalStorage(
    SETTINGS.TRANSLATION_LANGUAGES,
    ["🇺🇸 English"]
  );
  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    message?: string;
  }>();
  const [isTestingApi, setIsTestingApi] = useState(false);

  const {
    models,
    isLoading: isLoadingModels,
    error: modelsError,
  } = useModels(useCustomApi, apiEndpoint, apiKey);

  const actionOptions = [
    { value: "", label: "None" },
    ...textActions
      .split("\n")
      .filter(Boolean)
      .map((action) => ({
        value: action,
        label: action,
      })),
    ...selectedLanguages.map((lang) => `Translate to ${lang}`),
  ];

  const languages = [
    "🇮🇷 Persian",
    "🇪🇸 Spanish",
    "🇫🇷 French",
    "🇩🇪 German",
    "🇮🇹 Italian",
    "🇵🇹 Portuguese",
    "🇷🇺 Russian",
    "🇯🇵 Japanese",
    "🇰🇷 Korean",
    "🇨🇳 Chinese",
    "🇸🇦 Arabic",
    "🇳🇱 Dutch",
    "🇵🇱 Polish",
    "🇹🇷 Turkish",
    "🇸🇪 Swedish",
    "🇩🇰 Danish",
    "🇳🇴 Norwegian",
    "🇫🇮 Finnish",
    "🇬🇷 Greek",
    "🇮🇳 Hindi",
    "🇻🇳 Vietnamese",
  ];

  const handleTestAPI = async () => {
    setTestStatus(undefined);
    setIsTestingApi(true);
    try {
      const result = await testOpenAICompatibleAPI(apiEndpoint, apiKey);
      setTestStatus({
        success: result.success,
        message: result.success ? "API connection successful!" : result.error,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const generalSettings = (
    <Stack gap="md" py={4} pb={16}>
      <Switch
        label="Enable Extension"
        checked={isEnabled}
        onChange={(event) => setIsEnabled(event.currentTarget.checked)}
      />

      <Select
        label="Theme"
        description="Auto follows your system appearance."
        data={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "auto", label: "Auto" }]}
        value={theme}
        allowDeselect={false}
        comboboxProps={{ withinPortal: false }}
        onChange={(value) => { if (value === "light" || value === "dark" || value === "auto") setTheme(value); }}
      />

      <Stack>
        <Text size="sm" fw={500}>
          Input Actions
        </Text>
        <Textarea
          placeholder="Enter actions (one per line)"
          value={inputActions}
          onChange={(e) => setInputActions(e.currentTarget.value)}
          minRows={4}
          autosize
          maxRows={8}
          description="Add custom actions, one per line"
        />
      </Stack>

      <Stack>
        <Text size="sm" fw={500}>
          Text Actions
        </Text>
        <Textarea
          placeholder="Enter text actions (one per line)"
          value={textActions}
          onChange={(e) => setTextActions(e.currentTarget.value)}
          minRows={4}
          autosize
          maxRows={8}
          description="Configure text actions, one per line"
        />
      </Stack>

      <Select
        label="Default Action"
        description="This action will appear as a button next to Aify when text is selected, allowing for one-click transformations"
        data={actionOptions}
        value={defaultAction}
        onChange={(value) => setDefaultAction(value || null)}
        searchable
        clearable
        comboboxProps={{
          withinPortal: false,
        }}
      />

      <NumberInput
        label="Minimum Words"
        description="Minimum words required to show text actions"
        value={minWords}
        onChange={(val) => setMinWords(Number(val))}
        min={1}
      />

      <Stack>
        <MultiSelect
          label="Translation Languages"
          placeholder="Select languages"
          data={languages}
          value={selectedLanguages}
          onChange={setSelectedLanguages}
          searchable
          clearable
          comboboxProps={{
            withinPortal: false,
          }}
        />
      </Stack>

      <Stack>
        <Switch
          label="Use Custom API"
          checked={useCustomApi}
          onChange={(event) => setUseCustomApi(event.currentTarget.checked)}
        />

        {useCustomApi && (
          <>
            <TextInput
              label="API Endpoint"
              placeholder="https://api.openai.com/v1"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
            />
            <TextInput
              label="API Key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Select
              label="Model"
              description="Select the model to use for transformations"
              data={models}
              value={selectedModel}
              onChange={(value) => setSelectedModel(value || "")}
              searchable
              rightSection={isLoadingModels ? <Loader size="xs" /> : null}
              error={modelsError}
              comboboxProps={{
                withinPortal: false,
              }}
            />
            <Button
              size="xs"
              onClick={handleTestAPI}
              disabled={!apiEndpoint || !apiKey || isTestingApi}
              loading={isTestingApi}
            >
              {isTestingApi ? "Testing..." : "Test API Connection"}
            </Button>
            {testStatus && (
              <Alert
                color={testStatus.success ? "green" : "red"}
                variant="light"
                icon={<IconInfoCircle />}
              >
                {testStatus.message}
              </Alert>
            )}
            <Alert color="blue" variant="light" icon={<IconInfoCircle />}>
              Hint: You can use any OpenAI-compatible API like
              Ollama,OpenRouter, or other LLM providers that implement OpenAI's
              API format.
            </Alert>
          </>
        )}
      </Stack>
    </Stack>
  );

  return (
    <Tabs defaultValue="general" className="min-w-0">
      <Tabs.List aria-label="Settings sections" style={{ flexWrap: "wrap" }}>
        <Tabs.Tab value="general" className="shrink-0 whitespace-nowrap" leftSection={<IconSettings size={16} />}>
          General
        </Tabs.Tab>
        <Tabs.Tab value="agents" className="shrink-0 whitespace-nowrap" leftSection={<IconRobot size={16} />}>
          Agents
        </Tabs.Tab>
        <Tabs.Tab value="elements" className="shrink-0 whitespace-nowrap" leftSection={<IconTarget size={16} />}>Quick Actions</Tabs.Tab>
        <Tabs.Tab value="block-list" className="shrink-0 whitespace-nowrap" leftSection={<IconBan size={16} />}>Block List</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="general" pt="sm">{generalSettings}</Tabs.Panel>
      <Tabs.Panel value="agents" pt="sm" pb="md">
        <AgentSettings
          useCustomApi={useCustomApi}
          models={models}
          isLoadingModels={isLoadingModels}
          modelsError={modelsError}
        />
      </Tabs.Panel>
      <Tabs.Panel value="elements" pt="sm" pb="md">
        <ElementActionsSettings profiles={profiles} onPick={pickPageAttachment} />
      </Tabs.Panel>
      <Tabs.Panel value="block-list" pt="sm" pb="md">
        <BlockListSettings pick={pickPageAttachment} />
      </Tabs.Panel>
    </Tabs>
  );
};
