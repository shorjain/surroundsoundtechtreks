import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./InviteTab.css";

// Turns "482731" into "482 731"
const formatCode = (code) => `${code.slice(0, 3)} ${code.slice(3)}`;

export default function InviteTab({
  room,
  phones = [],
  onBack,
  onStartCalibration,
  onTabChange,
  activeTab = "invite",
}) {
  const [copied, setCopied] = useState(false);

  // Change "/join" to whatever route your guest Home page reads the code from
  const joinUrl = `${window.location.origin}/join?code=${room.code}`;
  const displayUrl = window.location.host;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Could not copy invite link:", err);
    }
  };

  return (
    <div className="invite">
      <header className="invite__header">
        <button className="invite__back" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="invite__title">
          <h1>{room.name}</h1>
          <p>{room.genre} · {room.mode}</p>
        </div>
      </header>

      <div className="invite__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "invite"}
          className={activeTab === "invite" ? "is-active" : ""}
          onClick={() => onTabChange?.("invite")}
        >
          QR &amp; code
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "sound"}
          className={activeTab === "sound" ? "is-active" : ""}
          onClick={() => onTabChange?.("sound")}
        >
          Sound control
        </button>
      </div>

      <section className="invite__card">
        <span className="invite__label">Party code</span>
        <div className="invite__code" aria-label={`Party code ${room.code.split("").join(" ")}`}>
          {formatCode(room.code)}
        </div>

        <div className="invite__qr">
          <QRCodeSVG value={joinUrl} size={256} level="M" marginSize={0} style={{ width: "100%", height: "auto" }} />
        </div>

        <p className="invite__url">
          Scan or go to <strong>{displayUrl}</strong>
        </p>

        <button className="invite__copy" onClick={copyLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </section>

      <section className="invite__joined">
        <h2>
          {phones.length} {phones.length === 1 ? "phone" : "phones"} joined
        </h2>
        <ul>
          {phones.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <button className="invite__cta" onClick={onStartCalibration}>
        Start calibration
      </button>
    </div>
  );
}