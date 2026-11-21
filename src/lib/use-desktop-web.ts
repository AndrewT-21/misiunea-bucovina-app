import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const DESKTOP_BREAKPOINT = 900;

export function useDesktopWeb() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const updateDesktop = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };

    updateDesktop();

    window.addEventListener('resize', updateDesktop);

    return () => {
      window.removeEventListener('resize', updateDesktop);
    };
  }, []);

  return isDesktop;
}