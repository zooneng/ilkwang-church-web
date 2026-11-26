import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isCloudStoreEnabled,
  readCloudJson,
  writeCloudJson,
} from "@/lib/cloud-store";
import type { InquiryCategory, InquiryItem } from "@/types/site-content";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const INQUIRIES_FILE = path.join(DATA_DIRECTORY, "inquiries.json");
const INQUIRIES_CLOUD_KEY = "inquiries";

let inquiriesLockQueue: Promise<void> = Promise.resolve();

async function withInquiriesLock<T>(task: () => Promise<T>): Promise<T> {
  const next = inquiriesLockQueue.then(task, task);
  inquiriesLockQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function atomicWriteInquiries(
  payload: readonly InquiryItem[]
): Promise<void> {
  if (isCloudStoreEnabled()) {
    await writeCloudJson(INQUIRIES_CLOUD_KEY, payload);
    return;
  }
  await fs.mkdir(path.dirname(INQUIRIES_FILE), { recursive: true });
  const tmpPath = `${INQUIRIES_FILE}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, INQUIRIES_FILE);
}

const INITIAL_INQUIRIES: readonly InquiryItem[] = [
  {
    id: "inq-sample-1",
    category: "새가족 등록",
    name: "이은혜 (예시 문의)",
    contact: "010-1234-5678",
    title: "이사 후 출석할 교회를 찾고 있어 새가족 등록 문의드립니다",
    message:
      "성북구 길음역 인근으로 이사 온 가정입니다. 이번 주일 2부 예배(오전 11시) 참석 후 새가족 등록 절차와 유초등부 예배 장소를 안내받고 싶습니다.",
    createdAt: "2026-11-12T10:30:00+09:00",
    status: "접수대기",
    adminMemo: "",
  },
];

async function ensureLocalInquiriesFile(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(INQUIRIES_FILE);
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
    await atomicWriteInquiries(INITIAL_INQUIRIES);
  }
}

async function readInquiriesUnlocked(): Promise<readonly InquiryItem[]> {
  if (isCloudStoreEnabled()) {
    const cloud =
      await readCloudJson<readonly InquiryItem[]>(INQUIRIES_CLOUD_KEY);
    if (cloud.found && Array.isArray(cloud.value)) {
      return cloud.value;
    }
    const empty: readonly InquiryItem[] = [];
    await writeCloudJson(INQUIRIES_CLOUD_KEY, empty);
    return empty;
  }
  await ensureLocalInquiriesFile();
  const raw = await fs.readFile(INQUIRIES_FILE, "utf8");
  return JSON.parse(raw) as readonly InquiryItem[];
}

export async function listInquiries(): Promise<readonly InquiryItem[]> {
  return withInquiriesLock(readInquiriesUnlocked);
}

export async function createInquiry(input: {
  readonly category: InquiryCategory;
  readonly name: string;
  readonly contact: string;
  readonly title: string;
  readonly message: string;
}): Promise<InquiryItem> {
  return withInquiriesLock(async () => {
    const existing = await readInquiriesUnlocked();
    const created: InquiryItem = {
      id: `inq-${randomUUID().slice(0, 8)}`,
      category: input.category,
      name: input.name.trim(),
      contact: input.contact.trim(),
      title: input.title.trim(),
      message: input.message.trim(),
      createdAt: new Date().toISOString(),
      status: "접수대기",
      adminMemo: "",
    };
    const updated = [created, ...existing];
    await atomicWriteInquiries(updated);
    return created;
  });
}

export async function updateInquiry(
  id: string,
  patch: {
    readonly status?: "접수대기" | "연락완료";
    readonly adminMemo?: string;
  }
): Promise<readonly InquiryItem[]> {
  return withInquiriesLock(async () => {
    const existing = await readInquiriesUnlocked();
    const updated = existing.map((item) =>
      item.id === id
        ? {
            ...item,
            status: patch.status ?? item.status,
            adminMemo: patch.adminMemo ?? item.adminMemo,
          }
        : item
    );
    await atomicWriteInquiries(updated);
    return updated;
  });
}

export async function deleteInquiry(
  id: string
): Promise<readonly InquiryItem[]> {
  return withInquiriesLock(async () => {
    const existing = await readInquiriesUnlocked();
    const updated = existing.filter((item) => item.id !== id);
    await atomicWriteInquiries(updated);
    return updated;
  });
}
