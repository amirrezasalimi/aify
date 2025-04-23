import { IconCopy, IconTrash } from "@tabler/icons-react";
import { Button, Text, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHistory } from "@/hooks/use-history";

export const HistoryPanel = () => {
  const { history, clearHistory, copyToClipboard } = useHistory();

  const handleClearHistory = async () => {
    await clearHistory();
    notifications.show({
      title: "History cleared",
      message: "All history items have been removed",
      color: "blue",
    });
  };

  const handleCopyToClipboard = async (text: string) => {
    await copyToClipboard(text);
    notifications.show({
      title: "Copied",
      message: "Text copied to clipboard",
      color: "blue",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end mb-4">
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={handleClearHistory}
          size="xs"
        >
          Clear History
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Stack gap="md">
          {history.length === 0 ? (
            <Text c="dimmed" ta="center" className="py-8">
              No history yet
            </Text>
          ) : (
            history
              .slice()
              .reverse()
              .map((item, index) => (
                <div
                  key={index}
                  className="bg-white p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-2">
                    <Text size="sm" fw={500} c="blue">
                      {item.action}
                    </Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => handleCopyToClipboard(item.result)}
                      leftSection={<IconCopy size={14} />}
                    >
                      Copy
                    </Button>
                  </div>
                  <Text size="sm" c="dimmed" className="mb-2 line-clamp-1">
                    Input: {item.text}
                  </Text>
                  <Text size="sm" className="line-clamp-3">
                    {item.result}
                  </Text>
                  <Text size="xs" c="dimmed" className="mt-2">
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </div>
              ))
          )}
        </Stack>
      </div>
    </div>
  );
};
