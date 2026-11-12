import InviteTab from "./components/InviteTab";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import AdminSpace from './pages/AdminSpace.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/room-test" element={<InviteTab room={{ name: "Friday Night Fever", genre: "Disco", mode: "Surround by position", code: "482731" }} phones={["Maya", "Jon", "Leo", "Ana", "Sam", "Kofi"]} onBack={() => console.log("back")} onStartCalibration={() => console.log("calibrate")} />} />
      </Routes>
    </BrowserRouter>
  );
}