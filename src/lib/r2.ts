import { AwsClient } from "aws4fetch";

// Cloudflare R2 through its S3 API. Private bucket: the browser only ever sees short-lived presigned URLs.
const env = () => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2 is not configured");
  return { account: R2_ACCOUNT_ID, bucket: R2_BUCKET, client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }) };
};

const objectUrl = (account: string, bucket: string, key: string) =>
  new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);

export const r2Ready = () => Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

export async function presign(key: string, method: "GET" | "PUT", seconds = 600) {
  const { account, bucket, client } = env();
  const url = objectUrl(account, bucket, key);
  url.searchParams.set("X-Amz-Expires", String(seconds));
  return (await client.sign(new Request(url, { method }), { aws: { signQuery: true } })).url;
}

export async function getObject(key: string) {
  const { account, bucket, client } = env();
  return client.fetch(objectUrl(account, bucket, key));
}

export async function deleteObject(key: string) {
  const { account, bucket, client } = env();
  const res = await client.fetch(objectUrl(account, bucket, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${res.status}`);
}
