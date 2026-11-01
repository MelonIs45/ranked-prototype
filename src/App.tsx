import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ActivityDrawer, Header, Toasts, TourPanel } from './components/Shell';
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
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
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
            <Route path="*" element={<div className="card">Page not found.</div>} />
          </Routes>
        </main>
        <footer className="border-t border-ink-800 py-4 text-center text-xs text-slate-500">
          Ranked Lab · Unofficial concept prototype · all users, songs and artists are fictional
        </footer>
      </div>
      <ActivityDrawer />
      <TourPanel />
      <Toasts />
    </HashRouter>
  );
}
