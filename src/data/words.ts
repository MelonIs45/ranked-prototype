// Word lists for the fictional world. Every artist, title and username is generated from these.

export const ARTIST_A = [
  'Velvet', 'Neon', 'Paper', 'Silver', 'Hollow', 'Crimson', 'Lunar', 'Static', 'Glass', 'Amber', 'Cobalt', 'Midnight', 'Polar',
  'Golden', 'Quiet', 'Electric', 'Wild', 'Tidal', 'Copper', 'Violet', 'Saffron', 'Echo', 'Northern', 'Cinder', 'Marble', 'Orbit',
];
export const ARTIST_B = [
  'Satellites', 'Lanterns', 'Foxes', 'Harbor', 'Atlas', 'Parade', 'Signal', 'Gardens', 'Engines', 'Choir', 'Kites', 'Monarchs',
  'Tides', 'Machines', 'Comets', 'Arcade', 'Ferns', 'District', 'Cassette', 'Avenue', 'Rituals', 'Pilots', 'Weather', 'Moths',
];
export const ARTIST_SOLO = [
  'Mirelle', 'Kaito Arashi', 'DJ Pellucid', 'Soren Vale', 'Hikari Nanase', 'MC Driftwood', 'Yuna Sora', 'Lio Marchetti', 'Ten Forks',
  'Aster Bloom', 'R0B0TIKA', 'Seo-yeon Park', 'Kyrie Fall', 'Maru & Hoshi', 'Juno Reyes-Quill', 'Bellwether', 'Okami Drive',
];
export const TITLE_A = [
  'Glasshouse', 'Paper', 'Weightless', 'Electric', 'Silent', 'Falling', 'Endless', 'Midnight', 'Crystal', 'Sunlit', 'Broken',
  'Northbound', 'Little', 'Wandering', 'Hyper', 'Distant', 'Blue', 'Faded', 'Golden', 'Restless', 'Hidden', 'Starlit', 'Velocity',
  'Lantern', 'Bittersweet', 'Summer', 'Winter', 'Afterglow', 'Ghost', 'Daybreak',
];
export const TITLE_B = [
  'Summer', 'Hearts', 'Machine', 'Skyline', 'Letters', 'Rain', 'Horizon', 'Signals', 'Gardens', 'Runaway', 'Lullaby', 'Overdrive',
  'Satellite', 'Bloom', 'Highway', 'Mirage', 'Echoes', 'Frontier', 'Paradise', 'Static', 'Promise', 'Carousel', 'Comet', 'Waltz',
  'Kaleidoscope', 'Arcadia', 'Nocturne', 'Tempest', 'Reverie', 'Daydream',
];
export const NAME_A = [
  'Lumi', 'Kiro', 'Nova', 'Mochi', 'Pixel', 'Hana', 'Zephyr', 'Taro', 'Yuzu', 'Rin', 'Sable', 'Juniper', 'Koi', 'Vex', 'Momo',
  'Orrin', 'Pip', 'Aki', 'Nimbus', 'Sora', 'Tamsin', 'Quill', 'Ember', 'Wren', 'Bix', 'Lark', 'Indigo', 'Fable', 'Cosmo', 'Ruri',
  'Dex', 'Mika', 'Nori', 'Plume', 'Rook', 'Sumi', 'Tilde', 'Umi', 'Vale', 'Wisp', 'Yori', 'Zen', 'Clove', 'Brio', 'Ash', 'Kumo',
];
export const NAME_B = [
  'fox', 'wave', 'beat', 'lark', 'tide', 'byte', 'drop', 'moth', 'kite', 'loop', 'spark', 'step', 'rush', 'note', 'bloom', 'cat',
  'drift', 'flux', 'glow', 'hop', 'jam', 'mint', 'nya', 'pop', 'ray', 'snow', 'tap', 'vibe', 'wing', 'zest',
];
export const COUNTRIES = ['US', 'JP', 'KR', 'DE', 'FR', 'BR', 'PL', 'CA', 'GB', 'AU', 'CN', 'TW', 'ID', 'PH', 'CL', 'SE', 'FI', 'NL', 'ES', 'MX', 'TH', 'RU', 'UA', 'IT'];

export const GENRES = [
  'Western pop', 'J-pop', 'K-pop', 'Electronic', 'Drum and bass', 'Rock', 'Metal', 'Classical', 'Hip hop', 'Game music', 'Video game OST', 'Folk',
];
export const LANGUAGES = ['English', 'Japanese', 'Korean', 'Instrumental', 'Chinese', 'Spanish', 'German', 'French', 'Other'];
export const SKILL_TAGS = ['aim', 'stream', 'tech', 'reading', 'high SV', 'alt', 'finger control', 'low AR', '1/8 sliderstreams', 'burst', 'precision'];
export const DIFF_NAMES = ['Easy', 'Normal', 'Hard', 'Insane', 'Extra', 'Expert'];

export const MV_CATALOGUE = [
  { check: 'Unsnapped object', severity: 'unrankable', message: 'Slider tail at 01:12:345 is unsnapped by 4 ms in [Insane].' },
  { check: 'Audio bitrate too high', severity: 'unrankable', message: 'Audio file is 320 kbps; the maximum is 192 kbps.' },
  { check: 'Missing preview point', severity: 'minor', message: 'No preview point is set for the song select screen.' },
  { check: 'Inconsistent metadata', severity: 'unrankable', message: 'Artist field differs between [Hard] and [Extra].' },
  { check: 'Background too large', severity: 'warning', message: 'Background is 3840×2160; recommended maximum is 2560×1440.' },
  { check: 'Overlapping objects in Normal', severity: 'warning', message: '2 circles overlap in [Normal] at 00:48:120.' },
  { check: 'Offset differs across diffs', severity: 'warning', message: '[Easy] uses a 6 ms different offset from the other difficulties.' },
] as const;

export const GRAVEYARD_BLURBS = [
  'A 7-minute marathon with a custom storyboard, hand-drawn hitsounds and a 40-page design document. Never found a third nominator.',
  'Experimental low-AR reading map built around the song\'s tempo changes. Every difficulty mirrors one movement of the piece.',
  'Collab with four guest mappers; abandoned when the album was delisted.',
  'Tech map with unusual rhythm choices that split every modder who looked at it.',
  '',
  'Spread with full hitsound set; waiting on a metadata check that never came.',
  '',
  'High SV showcase with timing points for every syllable.',
  '',
  'Folk ballad with slow, flowing patterns. Mapper moved on to other projects.',
];

export const BN_REQUEST_LINES = [
  'Send a forum PM with the map link and your preferred difficulty for me to check.',
  'Open on weekends only. I prefer maps with a full spread.',
  'Mod queue in my profile; I reply within a week.',
  'I only take Level Design maps with unusual rhythm ideas.',
  'Please include a short note about what you want feedback on.',
  'Mechanics maps welcome; I check stream and aim maps fastest.',
  'Closed for now, but leave a message and I will get back when I can.',
];

export const PORTFOLIO_LINES = [
  'I have modded over 120 maps in the past year, mostly Level Design maps with unusual rhythm choices, and I try to leave notes that explain intent rather than only rules.',
  'My focus is metadata and timing checks on long maps; I also run a weekly modding queue for new mappers.',
];
