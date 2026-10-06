-- seed.sql — PROJECT_SPEC Appendix A + §11
-- Products are seeded as UNPUBLISHED DRAFTS (is_published = false).
-- English names for the generic/Chinese items are machine-drafted from the Arabic
-- and need owner review (D-003). Availability follows the rule
-- "غير متوفر قريباً = on_request, متوفر لفترة محدودة = limited, else in_stock" (D-004).
-- The GST mockup brand was excluded (D-007).
-- Also seeds: 8 initial featured flags + placeholder site_settings / contact numbers /
-- social links — obvious placeholders until edited in the admin (D-005, D-033).
-- Re-runnable: inserts use "on conflict do nothing" or a "where not exists" guard.

-- ── Categories (17) ──────────────────────────────────────────────────────
insert into public.categories (slug, name_ar, name_en, sort_order) values
  ('control-panels',         'لوحات الإطفاء',                'Control Panels',         1),
  ('smoke-detectors',        'حساسات الدخان',                 'Smoke Detectors',        2),
  ('heat-detectors',         'حساسات الحرارة',                'Heat Detectors',         3),
  ('multi-sensor-detectors', 'حساسات متعدد',                  'Multi-Sensor Detectors', 4),
  ('manual-call-points',     'كاسرات الصوافير اليدوية',       'Manual Call Points',     5),
  ('sirens',                 'السيرينات',                     'Sirens',                 6),
  ('bells',                  'أجراس الإنذار',                 'Bells',                  7),
  ('remote-indicators',      'لمبات البيان',                  'Remote Indicators',      8),
  ('flame-detectors',        'حساسات اللهب',                  'Flame Detectors',        9),
  ('gas-detectors',          'حساسات الغاز',                  'Gas Detectors',         10),
  ('beam-detectors',         'البيم',                         'Beam Detectors',        11),
  ('detector-bases',         'قواعد الحساسات',                'Detector Bases',        12),
  ('cables',                 'الكابلات',                      'Cables',                13),
  ('batteries',              'البطاريات',                     'Batteries',             14),
  ('extinguishers',          'طفايات الحريق',                 'Extinguishers',         15),
  ('modules',                'وحدات (مونتور / كنترول / انترفيس)', 'Modules',          16),
  ('abort-switches',         'أزرار الإلغاء',                 'Abort Switches',        17)
on conflict (slug) do nothing;

-- ── Brands (8) ───────────────────────────────────────────────────────────
insert into public.brands (slug, name_ar, name_en, sort_order) values
  ('hst',             'HST',             'HST',               1),
  ('conway',          'كونفوي',          'Conway',            2),
  ('snower',          'اسنوير',          'Snower',            3),
  ('tanda',           'تاندا',           'Tanda',             4),
  ('ats',             'ATS',             'ATS',               5),
  ('apollo',          'ابولو',           'Apollo',            6),
  ('hlt',             'HLT',             'HLT',               7),
  ('generic-chinese', 'صيني',            'Generic (Chinese)', 8)
on conflict (slug) do nothing;

-- ── Spec definitions (form fields + filter labels per category) ──────────
insert into public.spec_definitions (category_id, key, label_ar, label_en, unit, value_type, options, is_filterable, sort_order)
select c.id, v.key, v.label_ar, v.label_en, v.unit, v.value_type, v.options::jsonb, v.is_filterable, v.sort_order
from (values
  ('control-panels', 'zones',       'عدد الزونات',        'Zones',             null, 'number', null::text,  true,  1),
  ('control-panels', 'loops',       'عدد اللوبات',        'Loops',             null, 'number', null,       true,  2),
  ('sirens',         'voltage',     'الفولت',             'Voltage',           'V',  'number', null,       true,  1),
  ('bells',          'voltage',     'الفولت',             'Voltage',           'V',  'number', null,       true,  1),
  ('batteries',      'capacity_ah', 'السعة',              'Capacity',          'Ah', 'number', null,       true,  1),
  ('extinguishers',  'weight_kg',   'الوزن',              'Weight',            'kg', 'number', null,       true,  1),
  ('cables',         'material',    'المادة',             'Material',          null, 'select',
       '[{"value":"copper","label_ar":"نحاس","label_en":"Copper"},{"value":"aluminum","label_ar":"ألومنيوم","label_en":"Aluminum"}]', true, 1)
) as v(category, key, label_ar, label_en, unit, value_type, options, is_filterable, sort_order)
join public.categories c on c.slug = v.category
on conflict (category_id, key) do nothing;

