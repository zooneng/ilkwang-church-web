import type { Metadata } from "next";
import { Nanum_Gothic, Noto_Sans_KR } from "next/font/google";
import { FloatingGuideBot } from "@/components/FloatingGuideBot";
import { NavigationProvider } from "@/components/NavigationContext";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getServerAdminRole } from "@/lib/admin-session-server";
import { getSiteContent } from "@/lib/content-store";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const nanumGothic = Nanum_Gothic({
  variable: "--font-nanum-gothic",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const { name, slogan, denomination, foundedYear, shortAddress } =
    content.churchInfo;
  const fullTitle = slogan ? `${name} — ${slogan} 교회` : name;
  return {
    title: {
      default: fullTitle,
      template: `%s | ${name}`,
    },
    description: `${denomination} ${foundedYear}년 설립 ${shortAddress} ${name} 공식 홈페이지`,
    icons: {
      icon: [
        { url: "/gapck-logo.svg", type: "image/svg+xml" },
        { url: "/icon.png", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    openGraph: {
      title: fullTitle,
      description: `${denomination} ${name} 공식 홈페이지`,
      images: ["/ilkwang03.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [content, adminRole] = await Promise.all([
    getSiteContent(),
    getServerAdminRole(),
  ]);

  return (
    <html
      lang="ko"
      data-scroll-behavior="smooth"
      className={`${notoSansKr.variable} ${nanumGothic.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-white text-gray-800">
        <NavigationProvider
          navigation={content.navigation}
          adminRole={adminRole}
        >
          <SiteHeader
            churchName={content.churchInfo.name}
            slogan={content.churchInfo.slogan}
            shortAddress={content.churchInfo.shortAddress}
            phone={content.churchInfo.phone}
            topBannerNotices={content.topBannerNotices}
            navigation={content.navigation}
            adminRole={adminRole}
          />
          <main className="flex-1">{children}</main>
          <SiteFooter
            churchInfo={content.churchInfo}
            worshipSchedule={content.worshipSchedule}
            navigation={content.navigation}
          />
          <FloatingGuideBot
            churchInfo={content.churchInfo}
            worshipSchedule={content.worshipSchedule}
          />
        </NavigationProvider>
      </body>
    </html>
  );
}
