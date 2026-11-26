import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import { checkRateLimit, getClientIp, sanitizePlainText } from "@/lib/security";

export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTION = `당신은 대한예수교장로회(합동) 일광교회(서울 성북구 동소문로 212-68, 담임목사 신점일) 공식 홈페이지의 운영 도우미입니다.
교회 교역자나 행정 담당자가 정중하고 따뜻한 교회 공지문, 행사 안내문, 학사관 모집문, 환영 인사말을 다듬거나 홈페이지 운영 방법을 물어볼 때 한국어로 친절하고 간결하게 답변하세요.
홈페이지 관리자 모드(/admin) 주요 탭:
- 주간 사역: 주보 안내(.hwp/.hwpx 자동 분석), 설교 영상(유튜브 URL 1클릭 불러오기), 새가족 및 문의함
- 나눔과 소식 게시판: 교회 소식, 행사 안내, 앨범(사진 업로드 전용 계정 /admin/photos 별도 지원), 교재 자료(PDF, HWP 업로드)
- 교회 소개 및 헌금: 인사말, 담임목사 약력, 교회 역사(연혁 및 원본 사료 이미지 보관), 섬기는 사람들(3:4 증명사진 크롭 및 부서 태그), 오시는 길, 온라인 헌금
- 예배와 다음 세대: 예배 안내, 다음 세대 안내(유초등부 오전 11시, 중고등부 오전 9시 30분, 청년부 오후 1시 30분), 다음 세대 부서 소식, 일광학사관(/boards/dormitory)
- 시스템 설정: 메인 3D 큐브 사진(6면), 최상단 한 줄 알림바, 상단 메뉴 및 게시판 추가, 게시물 통합 이동 및 삭제(일광학사관 글 수정 포함), 데이터 백업 및 복원.`;

export async function POST(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;

  const limit = checkRateLimit({
    bucket: "ai-assist",
    key: getClientIp(request),
    maxRequests: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "외부 AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = (await request.json()) as {
      readonly apiKey?: string;
      readonly prompt?: string;
    };
    const apiKey = sanitizePlainText(body.apiKey, 200);
    const prompt = sanitizePlainText(body.prompt, 2000);

    if (!apiKey) {
      return NextResponse.json(
        { error: "외부 AI 자유 작문을 사용하려면 Google Gemini API 키를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { error: "질문 또는 작성 요청 내용을 입력해 주세요." },
        { status: 400 }
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = (await upstream.json()) as {
      readonly candidates?: readonly {
        readonly content?: {
          readonly parts?: readonly { readonly text?: string }[];
        };
      }[];
      readonly error?: { readonly message?: string };
    };

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ??
            "외부 Gemini API 호출에 실패했습니다. 입력하신 API 키를 확인해 주세요.",
        },
        { status: upstream.status }
      );
    }

    const replyText =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!replyText) {
      return NextResponse.json(
        { error: "응답 본문이 비어 있습니다. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: replyText });
  } catch {
    return NextResponse.json(
      { error: "외부 AI 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
