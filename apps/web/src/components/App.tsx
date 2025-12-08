import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';
import { useLaunchParams, useSignal, miniApp } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { routes } from '@/navigation/routes.tsx';
import { BottomNavigation } from './BottomNavigation';
import { Login } from './Login';
import { useAuth } from '@/hooks/useAuth';

export function App() {
  const lp = useLaunchParams();
  const isDark = useSignal(miniApp.isDark);
  const { authenticated, loading: authLoading } = useAuth();

  // If still loading auth, show loading
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 bg-base-100 text-base-content">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-sm text-base-content text-opacity-70">Memuat...</p>
      </div>
    );
  }

  // If not authenticated, show login
  if (!authenticated) {
    const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'KodetamaBot';
    return (
      <AppRoot
        appearance={isDark ? 'dark' : 'light'}
        platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
      >
        <Login
          isMiniApp={false}
          botUsername={BOT_USERNAME}
          onTelegramAuth={async (user: any) => {
            // Handle widget auth - for now, redirect to bot
            window.location.href = `https://t.me/${BOT_USERNAME}`;
          }}
          error={null}
          isLoading={false}
        />
      </AppRoot>
    );
  }

  // Authenticated - show main app
  const isFinanceRoute = (pathname: string) => {
    return ['/', '/transactions', '/budget', '/google'].includes(pathname);
  };

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <HashRouter>
        <Routes>
          {routes.map((route) => <Route key={route.path} {...route} />)}
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
        {isFinanceRoute(window.location.pathname) && <BottomNavigation />}
      </HashRouter>
    </AppRoot>
  );
}