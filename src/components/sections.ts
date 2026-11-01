// Site sections, following osu-web's layout: each section has its own hue (see osu-theme.css),
// a header banner and a row of tabs for the pages inside it.
import type { User } from '../engine';

export type SectionId = 'home' | 'beatmaps' | 'community' | 'rankings' | 'help' | 'admin';

export interface SectionPage {
  to: string;
  label: string;
  show?: (u: User) => boolean;
}

export interface Section {
  id: SectionId;
  label: string;
  /** Fixed colour of this section's nav underline (osu-web menu-colour). */
  menuColour: string;
  /** Header artwork from osu-web/public/images/headers. */
  image: string;
  pages: SectionPage[];
  show?: (u: User) => boolean;
}

const isNominator = (u: User) => u.isBN || u.isNAT;

export const SECTIONS: Section[] = [
  { id: 'home', label: 'home', menuColour: 'var(--hsl-purple-1)', image: 'news-show-default.jpg', pages: [{ to: '/', label: 'Dashboard' }] },
  {
    id: 'beatmaps',
    label: 'beatmaps',
    menuColour: 'var(--hsl-blue-1)',
    image: 'generic.jpg',
    pages: [
      { to: '/beatmaps', label: 'Listing' },
      { to: '/me/maps', label: 'My maps', show: (u) => !u.isAdmin },
      { to: '/packs', label: 'Packs' },
    ],
  },
  {
    id: 'community',
    label: 'community',
    menuColour: 'var(--hsl-pink-1)',
    image: 'forum-index.jpg',
    pages: [
      { to: '/bn', label: 'BN dashboard', show: isNominator },
      { to: '/bn/directory', label: 'BN directory' },
      { to: '/bn/apply', label: 'Become a BN', show: (u) => !isNominator(u) && !u.isAdmin },
      { to: '/nat', label: 'NAT queue', show: (u) => u.isNAT },
      { to: '/votes', label: 'Votes', show: (u) => isNominator(u) || u.isAdmin },
    ],
  },
  {
    id: 'rankings',
    label: 'rankings',
    menuColour: 'var(--hsl-green-1)',
    image: 'rankings.jpg',
    pages: [
      { to: '/rewards', label: 'Nominator rewards' },
      { to: '/spotlight', label: 'Spotlight' },
    ],
  },
  { id: 'help', label: 'help', menuColour: 'var(--hsl-orange-1)', image: 'wiki.jpg', pages: [{ to: '/about', label: 'About, terms and privacy' }] },
  { id: 'admin', label: 'admin', menuColour: 'var(--hsl-red-1)', image: 'generic.jpg', pages: [{ to: '/admin', label: 'Lab admin' }], show: (u) => u.isAdmin },
];

export function sectionForPath(path: string): Section {
  const id: SectionId =
    path === '/'
      ? 'home'
      : /^\/(beatmaps|me\/maps|packs)/.test(path)
        ? 'beatmaps'
        : /^\/(bn|nat|votes|users)/.test(path)
          ? 'community'
          : /^\/(rewards|spotlight)/.test(path)
            ? 'rankings'
            : path.startsWith('/about')
              ? 'help'
              : path.startsWith('/admin')
                ? 'admin'
                : 'community';
  return SECTIONS.find((s) => s.id === id)!;
}

/** Header title for a path: the active tab's name, or a page-specific name for detail pages. */
export function titleForPath(path: string, section: Section): string {
  if (/^\/beatmaps\/.+/.test(path)) return 'beatmap info';
  if (path.startsWith('/users/')) return 'player info';
  const page = section.pages.find((p) => (p.to === '/' ? path === '/' : path === p.to));
  return (page?.label ?? section.label).toLowerCase();
}

export function visiblePages(section: Section, u: User): SectionPage[] {
  return section.pages.filter((p) => !p.show || p.show(u));
}
