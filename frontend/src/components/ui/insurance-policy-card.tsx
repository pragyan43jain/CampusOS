import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Copy, Check, QrCode } from 'lucide-react';

export interface ClientData {
  name: string;
  avatarUrl?: string;
  initials?: string;
  dateOfBirth?: string;
  cityOfResidence?: string;
  email?: string;
  program?: string;
  semester?: string;
  school?: string;
}

export interface PolicyData {
  idNumber?: string;
  policyNumber: string;
  insuranceType?: string;
  vehicleInfo?: string;
  expiryDate?: string;
  expiryDuration?: string;
  [key: string]: any;
}

export interface InfoFieldProps {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  copyable?: boolean;
  copyText?: string;
  className?: string;
}

export const InfoField: React.FC<InfoFieldProps> = ({
  label,
  value,
  children,
  copyable = false,
  copyText,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = copyText || (typeof value === 'string' ? value : '');
    if (textToCopy && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-400">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-100 min-w-0">
        <span className="truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : `Copy ${label}`}
            className="inline-flex items-center justify-center p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors shrink-0"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

export interface InsurancePolicyCardProps {
  client: ClientData;
  policy: PolicyData;
  qrCodeUrl?: string;
  onUpdatePolicy?: () => void;
  updateButtonLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export const InsurancePolicyCard: React.FC<InsurancePolicyCardProps> = ({
  client,
  policy,
  qrCodeUrl,
  onUpdatePolicy,
  updateButtonLabel = 'Update a Policy',
  className = '',
  children,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`w-full max-w-lg rounded-2xl border border-neutral-800/80 bg-[#0d0d0d] p-6 text-neutral-100 shadow-2xl backdrop-blur-xl transition-all ${className}`}
    >
      {/* Header section with Client Avatar & Academic/Policy Status & QR Code */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative h-14 w-14 shrink-0 rounded-full border-2 border-neutral-700/80 bg-neutral-900 flex items-center justify-center text-lg font-bold text-white overflow-hidden shadow-inner">
            {client.avatarUrl ? (
              <img
                src={client.avatarUrl}
                alt={client.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <span className="uppercase">
              {client.initials || client.name.charAt(0) || 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              <span>{policy.expiryDate ? 'Valid Period' : 'Academic Standing'}</span>
            </div>
            <p className="mt-0.5 font-bold text-neutral-100 text-sm truncate">
              {policy.expiryDate || client.semester || 'Current Semester'}
            </p>
            {policy.expiryDuration && (
              <p className="text-[11px] text-neutral-400">
                ({policy.expiryDuration})
              </p>
            )}
          </div>
        </div>

        {qrCodeUrl ? (
          <div className="shrink-0 rounded-xl p-1 bg-white/5 border border-neutral-800 shadow-sm">
            <img
              src={qrCodeUrl}
              alt="Policy QR Code"
              className="h-16 w-16 rounded-lg object-contain bg-white p-1"
            />
          </div>
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
            <QrCode className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* Grid of Key Policy / Client Fields */}
      <div className="my-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-neutral-800/80 py-5">
        <InfoField label="Client Name" value={client.name} />
        {client.dateOfBirth && (
          <InfoField label="Date of Birth" value={client.dateOfBirth} />
        )}
        {client.cityOfResidence && (
          <InfoField label="City of Residence" value={client.cityOfResidence} />
        )}
        {policy.idNumber && (
          <InfoField
            label="ID Number"
            value={policy.idNumber}
            copyable
            copyText={policy.idNumber}
          />
        )}
        {policy.policyNumber && (
          <InfoField
            label="Policy Number"
            value={policy.policyNumber}
            copyable
            copyText={policy.policyNumber}
          />
        )}
        {policy.insuranceType && (
          <InfoField label="Type of Insurance" value={policy.insuranceType} />
        )}
        {policy.vehicleInfo && (
          <InfoField label="Vehicle Information" value={policy.vehicleInfo} />
        )}
      </div>

      {/* Optional Children slot for additional interactive fields or edit forms */}
      {children}

      {/* Main Action Button */}
      {onUpdatePolicy && (
        <button
          type="button"
          onClick={onUpdatePolicy}
          className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-semibold px-4 py-3 text-sm shadow-md transition-all active:scale-[0.98]"
        >
          {updateButtonLabel}
        </button>
      )}
    </motion.div>
  );
};

export default InsurancePolicyCard;
