import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    CheckSquare,
    Users,
    Network,
    PanelLeftClose,
    PanelLeft,
    Search,
    Bell,
    FileText,
    BarChart3,
    Smartphone,
    Building2,
    FolderTree,
    UserCog,
    ClipboardList,
    Flag,
    Shield,
    Settings as SettingsIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface NavItemConfig {
    name: string;
    path: string;
    icon: LucideIcon;
    showFor?: string[];
    hideFor?: string[];
}

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
    const { currentUser } = useAuth();
    const location = useLocation();

    const navItems: NavItemConfig[] = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'My Tasks', path: '/tasks', icon: CheckSquare },
        { name: 'Pulse Go', path: '/go', icon: Smartphone },
        { name: 'Team', path: '/team', icon: Users, hideFor: ['Pulse User'] },
        { name: 'Operations', path: '/operations', icon: Network, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'Insights', path: '/insights', icon: BarChart3, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'SOP Templates', path: '/templates', icon: FileText, hideFor: ['Pulse User'] },
        { name: 'Corrective Actions', path: '/corrective-actions', icon: Flag, hideFor: ['Pulse User'] },
    ];

    const adminItems: NavItemConfig[] = [
        { name: 'Branches', path: '/admin/branches', icon: Building2, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'Departments', path: '/admin/departments', icon: FolderTree, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'Employees', path: '/admin/employees', icon: UserCog, hideFor: ['Pulse User'] },
        { name: 'Assignments', path: '/admin/assignments', icon: ClipboardList, hideFor: ['Pulse User', 'Pulse Manager'] },
        { name: 'Roles', path: '/admin/roles', icon: Shield, hideFor: ['Pulse User', 'Pulse Manager', 'Pulse Leader'] },
        { name: 'Settings', path: '/admin/settings', icon: SettingsIcon, hideFor: ['Pulse User', 'Pulse Manager', 'Pulse Leader'] },
    ];

    return (
        <aside
            className={cn(
                "flex flex-col h-full bg-[#18181b] border-r border-[#27272a]/50 shrink-0 transition-all duration-300",
                collapsed ? "w-[52px]" : "w-[240px]"
            )}
        >
            {/* Workspace Header */}
            <div className="h-12 flex items-center shrink-0 mt-2 mb-4 hover:bg-zinc-800/50 cursor-pointer mx-2 rounded-md transition-colors gap-2 px-2">
                <div className="w-5 h-5 rounded-sm bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner flex-shrink-0">
                    P
                </div>
                {!collapsed && <span className="font-medium text-sm text-zinc-200 truncate">Pulse</span>}
            </div>

            {!collapsed && (
                <div className="px-3 mb-6">
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800/80 rounded-md hover:bg-zinc-800 transition-colors shadow-sm">
                        <Search size={14} className="text-zinc-500" />
                        <span>Search...</span>
                        <div className="ml-auto flex items-center gap-0.5 opacity-60">
                            <kbd className="font-sans px-1 rounded bg-zinc-800 border border-zinc-700 text-[10px]">⌘</kbd>
                            <kbd className="font-sans px-1 rounded bg-zinc-800 border border-zinc-700 text-[10px]">K</kbd>
                        </div>
                    </button>
                </div>
            )}

            {/* Navigation Links */}
            <div className={cn("flex-1 overflow-y-auto scrollbar-none", collapsed ? "px-2 space-y-0.5" : "px-3 space-y-0.5")}>
                {!collapsed && (
                    <div className="px-2 mb-2 mt-4 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Workspace
                    </div>
                )}
                {navItems.map((item) => {
                    if (item.showFor && !item.showFor.includes(currentUser?.systemRole || '')) return null;
                    if (item.hideFor?.includes(currentUser?.systemRole || '')) return null;

                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={item.name}
                            className={cn(
                                "flex items-center rounded-md text-sm transition-all duration-200 group relative",
                                collapsed ? "justify-center p-2" : "gap-2.5 px-2 py-1.5",
                                isActive
                                    ? "bg-zinc-800/80 text-zinc-100 font-medium shadow-sm"
                                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            )}
                        >
                            <item.icon
                                size={16}
                                className={cn(
                                    "transition-colors flex-shrink-0",
                                    isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                                )}
                            />
                            {!collapsed && <span className="truncate">{item.name}</span>}
                        </NavLink>
                    );
                })}
                
                {/* Admin Section */}
                {adminItems.some(item => !item.hideFor?.includes(currentUser?.systemRole || '')) && (
                    <>
                        {!collapsed && (
                            <div className="px-2 mb-2 mt-6 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                                Administration
                            </div>
                        )}
                        {adminItems.map((item) => {
                            if (item.showFor && !item.showFor.includes(currentUser?.systemRole || '')) return null;
                            if (item.hideFor?.includes(currentUser?.systemRole || '')) return null;

                            const isActive = location.pathname === item.path ||
                                location.pathname.startsWith(item.path);

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    title={item.name}
                                    className={cn(
                                        "flex items-center rounded-md text-sm transition-all duration-200 group relative",
                                        collapsed ? "justify-center p-2" : "gap-2.5 px-2 py-1.5",
                                        isActive
                                            ? "bg-zinc-800/80 text-zinc-100 font-medium shadow-sm"
                                            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                                    )}
                                >
                                    <item.icon
                                        size={16}
                                        className={cn(
                                            "transition-colors flex-shrink-0",
                                            isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                                        )}
                                    />
                                    {!collapsed && <span className="truncate">{item.name}</span>}
                                </NavLink>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Bottom Actions */}
            <div className={cn("p-3 mt-auto shrink-0 border-t border-zinc-800/50 flex items-center gap-1", collapsed && "flex-col")}>
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors flex items-center justify-center w-full"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <NavLink to="/go/alerts" className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors shrink-0" title="Alerts">
                    <Bell size={16} />
                </NavLink>
            </div>
        </aside>
    );
}
