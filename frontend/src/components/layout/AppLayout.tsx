import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { SearchModal } from '../search/SearchModal';

export function AppLayout() {
    const { currentUser, authError, isLoading } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Keyboard shortcut for search (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-8 bg-zinc-800 rounded-full mb-4"></div>
                    <div className="text-zinc-500 text-sm">Loading workspace...</div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        const noProfile = authError && !authError.toLowerCase().includes('not logged in');
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>
                    <p className="text-zinc-200 font-medium text-sm">
                        {noProfile ? 'No Pulse profile found' : 'Authentication required'}
                    </p>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                        {noProfile
                            ? authError
                            : 'Please log in to continue.'}
                    </p>
                    {noProfile ? (
                        <a
                            href="/desk"
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium underline underline-offset-2"
                        >
                            Return to Desk
                        </a>
                    ) : (
                        <a
                            href="/login?redirect-to=/pulse"
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium underline underline-offset-2"
                        >
                            Go to login
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex overflow-hidden bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
            {/* Sidebar */}
            <Sidebar 
                collapsed={sidebarCollapsed} 
                onToggleCollapse={() => setSidebarCollapsed((c) => !c)} 
                onOpenSearch={() => setSearchOpen(true)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative border-l border-zinc-800/60 bg-zinc-950/50">
                <Topbar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <div className="w-full max-w-[min(100%,112rem)] mx-auto h-full">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Search Modal */}
            <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
    );
}
