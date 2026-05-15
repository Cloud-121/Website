"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ---------------- THEME HOOK ----------------
type Theme = "light" | "dark";

const useTheme = () => {
  const getInitialTheme = (): Theme => {
    if (typeof window !== "undefined" && window.localStorage) {
      const storedTheme = window.localStorage.getItem("theme");
      return (storedTheme as Theme) || "light";
    }
    return "light";
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const rawSetTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    const isDark = newTheme === "dark";

    root.classList.remove(isDark ? "light" : "dark");
    root.classList.add(isDark ? "dark" : "light");

    window.localStorage.setItem("theme", newTheme);
  };

  useEffect(() => {
    rawSetTheme(theme);
  }, [theme]);

  return [theme, setTheme] as const;
};

// ---------------- NAVBAR ----------------
type NavbarProps = {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
};

// Shared nav links
const navLinks = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "https://docs.gulfcoastmesh.org" },
  { label: "Mesh Maps", href: "/meshmap" },
  { label: "Live Map", href: "https://analyzer.gulfcoastmesh.org/#/live", external: true },
  { label: "Discord", href: "https://discord.gulfcoastmesh.org", external: true },
  { label: "GitHub", href: "https://github.com/LouisianaMeshCommunity", external: true },
];

const Navbar = ({ theme, setTheme }: NavbarProps) => {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 w-full z-30 bg-[#0b1120] border-b border-blue-900/30">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
        <Link
          href="/"
          className="text-xl font-bold text-white drop-shadow dark:text-gray-100"
        >
          Gulf Mesh
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex space-x-6 items-center text-white dark:text-gray-100 font-medium">
          {navLinks.map(({ label, href, external }) =>
            external ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-300 transition"
              >
                {label}
              </a>
            ) : (
              <a
                key={label}
                href={href}
                className="hover:text-indigo-300 transition"
              >
                {label}
              </a>
            )
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="ml-4 p-2 rounded-full bg-white/20 hover:bg-white/30 dark:bg-gray-700/50 text-white shadow transition-transform duration-300 hover:scale-110"
          >
            {theme === "dark" ? (
              <Image
                src="https://www.svgrepo.com/show/508131/moon.svg"
                alt="Moon"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            ) : (
              <Image
                src="https://www.svgrepo.com/show/535669/sun.svg"
                alt="Sun"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            )}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setNavOpen(!navOpen)}
          aria-label="Toggle navigation"
          className="md:hidden p-2 rounded-lg text-white hover:bg-white/20 transition"
        >
          {navOpen ? (
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {navOpen && (
        <div className="md:hidden bg-[#050B14]/95 border-b border-blue-900/30 text-white px-4 py-3 space-y-2 backdrop-blur-md">
          {navLinks.map(({ label, href, external }) =>
            external ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-indigo-300 transition"
                onClick={() => setNavOpen(false)}
              >
                {label}
              </a>
            ) : (
              <a
                key={label}
                href={href}
                className="block hover:text-indigo-300 transition"
                onClick={() => setNavOpen(false)}
              >
                {label}
              </a>
            )
          )}

          <button
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              setNavOpen(false);
            }}
            className="mt-3 p-2 rounded-lg bg-white/20 hover:bg-white/30"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      )}
    </nav>
  );
};

// --- LINKS PAGE COMPONENT ---
const LinksContent = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050B14] px-6 py-24 sm:py-32 transition-all duration-300">
      <div className="max-w-4xl w-full">
        {/* Main Content */}
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4 drop-shadow-lg uppercase tracking-tight">
            Gulf Coast <span className="text-[#10b981]">Mesh Map</span>
          </h1>
          <p className="text-lg text-gray-300">
            A map powered by the Gulf Coast Mesh.
          </p>
        </header>

        {/* Links Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Explorer Bar */}
          <a
            href="https://explorer.gulfcoastmesh.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#0f172a] rounded-2xl shadow-xl hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-2 border-b-4 border-[#10b981] hover:border-[#34d399]"
          >
            {/* Left side: Title */}
            <div className="flex items-center gap-4 text-left mb-2 sm:mb-0">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                Explorer
              </h2>
            </div>
            {/* Right side: Description */}
            <div className="sm:ml-6 text-left sm:text-right text-gray-300">
              Our Primary Meshcore Network, and map to view live trafic around Coast.
            </div>
          </a>

          {/* Meshview Bar */}
          <a
            href="https://meshview.gulfcoastmesh.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#0f172a] rounded-2xl shadow-xl hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] transition-all duration-300 transform hover:-translate-y-2 border-b-4 border-blue-500 hover:border-blue-400"
          >
            {/* Left side: Title */}
            <div className="flex items-center gap-4 text-left mb-2 sm:mb-0">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                Meshview
              </h2>
            </div>
            {/* Right side: Description */}
            <div className="sm:ml-6 text-left sm:text-right text-gray-300">
              Our Secondary Meshtastic Network Map, to view live trafic in local areas; primarily Louisiana.
            </div>
          </a>
        </div>

        {/* Divider */}
        <div className="my-10 border-t border-white/5"></div>

        {/* How-to Section */}
        <div className="bg-[#0f172a] rounded-3xl shadow-2xl p-8 sm:p-12 border border-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full"></div>
          <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-wide">
            How to Add Your Device to the Map via MQTT for Meshtastic
          </h2>
          <p className="text-gray-300 mb-6">
            If you&apos;re not nearby another node reporting to the map, you can have your device report itself to the map via MQTT.
          </p>
          <ul className="list-disc list-inside space-y-3 text-gray-300">
            <li>Open the Meshtastic app or web client.</li>
            <li className="font-bold text-white">Module Configuration &gt; MQTT</li>
            <ul className="list-disc list-inside ml-5 space-y-2">
              <li>
                MQTT Enabled:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  True
                </code>
              </li>
              <li>
                Encryption Enabled:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  True
                </code>
              </li>
              <li>
                JSON Enabled:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  False
                </code>
              </li>
              <li>
                Map Report Enabled:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  Optional
                </code>
              </li>
              <li>
                Root Topic:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  msh/US/LA
                </code>
              </li>
              <li>
                Server Address:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  mqtt.gulfcoastmesh.org
                </code>
              </li>
              <li>
                Username:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  uplink
                </code>
              </li>
              <li>
                Password:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  uplink
                </code>
              </li>
              <li>
                TLS Enabled:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  False
                </code>
              </li>
            </ul>
            <li className="font-bold text-white mt-4">
              Radio Configuration &gt; Channels &gt; 0 / Primary
            </li>
            <ul className="list-disc list-inside ml-5 mt-2">
              <li>
                MQTT Uplink:{" "}
                <code className="font-mono bg-[#050B14] text-[#10b981] px-2 py-1 rounded">
                  Enabled
                </code>
              </li>
            </ul>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [theme, setTheme] = useTheme();

  return (
    <>
      <Navbar theme={theme} setTheme={setTheme} />
      <LinksContent />
    </>
  );
};

export default App;