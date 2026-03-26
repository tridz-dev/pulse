import { useEffect, useState } from 'react';
import { Save, Bell, Clock, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface SystemSettings {
  default_grace_period: number;
  default_open_run_policy: string;
  pass_weight: number;
  fail_weight: number;
  late_penalty: number;
  missed_penalty: number;
  default_reminder_time: string;
  business_hours_start: string;
  business_hours_end: string;
  enable_email_notifications: number;
  enable_in_app_notifications: number;
  auto_archive_resolved_ca: number;
}

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    default_grace_period: 30,
    default_open_run_policy: 'Auto-create',
    pass_weight: 100,
    fail_weight: 0,
    late_penalty: 10,
    missed_penalty: 0,
    default_reminder_time: '09:00',
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    enable_email_notifications: 1,
    enable_in_app_notifications: 1,
    auto_archive_resolved_ca: 30,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.admin.get_system_settings');
      const data = await response.json();
      if (data.message?.settings) {
        setSettings(data.message.settings);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/method/pulse.api.admin.update_system_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: settings })
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success('Settings saved');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure Pulse system-wide settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scoring Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Scoring Rules
            </CardTitle>
            <CardDescription>Configure how scores are calculated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pass Weight (%)</Label>
                <Input
                  type="number"
                  value={settings.pass_weight}
                  onChange={(e) => setSettings({ ...settings, pass_weight: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fail Weight (%)</Label>
                <Input
                  type="number"
                  value={settings.fail_weight}
                  onChange={(e) => setSettings({ ...settings, fail_weight: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Late Penalty (%)</Label>
                <Input
                  type="number"
                  value={settings.late_penalty}
                  onChange={(e) => setSettings({ ...settings, late_penalty: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Missed Penalty (%)</Label>
                <Input
                  type="number"
                  value={settings.missed_penalty}
                  onChange={(e) => setSettings({ ...settings, missed_penalty: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Send notifications via email</p>
              </div>
              <Switch
                checked={!!settings.enable_email_notifications}
                onCheckedChange={(v) => setSettings({ ...settings, enable_email_notifications: v ? 1 : 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">Show notifications in the app</p>
              </div>
              <Switch
                checked={!!settings.enable_in_app_notifications}
                onCheckedChange={(v) => setSettings({ ...settings, enable_in_app_notifications: v ? 1 : 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Reminder Time</Label>
              <Input
                type="time"
                value={settings.default_reminder_time}
                onChange={(e) => setSettings({ ...settings, default_reminder_time: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule
            </CardTitle>
            <CardDescription>Configure business hours and scheduling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Hours Start</Label>
                <Input
                  type="time"
                  value={settings.business_hours_start}
                  onChange={(e) => setSettings({ ...settings, business_hours_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Business Hours End</Label>
                <Input
                  type="time"
                  value={settings.business_hours_end}
                  onChange={(e) => setSettings({ ...settings, business_hours_end: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Grace Period (minutes)</Label>
              <Input
                type="number"
                value={settings.default_grace_period}
                onChange={(e) => setSettings({ ...settings, default_grace_period: parseInt(e.target.value) || 0 })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Corrective Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Corrective Actions
            </CardTitle>
            <CardDescription>Configure CA auto-archiving</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Auto-archive Resolved CAs (days)</Label>
              <Input
                type="number"
                value={settings.auto_archive_resolved_ca}
                onChange={(e) => setSettings({ ...settings, auto_archive_resolved_ca: parseInt(e.target.value) || 0 })}
              />
              <p className="text-sm text-muted-foreground">
                Automatically close resolved corrective actions after this many days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
