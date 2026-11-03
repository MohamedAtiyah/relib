import { caller } from "@/lib/route";

export const dynamic = "force-dynamic";
export const GET = async () => Response.json({ mode: (await caller()).mode });
