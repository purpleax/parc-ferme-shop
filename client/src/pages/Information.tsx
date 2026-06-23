import { useState, type FormEvent } from 'react';
import { Counter, Magnetic, Marquee, Reveal, SpeedCanvas, TiltCard, useParallax } from '../components/fx';

const CHAMPIONS_MARQUEE = [
  'Fangio', 'Ascari', 'Hawthorn', 'Hill', 'Clark', 'Surtees', 'Hulme',
  'Stewart', 'Fittipaldi', 'Lauda', 'Scheckter', 'Jones', 'Rosberg',
  'Prost', 'Senna', 'Mansell', 'Villeneuve', 'Häkkinen', 'Schumacher',
  'Räikkönen', 'Alonso', 'Button', 'Vettel', 'Hamilton', 'Verstappen',
];

const ERAS = [
  {
    index: '01',
    years: '1950 – 1959',
    name: 'The Pioneer Age',
    tag: 'Front-engine · Drum brakes · Naturally aspirated',
    driver: 'Juan Manuel Fangio',
    stat: '5 World Championships',
    accent: '#e10600',
    body: `Formula One was officially inaugurated at Silverstone on 13 May 1950, in the presence of King George VI. The inaugural season featured six rounds and was dominated by the Alfa Romeo Alfetta 158 — a pre-war design so fast it left all comers behind. José Froilán González gave Ferrari its first Grand Prix victory at Silverstone in 1951, igniting a rivalry that would define the decade. Juan Manuel Fangio, the Argentinian maestro, became the sport's first superstar — clinching five World Championship titles across four different constructors: Alfa Romeo, Maserati, Mercedes-Benz and Ferrari. His technical mastery and racecraft under pressure set standards that endured for generations. The cars were brutally simple: front-mounted engines, drum brakes, no seatbelts, no roll hoops. Courage was as important as talent.`,
  },
  {
    index: '02',
    years: '1960 – 1969',
    name: 'The British Invasion',
    tag: 'Rear-engine revolution · Monocoque chassis · Cosworth DFV',
    driver: 'Jim Clark',
    stat: '2 titles · 25 wins',
    accent: '#ffc845',
    body: `The 1960s transformed Formula 1 from a wealthy gentleman's pursuit into a technological arms race. Cooper's rear-engine layout, initially dismissed, proved decisively faster and by 1961 every competitive team had adopted it. Colin Chapman's Lotus pioneered the stressed-skin monocoque chassis and later broke ground in aerodynamics. Jim Clark, universally regarded as the most naturally gifted driver of the era, won back-to-back titles in 1963 and 1965 and took Lotus to victory at Indianapolis. The decade closed with the Ford Cosworth DFV — an engine available to customer teams — democratising the grid and ushering in an era of British constructors that lasted two decades. Commercial sponsorship arrived too: Gold Leaf Lotus in 1968 was the first team to abandon traditional national racing colours for a sponsor's livery, changing motorsport's economics forever.`,
  },
  {
    index: '03',
    years: '1970 – 1979',
    name: 'Speed & Shadow',
    tag: 'Ground effect · Wide slick tyres · Sponsorship era',
    driver: 'Niki Lauda',
    stat: '2 titles · Survived the Nürburgring',
    accent: '#ff7a00',
    body: `The seventies brought speed and tragedy in equal measure. Tobacco and oil money flooded the grid. The sport faced its darkest moments at the old Nürburgring: Niki Lauda's 1976 firestorm crash — trapped in burning wreckage for nearly a minute before fellow drivers dragged him free — left him with severe burns and lung damage. He returned to race just six weeks later. Lauda versus James Hunt — Austrian precision against British bravado — captivated a global audience in a season that oscillated to the final race in Japan. Colin Chapman's Lotus 78 and 79 exploited ground effect by channelling airflow under the car through shaped underbody tunnels, generating enormous downforce without the drag penalty of wings. Cars became significantly faster, significantly more dependent on aerodynamics, and for the first time, dangerously affected by following another car through turbulent air.`,
  },
  {
    index: '04',
    years: '1980 – 1993',
    name: 'The Turbo Wars',
    tag: '1,500 bhp qualifying engines · Carbon composites · Senna vs Prost',
    driver: 'Ayrton Senna',
    stat: '3 titles · 65 poles',
    accent: '#f5f5f7',
    body: `Renault introduced the turbocharged 1.5-litre engine in 1977. Within four seasons every leading team ran forced induction, and by 1986 dedicated qualifying engines briefly produced over 1,500 horsepower for a single timed lap before the turbo era was banned for 1989. Carbon fibre arrived in 1981 with McLaren's MP4/1, offering a survival cell vastly stronger than its aluminium predecessors. The decade's defining drama was the combustible relationship between Alain Prost and Ayrton Senna at McLaren Honda. Their collision at Suzuka in 1989 — and again in 1990 — handed championships in a manner the sport had never before witnessed. Senna's genius was transcendent: his wet-weather drives at Monaco and Donington; his qualifying laps that left the telemetry engineers speechless; his ability to enter corners at speeds others considered impossible. His death at Imola on 1 May 1994 prompted the most comprehensive safety overhaul in the sport's history and changed Formula 1 irrevocably.`,
  },
  {
    index: '05',
    years: '1994 – 2013',
    name: 'The Schumacher Epoch',
    tag: 'Traction control · Launch control · Ferrari resurgence',
    driver: 'Michael Schumacher',
    stat: '7 World Championships · 91 wins',
    accent: '#e10600',
    body: `Michael Schumacher's seven World Championship titles and 91 race victories define an era. After winning back-to-back titles with Benetton in 1994 and 1995 — years marked by controversy at Adelaide and brilliant dominance at circuits across the globe — Schumacher joined Ferrari and began one of sport's great reconstruction projects. The five consecutive titles from 2000 to 2004, achieved alongside designer Rory Byrne and technical director Ross Brawn, were delivered with a ruthless testing regime and an almost mechanical consistency. After Schumacher's first retirement, a new generation emerged: Kimi Räikkönen delivered the 2007 title to Ferrari with a single point; Fernando Alonso took back-to-back crowns for Renault; Jenson Button triumphed with the Brawn GP fairy-tale of 2009, a team assembled from Honda's cancelled project; Sebastian Vettel then dominated four consecutive seasons for Red Bull, rewriting records and producing a 2011 campaign of almost flawless execution.`,
  },
  {
    index: '06',
    years: '2014 – Present',
    name: 'The Hybrid Era',
    tag: '1.6L V6 power units · ERS · 1,000 bhp hybrid power',
    driver: 'Lewis Hamilton',
    stat: '7 titles · 103 wins · 104 poles',
    accent: '#00d2be',
    body: `The 2014 power unit regulations introduced 1.6-litre turbocharged V6 engines with complex energy recovery systems — heat recovery (MGU-H) and kinetic recovery (MGU-K) — combining to produce in excess of 1,000 horsepower. Mercedes dominated the opening years with a unit so far ahead of the competition that rival manufacturers openly questioned the regulations. Lewis Hamilton became the sport's most statistically accomplished driver, matching Schumacher's seven championships in 2020 and breaking records for wins, poles and podiums that many had believed would stand for decades. The 2021 season — Hamilton versus Max Verstappen, separated by eight points at the final corner of the final race in Abu Dhabi — was decided in circumstances that prompted an FIA investigation and a complete restructuring of race director protocols. Verstappen's dominance from 2022 onward, culminating in 19 victories from 22 races in 2023, represented a new benchmark for seasonal performance. Formula 1 has never been faster, safer, or more globally watched.`,
  },
];

