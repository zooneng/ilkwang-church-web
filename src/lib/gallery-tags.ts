export const PRESET_GALLERY_TAGS = [
  "예배와 절기",
  "성례와 임직",
  "전도와 선교",
  "다음세대",
  "수련회와 탐방",
  "교제와 봉사",
  "교회 역사",
] as const;

export type PresetGalleryTag = (typeof PRESET_GALLERY_TAGS)[number];

export function inferGalleryTagsFromTitle(rawTitle: string): string[] {
  const t = rawTitle.trim();
  if (!t) return [];
  const matched = new Set<PresetGalleryTag>();

  if (
    /성탄|부활|추수감사|맥추감사|송구영신|신년|헌신예배|주일예배|감사예배|어린이주일|교사주일|어버이주일/.test(
      t
    )
  ) {
    matched.add("예배와 절기");
  }

  if (/성례|세례|학습|입교|유아세례|임직|위임|은퇴|취임|장립|권사|집사/.test(t)) {
    matched.add("성례와 임직");
  }

  const withoutSocietyNames = t.replace(
    /(?:\d+\s*)?(?:남|여)전도회|전도사/g,
    " "
  );
  if (
    /전도|선교|비전트립|캄보디아|태국|싱가폴|싱가포르|해피전도/.test(
      withoutSocietyNames
    )
  ) {
    matched.add("전도와 선교");
  }

  const withoutInfantBaptismOnly = t.replace(/유아\s*세례/g, " ");
  if (
    /유아|유치|유초등|아동|어린이|중고등|청소년|청년|학사관|졸업|매직|버블|주일학교|아가모|교사주일/.test(
      withoutInfantBaptismOnly
    )
  ) {
    matched.add("다음세대");
  }

  if (/수련회|방문|여행|탐방|야유회|서울랜드|제주|여수|순천|캠프/.test(t)) {
    matched.add("수련회와 탐방");
  }

  if (/김장|퀴즈|애찬|식사|바자회|봉사|교제|체육|특송/.test(t)) {
    matched.add("교제와 봉사");
  }

  if (/공사현장|성전건축|건축감사|외부모습|전체사진|옛날|창립|입당/.test(t)) {
    matched.add("교회 역사");
  }

  if (matched.size === 0) {
    matched.add("예배와 절기");
  }

  return PRESET_GALLERY_TAGS.filter((tag) => matched.has(tag));
}
