import React, { useEffect, useState, useCallback, useRef } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { io as ioClient } from 'socket.io-client';

const API = 'http://localhost:3000/api/v1/admin';

function authHeaders() {
  const token = localStorage.getItem('movzz_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(), ...opts });
  return res.json();
}

// ─── State badge colours ─────────────────────────────────
const STATE_COLORS = {
  SEARCHING:          { bg: '#dbeafe', color: '#1e40af' },
  CONFIRMED:          { bg: '#d1fae5', color: '#065f46' },
  IN_PROGRESS:        { bg: '#fef3c7', color: '#92400e' },
  COMPLETED:          { bg: '#e0f2fe', color: '#0369a1' },
  FAILED:             { bg: '#fee2e2', color: '#991b1b' },
  CANCELLED:          { bg: '#f3f4f6', color: '#374151' },
  MANUAL_ESCALATION:  { bg: '#fce7f3', color: '#9d174d' },
};

function StateBadge({ state }) {
  const s = STATE_COLORS[state] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      {state}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────
function StatCard({ label, value, highlight }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--line)',
      borderRadius: 12, padding: '16px 20px', minWidth: 140,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: highlight ? 'var(--brand)' : 'var(--ink-900)' }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-700)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────
function Table({ cols, rows, empty = 'No records.' }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--ink-700)', fontSize: 13, padding: '12px 0' }}>{empty}</p>;
  }
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Btn ─────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', small, disabled }) {
  const styles = {
    primary:   { background: 'var(--brand)', color: '#fff', border: 'none' },
    danger:    { background: '#dc2626', color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: 'var(--ink-900)', border: '1px solid var(--line)' },
    ok:        { background: 'var(--ok)', color: '#fff', border: 'none' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: small ? '4px 12px' : '8px 18px',
        borderRadius: 8, fontWeight: 700, fontSize: small ? 12 : 13,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// ─── Dashboard tab ───────────────────────────────────────
function DashboardTab({ refreshSignal }) {
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const reload = useCallback(() => {
    Promise.all([apiFetch('/dashboard'), apiFetch('/metrics')]).then(([d, m]) => {
      if (d.success) setData(d.data);
      if (m.success) setMetrics(m.data);
      setLoading(false);
      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload]);

  // Re-fetch immediately when a Socket.IO push arrives
  useEffect(() => { if (refreshSignal) reload(); }, [refreshSignal, reload]);

  if (loading) return <p style={{ color: 'var(--ink-700)' }}>Loading dashboard…</p>;
  if (!data) return <p style={{ color: '#dc2626' }}>Failed to load. Check your auth token.</p>;

  const ov = data.overview;

  return (
    <div>
      <Section
        title="Overview"
        action={
          lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--ink-700)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-IN', { timeStyle: 'short' })} · auto 15s
            </span>
          )
        }
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total Users" value={ov.totalUsers} />
          <StatCard label="Total Bookings" value={ov.totalBookings} />
          <StatCard label="Today's Bookings" value={ov.todayBookings} highlight />
          <StatCard label="Active Providers" value={ov.activeProviders} />
          <StatCard label="Escalated" value={ov.escalatedBookings} highlight={ov.escalatedBookings > 0} />
        </div>
      </Section>

      <Section title="Booking States">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(data.bookingsByState || {}).map(([state, count]) => (
            <div key={state} style={{
              background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
              padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <StateBadge state={state} />
              <span style={{ fontWeight: 800, fontSize: 20 }}>{count}</span>
            </div>
          ))}
        </div>
      </Section>

      {metrics && (
        <Section title="This Week">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Total Rides" value={metrics.week.totalBookings} />
            <StatCard label="Revenue" value={`₹${metrics.week.totalRevenueRupees?.toLocaleString('en-IN')}`} highlight />
            <StatCard label="Commission" value={`₹${metrics.week.totalCommissionRupees?.toLocaleString('en-IN')}`} />
            <StatCard label="Failure Rate" value={metrics.week.failureRate} />
          </div>
        </Section>
      )}

      <Section title="Recent Bookings">
        <Table
          cols={[
            { key: 'id',       label: 'Booking ID', render: r => <code style={{ fontSize: 11 }}>{r.id.slice(0, 8)}…</code> },
            { key: 'pickup',   label: 'Pickup', render: r => <span style={{ maxWidth: 140, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pickup}</span> },
            { key: 'dropoff',  label: 'Drop', render: r => <span style={{ maxWidth: 140, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dropoff}</span> },
            { key: 'state',    label: 'State', render: r => <StateBadge state={r.state} /> },
            { key: 'fare',     label: 'Fare', render: r => r.fareEstimate ? `₹${(r.fareEstimate / 100).toFixed(0)}` : '—' },
            { key: 'provider', label: 'Provider', render: r => r.provider?.name || '—' },
            { key: 'created',  label: 'Created', render: r => new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) },
          ]}
          rows={data.recentBookings}
        />
      </Section>
    </div>
  );
}

// ─── Escalations tab ─────────────────────────────────────
function EscalationsTab({ refreshSignal }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [providerId, setProviderId] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    apiFetch('/bookings/escalated').then(d => {
      if (d.success) setBookings(d.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload]);

  useEffect(() => { if (refreshSignal) reload(); }, [refreshSignal, reload]);

  async function confirm(bookingId) {
    if (!providerId.trim()) return alert('Enter a provider ID first.');
    setConfirming(bookingId);
    const res = await apiFetch(`/bookings/${bookingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ providerId: providerId.trim() }),
    });
    setConfirming(null);
    if (res.success) { setProviderId(''); reload(); }
    else alert(res.error || 'Failed to confirm booking.');
  }

  if (loading) return <p style={{ color: 'var(--ink-700)' }}>Loading escalations…</p>;

  return (
    <div>
      <Section title={`Manual Escalation Queue (${bookings.length})`}>
        {bookings.length === 0 ? (
          <p style={{ color: 'var(--ok)', fontWeight: 700 }}>No escalated bookings. All clear!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bookings.map(b => (
              <div key={b.id} style={{
                background: '#fff', border: '1px solid #fce7f3', borderRadius: 12, padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{b.id}</code>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>{b.pickup} → {b.dropoff}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-700)', marginTop: 2 }}>
                      User: {b.user?.phone || b.userPhone} · Created: {new Date(b.createdAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <StateBadge state={b.state} />
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-700)', marginBottom: 12 }}>
                  Recovery attempts: {b.recoveryAttempts || 0} · Fare: ₹{((b.fareEstimate || 0) / 100).toFixed(0)}
                </div>

                {b.attempts?.length > 0 && (
                  <div style={{ fontSize: 12, marginBottom: 12 }}>
                    <strong>Tried providers:</strong>{' '}
                    {b.attempts.map(a => a.provider?.name || a.providerId?.slice(0, 8)).join(', ')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Provider ID"
                    value={confirming === b.id ? providerId : ''}
                    onChange={e => { setProviderId(e.target.value); setConfirming(b.id); }}
                    style={{
                      border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px',
                      fontSize: 12, fontFamily: 'inherit', flex: 1,
                    }}
                  />
                  <Btn
                    variant="ok"
                    small
                    disabled={confirming === b.id && !providerId.trim()}
                    onClick={() => confirm(b.id)}
                  >
                    Assign & Confirm
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Providers tab ───────────────────────────────────────
function ProvidersTab() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', type: 'INDIVIDUAL_DRIVER', vehicleModel: '', vehiclePlate: '' });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    apiFetch('/providers').then(d => {
      if (d.success) setProviders(d.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function toggleActive(p) {
    setActioning(p.id);
    const path = p.active ? `/providers/${p.id}/pause` : `/providers/${p.id}/resume`;
    const body = p.active ? JSON.stringify({ reason: 'Paused by admin', durationHours: 24 }) : undefined;
    const res = await apiFetch(path, { method: 'POST', body });
    setActioning(null);
    if (res.success) reload();
    else alert(res.error || 'Action failed.');
  }

  async function createProvider() {
    if (!form.name || !form.phone) return alert('Name and phone are required.');
    setSaving(true);
    const res = await apiFetch('/providers', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) { setShowForm(false); setForm({ name: '', phone: '', type: 'INDIVIDUAL_DRIVER', vehicleModel: '', vehiclePlate: '' }); reload(); }
    else alert(res.error || 'Failed to create provider.');
  }

  const field = (label, key, opts = {}) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 600, color: 'var(--ink-700)' }}>{label}</span>
      <input
        {...opts}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit' }}
      />
    </label>
  );

  return (
    <div>
      <Section
        title={`Providers (${providers.length})`}
        action={
          <Btn onClick={() => setShowForm(s => !s)} variant={showForm ? 'secondary' : 'primary'} small>
            {showForm ? 'Cancel' : '+ Add Provider'}
          </Btn>
        }
      >
        {showForm && (
          <div style={{
            background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
            padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>New Provider</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('Name', 'name', { placeholder: 'Rajan Kumar' })}
              {field('Phone', 'phone', { placeholder: '+919876543210', type: 'tel' })}
              {field('Vehicle Model', 'vehicleModel', { placeholder: 'Maruti Dzire' })}
              {field('Vehicle Plate', 'vehiclePlate', { placeholder: 'TN-01-AB-1234' })}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Type</span>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit' }}
              >
                <option value="INDIVIDUAL_DRIVER">Individual Driver</option>
                <option value="FLEET_OPERATOR">Fleet Operator</option>
              </select>
            </label>
            <Btn onClick={createProvider} disabled={saving}>{saving ? 'Saving…' : 'Create Provider'}</Btn>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--ink-700)' }}>Loading providers…</p>
        ) : (
          <Table
            empty="No providers yet. Add one above."
            cols={[
              { key: 'name',        label: 'Name' },
              { key: 'phone',       label: 'Phone' },
              { key: 'vehiclePlate',label: 'Plate' },
              { key: 'reliability', label: 'Reliability', render: r => `${((r.reliability || 0) * 100).toFixed(0)}%` },
              { key: 'totalRides',  label: 'Total Rides' },
              { key: 'rating',      label: 'Rating', render: r => r.rating ? `${r.rating}/5` : '—' },
              { key: 'active',      label: 'Status', render: r => (
                <span style={{ color: r.active ? 'var(--ok)' : '#dc2626', fontWeight: 700, fontSize: 12 }}>
                  {r.active ? 'ACTIVE' : 'PAUSED'}
                </span>
              )},
              { key: 'action', label: '', render: r => (
                <Btn
                  variant={r.active ? 'danger' : 'ok'}
                  small
                  disabled={actioning === r.id}
                  onClick={() => toggleActive(r)}
                >
                  {actioning === r.id ? '…' : r.active ? 'Pause' : 'Resume'}
                </Btn>
              )},
            ]}
            rows={providers}
          />
        )}
      </Section>
    </div>
  );
}

// ─── Metrics tab ─────────────────────────────────────────
function MetricsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/metrics').then(d => {
      if (d.success) setData(d.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p style={{ color: 'var(--ink-700)' }}>Loading metrics…</p>;
  if (!data) return <p style={{ color: '#dc2626' }}>Failed to load metrics.</p>;

  return (
    <div>
      <Section title="Today's Bookings by State">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(data.today || {}).map(([state, count]) => (
            <div key={state} style={{
              background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
              padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <StateBadge state={state} />
              <span style={{ fontWeight: 800, fontSize: 22 }}>{count}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="This Week">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total Rides" value={data.week.totalBookings} />
          <StatCard label="Revenue" value={`₹${data.week.totalRevenueRupees?.toLocaleString('en-IN')}`} highlight />
          <StatCard label="Commission" value={`₹${data.week.totalCommissionRupees?.toLocaleString('en-IN')}`} />
          <StatCard label="Failure Rate" value={data.week.failureRate} />
        </div>
      </Section>

      <Section title="Top Providers by Reliability">
        <Table
          empty="No provider ride data yet."
          cols={[
            { key: 'name',            label: 'Name' },
            { key: 'reliability',     label: 'Reliability', render: r => `${((r.reliability || 0) * 100).toFixed(0)}%` },
            { key: 'totalRides',      label: 'Total Rides' },
            { key: 'successfulRides', label: 'Successful' },
            { key: 'rating',          label: 'Rating', render: r => r.rating ? `${r.rating}/5` : '—' },
          ]}
          rows={data.topProviders}
        />
      </Section>
    </div>
  );
}

// ─── Live Map tab ─────────────────────────────────────────
const MAP_MARKER_COLORS = {
  SEARCHING:         '#1e63c9',
  CONFIRMED:         '#0f8c67',
  IN_PROGRESS:       '#f97316',
  MANUAL_ESCALATION: '#9d174d',
};

function LiveMapTab() {
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  const [viewport, setViewport] = useState({
    longitude: 80.2707, latitude: 13.0827, zoom: 11,
  });

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/bookings/active');
      if (res.success) setBookings(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const mappable = bookings.filter(b => b.pickupLat && b.pickupLng);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Bookings</h2>
        <span style={{ color: 'var(--ink-700)', fontSize: 13 }}>
          {loading ? 'Loading…' : `${mappable.length} with coordinates · auto-refresh 10s`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(MAP_MARKER_COLORS).map(([state, color]) => (
          <span key={state} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', border: '2px solid white', boxShadow: '0 0 0 1px ' + color }} />
            {state.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      <div style={{ borderRadius: 12, overflow: 'hidden', height: 520, border: '1px solid var(--line)' }}>
        {MAPBOX_TOKEN ? (
          <Map
            longitude={viewport.longitude}
            latitude={viewport.latitude}
            zoom={viewport.zoom}
            onMove={e => setViewport(e.viewState)}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            {mappable.map(b => (
              <Marker
                key={b.id}
                longitude={b.pickupLng}
                latitude={b.pickupLat}
                onClick={e => { e.originalEvent.stopPropagation(); setSelected(b); }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: MAP_MARKER_COLORS[b.state] || '#888',
                  border: '2px solid white',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }} />
              </Marker>
            ))}

            {selected && (
              <Popup
                longitude={selected.pickupLng}
                latitude={selected.pickupLat}
                onClose={() => setSelected(null)}
                closeOnClick={false}
                anchor="bottom"
              >
                <div style={{ fontSize: 12, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: MAP_MARKER_COLORS[selected.state] }}>
                    {selected.state.replace(/_/g, ' ')}
                  </div>
                  <div><b>From:</b> {selected.pickup || 'Unknown'}</div>
                  <div><b>To:</b> {selected.dropoff || 'Unknown'}</div>
                  <div><b>Mode:</b> {selected.transportMode}</div>
                  {selected.user && <div><b>User:</b> {selected.user.name || selected.user.phone}</div>}
                  {selected.provider && <div><b>Provider:</b> {selected.provider.name}</div>}
                </div>
              </Popup>
            )}
          </Map>
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#1a1a2e', color: '#94a3b8', fontSize: 13 }}>
            Set VITE_MAPBOX_TOKEN in frontend/.env to enable the map.
          </div>
        )}
      </div>

      {!loading && bookings.length > 0 && mappable.length < bookings.length && (
        <p style={{ fontSize: 12, color: 'var(--ink-700)', marginTop: 10 }}>
          {bookings.length - mappable.length} booking(s) have no coordinates and are not shown on the map.
        </p>
      )}
    </div>
  );
}

// ─── Main Admin App ──────────────────────────────────────
const TABS = [
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'map',         label: 'Live Map' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'providers',   label: 'Providers' },
  { id: 'metrics',     label: 'Metrics' },
];

const SOCKET_URL = 'http://localhost:3000';

export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const [token, setToken] = useState(localStorage.getItem('movzz_token') || '');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const socketRef = useRef(null);

  // Connect to Socket.IO and join the admin room for instant push updates
  useEffect(() => {
    if (!token) return;
    const socket = ioClient(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join:admin'));
    socket.on('booking:state_changed', () => setRefreshSignal(n => n + 1));
    return () => socket.disconnect();
  }, [token]);

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: 'var(--bg)', fontFamily: 'inherit',
      }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 32, width: 360 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>MOVZZ Admin</h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--ink-700)' }}>
            Paste your JWT token to continue.
          </p>
          <textarea
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            rows={4}
            style={{
              width: '100%', border: '1px solid var(--line)', borderRadius: 8,
              padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
            }}
            onChange={e => setToken(e.target.value)}
          />
          <Btn
            onClick={() => { localStorage.setItem('movzz_token', token); setToken(token); }}
            disabled={!token.trim()}
          >
            Enter Admin Panel
          </Btn>
          <p style={{ fontSize: 12, color: 'var(--ink-700)', marginTop: 12 }}>
            Sign in on the main app first, then copy the token from DevTools → Application → Local Storage → <code>movzz_token</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'inherit' }}>
      {/* Header */}
      <header style={{
        background: 'var(--ink-900)', color: '#fff',
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.04em' }}>
          MOV<span style={{ color: '#60a5fa' }}>ZZ</span>
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 10, opacity: 0.6 }}>Admin Panel</span>
        </div>
        <button
          onClick={() => { localStorage.removeItem('movzz_token'); setToken(''); }}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sign out
        </button>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        {/* Sidebar */}
        <nav style={{
          width: 200, background: '#fff', borderRight: '1px solid var(--line)',
          padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          position: 'sticky', top: 52, height: 'calc(100vh - 52px)', overflowY: 'auto',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? 'var(--brand)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--ink-700)',
                border: 'none', borderRadius: 8, padding: '9px 14px',
                textAlign: 'left', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <a
              href="/"
              style={{ fontSize: 12, color: 'var(--ink-700)', textDecoration: 'none', display: 'block', padding: '8px 14px' }}
            >
              ← Back to App
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 800 }}>
            {TABS.find(t => t.id === tab)?.label}
          </h1>

          {tab === 'dashboard'   && <DashboardTab refreshSignal={refreshSignal} />}
          {tab === 'map'         && <LiveMapTab />}
          {tab === 'escalations' && <EscalationsTab refreshSignal={refreshSignal} />}
          {tab === 'providers'   && <ProvidersTab />}
          {tab === 'metrics'     && <MetricsTab />}
        </main>
      </div>
    </div>
  );
}
