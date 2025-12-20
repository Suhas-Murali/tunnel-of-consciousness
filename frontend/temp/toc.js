import { Header } from "./components/bars";
import { Home } from "./pages/home";
import { Signup } from "./pages/auth/signup";
import { Login } from "./pages/auth/login";
import { Dashboard } from "./pages/dashboard";
import { Script } from "./pages/script";
import { NotFound } from "./pages/notfound";
import { CenteredLoader } from "./components/loader";
import AuthenticatedPage from "./pages/auth/autheticatedpage";

export const TOC = {
  Header,
  Loader: {
    CenteredLoader,
  },
  AuthenticatedPage,
  Home,
  Signup,
  Login,
  Dashboard,
  Script,
  NotFound,
};
