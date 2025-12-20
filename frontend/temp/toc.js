import { Header } from "./components/bars";
import { Home } from "./pages/home";
import { Signup } from "./pages/auth/signup";
import { Login } from "./pages/auth/login";
import { Dashboard } from "./pages/dashboard";
import { Script } from "./pages/script";
import { NotFound } from "./pages/notfound";
import { CenteredLoader } from "./components/loader";

export const TOC = {
  Header,
  Loader: {
    CenteredLoader,
  },
  Home,
  Signup,
  Login,
  Dashboard,
  Script,
  NotFound,
};
