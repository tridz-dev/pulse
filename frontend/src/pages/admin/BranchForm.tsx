import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface BranchFormData {
  branch_name: string;
  branch_code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
}

const initialFormData: BranchFormData = {
  branch_name: '',
  branch_code: '',
  address: '',
  city: '',
  state: '',
  country: '',
  phone: '',
  email: '',
  opening_time: '',
  closing_time: '',
  is_active: true,
};

export function BranchForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  
  const [formData, setFormData] = useState<BranchFormData>(initialFormData);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      fetchBranch(id);
    }
  }, [id]);

  const fetchBranch = async (branchName: string) => {
    try {
      const response = await fetch(`/api/method/pulse.api.branches.get_branch_detail?branch_name=${branchName}`);
      const data = await response.json();
      if (data.message?.branch) {
        const branch = data.message.branch;
        setFormData({
          branch_name: branch.branch_name || '',
          branch_code: branch.branch_code || '',
          address: branch.address || '',
          city: branch.city || '',
          state: branch.state || '',
          country: branch.country || '',
          phone: branch.phone || '',
          email: branch.email || '',
          opening_time: branch.opening_time || '',
          closing_time: branch.closing_time || '',
          is_active: branch.is_active === 1,
        });
      }
    } catch (error) {
      toast.error('Failed to load branch');
      navigate('/admin/branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch_name.trim()) {
      toast.error('Branch name is required');
      return;
    }
    
    setSaving(true);
    
    try {
      const method = isEdit ? 'update_branch' : 'create_branch';
      const payload = isEdit 
        ? { branch_name: id, values: formData }
        : { values: formData };
      
      const response = await fetch(`/api/method/pulse.api.branches.${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (data.message?.success) {
        toast.success(data.message.message);
        navigate('/admin/branches');
      } else {
        toast.error(data.message?.message || 'Failed to save branch');
      }
    } catch (error) {
      toast.error('Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof BranchFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/branches')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? 'Edit Branch' : 'Add Branch'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update branch details' : 'Create a new branch location'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Branch Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch_name">
                  Branch Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="branch_name"
                  value={formData.branch_name}
                  onChange={(e) => updateField('branch_name', e.target.value)}
                  placeholder="e.g., Downtown Store"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="branch_code">Branch Code</Label>
                <Input
                  id="branch_code"
                  value={formData.branch_code}
                  onChange={(e) => updateField('branch_code', e.target.value.toUpperCase())}
                  placeholder="e.g., DT001"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  placeholder="State"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="branch@company.com"
                />
              </div>
            </div>

            {/* Operating Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opening_time">Opening Time</Label>
                <Input
                  id="opening_time"
                  type="time"
                  value={formData.opening_time}
                  onChange={(e) => updateField('opening_time', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="closing_time">Closing Time</Label>
                <Input
                  id="closing_time"
                  type="time"
                  value={formData.closing_time}
                  onChange={(e) => updateField('closing_time', e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            {isEdit && (
              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) => updateField('is_active', checked)}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Branch is active
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/branches')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : (isEdit ? 'Update Branch' : 'Create Branch')}
          </Button>
        </div>
      </form>
    </div>
  );
}
