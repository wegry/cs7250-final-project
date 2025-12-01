import { Button, Popover } from "antd";
import { price } from "../formatters";

export function AdjPopover({
  baseRate,
  adj,
}: {
  baseRate?: number | null;
  adj?: number | null;
}) {
  if (adj == null) return null;
  return (
    <Popover
      trigger="click"
      content={`Base rate of ${price.format(baseRate ?? 0)} includes adjustment of ${price.format(adj)}`}
    >
      <Button size="large" style={{ marginLeft: 8 }}>
        Adj.
      </Button>
    </Popover>
  );
}
