'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2, Building, RefreshCw, Sparkles } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { OtpInput } from '@/components/ui/otp-input';
import { config } from '@/lib/config';
import { validatePhone } from '@/lib/security';
import toast from 'react-hot-toast';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'owner';
  const isExpired = searchParams.get('expired') === 'true';

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');

  const confirmResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const initRecaptcha = () => {
    if (!recaptchaVerifierRef.current && typeof window !== 'undefined') {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
        });
      } catch (e) {
        console.warn('Recaptcha init notice:', e);
      }
    }
    return recaptchaVerifierRef.current;
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPhoneError('');

    const phoneValidation = validatePhone(phoneNumber);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || 'Please enter a valid 10-digit mobile number');
      return;
    }
    const cleanNumber = phoneValidation.cleaned;

    setLoading(true);

    if (!config.firebase.isConfigured()) {
      setPhoneError('Authentication service is currently unavailable. Please check system configuration.');
      setLoading(false);
      return;
    }

    try {
      const verifier = initRecaptcha();
      if (!verifier) throw new Error('Recaptcha verification unavailable');

      const fullPhone = `+91${cleanNumber}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      confirmResultRef.current = result;

      setStep('otp');
      setOtpCode('');
      setOtpError('');
      setCountdown(30);
      toast.success('6-digit code sent via SMS');
    } catch (err: any) {
      console.error(err);
      setPhoneError(err.message || 'Failed to send SMS code. Please try again.');
      recaptchaVerifierRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError('');

    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code');
      return;
    }

    if (!confirmResultRef.current) {
      setOtpError('Session expired. Please request a new code.');
      setStep('phone');
      return;
    }

    setLoading(true);

    try {
      await confirmResultRef.current.confirm(otpCode);
      toast.success('Signed in successfully');
      router.push(role === 'owner' ? '/dashboard' : '/');
    } catch (err: any) {
      setOtpError('Invalid verification code. Please check and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div id="recaptcha-container" />

      {/* Main Container Card */}
      <div className="w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Brand Panel (Desktop) */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-[#0F172A] text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[8px] bg-[#D97706] flex items-center justify-center text-white shadow-xs">
                <Building className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">PGPass</span>
            </div>

            <div className="mt-12 space-y-3">
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-white">
                Bento-grade PG bed management & rent settlement.
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Streamline bed inventory, collect rents with 1-tap WhatsApp reminders, and issue compliant HRA tax receipts without app downloads.
              </p>
            </div>

            <div className="mt-10 space-y-3.5">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>Zero cost, no app installation required</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>Personalized resident links for rent & photos</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>Live occupancy HUD tracking across floors</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>PGPass Production</span>
            <span>Secured via Firebase</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-10 flex flex-col justify-between bg-white text-left">
          <div>
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#09090B] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Home</span>
              </Link>

              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706] bg-[#FEF3C7] px-2.5 py-0.5 rounded-[6px]">
                {role === 'owner' ? 'PG Owner Portal' : 'Resident Portal'}
              </span>
            </div>

            {isExpired && (
              <div className="mb-6 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
                Your session has expired. Please verify your phone number to continue.
              </div>
            )}

            {step === 'phone' ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#09090B] tracking-tight">
                    Sign in with mobile
                  </h2>
                  <p className="mt-1 text-xs text-[#64748B]">
                    We will send a 6-digit one-time password to your phone.
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <PhoneInput
                    label="Mobile Number"
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    error={phoneError}
                    placeholder="98765 43210"
                    disabled={loading}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    loading={loading}
                    variant="solid"
                    className="w-full text-[13px]"
                  >
                    Send Verification Code
                  </Button>
                </form>

                <p className="text-[11px] text-center text-[#94A3B8] leading-relaxed">
                  By continuing, you agree to receive SMS verification codes. Standard carrier rates apply.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#09090B] tracking-tight">
                    Enter verification code
                  </h2>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-bold text-[#09090B] font-mono-numbers">
                      +91 {phoneNumber}
                    </span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                      6-Digit SMS Code
                    </label>
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={loading}
                      error={!!otpError}
                    />
                    {otpError && (
                      <p className="text-xs font-semibold text-[#EF4444] animate-shake">
                        {otpError}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    loading={loading}
                    variant="solid"
                    className="w-full text-[13px]"
                  >
                    Verify & Continue
                  </Button>
                </form>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="text-[#64748B] hover:text-[#09090B] font-medium transition-colors cursor-pointer"
                  >
                    Change phone number
                  </button>

                  {countdown > 0 ? (
                    <span className="text-[#94A3B8] font-mono-numbers">
                      Resend in {countdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="inline-flex items-center gap-1 font-bold text-[#D97706] hover:text-[#B45309] transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Resend SMS
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            <span>End-to-end encrypted session</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[#D97706] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
