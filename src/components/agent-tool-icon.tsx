import { IconFileText } from "@tabler/icons-react";
import type { AgentToolId } from "../utils/agents";

const icons = { read_page: IconFileText } satisfies Record<AgentToolId, typeof IconFileText>;

export function AgentToolIcon({ tool }: { tool: AgentToolId }) {
  const Icon = icons[tool];
  return <Icon aria-hidden="true" size={14} className="shrink-0" />;
}
