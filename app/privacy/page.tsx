import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Notre Dame Science Club",
  description: "How Notre Dame Science Club (NDSC) collects, uses and protects your information on ndscbd.net and the NDSC app.",
  alternates: { canonical: "https://ndscbd.net/privacy" },
};

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "120px 20px 80px", lineHeight: 1.7 };
const h2: React.CSSProperties = { marginTop: 32, marginBottom: 8, fontSize: "1.25rem" };

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: October 2026</em></p>
      <p>
        This policy explains how Notre Dame Science Club (&ldquo;NDSC&rdquo;, &ldquo;we&rdquo;) handles information when you use
        our website (ndscbd.net) and the NDSC Android app, which shows the same website inside an app.
      </p>

      <h2 style={h2}>Information we collect</h2>
      <p>Only what you give us when you register or use features:</p>
      <ul>
        <li>Account details: name, email address, phone number, password (stored hashed, never in plain text).</li>
        <li>Profile details: institution, college roll, batch, profile photo, and similar information you choose to add.</li>
        <li>Activity data: olympiad and event registrations, submissions, survey responses, messages sent through the member portal.</li>
        <li>Basic technical data: device/browser type and logs needed to keep the service secure and working.</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <ul>
        <li>To create and manage your account and membership.</li>
        <li>To run events, olympiads, certificates and club activities.</li>
        <li>To contact you about your registrations, notices and account (for example verification or password reset).</li>
        <li>To keep the platform secure and fix problems.</li>
      </ul>
      <p>We do not sell your personal information, and we do not show third-party ads.</p>

      <h2 style={h2}>Where data is stored and who processes it</h2>
      <p>
        Account and activity data is stored in a Supabase database. The website is hosted on Vercel, and uploaded files are stored
        on our own storage server. These providers process data only to run the service for us.
      </p>

      <h2 style={h2}>Sharing</h2>
      <p>
        Your information is visible only to NDSC administrators and organizers who need it to run the club. Some profile
        information (for example name or photo) may appear to other members where a feature is designed to show it, such as the
        executives page or leaderboards. We may disclose information if required by law.
      </p>

      <h2 style={h2}>Security</h2>
      <p>We use HTTPS and access controls to protect your data. No online service is perfectly secure, so please use a strong password.</p>

      <h2 style={h2}>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can ask us to delete your account and data at any time &mdash; see{" "}
        <a href="/delete-account">how to delete your account</a>.
      </p>

      <h2 style={h2}>Children</h2>
      <p>
        NDSC is a student club. Students under 18 may use the service for club activities; if you are a parent or guardian and want
        information removed, contact us.
      </p>

      <h2 style={h2}>Changes</h2>
      <p>We may update this policy. The date above shows the latest version.</p>

      <h2 style={h2}>Contact</h2>
      <p>
        Notre Dame Science Club, Notre Dame College, Toyenbee Circular Rd, Dhaka 1000, Bangladesh<br />
        Email: <a href="mailto:contact@ndscbd.net">contact@ndscbd.net</a>
      </p>
    </div>
  );
}
