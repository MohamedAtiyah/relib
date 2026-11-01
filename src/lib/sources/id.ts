import { createHash } from "node:crypto";

export const sourceId = (doiOrUrl: string) =>
  createHash("sha256").update(doiOrUrl.toLowerCase()).digest("hex").slice(0, 16);
