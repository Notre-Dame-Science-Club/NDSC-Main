import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Your Account | Notre Dame Science Club",
  description: "How to request deletion of your NDSC account and data.",
  alternates: { canonical: "https://ndscbd.net/delete-account" },
};

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "120px 20px 80px", lineHeight: 1.7 };

export default function DeleteAccountPage() {
  return (
    <div style={wrap}>
      <h1>Delete your NDSC account</h1>
      <p>You can ask us to permanently delete your account and the personal data linked to it.</p>
      <ol>
        <li>
          Send an email to <a href="mailto:contact@ndscbd.net?subject=Account%20deletion%20request">contact@ndscbd.net</a> from
          the email address registered on your account, with the subject &ldquo;Account deletion request&rdquo;.
        </li>
        <li>Include your full name and, if you have one, your college roll, so we can find your account.</li>
        <li>We will verify the request and delete your account within 30 days and confirm by email.</li>
      </ol>
      <h2 style={{ marginTop: 32 }}>What gets deleted</h2>
      <p>
        Your profile, login credentials, registrations and personal submissions are removed. Some records may be kept where needed
        for legal reasons or to preserve club results and certificates already issued (for example, a name on a published
        olympiad result).
      </p>
      <p>See also our <a href="/privacy">Privacy Policy</a>.</p>
    </div>
  );
}
