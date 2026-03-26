/**
 * Cache Administration Page
 * 
 * Provides a comprehensive interface for:
 * - Viewing cache statistics
 * - Clearing cache by pattern
 * - Triggering manual cache warming
 * - Browsing cache keys
 * - Viewing hit/miss rates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Trash2,
  Flame,
  Database,
  Activity,
  Search,
  CheckCircle,
  XCircle,
  Key,
  Clock,
  BarChart3,
  Zap,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CacheStats {
  success: boolean;
  redis: {
    connected: boolean;
    version: string;
    uptime_days: number;
    used_memory: string;
    used_memory_peak: string;
  };
  pulse_cache: {
    total_keys: number;
    by_category: Record<string, number>;
    sample_keys: string[];
  };
  query_cache: {
    total_cached_queries?: number;
    queries_by_table?: Record<string, number>;
  };
}

interface CacheHealth {
  success: boolean;
  overall_status: string;
  checks: Record<string, {
    status: string;
    message: string;
    key_count?: number;
  }>;
}

interface CacheKeyInfo {
  key: string;
  ttl_seconds: number;
  value_type: string;
  value_size_bytes: number;
}

export function CacheAdmin() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [health, setHealth] = useState<CacheHealth | null>(null);
  const [clearPattern, setClearPattern] = useState('');
  const [searchPattern, setSearchPattern] = useState('*');
  const [keys, setKeys] = useState<CacheKeyInfo[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [warmingType, setWarmingType] = useState('all');
  const [warming, setWarming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [, setSelectedKey] = useState<string | null>(null);
  const [keyDetails, setKeyDetails] = useState<any>(null);

  // Fetch cache stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/method/pulse.api.cache_admin.get_cache_stats');
      const data = await response.json();
      if (data.message?.success) {
        setStats(data.message);
      }
    } catch (error) {
      toast.error('Failed to load cache statistics');
    }
  }, []);

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/method/pulse.api.cache_admin.get_cache_health');
      const data = await response.json();
      if (data.message?.success) {
        setHealth(data.message);
      }
    } catch (error) {
      console.error('Health check failed', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchHealth()]);
      setLoading(false);
    };
    load();
  }, [fetchStats, fetchHealth]);

  // Search cache keys
  const searchKeys = async () => {
    setKeysLoading(true);
    try {
      const response = await fetch(
        `/api/method/pulse.api.cache_admin.get_cache_keys?pattern=${encodeURIComponent(searchPattern)}&limit=50`
      );
      const data = await response.json();
      if (data.message?.success) {
        const keyInfos: CacheKeyInfo[] = data.message.keys.map((key: string) => ({
          key,
          ttl_seconds: data.message.ttls?.[key] ?? -1,
          value_type: 'Unknown',
          value_size_bytes: 0,
        }));
        setKeys(keyInfos);
      }
    } catch (error) {
      toast.error('Failed to search cache keys');
    } finally {
      setKeysLoading(false);
    }
  };

  // Clear cache
  const handleClearCache = async () => {
    setClearing(true);
    try {
      const response = await fetch('/api/method/pulse.api.cache_admin.clear_cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: clearPattern || null }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(data.message.message);
        fetchStats();
        searchKeys();
      } else {
        toast.error(data.message?.message || 'Failed to clear cache');
      }
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  // Warm cache
  const handleWarmCache = async () => {
    setWarming(true);
    try {
      const response = await fetch('/api/method/pulse.api.cache_admin.warm_cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: warmingType }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(data.message.message);
        fetchStats();
      } else {
        toast.error(data.message?.message || 'Failed to warm cache');
      }
    } catch (error) {
      toast.error('Failed to warm cache');
    } finally {
      setWarming(false);
    }
  };

  // View key details
  const viewKeyDetails = async (key: string) => {
    setSelectedKey(key);
    try {
      const response = await fetch(
        `/api/method/pulse.api.cache_admin.get_cache_key_info?key=${encodeURIComponent(key)}`
      );
      const data = await response.json();
      if (data.message?.success) {
        setKeyDetails(data.message);
      }
    } catch (error) {
      toast.error('Failed to load key details');
    }
  };

  // Delete key
  const deleteKey = async (key: string) => {
    try {
      const response = await fetch('/api/method/pulse.api.cache_admin.delete_cache_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(`Deleted ${key}`);
        searchKeys();
        fetchStats();
      }
    } catch (error) {
      toast.error('Failed to delete key');
    }
  };

  // Format TTL
  const formatTTL = (ttl: number): string => {
    if (ttl < 0) return 'No expiry';
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
    return `${Math.floor(ttl / 3600)}h`;
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cache Administration</h1>
          <p className="text-muted-foreground">Manage and monitor application cache</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${health.overall_status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <Activity className="h-5 w-5" />
          <div className="flex items-center gap-2">
            <span className="font-medium">Cache Health:</span>
            <Badge variant={health.overall_status === 'healthy' ? 'default' : 'destructive'}>
              {health.overall_status}
            </Badge>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.redis?.connected ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Version: {stats?.redis?.version || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pulse_cache?.total_keys?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total cached entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.redis?.used_memory || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Peak: {stats?.redis?.used_memory_peak || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.redis?.uptime_days || 0} days
            </div>
            <p className="text-xs text-muted-foreground">
              Redis server uptime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      {stats?.pulse_cache?.by_category && Object.keys(stats.pulse_cache.by_category).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cache by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.pulse_cache.by_category).map(([category, count]) => (
                <Badge key={category} variant="secondary">
                  {category}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Clear Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Clear Cache
            </CardTitle>
            <CardDescription>Remove cached data by pattern or clear all</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pattern (optional)</Label>
              <Input
                placeholder="e.g., employee:* or dashboard:*"
                value={clearPattern}
                onChange={(e) => setClearPattern(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to clear all cache. Use * as wildcard.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleClearCache}
                disabled={clearing}
              >
                {clearing ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warm Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Warm Cache
            </CardTitle>
            <CardDescription>Pre-load frequently accessed data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Warmup Type</Label>
              <Select value={warmingType} onValueChange={(value) => setWarmingType(value || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Data</SelectItem>
                  <SelectItem value="dashboard">Dashboard Data</SelectItem>
                  <SelectItem value="employees">Employee Data</SelectItem>
                  <SelectItem value="analytics">Analytics Data</SelectItem>
                  <SelectItem value="sop">SOP Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleWarmCache}
              disabled={warming}
            >
              {warming ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Flame className="mr-2 h-4 w-4" />
              )}
              Warm Cache
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Key Browser */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Cache Key Browser
          </CardTitle>
          <CardDescription>Search and manage individual cache keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Pattern (e.g., *employee* or query:*)"
              value={searchPattern}
              onChange={(e) => setSearchPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchKeys()}
            />
            <Button onClick={searchKeys} disabled={keysLoading}>
              {keysLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {keys.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>TTL</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((keyInfo) => (
                    <TableRow key={keyInfo.key}>
                      <TableCell className="font-mono text-xs max-w-[300px] truncate">
                        {keyInfo.key}
                      </TableCell>
                      <TableCell>
                        <Badge variant={keyInfo.ttl_seconds > 0 ? 'secondary' : 'outline'}>
                          {formatTTL(keyInfo.ttl_seconds)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => viewKeyDetails(keyInfo.key)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Key Details</DialogTitle>
                                <DialogDescription>{keyInfo.key}</DialogDescription>
                              </DialogHeader>
                              {keyDetails && (
                                <div className="space-y-2 text-sm">
                                  <p><strong>Type:</strong> {keyDetails.value_type}</p>
                                  <p><strong>Size:</strong> {formatBytes(keyDetails.value_size_bytes)}</p>
                                  <p><strong>TTL:</strong> {formatTTL(keyDetails.ttl_seconds)}</p>
                                  {keyDetails.value_preview && (
                                    <div>
                                      <strong>Preview:</strong>
                                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                                        {keyDetails.value_preview}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteKey(keyInfo.key)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="p-4 rounded-lg border bg-blue-50 border-blue-200 flex items-start gap-3">
        <Zap className="h-5 w-5 mt-0.5" />
        <div>
          <strong>Cache Tips:</strong> Use patterns like <code>employee:*</code> to clear specific data types.
          Regular cache warming improves user experience by pre-loading frequently accessed data.
          Monitor cache health to ensure optimal performance.
        </div>
      </div>
    </div>
  );
}

export default CacheAdmin;
