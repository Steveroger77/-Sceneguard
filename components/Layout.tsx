import React from 'react';
import { LayoutDashboard, Camera, Images, Eye, Sparkles, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: any) => void;
  onResetApiKey: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, onResetApiKey }) => {
  const navItems = [
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create-reference', label: 'New Reference', icon: Camera },
    { id: 'monitor', label: 'Monitor Scene', icon: Eye },
    { id: 'photo-compare', label: 'Compare Photos', icon: Images },
  ];

  return (
    <div className="flex h-screen w-full text-fog-accent selection:bg-fog-accent selection:text-fog-base overflow-hidden relative">
      {/* Sidebar - Floating, Rounded, Glassy */}
      <aside className="group fixed top-4 left-4 bottom-4 z-[100] bg-black/40 backdrop-blur-2xl border border-white/5 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] w-20 hover:w-72 overflow-hidden shadow-2xl hover:shadow-black/50 rounded-[40px]">
        
        {/* Logo Section */}
        <div className="h-24 flex items-center px-0 mb-2 whitespace-nowrap overflow-hidden relative">
             {/* Icon container */}
            <div className="w-20 flex justify-center shrink-0">
               <div className="w-10 h-10 bg-gradient-to-tr from-fog-accent/80 to-white/90 text-fog-base rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-fog-accent/20 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110">
                 S
               </div>
            </div>
            {/* Text */}
            <span className="absolute left-20 font-bold text-2xl tracking-tight text-white/90 opacity-0 group-hover:opacity-100 transition-all duration-200 delay-75 transform translate-x-4 group-hover:translate-x-0">
              SceneGuard
            </span>
        </div>

        {/* Navigation */}
        <nav className="px-0 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center h-14 transition-all duration-200 whitespace-nowrap overflow-hidden relative group/btn ${
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {/* Active Background Pill */}
                 {isActive && (
                  <div className="absolute left-3 right-3 top-0 bottom-0 bg-white/10 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md transition-all duration-200"></div>
                )}
                
                {/* Icon Wrapper */}
                <div className="w-20 flex items-center justify-center shrink-0 z-10 relative">
                   <Icon className={`w-6 h-6 transition-all duration-200 ${isActive ? 'text-white scale-110 drop-shadow-glow' : ''} group-hover/btn:scale-110`} />
                </div>
                
                {/* Label */}
                <span className={`font-medium z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 delay-75 transform translate-x-4 group-hover:translate-x-0 absolute left-20 ${isActive ? 'font-semibold tracking-wide' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative flex flex-col pl-28 transition-all duration-300">
        <header className="h-20 flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-white/90 capitalize tracking-tight drop-shadow-sm">
            {currentView.replace('-', ' ')}
          </h1>
          <div className="flex items-center gap-4">
             {currentView !== 'features' && (
                <button 
                    onClick={onResetApiKey}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                    title="Reset API Key"
                >
                    <LogOut className="w-4 h-4" />
                    Reset API Key
                </button>
             )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 pr-6 pb-6 scroll-smooth">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;