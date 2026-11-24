import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import InviteTab from "../components/InviteTab";
import { api } from "../services/api";

// Turn the backend's short mode names into the words shown on screen
const MODE_NAMES = { surround: "Surround by position", mono: "Everyone plays it all" };

export default function Room() {
  // The room code from the address bar: /room/482731 gives code = "482731"
  const { code } = useParams();
  const navigate = useNavigate();

  // What the backend told us about the room (null until it answers)
  const [state, setState] = useState(null);
  const [error, setError] = useState("");

  // When the page opens: ask the backend for the room now, then every 2 seconds
  useEffect(() => {
    const load = () =>
      api(`/rooms/${code}`).then(setState, (e) => setError(e.message));
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer); // stop asking when we leave the page
  }, [code]);

  if (error) return <p>Error: {error}</p>;
  if (!state) return <p>Loading...</p>;

  const party = state.party || {};

  return (
    <InviteTab
      room={{
        name: party.name,
        genre: party.vibe,
        mode: MODE_NAMES[party.mode],
        code: state.code,
      }}
      phones={state.devices.map((d) => d.name)}
      onBack={() => navigate("/create")}
      onStartCalibration={() => alert("Calibration comes later!")}
    />
  );
}