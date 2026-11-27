export const BLOCK_STATS_DAYS = 30;

export interface BlockRuleStats {
  total: number;
  daily: Record<string, number>;
}

export type BlockStats = Record<string, BlockRuleStats>;
export type BlockCount = { ruleId: string; count: number };

export function blockDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function recentBlockDays(now = new Date()) {
  return Array.from({ length: BLOCK_STATS_DAYS }, (_, offset) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
}
