import { ActionIcon, Popover, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

export function ErrorPopover({ label, details }: { label: string; details: string }) {
  return (
    <Popover withinPortal={false} floatingStrategy="fixed" position="bottom-start" offset={6} withArrow shadow="md" zIndex={1000}>
      <Popover.Target>
        <ActionIcon size="xs" variant="subtle" color="red" aria-label={`Show error details: ${label}`} title="Show error details">
          <IconInfoCircle size={14} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown w="min(280px, calc(100vw - 24px))" p="xs">
        <Text fw={600} size="xs" mb={4}>{label}</Text>
        <div tabIndex={0} className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">{details}</div>
      </Popover.Dropdown>
    </Popover>
  );
}