const CIRCUITS = [
  {
    name: 'Monaco',
    code: 'MCO',
    location: 'Monte Carlo, Principality of Monaco',
    firstGP: 1929,
    lapRecord: '1:12.909 — Leclerc, 2021',
    length: '3.337 km',
    description: 'The jewel in Formula 1\'s crown. Narrow barriers, unforgiving walls, zero margin for error. Monaco rewards perfection above all else. Drivers spend more time within centimetres of concrete than at any other circuit on the calendar. A single mistake ends your race. There are circuits that are faster, circuits that are wider, but none that carry the weight of history and prestige of Monte Carlo. Winners here enter a different category of driver entirely.',
    accent: 'border-blue-500/40',
    labelColor: 'text-blue-400',
  },
  {
    name: 'Monza',
    code: 'MNZ',
    location: 'Lombardy, Italy',
    firstGP: 1950,
    lapRecord: '1:21.046 — Barrichello, 2004',
    length: '5.793 km',
    description: 'The Temple of Speed. Monza\'s long straights and minimal downforce setup produce the highest average speeds in Formula 1. The tifosi — Ferrari\'s devoted faithful — pack the grandstands in their tens of thousands, creating an atmosphere unlike anywhere else in sport. The Parabolica, the Lesmos, the Variante Ascari: corners that have defined the sport\'s mythology for over seventy years. To win at Monza is to become part of the religion.',
    accent: 'border-red-500/40',
    labelColor: 'text-red-400',
  },
  {
    name: 'Spa-Francorchamps',
    code: 'SPA',
    location: 'Ardennes, Belgium',
    firstGP: 1950,
    lapRecord: '1:41.252 — Bottas, 2018',
    length: '7.004 km',
    description: 'Seven kilometres of the Ardennes forest. Eau Rouge, Raidillon, Pouhon — corners that ask fundamental questions of driver courage. Spa is the circuit drivers most universally consider the finest in the world: fast, technical, changeable, and utterly unforgiving. Weather can shift from dry to monsoon within a single lap of a circuit that crosses three distinct microclimates. Championship points have been decided here in ways no other track can replicate.',
    accent: 'border-emerald-500/40',
    labelColor: 'text-emerald-400',
  },
  {
    name: 'Silverstone',
    code: 'SIL',
    location: 'Northamptonshire, England',
    firstGP: 1950,
    lapRecord: '1:27.097 — Hamilton, 2020',
    length: '5.891 km',
    description: 'Where it all started. The first World Championship Grand Prix was held here on 13 May 1950. Built on a wartime RAF airfield, Silverstone has evolved from a flat perimeter road into one of the world\'s finest racing facilities. Maggotts, Becketts and Chapel — the ultra-high-speed esses — are among the most demanding sequences in modern Formula 1. The British crowd is reliably vast, knowledgeable, and unafraid of the weather.',
    accent: 'border-slate-400/40',
    labelColor: 'text-slate-300',
  },
  {
    name: 'Suzuka',
    code: 'SUZ',
    location: 'Mie Prefecture, Japan',
    firstGP: 1987,
    lapRecord: '1:30.983 — Hamilton, 2019',
    length: '5.807 km',
    description: 'Designed by John Hugenholtz in 1962 as a Honda test facility, Suzuka is the only figure-eight circuit in Formula 1. 130R, the Esses, Degner Curve — Suzuka demands a rhythm and commitment that separates the very good from the great. Japan has hosted some of the sport\'s most pivotal moments: the Senna-Prost collisions of 1989 and 1990, Schumacher\'s 2000 title for Ferrari, and Hamilton\'s record-equalling seventh championship in 2018.',
    accent: 'border-pink-500/40',
    labelColor: 'text-pink-400',
  },
  {
    name: 'Interlagos',
    code: 'INT',
    location: 'São Paulo, Brazil',
    firstGP: 1973,
    lapRecord: '1:10.540 — Barrichello, 2004',
    length: '4.309 km',
    description: 'Autódromo José Carlos Pace carries the name of a Brazilian hero. In a country that produced Fittipaldi, Piquet and Senna, this race carries emotional weight beyond any other on the calendar. The crowd is deafening, the racing unpredictable, and the circuit — short, bumpy, counter-clockwise — produces drama season after season. The 2008 title decider at Interlagos, resolved in the final corner of the final lap, remains among sport\'s most extraordinary finales.',
    accent: 'border-amber-500/40',
    labelColor: 'text-amber-400',
  },
];

