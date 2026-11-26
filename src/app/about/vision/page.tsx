import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";

const FIVE_COMMUNITIES = [
  {
    title: "예배공동체",
    subtitle: "하나님을 위하여 존재하는 공동체",
    body: "온 마음과 정성을 다해 살아계신 하나님께 예배드리며, 주일 예배를 신앙 생활의 중심으로 삼습니다. 참된 예배를 통해 하나님과의 관계를 회복하고 성도들이 함께 세워져 갑니다.",
  },
  {
    title: "훈련공동체",
    subtitle: "성도를 말씀으로 세우는 공동체",
    body: "성경 말씀을 통해 예수 그리스도의 제자로 훈련받고 성장합니다. 체계적인 말씀 교육과 소그룹 훈련을 통해 성숙한 신앙인을 세워갑니다.",
  },
  {
    title: "치유공동체",
    subtitle: "가정과 사회를 변화시키는 공동체",
    body: "상처받은 영혼을 품고 가정을 회복시키며, 지역사회에 하나님의 사랑을 전합니다. 성령의 능력으로 삶의 모든 영역에서 치유와 회복이 일어납니다.",
  },
  {
    title: "비전공동체",
    subtitle: "미래의 지도자를 세우는 공동체",
    body: "다음 세대를 향한 투자와 양육을 통해 미래의 교회 지도자들을 세워갑니다. 청소년과 청년들이 하나님의 비전을 품고 자라나는 공동체입니다.",
  },
  {
    title: "선교공동체",
    subtitle: "지구촌 땅 끝까지 복음을 전하는 공동체",
    body: "국내외 선교를 통해 하나님 나라를 확장하고 열방을 향한 선교 사명을 감당합니다. 땅 끝까지 복음을 전하는 선교적 교회를 지향합니다.",
  },
] as const;

export default function AboutVisionPage() {
  return (
    <div>
      <SubpageHero
        englishLabel="Vision"
        title="교회 비전"
        subtitle="하나님 중심 · 성경 중심 · 교회 중심의 개혁주의 신앙 위에 세워진 교회"
        bannerImageUrl="https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Church Introduction */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 sm:p-10 space-y-4">
          <h2 className="text-2xl font-black text-[#1a2744]">일광교회 소개</h2>
          <p className="text-gray-700 leading-relaxed break-keep">
            일광교회는 대한예수교장로회(합동측, 총신대학교)에 소속된 건강한 교회로
            1971년에 설립되어 50여 년 동안 돈암동과 길음 지역 복음화의 사명을 감당해
            왔으며, 하나님 중심 · 성경 중심 · 교회 중심의 신앙을 추구하는 교회입니다.
          </p>
          <p className="text-gray-700 leading-relaxed break-keep">
            개혁주의 신앙(Reformed Faith)의 토대 위에 세워진 일광교회는 칼뱅의 신학적
            전통을 따라 오직 성경(Sola Scriptura), 오직 믿음(Sola Fide), 오직
            은혜(Sola Gratia), 오직 그리스도(Solus Christus), 오직 하나님께 영광(Soli
            Deo Gloria)을 고백하며 나아가는 교회입니다.
          </p>
        </section>

        {/* Mission Banner */}
        <section className="rounded-2xl bg-[#1a2744] text-white p-8 sm:p-12 text-center shadow-lg">
          <p className="text-[#6dbf73] text-xs font-bold uppercase tracking-[0.25em] mb-3">
            OUR MISSION
          </p>
          <h2 className="text-2xl sm:text-3xl font-black mb-6">일광교회 사명</h2>
          <p className="text-lg sm:text-2xl font-bold leading-relaxed text-white/95 max-w-2xl mx-auto break-keep">
            살아계신 하나님을 예배하고
            <br />
            예수 그리스도의 제자로 훈련되어
            <br />
            성령의 능력으로 사랑하고 전도하고 섬김으로
            <br />
            하나님의 나라를 확장한다.
          </p>
        </section>

        {/* 5 Communities */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744] text-center mb-10">
            일광교회가 추구하는 5대 공동체
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FIVE_COMMUNITIES.map((item, idx) => (
              <div
                key={item.title}
                className="bg-[#F8FAF8] rounded-2xl p-6 sm:p-7 border border-gray-100 hover:border-[#2E7D32]/40 transition-colors"
              >
                <span className="inline-flex w-8 h-8 rounded-full bg-[#2E7D32] text-white text-xs font-black items-center justify-center mb-4">
                  0{idx + 1}
                </span>
                <h3 className="text-xl font-black text-[#1a2744] mb-1">
                  {item.title}
                </h3>
                <p className="text-xs font-bold text-[#2E7D32] mb-3">
                  {item.subtitle}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed break-keep">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
