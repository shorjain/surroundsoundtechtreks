import { useLocation, useNavigate } from "react-router-dom";
import InviteTab from "../components/InviteTab";

export default function Invite() {
    const location = useLocation();
    const navigate = useNavigate();
    const room = location.state?.room;

    if (!room) {
        return <p>No room yet. Create one first.</p>;
    }
    return <InviteTab room={room} onBack={() => navigate("/admin")} />;
}

