import InviteTab from "./components/InviteTab";
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import AdminSpace from './pages/AdminSpace.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import Host from './pages/Host.jsx';
import Join from './pages/Join.jsx';
import ModelTesting from './pages/ModelTesting.jsx';
import Room from './pages/Room.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav><Link to="/host">Host</Link> | <Link to="/join">Join</Link> | <Link to="/model-testing">Model testing</Link></nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminSpace />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/room-test" element={<InviteTab room={{ name: "Friday Night Fever", genre: "Disco", mode: "Surround by position", code: "482731" }} phones={["Maya", "Jon", "Leo", "Ana", "Sam", "Kofi"]} onBack={() => console.log("back")} onStartCalibration={() => console.log("calibrate")} />} />
        <Route path="/host" element={<Host />} />
        <Route path="/join" element={<Join />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/model-testing" element={<ModelTesting />} />
      </Routes>
    </BrowserRouter>
  );
}
