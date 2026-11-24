import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
// Screen 2: Create party room (the host sets up a new party).
// Everything is in this one file: no CSS file needed.

// Colors: same as AdminSpace.jsx
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

const VIBES = ["Disco", "Funk", "House", "Throwback"];

const SOUND_MODES = [
  {
    id: "surround",
    title: "Surround by position",
    desc: "Each phone plays its part based on where it is in the room.",
  },
  {
    id: "mono",
    title: "Everyone plays it all",
    desc: "Every phone plays the full song, in sync.",
  },
];

export default function CreateRoom() {
  const navigate = useNavigate();

  // What the host has picked so far
  const [partyName, setPartyName] = useState("");
  const [vibe, setVibe] = useState("Disco");
  const [mode, setMode] = useState("surround");
  const [maxPhones, setMaxPhones] = useState(20);

  const canCreate = partyName.trim().length > 0;

  // Load the fonts and make the page background black
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Monoton&family=Figtree:wght@400;500;700;800&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.background = colors.bg;
    return () => link.remove();
  }, []);

async function handleCreate() {
    if (!canCreate) return;
    const newParty = { name: partyName.trim(), vibe, mode, maxPhones };
    
    try {
      // requests the backend to make a room, (it runs the python function)
      const room  = await api("/rooms", { method: "POST" });
      // the backend resposnds with the room code which we have to save
      localStorage.setItem(`host:${room.code}`, room.hostToken);
      navigate(`/room/${room.code}`);
    }
    catch (error) {
      alert(`Failed to create the room. Please try again. ${error.message}`);
    }
}

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <header style={styles.header}>
        <button style={styles.iconBtn} aria-label="Back to admin space" onClick={() => navigate("/admin")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={styles.logo}>[APP NAME]</div>
        <div style={{ width: 44, height: 44 }} />
      </header>

      {/* Title with disco ball */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <DiscoBall />
        <div>
          <h1 style={styles.title}>Create party room</h1>
          <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 15 }}>
            Guests join with your code or QR next.
          </p>
        </div>
      </div>

      {/* Party name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor="partyName" style={styles.label}>Party name</label>
        <input
          id="partyName"
          value={partyName}
          onChange={(e) => setPartyName(e.target.value)}
          placeholder="e.g. Friday Night Fever"
          maxLength={40}
          style={styles.input}
        />
      </div>

      {/* Vibe chips */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={styles.label}>Pick the vibe</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {VIBES.map((v) => (
            <button
              key={v}
              onClick={() => setVibe(v)}
              aria-pressed={vibe === v}
              style={vibe === v ? styles.chipOn : styles.chipOff}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Sound mode cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={styles.label}>Sound mode</div>
        {SOUND_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            style={mode === m.id ? styles.modeOn : styles.modeOff}
          >
            <span style={{ display: "block", fontWeight: 800, fontSize: 18, color: colors.text }}>
              {m.title}
            </span>
            <span style={{ display: "block", marginTop: 4, fontSize: 14, color: colors.muted, lineHeight: 1.35 }}>
              {m.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Max phones counter */}
      <div style={styles.counterRow}>
        <div>
          <div style={{ fontWeight: 700 }}>Max phones</div>
          <div style={{ fontSize: 13, color: colors.muted }}>Room locks when full</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            aria-label="Fewer phones"
            onClick={() => setMaxPhones((n) => Math.max(2, n - 1))}
            style={styles.counterBtn}
          >
            −
          </button>
          <div style={{ fontWeight: 800, fontSize: 22, color: colors.green, minWidth: 28, textAlign: "center" }}>
            {maxPhones}
          </div>
          <button
            aria-label="More phones"
            onClick={() => setMaxPhones((n) => Math.min(50, n + 1))}
            style={styles.counterBtn}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ flexGrow: 1 }} />

      {/* Big button (faded until a party name is typed) */}
      <button
        onClick={handleCreate}
        disabled={!canCreate}
        style={{ ...styles.createBtn, opacity: canCreate ? 1 : 0.4, cursor: canCreate ? "pointer" : "not-allowed" }}
      >
        Open the room
      </button>
    </div>
  );
}

// The little disco ball next to the title
function DiscoBall() {
  return (
    <svg width="60" height="64" viewBox="0 0 56 60" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="28" y1="0" x2="28" y2="10" stroke={colors.muted} strokeWidth="2" />
      <circle cx="28" cy="34" r="22" fill={colors.chip} stroke={colors.green} strokeWidth="2" />
      <g stroke={colors.green} strokeOpacity="0.55" strokeWidth="1" fill="none">
        <ellipse cx="28" cy="34" rx="22" ry="8" />
        <ellipse cx="28" cy="34" rx="22" ry="16" />
        <ellipse cx="28" cy="34" rx="8" ry="22" />
        <ellipse cx="28" cy="34" rx="16" ry="22" />
        <line x1="6" y1="34" x2="50" y2="34" />
        <line x1="28" y1="12" x2="28" y2="56" />
      </g>
      <rect x="14" y="22" width="6" height="6" fill={colors.cyan} />
      <rect x="32" y="38" width="6" height="6" fill={colors.pink} />
      <rect x="34" y="20" width="4" height="4" fill="#FFFFFF" />
    </svg>
  );
}

// All the styles, written as JavaScript objects
const chipBase = {
  height: 44,
  padding: "0 18px",
  borderRadius: 22,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const modeBase = {
  textAlign: "left",
  padding: "12px 16px",
  borderRadius: 14,
  fontFamily: "inherit",
  cursor: "pointer",
};

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
    background: "transparent",
    color: colors.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontWeight: 800,
    letterSpacing: -0.5,
    fontSize: 32,
    lineHeight: 1.05,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  input: {
    height: 54,
    boxSizing: "border-box",
    borderRadius: 14,
    border: `2px solid ${colors.border}`,
    background: colors.card,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 18,
    padding: "0 16px",
    outlineColor: colors.cyan,
  },
  chipOn: { ...chipBase, border: `2px solid ${colors.cyan}`, background: colors.cyan, color: "#000" },
  chipOff: { ...chipBase, border: `2px solid ${colors.border}`, background: "transparent", color: colors.text },
  modeOn: {
    ...modeBase,
    border: `2px solid ${colors.pink}`,
    background: "#2A0A26",
    boxShadow: "0 0 22px rgba(255, 43, 214, 0.35)",
  },
  modeOff: { ...modeBase, border: `2px solid ${colors.border}`, background: colors.card },
  counterRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderRadius: 14,
    border: `2px solid ${colors.border}`,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    border: "none",
    background: colors.chip,
    color: colors.text,
    fontSize: 22,
    cursor: "pointer",
  },
  createBtn: {
    height: 60,
    borderRadius: 30,
    border: "none",
    background: colors.pink,
    color: "#000",
    fontFamily: "inherit",
    fontWeight: 800,
    letterSpacing: -0.5,
    fontSize: 22,
    boxShadow: "0 0 28px rgba(255, 43, 214, 0.55)",
  },
};