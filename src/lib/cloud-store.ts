const UPLOAD_BUCKET_NAME = "church-uploads";
const SERVER_AUTH_EMAIL =
  process.env.SUPABASE_SERVER_EMAIL?.trim() || "server-admin@ilkwang.internal";

interface SupabaseAuthCache {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

let cachedServerAuth: SupabaseAuthCache | null = null;
let inflightTokenPromise: Promise<string> | null = null;

type SupabaseConfig =
  | {
      readonly mode: "service_role";
      readonly url: string;
      readonly serviceKey: string;
    }
  | {
      readonly mode: "server_user";
      readonly url: string;
      readonly anonKey: string;
      readonly serverSecret: string;
    };

function getSupabaseConfig(): SupabaseConfig | null {
  const rawUrl = process.env.SUPABASE_URL?.trim().replace(/^['"]+|['"]+$/g, "");
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return null;
  }
  const url = rawUrl.replace(/\/+$/, "");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^['"]+|['"]+$/g, "");
  if (serviceKey) {
    return { mode: "service_role", url, serviceKey };
  }

  const anonKey = process.env.SUPABASE_ANON_KEY?.trim().replace(/^['"]+|['"]+$/g, "");
  const serverSecret = process.env.SUPABASE_SERVER_SECRET?.trim().replace(/^['"]+|['"]+$/g, "");
  if (anonKey && serverSecret) {
    return { mode: "server_user", url, anonKey, serverSecret };
  }

  return null;
}

export function isCloudStoreEnabled(): boolean {
  return getSupabaseConfig() !== null;
}

async function resolveSupabaseAuthHeaders(
  cfg: SupabaseConfig
): Promise<{ readonly apikey: string; readonly Authorization: string }> {
  if (cfg.mode === "service_role") {
    return {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
    };
  }

  const now = Date.now();
  if (cachedServerAuth && cachedServerAuth.expiresAtMs - now > 120_000) {
    return {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cachedServerAuth.accessToken}`,
    };
  }

  if (!inflightTokenPromise) {
    inflightTokenPromise = (async () => {
      const response = await fetch(
        `${cfg.url}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: cfg.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: SERVER_AUTH_EMAIL,
            password: cfg.serverSecret,
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `클라우드 서버 인증 실패 (${response.status}): ${detail.slice(0, 200)}`
        );
      }

      const payload = (await response.json()) as {
        readonly access_token?: string;
        readonly expires_in?: number;
      };
      if (!payload.access_token) {
        throw new Error("클라우드 서버 인증 토큰을 발급받지 못했습니다.");
      }

      const ttlSec =
        typeof payload.expires_in === "number" && payload.expires_in > 60
          ? payload.expires_in
          : 3600;
      cachedServerAuth = {
        accessToken: payload.access_token,
        expiresAtMs: Date.now() + ttlSec * 1000,
      };
      return payload.access_token;
    })().finally(() => {
      inflightTokenPromise = null;
    });
  }

  const token = await inflightTokenPromise;
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${token}`,
  };
}

export async function callCloudRpc<T>(functionName: string): Promise<T> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("클라우드 저장소 환경변수가 설정되지 않았습니다.");
  }

  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const response = await fetch(
    `${cfg.url}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `클라우드 함수 호출 실패 (${response.status}): ${detail.slice(0, 200)}`
    );
  }

  return (await response.json()) as T;
}

export async function readCloudJson<T>(
  storeKey: string
): Promise<{ readonly found: boolean; readonly value?: T }> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    return { found: false };
  }

  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const endpoint = `${cfg.url}/rest/v1/app_kv_store?key=eq.${encodeURIComponent(
    storeKey
  )}&select=value`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: authHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `클라우드 저장소 조회 실패 (${response.status}): ${detail.slice(0, 200)}`
    );
  }

  const rows = (await response.json()) as readonly { readonly value: T }[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { found: false };
  }

  return { found: true, value: rows[0].value };
}

export async function writeCloudJson(
  storeKey: string,
  value: unknown
): Promise<void> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    return;
  }

  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const endpoint = `${cfg.url}/rest/v1/app_kv_store?on_conflict=key`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        key: storeKey,
        value,
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `클라우드 저장소 기록 실패 (${response.status}): ${detail.slice(0, 200)}`
    );
  }
}

export async function uploadToCloudStorage(params: {
  readonly bucketFolder: string;
  readonly storedName: string;
  readonly buffer: Buffer;
  readonly contentType: string;
}): Promise<string> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("클라우드 스토리지 환경변수가 설정되지 않았습니다.");
  }

  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const encodedName = encodeURIComponent(params.storedName);
  const objectPath = `${params.bucketFolder}/${encodedName}`;
  const endpoint = `${cfg.url}/storage/v1/object/${UPLOAD_BUCKET_NAME}/${objectPath}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": params.contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(params.buffer),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `클라우드 파일 업로드 실패 (${response.status}): ${detail.slice(0, 200)}`
    );
  }

  return `${cfg.url}/storage/v1/object/public/${UPLOAD_BUCKET_NAME}/${objectPath}`;
}

export async function createSignedCloudUploadUrl(params: {
  readonly bucketFolder: string;
  readonly storedName: string;
}): Promise<{
  readonly signedPutUrl: string;
  readonly publicUrl: string;
}> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("클라우드 스토리지 환경변수가 설정되지 않았습니다.");
  }

  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const encodedName = encodeURIComponent(params.storedName);
  const objectPath = `${params.bucketFolder}/${encodedName}`;
  const signEndpoint = `${cfg.url}/storage/v1/object/upload/sign/${UPLOAD_BUCKET_NAME}/${objectPath}`;

  const response = await fetch(signEndpoint, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `업로드 서명 주소 발급 실패 (${response.status}): ${detail.slice(0, 200)}`
    );
  }

  const signData = (await response.json()) as {
    readonly url?: string;
  };
  if (!signData.url || !signData.url.startsWith("/object/upload/sign/")) {
    throw new Error("유효한 업로드 서명 주소를 발급받지 못했습니다.");
  }

  return {
    signedPutUrl: `${cfg.url}/storage/v1${signData.url}`,
    publicUrl: `${cfg.url}/storage/v1/object/public/${UPLOAD_BUCKET_NAME}/${objectPath}`,
  };
}

export async function readCloudObjectHeadBytes(params: {
  readonly bucketFolder: string;
  readonly storedName: string;
  readonly maxBytes?: number;
}): Promise<Buffer> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("클라우드 스토리지 환경변수가 설정되지 않았습니다.");
  }

  const endByte = Math.max(15, (params.maxBytes ?? 64) - 1);
  const encodedName = encodeURIComponent(params.storedName);
  const objectPath = `${params.bucketFolder}/${encodedName}`;
  const publicUrl = `${cfg.url}/storage/v1/object/public/${UPLOAD_BUCKET_NAME}/${objectPath}`;

  const response = await fetch(publicUrl, {
    method: "GET",
    headers: {
      Range: `bytes=0-${endByte}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`업로드된 파일 확인 실패 (${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function deleteCloudStorageObject(params: {
  readonly bucketFolder: string;
  readonly storedName: string;
}): Promise<void> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    return;
  }
  const authHeaders = await resolveSupabaseAuthHeaders(cfg);
  const encodedName = encodeURIComponent(params.storedName);
  const objectPath = `${params.bucketFolder}/${encodedName}`;
  const endpoint = `${cfg.url}/storage/v1/object/${UPLOAD_BUCKET_NAME}/${objectPath}`;
  await fetch(endpoint, {
    method: "DELETE",
    headers: authHeaders,
  });
}
