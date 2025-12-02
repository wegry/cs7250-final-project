import type { ReactNode } from "react";
import s from "./DetailSection.module.css";

export function DetailSection({
  title,
  children,
  description,
  hide,
  breakBefore,
}: {
  breakBefore?: boolean;
  children: ReactNode[] | ReactNode;
  title: string;
  description: ReactNode;
  hide: boolean;
}) {
  if (hide) {
    return null;
  }

  return (
    <>
      {breakBefore && <div className={s.breakBefore} />}
      <div className={s.infoBlock}>
        <h2>{title}</h2>
        {description}
      </div>
      {children}
    </>
  );
}
