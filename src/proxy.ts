import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk";

const isPrivate = createRouteMatcher(["/app(.*)", "/api/sync(.*)", "/api/files(.*)"]);

export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isPrivate(req)) await auth.protect();
    })
  : (req: NextRequest) => (isPrivate(req) ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next());

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
