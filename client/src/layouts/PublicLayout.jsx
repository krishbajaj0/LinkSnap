import { Outlet, useLocation } from 'react-router';
import Footer from '../components/landing/Footer.jsx';
import Navbar from '../components/landing/Navbar.jsx';
import '../styles/landing.css';

export default function PublicLayout() {
  const { pathname } = useLocation();

  return (
    <div className="app-shell public-layout">
      <Navbar key={pathname} />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
