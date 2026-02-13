import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// MOVZZ — Reliability Layer for Urban Mobility
// Premium Mobile App Prototype v2
// Fixed: Real Chennai map + buttery smooth transitions
// ============================================================

const COLORS = {
  navy: "#0A1628",
  navyLight: "#111D2E",
  blue: "#2D7FF9",
  blueDark: "#1A5FD1",
  blueLight: "#E8F0FE",
  white: "#FFFFFF",
  offWhite: "#F7F8FA",
  gray50: "#FAFBFC",
  gray100: "#F0F2F5",
  gray200: "#E4E7EC",
  gray300: "#CDD3DC",
  gray400: "#98A2B3",
  gray500: "#667085",
  gray600: "#475467",
  gray700: "#344054",
  gray800: "#1D2939",
  green: "#12B76A",
  greenLight: "#ECFDF3",
  orange: "#F79009",
  orangeLight: "#FFF6ED",
  red: "#F04438",
};

const CHENNAI_LOCATIONS = [
  { name: "Chennai Airport (MAA)", area: "Tirusulam", lat: 12.9941, lng: 80.1709 },
  { name: "Chennai Central Station", area: "Park Town", lat: 13.0827, lng: 80.2707 },
  { name: "T. Nagar", area: "Thyagaraya Nagar", lat: 13.0418, lng: 80.2341 },
  { name: "Adyar Signal", area: "Adyar", lat: 13.0063, lng: 80.2574 },
  { name: "Anna Nagar Tower", area: "Anna Nagar", lat: 13.085, lng: 80.2101 },
  { name: "Velachery", area: "Velachery", lat: 12.9815, lng: 80.2180 },
  { name: "OMR Thoraipakkam", area: "OMR", lat: 12.9352, lng: 80.2332 },
  { name: "ECR Neelankarai", area: "ECR", lat: 12.9516, lng: 80.2589 },
  { name: "Guindy", area: "Guindy", lat: 13.0067, lng: 80.2206 },
  { name: "Porur Junction", area: "Porur", lat: 13.0382, lng: 80.1562 },
  { name: "Tambaram Station", area: "Tambaram", lat: 12.9249, lng: 80.1000 },
  { name: "Sholinganallur", area: "OMR", lat: 12.9010, lng: 80.2279 },
  { name: "Mylapore", area: "Mylapore", lat: 13.0368, lng: 80.2676 },
  { name: "Egmore Station", area: "Egmore", lat: 13.0732, lng: 80.2609 },
  { name: "Marina Beach", area: "Triplicane", lat: 13.0500, lng: 80.2824 },
  { name: "VIT Chennai", area: "Vandalur-Kelambakkam Road", lat: 12.8406, lng: 80.1534 },
  { name: "Chromepet", area: "Chromepet", lat: 12.9516, lng: 80.1462 },
  { name: "Pallavaram", area: "Pallavaram", lat: 12.9675, lng: 80.1491 },
  { name: "Perungudi", area: "OMR", lat: 12.9611, lng: 80.2421 },
  { name: "Tidel Park", area: "Taramani", lat: 12.9889, lng: 80.2467 },
];

const RIDE_OPTIONS = {
  cab: [
    { provider: "Uber", type: "UberGo", price: 349, eta: 4, score: 94, logo: "uber", reliability: 96, surge: false },
    { provider: "Ola", type: "Ola Mini", price: 312, eta: 6, score: 91, logo: "ola", reliability: 89, surge: false },
    { provider: "Rapido", type: "Rapido Cab", price: 289, eta: 8, score: 87, logo: "rapido", reliability: 85, surge: false },
    { provider: "Uber", type: "UberXL", price: 549, eta: 7, score: 82, logo: "uber", reliability: 94, surge: true },
    { provider: "Ola", type: "Ola Prime", price: 489, eta: 5, score: 88, logo: "ola", reliability: 92, surge: false },
  ],
  bike: [
    { provider: "Rapido", type: "Rapido Bike", price: 89, eta: 3, score: 92, logo: "rapido", reliability: 88, surge: false },
    { provider: "Uber", type: "Uber Moto", price: 99, eta: 5, score: 89, logo: "uber", reliability: 91, surge: false },
    { provider: "Ola", type: "Ola Bike", price: 79, eta: 7, score: 85, logo: "ola", reliability: 82, surge: false },
  ],
  auto: [
    { provider: "Ola", type: "Ola Auto", price: 149, eta: 5, score: 93, logo: "ola", reliability: 90, surge: false },
    { provider: "Rapido", type: "Rapido Auto", price: 139, eta: 4, score: 91, logo: "rapido", reliability: 87, surge: false },
    { provider: "Uber", type: "Uber Auto", price: 159, eta: 6, score: 88, logo: "uber", reliability: 93, surge: false },
  ],
  metro: [
    { line: "Blue Line", from: "Airport", to: "Wimco Nagar", price: 40, eta: 2, duration: "45 min", stations: 32 },
    { line: "Green Line", from: "St. Thomas Mount", to: "Central", price: 30, eta: 5, duration: "35 min", stations: 17 },
  ],
};

// --- SVG Icons ---
const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={COLORS.navy}>
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.14 4.48-3.74 4.25z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);

