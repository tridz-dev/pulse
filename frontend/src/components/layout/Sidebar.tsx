import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    CheckSquare,
    Users,
    Network,
    PanelLeftClose,
    PanelLeft,
    Search,
    LogOut,
    FileText,
    BarChart3
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ThemeToggle } from '../shared/ThemeToggle';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from '../ui/dropdown-menu';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
    /** Force full expanded nav regardless of `collapsed` — used when rendering inside the mobile drawer. */
    forceExpanded?: boolean;
    /** Called after a nav link is clicked — used to close the mobile drawer on navigation. */
    onNavigate?: () => void;
    /** Explicitly opens the global command search dialog (owned by AppLayout). Always opens —
     * never toggles — so clicking this button while the dialog is already open is a no-op. */
    onOpenSearch: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, forceExpanded = false, onNavigate, onOpenSearch }: SidebarProps) {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const isCollapsed = forceExpanded ? false : collapsed;

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'My Tasks', path: '/tasks', icon: CheckSquare },
        { name: 'Team', path: '/team', icon: Users, hideFor: ['Pulse User'] },
        { name: 'Operations', path: '/operations', icon: Network, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'Insights', path: '/insights', icon: BarChart3, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'SOP Templates', path: '/templates', icon: FileText, hideFor: ['Pulse User'] },
    ];

    return (
        <aside
            aria-label="Primary navigation"
            className={cn(
                "flex flex-col h-full bg-slab border-r border-rule shrink-0 transition-all duration-300",
                isCollapsed ? "w-[52px]" : "w-[240px]"
            )}
        >
            {/* Workspace Header */}
            <div className="h-12 flex items-center shrink-0 mt-2 mb-4 hover:bg-slab-2 cursor-pointer mx-2 rounded-sm transition-colors gap-2 px-2">
                <div className="w-5 h-5 rounded-sm bg-slab-2 flex items-center justify-center text-[10px] font-mono font-bold text-text flex-shrink-0">
                    P
                </div>
                {!isCollapsed && <span className="font-medium text-sm text-text truncate">Pulse</span>}
            </div>

            {!isCollapsed && (
                <div className="px-3 mb-6">
                    {/* The real search affordance is the global Cmd/Ctrl+K shortcut (registered in
                        CommandSearch, mounted in AppLayout) so it keeps working even when this
                        button disappears at collapsed width. This button explicitly opens the
                        same dialog (via the shared `open` state owned by AppLayout) for
                        discoverability when the sidebar is expanded — it always opens, never
                        toggles, so clicking it while the dialog is already open is a no-op. */}
                    <button
                        type="button"
                        onClick={onOpenSearch}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-mute bg-slab-2 border border-rule rounded-sm hover:bg-slab-2 transition-colors"
                        aria-label="Search tasks, people, and operations"
                    >
                        <Search size={14} className="text-mute" />
                        <span>Search...</span>
                        <div className="ml-auto flex items-center gap-0.5 opacity-60">
                            <kbd className="font-mono px-1 rounded-sm bg-slab-2 border border-rule text-[10px]">⌘</kbd>
                            <kbd className="font-mono px-1 rounded-sm bg-slab-2 border border-rule text-[10px]">K</kbd>
                        </div>
                    </button>
                </div>
            )}

            {/* Navigation Links */}
            <div className={cn("flex-1 overflow-y-auto scrollbar-none", isCollapsed ? "px-2 space-y-0.5" : "px-3 space-y-0.5")}>
                {!isCollapsed && (
                    <div className="px-2 mb-2 mt-4 text-[11px] font-semibold text-faint uppercase tracking-wider">
                        Workspace
                    </div>
                )}
                {navItems.map((item) => {
                    if (item.hideFor?.includes(currentUser?.systemRole || '')) return null;

                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={item.name}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center rounded-sm text-sm transition-all duration-200 group relative",
                                isCollapsed ? "justify-center p-2" : "gap-2.5 px-2 py-1.5",
                                isActive
                                    ? "bg-slab-2 text-text font-medium border-l-2 border-l-sel"
                                    : "text-mute hover:bg-slab-2 hover:text-text"
                            )}
                        >
                            <item.icon
                                size={16}
                                className={cn(
                                    "transition-colors flex-shrink-0",
                                    isActive ? "text-text" : "text-mute group-hover:text-text"
                                )}
                            />
                            {!isCollapsed && <span className="truncate">{item.name}</span>}
                        </NavLink>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 mt-auto shrink-0 border-t border-rule flex flex-col items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className={cn(
                            "flex items-center gap-2 rounded-sm py-1.5 hover:bg-slab-2 transition-colors outline-none w-full",
                            isCollapsed ? "justify-center px-0" : "px-1.5 text-left"
                        )}
                        title={currentUser?.name}
                        aria-label="User menu"
                    >
                        <Avatar className={cn("rounded-sm border border-rule shrink-0", isCollapsed ? "h-6 w-6" : "h-6 w-6")}>
                            <AvatarImage src={currentUser?.avatarUrl} />
                            <AvatarFallback className="text-[10px] bg-slab-2 text-text rounded-sm">
                                {currentUser?.name?.charAt(0) ?? '?'}
                            </AvatarFallback>
                        </Avatar>
                        {!isCollapsed && (
                            <div className="flex flex-col items-start translate-y-[-1px] min-w-0">
                                <span className="text-xs font-medium leading-none text-text truncate w-full">{currentUser?.name}</span>
                                <span className="text-[10px] leading-none text-faint mt-1 truncate w-full">{currentUser?.role}</span>
                            </div>
                        )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="min-w-56 bg-slab border-rule">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-mute font-mono text-[10px] uppercase tracking-wide">
                                Theme
                            </DropdownMenuLabel>
                            <div className="px-1.5 py-1">
                                <ThemeToggle />
                            </div>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator className="bg-rule" />
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                    void logout();
                                }}
                                className="text-fail data-[variant=destructive]:text-fail"
                            >
                                <LogOut size={14} />
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                {!forceExpanded && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className={cn(
                            "text-mute hover:text-text hover:bg-slab-2 rounded-sm transition-colors flex items-center w-full",
                            isCollapsed
                                ? "justify-center p-2"
                                : "gap-2.5 px-2 py-1.5"
                        )}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                        {!isCollapsed && <span className="text-sm">Collapse</span>}
                    </button>
                )}
            </div>
        </aside>
    );
}
