import React from "react";
import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-200 font-sans text-center px-4">
      <h1 className="text-6xl font-bold text-white mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-300 mb-2">
        Page Not Found
      </h2>
      <p className="text-gray-400 mb-8">
        Sorry, the page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="py-2 px-5 bg-blue-600 text-white font-semibold rounded-md no-underline shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors duration-200"
      >
        Go to Home
      </Link>
    </div>
  );
};

export default NotFoundPage;
