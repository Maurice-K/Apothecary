import { NavLink } from "react-router-dom";
import "./NavBar.css";

export default function NavBar() {
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
    </nav>
  );
}
