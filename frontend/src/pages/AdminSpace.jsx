import { useEffect } from "react";

// Screen 1: Admin space (what the host sees after logging in).
// Everything is in this one file: no CSS file needed.

// Colors: change them here and the whole screen updates
const colors = {
  bg: "#000000",
  card: "#181818",
  chip: "#282828",
  border: "#2E2E2E",
  text: "#FFFFFF",
  muted: "#B3B3B3",
  pink: "#FF2BD6",
  cyan: "#00F0FF",
  green: "#39FF14",
};

export default function AdminSpace({
  // The party that's happening right now. Set this to null when there isn't one.
  liveParty = {
    name: "Friday Night Fever",
    phones: 6,
    calibrated: 5,
    volume: 70,
    song: "[SONG TITLE]",
    artist: "[ARTIST]",
  },
  pastParties = [
    { id: 1, name: "Dorm Roller Disco", date: "[DATE]", phones: 12 },
    { id: 2, name: "Study Break Funk", date: "[DATE]", phones: 5 },
  ],
  onAccount = () => {},
  onCreateParty = () => {},
  onInvite = () => {},
  onSoundControls = () => {},
  onHostAgain = (party) => {},
}) {
  // Load the fonts, the pulsing-dot animation, and make the page background black
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Monoton&family=Figtree:wght@400;500;700;800&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent =
      "@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(0,240,255,.7)}100%{box-shadow:0 0 0 10px rgba(0,240,255,0)}}";
    document.head.appendChild(style);

    document.body.style.margin = "0";
    document.body.style.background = colors.bg;
    return () => {
      link.remove();
      style.remove();
    };
  }, []);

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <header style={styles.header}>
        <div style={styles.logo}>[APP NAME]</div>
        <button style={styles.iconBtn} aria-label="Account" onClick={onAccount}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
        </button>
      </header>

      {/* Title */}
      <div>
        <div style={styles.label}>Admin space</div>
        <h1 style={styles.title}>Ready to light up the floor?</h1>
      </div>

      {/* Live party card (only shows if a party is happening) */}
      {liveParty && (
        <section style={styles.liveCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={styles.liveDot} />
            <div style={{ ...styles.label, color: colors.cyan, fontSize: 13 }}>Live now</div>
          </div>

          <div style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 24 }}>
            {liveParty.name}
          </div>

          <div style={styles.statsGrid}>
            <Stat value={liveParty.phones} label="phones" />
            <Stat value={`${liveParty.calibrated}/${liveParty.phones}`} label="calibrated" />
            <Stat value={`${liveParty.volume}%`} label="volume" />
          </div>

          <div style={{ fontSize: 14, color: colors.muted }}>
            Now playing: {liveParty.song} · {liveParty.artist}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.outlineBtn} onClick={onInvite}>Invite</button>
            <button style={styles.cyanBtn} onClick={onSoundControls}>Sound controls</button>
          </div>
        </section>
      )}

      {/* Big create button */}
      <button style={styles.createBtn} onClick={onCreateParty}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create party room
      </button>

      {/* Past parties */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={styles.label}>Past parties</div>
        {pastParties.length === 0 && (
          <div style={{ fontSize: 14, color: colors.muted }}>No parties yet. Throw your first one!</div>
        )}
        {pastParties.map((party) => (
          <div key={party.id} style={styles.pastRow}>
            <div>
              <div style={{ fontWeight: 700 }}>{party.name}</div>
              <div style={{ fontSize: 13, color: colors.muted }}>
                {party.date} · {party.phones} phones
              </div>
            </div>
            <button style={styles.hostAgainBtn} onClick={() => onHostAgain(party)}>
              Host again
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

// One of the three little number boxes in the live card
function Stat({ value, label }) {
  return (
    <div style={styles.stat}>
      <div style={{ fontWeight: 800, fontSize: 22, color: colors.green }}>{value}</div>
      <div style={{ fontSize: 12, color: colors.muted }}>{label}</div>
    </div>
  );
}

// All the styles, written as JavaScript objects
const styles = {
  page: {
    maxWidth: 430,
    minHeight: "100vh",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "20px 24px 28px",
    background: colors.bg,
    color: colors.text,
    fontFamily: "'Figtree', sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: "'Monoton', cursive",
    fontSize: 22,
    color: colors.pink,
    letterSpacing: 1,
    textShadow: "0 0 14px rgba(255, 43, 214, 0.85)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    border: `2px solid ${colors.border}`,
    background: colors.card,
    color: colors.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  title: {
    margin: "4px 0 0",
    fontWeight: 800,
    letterSpacing: -0.5,
    fontSize: 32,
    lineHeight: 1.1,
  },
  liveCard: {
    background: colors.card,
    border: `2px solid ${colors.cyan}`,
    boxShadow: "0 0 22px rgba(0, 240, 255, 0.3)",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: colors.cyan,
    animation: "livePulse 1.4s infinite",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  stat: {
    background: colors.bg,
    borderRadius: 12,
    padding: 10,
    textAlign: "center",
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    border: `2px solid ${colors.border}`,
    background: "transparent",
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  cyanBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    border: "none",
    background: colors.cyan,
    color: "#000",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  createBtn: {
    height: 64,
    borderRadius: 32,
    border: "none",
    background: colors.pink,
    color: "#000",
    fontFamily: "inherit",
    fontWeight: 800,
    letterSpacing: -0.5,
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxShadow: "0 0 28px rgba(255, 43, 214, 0.55)",
    cursor: "pointer",
  },
  pastRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderRadius: 14,
    border: `2px solid ${colors.border}`,
  },
  hostAgainBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 22,
    border: "none",
    background: colors.chip,
    color: colors.text,
    fontFamily: "inherit",
    fontWeight: 700,
    cursor: "pointer",
  },
};