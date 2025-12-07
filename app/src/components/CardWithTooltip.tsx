import { QuestionCircleTwoTone } from "@ant-design/icons";
import { Card, Tooltip } from "antd";
import type { ReactNode } from "react";

export function CardWithTooltip({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip: ReactNode;
}) {
  return (
    <Card style={{ position: "relative" }}>
      {children}
      <Tooltip title={tooltip}>
        <QuestionCircleTwoTone
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 18,
            cursor: "pointer",
          }}
        />
      </Tooltip>
    </Card>
  );
}
