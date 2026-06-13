import { useDeviceVerification } from '../context/FastlyChallengeContext';

function ShieldCheck({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

/**
 * Discreet "device verified" badge driven by Fastly Bot Management's embedded
 * client challenge. Renders nothing when the integration isn't configured, so
 * it's invisible in local dev / CI and only appears behind a Fastly edge.
 *
 * Place it next to the critical action it guards (login, checkout, add-to-cart).
 */
export function DeviceVerification({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { configured, status, verified } = useDeviceVerification();
  if (!configured) return null;

  const pending = status === 'started' || status === 'processing';
  const prompting = status === 'captcha_prompted';
  const unavailable = status === 'error';

  const label = verified && !unavailable
    ? 'Verified by Fastly Bot Management'
    : prompting
      ? 'Security check required'
      : unavailable
        ? 'Device verification unavailable'
        : 'Verifying device with Fastly…';

  const tone = verified && !unavailable ? 'text-muted' : unavailable ? 'text-gold' : 'text-muted';
  const iconColor = verified && !unavailable ? 'text-emerald-400' : prompting || unavailable ? 'text-gold' : 'text-muted';

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'} ${tone} ${className}`}
      role="status"
      title={verified && !unavailable ? 'Fastly Bot Management has verified this device' : label}
      data-challenge-status={status}
    >
      {pending ? (
        <span className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} animate-spin rounded-full border border-current border-t-transparent ${iconColor}`} />
      ) : (
        <ShieldCheck className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${iconColor}`} />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}
