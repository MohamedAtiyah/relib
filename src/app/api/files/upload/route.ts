import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { userRoute } from "@/lib/route";
import { MAX_PDF } from "@/lib/files";

// Hands the browser a short-lived token to upload one PDF straight to Blob, under the user's own prefix.
export const POST = userRoute(30, async (req, userId) => {
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`${userId}/`)) throw new Error("Upload path outside the user's folder");
      return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_PDF, addRandomSuffix: true };
    },
  });
  return Response.json(result);
});
