import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { PulseGoLayout } from './components/layout/PulseGoLayout';
import { Dashboard } from './pages/Dashboard';
import { MyTasks } from './pages/MyTasks';
import { Team } from './pages/Team';
import { Operations } from './pages/Operations';
import { Templates } from './pages/Templates';
import { TemplateForm } from './pages/TemplateForm';
import { Insights } from './pages/Insights';
import { UserProfile } from './pages/UserProfile';
import { Branches } from './pages/admin/Branches';
import { BranchForm } from './pages/admin/BranchForm';
import { Departments } from './pages/admin/Departments';
import { Employees } from './pages/admin/Employees';
import { EmployeeForm } from './pages/admin/EmployeeForm';
import { EmployeeProfile } from './pages/admin/EmployeeProfile';
import { Assignments } from './pages/admin/Assignments';
import { AssignmentForm } from './pages/admin/AssignmentForm';
import { CorrectiveActions } from './pages/CorrectiveActions';
import { CorrectiveActionDetail } from './pages/CorrectiveActionDetail';
import { Settings } from './pages/admin/Settings';
import { Roles } from './pages/admin/Roles';
import { AuditLog } from './pages/admin/AuditLog';
import { OrgChart } from './pages/admin/OrgChart';
import { GoHomePage } from './pages/go/GoHomePage';
import { GoChecklistsPage } from './pages/go/GoChecklistsPage';
import { GoAlertsPage } from './pages/go/GoAlertsPage';
import { GoMePage } from './pages/go/GoMePage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/pulse">
          <Routes>
            <Route path="operator" element={<Navigate to="/go/checklists" replace />} />
            <Route path="go" element={<PulseGoLayout />}>
              <Route index element={<GoHomePage />} />
              <Route path="checklists" element={<GoChecklistsPage />} />
              <Route path="alerts" element={<GoAlertsPage />} />
              <Route path="me" element={<GoMePage />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<MyTasks />} />
              <Route path="team" element={<Team />} />
              <Route path="operations" element={<Operations />} />
              <Route path="operations/:userId" element={<UserProfile />} />
              <Route path="templates" element={<Templates />} />
              <Route path="templates/new" element={<TemplateForm />} />
              <Route path="templates/:id/edit" element={<TemplateForm />} />
              <Route path="insights" element={<Insights />} />
              {/* Admin Routes */}
              <Route path="admin/branches" element={<Branches />} />
              <Route path="admin/branches/new" element={<BranchForm />} />
              <Route path="admin/branches/:id/edit" element={<BranchForm />} />
              <Route path="admin/departments" element={<Departments />} />
              <Route path="admin/employees" element={<Employees />} />
              <Route path="admin/employees/new" element={<EmployeeForm />} />
              <Route path="admin/employees/:id" element={<EmployeeProfile />} />
              <Route path="admin/employees/:id/edit" element={<EmployeeForm />} />
              <Route path="admin/assignments" element={<Assignments />} />
              <Route path="admin/assignments/new" element={<AssignmentForm />} />
              <Route path="corrective-actions" element={<CorrectiveActions />} />
              <Route path="corrective-actions/new" element={<CorrectiveActionDetail />} />
              <Route path="corrective-actions/:id" element={<CorrectiveActionDetail />} />
              <Route path="admin/settings" element={<Settings />} />
              <Route path="admin/roles" element={<Roles />} />
              <Route path="admin/audit" element={<AuditLog />} />
              <Route path="admin/org-chart" element={<OrgChart />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
