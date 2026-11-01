import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLab } from '../store';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-ink-700 py-6">
      <h2 className="h2 mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export function AboutPage() {
  const setTour = useLab((st) => st.setTour);
  const reset = useLab((st) => st.reset);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="h1 mb-2">About Ranked Lab</h1>
      <p className="mb-6 text-slate-300">
        Ranked Lab is a working model of a proposed reform to how beatmaps get ranked. Every rule in the proposal runs here: nominations, the qualified period, NAT review, BN
        membership, the two ranked categories, stars and seasonal rewards. You can play any role and fast-forward time to watch the rules take effect.
      </p>

      <Section id="demo" title="Try it">
        <p>
          The guided tour takes one map from Pending to Ranked to the home top 5 in eight steps, switching between a mapper, two BNs and a NAT member. Each step has a button that
          performs the action for you, so you can watch the result on the page.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setTour({ active: true, step: 0, dismissed: false })}>
            Start the guided tour
          </button>
          <Link to="/beatmaps" className="btn-secondary">
            Browse beatmaps
          </Link>
        </div>
        <p>Outside the tour, pick any user from the switcher at the top right. Buttons you can't use stay visible and explain why when you hover or tap them.</p>
      </Section>

      <Section id="terms" title="Terms of use">
        <p>Ranked Lab is an unofficial concept prototype. It isn't affiliated with, endorsed by or connected to any game, company or community team.</p>
        <p>
          All users, songs, artists, scores and statistics are generated. Any resemblance to a real person, account or recording is a coincidence. Nothing here reflects a decision
          that has been made: the rules and numbers come from a proposal and can be changed on the admin page.
        </p>
        <p>The prototype is provided as is, without warranty of any kind. Don't rely on it for anything beyond exploring the proposal.</p>
      </Section>

      <Section id="licence" title="Licence and credits">
        <p>
          This version of Ranked Lab is styled after osu-web, the open-source website by ppy Pty Ltd. Its colour system, component styles and header artwork are adapted
          from osu-web under the GNU Affero General Public License v3.0, and this version is released under the same licence. The full licence text ships with the
          source code in the LICENCE file.
        </p>
        <p>
          The osu! and ppy names and logos are trademarks of ppy Pty Ltd and are not used here. The Torus and Venera typefaces are licensed separately to ppy, so this
          version uses Nunito instead.
        </p>
        <p>
          Under the AGPL, anyone who uses this site is entitled to its complete source code. It's on GitHub at{' '}
          <a href="https://github.com/MelonIs45/ranked-prototype" target="_blank" rel="noreferrer">
            github.com/MelonIs45/ranked-prototype
          </a>
          .
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>
          Ranked Lab has no accounts, server or analytics. The simulated world, including anything you create or change, is stored only in your browser's local storage on this
          device. Nothing you do here is sent anywhere.
        </p>
        <p>
          The page loads the IBM Plex typefaces from Google Fonts, so your browser makes a request to Google's font servers when the page opens. Google's own privacy policy covers
          that request.
        </p>
        <p>To delete everything Ranked Lab has stored, reset the world below or clear this site's data in your browser settings.</p>
        <button className="btn-secondary" onClick={reset}>
          Reset the world to its starting state
        </button>
      </Section>
    </article>
  );
}
