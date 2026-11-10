import React, { useEffect, useRef, useState } from 'react';
import {
  X, ShieldCheck, CheckCircle2, Smartphone, Globe, Sparkles, ArrowRight,
  Lock, Loader2, Check, AlertCircle, RefreshCw,
} from 'lucide-react';
import { User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import {
  processVerifiedBadgePayment,
  verifyVerifiedBadgePayment,
  VERIFICATION_FEE_RWF,
  VERIFICATION_FEE_USD,
  PaymentResult,
  PaymentInitiateRequest,
} from '../../services/verificationPaymentService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface PayVerifiedModalProps {
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const PayVerifiedModal: React.FC<PayVerifiedModalProps> = ({ currentUser, onClose, onSuccess }) => {
  const [provider, setProvider] = useState<PaymentInitiateRequest['provider']>('mtn_momo');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>('RWF');
  const [phoneNumber, setPhoneNumber] = useState('078');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const handledCompletion = useRef(false);
  const feeAmount = currency === 'USD' ? VERIFICATION_FEE_USD : VERIFICATION_FEE_RWF;

  const applyPaymentResult = (result: PaymentResult) => {
    if (result.status === 'completed') {
      if (handledCompletion.current) return;
      handledCompletion.current = true;
      setPaymentResult(result);
      setPendingRef(null);
      setError(null);
      auraAudio.playChime();
      onSuccess({ ...currentUser, verified: true, verifiedBadgeType: 'blue', verifiedSince: Date.now() });
      return;
    }
    if (result.status === 'failed') {
      setPendingRef(null);
      setPaymentResult(null);
      setError(result.message || 'The provider reported that this payment failed.');
      return;
    }
    setPaymentResult(result);
    setPendingRef(result.transactionRef);
  };

  const checkPayment = async (transactionRef: string, providerTransactionId?: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await verifyVerifiedBadgePayment(transactionRef, providerTransactionId);
      applyPaymentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the payment yet.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Flutterwave returns here after its hosted checkout. The browser never marks a payment as paid;
  // the callable verifies the transaction directly with Flutterwave before enabling the badge.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transactionRef = params.get('verification_ref');
    const providerTransactionId = params.get('transaction_id') || undefined;
    const redirectStatus = params.get('status');
    if (!transactionRef) return;
    setProvider('flutterwave');
    handledCompletion.current = false;
    if (redirectStatus === 'cancelled' || redirectStatus === 'failed') {
      setError('The checkout was cancelled or declined. No verified badge was activated; you can try again.');
    } else {
      void checkPayment(transactionRef, providerTransactionId);
    }
    params.delete('verification_ref');
    params.delete('transaction_id');
    params.delete('status');
    const query = params.toString();
    const cleanUrl = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  // MTN Request-to-Pay is asynchronous: keep checking the provider until the customer approves or declines.
  useEffect(() => {
    if (!pendingRef || provider !== 'mtn_momo') return;
    let stopped = false;
    let checking = false;
    const poll = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const result = await verifyVerifiedBadgePayment(pendingRef);
        if (!stopped) applyPaymentResult(result);
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'Waiting for MTN MoMo confirmation.');
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [pendingRef, provider]);

  const handlePay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isProcessing) return;
    setError(null);
    setIsProcessing(true);
    handledCompletion.current = false;
    auraAudio.playClick(600, 0.05);
    try {
      const result = await processVerifiedBadgePayment(currentUser, {
        provider,
        currency: provider === 'mtn_momo' ? 'RWF' : currency,
        phoneNumber: provider === 'mtn_momo' ? phoneNumber : undefined,
      });
      if (result.checkoutUrl) {
        // Redirect to a gateway-hosted page. No PAN, expiry or CVC ever passes through this app.
        window.location.assign(result.checkoutUrl);
        return;
      }
      applyPaymentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[#F8FAF9] rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 sm:p-5 border-b border-[#D1E2D9] bg-gradient-to-r from-[#064E3B] to-[#022C22] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-emerald-300" /></div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-1.5">Get Ducate Verified Badge <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">10K</span></h3>
              <p className="text-[11px] text-emerald-200/80">Secure provider checkout and server-confirmed activation</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close payment dialog" className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {paymentResult?.status === 'completed' ? (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-700"><CheckCircle2 size={36} /></div>
              <div><h4 className="text-lg font-bold text-[#064E3B]">Payment confirmed</h4><p className="text-xs text-[#55635C] mt-1">{paymentResult.message}</p></div>
              <div className="p-4 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] max-w-xs mx-auto flex items-center gap-3">
                <div className="relative"><ModernAvatar src={currentUser.avatar} alt={currentUser.name} size="md" /><span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center border-2 border-white"><Check size={12} strokeWidth={3} /></span></div>
                <div className="text-left"><p className="text-xs font-bold text-[#064E3B]">{currentUser.name} <span className="text-blue-600">✓ VERIFIED</span></p><p className="text-[10px] text-[#55635C]">@{currentUser.username}</p></div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#D1E2D9] text-[11px] font-mono text-[#55635C] text-left space-y-1">
                <div>Reference: {paymentResult.transactionRef}</div>
                <div>Amount: {paymentResult.amount.toLocaleString()} {paymentResult.currency}</div>
                <div>Status: Confirmed by payment provider</div>
              </div>
              <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-bold">Done</button>
            </div>
          ) : paymentResult?.status === 'pending' ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto"><Loader2 size={30} className="animate-spin text-amber-700" /></div>
              <div><h4 className="text-lg font-bold text-[#064E3B]">Waiting for payment confirmation</h4><p className="text-xs text-[#55635C] mt-1">{paymentResult.message}</p></div>
              {provider === 'mtn_momo' && <p className="text-xs text-[#55635C]">Approve the payment request on your MTN MoMo phone. Do not share your PIN with anyone.</p>}
              <div className="rounded-xl bg-white border border-[#D1E2D9] p-3 text-left text-[11px] font-mono text-[#55635C]">Reference: {paymentResult.transactionRef}</div>
              {error && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-left text-xs text-rose-700">{error}</div>}
              <button type="button" disabled={isProcessing} onClick={() => void checkPayment(paymentResult.transactionRef)} className="w-full py-3 rounded-xl bg-[#064E3B] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">{isProcessing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Check payment status</button>
              <button type="button" onClick={onClose} className="text-xs text-[#64736B] hover:text-[#064E3B]">Close — you can return to check again</button>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] flex items-center justify-between">
                <div className="flex items-center gap-3"><ModernAvatar src={currentUser.avatar} alt={currentUser.name} size="md" /><div><p className="text-xs font-bold text-[#064E3B]">{currentUser.name}</p><p className="text-[11px] text-[#55635C]">@{currentUser.username}</p></div></div>
                <div className="text-right"><span className="text-sm font-bold text-[#064E3B] block">{feeAmount.toLocaleString()} {currency}</span><span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">One-time payment</span></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-2">Choose a payment gateway</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setProvider('mtn_momo'); setCurrency('RWF'); setError(null); }} className={'p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all ' + (provider === 'mtn_momo' ? 'border-[#059669] bg-emerald-50 ring-2 ring-[#059669]/20' : 'border-[#D1E2D9] bg-white hover:bg-[#F1F5F2]')}>
                    <Smartphone size={19} className="text-[#059669]" /><div><p className="text-xs font-bold text-[#064E3B]">MTN MoMo</p><p className="text-[10px] text-[#55635C]">Rwanda mobile money</p></div>
                  </button>
                  <button type="button" onClick={() => { setProvider('flutterwave'); setError(null); }} className={'p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all ' + (provider === 'flutterwave' ? 'border-[#059669] bg-emerald-50 ring-2 ring-[#059669]/20' : 'border-[#D1E2D9] bg-white hover:bg-[#F1F5F2]')}>
                    <Globe size={19} className="text-orange-500" /><div><p className="text-xs font-bold text-[#064E3B]">Flutterwave</p><p className="text-[10px] text-[#55635C]">Hosted card + RWF mobile money checkout</p></div>
                  </button>
                </div>
              </div>
              {provider === 'mtn_momo' ? (
                <div className="p-3.5 rounded-2xl bg-white border border-[#D1E2D9] space-y-2">
                  <label htmlFor="momo-phone" className="block text-xs font-semibold text-[#064E3B]">MTN Rwanda phone number</label>
                  <input id="momo-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="078 XXX XXXX" className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-sm font-mono text-[#064E3B] focus:outline-none focus:border-[#059669]" />
                  <p className="text-[11px] text-[#55635C]">A request-to-pay prompt will be sent to your MTN line. Enter your MoMo PIN only in the official MTN prompt.</p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white border border-[#D1E2D9] space-y-3">
                  <div><label className="block text-xs font-semibold text-[#064E3B] mb-1">Checkout currency</label><select value={currency} onChange={(event) => setCurrency(event.target.value as 'RWF' | 'USD')} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs text-[#064E3B]"><option value="RWF">RWF — 10,000</option><option value="USD">USD — 10</option></select></div>
                  <div className="flex items-center gap-2 text-xs text-[#55635C]"><Lock size={14} className="text-emerald-600" /> Card details are entered on Flutterwave’s secure hosted checkout, not on this site.</div>
                </div>
              )}
              <div className="rounded-xl border border-[#D1E2D9] bg-[#F1F5F2] p-3 text-[11px] text-[#55635C] leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-[#064E3B] mb-1"><ShieldCheck size={13} /> Server-confirmed payments</div>
                Payment is checked directly with the selected provider before the paid profile badge is activated. Payment confirms the badge fee; it is not an independent identity or background check.
              </div>
              {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"><AlertCircle size={15} className="shrink-0 mt-0.5" />{error}</div>}
              <button type="submit" disabled={isProcessing || !phoneNumber.trim() && provider === 'mtn_momo'} className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#064E3B] to-[#047857] hover:from-[#059669] hover:to-[#064E3B] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {isProcessing ? <><Loader2 size={16} className="animate-spin" />Starting secure payment...</> : <><span>{provider === 'flutterwave' ? 'Continue to secure checkout' : 'Request MTN MoMo payment'}</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