-- ── Products (65) — all unpublished drafts ───────────────────────────────
with s(slug, category, brand, system, name_ar, name_en, specs, availability, sort_order) as (values
  ('hst-fire-alarm-panel',            'control-panels',         'hst',             null,           'لوحة اطفاء hst',                          'HST Fire Alarm Panel',                  '{}'::jsonb,                        'in_stock',    1),
  ('hst-2-zone-panel',                'control-panels',         'hst',             null,           'لوحة 2 زون hst',                          'HST 2-Zone Panel',                      '{"zones":2}',                      'in_stock',    2),
  ('hst-economy-4-zone-panel',        'control-panels',         'hst',             null,           'لوحة 4 زون الاقتصادية hst',               'HST Economy 4-Zone Panel',              '{"zones":4}',                      'in_stock',    3),
  ('hst-economy-8-zone-panel',        'control-panels',         'hst',             null,           'لوحة 8 زون الاقتصادية hst',               'HST Economy 8-Zone Panel',              '{"zones":8}',                      'on_request',  4),
  ('hst-economy-12-zone-panel',       'control-panels',         'hst',             null,           'لوحة 12 زون الاقتصادية hst',              'HST Economy 12-Zone Panel',             '{"zones":12}',                     'on_request',  5),
  ('hst-economy-16-zone-panel',       'control-panels',         'hst',             null,           'لوحة 16 زون الاقتصادية hst',              'HST Economy 16-Zone Panel',             '{"zones":16}',                     'limited',     6),
  ('hst-silver-4-zone-panel',         'control-panels',         'hst',             null,           'لوحة 4 زون السيلفر hst',                  'HST Silver 4-Zone Panel',               '{"zones":4}',                      'limited',     7),
  ('hst-silver-8-zone-panel',         'control-panels',         'hst',             null,           'لوحة 8 زون السيلفر hst',                  'HST Silver 8-Zone Panel',               '{"zones":8}',                      'limited',     8),
  ('hst-silver-16-zone-panel',        'control-panels',         'hst',             null,           'لوحة 16 زون السيلفر hst',                 'HST Silver 16-Zone Panel',              '{"zones":16}',                     'limited',     9),
  ('hst-mcp',                         'manual-call-points',     'hst',             null,           'كاسر hst',                                'HST Manual Call Point',                 '{}',                               'in_stock',   10),
  ('hst-siren',                       'sirens',                 'hst',             null,           'سرينة hst',                               'HST Siren',                            '{}',                               'in_stock',   11),
  ('hst-bell',                        'bells',                  'hst',             null,           'جرس hst',                                 'HST Bell',                             '{}',                               'in_stock',   12),
  ('hst-conventional-smoke-detector', 'smoke-detectors',        'hst',             'conventional', 'حساس دخان تقليدي hst',                    'HST Conventional Smoke Detector',       '{}',                               'in_stock',   13),
  ('hst-conventional-heat-detector',  'heat-detectors',         'hst',             'conventional', 'حساس حرارة تقليدي hst',                   'HST Conventional Heat Detector',        '{}',                               'in_stock',   14),
  ('hst-conventional-multi-sensor-detector', 'multi-sensor-detectors', 'hst',       'conventional', 'حساس متعدد تقليدي hst',                  'HST Conventional Multi-Sensor Detector','{}',                               'in_stock',   15),
  ('hst-remote-indicator',            'remote-indicators',      'hst',             null,           'لمبة بيان hst',                           'HST Remote Indicator',                  '{}',                               'in_stock',   16),
  ('hst-flame-detector',              'flame-detectors',        'hst',             null,           'حساس لهب hst',                            'HST Flame Detector',                    '{}',                               'in_stock',   17),
  ('hst-conventional-gas-detector',   'gas-detectors',          'hst',             'conventional', 'حساس غاز تقليدي hst',                     'HST Conventional Gas Detector',         '{}',                               'in_stock',   18),
  ('hst-beam-detector',               'beam-detectors',         'hst',             null,           'بيم hst',                                 'HST Beam Detector',                     '{}',                               'limited',    19),
  ('hst-economy-1-loop-panel',        'control-panels',         'hst',             null,           'لوحة 1loop الاقتصادية hst',               'HST Economy 1-Loop Panel',              '{"loops":1}',                      'limited',    20),
  ('hst-economy-2-loop-panel',        'control-panels',         'hst',             null,           'لوحة 2loop الاقتصادية hst',               'HST Economy 2-Loop Panel',              '{"loops":2}',                      'on_request', 21),
  ('hst-red-2-loop-panel',            'control-panels',         'hst',             null,           'لوحة 2loop الحمرة hst',                   'HST Red 2-Loop Panel',                  '{"loops":2}',                      'limited',    22),
  ('hst-red-4-loop-panel',            'control-panels',         'hst',             null,           'لوحة 4loop الحمرة hst',                   'HST Red 4-Loop Panel',                  '{"loops":4}',                      'on_request', 23),
  ('hst-addressable-mcp',             'manual-call-points',     'hst',             'addressable',  'كاسر معنون hst',                          'HST Addressable Manual Call Point',     '{}',                               'in_stock',   24),
  ('hst-addressable-smoke-detector',  'smoke-detectors',        'hst',             'addressable',  'حساس دخان معنون hst',                     'HST Addressable Smoke Detector',        '{}',                               'in_stock',   25),
  ('hst-addressable-heat-detector',   'heat-detectors',         'hst',             'addressable',  'حساس حرارة معنون hst',                    'HST Addressable Heat Detector',         '{}',                               'in_stock',   26),
  ('hst-addressable-multi-sensor-detector', 'multi-sensor-detectors', 'hst',        'addressable',  'حساس متعدد معنون hst',                    'HST Addressable Multi-Sensor Detector','{}',                               'in_stock',   27),
  ('hst-monitor-module',              'modules',                'hst',             'addressable',  'مونتور hst',                              'HST Monitor Module',                    '{}',                               'in_stock',   28),
  ('hst-control-module',              'modules',                'hst',             'addressable',  'كنترول hst',                              'HST Control Module',                    '{}',                               'limited',    29),
  ('hst-interface-module',            'modules',                'hst',             'addressable',  'انترفيس hst',                             'HST Interface Module',                  '{}',                               'limited',    30),
  ('conway-fire-alarm-panel',         'control-panels',         'conway',          null,           'لوحة اطفاء كونفوي',                       'Conway Fire Alarm Panel',               '{}',                               'limited',    31),
  ('hst-detector-base',               'detector-bases',         'hst',             null,           'قاعدة hst',                               'HST Detector Base',                     '{}',                               'in_stock',   32),
  ('snower-4-zone-panel',             'control-panels',         'snower',          null,           'لوحة 4 زون اسنوير',                       'Snower 4-Zone Panel',                   '{"zones":4}',                      'in_stock',   33),
  ('snower-8-zone-panel',             'control-panels',         'snower',          null,           'لوحة 8 زون اسنوير',                       'Snower 8-Zone Panel',                   '{"zones":8}',                      'limited',    34),
  ('snower-smoke-detector',           'smoke-detectors',        'snower',          null,           'حساس دخان اسنوير',                        'Snower Smoke Detector',                 '{}',                               'in_stock',   35),
  ('snower-heat-detector',            'heat-detectors',         'snower',          null,           'حساس حرارة اسنوير',                       'Snower Heat Detector',                  '{}',                               'in_stock',   36),
  ('snower-mcp',                      'manual-call-points',     'snower',          null,           'كاسر اسنوير',                             'Snower Manual Call Point',              '{}',                               'in_stock',   37),
  ('snower-siren',                    'sirens',                 'snower',          null,           'سرينة اسنوير',                            'Snower Siren',                         '{}',                               'in_stock',   38),
  ('snower-bell',                     'bells',                  'snower',          null,           'جرس اسنوير',                              'Snower Bell',                          '{}',                               'in_stock',   39),
  ('generic-chinese-mcp',             'manual-call-points',     'generic-chinese', null,           'كاسر صيني',                               'Generic (Chinese) Manual Call Point',   '{}',                               'in_stock',   40),
  ('generic-chinese-siren',           'sirens',                 'generic-chinese', null,           'سرينة صيني',                              'Generic (Chinese) Siren',               '{}',                               'in_stock',   41),
  ('generic-chinese-bell-24v',        'bells',                  'generic-chinese', null,           'جرس صيني 24 فولت',                        'Generic (Chinese) Bell 24V',            '{"voltage":24}',                   'in_stock',   42),
  ('generic-chinese-bell-220v',       'bells',                  'generic-chinese', null,           'جرس صيني 220 فولت',                       'Generic (Chinese) Bell 220V',           '{"voltage":220}',                  'in_stock',   43),
  ('generic-chinese-4-zone-panel',    'control-panels',         'generic-chinese', null,           'لوحة 4 زون صيني',                         'Generic (Chinese) 4-Zone Panel',        '{"zones":4}',                      'in_stock',   44),
  ('generic-chinese-beam-detector',   'beam-detectors',         'generic-chinese', null,           'بيم صيني',                                'Generic (Chinese) Beam Detector',       '{}',                               'in_stock',   45),
  ('generic-chinese-abort-switch',    'abort-switches',         'generic-chinese', null,           'ابورت صيني',                              'Generic (Chinese) Abort Switch',        '{}',                               'in_stock',   46),
  ('fire-search-extinguisher-6kg',    'extinguishers',          'generic-chinese', null,           'طفاية فاير سيرش 6 كيلو صيني',             'Fire Search Extinguisher 6kg (Chinese)','{"weight_kg":6}',                  'on_request', 47),
  ('fire-search-extinguisher-2kg',    'extinguishers',          'generic-chinese', null,           'طفاية فاير سيرش 2 كيلو صيني',             'Fire Search Extinguisher 2kg (Chinese)','{"weight_kg":2}',                  'on_request', 48),
  ('aluminum-cables',                 'cables',                 null,              null,           'كابلات الومنيوم',                         'Aluminum Cables',                      '{"material":"aluminum"}',          'on_request', 49),
  ('copper-cables',                   'cables',                 null,              null,           'كابلات نحاس',                             'Copper Cables',                        '{"material":"copper"}',            'on_request', 50),
  ('battery-2-3ah',                   'batteries',              null,              null,           'بطارية 2.3 امبير',                        '2.3 Ah Battery',                       '{"capacity_ah":2.3}',              'on_request', 51),
  ('battery-7ah',                     'batteries',              null,              null,           'بطارية 7 امبير',                          '7 Ah Battery',                         '{"capacity_ah":7}',                'in_stock',   52),
  ('tanda-beam-detector',             'beam-detectors',         'tanda',           null,           'بيم تاندا',                               'Tanda Beam Detector',                  '{}',                               'on_request', 53),
  ('ats-conventional-heat-detector',  'heat-detectors',         'ats',             'conventional', 'حساس حرارة تقليدي ats',                   'ATS Conventional Heat Detector',        '{}',                               'in_stock',   54),
  ('ats-detector-base',               'detector-bases',         'ats',             null,           'قاعدة ats',                               'ATS Detector Base',                    '{}',                               'in_stock',   55),
  ('apollo-fire-alarm-panel',         'control-panels',         'apollo',          null,           'لوحة اطفاء ابولو',                        'Apollo Fire Alarm Panel',               '{}',                               'in_stock',   56),
  ('apollo-2-zone-panel',             'control-panels',         'apollo',          null,           'لوحة 2 زون ابولو',                        'Apollo 2-Zone Panel',                   '{"zones":2}',                      'in_stock',   57),
  ('apollo-8-zone-panel',             'control-panels',         'apollo',          null,           'لوحة 8 زون ابولو',                        'Apollo 8-Zone Panel',                   '{"zones":8}',                      'limited',    58),
  ('apollo-1-loop-panel',             'control-panels',         'apollo',          null,           'لوحة 1لوب ابولو',                         'Apollo 1-Loop Panel',                   '{"loops":1}',                      'limited',    59),
  ('apollo-2-loop-panel',             'control-panels',         'apollo',          null,           'لوحة 2 لوب ابولو',                        'Apollo 2-Loop Panel',                   '{"loops":2}',                      'limited',    60),
  ('apollo-conventional-mcp',         'manual-call-points',     'apollo',          'conventional', 'كاسر ابولو تقليدي',                       'Apollo Conventional Manual Call Point', '{}',                               'in_stock',   61),
  ('apollo-conventional-smoke-detector', 'smoke-detectors',     'apollo',          'conventional', 'حساس دخان ابولو تقليدي',                  'Apollo Conventional Smoke Detector',    '{}',                               'in_stock',   62),
  ('apollo-conventional-heat-detector', 'heat-detectors',       'apollo',          'conventional', 'حساس حرارة ابولو تقليدي',                 'Apollo Conventional Heat Detector',     '{}',                               'limited',    63),
  ('apollo-detector-base',            'detector-bases',         'apollo',          null,           'قاعدة ابولو',                             'Apollo Detector Base',                  '{}',                               'in_stock',   64),
  ('hlt-conventional-smoke-detector', 'smoke-detectors',        'hlt',             'conventional', 'حساس دخان تقليدي hlt',                    'HLT Conventional Smoke Detector',       '{}',                               'in_stock',   65)
)
insert into public.products (slug, category_id, brand_id, system_type, name_ar, name_en, specs, availability, sort_order, is_published)
select
  s.slug,
  c.id,
  b.id,
  s.system,
  s.name_ar,
  s.name_en,
  s.specs,
  s.availability,
  s.sort_order,
  false
