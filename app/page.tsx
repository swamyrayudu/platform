"use client";

import React, { useState } from "react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setIsLoading(true);

    // Google sign-in integration
    setTimeout(() => {
      setIsLoading(false);
      alert("Google Sign-In clicked!");
    }, 800);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090d16] text-white">

      {/* Background Glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />

      {/* Header */}
      <header className="relative z-10 flex h-20 items-center justify-between border-b border-slate-800/60 px-6 lg:px-12">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 font-bold shadow-lg shadow-indigo-500/20">
            D
          </div>

          <span className="text-lg font-semibold tracking-tight">
            DSC Preparation
          </span>
        </div>

        {/* Header Links */}
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a
            className="transition-colors hover:text-white"
          >
            Features
          </a>

          <a
            className="transition-colors hover:text-white"
          >
            About
          </a>

          <a
            className="transition-colors hover:text-white"
          >
            Help
          </a>
        </nav>
      </header>

      {/* Main Home */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center px-6 py-12 lg:px-12">

        <div className="grid w-full items-center gap-16 lg:grid-cols-2">

          {/* LEFT SIDE */}
          <div className="max-w-2xl">

            <div className="mb-6 inline-flex items-center rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs text-slate-300 backdrop-blur">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
              AP DSC SGT Preparation Platform
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Prepare smarter.
              <br />

              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Crack DSC with confidence.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Practice syllabus-based questions, take realistic mock tests,
              revise previous papers and understand your performance — all in
              one preparation platform.
            </p>

            {/* Features */}
            <div
              id="features"
              className="mt-10 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-3"
            >
              <Feature
                title="Mock Tests"
                description="Exam-style practice"
              />

              <Feature
                title="PYQs"
                description="Previous papers"
              />

              <Feature
                title="Analytics"
                description="Track performance"
              />

              <Feature
                title="Telugu"
                description="Telugu & English"
              />

              <Feature
                title="Revision"
                description="Focus on weak areas"
              />

              <Feature
                title="AI Support"
                description="Smart preparation"
              />
            </div>
          </div>

          {/* RIGHT SIDE - LOGIN */}
          <div className="flex justify-center lg:justify-end">

            <div className="w-full max-w-md">

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl backdrop-blur-xl sm:p-9">

                {/* Login Header */}
                <div className="mb-8">
                  <p className="text-sm font-medium text-blue-400">
                    GET STARTED
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Welcome 👋
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Sign in to continue your DSC preparation journey.
                  </p>
                </div>

                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white px-4 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M6.54 13.59a5.86 5.86 0 0 1 0-3.18V7.88H3.3a9.75 9.75 0 0 0 0 8.24l3.24-2.53Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.43 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53c.77-2.31 2.92-4.03 5.46-4.03Z"
                      />
                    </svg>
                  )}

                  {isLoading
                    ? "Signing in..."
                    : "Continue with Google"}
                </button>

                {/* Divider */}
                <div className="my-7 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs text-slate-500">
                    Secure authentication
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {/* Small Information */}
                <div className="space-y-3 text-sm text-slate-400">
                  <Info text="Your progress is saved automatically." />
                  <Info text="Access your preparation from any device." />
                  <Info text="Your account is protected with Google authentication." />
                </div>

                {/* Terms */}
                <p className="mt-7 text-center text-[11px] leading-5 text-slate-500">
                  By continuing, you agree to our{" "}
                  <a
                    href="#"
                    className="text-slate-300 underline underline-offset-4 hover:text-white"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="#"
                    className="text-slate-300 underline underline-offset-4 hover:text-white"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom */}
      <footer className="relative z-10 border-t border-slate-800/60 px-6 py-5 text-center text-xs text-slate-500">
        © 2026 DSC Preparation Platform
      </footer>
    </main>
  );
}

/* Feature Component */
function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
      <p className="text-sm font-semibold text-slate-200">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* Info Component */
function Info({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] text-green-400">
        ✓
      </div>

      <span>{text}</span>
    </div>
  );
}