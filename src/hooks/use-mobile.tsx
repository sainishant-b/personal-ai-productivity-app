import * as React from "react";
import { Capacitor } from "@capacitor/core";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
  const isNative = Capacitor.isNativePlatform();

  React.useEffect(() => {
    // Native apps always use mobile UI
    if (isNative) {
      setIsMobile(true);
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, [isNative]);

  return !!isMobile;
}
