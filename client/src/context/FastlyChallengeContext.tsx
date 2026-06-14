import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  const [status, setStatus] = useState<ChallengeStatus>(challengeConfigured ? 'started' : 'inactive');

  useEffect(() => {
    if (!challengeConfigured) return;

    // The Fastly challenge script mutates — and on its slower paths can replace —
    // the `.fastly-challenge` node. We build that node OUTSIDE React's tree
    // (appended directly to <body>) and never render it from JSX, so React never
    // reconciles it. Otherwise a third-party DOM mutation inside a React-owned
    // node can throw during reconciliation and blank the whole SPA — which is
    // exactly what happened on Firefox, where the challenge falls back to a
    // proof-of-work flow that injects more into the node.
    document.querySelector('.fastly-challenge-mount')?.remove();

    const mount = document.createElement('div');
    mount.className = 'fastly-challenge-mount';

    const title = document.createElement('p');
    title.className = 'fastly-challenge-title';
    title.textContent = 'Quick security check';

    const el = document.createElement('div');
    el.className = 'fastly-challenge';
    el.setAttribute('data-challenge-status', 'started');

    const note = document.createElement('p');
    note.className = 'fastly-challenge-note';
    note.textContent = 'Verifying your device with Fastly Bot Management.';

    mount.append(title, el, note);
    document.body.appendChild(mount);

    const read = () => {
      const next = (el.getAttribute('data-challenge-status') as ChallengeStatus) || 'started';
      mount.classList.toggle('is-visible', next === 'captcha_prompted');
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
      mount.remove();
    };
  }, []);

  const verified =
    !challengeConfigured || status === 'complete' || (challengeFailOpen && status === 'error');

  return (
    <FastlyChallengeContext.Provider value={{ configured: challengeConfigured, status, verified }}>
      {children}
    </FastlyChallengeContext.Provider>
  );
}

export function useDeviceVerification() {
  return useContext(FastlyChallengeContext);
}
