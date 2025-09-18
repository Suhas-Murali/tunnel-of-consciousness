import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProfile, allScripts, logout } from "../api";

const CreateScriptModal = ({
  isOpen,
  onClose,
  onCreate,
  existingScriptNames,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Script name cannot be empty.");
      return;
    }
    if (existingScriptNames.includes(name.trim())) {
      setError("A script with this name already exists.");
      return;
    }
    onCreate(name.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Create New Script
        </h2>
        <form onSubmit={handleSubmit}>
          <label
            className="block text-gray-400 text-sm font-bold mb-2 text-left"
            htmlFor="scriptName"
          >
            Script Name
          </label>
          <input
            id="scriptName"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            className={`shadow appearance-none border rounded w-full py-2 px-3 bg-gray-700 border-gray-600 text-gray-200 leading-tight focus:outline-none focus:ring-2 ${
              error
                ? "border-red-500 focus:ring-red-500"
                : "focus:ring-blue-500"
            }`}
            placeholder="My Awesome Story"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs italic mt-2">{error}</p>}
          <div className="flex items-center justify-end gap-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-5 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("isLoggedIn") !== "true") {
      navigate("/auth/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [profileResponse, scriptsResponse] = await Promise.all([
          getProfile(),
          allScripts(),
        ]);
        setUser(profileResponse.data.user);
        setScripts(scriptsResponse.data.scripts);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        localStorage.removeItem("isLoggedIn");
        navigate("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Server logout failed, logging out client-side.", error);
    } finally {
      localStorage.removeItem("isLoggedIn");
      navigate("/auth/login");
    }
  };

  const handleCreateScript = (name) => {
    navigate(`/script/${name}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200">
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="flex items-center justify-between p-6 bg-gray-800 shadow-md">
        <h1 className="text-3xl">
          <Link to="/dashboard" className="no-underline text-white font-bold">
            TOC
          </Link>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="py-2 px-4 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Your Scripts</h2>
        <div className="bg-gray-800 rounded-lg shadow-xl">
          {scripts.length > 0 ? (
            <ul>
              {scripts.map((scriptName, index) => (
                <li
                  key={index}
                  className="border-t border-gray-700 last:border-b-0"
                >
                  <Link
                    to={`/script/${scriptName}`}
                    className="block p-4 hover:bg-gray-700 transition-colors duration-200"
                  >
                    {scriptName}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-gray-400">
              You haven't created any scripts yet.
            </p>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white rounded-full h-14 w-14 flex items-center justify-center text-3xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mx-auto"
            aria-label="Create new script"
          >
            +
          </button>
        </div>
      </main>

      <CreateScriptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateScript}
        existingScriptNames={scripts}
      />
    </div>
  );
};

export default DashboardPage;
