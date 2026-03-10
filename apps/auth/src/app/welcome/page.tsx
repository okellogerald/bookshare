import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Email verification started</h1>
        <p className="subtitle">
          Check your inbox for the verification code and complete verification to continue.
        </p>
        <div className="footer-links">
          <Link href="/verification">Enter verification code</Link>
          <Link href="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
