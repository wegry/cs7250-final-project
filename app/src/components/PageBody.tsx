import type { ReactNode } from "react";
import s from "./PageBody.module.css";
import cx from "clsx";

export function PageBody({
  title,
  children,
  className,
}: {
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <main className={cx(s.main, className)}>
      {title?.length ? <h1>{title}</h1> : null}

      {children}
    </main>
  );
}
