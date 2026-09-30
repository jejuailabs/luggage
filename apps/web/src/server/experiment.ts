export const HERO_EXPERIMENT_COOKIE = "jc_home_hero_v1";

export type HeroVariant = "A" | "B";

export function parseHeroExperiment(value: string | undefined): { variant: HeroVariant; sessionId: string } | null {
  if (!value) return null;
  const match = /^(A|B)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(value);
  return match ? { variant: match[1] as HeroVariant, sessionId: match[2]! } : null;
}
