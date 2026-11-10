import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Globe,
  Sparkles,
  ArrowRight,
  Lock,
  Loader2,
  Check,
} from 'lucide-react';
import { User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import {
  processVerifiedBadgePayment,
  VERIFICATION_FEE_RWF,
  VERIFICATION_FEE_USD,
  PaymentResult,
} from '../../services/verificationPaymentService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface PayVerifiedModalProps {
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const PayVerifiedModal: React.FC<PayVerifiedModalProps> = ({
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [provider, setProvider] = useState<'flutterwave' | 'stripe' | 'mtn_momo'>('mtn_momo');
  const [currency, setCurrency] = useState<'RWF' | 'USD'>('RWF');
  const [phoneNumber, setPhoneNumber] = useState('078');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const feeAmount = currency === 'USD' ? VERIFICATION_FEE_USD : VERIFICATION_FEE_RWF;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    auraAudio.playClick(600, 0.05);

    try {
      const res = await processVerifiedBadgePayment(currentUser, {
        provider,
        currency,
        phoneNumber: provider === 'mtn_momo' ? phoneNumber : undefined,
        cardNumber: provider !== 'mtn_momo' ? cardNumber : undefined,
        cardExpiry,
        cardCvc,
      });

      setPaymentResult(res);
      auraAudio.playChime();
      const updatedUser: User = {
        ...currentUser,
        verified: true,
        verifiedBadgeType: 'blue',
        verifiedSince: Date.now(),
      };
      onSuccess(updatedUser);
    } catch (err: any) {
      setError(err?.message || 'Payment could not be completed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[#F8FAF9] rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D1E2D9] bg-gradient-to-r from-[#064E3B] to-[#022C22] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-1.5 leading-tight">
                Get Ducate Verified Badge
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 font-mono">
                  10K
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200/80">Authentic Blue Creator Shield & Priority Reach</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {paymentResult ? (
            /* Success Card */
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-700 shadow-sm">
                <CheckCircle2 size={36} className="text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-[#064E3B]">Badge Activated Successfully!</h4>
                <p className="text-xs text-[#55635C] mt-1 max-w-sm mx-auto">
                  {paymentResult.message}
                </p>
              </div>

              {/* Badge Preview */}
              <div className="p-4 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] max-w-xs mx-auto flex items-center gap-3">
                <div className="relative">
                  <ModernAvatar src={currentUser.avatar} alt={currentUser.name} size="md" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs border-2 border-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-[#064E3B] flex items-center gap-1">
                    {currentUser.name}
                    <span className="text-[10px] text-blue-600 font-mono font-bold">✓ VERIFIED</span>
                  </p>
                  <p className="text-[10px] text-[#55635C]">@{currentUser.username}</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#D1E2D9] text-[11px] font-mono text-[#55635C] text-left space-y-1">
                <div>Ref: {paymentResult.transactionRef}</div>
                <div>Amount: {paymentResult.amount.toLocaleString()} {paymentResult.currency}</div>
                <div>Status: Confirmed On-Chain & In Firestore</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            /* Payment Form */
            <form onSubmit={handlePay} className="space-y-5">
              {/* Profile Preview with simulated badge */}
              <div className="p-3.5 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ModernAvatar src={currentUser.avatar} alt={currentUser.name} size="md" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs border-2 border-white animate-bounce">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#064E3B] flex items-center gap-1">
                      {currentUser.name}
                      <span className="text-blue-500">
                        <CheckCircle2 size={13} fill="#3B82F6" className="text-white inline" />
                      </span>
                    </p>
                    <p className="text-[11px] text-[#55635C]">@{currentUser.username}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-[#064E3B] block">
                    {feeAmount.toLocaleString()} {currency}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                    One-time 10K fee
                  </span>
                </div>
              </div>

              {/* Gateway Selector */}
              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-2">
                  Select Real Payment Provider:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* MTN MoMo */}
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('mtn_momo');
                      setCurrency('RWF');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'mtn_momo'
                        ? 'border-[#059669] bg-emerald-50/80 ring-2 ring-[#059669]/20'
                        : 'border-[#D1E2D9] bg-white hover:bg-[#F1F5F2]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Smartphone size={18} className={provider === 'mtn_momo' ? 'text-[#059669]' : 'text-[#55635C]'} />
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#064E3B]">MTN MoMo</p>
                      <p className="text-[10px] text-[#55635C]">Rwanda & Africa USSD</p>
                    </div>
                  </button>

                  {/* Flutterwave */}
                  <button
                    type="button"
                    onClick={() => setProvider('flutterwave')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'flutterwave'
                        ? 'border-[#059669] bg-emerald-50/80 ring-2 ring-[#059669]/20'
                        : 'border-[#D1E2D9] bg-white hover:bg-[#F1F5F2]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Globe size={18} className={provider === 'flutterwave' ? 'text-[#059669]' : 'text-[#55635C]'} />
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#064E3B]">Flutterwave</p>
                      <p className="text-[10px] text-[#55635C]">Cards & Multi-Currency</p>
                    </div>
                  </button>

                  {/* Stripe */}
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('stripe');
                      setCurrency('USD');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      provider === 'stripe'
                        ? 'border-[#059669] bg-emerald-50/80 ring-2 ring-[#059669]/20'
                        : 'border-[#D1E2D9] bg-white hover:bg-[#F1F5F2]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <CreditCard size={18} className={provider === 'stripe' ? 'text-[#059669]' : 'text-[#55635C]'} />
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#064E3B]">Stripe Card</p>
                      <p className="text-[10px] text-[#55635C]">Visa / Mastercard</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Gateway-specific input fields */}
              {provider === 'mtn_momo' && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#D1E2D9] space-y-2.5">
                  <label className="block text-xs font-semibold text-[#064E3B]">
                    MTN Mobile Money Phone Number (Rwanda / East Africa)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="078 XXX XXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs font-mono text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      USSD Prompt
                    </span>
                  </div>
                  <p className="text-[11px] text-[#55635C] leading-relaxed">
                    A notification prompt will be sent to your phone. Enter your MTN MoMo PIN to authorize payment of <strong>10,000 RWF</strong>.
                  </p>
                </div>
              )}

              {(provider === 'stripe' || provider === 'flutterwave') && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#D1E2D9] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#064E3B] mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 •••• •••• 4242"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs font-mono text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#064E3B] mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM / YY"
                        className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs font-mono text-[#064E3B] focus:outline-none focus:border-[#059669]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#064E3B] mb-1">
                        CVC
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="123"
                        className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs font-mono text-[#064E3B] focus:outline-none focus:border-[#059669]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#55635C]">
                    <Lock size={12} className="text-emerald-600" />
                    <span>256-Bit TLS End-to-End Encrypted via {provider === 'stripe' ? 'Stripe Inc.' : 'Flutterwave Ltd.'}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#064E3B] to-[#047857] hover:from-[#059669] hover:to-[#064E3B] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Authorizing {feeAmount.toLocaleString()} {currency}...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {feeAmount.toLocaleString()} {currency} & Activate Verified Badge</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
