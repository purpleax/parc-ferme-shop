import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  challengeConfigured,
  challengeFailOpen,
  CHALLENGE_TIMEOUT_MS,
  loadChallengeScript,
  type ChallengeStatus,
} from '../lib/fastlyChallenge';

interface FastlyChallengeValue {
  /** Whether the Fastly challenge integration is configured for this build. */
  configured: boolean;
  status: ChallengeStatus;
  /** True when the device is verified — or when the feature is dormant/fail-open. */
  verified: boolean;
}

const FastlyChallengeContext = createContext<FastlyChallengeValue>({
  configured: false,
  status: 'inactive',
  verified: true,
});

export function FastlyChallengeProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ChallengeStatus>(challengeConfigured ? 'started' : 'inactive');

  useEffect(() => {
    if (!challengeConfigured) return;
    const el = containerRef.current;
    if (!el) return;

    const read = () => {
      const next = (el.getAttribute('data-challenge-status') as ChallengeStatus) || 'started';
      setStatus(next);
    };
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ['data-challenge-status'] });

    let failTimer: ReturnType<typeof setTimeout> | undefined;
    void loadChallengeScript().then((loaded) => {
      if (!loaded) {
        // Script couldn't load (no Fastly edge, blocked asset, …).
        setStatus('error');
        return;
      }
      read();
      if (challengeFailOpen) {
        failTimer = setTimeout(() => {
          setStatus((s) => (s === 'complete' || s === 'captcha_prompted' ? s : 'error'));
        }, CHALLENGE_TIMEOUT_MS);
      }
    });
    read();

    return () => {
      observer.disconnect();
      if (failTimer) clearTimeout(failTimer);
    };
  }, []);

  const verified =
    !challengeConfigured || status === 'complete' || (challengeFailOpen && status === 'error');

  return (
    <FastlyChallengeContext.Provider value={{ configured: challengeConfigured, status, verified }}>
      {children}
      {challengeConfigured && (
        // Single interactive challenge mount. Hidden until Fastly prompts an
        // interactive (CAPTCHA) challenge, then surfaced as a discreet panel.
        <div className={`fastly-challenge-mount ${status === 'captcha_prompted' ? 'is-visible' : ''}`}>
          <p className="fastly-challenge-title">Quick security check</p>
          <div ref={containerRef} className="fastly-challenge" data-challenge-status="started" />
          <p className="fastly-challenge-note">Verifying your device with Fastly Bot Management.</p>
        </div>
      )}
    </FastlyChallengeContext.Provider>
  );
}

export function useDeviceVerification() {
  return useContext(FastlyChallengeContext);
}