from s
join public.categories c on c.slug = s.category
left join public.brands b on b.slug = s.brand
on conflict (slug) do nothing;

-- ── Initial featured selection (8) — admin can change per product ────────
update public.products set is_featured = true
where slug in (
  'hst-economy-4-zone-panel', 'hst-silver-8-zone-panel',
  'hst-conventional-smoke-detector', 'hst-conventional-heat-detector',
  'hst-addressable-smoke-detector', 'hst-mcp',
  'hst-siren', 'battery-7ah'
);

-- ── Placeholder site content (D-005 / D-033) ─────────────────────────────
-- All of this is placeholder copy until the owner edits it in the admin (Phase 4).
-- Phone numbers are obviously fake; text is qualitative (no invented statistics).
insert into public.site_settings (key, value_ar, value_en)
select v.key, v.value_ar, v.value_en
from (values
  ('company_name', 'اسم الشركة', 'Company Name'),
  ('tagline', 'توريد أنظمة إنذار الحريق والكواشف والملحقات في مصر.',
             'Supply of fire alarm systems, detectors and accessories in Egypt.'),
  ('hours', 'السبت – الخميس · 9 ص – 6 م', 'Saturday – Thursday · 9 am – 6 pm'),
  ('address', 'القاهرة، مصر', 'Cairo, Egypt'),
  ('email', 'info@example.com', 'info@example.com'),
  ('map_url', 'https://www.google.com/maps/search/?api=1&query=Cairo%2C%20Egypt',
              'https://www.google.com/maps/search/?api=1&query=Cairo%2C%20Egypt'),
  ('hero_eyebrow', 'أنظمة إنذار ومكافحة الحريق', 'Fire alarm & suppression systems'),
  ('hero_title', 'حماية تبدأ *بالإنذار المبكر* لكل منشأة في مصر',
                 'Protection that starts with *early detection* for every facility'),
  ('hero_lead', 'لوحات تحكم، كواشف دخان وحرارة، سارينات وملحقات — تقليدية وعنونة — مع دعم فني قبل وبعد التركيب.',
                'Control panels, smoke and heat detectors, sirens and accessories — conventional and addressable — with technical support before and after installation.'),
  ('about_story', 'نص مؤقت يُحرر من لوحة التحكم — نبذة عن الشركة وخبراتها في مجال أنظمة إنذار الحريق.',
                  'Placeholder text edited from the admin — a short story about the company and its fire-alarm experience.'),
  ('about_vision', 'نص مؤقت يُحرر من لوحة التحكم — رؤية الشركة وقيمها.',
                   'Placeholder text edited from the admin — the company vision and values.'),
  ('why_1_title', 'خبرة فنية', 'Technical experience'),
  ('why_1_body', 'فريق متخصص في تصميم وتوريد أنظمة الإنذار التقليدية والعنونة.',
                 'A specialist team for designing and supplying conventional and addressable alarm systems.'),
  ('why_2_title', 'ضمان معتمد', 'Certified warranty'),
  ('why_2_body', 'جميع المنتجات بضمان الوكيل وشهادات مطابقة.',
                 'All products carry distributor warranty and compliance certificates.'),
  ('why_3_title', 'دعم بعد البيع', 'After-sales support'),
  ('why_3_body', 'متابعة فنية واستشارات اختيار المعدات المناسبة لمشروعك.',
                 'Technical follow-up and advice on choosing the right equipment for your project.')
) as v(key, value_ar, value_en)
on conflict (key) do nothing;

-- Placeholder contact numbers (obviously fake E.164 numbers, D-005).
insert into public.contact_numbers (label_ar, label_en, number, is_whatsapp, sort_order)
select v.label_ar, v.label_en, v.number, v.is_whatsapp, v.sort_order
from (values
  ('مبيعات', 'Sales', '+201030006425', true, 1),
  ('دعم فني', 'Technical support', '+201042956387', false, 2)
) as v(label_ar, label_en, number, is_whatsapp, sort_order)
where not exists (select 1 from public.contact_numbers);

-- Placeholder social links (obviously fake page URLs, D-005).
insert into public.social_links (platform, url, sort_order)
select v.platform, v.url, v.sort_order
from (values
  ('facebook', 'https://www.facebook.com/your-page', 1),
  ('instagram', 'https://www.instagram.com/your-page', 2),
  ('youtube', 'https://www.youtube.com/@your-channel', 3)
) as v(platform, url, sort_order)
where not exists (select 1 from public.social_links);
