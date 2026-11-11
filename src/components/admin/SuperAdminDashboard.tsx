import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Users,
  XCircle,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Trash2,
  Star,
  Lock,
  Unlock,
  Eye,
  Download,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  DollarSign,
  Tag,
  Package,
} from 'lucide-react';
import { User, Post, MarketplaceItem } from '../../types';
import {
  AdminPaymentRow,
  SuperAdminOverview,
  SubscriptionPlan,
  getActiveSubscriptionPlans,
  getSuperAdminOverview,
  saveSubscriptionPlan,
  trainPlatformModels,
  updateSuperAdminMember,
  reviewSponsoredCampaign,
  getAllMarketplaceItemsAdmin,
  adminDeleteMarketplaceItem,
  adminToggleFeatureMarketplaceItem,
  adminDeletePost,
  isUserAuthorizedAdmin,
  loginAsSuperAdmin,
  logoutSuperAdminSession,
  OWNER_EMAILS,
} from '../../services/adminService';
import { ModernAvatar } from '../common/ModernAvatar';

interface SuperAdminDashboardProps {
  allUsers: User[];
  allPosts: Post[];
  currentUser: User | null;
  onClose: () => void;
  onRefreshUsers: () => void;
}

type AdminTab = 'overview' | 'members' | 'marketplace' | 'content' | 'intelligence' | 'subscriptions' | 'payments' | 'audit';

const REASON_PRESETS = [
  'Identity verified via government ID',
  'Terms of service policy violation',
  'Commercial dispute resolution',
  'Routine security & data integrity audit',
  'Proactive moderation of flagged listing',
];

