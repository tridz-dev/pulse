import { useEffect, useState } from 'react';
import { History, User, FileText, CheckSquare, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface ActivityLog {
  name: string;
  user: string;
  user_name: string;
  operation: string;
  status: string;
  reference_doctype: string;
  reference_name: string;
  creation: string;
}

const doctypeIcons: Record<string, typeof FileText> = {
  'SOP Run': CheckSquare,
  'SOP Template': FileText,
  'Corrective Action': AlertCircle,
  'Pulse Employee': User
};

const doctypeLabels: Record<string, string> = {
  'SOP Run': 'Run',
  'SOP Template': 'Template',
  'Corrective Action': 'CA',
  'Pulse Employee': 'Employee'
};

export function AuditLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.admin.get_activity_log?limit=50');
      const data = await response.json();
      if (data.message) {
        setLogs(data.message);
      }
    } catch (error) {
      toast.error('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  const getOperationBadge = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'create':
        return <Badge className="bg-green-500">Create</Badge>;
      case 'update':
      case 'submit':
        return <Badge className="bg-blue-500">Update</Badge>;
      case 'delete':
      case 'cancel':
        return <Badge variant="destructive">Delete</Badge>;
      default:
        return <Badge variant="secondary">{operation}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">Track all system activities and changes</p>
      </div>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No activity recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const Icon = doctypeIcons[log.reference_doctype] || FileText;
                  return (
                    <TableRow key={log.name}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.creation).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{log.user_name || log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getOperationBadge(log.operation)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{doctypeLabels[log.reference_doctype] || log.reference_doctype}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.reference_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'Success' ? 'default' : 'destructive'}>
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
