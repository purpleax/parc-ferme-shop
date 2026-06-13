// Interaction/motion primitives for the studio-grade home page.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ---------- Scroll reveal ---------- */

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('reveal');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------- Speed-streak particle canvas ---------- */

interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  width: number;
  hue: 'red' | 'white' | 'grey';
  alpha: number;
}

export function SpeedCanvas({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: 0.5, y: 0.5, boost: 0 });

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const streaks: Streak[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const spawn = (initial = false): Streak => ({
      x: initial ? Math.random() * width : -200 - Math.random() * 300,
      y: Math.random() * height,
      len: 60 + Math.random() * 220,
      speed: 3 + Math.random() * 9,
      width: Math.random() < 0.2 ? 2 : 1,
      hue: Math.random() < 0.16 ? 'red' : Math.random() < 0.5 ? 'white' : 'grey',
      alpha: 0.05 + Math.random() * 0.22,
    });
    for (let i = 0; i < 90; i++) streaks.push(spawn(true));

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = (e.clientX - rect.left) / rect.width;
      pointer.current.y = (e.clientY - rect.top) / rect.height;
      pointer.current.boost = Math.min(2.4, pointer.current.boost + 0.12);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', resize);

    const colors = {
      red: (a: number) => `rgba(225, 6, 0, ${a})`,
      white: (a: number) => `rgba(245, 245, 247, ${a})`,
      grey: (a: number) => `rgba(150, 150, 165, ${a})`,
    };

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      pointer.current.boost *= 0.96;
      const boost = 1 + pointer.current.boost;
      for (const s of streaks) {
        // streaks nearest the cursor's vertical band run hotter
        const proximity = 1 - Math.min(1, Math.abs(s.y / height - pointer.current.y) * 2.2);
        const v = s.speed * boost * (1 + proximity * 1.6);
        s.x += v;
        if (s.x - s.len > width + 50) Object.assign(s, spawn());
        const grad = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
        const paint = colors[s.hue];
        grad.addColorStop(0, paint(0));
        grad.addColorStop(1, paint(s.alpha * (0.7 + proximity * 0.6)));
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

/* ---------- Mouse parallax ---------- */

export function useParallax(strength = 18) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      el.style.transform = `translate3d(${(-dx * strength).toFixed(1)}px, ${(-dy * strength).toFixed(1)}px, 0)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [strength]);
  return ref;
}

/* ---------- Magnetic button ---------- */

export function Magnetic({ children, className = '' }: { children: ReactNode; className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (prefersReducedMotion()) return;
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const rect = wrap.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    inner.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
  }, []);

  const onLeave = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
    inner.style.transform = 'translate(0, 0)';
    setTimeout(() => {
      if (inner) inner.style.transition = '';
    }, 450);
  }, []);

  return (
    <div ref={wrapRef} className={`inline-block p-3 -m-3 ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* ---------- 3D tilt card with glare ---------- */

export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 14}deg) rotateX(${(0.5 - py) * 12}deg) scale(1.02)`;
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.16), transparent 55%)`;
    }
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = 'perspective(900px) rotateY(0) rotateX(0) scale(1)';
    setTimeout(() => {
      if (el) el.style.transition = '';
    }, 500);
    if (glareRef.current) glareRef.current.style.background = 'transparent';
  }, []);

  return (
    <div ref={ref} className={`relative will-change-transform ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
      <div ref={glareRef} className="pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
    </div>
  );
}

/* ---------- Animated counter ---------- */

export function Counter({ value, suffix = '', duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {display.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

/* ---------- Marquee ---------- */

export function Marquee({ items }: { items: string[] }) {
  const row = items.map((item, i) => (
    <span key={i} className="mx-6 flex items-center gap-6 whitespace-nowrap">
      <span className="font-display text-2xl tracking-wide text-outline uppercase md:text-4xl">{item}</span>
      <span className="h-2 w-2 rotate-45 bg-accent" aria-hidden />
    </span>
  ));
  return (
    <div className="overflow-hidden border-y border-line/70 bg-graphite/40 py-5" aria-hidden>
      <div className="animate-marquee flex w-max">
        <div className="flex">{row}</div>
        <div className="flex">{row}</div>
      </div>
    </div>
  );
}
