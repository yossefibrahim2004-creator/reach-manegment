'use client';

import { useTranslations } from 'next-intl';
import { FaWhatsapp } from 'react-icons/fa6';
import { waLink } from '@/lib/whatsapp';

type Props = {
  number: string;
  productName: string;
  productUrl: string;
  label: string;
};

/**
 * "Ask for price / quote" WhatsApp button (PROJECT_SPEC §6.4): prefills the
 * product name + the live page URL. Falls back to the product-name message
 * without JavaScript; the onClick adds the exact URL of the viewed page.
 */
export function QuoteWhatsAppButton({ number, productName, productUrl, label }: Props) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const baseMessage = `${t('quoteMessage', { name: productName })}\n${productUrl}\n${tc('sourceTag')}: ${tc('pageProduct')}`;
  const fallback = waLink(number, baseMessage);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const message = `${t('quoteMessage', { name: productName })}\n${window.location.href}\n${tc('sourceTag')}: ${tc('pageProduct')}`;
    window.open(waLink(number, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      href={fallback}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-whatsapp hover:bg-navy-950 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-bold text-white transition-colors"
    >
      <FaWhatsapp aria-hidden="true" className="h-5 w-5" />
      {label}
    </a>
  );
}
