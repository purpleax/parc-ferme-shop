import { Counter, Magnetic, Reveal, SpeedCanvas, TiltCard, useParallax } from '../components/fx';
import { Link } from 'react-router-dom';

const TIMELINE = [
  {
    year: '2019',
    title: 'The Archive Opens',
    body: 'Parc Fermé began as a personal sale — thirty authenticated pieces from founder James Bellingham\'s private collection, each with documented provenance, catalogued and listed online over a single weekend. The collection sold out in six hours. The emails that followed were from collectors with items of their own. It became clear there was a market.',
  },
  {
    year: '2020',
    title: 'Team Partnerships',
    body: 'Three former constructors approached Parc Fermé to handle consignments from retiring mechanics, engineers and logistics staff. COVID-19 paused the championship but accelerated the business: teams clearing physical storage offered engineering drawings, tools, pit equipment and race components in quantities never previously available. The first steering wheels and gearboxes entered the archive.',
  },
  {
    year: '2021',
    title: 'Authentication Formalized',
    body: 'Dr Elena Marchetti — motorsport historian, archivist and former FIA technical consultant — joined as Head of Provenance. Every piece now passes through a documented authentication chain: broadcast footage matching, team records verification, condition assessment under controlled lighting, and tamper-proof certificate tagging traceable to the archive database. The waiting list for appraisal reached 400 items.',
  },
  {
    year: '2022',
    title: 'The Vault Goes Live',
    body: 'The full e-commerce platform launched, replacing a simple landing page and email-based sales system. The new store introduced public browsing, category filtering, a provenance-first product structure, and secure checkout. 2,000 pieces were catalogued in the opening eight months. API documentation was published for partner integrations.',
  },
  {
    year: '2023',
    title: 'Driver Partnerships',
    body: 'Signed agreements with four current and three retired Formula 1 drivers to represent their personal memorabilia collections exclusively through Parc Fermé. The first driver consignment — a race-worn helmet collection spanning a nine-season career — generated 4,100 enquiries within 48 hours of listing. A dedicated auction format was developed for single pieces of exceptional value.',
  },
  {
    year: '2024',
    title: 'Global Expansion',
    body: 'Fulfilment partnerships established in North America, Japan and the Gulf region to support growing collector bases in markets where Formula 1 viewership has grown most rapidly since 2019. International shipping now covers 78 countries with insured, climate-controlled delivery protocols and customs documentation prepared to museum repatriation standards.',
  },
  {
    year: '2025',
    title: 'Security Research Platform',
    body: 'The Parc Fermé platform was selected as the reference implementation for a series of API security and bot management research initiatives. The store\'s public-facing API and commerce flows provide a realistic environment for testing CDN behaviour, WAF rules, rate limiting, and client-side detection strategies — all without exposing real customer data or financial transactions.',
  },
];

const VALUES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Provenance First',
    body: 'Every item in the archive carries a documented chain of custody from the moment it left the paddock. We reject pieces we cannot authenticate, regardless of apparent value or seller credibility. The certificate is not a formality; it is the product.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: 'Radical Transparency',
    body: 'Condition assessments are published without euphemism. Race-worn means worn hard, and we say so. Age, wear, and imperfection are part of what authenticates a piece. Our condition reports describe what we see, not what we wish were there.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: 'Collector-Led',
    body: 'We are collectors ourselves. The criteria we apply to acquisitions are the same criteria we would apply to adding a piece to our own collection. We do not buy to flip; we source to archive. Collectors who trust us with consignments have often held their pieces for a decade or more.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Preservation Standard',
    body: 'Climate-controlled storage at consistent temperature and humidity. UV-filtered display cases. Acid-free tissue and archival-grade packaging for every dispatch. We operate to museum storage standards because the pieces we hold are, in a meaningful sense, motorsport history.',
  },
];