const RECORDS = [
  { label: 'Most Race Wins', holder: 'Lewis Hamilton', value: '103', note: 'McLaren / Mercedes, 2007–2024' },
  { label: 'Most Pole Positions', holder: 'Lewis Hamilton', value: '104', note: 'McLaren / Mercedes, 2007–2024' },
  { label: 'Most World Championships', holder: 'Hamilton & Schumacher', value: '7 each', note: 'Mercedes (2014–20) · Ferrari (2000–04)' },
  { label: 'Most Wins in a Season', holder: 'Max Verstappen', value: '19 of 22', note: 'Red Bull Racing, 2023' },
  { label: 'Most Podiums', holder: 'Lewis Hamilton', value: '197', note: 'McLaren / Mercedes, 2007–2024' },
  { label: 'Youngest World Champion', holder: 'Sebastian Vettel', value: '23 yrs 134 days', note: 'Red Bull Racing, 2010' },
  { label: 'Oldest World Champion', holder: 'Giuseppe Farina', value: '44 yrs 55 days', note: 'Alfa Romeo, 1950' },
  { label: 'Most Starts', holder: 'Fernando Alonso', value: '400', note: 'Renault / McLaren / Ferrari / Alpine' },
];

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } catch {
      // fire and forget — endpoint may not exist
    } finally {
      setBusy(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="font-display text-2xl uppercase">Thank you</h3>
        <p className="max-w-sm text-sm text-muted">Your message has been received. We'll be in touch from the pit lane.</p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-graphite/70 px-4 py-3 text-sm text-snow outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Name</label>
        <input
          type="text"
          required
          placeholder="Your name"
          value={form.name}
          onChange={update('name')}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Email</label>
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={form.email}
          onChange={update('email')}
          className={inputClass}
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Message</label>
        <textarea
          required
          rows={5}
          placeholder="Tell us about the piece you're looking for, a consignment enquiry, or simply say hello…"
          value={form.message}
          onChange={update('message')}
          className={`${inputClass} resize-none`}
        />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Magnetic>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-bold tracking-wide text-carbon uppercase transition hover:bg-accent-light disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send message'}
          </button>
        </Magnetic>
      </div>
    </form>
  );
}

