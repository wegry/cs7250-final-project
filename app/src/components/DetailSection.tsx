import type { ReactNode } from "react";
import s from "./DetailSection.module.css";

export function DetailSection({
  title,
  children,
  description,
  hide,
}: {
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
      <div className={s.infoBlock}>
        <h2>{title}</h2>
        {description}
      </div>
      {children}
    </>
  );
}
