import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page">
      <div className="card">
        <h1 className="title">BookShare Auth Portal</h1>
        <p className="subtitle">
          Central authentication UI and OAuth challenge handler.
        </p>
        <ul className="info-list">
          <li>
            <Link href="/login">Login</Link>
          </li>
          <li>
            <Link href="/register">Registration</Link>
          </li>
          <li>
            <Link href="/recovery">Password Recovery</Link>
          </li>
          <li>
            <Link href="/verification">Email Verification</Link>
          </li>
          <li>
            <Link href="/setup">Finish Account Setup</Link>
          </li>
          <li>
            <Link href="/settings">Settings / 2FA</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
