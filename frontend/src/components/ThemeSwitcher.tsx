import React, { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';

export type ThemeType =
  | 'cyber-dark'
  | 'midnight-slate'
  | 'chaingpt-cyber'
  | 'midnight-sapphire'
  | 'nordic-blue'
  | 'emerald-forest'
  | 'sunset-amber'
  | 'baby-pink'
  | 'nordic-frost'
  | 'paper-light';

export interface ThemeOption {
  id: ThemeType;
  label: string;
  fontName: string;
  fontFamily: string;
  tag: string;
  description: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  previewSecondary: string;
  previewText: string;
  badge?: string;
  isLight?: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'cyber-dark',
    label: 'Cyber Obsidian',
    fontName: 'Space Grotesk',
    fontFamily: "'Space Grotesk', sans-serif",
    tag: 'Tech Grotesque',
    description: 'Deep pitch void with high-contrast text & neon cyan accents',
    previewBg: '#07080D',
    previewCard: '#10121C',
    previewAccent: '#2DE7D3',
    previewSecondary: '#4C8DFF',
    previewText: '#FFFFFF',
    badge: 'Default',
  },
  {
    id: 'midnight-sapphire',
    label: 'Midnight Sapphire',
    fontName: 'Plus Jakarta Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    tag: 'Oceanic Geometric',
    description: 'Oceanic space navy with sky blue & electric indigo glow',
    previewBg: '#060B18',
    previewCard: '#0F1A36',
    previewAccent: '#38BDF8',
    previewSecondary: '#6366F1',
    previewText: '#BAE6FD',
    badge: 'Popular',
  },
  {
    id: 'emerald-forest',
    label: 'Emerald Forest',
    fontName: 'DM Sans',
    fontFamily: "'DM Sans', sans-serif",
    tag: 'Focus Slate',
    description: 'Restorative jade slate with vibrant mint emerald accents',
    previewBg: '#040E0A',
    previewCard: '#0D221A',
    previewAccent: '#10B981',
    previewSecondary: '#06B6D4',
    previewText: '#A7F3D0',
    badge: 'Focus',
  },
  {
    id: 'sunset-amber',
    label: 'Warm Espresso',
    fontName: 'Outfit',
    fontFamily: "'Outfit', sans-serif",
    tag: 'Off-White & Dark Roast',
    description: 'Dark roast espresso with warm off-white cream text & amber gold',
    previewBg: '#131110',
    previewCard: '#211D1A',
    previewAccent: '#F59E0B',
    previewSecondary: '#FB923C',
    previewText: '#FDFBF7',
    badge: 'Warm',
  },
  {
    id: 'nordic-frost',
    label: 'Nordic Frost',
    fontName: 'Inter',
    fontFamily: "'Inter', sans-serif",
    tag: 'Surgical Minimal',
    description: 'Surgical arctic slate with clean ice cyan & polar blue',
    previewBg: '#0F141C',
    previewCard: '#1C2533',
    previewAccent: '#88C0D0',
    previewSecondary: '#81A1C1',
    previewText: '#E2E8F0',
    badge: 'Minimal',
  },
  {
    id: 'paper-light',
    label: 'Sober Warm Paper',
    fontName: 'Plus Jakarta Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    tag: 'Off-White Linen & Ink',
    description: 'Sober off-white linen canvas with bold, high-contrast charcoal ink',
    previewBg: '#F5F3ED',
    previewCard: '#FFFFFF',
    previewAccent: '#0284C7',
    previewSecondary: '#2563EB',
    previewText: '#1C1917',
    badge: 'Sober Light',
    isLight: true,
  },
];

export interface ThemeSwitcherProps {
  currentTheme?: ThemeType;
  onSelectTheme: (theme: ThemeType) => void;
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  currentTheme = 'cyber-dark',
  onSelectTheme,
  className = '',
}) => {
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  useEffect(() => {
    if (!showDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDropdown(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.theme-menu-container')) {
        setShowDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const activeThemeObj =
    THEMES.find(
      (t) =>
        t.id === currentTheme ||
        (t.id === 'cyber-dark' && currentTheme === 'midnight-slate')
    ) || THEMES[0];

  return (
    <div className={`theme-menu-container ${className}`}>
      <button
        className="theme-toggle-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Customize UI Theme & Palette"
        aria-label="Toggle Theme Menu"
        type="button"
      >
        <Palette size={14} color="var(--accent-cyan)" />
        <span className="theme-btn-label desktop-only-inline">Theme</span>
        <div
          className="theme-swatch-badge"
          style={{
            width: '14px',
            height: '14px',
            borderWidth: '1px',
            backgroundColor: activeThemeObj.previewBg,
          }}
        >
          <div
            className="theme-swatch-accent-dot"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: activeThemeObj.previewAccent,
            }}
          />
        </div>
      </button>

      {showDropdown && (
        <div className="theme-dropdown-glass" style={{ width: '340px' }}>
          <div className="theme-dropdown-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Palette size={13} color="var(--accent-cyan)" />
              <span>THEMES & FONTS</span>
            </span>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
              6 STYLES
            </span>
          </div>
          <div className="theme-menu-list">
            {THEMES.map((th) => {
              const isSelected =
                currentTheme === th.id ||
                (th.id === 'cyber-dark' && currentTheme === 'midnight-slate');
              return (
                <button
                  key={th.id}
                  className={`theme-menu-item ${isSelected ? 'active' : ''}`}
                  style={{
                    padding: '10px 12px',
                    gap: '12px',
                    borderWidth: '1px',
                    borderColor: isSelected ? 'var(--border-highlight)' : 'transparent',
                  }}
                  onClick={() => {
                    onSelectTheme(th.id);
                    setShowDropdown(false);
                  }}
                  type="button"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                    {/* Font & Palette Visual Box */}
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: th.previewBg,
                        border: `1px solid ${isSelected ? th.previewAccent : 'rgba(128,128,128,0.25)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.20)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: th.fontFamily,
                          fontSize: '15px',
                          fontWeight: 800,
                          color: th.previewText,
                          lineHeight: 1,
                        }}
                      >
                        Aa
                      </span>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          backgroundColor: th.previewAccent,
                        }}
                      />
                    </div>

                    {/* Details: Title, Font Tag, Description */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: th.fontFamily,
                            fontSize: '0.84rem',
                            fontWeight: 750,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.2px',
                          }}
                        >
                          {th.label}
                        </span>
                        {th.badge && (
                          <span
                            style={{
                              fontSize: '0.63rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isSelected ? 'var(--accent-cyan)' : 'var(--surface-hover)',
                              color: isSelected ? 'var(--text-inverse)' : 'var(--text-muted)',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {th.badge}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span
                          style={{
                            fontFamily: th.fontFamily,
                            fontSize: '0.70rem',
                            fontWeight: 650,
                            color: 'var(--accent-cyan)',
                          }}
                        >
                          {th.fontName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>•</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{th.tag}</span>
                      </div>

                      <span
                        style={{
                          fontSize: '0.69rem',
                          color: 'var(--text-secondary)',
                          marginTop: '2px',
                          lineHeight: 1.25,
                          whiteSpace: 'normal',
                        }}
                      >
                        {th.description}
                      </span>

                      {/* 4-Color Swatch Strip */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                        {[th.previewBg, th.previewCard, th.previewAccent, th.previewText].map((c, i) => (
                          <div
                            key={i}
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: c,
                              border: '1px solid rgba(128,128,128,0.35)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ flexShrink: 0, paddingLeft: '4px' }}>
                      <Check size={16} color="var(--accent-cyan)" strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
