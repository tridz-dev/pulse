import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Plus, Search, MoreHorizontal, 
  MapPin, Users, Clock, Edit2, Power 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Branch {
  name: string;
  branch_name: string;
  branch_code: string;
  city: string;
  state: string;
  branch_manager: string | null;
  manager_name?: string;
  is_active: 0 | 1;
  opening_time: string | null;
  closing_time: string | null;
  employee_count: number;
}

interface Filters {
  city?: string;
  is_active?: boolean;
  search?: string;
}

export function Branches() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    fetchBranches();
    fetchCities();
  }, [filters]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/method/pulse.api.branches.get_branches?filters=${encodeURIComponent(JSON.stringify(filters))}`
      );
      const data = await response.json();
      if (data.message) {
        setBranches(data.message.branches);
      }
    } catch (error) {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.branches.get_cities');
      const data = await response.json();
      if (data.message) {
        setCities(data.message);
      }
    } catch (error) {
      console.error('Failed to load cities');
    }
  };

  const handleDeactivate = async (branchName: string) => {
    if (!confirm('Are you sure you want to deactivate this branch?')) return;
    
    try {
      const response = await fetch('/api/method/pulse.api.branches.deactivate_branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_name: branchName }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(data.message.message);
        fetchBranches();
      } else {
        toast.error(data.message?.message || 'Failed to deactivate');
      }
    } catch (error) {
      toast.error('Failed to deactivate branch');
    }
  };

  const filteredBranches = branches.filter(b => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        b.branch_name.toLowerCase().includes(search) ||
        b.branch_code?.toLowerCase().includes(search) ||
        b.city?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">
            Manage your organization's branches and locations
          </p>
        </div>
        <Button onClick={() => navigate('/admin/branches/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.city || ''}
          onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
        >
          <option value="">All Cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.is_active === undefined ? '' : filters.is_active ? 'active' : 'inactive'}
          onChange={(e) => {
            const val = e.target.value;
            setFilters({
              ...filters,
              is_active: val === '' ? undefined : val === 'active'
            });
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Branches Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No branches found</h3>
          <p className="text-muted-foreground mt-1">
            {filters.search ? 'Try adjusting your search' : 'Create your first branch to get started'}
          </p>
          {!filters.search && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/admin/branches/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Branch
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map(branch => (
            <Card key={branch.name} className={!branch.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{branch.branch_name}</h3>
                      {branch.branch_code && (
                        <p className="text-xs text-muted-foreground">{branch.branch_code}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/branches/${branch.name}/edit`)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {branch.is_active && (
                        <DropdownMenuItem 
                          onClick={() => handleDeactivate(branch.name)}
                          className="text-destructive"
                        >
                          <Power className="w-4 h-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {(branch.city || branch.state) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{[branch.city, branch.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{branch.employee_count} employees</span>
                  </div>
                  
                  {(branch.opening_time || branch.closing_time) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {branch.opening_time?.substring(0, 5) || '--:--'} - 
                        {branch.closing_time?.substring(0, 5) || '--:--'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {branch.manager_name && (
                      <Badge variant="outline">Manager: {branch.manager_name}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
