import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Users, Building2, Briefcase, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface OrgNode {
  name: string;
  employee_name: string;
  pulse_role: string;
  branch: string;
  department: string;
  is_active: number;
  children?: OrgNode[];
}

const roleColors: Record<string, string> = {
  'Executive': 'bg-purple-100 text-purple-800 border-purple-200',
  'Area Manager': 'bg-blue-100 text-blue-800 border-blue-200',
  'Supervisor': 'bg-green-100 text-green-800 border-green-200',
  'Operator': 'bg-gray-100 text-gray-800 border-gray-200'
};

export function OrgChart() {
  const navigate = useNavigate();
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrgChart();
  }, []);

  const fetchOrgChart = async () => {
    try {
      // Get current user employee
      const authResponse = await fetch('/api/method/pulse.api.auth.get_current_employee');
      const authData = await authResponse.json();
      
      if (authData.message?.name) {
        // Find top of hierarchy
        const hierarchyResponse = await fetch(`/api/method/pulse.api.employees.get_employee_hierarchy?employee_name=${authData.message.name}`);
        const hierarchyData = await hierarchyResponse.json();
        
        if (hierarchyData.message?.hierarchy?.length > 0) {
          // Find root (employee with no reports_to in the hierarchy)
          const hierarchy = hierarchyData.message.hierarchy;
          const reportedToIds = new Set(hierarchy.map((h: any) => h.reports_to).filter(Boolean));
          
          // Root is someone who is not reported to by anyone in the list
          let rootId = hierarchy[0]?.name;
          for (const emp of hierarchy) {
            if (!reportedToIds.has(emp.name)) {
              rootId = emp.name;
              break;
            }
          }
          
          // Build tree from root
          const buildTree = (empId: string): OrgNode | null => {
            const emp = hierarchy.find((h: any) => h.name === empId);
            if (!emp) return null;
            
            const children = hierarchy
              .filter((h: any) => h.reports_to === empId)
              .map((h: any) => buildTree(h.name))
              .filter(Boolean) as OrgNode[];
            
            return {
              name: emp.name,
              employee_name: emp.employee_name,
              pulse_role: emp.pulse_role,
              branch: emp.branch,
              department: emp.department,
              is_active: emp.is_active,
              children: children.length > 0 ? children : undefined
            };
          };
          
          const treeData = buildTree(rootId);
          setTree(treeData);
          
          // Expand first 2 levels
          const initialExpanded = new Set<string>();
          const addToExpanded = (node: OrgNode, depth: number) => {
            if (depth < 2) {
              initialExpanded.add(node.name);
              node.children?.forEach(child => addToExpanded(child, depth + 1));
            }
          };
          if (treeData) {
            addToExpanded(treeData, 0);
            setExpandedNodes(initialExpanded);
          }
        }
      }
    } catch (error) {
      toast.error('Failed to load org chart');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeName: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeName)) {
        next.delete(nodeName);
      } else {
        next.add(nodeName);
      }
      return next;
    });
  };

  const searchInTree = (node: OrgNode, query: string): boolean => {
    const matches = 
      node.employee_name.toLowerCase().includes(query) ||
      node.pulse_role.toLowerCase().includes(query) ||
      node.branch?.toLowerCase().includes(query);
    
    if (matches) return true;
    
    return node.children?.some(child => searchInTree(child, query)) || false;
  };

  const renderNode = (node: OrgNode, level: number = 0): React.ReactElement | null => {
    const isExpanded = expandedNodes.has(node.name);
    const hasChildren = node.children && node.children.length > 0;
    
    // Filter based on search
    if (searchQuery && !searchInTree(node, searchQuery.toLowerCase())) {
      return null;
    }

    const roleColor = roleColors[node.pulse_role] || 'bg-gray-100 text-gray-800';

    return (
      <div key={node.name} className="select-none">
        <div 
          className="flex items-center gap-2 py-2 hover:bg-accent/50 rounded-lg cursor-pointer transition-colors"
          style={{ paddingLeft: `${level * 24 + 8}px` }}
          onClick={() => navigate(`/admin/employees/${node.name}`)}
        >
          {hasChildren ? (
            <button
              className="p-1 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.name);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border ${roleColor}`}>
            {node.employee_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{node.employee_name}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{node.pulse_role}</span>
              {node.branch && (
                <>
                  <span>•</span>
                  <span className="truncate">{node.branch}</span>
                </>
              )}
            </div>
          </div>
          
          {!node.is_active && (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-muted ml-5">
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organization Chart</h1>
          <p className="text-muted-foreground">Visualize your organization hierarchy</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-2 text-sm">
            {Object.entries(roleColors).map(([role, color]) => (
              <div key={role} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${color.split(' ')[0]}`} />
                <span>{role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees, roles, or branches..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Org Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tree ? (
            <div className="space-y-1">
              {renderNode(tree)}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No organization data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tree ? countNodes(tree) : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tree ? countBranches(tree) : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tree ? countDepartments(tree) : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hierarchy Depth</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tree ? getTreeDepth(tree) : 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper functions
function countNodes(node: OrgNode): number {
  let count = 1;
  if (node.children) {
    count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }
  return count;
}

function countBranches(node: OrgNode): number {
  const branches = new Set<string>();
  const collect = (n: OrgNode) => {
    if (n.branch) branches.add(n.branch);
    n.children?.forEach(collect);
  };
  collect(node);
  return branches.size;
}

function countDepartments(node: OrgNode): number {
  const departments = new Set<string>();
  const collect = (n: OrgNode) => {
    if (n.department) departments.add(n.department);
    n.children?.forEach(collect);
  };
  collect(node);
  return departments.size;
}

function getTreeDepth(node: OrgNode, depth: number = 1): number {
  if (!node.children || node.children.length === 0) {
    return depth;
  }
  return Math.max(...node.children.map(child => getTreeDepth(child, depth + 1)));
}
