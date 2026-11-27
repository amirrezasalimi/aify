export function parseApiEndpoint(endpoint: string): URL | undefined {
  try {
    const url = new URL(endpoint.trim());
    if (/^https?:$/.test(url.protocol) && !url.username && !url.password && !url.search && !url.hash) {
      return url;
    }
  } catch {
    // Empty or invalid endpoint.
  }
}

export function requireApiEndpoint(endpoint: string): URL {
  const url = parseApiEndpoint(endpoint);
  if (!url) throw new Error("Set a valid OpenAI-compatible API endpoint in Settings → General.");
  return url;
}

export function requireApiModel(model: string): string {
  if (!model.trim()) throw new Error("Select a model in Settings → General.");
  return model.trim();
}

export async function testOpenAICompatibleAPI(
  endpoint: string,
  apiKey: string
) {
  try {
    const baseUrl = requireApiEndpoint(endpoint).href.replace(/\/+$/, "");
    const key = apiKey.trim();
    const response = await fetch(`${baseUrl}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`API test failed: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
