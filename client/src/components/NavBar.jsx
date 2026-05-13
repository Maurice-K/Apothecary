import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import "./NavBar.css";

export default function NavBar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-tabs">
        <NavLink to="/" end className={({ isActive }) => `nav-tab${isActive ? " nav-tab--active" : ""}`}>
          The Nutritionist
        </NavLink>
        <NavLink to="/herb-search" className={({ isActive }) => `nav-tab${isActive ? " nav-tab--active" : ""}`}>
          Herb Search
        </NavLink>
      </div>
      {user && (
        <div className="navbar-aux">
          <Link to="/my-recipes" className="nav-aux-link">My Recipes</Link>
          <button className="nav-aux-button" onClick={signOut}>Log Out</button>
        </div>
      )}
    </nav>
  );
}
