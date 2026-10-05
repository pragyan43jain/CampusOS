import { useEffect } from 'react';

declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized?: boolean;
      init: () => void;
    };
  }
}

export interface HeroAsciiProps {
  onGetStarted?: () => void;
  onLearnMore?: () => void;
  isLoggedIn?: boolean;
  studentName?: string;
  currentTheme?: string;
  onSelectTheme?: (theme: any) => void;
}

export default function Home({
  onGetStarted,
  onLearnMore,
  isLoggedIn,
  studentName,
}: HeroAsciiProps = {}) {
  useEffect(() => {
    // If UnicornStudio script already exists, just re-init
    if (window.UnicornStudio) {
      try {
        window.UnicornStudio.init();
      } catch {
        // Safe fallback
      }
    }

    const embedScript = document.createElement('script');
    embedScript.type = 'text/javascript';
    embedScript.textContent = `
      !function(){
        if(!window.UnicornStudio){
          window.UnicornStudio={isInitialized:!1};
          var i=document.createElement("script");
          i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.33/dist/unicornStudio.umd.js";
          i.onload=function(){
            window.UnicornStudio.isInitialized||(window.UnicornStudio.init(),window.UnicornStudio.isInitialized=!0)
          };
          (document.head || document.body).appendChild(i)
        } else {
          try { window.UnicornStudio.init(); } catch(e){}
        }
      }();
    `;
    document.head.appendChild(embedScript);

    // Add CSS to hide branding elements and crop canvas
    const style = document.createElement('style');
    style.textContent = `
      [data-us-project] {
        position: relative !important;
        overflow: hidden !important;
      }
      
      [data-us-project] canvas {
        clip-path: inset(0 0 10% 0) !important;
      }
      
      [data-us-project] * {
        pointer-events: none !important;
      }
      [data-us-project] a[href*="unicorn"],
      [data-us-project] button[title*="unicorn"],
      [data-us-project] div[title*="Made with"],
      [data-us-project] .unicorn-brand,
      [data-us-project] [class*="brand"],
      [data-us-project] [class*="credit"],
      [data-us-project] [class*="watermark"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }
    `;
    document.head.appendChild(style);

    // Function to aggressively hide branding
    const hideBranding = () => {
      const projectDiv = document.querySelector('[data-us-project]');
      if (projectDiv) {
        // Find and remove any elements containing branding text
        const allElements = projectDiv.querySelectorAll('*');
        allElements.forEach(el => {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('made with') || text.includes('unicorn')) {
            el.remove(); // Completely remove the element
          }
        });
      }
    };

    // Run immediately and periodically
    hideBranding();
    const interval = setInterval(hideBranding, 100);
    
    // Also try after delays
    const timeout1 = setTimeout(hideBranding, 1000);
    const timeout2 = setTimeout(hideBranding, 3000);
    const timeout3 = setTimeout(hideBranding, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      if (embedScript.parentNode) {
        embedScript.parentNode.removeChild(embedScript);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  const handleStart = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      const el = document.getElementById('features');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLearn = () => {
    if (onLearnMore) {
      onLearnMore();
    } else {
      const el = document.getElementById('features');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white select-none">
      {/* Vitruvian man animation - hidden on mobile */}
      <div className="absolute inset-0 w-full h-full hidden lg:block">
        <div 
          data-us-project="whwOGlfJ5Rz2rHaEUgHl" 
          style={{ width: '100%', height: '100%', minHeight: '100vh' }}
        />
      </div>

      {/* Mobile stars background */}
      <div className="absolute inset-0 w-full h-full lg:hidden stars-bg"></div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-20 border-b border-white/20">
        <div className="container mx-auto px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="font-mono text-white text-xl lg:text-2xl font-bold tracking-widest italic transform -skew-x-12">
              CampusOS
            </div>
            <div className="h-3 lg:h-4 w-px bg-white/40"></div>
            <span className="text-white/60 text-[8px] lg:text-[10px] font-mono">EST. 2026</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-white/60">
            <span>LAT: 37.7749°</span>
            <div className="w-1 h-1 bg-white/40 rounded-full"></div>
            <span>LONG: 122.4194°</span>
          </div>
        </div>
      </div>

      {/* Corner Frame Accents */}
      <div className="absolute top-0 left-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-l-2 border-white/30 z-20 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-r-2 border-white/30 z-20 pointer-events-none"></div>
      <div className="absolute left-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-l-2 border-white/30 z-20 pointer-events-none" style={{ bottom: '48px' }}></div>
      <div className="absolute right-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-r-2 border-white/30 z-20 pointer-events-none" style={{ bottom: '48px' }}></div>

      <div className="relative z-10 flex min-h-screen items-center pt-16 lg:pt-0" style={{ marginTop: '0vh' }}>
        <div className="container mx-auto px-6 lg:px-16 lg:ml-[10%]">
          <div className="max-w-lg relative">
            {/* Top decorative line */}
            <div className="flex items-center gap-2 mb-3 opacity-60">
              <div className="w-8 h-px bg-white"></div>
              <span className="text-white text-[10px] font-mono tracking-wider">001</span>
              <div className="flex-1 h-px bg-white"></div>
            </div>

            {/* Title with dithered accent */}
            <div className="relative">
              <div className="hidden lg:block absolute -left-3 top-0 bottom-0 w-1 dither-pattern opacity-40"></div>
              <h1 className="text-2xl lg:text-5xl font-bold text-white mb-3 lg:mb-4 leading-tight font-mono tracking-wider" style={{ letterSpacing: '0.1em' }}>
                CONNECTED
                <span className="block text-white mt-1 lg:mt-2 opacity-90">
                  CAMPUS
                </span>
              </h1>
            </div>

            {/* Decorative dots pattern - desktop only */}
            <div className="hidden lg:flex gap-1 mb-3 opacity-40">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-0.5 h-0.5 bg-white rounded-full"></div>
              ))}
            </div>

            {/* Description with subtle grid pattern */}
            <div className="relative">
              <p className="text-xs lg:text-base text-gray-300 mb-5 lg:mb-6 leading-relaxed font-mono opacity-80">
                Where students, academics, opportunities, and campus life come together.
              </p>
              
              {/* Technical corner accent - desktop only */}
              <div className="hidden lg:block absolute -right-4 top-1/2 w-3 h-3 border border-white opacity-30" style={{ transform: 'translateY(-50%)' }}>
                <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white" style={{ transform: 'translate(-50%, -50%)' }}></div>
              </div>
            </div>

            {/* Buttons with technical accents */}
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 mb-4">
              <button 
                onClick={handleStart}
                type="button"
                className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent text-white font-mono text-xs lg:text-sm border border-white hover:bg-white hover:text-black transition-all duration-200 group cursor-pointer"
              >
                <span className="hidden lg:block absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white group-hover:border-black transition-colors"></span>
                <span className="hidden lg:block absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white group-hover:border-black transition-colors"></span>
                {isLoggedIn ? (studentName ? `ENTER AS ${studentName.split(' ')[0].toUpperCase()}` : 'EXPLORE CAMPUSOS') : 'EXPLORE CAMPUSOS'}
              </button>
              <button 
                onClick={handleLearn}
                type="button"
                className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent text-white/70 font-mono text-xs lg:text-sm border border-white/40 hover:border-white hover:text-white transition-all duration-200 cursor-pointer"
              >
                DISCOVER MORE
              </button>
            </div>

            {/* Bottom technical line matching screenshot */}
            <div className="flex items-center gap-2 mt-4 opacity-40">
              <span className="text-white text-[9px] font-mono tracking-wider">00</span>
              <div className="flex-1 h-px bg-white"></div>
              <span className="text-white text-[9px] font-mono tracking-widest">CAMPUSOS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Footer Info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/20 bg-black/50 backdrop-blur-xs">
        <div className="container mx-auto px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between text-[8px] lg:text-[10px] font-mono text-white/60">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse"></div>
              © CAMPUSOS.SYSTEM
            </span>
            <div className="hidden lg:flex items-center gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-0.5 bg-white/40" 
                  style={{ 
                    height: `${Math.sin(i * 0.5) * 6 + 8}px`,
                    animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite alternate`
                  }}
                ></div>
              ))}
            </div>
            <span>V1.0.0</span>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-1">
              <span className="hidden lg:inline">◐</span>
              <span>CAMPUSOS ACTIVE</span>
              <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
            <div className="h-3 w-px bg-white/20"></div>
            <span>FRAME: ∞</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export { Home as HeroAscii };
