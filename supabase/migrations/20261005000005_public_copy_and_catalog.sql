update public.categories
set name_ar = case slug
  when 'multi-sensor-detectors' then 'حساسات متعددة'
  when 'manual-call-points' then 'كاسر زجاج يدوي'
  else name_ar
end
where slug in ('multi-sensor-detectors', 'manual-call-points');

update public.products p
set brand_id = null
from public.brands b
where p.brand_id = b.id
  and b.slug = 'generic-chinese';

delete from public.brands where slug = 'generic-chinese';

update public.products
set name_en = case slug
      when 'generic-chinese-mcp' then 'Chinese-origin Manual Call Point'
      when 'generic-chinese-siren' then 'Chinese-origin Siren'
      when 'generic-chinese-bell-24v' then 'Chinese-origin Bell 24V'
      when 'generic-chinese-bell-220v' then 'Chinese-origin Bell 220V'
      when 'generic-chinese-4-zone-panel' then 'Chinese-origin 4-Zone Panel'
      when 'generic-chinese-beam-detector' then 'Chinese-origin Beam Detector'
      when 'generic-chinese-abort-switch' then 'Chinese-origin Abort Switch'
      when 'fire-search-extinguisher-6kg' then 'Fire Search Extinguisher 6kg (Chinese origin)'
      when 'fire-search-extinguisher-2kg' then 'Fire Search Extinguisher 2kg (Chinese origin)'
      else name_en
    end,
    search_keywords = replace(search_keywords, 'Generic (Chinese)', 'Chinese origin')
where slug in (
  'generic-chinese-mcp',
  'generic-chinese-siren',
  'generic-chinese-bell-24v',
  'generic-chinese-bell-220v',
  'generic-chinese-4-zone-panel',
  'generic-chinese-beam-detector',
  'generic-chinese-abort-switch',
  'fire-search-extinguisher-6kg',
  'fire-search-extinguisher-2kg'
)
and (
  name_en ilike 'Generic (Chinese)%'
  or name_en ilike 'Fire Search Extinguisher %(Chinese)'
);

update public.social_links
set url = regexp_replace(
  regexp_replace(url, '([?&])fbclid=[^&#]*&?', '\1', 'g'),
  '[?&]$',
  ''
)
where url ~* '[?&]fbclid=';

delete from public.social_links where url ilike '%your-page%' or url ilike '%your-channel%';

update public.site_settings
set value_ar = case
      when value_ar ilike '%دعم فني قبل وبعد%'
        then 'توريد لوحات تحكم وكواشف وصفارات وملحقات — تقليدية ومعنونة — مع دعم فني قبل وبعد التوريد.'
      else value_ar
    end,
    value_en = case
      when value_en ilike '%before and after installation%'
        then 'Supply of conventional and addressable control panels, detectors, sounders and accessories, with technical support before and after supply.'
      else value_en
    end
where key = 'hero_lead'
  and (
    value_en ilike '%before and after installation%'
    or value_ar ilike '%دعم فني قبل وبعد%'
  );

update public.site_settings
set value_ar = case
      when value_ar = 'أنظمة إنذار ومكافحة الحريق' then 'أنظمة إنذار الحريق'
      else value_ar
    end,
    value_en = case
      when value_en = 'Fire alarm & suppression systems' then 'Fire alarm systems'
      else value_en
    end
where key = 'hero_eyebrow'
  and (
    value_en = 'Fire alarm & suppression systems'
    or value_ar = 'أنظمة إنذار ومكافحة الحريق'
  );

update public.site_settings
set value_ar = case
      when value_ar ilike '%حماية تبدأ%الإنذار المبكر%'
        then 'توريد مشروعك يبدأ *بحزمة متكاملة* لأنظمة إنذار الحريق'
      else value_ar
    end,
    value_en = case
      when value_en ilike '%protection that starts with%'
        then 'Build your project scope with a *complete supply package* for fire alarms'
      else value_en
    end
where key = 'hero_title'
  and (
    value_en ilike '%protection that starts with%'
    or value_ar ilike '%حماية تبدأ%الإنذار المبكر%'
  );

update public.site_settings
set value_ar = case
      when value_ar ilike 'نص مؤقت يُحرر من لوحة التحكم%' then null
      else value_ar
    end,
    value_en = case
      when value_en ilike 'placeholder text edited from the admin%' then null
      else value_en
    end
where key in ('about_story', 'about_vision')
  and (
    value_en ilike 'placeholder text edited from the admin%'
    or value_ar ilike 'نص مؤقت يُحرر من لوحة التحكم%'
  );

update public.site_settings
set value_ar = case
      when value_ar ilike '%تصميم وتوريد أنظمة الإنذار%'
        then 'فريق متخصص في توريد أنظمة الإنذار التقليدية والمعنونة.'
      else value_ar
    end,
    value_en = case
      when value_en ilike '%designing and supplying conventional and addressable%'
        then 'A specialist team supplying conventional and addressable alarm systems.'
      else value_en
    end
where key = 'why_1_body'
  and (
    value_en ilike '%designing and supplying conventional and addressable%'
    or value_ar ilike '%تصميم وتوريد أنظمة الإنذار%'
  );

update public.site_settings
set value_ar = case when value_ar = 'ضمان معتمد' then 'ضمان الموزع المعتمد' else value_ar end,
    value_en = case when value_en = 'Certified warranty' then 'Authorized distributor warranty' else value_en end
where key = 'why_2_title'
  and (value_ar = 'ضمان معتمد' or value_en = 'Certified warranty');

update public.site_settings
set value_ar = case
      when value_ar = 'جميع المنتجات بضمان الوكيل وشهادات مطابقة.'
        then 'ضمان الموزع المعتمد للعلامات التي نمثلها، وفق شروط كل علامة.'
      else value_ar
    end,
    value_en = case
      when value_en = 'All products carry distributor warranty and compliance certificates.'
        then 'Authorized distributor warranty for the brands we represent, subject to each brand''s terms.'
      else value_en
    end
where key = 'why_2_body'
  and (
    value_en = 'All products carry distributor warranty and compliance certificates.'
    or value_ar = 'جميع المنتجات بضمان الوكيل وشهادات مطابقة.'
  );

update public.site_settings
set value_ar = case when value_ar = 'دعم بعد البيع' then 'دعم فني قبل وبعد التوريد' else value_ar end,
    value_en = case when value_en = 'After-sales support' then 'Technical support before and after supply' else value_en end
where key = 'why_3_title'
  and (value_ar = 'دعم بعد البيع' or value_en = 'After-sales support');

update public.site_settings
set value_ar = 'السبت إلى الخميس · من 9 صباحًا إلى 6 مساءً',
    value_en = 'Saturday to Thursday · 9:00 AM to 6:00 PM'
where key = 'hours'
  and value_ar = 'السبت – الخميس · 9 ص – 6 م'
  and value_en = 'Saturday – Thursday · 9 am – 6 pm';
