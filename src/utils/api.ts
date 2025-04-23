export async function testOpenAICompatibleAPI(
  endpoint: string,
  apiKey: string
) {
  try {
    const baseUrl = endpoint.trim().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
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