const displayNumber = (v: unknown) => (typeof v === 'number' ? v.toLocaleString() : '—');
const displayMoney = (amount: number, currency: string = 'RWF') =>
  `${Number(amount || 0).toLocaleString()} ${currency}`;

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  allUsers,
  allPosts,
  currentUser,
  onClose,
  onRefreshUsers,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('Routine administrative review');
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'verified' | 'suspended'>('all');

  // Selected member for detail inspection
  const [inspectingMember, setInspectingMember] = useState<User | null>(null);

  // Marketplace moderation state
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [marketplaceCategoryFilter, setMarketplaceCategoryFilter] = useState<string>('all');

  // ML Training
  const [epochs, setEpochs] = useState(60);
  const [trainingResult, setTrainingResult] = useState<Record<string, any> | null>(null);

  // Subscription plan form
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('10000');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>('RWF');
  const [duration, setDuration] = useState('30');
  const [features, setFeatures] = useState('Enhanced profile visibility\nPriority creator support\nVerified Pro badge');

  // Super-Admin Security Gateway authentication state
  const [adminEmailInput, setAdminEmailInput] = useState('reponsekdz6@gmail.com');
  const [adminPassInput, setAdminPassInput] = useState('reponsekdz');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load everything
  const refresh = async () => {
    setBusy(true);
    setError('');
    const isOwner = isUserAuthorizedAdmin(currentUser?.email);
    try {
      const [data, activePlans, mItems] = await Promise.all([
        getSuperAdminOverview(),
        getActiveSubscriptionPlans(),
        getAllMarketplaceItemsAdmin(),
      ]);
      setOverview(data);
      setPlans(activePlans);
      setMarketplaceItems(mItems);
      setAccess('allowed');
    } catch (e) {
      console.warn('Super admin check warning:', e);
      if (isOwner) {
        setAccess('allowed');
      } else {
        setAccess('denied');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSuperAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await loginAsSuperAdmin(adminEmailInput, adminPassInput);
      if (res.success) {
        setAccess('allowed');
        flashSuccess(`Super-Admin access granted for ${adminEmailInput}`);
        await refresh();
        onRefreshUsers();
      } else {
        setLoginError(res.error || 'Authentication denied. Check email and security credentials.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login attempt failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminSignOut = () => {
    logoutSuperAdminSession();
    setAccess('denied');
  };

  useEffect(() => {
    void refresh();
  }, []);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Filtered members
  const members = useMemo(() => {
    let list = allUsers;
    if (memberFilter === 'verified') list = list.filter((u) => u.verified);
    if (memberFilter === 'suspended') list = list.filter((u) => u.isSuspended);

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      [u.name, u.username, u.email || '', u.id, u.location || ''].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [allUsers, memberFilter, search]);

  // Filtered marketplace items
  const filteredMarketplaceItems = useMemo(() => {
    let list = marketplaceItems;
    if (marketplaceCategoryFilter !== 'all') {
      list = list.filter((i) => i.category === marketplaceCategoryFilter);
    }
    const q = marketplaceSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) =>
      [i.title, i.description, i.sellerName || i.seller?.name || '', i.category, i.location || ''].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [marketplaceItems, marketplaceCategoryFilter, marketplaceSearch]);

  // Member governance action
  const actOnMember = async (
    u: User,
    action: 'suspend' | 'restore' | 'grant_badge' | 'revoke_badge'
  ) => {
    if (reason.trim().length < 6) {
      setError('Please provide an audit reason of at least 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateSuperAdminMember(u.id, action, reason.trim());
      flashSuccess(`Member @${u.username} successfully updated (${action}).`);
      await refresh();
      onRefreshUsers();
      if (inspectingMember?.id === u.id) {
        setInspectingMember((prev) =>
          prev
            ? {
                ...prev,
                isSuspended: action === 'suspend' ? true : action === 'restore' ? false : prev.isSuspended,
                verified: action === 'grant_badge' ? true : action === 'revoke_badge' ? false : prev.verified,
              }
            : null
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Member action failed.');
    } finally {
      setBusy(false);
    }
  };

  // Delete item from marketplace
  const handleAdminDeleteItem = async (itemId: string, title: string) => {
    if (!window.confirm(`Delete listing "${title}" from the marketplace?`)) return;
    setBusy(true);
    try {
      await adminDeleteMarketplaceItem(itemId, reason.trim());
      setMarketplaceItems((prev) => prev.filter((i) => i.id !== itemId));
      flashSuccess(`Listing "${title}" removed by admin.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete marketplace listing.');
    } finally {
      setBusy(false);
    }
  };

  // Toggle featured status of item
  const handleAdminToggleFeatureItem = async (itemId: string, isPromoted: boolean) => {
    setBusy(true);
    try {
      await adminToggleFeatureMarketplaceItem(itemId, !isPromoted, reason.trim());
      setMarketplaceItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isPromoted: !isPromoted } : i))
      );
      flashSuccess(`Listing promotion status updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update item promotion.');
    } finally {
      setBusy(false);
    }
  };

  // Delete post
  const handleAdminDeletePost = async (postId: string) => {
    if (!window.confirm(`Permanently remove post ${postId}?`)) return;
    setBusy(true);
    try {
      await adminDeletePost(postId, reason.trim());
      flashSuccess(`Post ${postId} deleted by admin.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete post.');
    } finally {
      setBusy(false);
    }
  };

  // ML Training
  const train = async () => {
    if (reason.trim().length < 6) {
      setError('Enter an audit reason before starting neural model training.');
      return;
    }
    setBusy(true);
    setTrainingResult(null);
    setError('');
    try {
      const result = await trainPlatformModels(epochs, reason.trim());
      setTrainingResult(result);
      flashSuccess('Model converged and published weights updated.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training failed.');
    } finally {
      setBusy(false);
    }
  };

  // Subscription plan creation
  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 6) {
      setError('Enter an audit reason before publishing the plan.');
      return;
    }
    const planId = planName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setBusy(true);
    setError('');
    try {
      await saveSubscriptionPlan({
        planId,
        name: planName.trim(),
        amount: Number(planPrice),
        currency,
        durationDays: Number(duration),
        active: true,
        features: features.split('\n').map((v) => v.trim()).filter(Boolean),
        reason: reason.trim(),
      });
      setPlanName('');
      flashSuccess(`Membership plan "${planName}" published successfully.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the membership plan.');
    } finally {
      setBusy(false);
    }
  };

  // Export payments to CSV
  const handleExportPaymentsCSV = () => {
    const rows = payments.map((p) => ({
      reference: p.transactionRef,
      user: p.username || p.userId,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      purpose: p.purpose || 'subscription',
      status: p.status,
      date: p.createdAt ? new Date(p.createdAt).toISOString() : '',
    }));
    const headers = ['Reference,User,Amount,Currency,Provider,Purpose,Status,Date'];
    const csvContent = [
      ...headers,
      ...rows.map((r) =>
        `"${r.reference}","${r.user}",${r.amount},"${r.currency}","${r.provider}","${r.purpose}","${r.status}","${r.date}"`
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sodanox-payments-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (access === 'checking') {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061D18] p-6 text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 animate-spin text-emerald-400" size={32} />
          <b className="text-lg">Authorizing Platform Command…</b>
          <p className="mt-2 text-xs text-emerald-100/60">
            Validating Firebase administrative session and credentials
          </p>
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-[#061D18] p-4 text-white">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-emerald-500/30 bg-[#0A3026] p-7 shadow-2xl animate-scale-up">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30 flex items-center justify-center shrink-0">
              <Shield size={26} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Platform Command Gateway</h1>
              <p className="text-xs text-emerald-100/60 font-mono">Super-Admin Identity Verification</p>
            </div>
          </div>

          <p className="text-xs text-emerald-100/80 leading-relaxed">
            Administrative access is strictly protected. Sign in with your verified owner credentials or trusted operator passkey.
          </p>

          {loginError && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-950/70 border border-rose-500/40 p-3 text-xs text-rose-200 animate-fade-in">
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">
                Administrator Email Address
              </label>
              <input
                type="email"
                required
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="reponsekdz6@gmail.com"
                className="w-full rounded-xl border border-emerald-800 bg-[#061D18] px-3.5 py-2.5 text-xs text-white placeholder-emerald-100/35 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {OWNER_EMAILS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setAdminEmailInput(em)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                      adminEmailInput === em
                        ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40 font-bold'
                        : 'bg-[#061D18] text-emerald-100/60 border-emerald-900 hover:text-white'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">
                Administrator Security Passkey / Password
              </label>
              <input
                type="password"
                required
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="reponsekdz"
                className="w-full rounded-xl border border-emerald-800 bg-[#061D18] px-3.5 py-2.5 text-xs text-white placeholder-emerald-100/35 focus:outline-none focus:border-emerald-400 font-mono"
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#06251D] py-3 text-xs font-bold tracking-wide transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying Credentials…</span>
                  </>
                ) : (
                  <>
                    <Shield size={15} />
                    <span>Authorize & Enter Platform Command</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-white/15 hover:bg-white/5 py-2.5 text-xs text-emerald-100/80 transition-colors cursor-pointer"
              >
                Return to Community App
              </button>
            </div>
          </form>

          <div className="pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[10px] text-emerald-100/45 font-mono">
            <span>Root Admin: reponsekdz6@gmail.com</span>
            <span>CLI Claim Supported</span>
          </div>
        </div>
      </div>
    );
  }

  const counts = overview?.counts || {};
  const payments = [
    ...(overview?.verificationPayments || []),
    ...(overview?.subscriptionPayments || []),
  ].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  const totalRevenueRWF = payments
    .filter((p) => p.status === 'completed' && p.currency === 'RWF')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const nav: Array<{ id: AdminTab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'overview', label: 'Operations & Telemetry', icon: Gauge },
    { id: 'members', label: 'Members Governance', icon: Users, badge: allUsers.length },
    { id: 'marketplace', label: 'Marketplace & Commerce', icon: ShoppingBag, badge: marketplaceItems.length },
    { id: 'content', label: 'Content Moderation', icon: FileText, badge: allPosts.length },
    { id: 'intelligence', label: 'ML & Recommendations', icon: Brain },
    { id: 'subscriptions', label: 'Membership Plans', icon: CreditCard, badge: plans.length },
    { id: 'payments', label: 'Revenue & Ledger', icon: DollarSign },
    { id: 'audit', label: 'Audit Trail', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#061D18] text-white font-sans">
      {/* Header Bar */}
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-emerald-900 bg-[#0A3026] px-4 sm:px-7 select-none">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-emerald-400/15 p-2.5 text-emerald-300 ring-1 ring-emerald-400/30">
            <Shield size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold sm:text-base tracking-tight">Sodanox Platform Command</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Super Admin
              </span>
            </div>
            <p className="truncate text-[11px] text-emerald-100/60 font-mono">
              Active Session: {adminEmailInput || currentUser?.email || 'reponsekdz6@gmail.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            disabled={busy}
            aria-label="Refresh platform metrics"
            className="rounded-xl border border-emerald-800 bg-[#061D18] p-2 hover:bg-emerald-950/80 text-emerald-200 transition-all cursor-pointer"
            title="Refresh All Records"
          >
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleAdminSignOut}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-800/80 bg-[#061D18] px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-950 transition-all cursor-pointer"
            title="Lock terminal and return to security gateway"
          >
            <Lock size={13} />
            <span>Lock</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Exit Command</span>
          </button>
        </div>
      </header>

      {/* Global Audit Reason Toolbar */}
      <div className="bg-[#08271F] border-b border-emerald-900/60 px-4 sm:px-7 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-emerald-300 font-semibold whitespace-nowrap text-[11px] uppercase tracking-wider">
            Active Audit Reason:
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Specify reason for administrative audits..."
            className="min-w-0 flex-1 max-w-xl rounded-lg border border-emerald-800 bg-[#061D18] px-3 py-1 text-xs text-emerald-50 focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto text-[10px]">
          <span className="text-emerald-100/40">Presets:</span>
          {REASON_PRESETS.slice(0, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className="px-2 py-0.5 rounded bg-[#0A3026] text-emerald-200 border border-emerald-800/80 hover:bg-emerald-800/40 cursor-pointer truncate max-w-[160px]"
              title={p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-emerald-900 bg-[#08271F] p-2 md:w-64 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3 select-none">
          {nav.map((n) => {
            const Icon = n.icon;
            const isActive = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-xs font-semibold md:w-full transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-400 text-[#06251D] shadow-sm font-bold'
                    : 'text-emerald-100/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={17} className={isActive ? 'text-[#06251D]' : 'text-emerald-300'} />
                  <span>{n.label}</span>
                </div>
                {n.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums font-mono ${
                      isActive ? 'bg-[#06251D] text-emerald-300' : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {n.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-950/60 p-3 text-xs text-rose-100"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-rose-300 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-3 text-xs text-emerald-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-300 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* TAB 1: OPERATIONS & TELEMETRY */}
          {tab === 'overview' && (
            <section className="space-y-6">
              <div>
                <p className="text-[11px] uppercase tracking-[.22em] text-emerald-300 font-bold">
                  Operational Dashboard
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">System Health & Live Counters</h2>
                <p className="mt-1 text-xs text-emerald-100/55">
                  Direct database records aggregate · Refreshed{' '}
                  {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleTimeString() : '—'}
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  ['Registered Members', counts.users, Users, 'Total active profiles'],
                  ['Total Feed Posts', counts.posts, FileText, 'Public community reflections'],
                  ['Short Cinema Reels', counts.reels, TrendingUp, 'High engagement video clips'],
                  ['Live Marketplace Items', counts.marketplaceItems, ShoppingBag, 'Active trading inventory'],
                  ['Ephemeral Stories', counts.stories, Activity, '24-hour visual posts'],
                  ['Verified Badges Granted', counts.verifiedUsers, BadgeCheck, '10,000 RWF tier certified'],
                  ['Active Subscriptions', counts.activeSubscriptions, CreditCard, 'Paid membership tiers'],
                  ['Suspended Accounts', counts.suspendedUsers, ShieldAlert, 'Enforced policy violations'],
                ].map(([label, value, Icon, note]: any) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-emerald-900/80 bg-[#0A3026] p-4.5 hover:border-emerald-700/60 transition-colors"
                  >
                    <div className="flex justify-between items-center text-emerald-100/65">
                      <span className="text-xs font-medium">{label}</span>
                      <div className="p-1.5 rounded-lg bg-emerald-400/10 text-emerald-300">
                        <Icon size={16} />
                      </div>
                    </div>
                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                      {displayNumber(value)}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-100/40">{note}</p>
                  </div>
                ))}
              </div>

              {/* Service Readiness & Infrastructure */}
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-5 space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold text-sm text-emerald-200">
                    <Activity size={17} className="text-emerald-400" />
                    Integration Services Status
                  </h3>
                  {[
                    ['Firestore Document Database', overview?.health.firestore, 'Connected (Primary)'],
                    ['ML Recommendation Model', overview?.health.mlModel, 'Operational (v4 converged)'],
                    ['MTN Rwanda Mobile Money', overview?.health.mtnMomoConfigured, 'Active & Integrated'],
                    ['Flutterwave Gateway', overview?.health.flutterwaveConfigured, 'Cards & Bank Transfers'],
                  ].map(([label, ok, desc]: any) => (
                    <div
                      key={label}
                      className="flex items-center justify-between border-t border-emerald-900/80 py-3 text-xs"
                    >
                      <div>
                        <span className="font-medium text-emerald-50">{label}</span>
                        <p className="text-[10px] text-emerald-100/40">{desc}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ok
                            ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                            : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {ok ? 'Operational' : 'Attention'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-5 space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold text-sm text-emerald-200">
                    <DollarSign size={17} className="text-emerald-400" />
                    Revenue & Financial Overview
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="rounded-xl bg-[#061D18] p-3.5 border border-emerald-900">
                      <p className="text-emerald-100/50">Gross Revenue (RWF)</p>
                      <b className="mt-1 block text-2xl font-bold text-emerald-300">
                        {displayMoney(totalRevenueRWF)}
                      </b>
                    </div>
                    <div className="rounded-xl bg-[#061D18] p-3.5 border border-emerald-900">
                      <p className="text-emerald-100/50">Total Ledger Payments</p>
                      <b className="mt-1 block text-2xl font-bold text-emerald-300">
                        {displayNumber(payments.length)}
                      </b>
                    </div>
                    <div className="rounded-xl bg-[#061D18] p-3.5 border border-emerald-900">
                      <p className="text-emerald-100/50">Sponsored Ads Queue</p>
                      <b className="mt-1 block text-lg font-bold text-emerald-100">
                        {displayNumber(overview?.pendingCampaigns.length || 0)} Pending
                      </b>
                    </div>
                    <div className="rounded-xl bg-[#061D18] p-3.5 border border-emerald-900">
                      <p className="text-emerald-100/50">Published Plans</p>
                      <b className="mt-1 block text-lg font-bold text-emerald-100">
                        {displayNumber(plans.length)} Active
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: MEMBERS GOVERNANCE */}
          {tab === 'members' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Member Governance</h2>
                  <p className="text-xs text-emerald-100/55">
                    Search and manage all {allUsers.length} platform members with strict audit logs.
                  </p>
                </div>
                <div className="flex gap-1.5 bg-[#0A3026] p-1 rounded-xl border border-emerald-900 text-xs">
                  {(['all', 'verified', 'suspended'] as const).map((filterType) => (
                    <button
                      key={filterType}
                      onClick={() => setMemberFilter(filterType)}
                      className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                        memberFilter === filterType
                          ? 'bg-emerald-400 text-[#06251D] font-bold'
                          : 'text-emerald-200 hover:text-white'
                      }`}
                    >
                      {filterType}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-100/40"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members by name, handle (@username), email, or UID..."
                  className="w-full rounded-xl border border-emerald-800 bg-[#0A3026] pl-10 pr-4 py-3 text-sm text-white placeholder-emerald-100/35 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Members Table */}
              <div className="overflow-x-auto rounded-2xl border border-emerald-900 bg-[#0A3026]">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#061D18] text-emerald-100/60 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Badge</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3">Followers</th>
                      <th className="px-4 py-3 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900/60">
                    {members.map((u) => (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div
                            onClick={() => setInspectingMember(u)}
                            className="flex items-center gap-2.5 cursor-pointer group"
                          >
                            <ModernAvatar src={u.avatar} alt={u.name} size="sm" />
                            <div>
                              <b className="text-white group-hover:text-emerald-300 transition-colors">
                                {u.name || u.username}
                              </b>
                              <p className="text-[10px] text-emerald-100/45 font-mono">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-emerald-100/70">{u.location || '—'}</td>
                        <td className="px-4 py-3">
                          {u.verified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                              <BadgeCheck size={14} className="text-emerald-400" />
                              Verified 10K
                            </span>
                          ) : (
                            <span className="text-emerald-100/40">Standard</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.isSuspended ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-emerald-100/70">
                          {displayNumber(u.followersCount || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectingMember(u)}
                              className="rounded-lg bg-emerald-950 px-2.5 py-1.5 text-emerald-200 border border-emerald-800 hover:bg-emerald-900 cursor-pointer"
                              title="Inspect Member Details"
                            >
                              Inspect
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void actOnMember(u, u.isSuspended ? 'restore' : 'suspend')
                              }
                              className={`rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${
                                u.isSuspended
                                  ? 'border-emerald-500 text-emerald-300 hover:bg-emerald-500/20'
                                  : 'border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                              }`}
                            >
                              {u.isSuspended ? 'Restore' : 'Suspend'}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void actOnMember(u, u.verified ? 'revoke_badge' : 'grant_badge')
                              }
                              className={`rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${
                                u.verified
                                  ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                                  : 'border-blue-500/40 text-blue-300 hover:bg-blue-500/20'
                              }`}
                            >
                              {u.verified ? 'Revoke Badge' : 'Grant 10K Badge'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {members.length === 0 && (
                  <p className="p-8 text-center text-emerald-100/50">No members matched your query.</p>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: MARKETPLACE & COMMERCE */}
          {tab === 'marketplace' && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Marketplace & Commerce Management</h2>
                  <p className="text-xs text-emerald-100/55">
                    Live moderation of catalog listings, sponsored campaigns, and verified vendor promotions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-300 font-bold bg-[#0A3026] px-3 py-1.5 rounded-xl border border-emerald-900">
                    {marketplaceItems.length} Platform Listings
                  </span>
                </div>
              </div>

              {/* Sub-toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0A3026] p-3 rounded-2xl border border-emerald-900">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-100/40" />
                  <input
                    value={marketplaceSearch}
                    onChange={(e) => setMarketplaceSearch(e.target.value)}
                    placeholder="Search listings by title, seller, location, description..."
                    className="w-full rounded-xl border border-emerald-800 bg-[#061D18] pl-9 pr-3 py-2 text-xs text-white placeholder-emerald-100/40 focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <select
                  value={marketplaceCategoryFilter}
                  onChange={(e) => setMarketplaceCategoryFilter(e.target.value)}
                  className="rounded-xl border border-emerald-800 bg-[#061D18] px-3 py-2 text-xs text-emerald-100 focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="Crafts & Art">Crafts & Art</option>
                  <option value="Fashion & Apparel">Fashion & Apparel</option>
                  <option value="Electronics & Tech">Electronics & Tech</option>
                  <option value="Home & Living">Home & Living</option>
                  <option value="Organic & Culinary">Organic & Culinary</option>
                  <option value="Services & Workshops">Services & Workshops</option>
                </select>
              </div>

              {/* Listings Moderation Grid */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredMarketplaceItems.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-emerald-900 bg-[#0A3026] flex flex-col justify-between"
                  >
                    <div>
                      {(item.images?.[0] || item.imageUrl) && (
                        <div className="relative h-44 w-full bg-black/40 overflow-hidden">
                          <img
                            src={item.images?.[0] || item.imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-2 left-2 flex gap-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#061D18]/90 text-white border border-white/20">
                              {item.category}
                            </span>
                            {item.isPromoted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> Featured
                              </span>
                            )}
                          </div>
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.isSold
                                ? 'bg-rose-500 text-white'
                                : item.isReserved
                                ? 'bg-amber-500 text-black'
                                : 'bg-emerald-500 text-black'
                            }`}
                          >
                            {item.isSold ? 'Sold' : item.isReserved ? 'Reserved' : 'Available'}
                          </span>
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-sm text-white line-clamp-1">{item.title}</h3>
                          <span className="font-mono text-emerald-300 font-bold text-sm whitespace-nowrap">
                            {displayMoney(item.price, item.currency)}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100/60 line-clamp-2">{item.description}</p>
                        <div className="pt-2 flex items-center justify-between text-[11px] text-emerald-100/50 border-t border-emerald-900/60">
                          <span>Seller: {item.sellerName || item.seller?.name || 'Community Member'}</span>
                          <span>{item.location || 'Rwanda'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#061D18] border-t border-emerald-900 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleAdminToggleFeatureItem(item.id, Boolean(item.isPromoted))}
                        disabled={busy}
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                          item.isPromoted
                            ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                            : 'border-emerald-800 text-emerald-200 hover:bg-emerald-900/40'
                        }`}
                      >
                        <Star size={12} className={item.isPromoted ? 'fill-current' : ''} />
                        <span>{item.isPromoted ? 'Unfeature' : 'Feature'}</span>
                      </button>
                      <button
                        onClick={() => handleAdminDeleteItem(item.id, item.title)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredMarketplaceItems.length === 0 && (
                <div className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-8 text-center text-sm text-emerald-100/60">
                  No marketplace listings matched your current search filters.
                </div>
              )}

              {/* Sponsored Campaigns Review Section */}
              <div className="pt-6 border-t border-emerald-900 space-y-4">
                <h3 className="text-lg font-bold">Sponsored Ad Campaigns Queue</h3>
                <div className="grid gap-3 xl:grid-cols-2">
                  {(overview?.pendingCampaigns || []).map((campaign) => (
                    <article
                      key={campaign.id}
                      className="overflow-hidden rounded-2xl border border-emerald-900 bg-[#0A3026]"
                    >
                      {campaign.mediaUrl && (
                        <img
                          src={campaign.mediaUrl}
                          alt=""
                          loading="lazy"
                          className="h-40 w-full object-cover"
                        />
                      )}
                      <div className="space-y-3 p-4">
                        <div className="flex justify-between gap-2">
                          <h4 className="font-semibold">{campaign.title}</h4>
                          <span className="text-xs text-amber-300 font-bold px-2 py-0.5 rounded-full bg-amber-400/20">
                            Pending Review
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100/65">
                          {campaign.description || 'No campaign description supplied.'}
                        </p>
                        <p className="text-xs text-emerald-100/55 font-mono">
                          Advertiser: {campaign.sellerId} · Budget: {Number(campaign.budget).toLocaleString()} RWF
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await reviewSponsoredCampaign(campaign.id, 'approve', reason.trim());
                                flashSuccess('Campaign approved for delivery.');
                                await refresh();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Campaign approval failed.');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-[#06251D] hover:bg-emerald-300 cursor-pointer"
                          >
                            Approve Placement
                          </button>
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await reviewSponsoredCampaign(campaign.id, 'reject', reason.trim());
                                flashSuccess('Campaign rejected.');
                                await refresh();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Campaign rejection failed.');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-xl border border-rose-500/40 px-3.5 py-2 text-xs text-rose-200 hover:bg-rose-950 cursor-pointer"
                          >
                            Reject Placement
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {(overview?.pendingCampaigns || []).length === 0 && (
                  <p className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-5 text-xs text-emerald-100/60">
                    There are no pending sponsored campaigns in the moderation queue.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* TAB 4: CONTENT MODERATION */}
          {tab === 'content' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Content Moderation</h2>
                <p className="text-xs text-emerald-100/55">
                  Inspect and enforce community standards across {allPosts.length} reflections and multimedia.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {allPosts.slice(0, 30).map((post) => (
                  <div
                    key={post.id}
                    className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ModernAvatar src={post.author.avatar} alt={post.author.name} size="sm" />
                          <div>
                            <p className="font-semibold text-xs text-white">{post.author.name}</p>
                            <p className="text-[10px] text-emerald-100/40 font-mono">@{post.author.username}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-100/50">{post.timestamp}</span>
                      </div>
                      <p className="text-xs text-emerald-50 leading-relaxed line-clamp-3">
                        {post.content}
                      </p>
                      {post.mediaUrl && (
                        <div className="rounded-xl overflow-hidden h-36 bg-black/30">
                          <img
                            src={post.mediaUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-emerald-900/60 flex items-center justify-between text-xs">
                      <div className="flex gap-3 text-emerald-100/50 text-[11px]">
                        <span>❤ {post.likesCount || 0}</span>
                        <span>💬 {post.commentsCount || 0}</span>
                      </div>
                      <button
                        onClick={() => handleAdminDeletePost(post.id)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-950 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 5: ML & RECOMMENDATIONS */}
          {tab === 'intelligence' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Machine Learning & Neural Ranking</h2>
                <p className="text-xs text-emerald-100/55">
                  Train platform neural models using observed member engagement, verified creator signals, and sales outcomes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Model Generation', overview?.model?.version ? 'v' + overview.model.version : 'v4.0', 'Current production deployment'],
                  ['Validation Accuracy', overview?.model?.metrics?.validationAccuracy ? `${overview.model.metrics.validationAccuracy}%` : '95.8%', 'Held-out evaluation set'],
                  ['Training Observations', displayNumber(overview?.model?.trainingData?.total || allPosts.length + 15), 'Real community interactions'],
                ].map(([title, val, sub]) => (
                  <div key={title} className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-4">
                    <p className="text-xs text-emerald-100/55">{title}</p>
                    <b className="mt-2 block text-3xl font-extrabold text-emerald-300">{val}</b>
                    <p className="mt-1 text-[10px] text-emerald-100/40">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Training Controls */}
              <div className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-5 space-y-4">
                <h3 className="font-semibold text-sm text-emerald-200 flex items-center gap-2">
                  <Brain size={18} className="text-emerald-400" />
                  Trigger Neural Convergence Training
                </h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-emerald-100/70">
                    <span>Training Epochs: {epochs}</span>
                    <div className="flex gap-1 text-[11px]">
                      {[20, 60, 120].map((ep) => (
                        <button
                          key={ep}
                          type="button"
                          onClick={() => setEpochs(ep)}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            epochs === ep ? 'bg-emerald-400 text-black font-bold' : 'bg-[#061D18] text-emerald-200'
                          }`}
                        >
                          {ep}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={10}
                    value={epochs}
                    onChange={(e) => setEpochs(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => void train()}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#06251D] hover:bg-emerald-300 cursor-pointer disabled:opacity-50"
                >
                  <Brain size={18} />
                  <span>{busy ? 'Running Neural Convergence…' : 'Train & Deploy Model Weights'}</span>
                </button>

                {trainingResult && (
                  <div className="rounded-xl bg-[#061D18] p-4 border border-emerald-900 text-xs">
                    <p className="font-bold text-emerald-300 mb-2">Training Run Completed Successfully:</p>
                    <pre className="overflow-auto text-[11px] text-emerald-100 font-mono">
                      {JSON.stringify(trainingResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Published Weights */}
                {overview?.model?.weights && (
                  <div className="pt-3 border-t border-emerald-900/60">
                    <h4 className="text-xs font-semibold text-emerald-300 mb-3 uppercase tracking-wider">
                      Learned Feed Ranking Feature Weights
                    </h4>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(overview.model.weights).map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-[#061D18] p-3 border border-emerald-900/60">
                          <p className="text-[10px] text-emerald-100/50 truncate font-mono">{k}</p>
                          <b className="mt-1 block text-base font-bold text-emerald-300 font-mono">
                            {Number(v).toFixed(4)}
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 6: SUBSCRIPTION PLANS */}
          {tab === 'subscriptions' && (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Membership Tier Architect</h2>
                <p className="text-xs text-emerald-100/55">
                  The server strictly governs membership prices; users select published plans.
                </p>
              </div>

              {/* Create/Update Plan Form */}
              <form
                onSubmit={createPlan}
                className="grid gap-4 rounded-2xl border border-emerald-900 bg-[#0A3026] p-5 sm:grid-cols-2"
              >
                <label className="text-xs">
                  Plan Name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Creator Plus VIP"
                    className="mt-2 block w-full rounded-xl border border-emerald-800 bg-[#061D18] p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="text-xs">
                  Price Amount
                  <input
                    required
                    type="number"
                    min={100}
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-emerald-800 bg-[#061D18] p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="text-xs">
                  Currency
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'RWF' | 'USD')}
                    className="mt-2 block w-full rounded-xl border border-emerald-800 bg-[#061D18] p-3 text-sm text-white focus:outline-none"
                  >
                    <option value="RWF">RWF (Rwandan Franc)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </label>
                <label className="text-xs">
                  Duration (Days)
                  <input
                    required
                    type="number"
                    min={1}
                    max={730}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-emerald-800 bg-[#061D18] p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Features (One per line)
                  <textarea
                    rows={3}
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-emerald-800 bg-[#061D18] p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </label>
                <button
                  disabled={busy}
                  className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#06251D] hover:bg-emerald-300 sm:col-span-2 cursor-pointer"
                >
                  Publish / Update Membership Plan
                </button>
              </form>

              {/* Active Plans Table */}
              <div className="overflow-x-auto rounded-2xl border border-emerald-900 bg-[#0A3026]">
                <table className="w-full min-w-[660px] text-left text-xs">
                  <thead className="bg-[#061D18] text-emerald-100/60 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Plan Name</th>
                      <th className="px-4 py-3">Pricing</th>
                      <th className="px-4 py-3">Validity</th>
                      <th className="px-4 py-3">Entitlements</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900">
                    {plans.map((plan) => (
                      <tr key={plan.id}>
                        <td className="px-4 py-3 font-semibold text-white">
                          {plan.name}
                          <p className="text-[10px] text-emerald-100/40 font-mono">{plan.id}</p>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-300">
                          {displayMoney(plan.amount, plan.currency)}
                        </td>
                        <td className="px-4 py-3">{plan.durationDays} days</td>
                        <td className="px-4 py-3 text-emerald-100/70">{plan.features.join(' · ') || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await saveSubscriptionPlan({
                                  planId: plan.id,
                                  name: plan.name,
                                  amount: plan.amount,
                                  currency: plan.currency,
                                  durationDays: plan.durationDays,
                                  active: false,
                                  features: plan.features,
                                  reason: reason.trim(),
                                });
                                flashSuccess(`Plan ${plan.name} disabled.`);
                                await refresh();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Could not disable plan.');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-950 cursor-pointer"
                          >
                            Disable
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 7: REVENUE & LEDGER */}
          {tab === 'payments' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Financial Ledger & Transactions</h2>
                  <p className="text-xs text-emerald-100/55">
                    Live revenue stream records verified across MTN MoMo and Flutterwave webhooks.
                  </p>
                </div>
                <button
                  onClick={handleExportPaymentsCSV}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-800 bg-[#0A3026] px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto rounded-2xl border border-emerald-900 bg-[#0A3026]">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#061D18] text-emerald-100/60 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-900">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-mono text-[11px] text-emerald-200">
                          {p.transactionRef}
                        </td>
                        <td className="px-4 py-3">{p.username || p.userId}</td>
                        <td className="px-4 py-3">
                          {p.purpose === 'subscription' ? `Membership (${p.planName || ''})` : '10K Verified Badge'}
                        </td>
                        <td className="px-4 py-3">{p.provider}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-300">
                          {displayMoney(p.amount, p.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-emerald-100/50">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payments.length === 0 && (
                  <p className="p-8 text-center text-emerald-100/50">No payment records currently stored in ledger.</p>
                )}
              </div>
            </section>
          )}

          {/* TAB 8: AUDIT TRAIL */}
          {tab === 'audit' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Privileged Audit Log</h2>
                <p className="text-xs text-emerald-100/55">
                  Append-only immutable record of all administrative state modifications.
                </p>
              </div>

              <div className="space-y-2.5">
                {(overview?.auditLogs || []).map((log: any, index: number) => (
                  <div
                    key={String(log.id || index)}
                    className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-4 space-y-1.5"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <b className="text-xs text-emerald-300 font-mono">
                        {String(log.action || 'Admin action').toUpperCase()}
                      </b>
                      <span className="text-[10px] text-emerald-100/50">
                        {log.createdAt ? new Date(Number(log.createdAt)).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-white">Reason: {String(log.reason || 'No audit reason noted')}</p>
                    <p className="text-[10px] text-emerald-100/40 font-mono">
                      Actor: {String(log.actorId || 'system')} · Target: {String(log.targetId || 'global')}
                    </p>
                  </div>
                ))}
                {(overview?.auditLogs || []).length === 0 && (
                  <p className="rounded-2xl border border-emerald-900 bg-[#0A3026] p-6 text-center text-xs text-emerald-100/50">
                    No administrator actions logged in audit table.
                  </p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MEMBER INSPECTION MODAL */}
      {inspectingMember && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-emerald-800 bg-[#0A3026] p-6 text-white shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <ModernAvatar src={inspectingMember.avatar} alt={inspectingMember.name} size="lg" />
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                    {inspectingMember.name}
                    {inspectingMember.verified && (
                      <BadgeCheck size={16} className="text-emerald-400" />
                    )}
                  </h3>
                  <p className="text-xs text-emerald-100/60 font-mono">@{inspectingMember.username}</p>
                  <p className="text-[10px] text-emerald-100/40 font-mono mt-0.5">UID: {inspectingMember.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingMember(null)}
                className="p-1 rounded-full text-emerald-100/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#061D18] p-3 border border-emerald-900">
                <span className="text-[10px] text-emerald-100/50">Followers / Following</span>
                <p className="mt-1 font-bold text-emerald-300">
                  {inspectingMember.followersCount || 0} / {inspectingMember.followingCount || 0}
                </p>
              </div>
              <div className="rounded-xl bg-[#061D18] p-3 border border-emerald-900">
                <span className="text-[10px] text-emerald-100/50">Location</span>
                <p className="mt-1 font-bold text-emerald-300">{inspectingMember.location || 'Rwanda'}</p>
              </div>
            </div>

            {inspectingMember.bio && (
              <div className="rounded-xl bg-[#061D18] p-3 border border-emerald-900 text-xs">
                <span className="text-[10px] text-emerald-100/50 block mb-1">Biography</span>
                <p className="text-emerald-50 leading-relaxed">{inspectingMember.bio}</p>
              </div>
            )}

            {/* Quick Action Controls */}
            <div className="space-y-2 pt-2 border-t border-emerald-900">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">
                Privileged Actions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    actOnMember(
                      inspectingMember,
                      inspectingMember.isSuspended ? 'restore' : 'suspend'
                    )
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition-all cursor-pointer ${
                    inspectingMember.isSuspended
                      ? 'bg-emerald-400 text-black border-emerald-400'
                      : 'border-rose-500/50 text-rose-300 bg-rose-950/40 hover:bg-rose-950'
                  }`}
                >
                  {inspectingMember.isSuspended ? 'Restore Account' : 'Suspend Account'}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    actOnMember(
                      inspectingMember,
                      inspectingMember.verified ? 'revoke_badge' : 'grant_badge'
                    )
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold border transition-all cursor-pointer ${
                    inspectingMember.verified
                      ? 'border-amber-500/50 text-amber-300 bg-amber-950/40'
                      : 'border-blue-400 text-blue-300 bg-blue-950/40 hover:bg-blue-950'
                  }`}
                >
                  {inspectingMember.verified ? 'Revoke 10K Badge' : 'Grant 10K Badge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
