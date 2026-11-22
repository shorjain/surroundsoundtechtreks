import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import AdminSpace from './pages/AdminSpace.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminSpace />} />
        <Route path="/create" element={<CreateRoom />} />
      </Routes>
    </BrowserRouter>
  );
}