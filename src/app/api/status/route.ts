import { modelMode } from "@/lib/model";

export const dynamic = "force-dynamic";
export const GET = () => Response.json({ mode: modelMode() });
