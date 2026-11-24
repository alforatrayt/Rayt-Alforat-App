/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import {
  DEFAULT_FORM_TEMPLATES,
  DEFAULT_SEASON_POSTERS,
  DEFAULT_SITE_SETTINGS,
} from './data/defaults';
import type {
  FormTemplate,
  PackageCategory,
  SeasonPoster,
  SiteSettings,
  TravelPackage,
} from './types';
import {
  fetchFormTemplateById,
  fetchPublicCategories,
  fetchPublicPackages,
  fetchPublicSeasonPosters,
  fetchSiteSettings,
} from './services/firestoreService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { Header, type PublicRoute } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { PackageDetailView } from './components/PackageDetailView';
import { DynamicBookingView } from './components/DynamicBookingView';
import { TrackBookingView } from './components/TrackBookingView';
import { AdminDashboard, type AdminTab } from './components/admin/AdminDashboard';

function AppShell() {
  const [route, setRoute] = useState<PublicRoute>('home');
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [seasonPosters, setSeasonPosters] = useState<SeasonPoster[]>(DEFAULT_SEASON_POSTERS);
  const [loadingPublic, setLoadingPublic] = useState(true);

  const [selectedPkg, setSelectedPkg] = useState<TravelPackage | null>(null);
  const [activeFormTemplate, setActiveFormTemplate] = useState<FormTemplate>(
    DEFAULT_FORM_TEMPLATES[0]
  );

  const [trackPrefillRef, setTrackPrefillRef] = useState('');
  const [trackPrefillPhone, setTrackPrefillPhone] = useState('');

  // Apply CMS dynamic brand colors to CSS custom properties immediately
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.primaryColor || '#0F332B');
    root.style.setProperty('--brand-secondary', settings.secondaryColor || '#0E6E73');
    root.style.setProperty('--brand-accent', settings.accentColor || '#B88E3E');
    root.style.setProperty('--brand-bg', settings.bgColor || '#F8F4EC');
  }, [settings]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load strict admin-driven public catalog, categories & settings from Firestore
  const loadPublicCatalog = useCallback(async () => {
    setLoadingPublic(true);
    try {
      const [remoteSettings, remoteCategories, remotePackages, remotePosters] = await Promise.all([
        fetchSiteSettings().catch(() => null),
        fetchPublicCategories().catch(() => []),
        fetchPublicPackages().catch(() => []),
        fetchPublicSeasonPosters().catch(() => null),
      ]);

      if (remoteSettings) {
        setSettings(remoteSettings);
      }
      setCategories(remoteCategories || []);
      setPackages(remotePackages || []);

      const dbInitialized = Boolean(remoteSettings);
      let postersInitializedLocally = false;
      try {
        postersInitializedLocally = localStorage.getItem('rf_posters_seeded') === '1';
      } catch {
        postersInitializedLocally = false;
      }

      if (remotePosters !== null) {
        if (remotePosters.length > 0) {
          setSeasonPosters(remotePosters);
        } else if (dbInitialized && postersInitializedLocally) {
          setSeasonPosters([]);
        } else {
          setSeasonPosters(DEFAULT_SEASON_POSTERS);
        }
      } else {
        setSeasonPosters(DEFAULT_SEASON_POSTERS);
      }
    } catch {
      setCategories([]);
      setPackages([]);
      setSeasonPosters(DEFAULT_SEASON_POSTERS);
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  useEffect(() => {
    loadPublicCatalog();
  }, [loadPublicCatalog]);

  const resolveFormForPackage = async (pkg: TravelPackage): Promise<FormTemplate> => {
    const fallback =
      DEFAULT_FORM_TEMPLATES.find((f) => f.id === pkg.formTemplateId) ||
      DEFAULT_FORM_TEMPLATES[0];
    try {
      const remote = await fetchFormTemplateById(pkg.formTemplateId);
      if (remote && remote.fields && remote.fields.length > 0) {
        return remote;
      }
    } catch {
      // use fallback
    }
    return fallback;
  };

  const handleNavigate = (nextRoute: PublicRoute, anchorId?: string) => {
    if (nextRoute === 'admin') {
      setAdminInitialTab('overview');
    }
    setRoute(nextRoute);
    if (anchorId) {
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleManagePosters = () => {
    setAdminInitialTab('posters');
    setRoute('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPackage = async (pkg: TravelPackage) => {
    setSelectedPkg(pkg);
    const form = await resolveFormForPackage(pkg);
    setActiveFormTemplate(form);
    setRoute('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartBooking = async (pkg: TravelPackage) => {
    setSelectedPkg(pkg);
    const form = await resolveFormForPackage(pkg);
    setActiveFormTemplate(form);
    setRoute('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToTrack = (prefillRef?: string, prefillPhone?: string) => {
    setTrackPrefillRef(prefillRef || '');
    setTrackPrefillPhone(prefillPhone || '');
    setRoute('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Full-Screen Admin Dashboard Workspace
  if (route === 'admin') {
    return (
      <AdminDashboard
        user={user}
        authReady={authReady}
        settings={settings}
        initialTab={adminInitialTab}
        onSettingsUpdated={(updated) => setSettings(updated)}
        onPublicDataChanged={loadPublicCatalog}
        onBackToSite={() => handleNavigate('home')}
      />
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--brand-bg)' }}
    >
      <Header
        settings={settings}
        activeRoute={route}
        onNavigate={handleNavigate}
        isStaffSignedIn={Boolean(user)}
      />

      <main className="flex-1">
        {route === 'home' && (
          <HomeView
            settings={settings}
            packages={packages}
            categories={categories}
            posters={seasonPosters}
            loading={loadingPublic}
            isStaffSignedIn={Boolean(user)}
            onSelectPackage={handleSelectPackage}
            onTrackBooking={() => handleGoToTrack()}
            onManagePosters={handleManagePosters}
          />
        )}

        {route === 'detail' && selectedPkg && (
          <PackageDetailView
            pkg={selectedPkg}
            formTemplate={activeFormTemplate}
            settings={settings}
            onBack={() => handleNavigate('home', 'packages-section')}
            onStartBooking={handleStartBooking}
          />
        )}

        {route === 'booking' && selectedPkg && (
          <DynamicBookingView
            pkg={selectedPkg}
            formTemplate={activeFormTemplate}
            settings={settings}
            isLiveInDb={true}
            onBack={() => {
              setRoute('detail');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoToTrack={handleGoToTrack}
            onOpenAdmin={() => handleNavigate('admin')}
          />
        )}

        {route === 'track' && (
          <TrackBookingView
            settings={settings}
            initialRef={trackPrefillRef}
            initialPhone={trackPrefillPhone}
          />
        )}
      </main>

      <Footer settings={settings} onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
