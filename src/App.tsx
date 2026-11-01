import { useEffect } from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ActivityDrawer, Header, PageHeader, Toasts, TourPanel } from './components/Shell';
import { sectionForPath } from './components/sections';
import { AboutPage } from './pages/About';
import { AdminPage } from './pages/Admin';
import { BeatmapPage } from './pages/Beatmap';
import { BeatmapsPage } from './pages/Beatmaps';
import { BNApplyPage } from './pages/BNApply';
import { BNDashboardPage } from './pages/BNDashboard';
import { BNDirectoryPage } from './pages/BNDirectory';
import { HomePage } from './pages/Home';
import { MyMapsPage } from './pages/MyMaps';
import { NATQueuePage } from './pages/NATQueue';
import { PacksPage } from './pages/Packs';
import { ProfilePage } from './pages/Profile';
import { RewardsPage } from './pages/Rewards';
import { SpotlightPage } from './pages/Spotlight';
import { VotesPage } from './pages/Votes';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // Section hue drives every colour (osu-web section_to_hue_map).
    document.body.dataset.section = sectionForPath(pathname).id;
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <div className="flex min-h-screen flex-col">
        <Header />
        <PageHeader />
        <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/beatmaps" element={<BeatmapsPage />} />
            <Route path="/beatmaps/:id" element={<BeatmapPage />} />
            <Route path="/me/maps" element={<MyMapsPage />} />
            <Route path="/bn" element={<BNDashboardPage />} />
            <Route path="/bn/directory" element={<BNDirectoryPage />} />
            <Route path="/bn/apply" element={<BNApplyPage />} />
            <Route path="/nat" element={<NATQueuePage />} />
            <Route path="/votes" element={<VotesPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/packs" element={<PacksPage />} />
            <Route path="/spotlight" element={<SpotlightPage />} />
            <Route path="/users/:id" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<div className="card">Page not found.</div>} />
          </Routes>
        </main>
        <footer className="bg-ink-900">
          <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-4 text-xs text-slate-500">
            <span>Ranked Lab · Unofficial concept prototype · all users, songs and artists are fictional</span>
            <span className="flex-1" />
            <Link to="/about" className="text-slate-400 hover:text-white">About</Link>
            <Link to="/about#terms" className="text-slate-400 hover:text-white">Terms</Link>
            <Link to="/about#privacy" className="text-slate-400 hover:text-white">Privacy</Link>
            <Link to="/about#licence" className="text-slate-400 hover:text-white">Licence (AGPL-3.0)</Link>
            <a href="https://github.com/MelonIs45/ranked-prototype/tree/osu-web-design" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">Source on GitHub</a>
          </div>
        </footer>
      </div>
      <ActivityDrawer />
      <TourPanel />
      <Toasts />
    </HashRouter>
  );
}
