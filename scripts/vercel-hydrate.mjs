import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const sentinel = path.join(process.cwd(), "src", "app", "layout.tsx");
try {
  await fs.access(sentinel);
  process.exit(0);
} catch {
  // Hydrate source tree on Vercel build container
}

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
const serverSecret = process.env.SUPABASE_SERVER_SECRET?.trim();
const serverEmail =
  process.env.SUPABASE_SERVER_EMAIL?.trim() || "server-admin@ilkwang.internal";

if (!supabaseUrl || !anonKey || !serverSecret) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVER_SECRET during prebuild hydration.");
}

const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: serverEmail,
    password: serverSecret,
  }),
});
if (!authRes.ok) {
  throw new Error(`Hydration auth failed (${authRes.status})`);
}
const { access_token: token } = await authRes.json();

const kvRes = await fetch(
  `${supabaseUrl}/rest/v1/app_kv_store?key=eq._vercel_source_bundle&select=value`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  }
);
if (!kvRes.ok) {
  throw new Error(`Hydration bundle fetch failed (${kvRes.status})`);
}
const rows = await kvRes.json();
const bundle = rows?.[0]?.value;
if (!bundle?.gzipB64 || !bundle?.sha256) {
  throw new Error("Hydration bundle row missing or malformed.");
}

const compressed = Buffer.from(bundle.gzipB64, "base64");
const actualSha = crypto.createHash("sha256").update(compressed).digest("hex");
if (actualSha !== bundle.sha256) {
  throw new Error(`Bundle SHA-256 mismatch: expected ${bundle.sha256}, got ${actualSha}`);
}

const decompressed = zlib.gunzipSync(compressed).toString("utf8");
const files = JSON.parse(decompressed);

for (const entry of files) {
  const rel = String(entry.file);
  if (!rel || rel.startsWith("/") || rel.includes("..")) {
    throw new Error(`Unsafe bundle path rejected: ${rel}`);
  }
  const dest = path.join(process.cwd(), rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(entry.b64, "base64"));
}

console.log(`Hydrated ${files.length} project files cleanly.`);
