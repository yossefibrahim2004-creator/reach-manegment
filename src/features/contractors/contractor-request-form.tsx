'use client';

import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { waLink } from '@/lib/whatsapp';

const requestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9()\s-]{8,20}$/),
  project: z.string().trim().min(2).max(160),
  buildingType: z.enum([
    'commercial',
    'administrative',
    'industrial',
    'healthcare',
    'residential',
    'education',
    'other',
  ]),
  area: z
    .string()
    .trim()
    .min(1)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0),
  system: z.enum(['conventional', 'addressable', 'unsure']),
  tier: z.enum(['premium', 'economy', 'open']),
});

type FieldErrors = Record<string, string>;

type Props = {
  whatsappNumber: string | null;
};

export function ContractorRequestForm({ whatsappNumber }: Props) {
  const t = useTranslations('contractors');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const parsed = requestSchema.safeParse({
      name: formData.get('name'),
      company: formData.get('company'),
      phone: formData.get('phone'),
      project: formData.get('project'),
      buildingType: formData.get('buildingType'),
      area: formData.get('area'),
      system: formData.get('system'),
      tier: formData.get('tier'),
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          nextErrors[field] =
            field === 'phone'
              ? t('validation.phone')
              : field === 'area'
                ? t('validation.area')
                : t('validation.required');
        }
      }
      setErrors(nextErrors);
      return;
    }

    const drawing = formData.get('drawing');
    const drawingFile = drawing instanceof File && drawing.size > 0 ? drawing : null;
    if (drawingFile && !/\.(pdf|png|jpe?g|dwg|dxf)$/i.test(drawingFile.name)) {
      setErrors({ drawing: t('validation.file') });
      return;
    }

    setErrors({});
    if (!whatsappNumber) return;

    const values = parsed.data;
    const message = [
      t('messageIntro'),
      `${t('fields.name')}: ${values.name}`,
      `${t('fields.company')}: ${values.company}`,
      `${t('fields.phone')}: ${values.phone}`,
      `${t('fields.project')}: ${values.project}`,
      `${t('fields.buildingType')}: ${t(`options.buildingType.${values.buildingType}`)}`,
      `${t('fields.area')}: ${values.area} ${t('areaUnit')}`,
      `${t('fields.system')}: ${t(`options.system.${values.system}`)}`,
      `${t('fields.tier')}: ${t(`options.tier.${values.tier}`)}`,
      ...(drawingFile
        ? [`${t('fields.drawing')}: ${drawingFile.name}`, t('manualAttachment')]
        : []),
      `${tc('sourceTag')}: ${t('sourceName')}`,
    ].join('\n');

    window.open(waLink(whatsappNumber, message), '_blank', 'noopener,noreferrer');
    form.reset();
  };

  const fieldClass =
    'border-border bg-surface focus:border-fire-600 w-full rounded-md border px-3 py-3 text-base';
  const labelClass = 'mb-1.5 block text-sm font-bold';

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {(
        [
          ['name', 'text', 'name'],
          ['company', 'text', 'company'],
          ['phone', 'tel', 'phone'],
          ['project', 'text', 'project'],
        ] as const
      ).map(([name, type, label]) => (
        <div key={name}>
          <label htmlFor={name} className={labelClass}>
            {t(`fields.${label}`)}
          </label>
          <input
            id={name}
            name={name}
            type={type}
            required
            autoComplete={
              name === 'name' ? 'name' : name === 'company' ? 'organization' : undefined
            }
            dir={name === 'phone' ? 'ltr' : undefined}
            inputMode={name === 'phone' ? 'tel' : undefined}
            aria-invalid={Boolean(errors[name])}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            className={fieldClass}
          />
          {errors[name] && (
            <p id={`${name}-error`} role="alert" className="text-fire-700 mt-1 text-sm">
              {errors[name]}
            </p>
          )}
        </div>
      ))}

      <div>
        <label htmlFor="buildingType" className={labelClass}>
          {t('fields.buildingType')}
        </label>
        <select
          id="buildingType"
          name="buildingType"
          defaultValue=""
          required
          aria-invalid={Boolean(errors.buildingType)}
          aria-describedby={errors.buildingType ? 'buildingType-error' : undefined}
          className={fieldClass}
        >
          <option value="" disabled>
            {t('selectOption')}
          </option>
          {(
            [
              'commercial',
              'administrative',
              'industrial',
              'healthcare',
              'residential',
              'education',
              'other',
            ] as const
          ).map((value) => (
            <option key={value} value={value}>
              {t(`options.buildingType.${value}`)}
            </option>
          ))}
        </select>
        {errors.buildingType && (
          <p id="buildingType-error" role="alert" className="text-fire-700 mt-1 text-sm">
            {errors.buildingType}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="area" className={labelClass}>
          {t('fields.area')}
        </label>
        <div className="flex gap-2">
          <input
            id="area"
            name="area"
            type="number"
            min="1"
            step="1"
            required
            inputMode="numeric"
            dir="ltr"
            aria-invalid={Boolean(errors.area)}
            aria-describedby={errors.area ? 'area-error' : undefined}
            className={fieldClass}
          />
          <span className="border-border bg-surface-alt flex shrink-0 items-center rounded-md border px-3 text-sm">
            {t('areaUnit')}
          </span>
        </div>
        {errors.area && (
          <p id="area-error" role="alert" className="text-fire-700 mt-1 text-sm">
            {errors.area}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="system" className={labelClass}>
          {t('fields.system')}
        </label>
        <select
          id="system"
          name="system"
          defaultValue=""
          required
          aria-invalid={Boolean(errors.system)}
          aria-describedby={errors.system ? 'system-error' : undefined}
          className={fieldClass}
        >
          <option value="" disabled>
            {t('selectOption')}
          </option>
          {(['conventional', 'addressable', 'unsure'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`options.system.${value}`)}
            </option>
          ))}
        </select>
        {errors.system && (
          <p id="system-error" role="alert" className="text-fire-700 mt-1 text-sm">
            {errors.system}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="tier" className={labelClass}>
          {t('fields.tier')}
        </label>
        <select
          id="tier"
          name="tier"
          defaultValue=""
          required
          aria-invalid={Boolean(errors.tier)}
          aria-describedby={errors.tier ? 'tier-error' : undefined}
          className={fieldClass}
        >
          <option value="" disabled>
            {t('selectOption')}
          </option>
          {(['premium', 'economy', 'open'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`options.tier.${value}`)}
            </option>
          ))}
        </select>
        {errors.tier && (
          <p id="tier-error" role="alert" className="text-fire-700 mt-1 text-sm">
            {errors.tier}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="drawing" className={labelClass}>
          {t('fields.drawing')}
        </label>
        <input
          id="drawing"
          name="drawing"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf"
          aria-invalid={Boolean(errors.drawing)}
          aria-describedby={errors.drawing ? 'drawing-error' : 'drawing-help'}
          className="border-border bg-surface file:bg-surface-alt w-full rounded-md border p-2 text-base file:me-3 file:rounded file:border-0 file:px-3 file:py-2"
        />
        {errors.drawing ? (
          <p id="drawing-error" role="alert" className="text-fire-700 mt-1 text-sm">
            {errors.drawing}
          </p>
        ) : (
          <p id="drawing-help" className="text-muted mt-1 text-sm">
            {t('fileHelp')}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        {whatsappNumber ? (
          <button
            type="submit"
            className="bg-primary hover:bg-primary-hover inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-6 font-bold text-white transition-colors"
          >
            {tc('requestBoq')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
          </button>
        ) : (
          <p role="status" className="border-border bg-surface-alt rounded-md border p-4">
            {t('whatsappUnavailable')}
          </p>
        )}
        <p className="text-muted mt-3 text-sm">{t('submissionNote')}</p>
      </div>
    </form>
  );
}
