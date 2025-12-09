import { LinkOutlined } from "@ant-design/icons";
import cx from "clsx";
import type { AnchorHTMLAttributes } from "react";

export function ExternalLink({
  href,
  children,
  className: passedClass,
  ...rest
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & AnchorHTMLAttributes<unknown>) {
  const body = (
    <>
      {children} <LinkOutlined />
    </>
  );

  const className = cx(passedClass);

  return (
    <a {...rest} className={className} href={href}>
      {body}
    </a>
  );
}
