import { useEffect, useState } from 'react';
import { subscribeToClock } from '../utils/relativeTimeClock.mjs';

// Keep relative labels fresh even when SWR correctly skips unchanged responses.
export default function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeToClock(() => setNow(Date.now())), []);

  return now;
}
