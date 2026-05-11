import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import "./NavBar.css";

export default function NavBar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="nav-link">Search</Link>
      {user ? (
        <>
          <Link to="/my-recipes" className="nav-link">My Recipes</Link>
          <button className="nav-button" onClick={signOut}>Log Out</button>
        </>
      ) : (
        <>
          <Link to="/login" className="nav-link">Log In</Link>
          <Link to="/signup" className="nav-link">Sign Up</Link>
        </>
      )}
    </nav>
  );
}
