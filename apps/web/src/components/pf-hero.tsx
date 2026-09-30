import Image from "next/image";
import Link from "next/link";

type Tone = "sky" | "coral" | "mint" | "sun" | "lilac";

/** 고객 내부 페이지 공통 머리 영역: 파스텔 패널 + 스티커 칩 + 기울어진 사진 또는 큰 이모지 아이콘. */
export function PfHero({ chip, title, subtitle, tone = "sky", emoji, image, imageNote, back, children, titleLang }: {
  chip: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: Tone;
  emoji?: string;
  image?: string;
  imageNote?: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
  titleLang?: string;
}) {
  return (
    <section className={`pf-hero2 pf-hero2--${tone}`}>
      <div className="pf-hero2__copy">
        {back ? <Link href={back.href} className="pf-hero2__back">← {back.label}</Link> : null}
        <span className="pf-hero2__chip">{chip}</span>
        <h1 lang={titleLang}>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {children ? <div className="pf-hero2__actions">{children}</div> : null}
      </div>
      {image ? (
        <figure className="pf-hero2__photo">
          <Image src={image} alt="" width={900} height={700} priority sizes="(min-width: 900px) 380px, 90vw" />
          {imageNote ? <figcaption>{imageNote}</figcaption> : null}
        </figure>
      ) : emoji ? <span className="pf-hero2__emoji" aria-hidden="true">{emoji}</span> : null}
    </section>
  );
}
