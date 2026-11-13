import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

export default function RouteFocus() {
  const location = useLocation();
  const initialLocation = useRef(location);

  useEffect(() => {
    const section = location.hash && document.getElementById(location.hash.slice(1));

    if (section) {
      section.focus({ preventScroll: true });
      section.scrollIntoView();
    } else if (location !== initialLocation.current) {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}
