import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Screen 3b: Sound control (the host controls the music and every phone's volume).
// Everything is in this one file: no CSS file needed.

// Colors: same as your other pages
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

// Sample phones. Later these will come from the server.
const STARTING_PHONES = [
  { id: 1, name: "Maya", spot: "Front L", volume: 80, muted: false },
  { id: 2, name: "Jon", spot: "Front", volume: 70, muted: false },
  { id: 3, name: "Leo", spot: "Front R", volume: 75, muted: false },
  { id: 4, name: "Ana", spot: "Back L", volume: 90, muted: false },
  { id: 5, name: "Sam", spot: "Back", volume: 85, muted: false },
  { id: 6, name: "Kofi", spot: "Back R", volume: 90, muted: false },
];

export default function SoundControl({
  partyName = "Friday Night Fever",
  vibe = "Disco · Surround by position",
  song = "[SONG TITLE]",
  artist = "[ARTIST]",
}) {
  const navigate = useNavigate();

  const [playing, setPlaying] = useState(true);
  const [masterVolume, setMasterVolume] = useState(70);
  const [phones, setPhones] = useState(STARTING_PHONES);

  // Load the fonts and make the page background black
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&display=swap";
    document.head.appendChild(link);
    document.body.style.margin = "0";
    document.body.style.background = colors.bg;
    return () => link.remove();
  }, []);

  // TODO: these are where your team sends the change to every phone (for example with a WebSocket).
  function changePhoneVolume(id, volume) {
    setPhones((list) => list.map((p) => (p.id === id ? { ...p, volume } : p)));
  }

  function toggleMute(id) {
    setPhones((list) => list.map((p) => (p.id === id ? { ...p, muted: !p.muted } : p)));
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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 20 }}>{partyName}</div>
          <div style={{ fontSize: 13, color: colors.muted }}>{vibe}</div>
        </div>
        <div style={{ width: 44, height: 44 }} />
      </header>

      {/* Tabs */}
      <div style={styles.tabs} role="tablist">
        {/* TODO: change "/room-test" to wherever your team puts the QR & code page */}
        <button role="tab" aria-selected="false" style={styles.tab} onClick={() => navigate("/room-test")}>
          QR &amp; code
        </button>
        <button role="tab" aria-selected="true" style={styles.tabActive}>
          Sound control
        </button>
      </div>

      {/* Now playing */}
      <section style={styles.nowPlaying}>
        <div style={styles.albumArt}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={colors.green}
            strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{song}</div>
          <div style={{ fontSize: 13, color: colors.muted }}>{artist}</div>
        </div>
        <button
          style={styles.playBtn}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 5l12 7-12 7z" />
            </svg>
          )}
        </button>
        <button style={styles.iconBtn} aria-label="Next song">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5 5l10 7-10 7z" />
            <rect x="16" y="5" width="3" height="14" />
          </svg>
        </button>
      </section>

      {/* Master volume */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label htmlFor="master" style={{ fontWeight: 800, fontSize: 18 }}>Master volume</label>
          <div style={{ fontWeight: 800, fontSize: 18, color: colors.green }}>{masterVolume}%</div>
        </div>
        <input
          id="master"
          type="range"
          min="0"
          max="100"
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          style={styles.slider}
        />
      </div>

      {/* Each phone */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={styles.label}>Each phone</div>
        <div style={{ fontSize: 13, color: colors.cyan, fontWeight: 700 }}>All in sync</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {phones.map((p) => (
          <div key={p.id} style={styles.phoneRow}>
            <div style={{ width: 56, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: colors.muted }}>{p.spot}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={p.muted ? 0 : p.volume}
              disabled={p.muted}
              aria-label={`${p.name} volume`}
              onChange={(e) => changePhoneVolume(p.id, Number(e.target.value))}
              style={{ ...styles.slider, flexGrow: 1, minWidth: 0, opacity: p.muted ? 0.35 : 1 }}
            />
            <button
              aria-label={p.muted ? `Unmute ${p.name}` : `Mute ${p.name}`}
              onClick={() => toggleMute(p.id)}
              style={{ ...styles.muteBtn, background: p.muted ? colors.pink : colors.chip, color: p.muted ? "#000" : colors.text }}
            >
              {p.muted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H3v6h3l5 4z" />
                  <path d="M16 9l5 6M21 9l-5 6" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H3v6h3l5 4z" />
                  <path d="M16 9a4 4 0 010 6" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>

      <div style={{ flexGrow: 1 }} />

      {/* Recalibrate */}
      <button style={styles.recalBtn} onClick={() => alert("Recalibrating phones… (connect this to calibration later)")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 11-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        Recalibrate phones
      </button>
    </div>
  );
}

// All the styles, written as JavaScript objects
const tabBase = {
  height: 44,
  borderRadius: 22,
  border: "none",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const styles = {
  page: {
    maxWidth: 430,
    minHeight: "100vh",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "20px 24px 24px",
    background: colors.bg,
    color: colors.text,
    fontFamily: "'Figtree', sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
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
  tabs: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 4,
    background: colors.card,
    borderRadius: 26,
    padding: 4,
  },
  tab: { ...tabBase, background: "transparent", color: colors.text },
  tabActive: { ...tabBase, background: colors.pink, color: "#000" },
  nowPlaying: {
    background: colors.card,
    borderRadius: 18,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: 12,
    background: colors.chip,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  playBtn: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: 24,
    border: "none",
    background: colors.pink,
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(255, 43, 214, 0.5)",
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  slider: {
    width: "100%",
    height: 32,
    accentColor: colors.pink,
    cursor: "pointer",
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 12,
    background: colors.card,
  },
  muteBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
  },
  recalBtn: {
    height: 52,
    borderRadius: 26,
    border: `2px solid ${colors.cyan}`,
    background: "transparent",
    color: colors.cyan,
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
};