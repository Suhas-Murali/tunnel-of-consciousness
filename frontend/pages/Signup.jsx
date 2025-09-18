import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api";

const SignupPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (isLoggedIn === "true") {
      navigate("/dashboard");
    }
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!username) {
      newErrors.username = "Username is required";
    }
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Email address is invalid";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        await register(username, password, email);
        localStorage.setItem("isLoggedIn", "true");
        navigate("/dashboard");
      } catch (err) {
        const message =
          err.response?.data?.error || "Registration failed. Please try again.";
        setErrors({ form: message });
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="w-full p-6 text-center">
        <h1 className="text-3xl">
          <Link to="/" className="no-underline text-white font-bold">
            TOC
          </Link>
        </h1>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="bg-gray-800 shadow-2xl rounded-lg px-8 pt-6 pb-8 mb-4"
          >
            <h2 className="text-2xl font-bold text-center text-white mb-6">
              Create Account
            </h2>

            <div className="mb-4">
              <label
                className="block text-gray-400 text-sm font-bold mb-2 text-left"
                htmlFor="username"
              >
                Username
              </label>
              <input
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:ring-2 ${
                  errors.username
                    ? "border-red-500 focus:ring-red-500"
                    : "focus:ring-blue-500"
                }`}
                id="username"
                name="username"
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {errors.username && (
                <p className="text-red-500 text-xs italic mt-2">
                  {errors.username}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-400 text-sm font-bold mb-2 text-left"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:ring-2 ${
                  errors.email
                    ? "border-red-500 focus:ring-red-500"
                    : "focus:ring-blue-500"
                }`}
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && (
                <p className="text-red-500 text-xs italic mt-2">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-400 text-sm font-bold mb-2 text-left"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:ring-2 ${
                  errors.password
                    ? "border-red-500 focus:ring-red-500"
                    : "focus:ring-blue-500"
                }`}
                id="password"
                name="password"
                type="password"
                placeholder="******************"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && (
                <p className="text-red-500 text-xs italic mt-2">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label
                className="block text-gray-400 text-sm font-bold mb-2 text-left"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 mb-3 leading-tight focus:outline-none focus:ring-2 ${
                  errors.confirmPassword
                    ? "border-red-500 focus:ring-red-500"
                    : "focus:ring-blue-500"
                }`}
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="******************"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs italic">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {errors.form && (
              <p className="text-red-500 text-xs italic text-center mb-4">
                {errors.form}
              </p>
            )}

            <div className="flex items-center justify-between">
              <button
                className="w-full py-2 px-5 bg-blue-600 text-white font-semibold rounded-md no-underline shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </form>
          <p className="text-center text-gray-500 text-sm">
            Already have an account?{" "}
            <Link
              to="/auth/login"
              className="font-bold text-indigo-400 hover:text-indigo-300"
            >
              Log In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