const CabIcon = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
    <rect x="8" y="24" width="48" height="22" rx="6" fill={COLORS.navy}/>
    <rect x="12" y="28" width="16" height="10" rx="2" fill="#E8F0FE" opacity="0.9"/>
    <rect x="36" y="28" width="16" height="10" rx="2" fill="#E8F0FE" opacity="0.9"/>
    <rect x="18" y="16" width="28" height="12" rx="4" fill={COLORS.blue}/>
    <circle cx="18" cy="50" r="5" fill={COLORS.gray700}/><circle cx="18" cy="50" r="2.5" fill={COLORS.gray300}/>
    <circle cx="46" cy="50" r="5" fill={COLORS.gray700}/><circle cx="46" cy="50" r="2.5" fill={COLORS.gray300}/>
    <rect x="26" y="10" width="12" height="8" rx="2" fill={COLORS.orange}/>
  </svg>
);

const BikeIcon = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
    <circle cx="16" cy="42" r="10" stroke={COLORS.navy} strokeWidth="3" fill="none"/>
    <circle cx="48" cy="42" r="10" stroke={COLORS.navy} strokeWidth="3" fill="none"/>
    <path d="M16 42L28 22H40L48 42" stroke={COLORS.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28 22L24 42" stroke={COLORS.navy} strokeWidth="3" strokeLinecap="round"/>
    <circle cx="28" cy="18" r="4" fill={COLORS.blue}/>
    <path d="M32 22H44" stroke={COLORS.navy} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const AutoIcon = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
    <path d="M12 44V28C12 22 16 18 22 18H42L52 28V44" stroke="#2A8A3E" strokeWidth="3" fill="none"/>
    <rect x="16" y="26" width="14" height="10" rx="2" fill="#E8F0FE"/>
    <rect x="34" y="26" width="14" height="10" rx="2" fill="#E8F0FE"/>
    <circle cx="18" cy="48" r="5" fill={COLORS.gray700}/><circle cx="18" cy="48" r="2.5" fill={COLORS.gray300}/>
    <circle cx="46" cy="48" r="5" fill={COLORS.gray700}/><circle cx="46" cy="48" r="2.5" fill={COLORS.gray300}/>
    <rect x="10" y="14" width="4" height="10" rx="2" fill="#FFC107"/>
  </svg>
);

const MetroIcon = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
    <rect x="12" y="10" width="40" height="36" rx="8" stroke={COLORS.blue} strokeWidth="3" fill="none"/>
    <rect x="18" y="18" width="12" height="10" rx="2" fill="#E8F0FE"/>
    <rect x="34" y="18" width="12" height="10" rx="2" fill="#E8F0FE"/>
    <line x1="20" y1="50" x2="26" y2="58" stroke={COLORS.navy} strokeWidth="3" strokeLinecap="round"/>
    <line x1="44" y1="50" x2="38" y2="58" stroke={COLORS.navy} strokeWidth="3" strokeLinecap="round"/>
    <circle cx="22" cy="38" r="3" fill={COLORS.blue}/><circle cx="42" cy="38" r="3" fill={COLORS.blue}/>
    <line x1="26" y1="58" x2="38" y2="58" stroke={COLORS.navy} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const LocationPinIcon = ({ color = COLORS.blue, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color}/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>
);

