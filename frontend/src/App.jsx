import React, { useEffect, useRef, useState } from "react";
import { useBookingStore } from './stores/bookingStore';
import { useAuthStore } from './stores/authStore';

const transportModes = [
  { id: "cab", label: "Cab", icon: CabIcon, desc: "Doorstep comfort and AC ride" },
  { id: "bike", label: "Bike Taxi", icon: BikeIcon, desc: "Fastest for tight city lanes" },
  { id: "auto", label: "Auto", icon: AutoIcon, desc: "Balanced fare with quick pickup" },
  { id: "metro", label: "Metro", icon: MetroIcon, desc: "Most predictable commute window" }
];

const destinationChips = ["Chennai Airport T1", "T Nagar", "OMR Tech Park", "Guindy"];
const sourceChips = ["Pacifica Aurum 1 Block-B5", "Anna Nagar", "Velachery"];
const laneLabels = ["Cab", "Bike", "Auto", "Metro", "Reliable", "Parallel", "Safe ETA"];

const screens = ["landing", "auth", "transport", "destination", "results"];

// FIX 1: Derive tone class and tag label from a quote item's tag field.
// Previously these were referenced inside quotes.map() but never defined,
// causing a ReferenceError that crashed the results screen.
function getToneClass(tag) {
  if (tag === "BEST") return "best";
  if (tag === "CHEAPEST") return "cheap";
  return "high";
}

function getTagLabel(tag) {
  if (tag === "BEST") return "Best Match";
  if (tag === "CHEAPEST") return "Cheapest";
  if (tag === "PREMIUM") return "Premium";
  return tag;
}

