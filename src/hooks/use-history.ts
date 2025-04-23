import useLocalStorage from "./use-localstorage";

export interface HistoryItem {
  action: string;
  text: string;
  result: string;
  timestamp: number;
}

export const useHistory = () => {
  const [history, setHistory, error] = useLocalStorage<HistoryItem[]>(
    "aify_history",
    []
  );

  const addHistoryItem = async (item: Omit<HistoryItem, "timestamp">) => {
    const newItem: HistoryItem = {
      ...item,
      timestamp: Date.now(),
    };
    await setHistory([...history, newItem]);
  };

  const clearHistory = async () => {
    await setHistory([]);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return {
    history,
    addHistoryItem,
    clearHistory,
    copyToClipboard,
    error,
  };
};
