import { useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Alert, Button, Select, Stack, Text, Textarea } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { SETTINGS } from "../constants";
import useLocalStorage from "../hooks/use-localstorage";
import { highlightBlockInspection, parseBlockKeywords, type BlockInspection, type ElementBlockRule } from "../utils/element-blocking";
import type { PickPageAttachment } from "../utils/page-attachment";
import { browser } from "wxt/browser";
import { sendMessage } from "../utils/messaging";
import { newChatId } from "../utils/chat-history";
import { blockDayKey, recentBlockDays, type BlockRuleStats, type BlockStats } from "../utils/block-stats";

const modes = [
  { value: "preview", label: "Preview" },
  { value: "hide", label: "Hide" },
  { value: "off", label: "Off" },
];

const formatDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const formatCount = new Intl.NumberFormat();

function RuleCounts({ stats, days }: { stats?: BlockRuleStats; days: Date[] }) {
  const daily = days.map((date) => ({ date, key: blockDayKey(date), count: stats?.daily[blockDayKey(date)] ?? 0 }));
  const recent = daily.reduce((sum, { count }) => sum + count, 0);
  return <details className="rounded border border-neutral-200 px-2 py-1.5 text-xs">
    <summary className="cursor-pointer">
      <span className="font-medium">Blocked:</span> {formatCount.format(daily[0].count)} today · {formatCount.format(recent)} last 30 days · {formatCount.format(stats?.total ?? 0)} all time
    </summary>
    <div className="mt-2 max-h-52 overflow-y-auto">
      <table className="w-full text-start tabular-nums" aria-label="Daily blocked elements for the last 30 days">
        <thead><tr><th scope="col" className="text-start">Date</th><th scope="col" className="text-end">Blocked</th></tr></thead>
        <tbody>{daily.map(({ date, key, count }, index) => <tr key={key}>
          <td className="py-0.5"><time dateTime={key}>{formatDay.format(date)}{index === 0 && " (Today)"}</time></td>
          <td className="text-end">{formatCount.format(count)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
}

export function BlockListSettings({ pick }: { pick: PickPageAttachment }) {
  const [rules, setRules, storageError] = useLocalStorage<ElementBlockRule[]>(SETTINGS.ELEMENT_BLOCK_RULES, []);
  const [stats, , statsError] = useLocalStorage<BlockStats>(SETTINGS.ELEMENT_BLOCK_STATS, {}, false);
  const [today, setToday] = useState(() => blockDayKey(new Date()));
  const days = useMemo(() => recentBlockDays(), [today]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(blockDayKey(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [picking, setPicking] = useState<"parent" | "markers">();
  const [error, setError] = useState<string>();
  const [editingKeywords, setEditingKeywords] = useState<{ ruleId: string; input: string }>();
  const selection = useRef<AbortController | null>(null);
  const activeInspection = useRef<{ token: string; clear?: () => void } | null>(null);
  const stopInspection = () => {
    const current = activeInspection.current;
    activeInspection.current = null;
    current?.clear?.();
  };
  useEffect(() => {
    window.addEventListener("blur", stopInspection);
    return () => {
      window.removeEventListener("blur", stopInspection);
      stopInspection();
      selection.current?.abort();
    };
  }, []);

  async function inspect(rule: ElementBlockRule, target: BlockInspection, inPage: boolean) {
    stopInspection();
    const token = newChatId();
    const current: NonNullable<typeof activeInspection.current> = { token };
    activeInspection.current = current;
    if (inPage) {
      current.clear = highlightBlockInspection(rule, target);
      return;
    }
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null || activeInspection.current !== current) return;
      const destination = { tabId: tab.id, frameId: 0 };
      current.clear = () => { void sendMessage("inspectBlockRule", { token }, destination).catch(() => {}); };
      await sendMessage("inspectBlockRule", { token, target }, destination);
    } catch { /* A closed tab or restricted page cannot be inspected. */ }
  }

  function inspectionHandlers(rule: ElementBlockRule, part: Omit<BlockInspection, "ruleId"> = {}) {
    const start = (event: React.SyntheticEvent<HTMLButtonElement>) => {
      void inspect(rule, { ruleId: rule.id, ...part }, event.currentTarget.getRootNode() instanceof ShadowRoot);
    };
    return { onPointerEnter: start, onPointerLeave: stopInspection, onFocus: start, onBlur: stopInspection };
  }

  async function pickArea(existing?: ElementBlockRule, markersOnly = false) {
    if (selection.current) return;
    stopInspection();
    const controller = new AbortController();
    selection.current = controller;
    setPicking(markersOnly ? "markers" : "parent");
    setError(undefined);
    try {
      const area = await pick(controller.signal, markersOnly && existing
        ? { markerParent: { host: existing.host, selector: existing.selector } }
        : "block");
      if (!area || controller.signal.aborted) return;
      const { id, pageHost: host, selector, label, blockMarkers } = area;
      if (!host || !selector) throw new Error("No area rule was returned. Refresh the page and try again.");
      if (existing && host !== existing.host) throw new Error(`Open ${existing.host} to reselect this rule.`);
      if (markersOnly && existing) {
        if (!blockMarkers?.length || selector !== existing.selector) throw new Error("No markers were returned for this parent.");
        setRules((items) => items.map((item) => {
          if (item.id !== existing.id) return item;
          const merged = new Map((item.markers ?? []).map((marker) => [JSON.stringify(marker), marker]));
          for (const marker of blockMarkers) {
            if (merged.size < 8) merged.set(JSON.stringify(marker), marker);
          }
          return { ...item, markers: [...merged.values()], mode: "preview" };
        }));
        return;
      }
      const markers = existing?.markers;
      const markerKey = (values: ElementBlockRule["markers"]) => (values ?? []).map((value) => JSON.stringify(value)).sort().join("\n");
      const keywords = existing?.keywords;
      const keywordKey = (values?: string[]) => [...(values ?? [])].sort().join("\n");
      setRules((items) => {
        const isDuplicate = (item: ElementBlockRule) => item.host === host && item.selector === selector &&
          markerKey(item.markers) === markerKey(markers) && keywordKey(item.keywords) === keywordKey(keywords);
        const ruleId = existing?.id ?? items.find(isDuplicate)?.id ?? id;
        return [...items.filter((item) => item.id !== ruleId && !isDuplicate(item)),
          { id: ruleId, host, selector, markers, keywords, label, mode: "preview" }];
      });
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not select an area.");
    } finally {
      selection.current = null;
      setPicking(undefined);
    }
  }

  return <Stack gap="sm">
    <Text size="sm" c="dimmed">Preview shows parent candidates with a dashed amber outline and full matches in purple. A marker is a clue inside the parent, such as an “Ad” badge. Hover over a saved path below to see what it matches.</Text>
    {picking
      ? <Button variant="default" onClick={() => selection.current?.abort()}>Cancel area selection</Button>
      : <Button leftSection={<IconPlus size={15} />} onClick={() => void pickArea()}>Select parent area</Button>}
    {picking && <Text size="xs" role="status">{picking === "parent"
      ? "Select the parent area on the page, then click Save parent. You can add markers separately."
      : "Click identifying elements inside a matching parent, then click Save markers. The saved parent stays unchanged."}</Text>}
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {storageError && <Alert color="red" role="alert">Could not {storageError.operation === "read" ? "load" : "save"} the block list.</Alert>}
    {statsError && <Alert color="red" role="alert">Could not load Block List counts.</Alert>}
    {rules.map((rule) => <div key={rule.id} className="min-w-0 space-y-2 rounded border border-neutral-200 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Text size="sm" fw={500}>{rule.host} · {rule.label}</Text>
          <button type="button" className="block text-left text-xs break-all" title="Highlight parent candidates in amber" {...inspectionHandlers(rule)}>
            <span className="block font-medium">Parent path</span><code>{rule.selector}</code>
          </button>
        </div>
        <ActionIcon color="red" variant="subtle" aria-label={`Delete ${rule.label} rule on ${rule.host}`}
          onClick={() => setRules((items) => items.filter(({ id }) => id !== rule.id))}><IconTrash size={16} /></ActionIcon>
      </div>
      {!statsError && <RuleCounts stats={stats[rule.id]} days={days} />}
      {!!rule.markers?.length && <ul aria-label="Required element markers" className="space-y-1">
        {rule.markers.map(({ selector, text, path }, index) => <li key={JSON.stringify([selector, text, path, index])} className="flex items-start gap-2">
          <button type="button" className="min-w-0 flex-1 break-all text-left text-xs" title="Highlight this marker in cyan" {...inspectionHandlers(rule, { markerIndex: index })}>
            <span className="block font-medium">Marker {index + 1}{text && ` · “${text}”`}</span>
            {path ? <code>{path}</code> : selector !== "*" ? <code>{selector}</code> : <span>Text match · reselect to record its path</span>}
          </button>
          <ActionIcon color="red" variant="subtle" size="sm" aria-label={`Remove marker ${index + 1}`} onClick={() => {
            stopInspection();
            setRules((items) => items.map((item) => item.id === rule.id ? { ...item, markers: item.markers?.filter((_, i) => i !== index), mode: "preview" } : item));
          }}><IconTrash size={14} /></ActionIcon>
        </li>)}
      </ul>}
      {!!rule.keywords?.length && <ul aria-label="Required keyword markers" className="space-y-1">
        {rule.keywords.map((keyword, index) => <li key={keyword} className="flex items-start gap-2">
          <button type="button" className="min-w-0 flex-1 break-words text-left text-xs" title="Highlight this keyword in green" {...inspectionHandlers(rule, { keywordIndex: index })}>Keyword · “{keyword}”</button>
          <ActionIcon color="red" variant="subtle" size="sm" aria-label={`Remove keyword ${keyword}`} onClick={() => {
            stopInspection();
            setRules((items) => items.map((item) => item.id === rule.id ? { ...item, keywords: item.keywords?.filter((_, i) => i !== index), mode: "preview" } : item));
          }}><IconTrash size={14} /></ActionIcon>
        </li>)}
      </ul>}
      {editingKeywords?.ruleId === rule.id ? <Stack gap="xs">
        <Textarea label="Keyword markers" description="One word or phrase per line. All must appear in the area, regardless of case." autosize minRows={2} maxRows={6}
          maxLength={2000} value={editingKeywords.input} onChange={(event) => setEditingKeywords({ ruleId: rule.id, input: event.currentTarget.value })} />
        <div className="flex flex-wrap gap-2">
          <Button size="compact-xs" onClick={() => {
            const keywords = parseBlockKeywords(editingKeywords.input);
            setRules((items) => items.map((item) => item.id === rule.id ? { ...item, keywords, mode: "preview" } : item));
            setEditingKeywords(undefined);
          }}>Save and preview</Button>
          <Button size="compact-xs" variant="default" onClick={() => setEditingKeywords(undefined)}>Cancel</Button>
        </div>
      </Stack> : <Button size="compact-xs" variant="subtle" disabled={!!picking} onClick={() => setEditingKeywords({ ruleId: rule.id, input: (rule.keywords ?? []).join("\n") })}>
        {rule.keywords?.length ? "Edit keyword markers" : "Add keyword markers"}
      </Button>}
      <div className="flex flex-wrap gap-2">
        <Button size="compact-xs" variant="subtle" disabled={!!picking || rule.mode === "hide"} onClick={() => void pickArea(rule)}>Reselect parent</Button>
        <Button size="compact-xs" variant="subtle" disabled={!!picking || rule.mode === "hide" || (rule.markers?.length ?? 0) >= 8} onClick={() => void pickArea(rule, true)}>Add element markers</Button>
      </div>
      {rule.mode === "hide" && <Text size="xs" c="dimmed">Switch to Preview to select a parent or add markers.</Text>}
      <Select size="xs" aria-label={`Mode for ${rule.label} on ${rule.host}`} data={modes} value={rule.mode}
        allowDeselect={false} comboboxProps={{ withinPortal: false }} onChange={(mode) => {
          if (mode === "preview" || mode === "hide" || mode === "off") {
            setRules((items) => items.map((item) => item.id === rule.id ? { ...item, mode } : item));
          }
        }} />
    </div>)}
  </Stack>;
}
