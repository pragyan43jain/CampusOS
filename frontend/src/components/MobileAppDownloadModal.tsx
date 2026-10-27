import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Share2,
  MoreVertical,
  Server,
  Check,
  RefreshCw,
} from 'lucide-react';
import { getApiBase } from '../services/api';

interface MobileAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'pwa' | 'apk' | 'server';
}

export const MobileAppDownloadModal: React.FC<MobileAppDownloadModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'pwa',
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk' | 'server'>(defaultTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [customApiUrl, setCustomApiUrl] = useState<string>('');
  const [apiUrlSaved, setApiUrlSaved] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('campus_api_url') || getApiBase();
      setCustomApiUrl(saved);

      // Check if running in standalone mode (already installed as PWA or native webview)
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);

      const handler = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);

      window.addEventListener('appinstalled', () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const handleSaveApiUrl = () => {
    if (typeof window !== 'undefined') {
      const clean = customApiUrl.trim();
      if (clean) {
        window.localStorage.setItem('campus_api_url', clean);
      } else {
        window.localStorage.removeItem('campus_api_url');
      }
      setApiUrlSaved(true);
      setTimeout(() => {
        setApiUrlSaved(false);
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 bg-surface-container-highest/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
              <Smartphone size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">CampusOS for Mobile</h2>
              <p className="text-xs text-outline">Download or install as a standalone mobile app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant/20 bg-surface-container-low px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Smartphone size={14} />
            <span>Install App (PWA)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'apk'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Download size={14} />
            <span>Android APK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'server'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Server size={14} />
            <span>Backend Server</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                  <span className="text-xs font-bold text-on-surface">
                    {isInstalled ? 'App Already Installed' : 'Zero-Store Mobile Installation'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  CampusOS installs directly to your home screen as a standalone app with full offline caching, biometric fluidity, and no browser URL bar.
                </p>

                {deferredPrompt && !isInstalled && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    <span>Install CampusOS on This Device</span>
                  </button>
                )}
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  How to Install on Your Phone:
                </h3>

                {/* Android Steps */}
                <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                    <Smartphone size={15} className="text-secondary" />
                    <span>Android (Google Chrome)</span>
                  </div>
                  <ol className="text-xs text-on-surface-variant space-y-1 pl-5 list-decimal">
                    <li>Tap the three dots menu (<MoreVertical size={12} className="inline text-outline" />) in top right.</li>
                    <li>Select <strong className="text-on-surface">"Install app"</strong> or <strong className="text-on-surface">"Add to Home screen"</strong>.</li>
                    <li>CampusOS will appear on your app drawer and home screen.</li>
                  </ol>
                </div>

                {/* iPhone Steps */}
                <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                    <Share2 size={15} className="text-primary" />
                    <span>Apple iPhone (Safari)</span>
                  </div>
                  <ol className="text-xs text-on-surface-variant space-y-1 pl-5 list-decimal">
                    <li>Tap the Share button (<Share2 size={12} className="inline text-outline" />) at the bottom.</li>
                    <li>Scroll down and tap <strong className="text-on-surface">"Add to Home Screen"</strong>.</li>
                    <li>Tap <strong className="text-on-surface">"Add"</strong> in the top right corner.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download size={18} className="text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-on-surface">
                        CampusOS Android APK
                      </span>
                      <p className="text-[10px] text-outline">Android • com.campusos.app</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] bg-secondary/20 text-secondary font-bold px-2 py-0.5 rounded-full">
                    Latest build
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Download the APK produced by the latest successful main branch build. Install it on an Android device after the download completes.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href="https://github.com/pragyan43jain/CampusOS/releases/download/mobile-latest/CampusOS.apk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 group text-center"
                  >
                    <Download size={15} className="group-hover:translate-y-0.5 transition-transform" />
                    <span>Download latest APK</span>
                  </a>
                </div>
              </div>

              {/* Step-by-Step Installation Guide */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
                <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Smartphone size={14} className="text-primary" />
                  <span>3-Step Installation on Android</span>
                </h4>
                <ol className="text-xs text-on-surface-variant space-y-2 pl-4 list-decimal">
                  <li>
                    Tap <strong>"Download APK"</strong> above to save <code className="text-primary">CampusOS.apk</code>.
                  </li>
                  <li>
                    When opening the downloaded file, if Android prompts: <em>"Install unknown apps"</em>, tap <strong>Settings</strong> and switch on <strong>Allow from this source</strong>.
                  </li>
                  <li>
                    Tap <strong>Install</strong>, then open CampusOS and sign in with your credentials.
                  </li>
                </ol>
              </div>

              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-on-surface">Developer & CI/CD Options</h4>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 font-mono text-[11px] text-on-surface space-y-1.5 overflow-x-auto">
                  <p className="text-outline"># Build locally via Docker in one step:</p>
                  <p className="text-primary font-bold">./scripts/build_apk_docker.sh</p>
                  <p className="text-outline pt-1"># Automated GitHub Actions workflow:</p>
                  <p className="text-on-surface-variant">.github/workflows/build-mobile-apk.yml</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'server' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-secondary shrink-0" />
                  <span className="text-xs font-bold text-on-surface">
                    Backend Connection Settings
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  When accessing CampusOS on your phone, configure your backend API address so your phone can reach your server over Wi-Fi or cloud.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface block">
                  CampusOS API URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    placeholder="https://campus-os-pi-three.vercel.app/api or http://192.168.1.10:8000/api"
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiUrl}
                    className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {apiUrlSaved ? <Check size={14} /> : <RefreshCw size={14} />}
                    <span>{apiUrlSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-outline">
                  Pre-configured to the live production gateway (<code>https://campus-os-pi-three.vercel.app/api</code>). For local network testing, enter your computer's local IP.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-highest/30 flex justify-between items-center">
          <span className="text-[11px] text-outline flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span>Mobile Optimized • Android & iOS</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
