import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Loader2, ShieldCheck, Smartphone, X } from 'lucide-react';
import { User } from '../../types';
import { getActiveSubscriptionPlans, SubscriptionPlan } from '../../services/adminService';
import { checkSubscriptionPayment, startSubscriptionPayment, SubscriptionPaymentResult } from '../../services/subscriptionService';
interface SubscriptionModalProps { currentUser: User; onClose: () => void; onSuccess: () => void; }
export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ currentUser, onClose, onSuccess }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selected, setSelected] = useState('');
  const [provider, setProvider] = useState<'mtn_momo' | 'flutterwave'>('mtn_momo');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<SubscriptionPaymentResult | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const callbackRef = params.get('subscription_ref') || '';
  const callbackTransactionId = params.get('transaction_id') || params.get('transactionId') || '';
  useEffect(() => {
    let alive = true;
    getActiveSubscriptionPlans().then((items) => { if (alive) { setPlans(items); if (items.length) setSelected(items[0].id); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Membership plans could not be loaded.'); })
      .finally(() => { if (alive) setLoadingPlans(false); });
    return () => { alive = false; };
  }, []);
  const check = async (reference: string, transactionId?: string) => {
    setBusy(true); setError('');
    try {
      const result = await checkSubscriptionPayment(reference, transactionId);
      setPayment(result);
      if (result.status === 'completed') {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('subscription_ref'); clean.searchParams.delete('transaction_id'); clean.searchParams.delete('transactionId'); clean.searchParams.delete('status');
        window.history.replaceState({}, document.title, clean.pathname + clean.hash + clean.search);
        onSuccess();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment status could not be verified.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (callbackRef) void check(callbackRef, callbackTransactionId || undefined); }, [callbackRef, callbackTransactionId]);
  const selectedPlan = plans.find((p) => p.id === selected);
  const pay = async () => {
    if (!selectedPlan) { setError('Choose a published plan first.'); return; }
    if (provider === 'mtn_momo' && selectedPlan.currency !== 'RWF') { setError('MTN MoMo requires a plan priced in RWF.'); return; }
    if (provider === 'mtn_momo' && !phone.trim()) { setError('Enter your MTN Rwanda mobile number.'); return; }
    setBusy(true); setError('');
    try {
      const result = await startSubscriptionPayment(currentUser, { planId: selectedPlan.id, provider, phoneNumber: provider === 'mtn_momo' ? phone.trim() : undefined });
      setPayment(result);
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'The membership payment could not be started.'); }
    finally { setBusy(false); }
  };
  return <div className='fixed inset-0 z-[90] flex items-center justify-center bg-[#15221C]/70 p-3 backdrop-blur-sm'>
    <section role='dialog' aria-modal='true' aria-labelledby='membership-title' className='max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#D6E2DA] bg-[#FAFCFA] text-[#23352B] shadow-2xl'>
      <header className='flex items-center justify-between border-b border-[#E4ECE6] p-5'><div><p className='text-[10px] font-bold uppercase tracking-[.2em] text-emerald-700'>Member benefits</p><h2 id='membership-title' className='mt-1 text-xl font-bold'>Sodanox membership</h2></div><button onClick={onClose} aria-label='Close membership dialog' className='rounded-full p-2 hover:bg-black/5'><X size={18} /></button></header>
      <div className='space-y-5 p-5'>
        {payment?.status === 'completed' ? <div className='rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center'><CheckCircle2 className='mx-auto text-emerald-600' size={34} /><h3 className='mt-2 font-bold text-emerald-900'>Membership activated</h3><p className='mt-1 text-sm text-emerald-800'>{payment.message}</p><p className='mt-3 break-all font-mono text-[10px] text-emerald-700'>{payment.transactionRef}</p><button onClick={onClose} className='mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white'>Continue</button></div> : <>
          <div><h3 className='mb-2 text-sm font-semibold'>Choose a membership plan</h3>{loadingPlans ? <p className='text-xs text-slate-500'>Loading live plans…</p> : plans.length === 0 ? <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900'>No membership plans are currently published. Ask the platform administrator to configure a plan before checkout.</div> : <div className='grid gap-2 sm:grid-cols-2'>{plans.map((plan) => <button key={plan.id} type='button' onClick={() => setSelected(plan.id)} className={'rounded-2xl border p-4 text-left transition-colors ' + (selected === plan.id ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 bg-white hover:border-emerald-300')}><div className='flex items-center justify-between gap-2'><b className='text-sm'>{plan.name}</b>{selected === plan.id && <CheckCircle2 size={16} className='text-emerald-700' />}</div><p className='mt-2 text-xl font-bold'>{plan.amount.toLocaleString()} <span className='text-xs font-medium'>{plan.currency}</span></p><p className='mt-1 text-[11px] text-slate-500'>{plan.durationDays} days · manual renewal</p>{plan.features.slice(0, 4).map((f) => <p key={f} className='mt-1 text-[11px] text-slate-600'>• {f}</p>)}</button>)}</div>}</div>
          <div><h3 className='mb-2 text-sm font-semibold'>Payment provider</h3><div className='grid grid-cols-2 gap-2'><button onClick={() => setProvider('mtn_momo')} className={'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ' + (provider === 'mtn_momo' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200')}><Smartphone size={16} /> MTN MoMo</button><button onClick={() => setProvider('flutterwave')} className={'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ' + (provider === 'flutterwave' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200')}><CreditCard size={16} /> Flutterwave</button></div></div>
          {provider === 'mtn_momo' && <label className='block text-xs font-semibold'>MTN Rwanda number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode='tel' placeholder='078 xxx xxxx' className='mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm' /></label>}
          {payment?.status === 'pending' && <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950'><div className='flex items-center gap-2 font-semibold'><Loader2 size={15} className={busy ? 'animate-spin' : ''} /> Payment awaiting provider confirmation</div><p className='mt-1'>{payment.message}</p><p className='mt-2 break-all font-mono'>{payment.transactionRef}</p><button disabled={busy} onClick={() => void check(payment.transactionRef)} className='mt-2 rounded-lg border border-amber-400 px-3 py-2 font-semibold disabled:opacity-50'>Check payment status</button></div>}
          {error && <p role='alert' className='flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800'><AlertCircle size={15} className='shrink-0' />{error}</p>}
          <button disabled={busy || loadingPlans || !selectedPlan} onClick={() => void pay()} className='flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50'>{busy ? <Loader2 size={16} className='animate-spin' /> : <ShieldCheck size={16} />}{busy ? 'Contacting payment provider…' : 'Continue to secure payment'}</button>
          <p className='text-[10px] leading-relaxed text-slate-500'>The server verifies every payment before enabling membership. A successful browser redirect alone never activates the plan. Membership uses manual renewal; no automatic debit is started.</p>
        </>}
      </div>
    </section>
  </div>;
}
