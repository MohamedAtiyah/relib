import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { Workspace } from "@/components/Workspace";

export default async function AppPage() {
  if (!clerkEnabled) redirect("/");
  const { userId } = await auth.protect();
  return <Workspace userId={userId} />;
}
