"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image"; // Added next/image import

type Theme = "light" | "dark";

// Custom theme hook
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

// Nav links (used for both desktop and mobile)
const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Docs", href: "https://docs.gulfcoastmesh.org" },
  { label: "Mesh Maps", href: "/meshmap" },
  { label: "Live Map", href: "https://analyzer.gulfcoastmesh.org/#/live", external: true },
  { label: "Discord", href: "https://discord.gulfcoastmesh.org", external: true },
  { label: "GitHub", href: "https://github.com/LouisianaMeshCommunity", external: true },
];

const App = () => {
  const [theme, setTheme] = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [navBg, setNavBg] = useState("bg-transparent");
  const [showBanner, setShowBanner] = useState(true);

  // Handle scroll event to change the navbar background
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setNavBg("bg-[#0b1120] shadow-lg");
      } else {
        setNavBg("bg-transparent");
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Updated Icon component using next/image
  const Icon = ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <Image
      src={src}
      alt={alt}
      width={24}
      height={24}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );

  const NavItem = ({ label, href, external, className }: typeof navLinks[number] & { className?: string }) => {
    const baseClasses = `hover:text-indigo-300 transition cursor-pointer ${className || ''}`;
    const handleClick = () => {
      if (href.startsWith('#')) {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }
      setNavOpen(false);
    };

    if (external) {
      return (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClasses}
        >
          {label}
        </a>
      );
    }

    return (
      <a
        key={label}
        href={href}
        className={baseClasses}
        onClick={handleClick}
      >
        {label}
      </a>
    );
  };

  return (
    <>
      {/* Announcement Banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 w-full z-50 bg-indigo-600 text-white px-4 py-2 text-center text-sm sm:text-base font-medium shadow-md flex items-center justify-center gap-2">
          <span className="flex items-center gap-2">
            <span role="img" aria-label="loudspeaker"></span>
            New Meshcore settings! Please{""}
            <a
              href="https://docs.gulfcoastmesh.org/freq-settings/"
              className="underline font-bold hover:text-indigo-100 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              read our docs
            </a>{" "}
            to ensure your repeater works correctly.
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="ml-4 p-1 hover:bg-white/20 rounded-full transition shrink-0"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Navbar - Adjusted top offset based on banner visibility */}
      <nav
        className={`fixed ${showBanner ? 'top-10 sm:top-10' : 'top-0'} left-0 w-full z-40 transition-all duration-300 ${navBg} backdrop-blur-sm`}
      >
        <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
          <a
            href="#home"
            className="text-xl font-bold text-white drop-shadow dark:text-gray-100"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#home')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Gulf Mesh
          </a>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-6 items-center text-white dark:text-gray-100 font-medium">
            {navLinks.map((link) => (
              <NavItem key={link.label} {...link} />
            ))}

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="ml-4 p-2 rounded-full bg-white/20 hover:bg-white/30 dark:bg-gray-700/50 text-white shadow transition-transform duration-300 hover:scale-110 flex items-center justify-center"
            >
              {theme === "dark" ? (
                <Icon
                  className="h-5 w-5"
                  src="https://www.svgrepo.com/show/508131/moon.svg"
                  alt="Moon"
                />
              ) : (
                <Icon
                  className="h-5 w-5"
                  src="https://www.svgrepo.com/show/535669/sun.svg"
                  alt="Sun"
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
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {navOpen && (
          <div className="md:hidden bg-[#050B14]/95 border-b border-blue-900/30 text-white px-4 py-3 space-y-2 backdrop-blur-md">
            {navLinks.map((link) => (
              <NavItem key={link.label} {...link} className="block" />
            ))}

            <button
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setNavOpen(false);
              }}
              className="mt-3 p-2 rounded-lg bg-white/20 hover:bg-white/30 w-full text-left"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div
        id="home"
        className="relative min-h-screen flex flex-col items-center justify-center px-4 bg-[#050B14]"
      >

        <div className="relative z-10 flex flex-col items-center justify-center w-full text-center mt-20 max-w-5xl mx-auto px-4">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white drop-shadow-lg mb-4 uppercase">
            Gulf Coast <span className="text-[#10b981]">Mesh</span>
          </h1>

          <div className="text-[#10b981] font-semibold tracking-widest uppercase text-xs sm:text-sm mb-8 drop-shadow-sm">
            Decentralized / Off-Grid / Community-powered
          </div>

          <p className="text-lg sm:text-xl text-gray-200 mb-10 leading-relaxed max-w-3xl mx-auto">
            A growing group of individuals dedicated to interconnecting Louisiana&apos;s cities and others&apos; along the Gulf Coast with a decentralized, open-source messaging system. Providing a resilient communication channel that works even when infrastructure is damaged.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://docs.gulfcoastmesh.org/"
              className="flex items-center justify-center gap-2 bg-[#10b981] text-black font-bold py-3 px-8 rounded-xl hover:bg-[#34d399] shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all duration-300 transform hover:-translate-y-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Our Network
            </a>

            <a
              href="https://discord.gulfcoastmesh.org"
              className="flex items-center justify-center gap-2 bg-[#059669] text-white font-semibold py-3 px-8 rounded-xl hover:bg-[#047857] shadow-[0_0_15px_rgba(5,150,105,0.4)] hover:shadow-[0_0_25px_rgba(5,150,105,0.6)] transition-all duration-300 transform hover:-translate-y-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Our Discord
            </a>

            <a
              href="https://analyzer.gulfcoastmesh.org/#/live"
              className="flex items-center justify-center gap-2 bg-[#065f46] text-white font-semibold py-3 px-8 rounded-xl hover:bg-[#064e3b] shadow-[0_0_15px_rgba(6,95,70,0.4)] hover:shadow-[0_0_25px_rgba(6,95,70,0.6)] transition-all duration-300 transform hover:-translate-y-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Network Map
            </a>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section id="how-it-works" className="bg-[#050B14] py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-16 tracking-tight">
            How It <span className="text-[#10b981]">Works</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#0f172a] p-8 rounded-3xl border border-blue-500/20 text-left relative overflow-hidden hover:border-[#10b981]/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-7xl font-black text-[#10b981]/10 absolute -top-6 -right-4 select-none">1</div>
              <h3 className="text-2xl font-bold text-white mb-4 tracking-wide relative z-10">Get a Radio</h3>
              <p className="text-gray-300 leading-relaxed relative z-10">
                LoRa mesh devices start around $30-100. Check out our recommended devices to get started.
              </p>
            </div>

            <div className="bg-[#0f172a] p-8 rounded-3xl border border-blue-500/20 text-left relative overflow-hidden hover:border-[#10b981]/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-7xl font-black text-[#10b981]/10 absolute -top-6 -right-4 select-none">2</div>
              <h3 className="text-2xl font-bold text-white mb-4 tracking-wide relative z-10">Install & Configure</h3>
              <p className="text-gray-300 leading-relaxed relative z-10">
                Flash MeshCore firmware and apply our local settings. Just takes about 10 minutes with our setup guide.
              </p>
            </div>

            <div className="bg-[#0f172a] p-8 rounded-3xl border border-blue-500/20 text-left relative overflow-hidden hover:border-[#10b981]/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-7xl font-black text-[#10b981]/10 absolute -top-6 -right-4 select-none">3</div>
              <h3 className="text-2xl font-bold text-white mb-4 tracking-wide relative z-10">Start Messaging</h3>
              <p className="text-gray-300 leading-relaxed relative z-10">
                Connect via Bluetooth to your phone and you&apos;re ready. Works anywhere within mesh range.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="newsletter" className="bg-[#0b1120] py-24 px-6 border-t border-blue-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-8 tracking-tight">
            Stay <span className="text-[#10b981]">Connected</span>
          </h2>
          <a
            href="https://gulfcoastmesh.org/emailsignup"
            className="inline-flex items-center justify-center gap-2 bg-[#10b981] text-black font-bold py-4 px-10 rounded-xl hover:bg-[#34d399] shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all duration-300 transform hover:-translate-y-1 text-lg"
          >
            Sign up for our newsletter
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#050B14] text-gray-400 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10 items-center">
          <div className="order-2 md:order-none text-center md:text-left text-sm flex flex-col items-center md:items-start">
            <p className="font-bold text-white mb-4 uppercase tracking-wider text-xs">Supporters</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              {["ma7", "n5msy", "talwah", "simon", "kyra", "terry", "mike", "rg3120", "Mike Baldwin"].map(name => (
                <span key={name} className="px-3 py-1 bg-[#0f172a] text-[#10b981] rounded-full text-xs font-semibold tracking-wide border border-blue-500/20 shadow-sm hover:border-[#10b981] transition cursor-default">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="order-1 md:order-none flex flex-col items-center gap-3 text-center">
            <span className="text-sm">&copy; {new Date().getFullYear()} Louisiana Mesh Community</span>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <a href="https://github.com/LouisianaMeshCommunity/Website" target="_blank" rel="noopener noreferrer" className="hover:text-white transition" aria-label="GitHub">
                <Icon className="h-6 w-6 invert" src="https://www.svgrepo.com/show/512317/github-142.svg" alt="GitHub" />
              </a>
              <a href="https://discord.gulfcoastmesh.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition" aria-label="Discord">
                <Icon className="h-6 w-6 invert" src="https://www.svgrepo.com/show/473585/discord.svg" alt="Discord" />
              </a>
              <a href="https://ko-fi.com/louisianameshcommunity" target="_blank" rel="noopener noreferrer" className="hover:text-white transition" aria-label="Ko-fi">
                <Icon className="h-6 w-6 invert" src="https://www.svgrepo.com/show/330802/kofi.svg" alt="Ko-fi" />
              </a>
            </div>
          </div>

          <div className="order-3 md:order-none text-center text-sm">
            <p className="font-semibold text-white mb-2">Thank You to Our Partners</p>
            <a href="https://heltec.org/" target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition" aria-label="Heltec Automation">
              {/* Updated Partner Logo using next/image */}
              <Image
                src="https://heltec.org/wp-content/uploads/2021/05/heltec-logo.png"
                alt="Heltec Partner"
                width={140}
                height={40}
                className="h-10 w-auto mx-auto"
                style={{ objectFit: 'contain' }}
              />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default App;