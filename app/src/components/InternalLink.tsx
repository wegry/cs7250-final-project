import { ArrowRightOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { Link } from "react-router-dom";
import cx from "clsx";
import s from "./InternalLink.module.css";

// Styled internal link component that looks like an app element
export function InternalLink({
  to,
  children,
  mode,
  className: passedClass,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  mode?: "table";
}) {
  const body = (
    <>
      {children} <ArrowRightOutlined />
    </>
  );

  const className = cx(s.main, mode !== "table" && s.outlined, passedClass);

  if (mode === "table") {
    return (
      <Link className={className} to={to}>
        {body}
      </Link>
    );
  }
  return (
    <Link className={className} to={to}>
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
