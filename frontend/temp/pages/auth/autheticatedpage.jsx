import { useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { CenteredLoader } from "../../components/loader";

/**
 * A wrapper component that protects its children.
 * If the user is not logged in, it redirects to /auth/login.
 */
const AuthenticatedPage = ({ children }) => {
  const navigate = useNavigate();
  const { isLoggedIn, user, isLoading } = useOutletContext();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate("/auth/login", { replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  if (isLoading) {
    return <CenteredLoader />;
  }

  return isLoggedIn && user ? children : null;
};

export default AuthenticatedPage;