const TEAM = [
  {
    name: 'James Bellingham',
    role: 'Founder & Curator',
    bio: 'Fifteen years covering Formula 1 for Autosport, Motorsport Magazine and the Financial Times. Holder of an estimated 400 pieces of authenticated memorabilia. Former FIA press delegate, 2011–2019.',
    initial: 'JB',
  },
  {
    name: 'Dr Elena Marchetti',
    role: 'Head of Provenance & Authentication',
    bio: 'Motorsport historian and archivist. Former technical consultant to the FIA for historic classification. Published author of three books on F1 technical history. Expert witness in several high-profile authentication disputes.',
    initial: 'EM',
  },
  {
    name: 'Kwame Asante',
    role: 'Head of Commercial Partnerships',
    bio: 'Previously managed brand partnerships for two Formula 1 teams across three seasons. Responsible for all team and driver consignment agreements. Coordinates Grands Prix acquisition schedule.',
    initial: 'KA',
  },
  {
    name: 'Yuki Nakamura',
    role: 'Operations & Fulfilment',
    bio: 'Logistics background spanning fine art transport and museum repatriation. Designed the current insured, climate-controlled dispatch protocol used for all pieces valued over £5,000. Based in Tokyo; manages Pacific-region partnerships.',
    initial: 'YN',
  },
];

