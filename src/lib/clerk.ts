// Without Clerk keys the demo still runs; accounts and /app need them.
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
