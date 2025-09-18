import React from "react";
import { Link } from "react-router-dom";

const HomePage = () => {
  const loggedIn = localStorage.getItem("isLoggedIn") === "true";
  return (
    // Main container for the whole page layout
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Header Section */}
      <header className="w-full p-6 text-center">
        <h1 className="text-3xl">
          <Link to="/" className="no-underline text-white font-bold">
            TOC
          </Link>
        </h1>
      </header>

      {/* Main Content: Takes up remaining space and centers its children */}
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        {/* Expanded Explanation Text */}
        <p className="text-xl text-gray-400 mb-10 max-w-2xl">
          A tool to help with story-writing. Break down your scripts, analyze
          character emotions, and visualize your narrative arc like never
          before.
        </p>

        {loggedIn ? (
          <div className="flex gap-5">
            <Link
              to="/dashboard"
              className="py-2 px-5 bg-blue-600 text-white font-semibold rounded-md no-underline shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200"
            >
              Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex gap-5">
            {/* Login Button */}
            <Link
              to="/auth/login"
              className="py-2 px-5 bg-blue-600 text-white font-semibold rounded-md no-underline shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200"
            >
              Login
            </Link>

            {/* Signup Button */}
            <Link
              to="/auth/signup"
              className="py-2 px-5 bg-indigo-600 text-white font-semibold rounded-md no-underline shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition-colors duration-200"
            >
              Signup
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
