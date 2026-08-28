import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandSearch } from './CommandSearch';
import { Sheet, SheetContent } from '../ui/sheet';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export function AppLayout() {
    const { currentUser, isLoading } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // Separate axis from `sidebarCollapsed`: mobile drawer visibility, not the desktop icon-rail width.
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    // Owned here (not inside CommandSearch) so the sidebar's search button can explicitly
    // open the dialog instead of toggling it via a synthetic Cmd/Ctrl+K keyboard event.
    const [searchOpen, setSearchOpen] = useState(false);
    const openSearch = () => setSearchOpen(true);

    // If the viewport crosses the md breakpoint while the drawer is open (e.g. rotating a
    // tablet, or resizing a dev window), close it — otherwise its modal backdrop stays
    // mounted over the now-visible desktop layout even though the drawer panel itself
    // is `md:hidden`, blocking the first click until the backdrop's own dismiss logic
    // catches up.
    useEffect(() => {
        const query = window.matchMedia('(min-width: 768px)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (e.matches) setMobileNavOpen(false);
        };
        query.addEventListener('change', handleChange);
        return () => query.removeEventListener('change', handleChange);
    }, []);

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-ink text-text">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-8 bg-slab-2 rounded mb-4"></div>
                    <div className="text-mute text-sm">Loading workspace...</div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-ink text-text">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                    <p className="text-mute text-sm">You must be logged in and have a Pulse account to use this app.</p>
                    <a
                        href="/login?redirect-to=/pulse"
                        className="text-text hover:text-mute text-sm font-medium underline underline-offset-2"
                    >
                        Go to login
                    </a>
                </div>
            </div>
        );
    }

    return (
        // eslint-disable-next-line no-restricted-syntax -- text-selection highlight, the in-spec use of --sel, not a status/card fill
        <div className="h-screen w-full flex overflow-hidden bg-ink text-text font-sans selection:bg-sel/30">
            {/* Global Cmd/Ctrl+K search shortcut — active regardless of sidebar collapse state */}
            <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

            {/* Sidebar — inline on md+, hidden below md (drawer takes over) */}
            <div className="hidden md:flex">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
                    onOpenSearch={openSearch}
                />
            </div>

            {/* Mobile off-canvas drawer */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent
                    side="left"
                    className="p-0 md:hidden data-[side=left]:w-[240px] data-[side=left]:max-w-[240px] data-[side=left]:sm:max-w-[240px]"
                    showCloseButton={false}
                >
                    <Sidebar
                        collapsed={false}
                        forceExpanded
                        onToggleCollapse={() => {}}
                        onNavigate={() => setMobileNavOpen(false)}
                        onOpenSearch={openSearch}
                    />
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative border-l border-rule bg-ink">
                <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
                <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 scrollbar-thin scrollbar-thumb-slab-2 scrollbar-track-transparent">
                    <div className="max-w-6xl mx-auto h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
