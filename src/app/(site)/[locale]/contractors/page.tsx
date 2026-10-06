import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Boxes, CalendarClock, ClipboardList } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { ContractorRequestForm } from '@/features/contractors/contractor-request-form';
import { getAllProducts, getSiteData, whatsappNumber } from '@/lib/supabase/queries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.contractors');
  return { title: t('title'), description: t('description') };
}

const VALUE_ICONS = [ClipboardList, Boxes, BadgeCheck, CalendarClock] as const;

export default async function ContractorsPage() {
  const locale = await getLocale();
  const t = await getTranslations('contractors');
  const tc = await getTranslations('common');
  const [products, site] = await Promise.all([getAllProducts(), getSiteData()]);
  const downloads = products.flatMap((product) => {
    const name = locale === 'en' ? product.name_en : product.name_ar;
    return [
      ...(product.catalog_ar_url ? [{ url: product.catalog_ar_url, label: `${name} · AR` }] : []),
      ...(product.catalog_en_url ? [{ url: product.catalog_en_url, label: `${name} · EN` }] : []),
    ];
  });
  const uniqueDownloads = downloads.filter(
    (item, index) => downloads.findIndex((candidate) => candidate.url === item.url) === index,
  );

  return (
    <main id="main-content">
      <section className="bg-navy-950 text-inverse">
        <div className="container-page py-14 lg:py-20">
          <p className="text-sm font-bold text-amber-500">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-4xl text-3xl leading-tight font-extrabold lg:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-200">{t('intro')}</p>
          <a
            href="#request-form"
            className="bg-primary hover:bg-primary-hover mt-8 inline-flex h-12 items-center gap-2 rounded-md px-6 font-bold text-white transition-colors"
          >
            {tc('requestBoq')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
          </a>
        </div>
      </section>

      <section className="container-page py-14 lg:py-20" aria-labelledby="contractor-value-title">
        <h2 id="contractor-value-title" className="text-2xl font-bold lg:text-3xl">
          {t('valueTitle')}
        </h2>
        <ul className="mt-7 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((item, index) => {
            const Icon = VALUE_ICONS[index];
            return (
              <li key={item} className="border-border bg-surface rounded-md border p-5 shadow-sm">
                <Icon aria-hidden="true" className="text-fire-600 h-6 w-6" strokeWidth={1.75} />
                <h3 className="mt-4 font-bold">{t(`value.${item}.title`)}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{t(`value.${item}.body`)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="request-form" className="bg-surface-alt scroll-mt-28">
        <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-20">
          <div>
            <p className="text-fire-600 text-sm font-bold">{t('formEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-bold lg:text-3xl">{t('formTitle')}</h2>
            <p className="text-muted mt-3 leading-relaxed">{t('formIntro')}</p>
          </div>
          <div className="border-border bg-surface rounded-lg border p-5 shadow-sm sm:p-8">
            <ContractorRequestForm whatsappNumber={whatsappNumber(site)} />
          </div>
        </div>
      </section>

      {uniqueDownloads.length > 0 && (
        <section className="container-page py-14 lg:py-20">
          <h2 className="text-2xl font-bold lg:text-3xl">{t('downloadsTitle')}</h2>
          <p className="text-muted mt-2">{t('downloadsIntro')}</p>
          <ul className="mt-6 grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uniqueDownloads.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border bg-surface hover:bg-surface-alt flex min-h-12 items-center justify-between gap-3 rounded-md border px-4 py-3 font-semibold transition-colors"
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  <span aria-hidden="true" className="text-fire-600 shrink-0">
                    ↓
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
