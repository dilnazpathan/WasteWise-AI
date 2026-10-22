import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { ApiError, authApi, type AuthUser } from "../services/auth";

type AuthPageProps = {
  onAuthenticated: (token: string, user: AuthUser) => void;
  initialMessage?: string;
};

export default function AuthPage({
  onAuthenticated,
  initialMessage = "",
}: AuthPageProps) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialMessage);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = registering
        ? await authApi.register({ name: name.trim(), email: email.trim(), password })
        : await authApi.login({ email: email.trim(), password });
      onAuthenticated(result.access_token, result.user);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Something unexpected happened. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-form-panel">
          <a className="auth-brand" href="/" aria-label="WasteWise home">
            <span className="brand-mark"><Leaf size={21} strokeWidth={2.4} /></span>
            <span className="brand-name">waste<span>wise</span></span>
          </a>
          <div className="auth-heading">
            <span className="hero-kicker"><Sparkles size={14} /> GOOD TO HAVE YOU HERE</span>
            <h1>{registering ? "Let’s grow good things." : "Welcome back."}</h1>
            <p>{registering ? "Create your store account and keep good food moving." : "Sign in to your fresh little corner of the world."}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {registering && (
              <label className="auth-field">
                <span>Your name</span>
                <input
                  autoComplete="name"
                  maxLength={100}
                  minLength={1}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex Morgan"
                  required
                  value={name}
                />
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@yourstore.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete={registering ? "new-password" : "current-password"}
                maxLength={128}
                minLength={registering ? 12 : 1}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={registering ? "At least 12 characters" : "Your password"}
                required
                type="password"
                value={password}
              />
              {registering && <small>Use at least 12 characters to keep your account safe.</small>}
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="button button-dark auth-submit" disabled={busy} type="submit">
              {busy ? "One moment..." : registering ? "Create your account" : "Sign in"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="auth-switch">
            {registering ? "Already part of WasteWise?" : "New to WasteWise?"}
            <button
              onClick={() => {
                setRegistering(!registering);
                setError("");
              }}
              type="button"
            >
              {registering ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-secure"><ShieldCheck size={15} /> Your password is securely hashed. We never store it as plain text.</div>
        </div>

        <aside className="auth-art">
          <div className="auth-art-decoration" aria-hidden="true">
            <span className="auth-art-sun" />
            <span className="auth-art-leaf auth-art-leaf-one" />
            <span className="auth-art-leaf auth-art-leaf-two" />
            <span className="auth-art-produce auth-art-avocado">🥑</span>
            <span className="auth-art-produce auth-art-orange">🍊</span>
            <span className="auth-art-produce auth-art-lemon">🍋</span>
          </div>
          <div className="auth-art-copy">
            <span className="hero-kicker"><Check size={14} /> A LITTLE LESS WASTE, A LOT MORE GOOD</span>
            <h2>Better plans.<br />Fresher shelves.<br /><em>A brighter tomorrow.</em></h2>
            <p>Small, thoughtful choices add up. Let’s make every fresh thing count.</p>
            <span className="auth-art-note"><Leaf size={15} /> Keep good food moving.</span>
          </div>
        </aside>
      </section>
      <footer className="auth-footer">WasteWise © 2026 <span>·</span> Made with a little more care <span className="footer-heart">♥</span></footer>
    </main>
  );
}
