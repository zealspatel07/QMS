// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

const USERNAME_REGEX =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[@_])[A-Za-z0-9@_]{4,100}$/;

export default function Login() {
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  // LOGIN SUBMIT (requires username + password)


  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setErrorMessage("Please enter username and password.");
      return;
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setErrorMessage(
        "Username must contain 1 capital letter, 1 number, and @ or _"
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: trimmedUsername,
        password,
      };

      const res = await api.login(payload);

      if (!res || !res.token) {
        setErrorMessage("Invalid username or password.");
        return;
      }

      const serverUser = res.user
        ? {
          id: res.user.id,
          username: res.user.username,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
        }
        : undefined;



      await login(res.token, serverUser);

      // 🚀 IMPORTANT: Always go to root
      navigate("/", { replace: true });

      //const role = res.user?.role;

      //if (role === "admin") navigate("/admin", { replace: true });
      //else if (role === "sales") navigate("/sales", { replace: true });
      //else if (role === "viewer") navigate("/viewer", { replace: true });
      //else navigate("/dashboard", { replace: true });

    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMessage("Login failed — please try again.");
    } finally {
      setLoading(false);
      setShowPassword(false);
    }
  }


  return (
    <div className="min-h-screen flex bg-white">
      {/* LEFT PANEL */}
      <aside className="hidden md:flex w-1/2 relative flex-col justify-center overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg,#f46a5e 0%, #d246b0 38%, #3a1c7a 100%)" }}
        />
        <div className="absolute top-8 left-8 z-10">
          <div className="w-44 h-20 bg-white/12 rounded-md shadow-sm overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="Prayosha Automation logo" className="object-contain w-full h-full p-2" />
          </div>
        </div>
        <div className="z-10 px-16">
          <div className="max-w-xl">
            <h1 className="text-5xl leading-tight font-extrabold text-white">
              Quotation <span className="text-yellow-300">Management</span> System
            </h1>
            <p className="mt-6 text-lg text-white/90">
              Streamline your quotation workflow — produce accurate quotes faster, send PDFs instantly,
              and close more deals with less admin.
            </p>
            <ul className="mt-8 text-sm space-y-3 list-inside list-disc text-white/85">
              <li>Create &amp; manage quotations</li>
              <li>Generate branded PDF exports</li>
              <li>Send direct emails to customers</li>
            </ul>
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ border: "1px solid rgba(15,23,42,0.04)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* LEFT SIDE INSIDE CARD */}
              <div className="hidden md:flex flex-col items-start justify-center p-10">
                <img src="/logo.png" alt="Prayosha Automation logo" className="w-40 h-20 object-contain" />
                <p className="mt-6 text-sm text-slate-500 max-w-xs">
                  Secure access to your quotations, customer data, and sales reports.
                  Authorized users only.
                </p>
              </div>

              {/* LOGIN FORM */}
              <div className="p-10">
                <h2 className="text-2xl font-semibold text-[#03206B]">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1 mb-6">
                  Enter your credentials to access your account
                </p>

                <form onSubmit={handleLogin} noValidate>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="login_name" className="block text-sm font-medium text-slate-700">Username</label>
                      <input
                        id="login_name"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="mt-2 block w-full rounded-lg border border-slate-200 px-4 py-3"
                      />
                    </div>



                    <div>
                      <label htmlFor="login_password" className="block text-sm font-medium text-slate-700">
                        Password
                      </label>

                      <div className="relative mt-2">
                        <input
                          id="login_password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="block w-full rounded-lg border border-slate-200 px-4 py-3 pr-20"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            // Eye-off icon
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17.94 17.94A10.94 10.94 0 0112 20c-5.05 0-9.29-3.11-11-8 0.53-1.48 1.33-2.83 2.33-4" />
                              <path d="M6.06 6.06A10.94 10.94 0 0112 4c5.05 0 9.29 3.11 11 8a10.77 10.77 0 01-4.21 5.06" />
                              <path d="M14.12 14.12a3 3 0 01-4.24-4.24" />
                              <path d="M1 1l22 22" />
                            </svg>
                          ) : (
                            // Eye icon
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-3 rounded-lg text-white ${loading ? "bg-[#F46A5E]/60" : "bg-[#F46A5E] hover:brightness-95"}`}
                    >
                      {loading ? "Signing in…" : "Sign in"}
                    </button>


                  </div>
                </form>

                <div className="mt-6 text-center text-xs text-slate-400">
                  © {new Date().getFullYear()} Prayosha Automation — All rights reserved
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400 hidden sm:block">
            Secure connection • 2-step verification available in Settings
          </div>
        </div>
      </main>

      {/* ===================== REGISTER MODAL ===================== */}

    </div>
  );
}
