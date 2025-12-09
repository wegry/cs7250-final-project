import type { ReactNode } from "react";
import { LegendSelectionProvider } from "../charts/LegendSelectionContext";
import * as s from "./DetailSection.module.css";

interface DetailSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  hide?: boolean;
}

export function DetailSection({
  title,
  description,
  children,
  hide,
}: DetailSectionProps) {
  if (hide) return null;

  return (
    <>
      <div className={s.subgrid}>
        <div className={s.infoBlock}>
          <h2>{title}</h2>
          {description}
        </div>
        <LegendSelectionProvider>{children}</LegendSelectionProvider>
      </div>
    </>
  );
}
