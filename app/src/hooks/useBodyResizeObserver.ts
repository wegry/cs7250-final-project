import { useEffect, useState } from "react";

export function useBodyResizeObserver() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]!.contentRect.width;
      setIsMobile(width < 700);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return { isMobile };
}
