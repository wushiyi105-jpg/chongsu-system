import { NavLink, Outlet } from 'react-router-dom';
import { Home, PlusCircle, Network, Tags, User } from 'lucide-react';
import { APP_VERSION } from '@client/src/utils/app-version';

const tabs = [
  { path: '/home', label: '首页', icon: Home },
  { path: '/capture', label: '录入', icon: PlusCircle },
  { path: '/graph', label: '图谱', icon: Network },
  { path: '/tags', label: '标签', icon: Tags },
  { path: '/profile', label: '我的', icon: User },
];

const Layout = () => {
  return (
    <div className="min-h-screen bg-canvas flex justify-center">
      <div className="w-full max-w-[480px] flex flex-col min-h-screen relative">
        <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-sm border-b border-border">
          <div className="px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <span className="text-[15px] font-semibold text-text-primary tracking-tight">
                重塑系统
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              {APP_VERSION}
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 pb-[60px]">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-[60px] bg-surface border-t border-border flex items-center justify-around z-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[11px] transition-colors ${
                    isActive
                      ? 'text-text-primary'
                      : 'text-text-tertiary'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
