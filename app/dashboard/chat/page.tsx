// ============================================================================
// Member Dashboard Chat Page
// Entry point for member chat access
// ============================================================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChatPortal from "./ChatPortal";

async function getMemberSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("member_session");

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    return session.member;
  } catch {
    return null;
  }
}

export default async function MemberChatPage() {
  const member = await getMemberSession();

  if (!member) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <ChatPortal memberId={member.id} />
    </div>
  );
}
