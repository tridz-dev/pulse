import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export function AppLayout() {
    const { currentUser, isLoading } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                    <p className="text-zinc-400 text-sm">You must be logged in and have a Pulse account to use this app.</p>
                    <a
                        href="/login?redirect-to=/pulse"
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline underline-offset-2"
                    >
                        Go to login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex overflow-hidden bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
            {/* Sidebar */}
            <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((c) => !c)} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative border-l border-zinc-800/60 bg-zinc-950/50">
                <Topbar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <div className="max-w-6xl mx-auto h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
