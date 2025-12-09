import { ArrowRightOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { Link } from "react-router-dom";
import cx from "clsx";
import s from "./InternalLink.module.css";
import type { CSSProperties } from "react";

// Styled internal link component that looks like an app element
export function InternalLink({
  to,
  children,
  mode,
  className: passedClass,
  style,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  mode?: "table";
  style?: CSSProperties;
}) {
  const body = (
    <>
      {children} <ArrowRightOutlined />
    </>
  );

  const className = cx(s.main, mode !== "table" && s.outlined, passedClass);

  if (mode === "table") {
    return (
      <Link className={className} to={to} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <Link className={className} to={to} style={style}>
      <Tag
        className={s.main}
        variant="outlined"
        style={{
          cursor: "pointer",
          fontSize: "inherit",
          backgroundColor: "transparent",
        }}
      >
        {body}
      </Tag>
    </Link>
  );
}
