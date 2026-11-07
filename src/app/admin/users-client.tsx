'use client';

import React, { useCallback, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Key,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { NeubenchSpinner } from '@/components/loading';
import type { AdminUserItem } from '@/lib/admin/users';

export function AdminUsersClient({
  reviewerEmail,
  initialUsers = [],
}: {
  reviewerEmail: string;
  initialUsers?: AdminUserItem[];
}) {
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [loading, setLoading] = useState(initialUsers.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [isPending, startTransition] = useTransition();
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Failed to fetch users (${res.status})`);
      }
      const data = (await res.json()) as { ok: boolean; users: AdminUserItem[] };
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error retrieving user accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleRole = (user: AdminUserItem) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      nextRole === 'admin'
        ? `Grant administrator access to ${user.email}? They will be able to manage news, reader feedback, and user roles.`
        : `Revoke administrator access for ${user.email}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionUserId(user.id);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, role: nextRole }),
        });

        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to update user role');
        }

        setSuccess(data.message || `User role successfully updated to ${nextRole.toUpperCase()}`);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Role update failed');
      } finally {
        setActionUserId(null);
      }
    });
  };

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterRole === 'admin' && u.role !== 'admin') return false;
      if (filterRole === 'user' && u.role !== 'user') return false;
      if (!needle) return true;
      return (
        u.email.toLowerCase().includes(needle) ||
        u.fullName.toLowerCase().includes(needle) ||
        u.provider.toLowerCase().includes(needle)
      );
    });
  }, [users, search, filterRole]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const members = total - admins;
    const googleCount = users.filter((u) => u.provider.toLowerCase().includes('google')).length;
    return { total, admins, members, googleCount };
  }, [users]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="admin-users-view">
      {/* Users Metric Cards */}
      <div className="admin-metric-grid">
        <div className="admin-metric-card">
          <div className="admin-metric-icon-wrap violet">
            <Users size={18} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-title">Total Registered</span>
            <span className="admin-metric-val">{stats.total} Readers</span>
            <span className="admin-metric-sub">Across Email & Google OAuth</span>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-icon-wrap emerald">
            <ShieldCheck size={18} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-title">Active Administrators</span>
            <span className="admin-metric-val">{stats.admins} Admins</span>
            <span className="admin-metric-sub">With mission control access</span>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-icon-wrap cyan">
            <UserCheck size={18} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-title">Standard Members</span>
            <span className="admin-metric-val">{stats.members} Readers</span>
            <span className="admin-metric-sub">Syncing bookmarks & votes</span>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-icon-wrap amber">
            <Key size={18} />
          </div>
          <div className="admin-metric-content">
            <span className="admin-metric-title">Google OAuth</span>
            <span className="admin-metric-val">{stats.googleCount} Accounts</span>
            <span className="admin-metric-sub">Single sign-on users</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-panel-card">
        <div className="admin-panel-head">
          <div className="admin-panel-title-wrap">
            <Shield size={18} className="text-purple-400" />
            <h2 className="admin-panel-title">Users & Role Access Management</h2>
          </div>
          <button
            type="button"
            className="admin-users-refresh-btn"
            onClick={fetchUsers}
            disabled={loading}
            title="Refresh user list"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="admin-user-alert error" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="admin-user-alert success" role="status">
            <CheckCircle2 size={15} />
            <span>{success}</span>
          </div>
        )}

        {/* Toolbar: Search + Filter segmented chips */}
        <div className="admin-users-toolbar">
          <div className="admin-users-search-wrap">
            <Search size={15} className="admin-users-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-users-search-input"
            />
          </div>

          <div className="admin-users-filter-chips">
            <button
              type="button"
              className={`admin-filter-chip ${filterRole === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterRole('all')}
            >
              All Users ({stats.total})
            </button>
            <button
              type="button"
              className={`admin-filter-chip ${filterRole === 'admin' ? 'is-active' : ''}`}
              onClick={() => setFilterRole('admin')}
            >
              Admins ({stats.admins})
            </button>
            <button
              type="button"
              className={`admin-filter-chip ${filterRole === 'user' ? 'is-active' : ''}`}
              onClick={() => setFilterRole('user')}
            >
              Members ({stats.members})
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User / Identity</th>
                <th>Authentication</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th>Role Privileges</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-users-loading-cell">
                    <NeubenchSpinner size={18} strokeWidth={4.5} />
                    <span>Loading registered users from Supabase...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-users-empty-cell">
                    <span>No users found matching current filters.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.email.toLowerCase() === reviewerEmail.toLowerCase();
                  const isAdminUser = u.role === 'admin';
                  const isProcessing = actionUserId === u.id;

                  return (
                    <tr key={u.id} className={isAdminUser ? 'is-admin-row' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <div className={`admin-user-avatar ${isAdminUser ? 'admin-glow' : ''}`}>
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="admin-user-avatar-img" />
                            ) : (
                              <span>{u.fullName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="admin-user-info">
                            <span className="admin-user-name">
                              {u.fullName}
                              {isCurrentAdmin && <span className="admin-you-tag">You</span>}
                            </span>
                            <span className="admin-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="admin-provider-pill">
                          <span className={`admin-provider-dot ${u.provider}`} />
                          <span className="capitalize">{u.provider}</span>
                        </div>
                      </td>

                      <td>
                        <span className="admin-date-text">{formatDate(u.createdAt)}</span>
                      </td>

                      <td>
                        <span className="admin-date-text">{formatDate(u.lastSignInAt)}</span>
                      </td>

                      <td>
                        {isAdminUser ? (
                          <span className="admin-role-badge active">
                            <ShieldCheck size={12} />
                            Administrator
                          </span>
                        ) : (
                          <span className="admin-role-badge member">
                            <User size={12} />
                            Member
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {isCurrentAdmin ? (
                          <span className="admin-self-protect" title="Self-demotion is prevented for safety">
                            Active Session
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`admin-role-toggle-btn ${isAdminUser ? 'revoke' : 'grant'}`}
                            onClick={() => handleToggleRole(u)}
                            disabled={isPending || isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <NeubenchSpinner size={13} strokeWidth={5} />
                                <span>Updating...</span>
                              </>
                            ) : isAdminUser ? (
                              <>
                                <ShieldAlert size={12} />
                                <span>Revoke Admin</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={12} />
                                <span>Make Admin</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