export function Information() {
  const parallaxRef = useParallax(20);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-carbon">
        <div
          className="absolute inset-0 opacity-30"
          aria-hidden
          style={{ backgroundImage: 'radial-gradient(900px 500px at 60% 60%, rgba(225,6,0,0.28), transparent 65%)' }}
        />
        <SpeedCanvas className="absolute inset-0 h-full w-full" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-28 sm:px-6">
          <div ref={parallaxRef}>
            <p className="animate-fade-up flex items-center gap-3 text-[11px] font-semibold tracking-[0.35em] text-muted uppercase">
              <span className="inline-block h-px w-10 bg-accent" aria-hidden />
              75 years of the world's greatest motorsport
            </p>
            <h1 className="font-display animate-fade-up mt-6 text-5xl leading-[1.04] font-bold uppercase md:text-7xl" style={{ animationDelay: '90ms' }}>
              The History of<br />
              <span className="text-outline">Formula</span> One<span className="text-accent">.</span>
            </h1>
            <p className="animate-fade-up mt-7 max-w-xl text-base leading-relaxed text-muted" style={{ animationDelay: '180ms' }}>
              From Silverstone 1950 to the present day — the champions, the circuits,
              the controversies, and the technology that made the fastest spectacle on earth.
            </p>
          </div>
        </div>

        {/* stats strip */}
        <div className="absolute inset-x-0 bottom-0 border-t border-line/60 bg-carbon/70 backdrop-blur">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-5 sm:px-6 md:grid-cols-4">
            {([
              [75, '', 'seasons raced'],
              [34, '', 'world champions'],
              [1109, '+', 'grands prix'],
              [77, '', 'circuits used'],
            ] as [number, string, string][]).map(([value, suffix, label]) => (
              <div key={label}>
                <p className="font-display text-2xl text-snow md:text-3xl">
                  <Counter value={value} suffix={suffix} />
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Era timeline ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">01 — The eras</p>
          <h2 className="font-display mt-3 mb-12 text-3xl uppercase md:text-4xl">Seven decades of racing</h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2">
          {ERAS.map((era, i) => (
            <Reveal key={era.index} delay={i * 60}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-line/70 bg-panel p-8 transition hover:border-accent/40">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-display text-[11px] tracking-[0.3em] text-muted uppercase">{era.years}</span>
                    <h3 className="font-display mt-1 text-xl uppercase">{era.name}</h3>
                  </div>
                  <span className="font-display shrink-0 text-5xl font-bold text-snow/8 transition group-hover:text-accent/20">
                    {era.index}
                  </span>
                </div>
                <p className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">{era.tag}</p>
                <p className="text-sm leading-relaxed text-muted">{era.body}</p>
                <div className="mt-6 flex items-center justify-between border-t border-line/40 pt-5">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">Icon of the era</p>
                    <p className="font-display mt-0.5 text-sm">{era.driver}</p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
                    style={{ borderColor: era.accent + '60', color: era.accent }}>
                    {era.stat}
                  </span>
                </div>
                <span className="absolute inset-x-0 bottom-0 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" aria-hidden />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Champions marquee ── */}
      <Marquee items={CHAMPIONS_MARQUEE} />

      {/* ── Circuits ── */}
      <section className="border-y border-line/60 bg-graphite/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">02 — The cathedrals</p>
            <h2 className="font-display mt-3 mb-12 text-3xl uppercase md:text-4xl">Circuits that made the myth</h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CIRCUITS.map((c, i) => (
              <Reveal key={c.code} delay={i * 70}>
                <TiltCard className={`h-full rounded-2xl border bg-panel p-7 transition ${c.accent}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`font-display text-xs font-bold tracking-[0.3em] uppercase ${c.labelColor}`}>{c.code}</span>
                    <span className="font-display text-3xl font-bold text-snow/6 uppercase">{c.name[0]}</span>
                  </div>
                  <h3 className="font-display text-xl uppercase">{c.name}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">{c.location}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">{c.description}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line/40 pt-5 text-[10px]">
                    <div>
                      <p className="font-semibold tracking-[0.2em] text-muted uppercase">First GP</p>
                      <p className="mt-0.5 font-display text-snow">{c.firstGP}</p>
                    </div>
                    <div>
                      <p className="font-semibold tracking-[0.2em] text-muted uppercase">Circuit length</p>
                      <p className="mt-0.5 font-display text-snow">{c.length}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold tracking-[0.2em] text-muted uppercase">Lap record</p>
                      <p className="mt-0.5 font-display text-snow">{c.lapRecord}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Long-form history ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-16 lg:grid-cols-[2fr_1fr]">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">03 — The deep archive</p>
              <h2 className="font-display mt-3 mb-10 text-3xl uppercase md:text-4xl">The sport in full</h2>
            </Reveal>

            <div className="space-y-8 text-sm leading-loose text-muted">
              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">The technical evolution</h3>
                <p>
                  Formula 1's technical regulations have changed more dramatically than any other major motorsport series. In 1950, the cars were essentially pre-war designs: front-mounted supercharged engines, live rear axles, drum brakes, and no aerodynamic consideration beyond minimising frontal area. The drivers sat fully upright in open cockpits, receiving no crash protection whatsoever. By the end of the decade, disc brakes had arrived — Jaguar had pioneered them at Le Mans in 1953, and Formula 1 followed shortly after.
                </p>
                <p className="mt-4">
                  The rear-engine revolution that Cooper initiated in 1958 transformed not only where the power was delivered but how the entire car balanced through corners. With the engine behind the driver and the fuel load centralised, the cars could be smaller, lighter, and — critically — faster through the turns. Within three seasons, the front-engined layout was obsolete. Lotus, Brabham, and BRM all followed. Those who did not were left competing for minor points positions.
                </p>
                <p className="mt-4">
                  Aerodynamics arrived in earnest in 1968 when Lotus and Ferrari both debuted rear wings during the same weekend at Spa. The wings were tall, narrow, and mounted high above the bodywork to catch undisturbed air. They worked — cornering speeds increased dramatically — but structural failures at Lotus in 1969 led to broken wings at speed and fatal accidents. Regulations quickly mandated that wings be mounted to the body and not the suspension.
                </p>
              </Reveal>

              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">Ground effect and the downforce era</h3>
                <p>
                  Colin Chapman's ground effect concept — using the underbody of the car as an inverted wing, creating a region of low pressure beneath the car to suck it towards the track — transformed Formula 1 more than any other single innovation. The Lotus 78 in 1977 and its successor the 79 in 1978 demonstrated that a carefully shaped underbody, sealed at the sides by flexible skirts running along the road surface, could generate cornering loads previously unimaginable. Cars that had been generating perhaps two to three times their weight in downforce were now producing five or six times as much — and the weight distribution was more consistent across speed ranges than wing downforce.
                </p>
                <p className="mt-4">
                  The effect on lap times was immediate and dramatic. Circuits were left with tyre marks further from the apex than any previous generation had placed them. Racing lines shifted, braking points moved, corner entry speeds climbed. The problem was that the cars became almost undriveable when following another closely: the leading car's turbulent wake destroyed the trailing car's ground effect entirely, making overtaking nearly impossible and relegating racing to the quality of qualifying laps.
                </p>
                <p className="mt-4">
                  Flat underbodies were mandated for 1983, and the sport spent the following three decades attempting to reintroduce beneficial aerodynamics without recreating the ground effect problem. It was not until 2022 that Venturi tunnels — a controlled, regulated version of the original concept — returned to Formula 1 as the primary downforce-generating mechanism, with results that were broadly positive for overtaking in the opening seasons.
                </p>
              </Reveal>

              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">Safety: from tragedy to transformation</h3>
                <p>
                  Formula 1's safety record in its first four decades was appalling by any modern standard. Drivers accepted death as an occupational hazard. Between 1950 and 1994, over twenty drivers lost their lives in competition. The circuits were often lined with barriers — or nothing at all. Straw bales fronted telegraph poles at some venues. Marshals worked without fire protection. Fuel systems were primitive; post-crash fires were common and often fatal.
                </p>
                <p className="mt-4">
                  The death of Ayrton Senna at Imola in May 1994 — in the same weekend that Roland Ratzenberger also died — finally forced systemic change at the highest levels of motorsport governance. Professor Sid Watkins, the FIA's chief medical delegate, had long advocated for improvements. Post-Imola, a rapid programme of circuit modification, cockpit reinforcement, tyre barrier installation, and medical facility upgrading was implemented across the entire calendar. Steering column failures were investigated and redesigned. Survival cells were mandated to withstand extraordinary impact loads.
                </p>
                <p className="mt-4">
                  The HANS device — Head and Neck Support — became mandatory in 2003, addressing one of the most common fatal injury mechanisms. The Halo protection system, which deflects debris from the cockpit aperture, was introduced in 2018 over considerable driver objection and subsequently credited with saving lives at multiple incidents including Charles Leclerc's 2020 Bahrain crash, where a portion of Romain Grosjean's Haas penetrated the cockpit at head height. By the 2020s, Formula 1 had become one of the safest forms of high-speed motorsport, a transformation its founding generation would have considered impossible.
                </p>
              </Reveal>

              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">The business of Formula One</h3>
                <p>
                  Formula 1 began as an amateur endeavour. Enzo Ferrari operated his team as a commercial necessity — he sold road cars to fund racing. The British constructors of the 1960s were small engineering shops working on budgets that a modern team would consider a rounding error. Commercial television rights were unknown. Sponsorship was absent until Lotus's 1968 deal with Imperial Tobacco's Gold Leaf brand. The sport's commercial potential was barely recognised.
                </p>
                <p className="mt-4">
                  Bernie Ecclestone changed everything. A former driver turned team manager turned Brabham owner, Ecclestone recognised that Formula 1's rights were fragmented, undervalued, and poorly managed. Over the 1970s and 1980s he consolidated control of television rights, negotiating deals that brought the sport to a global audience and generated revenues that dwarfed anything previously associated with motor racing. By the 1990s, Formula 1 was one of the world's most watched annual sporting events, broadcast in over 180 countries.
                </p>
                <p className="mt-4">
                  Liberty Media's acquisition of Formula 1 in 2017 began a further transformation. The Drive to Survive Netflix documentary series, first broadcast in 2019, introduced the sport to a new generation of fans — younger, more diverse, and heavily concentrated in North American markets where Formula 1 had historically struggled. Race attendance and television viewership grew substantially across three seasons. New Grands Prix in Miami and Las Vegas reflected the commercial shift. Budget caps, introduced in 2021, began to address the competitive imbalance between large and small teams, though their effects have been gradual and contested.
                </p>
              </Reveal>

              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">The drivers: character and craft</h3>
                <p>
                  What separates Formula 1 from other forms of motorsport — and from most sport entirely — is that its champions are required to synthesise physical courage, technical intelligence, and political acuity in roughly equal measure. A driver who can produce a qualifying lap of startling brilliance but cannot guide the development of their car over a season will not win a title. A driver who understands the engineering deeply but lacks the nerve to commit to a blind fast corner under pressure will similarly fall short.
                </p>
                <p className="mt-4">
                  The greatest champions have each possessed something additional to raw speed. Fangio had an almost mystical ability to read races and preserve machinery. Jim Clark was described by his peers as operating on a different plane — his car control, reportedly, was so fine that he drove largely by feel, with a sensitivity to tyre load and oversteer that his engineers could only attempt to understand through data. Senna's qualifying laps — including the famous 1988 Monaco effort where he was lapping over two seconds faster than his teammate before crashing out of a trance-like state — remain the subject of analysis decades later.
                </p>
                <p className="mt-4">
                  Michael Schumacher brought a new dimension: the driver as the totality of the team's focus. His testing work ethic, his tyre management, his ability to produce identical lap times on demand rather than fastest laps sporadically — these were tools that previous generations had not possessed, or had not deployed so systematically. Lewis Hamilton combined Schumacher's systematic approach with Senna's raw wet-weather brilliance and a political intelligence that has allowed him to remain competitive across four distinct regulatory eras. Max Verstappen has added to this mix an aggression in wheel-to-wheel racing and a raw speed in qualifying that statisticians have compared favourably to any driver who preceded him.
                </p>
              </Reveal>

              <Reveal>
                <h3 className="font-display mb-3 text-lg text-snow uppercase">The power unit arms race</h3>
                <p>
                  Formula 1 has run on supercharged pre-war engines, naturally aspirated four-cylinders, eight, ten, twelve and sixteen-cylinder engines of varying displacement, turbocharged units of extraordinary power density, and — since 2014 — sophisticated hybrid power units that represent the most thermally efficient internal combustion system ever deployed in competition. The 2014 power units achieved thermal efficiency approaching 50 percent; conventional production engines operate at around 30 percent. The MGU-H, which harvests energy from exhaust gases passing through the turbocharger and uses it to spin the turbo faster or generate electricity, has no civilian application and was developed entirely for Formula 1.
                </p>
                <p className="mt-4">
                  The regulations introduced for 2026 will remove the MGU-H — its complexity and cost having been identified as a barrier to new manufacturer entry — and increase the electrical power contribution to approximately 350 kilowatts, compared to around 160 kilowatts today. Sustainable fuels, composed from non-fossil carbon sources, will become mandatory. The aspiration is a power unit that is both the highest-performance in automotive history and, by the standards of competition engines, meaningfully connected to the road car industry's electrification trajectory.
                </p>
              </Reveal>
            </div>
          </div>

          {/* sidebar */}
          <aside className="space-y-6">
            <Reveal>
              <div className="sticky top-24 space-y-5">
                {/* pull quote */}
                <div className="rounded-2xl border border-accent/30 bg-accent/5 p-7">
                  <span className="font-display text-5xl leading-none text-accent">"</span>
                  <p className="mt-2 text-base font-medium leading-relaxed text-snow">
                    You commit, or you don't. There is no almost in Formula One.
                  </p>
                  <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">— Ayrton Senna</p>
                </div>

                {/* fast facts */}
                <div className="rounded-2xl border border-line/70 bg-panel p-6">
                  <p className="mb-4 text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">Fast facts</p>
                  <ul className="space-y-3 text-sm">
                    {[
                      ['Top speed reached', '397.36 km/h (Valtteri Bottas, 2016)'],
                      ['Heaviest car (regulation)', '800 kg (2023 min. weight)'],
                      ['Fastest pit stop', '1.82 seconds (Red Bull, 2023)'],
                      ['Most races in a season', '24 (2024 calendar)'],
                      ['Prize money distributed', '~$1.18 billion (2022)'],
                      ['Teams on 2024 grid', '10 constructors'],
                      ['Nationalities of champions', '14 distinct nations'],
                      ['First female world champion', 'Record still to be set'],
                    ].map(([fact, val]) => (
                      <li key={fact as string} className="flex flex-col gap-0.5 border-b border-line/40 pb-3 last:border-0 last:pb-0">
                        <span className="text-[10px] font-semibold tracking-[0.15em] text-muted uppercase">{fact}</span>
                        <span className="font-display text-xs text-snow">{val}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* second quote */}
                <div className="rounded-2xl border border-line/70 bg-panel p-6">
                  <span className="font-display text-4xl leading-none text-snow/30">"</span>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-snow">
                    Second place is just the first loser.
                  </p>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">— Michael Schumacher</p>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>

      {/* ── Records ── */}
      <section className="border-t border-line/60 bg-graphite/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">04 — The numbers</p>
            <h2 className="font-display mt-3 mb-10 text-3xl uppercase md:text-4xl">Records that define the sport</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RECORDS.map((r, i) => (
              <Reveal key={r.label} delay={i * 50}>
                <div className="group rounded-2xl border border-line/70 bg-panel p-6 transition hover:border-accent/40">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">{r.label}</p>
                  <p className="font-display mt-3 text-2xl text-accent">{r.value}</p>
                  <p className="mt-2 text-sm font-medium text-snow">{r.holder}</p>
                  <p className="mt-1 text-[11px] text-muted">{r.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="relative overflow-hidden border-t border-line/60">
        <div
          className="absolute inset-0"
          aria-hidden
          style={{ backgroundImage: 'radial-gradient(700px 320px at 50% 110%, rgba(225,6,0,0.18), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-accent uppercase">05 — Contact</p>
            <h2 className="font-display mt-3 mb-2 text-3xl uppercase md:text-4xl">Get in touch</h2>
            <p className="mb-10 text-sm text-muted">
              Enquiries about pieces, consignments, provenance, or anything else — drop us a message from the pit wall.
            </p>
            <div className="rounded-2xl border border-line/70 bg-panel p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
