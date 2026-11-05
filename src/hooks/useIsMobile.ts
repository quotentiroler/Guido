import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT_PX = 640;

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

const isMobileViewport = () => window.innerWidth < MOBILE_BREAKPOINT_PX;

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileViewport, () => false);
}
