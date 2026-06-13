import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Category, Product } from '../lib/types';
import { formatPrice } from '../lib/format';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ui';
import { Counter, Magnetic, Marquee, Reveal, SpeedCanvas, TiltCard, useParallax } from '../components/fx';

const CIRCUITS = ['Monaco', 'Monza', 'Spa', 'Suzuka', 'Silverstone', 'Interlagos', 'Imola', 'Zandvoort'];

function Hero({ featured }: { featured: Product | null }) {
  const parallaxRef = useParallax(22);
  const [imgOk, setImgOk] = useState(true);

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-carbon">
      {/* layered backdrop */}
      {imgOk && (
        <img
          src="/api/images/products/hero-f1.jpg"
          alt=""
          aria-hidden
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 45%, black 100%)' }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-carbon via-carbon/85 to-carbon/30" aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(900px 480px at 75% 80%, rgba(225,6,0,0.22), transparent 65%)',
        }}
      />
      <SpeedCanvas className="absolute inset-0 h-full w-full" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div ref={parallaxRef}>
          <p className="animate-fade-up flex items-center gap-3 text-[11px] font-semibold tracking-[0.35em] text-muted uppercase">
            <span className="inline-block h-px w-10 bg-accent" aria-hidden />
            Authenticated Formula 1 memorabilia
          </p>
          <h1 className="font-display animate-fade-up mt-6 text-5xl leading-[1.04] font-bold uppercase md:text-7xl" style={{ animationDelay: '90ms' }}>
            Own
            <br />
            <span className="text-outline">the</span> apex<span className="text-accent">.</span>
          </h1>
          <p className="animate-fade-up mt-7 max-w-md text-base leading-relaxed text-muted" style={{ animationDelay: '180ms' }}>
            Race-worn, signed and certified. Pieces that crossed the line first —
            sourced from teams, drivers and the people who were in the garage when it happened.
          </p>
          <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: '260ms' }}>
            <Magnetic>
              <Link
                to="/shop"
                className="inline-block rounded-full bg-accent px-8 py-4 text-sm font-bold tracking-wide text-carbon uppercase transition hover:bg-accent-light"
              >
                Enter the vault
              </Link>
            </Magnetic>
            <Magnetic>
              <Link
                to="/shop?badge=race-worn&sort=newest"
                className="inline-block rounded-full border border-snow/25 px-8 py-4 text-sm font-semibold tracking-wide text-snow uppercase transition hover:border-snow hover:bg-snow/10"
              >
                New arrivals
              </Link>
            </Magnetic>
          </div>
        </div>

        {/* interactive featured piece */}
        {featured && (
          <TiltCard className="hidden rounded-3xl lg:block">
            <Link
              to={`/product/${featured.slug}`}
              className="block overflow-hidden rounded-3xl border border-line/80 bg-panel/80 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={featured.image} alt={featured.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-carbon/80 via-transparent" aria-hidden />
                <span className="absolute top-4 left-4 rounded-full bg-accent px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-carbon uppercase">
                  Piece of the week
                </span>
              </div>
              <div className="flex items-end justify-between gap-4 p-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.25em] text-muted uppercase">{featured.category?.name}</p>
                  <p className="font-display mt-1.5 text-lg leading-snug">{featured.name}</p>
                </div>
                <p className="font-display shrink-0 text-xl text-accent">{formatPrice(featured.priceCents)}</p>
              </div>
            </Link>
          </TiltCard>
        )}
      </div>

      {/* telemetry strip */}
      <div className="absolute inset-x-0 bottom-0 border-t border-line/60 bg-carbon/70 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-5 sm:px-6 md:grid-cols-4">
          {[
            [2418, '', 'pieces archived'],
            [312, '', 'race-worn artifacts'],
            [58, '', 'drivers represented'],
            [100, '%', 'provenance verified'],
          ].map(([value, suffix, label]) => (
            <div key={label as string}>
              <p className="font-display text-2xl text-snow md:text-3xl">
                <Counter value={value as number} suffix={suffix as string} />
              </p>
              <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Home() {
  const [featured, setFeatured] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    api<{ items: Product[] }>('/products/featured')
      .then((res) => setFeatured(res.items))
      .catch(() => setFeatured([]));
    api<{ categories: Category[] }>('/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => setCategories([]));
  }, []);

  return (
    <div>
      <Hero featured={featured?.[0] ?? null} />

      <Marquee items={CIRCUITS} />

      {/* Latest acquisitions */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">01 — The vault</p>
              <h2 className="font-display mt-3 text-3xl uppercase md:text-4xl">Latest acquisitions</h2>
            </div>
            <Link to="/shop" className="hidden shrink-0 text-sm font-semibold text-muted transition hover:text-accent md:block">
              View the full archive →
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {featured === null
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : featured.slice(0, 8).map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
        </div>
      </section>

      {/* Categories mosaic */}
      <section className="border-y border-line/60 bg-graphite/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">02 — Collections</p>
            <h2 className="font-display mt-3 mb-10 text-3xl uppercase md:text-4xl">Six ways in</h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {(categories ?? Array.from({ length: 6 })).map((c, i) =>
              c ? (
                <Reveal key={(c as Category).slug} delay={i * 60} className={i < 2 ? 'col-span-2 md:col-span-2 lg:col-span-2' : 'lg:col-span-1'}>
                  <Link
                    to={`/shop?category=${(c as Category).slug}`}
                    className="group relative block overflow-hidden rounded-2xl border border-line/60"
                  >
                    <img
                      src={(c as Category).image}
                      alt={(c as Category).name}
                      className={`w-full object-cover transition duration-700 group-hover:scale-105 ${i < 2 ? 'aspect-[16/9] lg:aspect-[2/1]' : 'aspect-[4/5]'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-carbon/85 via-carbon/20 to-transparent transition group-hover:from-carbon/70" aria-hidden />
                    <span className="font-display absolute top-3 right-4 text-sm text-snow/40">0{i + 1}</span>
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="font-display text-snow uppercase">{(c as Category).name}</p>
                      <p className="mt-0.5 text-xs text-muted">{(c as Category).productCount} pieces</p>
                    </div>
                  </Link>
                </Reveal>
              ) : (
                <div key={i} className={`skeleton rounded-2xl ${i < 2 ? 'col-span-2 aspect-[2/1]' : 'aspect-[4/5]'}`} />
              )
            )}
          </div>
        </div>
      </section>

      {/* Provenance process */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">03 — Provenance</p>
          <h2 className="font-display mt-3 mb-10 max-w-xl text-3xl uppercase md:text-4xl">
            Every piece earns its place
          </h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['Authenticate', 'Team letters, photo-matching against broadcast footage and tamper-proof certificate tags on every artifact.'],
            ['Archive', 'Climate-controlled storage, condition-logged on arrival and before dispatch. Nothing leaves uncatalogued.'],
            ['Deliver', 'Insured, tracked and crated to museum standard. Race-worn pieces travel with their paperwork, always.'],
          ].map(([title, body], i) => (
            <Reveal key={title} delay={i * 90}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-line/70 bg-panel p-6 transition hover:border-accent/50">
                <span className="font-display text-5xl text-snow/10 transition group-hover:text-accent/25">0{i + 1}</span>
                <h3 className="font-display mt-4 text-lg uppercase">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
                <span className="absolute right-0 bottom-0 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" aria-hidden />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-line/60">
        <div
          className="absolute inset-0"
          aria-hidden
          style={{ backgroundImage: 'radial-gradient(700px 320px at 50% 120%, rgba(225,6,0,0.25), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl leading-tight uppercase md:text-5xl">
              The chequered flag drops
              <br />
              <span className="text-outline">once.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
              Most pieces in the vault exist in single figures. When they find a home, they're gone.
            </p>
            <div className="mt-9">
              <Magnetic>
                <Link
                  to="/shop?sort=newest"
                  className="inline-block rounded-full bg-snow px-8 py-4 text-sm font-bold tracking-wide text-carbon uppercase transition hover:bg-accent"
                >
                  Browse new arrivals
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
