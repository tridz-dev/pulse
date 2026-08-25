import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getTeamScores, getAllTeamScores } from '@/services/scores';
import type { TeamScoreItem, AllTeamScoreItem } from '@/services/scores';
import {
  listUnlinkedUsers,
  listDepartments,
  createDepartment,
  listEmployees,
  createEmployee,
} from '@/services/people';
import type { UnlinkedUser, PulseDepartment, PulseEmployee } from '@/services/people';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingDown, Target, UsersRound, Settings, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const PULSE_ROLES = ['Operator', 'Supervisor', 'Area Manager', 'Executive'] as const;

type TabId = 'my-team' | 'all-teams' | 'setup';

export function Team() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('my-team');
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [teamScores, setTeamScores] = useState<TeamScoreItem[]>([]);
  const [allTeamScores, setAllTeamScores] = useState<AllTeamScoreItem[]>([]);
  const [isLoadingMyTeam, setIsLoadingMyTeam] = useState(true);
  const [isLoadingAllTeams, setIsLoadingAllTeams] = useState(false);

  const [departments, setDepartments] = useState<PulseDepartment[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [employees, setEmployees] = useState<PulseEmployee[]>([]);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);

  const [newEmployeeUser, setNewEmployeeUser] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeeDepartment, setNewEmployeeDepartment] = useState('');
  const [newEmployeeBranch, setNewEmployeeBranch] = useState('');
  const [newEmployeeManager, setNewEmployeeManager] = useState('');
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

  const showAllTeamsTab =
    currentUser && currentUser.systemRole && ['Pulse Executive', 'Pulse Leader'].includes(currentUser.systemRole);
  const showSetupTab = currentUser?.systemRole === 'Pulse Admin';

  useEffect(() => {
    async function fetchMyTeam() {
      if (!currentUser || currentUser.systemRole === 'Pulse User') {
        setIsLoadingMyTeam(false);
        return;
      }
      setIsLoadingMyTeam(true);
      const data = await getTeamScores(currentUser.id, todayISO(), periodType);
      setTeamScores(data);
      setIsLoadingMyTeam(false);
    }
    fetchMyTeam();
  }, [currentUser, periodType]);

  useEffect(() => {
    if (!showAllTeamsTab || activeTab !== 'all-teams') return;
    async function fetchAllTeams() {
      if (!currentUser) return;
      setIsLoadingAllTeams(true);
      const data = await getAllTeamScores(currentUser.id, todayISO(), periodType);
      setAllTeamScores(data);
      setIsLoadingAllTeams(false);
    }
    fetchAllTeams();
  }, [currentUser, periodType, activeTab, showAllTeamsTab]);

  async function refreshSetupData() {
    setIsLoadingSetup(true);
    try {
      const [deps, unlinked, emps] = await Promise.all([
        listDepartments(),
        listUnlinkedUsers(),
        listEmployees(),
      ]);
      setDepartments(deps);
      setUnlinkedUsers(unlinked);
      setEmployees(emps);
    } catch (error) {
      console.error('Failed to load setup data', error);
    }
    setIsLoadingSetup(false);
  }

  useEffect(() => {
    if (!showSetupTab || activeTab !== 'setup') return;
    refreshSetupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSetupTab, activeTab]);

  async function handleCreateDepartment(e: FormEvent) {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;
    setIsCreatingDepartment(true);
    setSetupError(null);
    try {
      await createDepartment(newDepartmentName.trim());
      setNewDepartmentName('');
      await refreshSetupData();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Failed to create department.');
    }
    setIsCreatingDepartment(false);
  }

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault();
    const selectedUser = unlinkedUsers.find((u) => u.name === newEmployeeUser);
    if (!selectedUser || !newEmployeeRole) return;
    setIsCreatingEmployee(true);
    setSetupError(null);
    try {
      const displayName =
        [selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || selectedUser.email;
      await createEmployee({
        employee_name: displayName,
        user: selectedUser.name,
        pulse_role: newEmployeeRole,
        branch: newEmployeeBranch || undefined,
        department: newEmployeeDepartment || undefined,
        reports_to: newEmployeeManager || undefined,
      });
      setNewEmployeeUser('');
      setNewEmployeeRole('');
      setNewEmployeeDepartment('');
      setNewEmployeeBranch('');
      setNewEmployeeManager('');
      await refreshSetupData();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Failed to create employee profile.');
    }
    setIsCreatingEmployee(false);
  }

  if (currentUser?.systemRole === 'Pulse User') {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <Users size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">No Direct Reports</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Your role does not have team visibility enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Team</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {showAllTeamsTab
              ? 'Your direct reports and organization-wide team view.'
              : 'Operational performance for your direct reports.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(showAllTeamsTab || showSetupTab) && (
            <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              {showAllTeamsTab && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('my-team')}
                    className={cn(
                      'h-8 px-3 text-xs font-medium',
                      activeTab === 'my-team'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    My Team
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('all-teams')}
                    className={cn(
                      'h-8 px-3 text-xs font-medium',
                      activeTab === 'all-teams'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    All Teams
                  </Button>
                </>
              )}
              {showSetupTab && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('setup')}
                  className={cn(
                    'h-8 px-3 text-xs font-medium gap-1.5',
                    activeTab === 'setup'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Settings size={12} />
                  Setup
                </Button>
              )}
            </div>
          )}
          {activeTab !== 'setup' && (
            <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              {(['Day', 'Week', 'Month'] as const).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPeriodType(p)}
                  className={cn(
                    'h-8 px-3 text-xs font-medium',
                    periodType === p ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {p}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'my-team' && (
        <>
          {isLoadingMyTeam ? (
            <div className="space-y-4 mt-4">
              <div className="h-10 bg-zinc-900 rounded-lg animate-pulse" />
              <div className="h-40 bg-zinc-900 rounded-lg animate-pulse" />
            </div>
          ) : teamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
              <Users size={48} className="text-zinc-600 mb-4" />
              <h3 className="text-base font-medium text-zinc-300">No Team Members</h3>
              <p className="text-sm text-zinc-500 mt-1">You don&apos;t have any active direct reports.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-zinc-800 bg-[#18181b] overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-medium h-10 w-[250px]">Team Member</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Role</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Operational</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-200 text-sm">
                              {member.user?.name ?? member.employee}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {member.completed_items} / {member.total_items} checklist items
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-zinc-400 border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                          {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                          <ScoreDisplay score={member.combined_score} highlight />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {activeTab === 'all-teams' && showAllTeamsTab && (
        <>
          {isLoadingAllTeams ? (
            <div className="space-y-4 mt-4">
              <div className="h-10 bg-zinc-900 rounded-lg animate-pulse" />
              <div className="h-40 bg-zinc-900 rounded-lg animate-pulse" />
            </div>
          ) : allTeamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
              <UsersRound size={48} className="text-zinc-600 mb-4" />
              <h3 className="text-base font-medium text-zinc-300">No Team Data</h3>
              <p className="text-sm text-zinc-500 mt-1">No employees in scope for this period.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-zinc-800 bg-[#18181b] overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-medium h-10 w-[220px]">Name</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Role</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Department</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Branch</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Combined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTeamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <span className="font-medium text-zinc-200 text-sm">
                            {member.user?.name ?? member.employee}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-zinc-400 border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-zinc-400 text-sm">
                        {member.department ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-zinc-400 text-sm">
                        {member.user?.branch ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                          {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                          <ScoreDisplay score={member.combined_score} highlight />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {activeTab === 'setup' && showSetupTab && (
        <div className="flex flex-col gap-6">
          {setupError && (
            <div className="rounded-md border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-400">
              {setupError}
            </div>
          )}

          {isLoadingSetup ? (
            <div className="space-y-4 mt-4">
              <div className="h-32 bg-zinc-900 rounded-lg animate-pulse" />
              <div className="h-32 bg-zinc-900 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-md border border-zinc-800 bg-[#18181b] p-4 flex flex-col gap-4">
                <h3 className="text-sm font-medium text-zinc-200">Departments</h3>
                <form onSubmit={handleCreateDepartment} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    placeholder="New department name"
                    className="flex-1 h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingDepartment || !newDepartmentName.trim()}
                    className="h-9 gap-1.5"
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </form>
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-900/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-medium h-9">Name</TableHead>
                        <TableHead className="text-zinc-400 font-medium h-9">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.length === 0 ? (
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                          <TableCell colSpan={2} className="text-center text-zinc-500 text-sm py-6">
                            No departments yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        departments.map((dept) => (
                          <TableRow key={dept.name} className="border-zinc-800 hover:bg-transparent">
                            <TableCell className="py-2 text-zinc-200 text-sm">{dept.department_name}</TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] uppercase',
                                  dept.is_active
                                    ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30'
                                    : 'text-zinc-500 border-zinc-700 bg-zinc-900'
                                )}
                              >
                                {dept.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-md border border-zinc-800 bg-[#18181b] p-4 flex flex-col gap-4">
                <h3 className="text-sm font-medium text-zinc-200">Create Employee Profile</h3>
                {unlinkedUsers.length === 0 ? (
                  <p className="text-sm text-zinc-500">No unlinked users available to onboard.</p>
                ) : (
                  <form onSubmit={handleCreateEmployee} className="flex flex-col gap-3">
                    <select
                      value={newEmployeeUser}
                      onChange={(e) => setNewEmployeeUser(e.target.value)}
                      className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    >
                      <option value="">Select user…</option>
                      {unlinkedUsers.map((u) => (
                        <option key={u.name} value={u.name}>
                          {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={newEmployeeRole}
                        onChange={(e) => setNewEmployeeRole(e.target.value)}
                        className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      >
                        <option value="">Select role…</option>
                        {PULSE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newEmployeeDepartment}
                        onChange={(e) => setNewEmployeeDepartment(e.target.value)}
                        className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      >
                        <option value="">No department</option>
                        {departments.map((dept) => (
                          <option key={dept.name} value={dept.name}>
                            {dept.department_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newEmployeeBranch}
                        onChange={(e) => setNewEmployeeBranch(e.target.value)}
                        placeholder="Branch (optional)"
                        className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      />
                      <select
                        value={newEmployeeManager}
                        onChange={(e) => setNewEmployeeManager(e.target.value)}
                        className="h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      >
                        <option value="">No manager</option>
                        {employees.map((emp) => (
                          <option key={emp.name} value={emp.name}>
                            {emp.employee_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isCreatingEmployee || !newEmployeeUser || !newEmployeeRole}
                      className="h-9 gap-1.5 self-start"
                    >
                      <Plus size={14} />
                      Create Employee Profile
                    </Button>
                  </form>
                )}
              </div>

              <div className="lg:col-span-2 rounded-md border border-zinc-800 bg-[#18181b] overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-900/50">
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400 font-medium h-10">Name</TableHead>
                      <TableHead className="text-zinc-400 font-medium h-10">Role</TableHead>
                      <TableHead className="text-zinc-400 font-medium h-10">Department</TableHead>
                      <TableHead className="text-zinc-400 font-medium h-10">Branch</TableHead>
                      <TableHead className="text-zinc-400 font-medium h-10">Reports To</TableHead>
                      <TableHead className="text-zinc-400 font-medium h-10">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center text-zinc-500 text-sm py-6">
                          No employee profiles yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((emp) => (
                        <TableRow key={emp.name} className="border-zinc-800 hover:bg-transparent">
                          <TableCell className="py-2 text-zinc-200 text-sm">{emp.employee_name}</TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className="text-zinc-400 border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase"
                            >
                              {emp.pulse_role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-zinc-400 text-sm">{emp.department ?? '—'}</TableCell>
                          <TableCell className="py-2 text-zinc-400 text-sm">{emp.branch ?? '—'}</TableCell>
                          <TableCell className="py-2 text-zinc-400 text-sm">{emp.reports_to ?? '—'}</TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] uppercase',
                                emp.is_active
                                  ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30'
                                  : 'text-zinc-500 border-zinc-700 bg-zinc-900'
                              )}
                            >
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreDisplay({ score, highlight = false }: { score: number; highlight?: boolean }) {
  const percentage = Math.round(score * 100);
  let color = 'text-zinc-300';
  if (highlight) {
    if (score >= 0.8) color = 'text-emerald-400 font-bold';
    else if (score >= 0.5) color = 'text-amber-400 font-medium';
    else color = 'text-rose-400 font-medium';
  } else {
    if (score >= 0.8) color = 'text-emerald-500/80';
    else if (score >= 0.5) color = 'text-amber-500/80';
    else color = 'text-rose-500/80';
  }
  return <span className={color}>{percentage}%</span>;
}