export function About() {
  const parallaxRef = useParallax(18);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[60vh] items-center overflow-hidden bg-carbon">
        <div
          className="absolute inset-0 opacity-25"
          aria-hidden
          style={{ backgroundImage: 'radial-gradient(800px 400px at 70% 50%, rgba(225,6,0,0.3), transparent 65%)' }}
        />
        <SpeedCanvas className="absolute inset-0 h-full w-full" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-28 sm:px-6">
          <div ref={parallaxRef}>
            <p className="animate-fade-up flex items-center gap-3 text-[11px] font-semibold tracking-[0.35em] text-muted uppercase">
              <span className="inline-block h-px w-10 bg-accent" aria-hidden />
              The archive behind the archive
            </p>
            <h1 className="font-display animate-fade-up mt-6 text-5xl leading-[1.04] font-bold uppercase md:text-7xl" style={{ animationDelay: '90ms' }}>
              About<br />
              <span className="text-outline">Parc</span> Fermé<span className="text-accent">.</span>
            </h1>
            <p className="animate-fade-up mt-7 max-w-xl text-base leading-relaxed text-muted" style={{ animationDelay: '180ms' }}>
              We exist because authenticated Formula 1 memorabilia deserves a home that takes provenance
              as seriously as the paddock takes performance data.
            </p>
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">01 — The mission</p>
            <h2 className="font-display mt-3 text-3xl uppercase md:text-4xl">Provenance is<br />the product</h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="space-y-4 text-sm leading-loose text-muted">
              <p>
                Parc Fermé was founded in 2019 by James Bellingham, a motorsport journalist who had spent fifteen years trackside covering Formula 1 for major European automotive and financial publications. Having personally handled race-worn garments, signed photographs and engineering components during press access, Bellingham identified a consistent gap: authenticated memorabilia was either locked in private collections inaccessible to fans, or sold through auction houses at prices and with provenance standards that left serious collectors unsatisfied.
              </p>
              <p>
                The business began as a personal project — a curated sale of thirty pieces from Bellingham's own archive, each with documented provenance, photographed and catalogued to publication standard, listed on a purpose-built store over a single weekend. The entire collection sold in six hours. The enquiries that followed — from collectors with pieces of their own, seeking a trusted platform — made clear that the market existed and was substantially underserved.
              </p>
              <p>
                Six years later, Parc Fermé has become the reference platform for authenticated Formula 1 memorabilia: a catalogue of over 2,400 pieces past and present, relationships with former constructors, current drivers and a network of paddock insiders stretching across seven decades of the sport. Every piece carries our name. Every piece has earned it.
              </p>
              <p className="text-xs italic text-muted/60">
                Parc Fermé is a fictional demonstration store created for API security and CDN research. All products, people, and transactions described are simulated.
              </p>
            </div>
          </Reveal>
        </div>

        {/* stats row */}
        <div className="mt-16 grid grid-cols-2 gap-6 border-t border-line/60 pt-16 md:grid-cols-4">
          {([
            [2418, '', 'pieces archived'],
            [58, '', 'drivers represented'],
            [6, '', 'founding year (2019)'],
            [78, '', 'countries served'],
          ] as [number, string, string][]).map(([value, suffix, label]) => (
            <Reveal key={label}>
              <p className="font-display text-4xl text-accent">
                <Counter value={value} suffix={suffix} />
              </p>
              <p className="mt-2 text-[10px] font-semibold tracking-[0.25em] text-muted uppercase">{label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className="border-y border-line/60 bg-graphite/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">02 — The story</p>
            <h2 className="font-display mt-3 mb-12 text-3xl uppercase md:text-4xl">Six years in the making</h2>
          </Reveal>
          <div className="relative">
            {/* vertical rule */}
            <div className="absolute top-0 left-[3.5rem] hidden h-full w-px bg-line/60 md:block" aria-hidden />
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <Reveal key={item.year} delay={i * 60}>
                  <div className="flex gap-8">
                    <div className="hidden w-28 shrink-0 md:block">
                      <span className="font-display text-lg text-accent">{item.year}</span>
                    </div>
                    <div className="relative hidden md:flex md:items-start md:pt-1">
                      <div className="absolute left-[-1.5rem] top-[0.4rem] h-3 w-3 rounded-full border-2 border-accent bg-carbon" />
                    </div>
                    <div className="flex-1 rounded-2xl border border-line/70 bg-panel p-7 transition hover:border-accent/40">
                      <p className="mb-1 font-display text-sm text-accent md:hidden">{item.year}</p>
                      <h3 className="font-display text-lg uppercase">{item.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">03 — How we work</p>
          <h2 className="font-display mt-3 mb-12 text-3xl uppercase md:text-4xl">Four principles, no exceptions</h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-line/70 bg-panel p-7 transition hover:border-accent/50">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition group-hover:bg-accent group-hover:text-carbon">
                  {v.icon}
                </div>
                <h3 className="font-display mb-3 text-base uppercase">{v.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{v.body}</p>
                <span className="absolute inset-x-0 bottom-0 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" aria-hidden />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Team ── */}
      <section className="border-t border-line/60 bg-graphite/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">04 — The team</p>
            <h2 className="font-display mt-3 mb-12 text-3xl uppercase md:text-4xl">The people in the garage</h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((member, i) => (
              <Reveal key={member.name} delay={i * 70}>
                <TiltCard className="h-full rounded-2xl border border-line/70 bg-panel p-7 transition hover:border-accent/40">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                    <span className="font-display text-lg font-bold text-accent">{member.initial}</span>
                  </div>
                  <h3 className="font-display text-base uppercase">{member.name}</h3>
                  <p className="mt-0.5 text-[11px] font-semibold tracking-[0.15em] text-accent uppercase">{member.role}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">{member.bio}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden border-t border-line/60">
        <div
          className="absolute inset-0"
          aria-hidden
          style={{ backgroundImage: 'radial-gradient(700px 300px at 50% 120%, rgba(225,6,0,0.22), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-3xl leading-tight uppercase md:text-5xl">
              The vault is open<span className="text-accent">.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
              Browse the current archive, or reach out if you have a piece seeking provenance and a permanent home.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Magnetic>
                <Link
                  to="/shop"
                  className="inline-block rounded-full bg-accent px-8 py-4 text-sm font-bold tracking-wide text-carbon uppercase transition hover:bg-accent-light"
                >
                  Browse the vault
                </Link>
              </Magnetic>
              <Magnetic>
                <Link
                  to="/information#contact"
                  className="inline-block rounded-full border border-snow/25 px-8 py-4 text-sm font-semibold tracking-wide text-snow uppercase transition hover:border-snow hover:bg-snow/10"
                >
                  Get in touch
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