function App() {
  const [screen, setScreen] = useState("landing");
  const [transport, setTransport] = useState("cab");
  const [source, setSource] = useState("Pacifica Aurum 1 Block-B5");
  const [destination, setDestination] = useState("");
  const [selectedRide, setSelectedRide] = useState(null);
  const [booked, setBooked] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // FIX 2: useRef calls moved inside the component where hooks belong.
  // Previously declared at module scope, which violates the Rules of Hooks
  // and throws in strict mode.
  const isProcessing = useRef(false);

  const { otpSent, phone, isAuthenticated, isLoading: isAuthLoading, error: authError, sendOTP, verifyOTP } = useAuthStore();
  const { quotes, isLoading, error, fetchQuotes, createBooking, currentBooking, pollStatus } = useBookingStore();

  useEffect(() => {
    if (quotes && quotes.length > 0) {
      setSelectedRide(quotes[0]);
    } else {
      setSelectedRide(null);
    }
  }, [quotes]);

  // FIX 3: Removed the duplicate useEffect that was registered twice for the
  // same auth redirect logic. One instance is sufficient.
  useEffect(() => {
    if (isAuthenticated && screen === "auth") {
      moveTo("transport");
    }
  }, [isAuthenticated, screen]);

  useEffect(() => {
    let intervalId;
    if (booked && currentBooking?.id) {
      const isTerminalState = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentBooking.state);
      if (!isTerminalState) {
        intervalId = setInterval(() => {
          pollStatus(currentBooking.id);
        }, 5000);
      }
    }
    return () => clearInterval(intervalId);
  }, [booked, currentBooking, pollStatus]);

  function moveTo(next) {
    if (!screens.includes(next)) return;
    if (next === "results") {
      setBooked(false);
    }
    setScreen(next);
  }

  async function findRides() {
    if (!destination.trim()) return;
    setBooked(false);
    setScreen("results");
    await fetchQuotes(source, destination, transport);
  }

  async function bookRide() {
    if (!selectedRide) return;
    const success = await createBooking(source, destination, selectedRide.id);
    if (success) {
      setBooked(true);
    }
  }

  async function handleSendOTP() {
    if (!phoneNumber) return;
    await sendOTP(phoneNumber);
  }

  async function handleVerifyOTP() {
    if (isProcessing.current || isAuthenticated || !otpCode) return;
    isProcessing.current = true;
    try {
      const success = await verifyOTP(otpCode);
      if (success) {
        setOtpCode("");
        moveTo("transport");
      }
    } finally {
      setTimeout(() => { isProcessing.current = false; }, 1000);
    }
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="status-row">
          <span>9:41</span>
          <span>MOVZZ</span>
          <span>5G</span>
        </header>

        {/* LANDING */}
        <section className={`screen landing-screen ${screen === "landing" ? "is-active" : ""}`}>
          <div className="landing-content">
            <div className="landing-topline" />
            <div className="brand-mark">
              <span>MOV</span>
              <span>ZZ</span>
            </div>
            <p className="kicker">Reliability-Orchestrated Mobility</p>
            <h1>Your ride should feel certain before it starts.</h1>
            <p className="copy">
              MOVZZ ranks transport options by completion confidence, dispatch speed, and fair pricing.
            </p>
            <div className="landing-editorial">
              <h3>Why MOVZZ</h3>
              <ul>
                <li>One booking flow across cab, bike taxi, auto, and metro.</li>
                <li>Automatic fallback if a provider fails after confirmation.</li>
                <li>Transparent ranking rationale before you commit to a ride.</li>
              </ul>
            </div>
          </div>

          <div className="landing-footer">
            <div className="moving-lane" aria-hidden="true">
              <div className="moving-lane-inner">
                {[...laneLabels, ...laneLabels].map((label, idx) => (
                  <span key={`${label}-${idx}`}>{label}</span>
                ))}
              </div>
            </div>
            <div className="landing-cards">
              <article>
                <strong>94%</strong>
                <span>Avg reliability score</span>
              </article>
              <article>
                <strong>3x</strong>
                <span>Parallel provider checks</span>
              </article>
              <article>
                <strong>&lt;30s</strong>
                <span>Recovery re-attempt cycle</span>
              </article>
            </div>
            <div className="action-dock">
              <button className="btn primary" onClick={() => moveTo(isAuthenticated ? "transport" : "auth")}>
                Start Ride
              </button>
            </div>
          </div>
        </section>

        {/* AUTH */}
        <section className={`screen ${screen === "auth" ? "is-active" : ""}`}>
          <p className="kicker">Authentication</p>
          <h2>Sign in to MOVZZ</h2>
          <p className="copy">Secure access with enterprise-grade onboarding flow.</p>

          <div className="auth-flow" style={{ marginTop: '2rem' }}>
            {authError && <p style={{ color: 'var(--warn)', marginBottom: '1rem' }}>{authError}</p>}

            {!otpSent ? (
              <>
                <label className="field">
                  <span>Phone Number</span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </label>
                <div className="action-dock">
                  <button
                    className="btn primary"
                    onClick={handleSendOTP}
                    disabled={isAuthLoading || phoneNumber.length < 10}
                  >
                    {isAuthLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* FIX 4: Was useAuthStore.getState().phone — a direct store read
                    that bypasses React reactivity. Now reads from the destructured
                    `phone` value at the top of the component, which re-renders
                    correctly when the store updates. */}
                <p style={{ marginBottom: '1rem', fontSize: '14px' }}>
                  OTP sent to {phone}
                </p>
                <label className="field">
                  <span>Enter 6-digit OTP</span>
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </label>
                <div className="action-dock">
                  <button
                    className="btn primary"
                    onClick={handleVerifyOTP}
                    disabled={isAuthLoading || isAuthenticated || otpCode.length < 6}
                  >
                    {isAuthLoading ? "Verifying..." : isAuthenticated ? "Verified!" : "Verify & Continue"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* TRANSPORT */}
        <section className={`screen ${screen === "transport" ? "is-active" : ""}`}>
          <p className="kicker">Step 1</p>
          <h2>Select transport mode</h2>
          <p className="copy">Vertical selection with lane-specific orchestration intelligence.</p>

          <div className="mode-list">
            {transportModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  className={`mode-item ${transport === mode.id ? "selected" : ""}`}
                  onClick={() => setTransport(mode.id)}
                >
                  <span className="mode-icon"><Icon /></span>
                  <span className="mode-copy">
                    <strong>{mode.label}</strong>
                    <small>{mode.desc}</small>
                  </span>
                  <span className="mode-check" aria-hidden="true">{transport === mode.id ? "●" : "○"}</span>
                </button>
              );
            })}
          </div>

          <div className="action-dock">
            <button className="btn primary" onClick={() => moveTo("destination")}>Next</button>
          </div>
        </section>

        {/* DESTINATION */}
        <section className={`screen ${screen === "destination" ? "is-active" : ""}`}>
          <p className="kicker">Step 2</p>
          <h2>Set pickup and destination</h2>
          <p className="copy">MOVZZ will return ranked options with reliability rationale.</p>

          <div className="route-editor">
            <div className="route-pin source" />
            <div className="route-pin destination" />
            <div className="route-line" />
            <div className="route-fields">
              <label className="field compact">
                <span>Pickup</span>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Current location"
                />
              </label>
              <label className="field compact">
                <span>Drop location</span>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Terminal 1, Chennai Airport"
                />
              </label>
            </div>
          </div>

          <div className="chips">
            {sourceChips.map((chip) => (
              <button key={chip} className="chip" onClick={() => setSource(chip)}>{chip}</button>
            ))}
          </div>
          <div className="chips">
            {destinationChips.map((chip) => (
              <button key={chip} className="chip" onClick={() => setDestination(chip)}>{chip}</button>
            ))}
          </div>

          <div className="action-dock">
            <button className="btn primary" onClick={findRides} disabled={!destination.trim()}>
              Find Reliable Rides
            </button>
          </div>
        </section>

        {/* RESULTS */}
        <section className={`screen ${screen === "results" ? "is-active" : ""}`}>
          <p className="kicker">Top Ranked Options</p>
          <h2>Choose and book instantly</h2>

          <div className="route-summary">
            <div className="route-pin source" />
            <div className="route-pin destination" />
            <div className="route-line" />
            <div className="route-text">
              <p>{source || "Current location"}</p>
              <p>{destination || "Drop location"}</p>
            </div>
          </div>

          <div className="result-list">
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--ink-700)" }}>
                <p style={{ fontWeight: "bold" }}>Querying The Brain...</p>
                <small>Scoring providers for reliability</small>
              </div>
            ) : error ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--warn)" }}>
                <p>{error}</p>
                <button className="btn secondary" onClick={findRides}>Try Again</button>
              </div>
            ) : quotes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--ink-700)" }}>
                <p>No rides available right now.</p>
                <button className="btn secondary" onClick={() => setScreen("destination")}>Go Back</button>
              </div>
            ) : (
              // FIX 1 APPLIED: toneClass and tagLabel are now derived per item
              // using the helper functions defined above the component.
              quotes.map((item) => {
                const active = selectedRide?.id === item.id;
                const toneClass = getToneClass(item.tag);
                const tagLabel = getTagLabel(item.tag);

                return (
                  <button
                    className={`result-card ${toneClass} ${active ? "active" : ""}`}
                    key={item.id}
                    onClick={() => setSelectedRide(item)}
                  >
                    {item.tag && <span className="tag">{tagLabel}</span>}
                    <div className="result-head">
                      <h3>
                        {item.type || item.line}
                        {item.provider ? ` via ${item.provider}` : ''}
                      </h3>
                      <strong>₹{item.price}</strong>
                    </div>
                    <p className="result-meta">
                      {item.reliability
                        ? `Reliability ${item.reliability}%`
                        : `${item.stations} stations`
                      } • ETA {item.eta} min
                    </p>
                    {item.score && (
                      <p className="reason">Match Score: {item.score}/100</p>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="action-dock">
            <button
              className="btn primary"
              onClick={bookRide}
              disabled={!selectedRide || booked}
            >
              {booked
                ? "Ride Booked"
                : `Book ${selectedRide?.type || selectedRide?.line || "Ride"} Now`
              }
            </button>
          </div>

          {booked && (
            <div className="booking-panel">
              <p>Status: {currentBooking?.state || 'SEARCHING'}</p>
              <h4>{selectedRide?.type || selectedRide?.line} is on the way</h4>
              <span>
                {currentBooking?.providerId ? 'Driver assigned' : 'Looking for reliable providers...'}
                {' '}• ETA {selectedRide?.eta} min • Live tracking enabled
              </span>
            </div>
          )}
        </section>

      </section>
    </main>
  );
}

function CabIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Cab icon">
      <path d="M5 11h14v6H5z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 11l1.7-3h6.6l1.7 3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BikeIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Bike icon">
      <circle cx="7" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 17l4-6h3l3 6M11 11l2-2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Auto icon">
      <path d="M4.5 11h15v6h-15z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 11V8.5h6.5l2 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MetroIcon() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Metro icon">
      <rect x="6" y="4" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 8h2M13 8h2M9 12h6M10 18l-1.8 2M14 18l1.8 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default App;