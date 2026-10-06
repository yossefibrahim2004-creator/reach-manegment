import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ContactDetails } from '@/components/contact/contact-details';
import { getSiteData } from '@/lib/supabase/queries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.contact');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const t = await getTranslations('contact');
  const tc = await getTranslations('common');

  const site = await getSiteData();
  const greeting = `${tc('waGreeting')}\n${tc('sourceTag')}: ${tc('pageContact')}`;

  return (
    <main id="main-content" className="container-page py-10 lg:py-14">
      <p className="text-fire-600 text-sm font-bold">{t('eyebrow')}</p>
      <h1 className="mt-1 text-3xl font-bold lg:text-4xl">{t('title')}</h1>
      <p className="text-muted mt-3 max-w-2xl">{t('intro')}</p>

      <div className="mt-8">
        <ContactDetails site={site} locale={locale} greeting={greeting} />
      </div>
    </main>
  );
}
