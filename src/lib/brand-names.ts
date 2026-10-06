const BRAND_NAMES: Record<string, { ar: string; en: string }> = {
  hst: { ar: 'HST', en: 'HST' },
  convoy: { ar: 'كونفوي', en: 'Convoy' },
  snower: { ar: 'اسنوير', en: 'Snower' },
  tanda: { ar: 'تاندا', en: 'Tanda' },
  ats: { ar: 'ATS', en: 'ATS' },
  apollo: { ar: 'ابولو', en: 'Apollo' },
  hlt: { ar: 'HLT', en: 'HLT' },
};

type BrandName = { slug: string; name_ar: string; name_en: string };

export function normalizeBrandName<T extends BrandName>(brand: T): T {
  const names = BRAND_NAMES[brand.slug];
  return names ? { ...brand, name_ar: names.ar, name_en: names.en } : brand;
}
