import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ACCOUNT_ID } from '@/hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Trash2, RotateCcw, Loader2, Shield, User as UserIcon, CheckCircle, XCircle } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  company_name: string;
  email: string | null;
  currency: string;
  base_year: number | null;
  created_at: string;
  is_approved: boolean;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'user';
}

export const UsersTab = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      setUsers(profiles || []);
      setUserRoles((roles || []) as UserRole[]);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getUserRole = (userId: string): 'admin' | 'user' => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'user';
  };

  const restoreUserToMaster = async (userId: string) => {
    setRestoring(userId);
    try {
      // Get master account data
      const { data: masterEmissions } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', MASTER_ACCOUNT_ID);

      const { data: masterClients } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', MASTER_ACCOUNT_ID);

      const { data: masterNetzero } = await supabase
        .from('netzero_targets')
        .select('*')
        .eq('user_id', MASTER_ACCOUNT_ID);

      const { data: masterBudgets } = await supabase
        .from('carbon_budgets')
        .select('*')
        .eq('user_id', MASTER_ACCOUNT_ID);

      const { data: masterCredentials } = await supabase
        .from('sustainability_credentials')
        .select('*')
        .eq('user_id', MASTER_ACCOUNT_ID);

      // Delete user's existing data
      await supabase.from('emissions_data').delete().eq('user_id', userId);
      await supabase.from('clients').delete().eq('user_id', userId);
      await supabase.from('netzero_targets').delete().eq('user_id', userId);
      await supabase.from('carbon_budgets').delete().eq('user_id', userId);
      await supabase.from('sustainability_credentials').delete().eq('user_id', userId);

      // Copy master data to user
      if (masterEmissions && masterEmissions.length > 0) {
        const userEmissions = masterEmissions.map(({ id, user_id, organization_id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        await supabase.from('emissions_data').insert(userEmissions);
      }

      if (masterClients && masterClients.length > 0) {
        const userClients = masterClients.map(({ id, user_id, organization_id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        await supabase.from('clients').insert(userClients);
      }

      if (masterNetzero && masterNetzero.length > 0) {
        const userNetzero = masterNetzero.map(({ id, user_id, organization_id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        await supabase.from('netzero_targets').insert(userNetzero);
      }

      if (masterBudgets && masterBudgets.length > 0) {
        const userBudgets = masterBudgets.map(({ id, user_id, organization_id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        await supabase.from('carbon_budgets').insert(userBudgets);
      }

      if (masterCredentials && masterCredentials.length > 0) {
        const userCredentials = masterCredentials.map(({ id, user_id, organization_id, ...rest }) => ({
          ...rest,
          user_id: userId,
        }));
        await supabase.from('sustainability_credentials').insert(userCredentials);
      }

      toast.success('User data reset to master values');
    } catch (err) {
      console.error('Error resetting user:', err);
      toast.error('Failed to reset user data');
    } finally {
      setRestoring(null);
    }
  };

  const toggleApproval = async (userId: string, profileId: string, currentlyApproved: boolean) => {
    setApproving(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: !currentlyApproved } as any)
        .eq('id', profileId);

      if (error) throw error;

      toast.success(currentlyApproved ? 'User access revoked' : 'User approved');
      fetchUsers();
    } catch (err) {
      console.error('Error toggling approval:', err);
      toast.error('Failed to update user approval');
    } finally {
      setApproving(null);
    }
  };

  const deleteUser = async (userId: string, profileId: string) => {
    if (userId === MASTER_ACCOUNT_ID) {
      toast.error('Cannot delete the master account');
      return;
    }

    setDeleting(userId);
    try {
      // Delete user's data first
      await supabase.from('emissions_data').delete().eq('user_id', userId);
      await supabase.from('clients').delete().eq('user_id', userId);
      await supabase.from('netzero_targets').delete().eq('user_id', userId);
      await supabase.from('carbon_budgets').delete().eq('user_id', userId);
      await supabase.from('sustainability_credentials').delete().eq('user_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      
      // Delete profile
      await supabase.from('profiles').delete().eq('id', profileId);

      toast.success('User removed successfully');
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Failed to remove user');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage registered users. Restore users to master account values or remove them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userProfile) => {
                const isMaster = userProfile.user_id === MASTER_ACCOUNT_ID;
                const role = getUserRole(userProfile.user_id);
                
                return (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">
                      {userProfile.email || 'No email'}
                      {isMaster && (
                        <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
                          Master
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                        {role === 'admin' ? (
                          <><Shield className="h-3 w-3 mr-1" /> Admin</>
                        ) : (
                          <><UserIcon className="h-3 w-3 mr-1" /> User</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isMaster ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary">Always Active</Badge>
                      ) : userProfile.is_approved ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">Approved</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!isMaster && (
                        <>
                          <Button
                            variant={userProfile.is_approved ? "secondary" : "default"}
                            size="sm"
                            onClick={() => toggleApproval(userProfile.user_id, userProfile.id, userProfile.is_approved)}
                            disabled={approving === userProfile.user_id}
                          >
                            {approving === userProfile.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : userProfile.is_approved ? (
                              <><XCircle className="h-4 w-4 mr-1" /> Revoke</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreUserToMaster(userProfile.user_id)}
                            disabled={restoring === userProfile.user_id}
                          >
                            {restoring === userProfile.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><RotateCcw className="h-4 w-4 mr-1" /> Reset</>
                            )}
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deleting === userProfile.user_id}
                              >
                                {deleting === userProfile.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Trash2 className="h-4 w-4 mr-1" /> Remove</>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {userProfile.company_name}? 
                                  This will delete all their data permanently.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(userProfile.user_id, userProfile.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