const CheckCircle = ({ size = 16, color = COLORS.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const ChevronRight = ({ size = 18, color = COLORS.gray400 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const BackArrow = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
);

const MapPinDot = ({ color = COLORS.green, size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill={color} opacity="0.2"/><circle cx="6" cy="6" r="3" fill={color}/></svg>
);

const ShieldIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={COLORS.blue}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
  </svg>
);

const ClockIcon = ({ size = 14, color = COLORS.gray500 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
);

const ProviderLogo = ({ provider, size = 28 }) => {
  const logos = {
    uber: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="8" fill="#000"/>
        <text x="20" y="26" textAnchor="middle" fill="white" fontFamily="'Montserrat', sans-serif" fontWeight="700" fontSize="14">U</text>
      </svg>
    ),
    ola: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="8" fill="#1C8B3C"/>
        <text x="20" y="26" textAnchor="middle" fill="white" fontFamily="'Montserrat', sans-serif" fontWeight="700" fontSize="13">Ola</text>
      </svg>
    ),
    rapido: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="8" fill="#FFD700"/>
        <text x="20" y="26" textAnchor="middle" fill="#000" fontFamily="'Montserrat', sans-serif" fontWeight="700" fontSize="13">R</text>
      </svg>
    ),
  };
  return logos[provider] || null;
};

// --- Global Styles (injected once) ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    
    @keyframes movzz-spin { to { transform: rotate(360deg); } }
    @keyframes movzz-pulse { 0%, 100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes movzz-fadein { from { opacity:0; transform:scale(0.9) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes movzz-slideup { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
    @keyframes movzz-scalein { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
    @keyframes movzz-checkpop {
      0% { opacity:0; transform:scale(0); }
      50% { transform:scale(1.2); }
      100% { opacity:1; transform:scale(1); }
    }
    
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    
    .movzz-btn:active { transform: scale(0.97) !important; }
    
    .screen-enter { animation: movzz-fadein 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .screen-exit { 
      animation: screen-out 0.3s cubic-bezier(0.55, 0, 1, 0.45) forwards;
    }
    @keyframes screen-out {
      to { opacity: 0; transform: scale(0.97) translateY(-8px); }
    }
  `}</style>
);

// --- Animated Screen Wrapper ---
// Simple fade-in only on new screen, no exit animation (prevents flicker)
const ScreenTransition = ({ children, screenKey }) => {
  const [fadeIn, setFadeIn] = useState(false);
  const prevKeyRef = useRef(screenKey);

  useEffect(() => {
    if (screenKey !== prevKeyRef.current) {
      setFadeIn(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFadeIn(true);
        });
      });
      prevKeyRef.current = screenKey;
    } else {
      setFadeIn(true);
    }
  }, [screenKey]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{
        width: "100%", height: "100%",
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.3s ease",
        willChange: "opacity",
      }}>
        {children}
      </div>
    </div>
  );
};

// --- Phone Frame ---
const PhoneFrame = ({ children }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh",
    background: `${COLORS.gray200}`,
    fontFamily: "'Montserrat', 'SF Pro Display', -apple-system, sans-serif",
    padding: "20px",
  }}>
    <GlobalStyles/>
    <div style={{
      width: 390, height: 844,
      borderRadius: 50, background: COLORS.white,
      position: "relative", overflow: "hidden",
      boxShadow: `0 0 0 2px ${COLORS.gray800}, 0 0 0 4px ${COLORS.gray700}, 0 25px 80px rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.2)`,
    }}>
      {/* Dynamic Island */}
      <div style={{
        position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        width: 126, height: 34, background: COLORS.navy, borderRadius: 20, zIndex: 1000,
      }}/>
      {/* Status Bar */}
      <div style={{
        position: "absolute", top: 12, left: 30, right: 30,
        display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 999, padding: "0 4px",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, fontFamily: "'DM Sans', sans-serif" }}>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill={COLORS.navy}>
            <rect x="0" y="6" width="3" height="6" rx="0.5"/><rect x="4.5" y="4" width="3" height="8" rx="0.5"/>
            <rect x="9" y="1.5" width="3" height="10.5" rx="0.5"/><rect x="13.5" y="0" width="2.5" height="12" rx="0.5"/>
          </svg>
          <svg width="24" height="12" viewBox="0 0 24 12" fill={COLORS.navy}>
            <rect x="0" y="0" width="21" height="12" rx="2" stroke={COLORS.navy} strokeWidth="1" fill="none"/>
            <rect x="1.5" y="1.5" width="16" height="9" rx="1" fill={COLORS.navy}/>
            <rect x="22" y="3.5" width="2" height="5" rx="1" fill={COLORS.navy}/>
          </svg>
        </div>
      </div>
      <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 50 }}>
        {children}
      </div>
    </div>
  </div>
);

// --- Splash Screen ---
const SplashScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3200),
      setTimeout(() => onComplete(), 3700),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: COLORS.white, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: phase >= 1 ? 0.03 : 0, transition: "opacity 1s ease",
        backgroundImage: `radial-gradient(${COLORS.blue} 1px, transparent 1px)`, backgroundSize: "24px 24px",
      }}/>
      <div style={{
        opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
        transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <svg width="240" height="84" viewBox="0 0 360 126">
          <text x="50%" y="100" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontWeight="900" fontSize="100" letterSpacing="-3">
            <tspan fill={COLORS.navy}>MOV</tspan><tspan fill={COLORS.blue}>ZZ</tspan>
          </text>
        </svg>
      </div>
      <div style={{
        marginTop: 24, opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: COLORS.gray600, letterSpacing: 0.5, textAlign: "center", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
          Reliability layer for urban mobility.
        </p>
      </div>
      <div style={{
        marginTop: 12, opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <p style={{ fontSize: 13, fontWeight: 400, color: COLORS.gray400, letterSpacing: 2, textTransform: "uppercase", textAlign: "center", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
          Every ride, guaranteed.
        </p>
      </div>
      <div style={{
        position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
        width: phase >= 2 ? 60 : 0, height: 3, background: COLORS.blue, borderRadius: 2,
        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
      }}/>
      <div style={{
        position: "absolute", inset: 0, background: COLORS.white,
        opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none",
      }}/>
    </div>
  );
};

// --- Auth Screen ---
const AuthScreen = ({ onComplete }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: COLORS.white }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s" }}>
          <svg width="180" height="63" viewBox="0 0 360 126">
            <text x="50%" y="100" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontWeight="900" fontSize="100" letterSpacing="-3">
              <tspan fill={COLORS.navy}>MOV</tspan><tspan fill={COLORS.blue}>ZZ</tspan>
            </text>
          </svg>
        </div>
        <div style={{ marginTop: 16, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s" }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, textAlign: "center", margin: "0 0 6px" }}>Welcome aboard</p>
          <p style={{ fontSize: 14, color: COLORS.gray500, textAlign: "center", margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Sign in to get reliable rides, every time.</p>
        </div>
      </div>

      <div style={{ padding: "0 28px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { icon: <GoogleLogo/>, label: "Continue with Google", delay: 0.4 },
          { icon: <AppleLogo/>, label: "Continue with Apple", delay: 0.5 },
          { icon: <PhoneIcon/>, label: "Continue with Phone", delay: 0.6 },
        ].map((btn, i) => (
          <button key={i} onClick={onComplete} className="movzz-btn" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            width: "100%", height: 54, border: `1.5px solid ${COLORS.gray200}`, borderRadius: 14,
            background: COLORS.white, cursor: "pointer", fontSize: 15, fontWeight: 600,
            color: COLORS.navy, fontFamily: "'DM Sans', sans-serif",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${btn.delay}s`,
          }}>
            {btn.icon}{btn.label}
          </button>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0", opacity: visible ? 1 : 0, transition: "opacity 0.7s ease 0.7s" }}>
          <div style={{ flex: 1, height: 1, background: COLORS.gray200 }}/>
          <span style={{ fontSize: 12, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>or</span>
          <div style={{ flex: 1, height: 1, background: COLORS.gray200 }}/>
        </div>

        <button onClick={onComplete} className="movzz-btn" style={{
          width: "100%", height: 54, border: "none", borderRadius: 14, background: COLORS.navy,
          cursor: "pointer", fontSize: 15, fontWeight: 600, color: COLORS.white, fontFamily: "'DM Sans', sans-serif",
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.75s",
        }}>
          Sign in with Email
        </button>

        <p style={{
          textAlign: "center", fontSize: 11, color: COLORS.gray400, margin: "8px 0 0",
          lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif",
          opacity: visible ? 1 : 0, transition: "opacity 0.7s ease 0.9s",
        }}>
          By continuing, you agree to our <span style={{ color: COLORS.blue, fontWeight: 500 }}>Terms</span> and <span style={{ color: COLORS.blue, fontWeight: 500 }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
};

// --- Transport Mode ---
const TransportScreen = ({ onSelect }) => {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const modes = [
    { id: "cab", label: "Cab", desc: "Comfort rides", icon: <CabIcon/> },
    { id: "bike", label: "Bike Taxi", desc: "Quick & affordable", icon: <BikeIcon/> },
    { id: "auto", label: "Auto", desc: "City rides", icon: <AutoIcon/> },
    { id: "metro", label: "Metro", desc: "Rail transit", icon: <MetroIcon/> },
  ];

  const handleSelect = (mode) => {
    setSelected(mode);
    setTimeout(() => onSelect(mode), 350);
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: COLORS.white, paddingTop: 60 }}>
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s" }}>
          <p style={{ fontSize: 14, color: COLORS.gray400, margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" }}>Good morning 👋</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: COLORS.navy, margin: "0 0 4px", letterSpacing: -0.5 }}>Where to?</h1>
          <p style={{ fontSize: 13, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Choose your mode of transport</p>
        </div>
      </div>

      <div style={{ padding: "28px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {modes.map((mode, i) => (
          <button key={mode.id} onClick={() => handleSelect(mode.id)} className="movzz-btn" style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "24px 12px",
            border: `2px solid ${selected === mode.id ? COLORS.blue : COLORS.gray200}`,
            borderRadius: 20, background: selected === mode.id ? COLORS.blueLight : COLORS.white,
            cursor: "pointer",
            opacity: visible ? 1 : 0,
            transform: visible ? (selected === mode.id ? "scale(0.96)" : "translateY(0)") : "translateY(30px)",
            transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + i * 0.08}s`,
          }}>
            <div style={{ transform: selected === mode.id ? "scale(1.08)" : "scale(1)", transition: "transform 0.3s ease" }}>{mode.icon}</div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, margin: "0 0 2px", textAlign: "center" }}>{mode.label}</p>
              <p style={{ fontSize: 11, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>{mode.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 24px", opacity: visible ? 1 : 0, transition: "opacity 0.7s ease 0.6s" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.gray600, margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.3 }}>Frequent destinations</p>
        {[
          { name: "Chennai Airport (MAA)", sub: "Tirusulam • 24 km" },
          { name: "VIT Chennai", sub: "Vandalur-Kelambakkam Rd • 8 km" },
        ].map((dest, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i === 0 ? `1px solid ${COLORS.gray100}` : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.gray100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClockIcon size={16} color={COLORS.gray500}/>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, margin: 0 }}>{dest.name}</p>
              <p style={{ fontSize: 12, color: COLORS.gray400, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{dest.sub}</p>
            </div>
            <ChevronRight/>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}/>
      <div style={{ padding: "12px 24px 32px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: visible ? 1 : 0, transition: "opacity 0.7s ease 0.8s" }}>
        <ShieldIcon size={12}/>
        <span style={{ fontSize: 11, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>Every ride backed by MOVZZ reliability guarantee</span>
      </div>
    </div>
  );
};

// --- Chennai Map Component (iframe-based, actually loads real tiles) ---
const ChennaiMap = ({ pickupSelected, dropSelected, activeField, onLocationSelect }) => {
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Build the full HTML for the map in an iframe
  const mapHTML = `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<style>
  * { margin:0; padding:0; }
  html, body, #map { width:100%; height:100%; }
  .leaflet-control-attribution { display:none !important; }
</style>
</head><body>
<div id="map"></div>
<script>
  var locations = ${JSON.stringify(CHENNAI_LOCATIONS)};
  var map = L.map('map', { center: [13.0, 80.21], zoom: 11, zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  
  var pickupMarker = null;
  var dropMarker = null;
  
  function greenIcon() {
    return L.divIcon({
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#12B76A;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);"></div>',
      iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
  }
  function blueIcon() {
    return L.divIcon({
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#2D7FF9;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);"></div>',
      iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
  }
  
  map.on('click', function(e) {
    var lat = e.latlng.lat, lng = e.latlng.lng;
    var nearest = locations.reduce(function(prev, curr) {
      var d1 = Math.sqrt(Math.pow(prev.lat - lat, 2) + Math.pow(prev.lng - lng, 2));
      var d2 = Math.sqrt(Math.pow(curr.lat - lat, 2) + Math.pow(curr.lng - lng, 2));
      return d2 < d1 ? curr : prev;
    });
    window.parent.postMessage({ type: 'mapClick', location: nearest }, '*');
  });
  
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (d.type === 'setPickup' && d.lat && d.lng) {
      if (pickupMarker) map.removeLayer(pickupMarker);
      pickupMarker = L.marker([d.lat, d.lng], { icon: greenIcon() }).addTo(map);
      fitBounds();
    }
    if (d.type === 'setDrop' && d.lat && d.lng) {
      if (dropMarker) map.removeLayer(dropMarker);
      dropMarker = L.marker([d.lat, d.lng], { icon: blueIcon() }).addTo(map);
      fitBounds();
    }
    if (d.type === 'clearPickup') {
      if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; }
    }
    if (d.type === 'clearDrop') {
      if (dropMarker) { map.removeLayer(dropMarker); dropMarker = null; }
    }
  });
  
  function fitBounds() {
    var markers = [];
    if (pickupMarker) markers.push(pickupMarker.getLatLng());
    if (dropMarker) markers.push(dropMarker.getLatLng());
    if (markers.length === 2) {
      map.fitBounds(L.latLngBounds(markers), { padding: [50, 50], maxZoom: 14 });
    } else if (markers.length === 1) {
      map.setView(markers[0], 14, { animate: true });
    }
  }
  
  window.parent.postMessage({ type: 'mapReady' }, '*');
<\/script>
</body></html>`;

  // Listen for messages from map iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "mapReady") setReady(true);
      if (e.data?.type === "mapClick" && e.data.location) {
        onLocationSelect(e.data.location);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onLocationSelect]);

  // Update markers when selections change
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const cw = iframeRef.current.contentWindow;
    if (pickupSelected) {
      cw.postMessage({ type: "setPickup", lat: pickupSelected.lat, lng: pickupSelected.lng }, "*");
    } else {
      cw.postMessage({ type: "clearPickup" }, "*");
    }
  }, [pickupSelected]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const cw = iframeRef.current.contentWindow;
    if (dropSelected) {
      cw.postMessage({ type: "setDrop", lat: dropSelected.lat, lng: dropSelected.lng }, "*");
    } else {
      cw.postMessage({ type: "clearDrop" }, "*");
    }
  }, [dropSelected]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <iframe
        ref={iframeRef}
        srcDoc={mapHTML}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          opacity: ready ? 1 : 0,
          transition: "opacity 0.6s ease",
        }}
        sandbox="allow-scripts allow-same-origin"
        title="Chennai Map"
      />
      {!ready && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: COLORS.gray50, gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14,
            border: `3px solid ${COLORS.gray200}`, borderTopColor: COLORS.blue,
            animation: "movzz-spin 0.8s linear infinite",
          }}/>
          <span style={{ fontSize: 12, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>Loading map...</span>
        </div>
      )}
    </div>
  );
};

// --- Location Screen ---
const LocationScreen = ({ mode, onBack, onConfirm }) => {
  const [visible, setVisible] = useState(false);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [activeField, setActiveField] = useState("pickup");
  const [pickupSelected, setPickupSelected] = useState(null);
  const [dropSelected, setDropSelected] = useState(null);

  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const handleMapLocationSelect = useCallback((loc) => {
    if (activeField === "pickup") {
      setPickup(loc.name);
      setPickupSelected(loc);
      if (!dropSelected) setActiveField("drop");
    } else {
      setDrop(loc.name);
      setDropSelected(loc);
    }
  }, [activeField, dropSelected]);

  const filteredLocations = CHENNAI_LOCATIONS.filter(loc => {
    const query = activeField === "pickup" ? pickup : drop;
    if (!query || query.length < 1) return true;
    return loc.name.toLowerCase().includes(query.toLowerCase()) || loc.area.toLowerCase().includes(query.toLowerCase());
  }).slice(0, 5);

  const handleLocationSelect = (loc) => {
    if (activeField === "pickup") {
      setPickup(loc.name);
      setPickupSelected(loc);
      if (!dropSelected) setActiveField("drop");
    } else {
      setDrop(loc.name);
      setDropSelected(loc);
    }
  };

  const canConfirm = pickupSelected && dropSelected;
  const modeLabel = mode === "cab" ? "Cab" : mode === "bike" ? "Bike Taxi" : mode === "auto" ? "Auto" : "Metro";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: COLORS.white }}>
      {/* Header + inputs */}
      <div style={{
        paddingTop: 56, padding: "56px 20px 0", background: COLORS.white, zIndex: 10,
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-20px)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} className="movzz-btn" style={{
            width: 38, height: 38, borderRadius: 12, border: `1.5px solid ${COLORS.gray200}`,
            background: COLORS.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><BackArrow size={18}/></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, margin: 0 }}>Set your route</h2>
            <p style={{ fontSize: 12, color: COLORS.gray400, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{modeLabel} ride</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 20, flexShrink: 0 }}>
            <MapPinDot color={COLORS.green} size={12}/>
            <div style={{ width: 2, height: 24, background: COLORS.gray200, margin: "2px 0" }}/>
            <LocationPinIcon color={COLORS.blue} size={16}/>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div onClick={() => setActiveField("pickup")} style={{
              display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 14px",
              border: `1.5px solid ${activeField === "pickup" ? COLORS.green : COLORS.gray200}`,
              borderRadius: 12, background: activeField === "pickup" ? "#F0FFF4" : COLORS.white,
              cursor: "text", transition: "all 0.2s ease",
            }}>
              <input value={pickup}
                onChange={e => { setPickup(e.target.value); setPickupSelected(null); setActiveField("pickup"); }}
                onFocus={() => setActiveField("pickup")} placeholder="Pickup location"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 500, color: COLORS.navy, fontFamily: "'DM Sans', sans-serif" }}
              />
              {pickupSelected && <CheckCircle size={16} color={COLORS.green}/>}
            </div>
            <div onClick={() => setActiveField("drop")} style={{
              display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 14px",
              border: `1.5px solid ${activeField === "drop" ? COLORS.blue : COLORS.gray200}`,
              borderRadius: 12, background: activeField === "drop" ? COLORS.blueLight : COLORS.white,
              cursor: "text", transition: "all 0.2s ease",
            }}>
              <input value={drop}
                onChange={e => { setDrop(e.target.value); setDropSelected(null); setActiveField("drop"); }}
                onFocus={() => setActiveField("drop")} placeholder="Drop location"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 500, color: COLORS.navy, fontFamily: "'DM Sans', sans-serif" }}
              />
              {dropSelected && <CheckCircle size={16} color={COLORS.blue}/>}
            </div>
          </div>
        </div>
      </div>

      {/* Map + Suggestions */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", marginTop: 12, minHeight: 0 }}>
        {/* Map fills available space */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <ChennaiMap
            pickupSelected={pickupSelected}
            dropSelected={dropSelected}
            activeField={activeField}
            onLocationSelect={handleMapLocationSelect}
          />
          {!pickupSelected && !dropSelected && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.95)", padding: "8px 16px", borderRadius: 20,
              boxShadow: "0 2px 12px rgba(0,0,0,0.1)", fontSize: 12, color: COLORS.gray600,
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500, whiteSpace: "nowrap", zIndex: 5,
            }}>
              📍 Tap map or search below
            </div>
          )}
        </div>

        {/* Suggestions panel */}
        <div style={{
          background: COLORS.white, borderTop: `1px solid ${COLORS.gray100}`,
          maxHeight: 200, overflowY: "auto",
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        }}>
          <div style={{ padding: "8px 20px 4px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.gray400, letterSpacing: 0.8, textTransform: "uppercase", margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" }}>
              {activeField === "pickup" ? "Select pickup" : "Select drop"}
            </p>
          </div>
          {filteredLocations.map((loc, i) => (
            <button key={i} onClick={() => handleLocationSelect(loc)} className="movzz-btn" style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 20px",
              border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: COLORS.gray100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <LocationPinIcon color={activeField === "pickup" ? COLORS.green : COLORS.blue} size={16}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.name}</p>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{loc.area}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Confirm */}
      <div style={{ padding: "12px 20px 32px", background: COLORS.white }}>
        <button onClick={() => canConfirm && onConfirm(pickupSelected, dropSelected)} disabled={!canConfirm} className="movzz-btn" style={{
          width: "100%", height: 52, border: "none", borderRadius: 14,
          background: canConfirm ? COLORS.navy : COLORS.gray200,
          color: canConfirm ? COLORS.white : COLORS.gray400,
          fontSize: 15, fontWeight: 700, cursor: canConfirm ? "pointer" : "default",
          fontFamily: "'Montserrat', sans-serif", transition: "all 0.3s ease",
        }}>
          {canConfirm ? "Find rides" : "Select pickup & drop"}
        </button>
      </div>
    </div>
  );
};

// --- Results Screen ---
const ResultsScreen = ({ mode, pickup, drop, onBack, onSelect }) => {
  const [visible, setVisible] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    setTimeout(() => setLoading(false), 1800);
  }, []);

  const options = RIDE_OPTIONS[mode] || [];
  let tagged = [];
  if (mode !== "metro") {
    const sorted = [...options].sort((a, b) => b.score - a.score);
    tagged = sorted.map((opt, i) => {
      let tag = null;
      if (i === 0) tag = { label: "Best Match", color: COLORS.green, bg: COLORS.greenLight };
      const cheapest = sorted.reduce((p, c) => c.price < p.price ? c : p);
      const costliest = sorted.reduce((p, c) => c.price > p.price ? c : p);
      if (opt === cheapest && !tag) tag = { label: "Cheapest", color: COLORS.blue, bg: COLORS.blueLight };
      if (opt === costliest && !tag) tag = { label: "Premium", color: COLORS.orange, bg: COLORS.orangeLight };
      return { ...opt, tag };
    });
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: COLORS.gray50 }}>
      {/* Header */}
      <div style={{
        paddingTop: 56, padding: "56px 20px 16px", background: COLORS.white,
        borderBottom: `1px solid ${COLORS.gray100}`,
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-20px)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} className="movzz-btn" style={{
            width: 38, height: 38, borderRadius: 12, border: `1.5px solid ${COLORS.gray200}`,
            background: COLORS.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}><BackArrow size={18}/></button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, margin: 0 }}>Available rides</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: COLORS.blueLight }}>
            <ShieldIcon size={12}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.blue, fontFamily: "'DM Sans', sans-serif" }}>Verified</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: COLORS.gray50, borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <MapPinDot color={COLORS.green} size={8}/>
            <div style={{ width: 1.5, height: 16, background: COLORS.gray300 }}/>
            <LocationPinIcon color={COLORS.blue} size={12}/>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pickup?.name}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drop?.name}</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, border: `3px solid ${COLORS.gray200}`, borderTopColor: COLORS.blue, animation: "movzz-spin 0.8s linear infinite" }}/>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, margin: "0 0 4px", textAlign: "center" }}>Querying providers...</p>
              <p style={{ fontSize: 12, color: COLORS.gray400, margin: 0, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>Scoring for reliability</p>
            </div>
          </div>
        ) : mode === "metro" ? (
          options.map((opt, i) => (
            <button key={i} onClick={() => setSelectedIdx(i)} className="movzz-btn" style={{
              display: "flex", flexDirection: "column", padding: 16,
              border: `2px solid ${selectedIdx === i ? COLORS.blue : COLORS.gray200}`,
              borderRadius: 16, background: selectedIdx === i ? COLORS.blueLight : COLORS.white,
              cursor: "pointer", textAlign: "left",
              animation: `movzz-slideup 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + i * 0.1}s both`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: opt.line === "Blue Line" ? "#1565C0" : "#2E7D32", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MetroIcon/>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, margin: 0 }}>{opt.line}</p>
                  <p style={{ fontSize: 12, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{opt.from} → {opt.to}</p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, margin: 0 }}>₹{opt.price}</p>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 12, color: COLORS.gray500, fontFamily: "'DM Sans', sans-serif" }}>🚇 {opt.stations} stations</span>
                <span style={{ fontSize: 12, color: COLORS.gray500, fontFamily: "'DM Sans', sans-serif" }}>⏱ {opt.duration}</span>
                <span style={{ fontSize: 12, color: COLORS.gray500, fontFamily: "'DM Sans', sans-serif" }}>🕐 {opt.eta} min</span>
              </div>
            </button>
          ))
        ) : (
          tagged.map((opt, i) => (
            <button key={i} onClick={() => setSelectedIdx(i)} className="movzz-btn" style={{
              display: "flex", flexDirection: "column", padding: 16,
              border: `2px solid ${selectedIdx === i ? COLORS.blue : COLORS.gray200}`,
              borderRadius: 16, background: selectedIdx === i ? COLORS.blueLight : COLORS.white,
              cursor: "pointer", textAlign: "left",
              animation: `movzz-slideup 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.07}s both`,
              transition: "border-color 0.2s ease, background 0.2s ease",
            }}>
              {opt.tag && (
                <div style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 6, background: opt.tag.bg, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: opt.tag.color, fontFamily: "'DM Sans', sans-serif" }}>{opt.tag.label}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ProviderLogo provider={opt.logo} size={40}/>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, margin: "0 0 2px" }}>{opt.type}</p>
                  <p style={{ fontSize: 12, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>via {opt.provider} {opt.surge ? "• ⚡ Surge" : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, margin: 0 }}>₹{opt.price}</p>
                  <p style={{ fontSize: 11, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{opt.eta} min</p>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: COLORS.gray100, overflow: "hidden" }}>
                  <div style={{
                    width: `${opt.score}%`, height: "100%", borderRadius: 3,
                    background: opt.score >= 90 ? COLORS.green : opt.score >= 85 ? COLORS.blue : COLORS.orange,
                    transition: "width 1s ease 0.5s",
                  }}/>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ShieldIcon size={12}/>
                  <span style={{ fontSize: 12, fontWeight: 700, color: opt.score >= 90 ? COLORS.green : opt.score >= 85 ? COLORS.blue : COLORS.orange, fontFamily: "'DM Sans', sans-serif" }}>{opt.score}</span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                <span style={{ fontSize: 11, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>Reliability: {opt.reliability}%</span>
                <span style={{ fontSize: 11, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>ETA: {opt.eta}m</span>
                <span style={{ fontSize: 11, color: COLORS.gray400, fontFamily: "'DM Sans', sans-serif" }}>Source: {opt.provider}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Bottom confirm */}
      <div style={{ padding: "12px 20px 32px", background: COLORS.white, borderTop: `1px solid ${COLORS.gray100}` }}>
        <button
          onClick={() => selectedIdx !== null && onSelect(mode === "metro" ? options[selectedIdx] : tagged[selectedIdx])}
          disabled={selectedIdx === null}
          className="movzz-btn"
          style={{
            width: "100%", height: 52, border: "none", borderRadius: 14,
            background: selectedIdx !== null ? COLORS.navy : COLORS.gray200,
            color: selectedIdx !== null ? COLORS.white : COLORS.gray400,
            fontSize: 15, fontWeight: 700, cursor: selectedIdx !== null ? "pointer" : "default",
            fontFamily: "'Montserrat', sans-serif", transition: "all 0.3s ease",
          }}
        >
          {selectedIdx !== null ? "Confirm ride" : "Select an option"}
        </button>
      </div>
    </div>
  );
};

// --- Confirmation Screen (buttery smooth, no stuck) ---
const ConfirmScreen = ({ ride, pickup, drop, onBack }) => {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle -> confirming -> confirmed

  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  const handleConfirm = () => {
    setPhase("confirming");
    setTimeout(() => setPhase("confirmed"), 1800);
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column", background: COLORS.white,
    }}>
      {/* Header */}
      <div style={{
        paddingTop: 56, padding: "56px 20px 0",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-16px)",
        transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} className="movzz-btn" style={{
            width: 38, height: 38, borderRadius: 12, border: `1.5px solid ${COLORS.gray200}`,
            background: COLORS.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: phase === "confirmed" ? 0.5 : 1, transition: "opacity 0.3s ease",
          }}><BackArrow size={18}/></button>
          <h2 style={{
            fontSize: 18, fontWeight: 700, margin: 0,
            color: phase === "confirmed" ? COLORS.green : COLORS.navy,
            transition: "color 0.5s ease",
          }}>
            {phase === "confirmed" ? "Ride confirmed!" : "Confirm your ride"}
          </h2>
        </div>
      </div>

      <div style={{
        flex: 1, padding: "0 20px", overflowY: "auto",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
      }}>
        {/* Success badge — compact, no wasted space */}
        <div style={{
          overflow: "hidden",
          maxHeight: phase === "confirmed" ? 72 : 0,
          opacity: phase === "confirmed" ? 1 : 0,
          transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          marginBottom: phase === "confirmed" ? 12 : 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderRadius: 12, background: COLORS.greenLight,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 20, background: COLORS.white,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              animation: phase === "confirmed" ? "movzz-checkpop 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both" : "none",
            }}>
              <CheckCircle size={22} color={COLORS.green}/>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.green, margin: "0 0 2px" }}>Ride confirmed!</p>
              <p style={{ fontSize: 12, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Your driver is on the way</p>
            </div>
          </div>
        </div>

        {/* Ride details card */}
        <div style={{
          padding: 20, borderRadius: 16, border: `1.5px solid ${phase === "confirmed" ? COLORS.green : COLORS.gray200}`,
          background: COLORS.white, marginBottom: 16, transition: "border-color 0.5s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {ride.logo && <ProviderLogo provider={ride.logo} size={44}/>}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy, margin: "0 0 2px" }}>{ride.type || ride.line}</p>
              <p style={{ fontSize: 13, color: COLORS.gray500, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{ride.provider ? `via ${ride.provider}` : `${ride.stations} stations`}</p>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy, margin: 0 }}>₹{ride.price}</p>
          </div>

          <div style={{ padding: 14, borderRadius: 12, background: COLORS.gray50 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <MapPinDot color={COLORS.green} size={10}/>
              <div>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: "0 0 2px", fontFamily: "'DM Sans', sans-serif" }}>PICKUP</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, margin: 0 }}>{pickup?.name}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <LocationPinIcon color={COLORS.blue} size={14}/>
              <div>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: "0 0 2px", fontFamily: "'DM Sans', sans-serif" }}>DROP</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, margin: 0 }}>{drop?.name}</p>
              </div>
            </div>
          </div>

          {ride.score && (
            <div style={{ display: "flex", gap: 16, marginTop: 16, padding: "12px 0 0", borderTop: `1px solid ${COLORS.gray100}` }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" }}>ETA</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy, margin: 0 }}>{ride.eta} min</p>
              </div>
              <div style={{ width: 1, background: COLORS.gray100 }}/>
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" }}>Score</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.green, margin: 0 }}>{ride.score}/100</p>
              </div>
              <div style={{ width: 1, background: COLORS.gray100 }}/>
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 11, color: COLORS.gray400, margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif" }}>Reliability</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.blue, margin: 0 }}>{ride.reliability}%</p>
              </div>
            </div>
          )}
        </div>

        {/* MOVZZ guarantee */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12,
          background: COLORS.blueLight, marginBottom: 16,
        }}>
          <ShieldIcon size={20}/>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, margin: "0 0 2px" }}>MOVZZ Reliability Guarantee</p>
            <p style={{ fontSize: 11, color: COLORS.gray600, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Auto-retry on failure • ₹100 credit if we can't deliver</p>
          </div>
        </div>
      </div>

      {/* Bottom — smooth transition between states */}
      <div style={{ padding: "12px 20px 32px", background: COLORS.white }}>
        {phase === "confirmed" ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 54, borderRadius: 14, background: COLORS.greenLight,
            animation: "movzz-fadein 0.5s ease both",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.green, animation: "movzz-pulse 1.5s ease-in-out infinite" }}/>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.green, fontFamily: "'DM Sans', sans-serif" }}>
              Driver arriving in {ride.eta} min
            </span>
          </div>
        ) : (
          <button onClick={handleConfirm} disabled={phase === "confirming"} className="movzz-btn" style={{
            width: "100%", height: 54, border: "none", borderRadius: 14,
            background: phase === "confirming" ? COLORS.blueDark : COLORS.navy,
            color: COLORS.white, fontSize: 15, fontWeight: 700,
            cursor: phase === "confirming" ? "default" : "pointer",
            fontFamily: "'Montserrat', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.3s ease",
          }}>
            {phase === "confirming" ? (
              <>
                <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: COLORS.white, animation: "movzz-spin 0.8s linear infinite" }}/>
                Confirming...
              </>
            ) : (
              `Confirm • ₹${ride.price}`
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// --- Main App with smooth screen transitions ---
export default function MovzzApp() {
  const [screen, setScreen] = useState("splash");
  const [mode, setMode] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);

  const renderScreen = () => {
    switch (screen) {
      case "splash": return <SplashScreen onComplete={() => setScreen("auth")} />;
      case "auth": return <AuthScreen onComplete={() => setScreen("transport")} />;
      case "transport": return <TransportScreen onSelect={(m) => { setMode(m); setScreen("location"); }} />;
      case "location": return <LocationScreen mode={mode} onBack={() => setScreen("transport")} onConfirm={(p, d) => { setPickup(p); setDrop(d); setScreen("results"); }} />;
      case "results": return <ResultsScreen mode={mode} pickup={pickup} drop={drop} onBack={() => setScreen("location")} onSelect={(ride) => { setSelectedRide(ride); setScreen("confirm"); }} />;
      case "confirm": return <ConfirmScreen ride={selectedRide} pickup={pickup} drop={drop} onBack={() => setScreen("results")} />;
      default: return null;
    }
  };

  return (
    <PhoneFrame>
      <ScreenTransition screenKey={screen}>
        {renderScreen()}
      </ScreenTransition>
    </PhoneFrame>
  );
}
