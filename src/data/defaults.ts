import type { FormTemplate, SeasonPoster, SiteSettings } from '../types';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'alforat.rayt@gmail.com';

export const ASSET_IMAGES = {
  heroHaramain: '/src/assets/images/hero_haramain_sunrise_1795450843399.jpg',
  makkahMadinah: '/src/assets/images/pkg_makkah_madinah_1795450843390.jpg',
  makkahUmrah: '/src/assets/images/pkg_makkah_umrah_1795450842159.jpg',
  turkeyFamily: '/src/assets/images/pkg_turkey_family_1795450843842.jpg',
  europeHoneymoon: '/src/assets/images/pkg_europe_honeymoon_1795450843916.jpg',
  officialPoster: '/assets/aistudio/IMG-20261011-WA0028_c16eeed7.jpg',
};

export const CURATED_PACKAGE_IMAGES = [
  { label: 'المدينة المنورة — المسجد النبوي', url: ASSET_IMAGES.makkahMadinah },
  { label: 'مكة المكرمة — المسجد الحرام', url: ASSET_IMAGES.makkahUmrah },
  { label: 'إطلالة الحرمين الشريفين', url: ASSET_IMAGES.heroHaramain },
  { label: 'إسطنبول والبوسفور — تركيا', url: ASSET_IMAGES.turkeyFamily },
  { label: 'جبال الألب والبحيرات — سويسرا', url: ASSET_IMAGES.europeHoneymoon },
];

export const DEFAULT_SEASON_POSTERS: SeasonPoster[] = [
  {
    id: 'poster_official_oct2026',
    title: 'إعلان رحلات أكتوبر 2026 — مكة المكرمة والمدينة المنورة',
    subtitle: 'الرحلة الأولى 299 ريال (3 أيام) · الرحلة الثانية 199 ريال (يومان)',
    imageUrl: ASSET_IMAGES.officialPoster,
    active: true,
    order: 1,
  },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  agencyName: 'راية الفُرات',
  agencySubtitle: 'للسفر والسياحة',
  tagline: 'رحلات .. إيمان .. ذكريات لا تُنسى',
  licenseNumber: '',
  logoUrl: '',
  primaryColor: '#0F332B',
  secondaryColor: '#0E6E73',
  accentColor: '#B88E3E',
  bgColor: '#F8F4EC',
  heroTitle: 'رحلات إيمانية وسياحية مُنظَّمة بعناية تليق بضيوفنا',
  heroSubtitle:
    'باقات متكاملة إلى مكة المكرمة والمدينة المنورة والوجهات السياحية المختارة، مع نقل فندقي مريح، إرشاد ديني معتمد، وحجز إلكتروني فوري.',
  welcomePhrase: 'نرحب بكم في رحلاتنا',
  contacts: [
    { label: 'بوغريب', phone: '0540941665' },
    { label: 'بو فاطمه', phone: '0531324242' },
    { label: 'المكتب', phone: '0536586126' },
  ],
  email: 'alforat.rayt@gmail.com',
  address: 'المملكة العربية السعودية — الأحساء',
  whatsappNumber: '966536586126',
  instagramUrl: 'https://instagram.com',
  twitterUrl: 'https://x.com',
  snapchatUrl: 'https://snapchat.com',
  termsAndConditions:
    '1. يُعد الحجز مبدئياً إلى حين مراجعة بيانات المسافرين وتأكيد السداد من قِبل مكتب راية الفُرات للسفر والسياحة.\n2. يلتزم المسافر بتقديم هوية وطنية أو إقامة أو جواز سفر ساري المفعول وفق متطلبات كل رحلة.\n3. يُرجى التواجد في نقطة الانطلاق قبل الموعد المحدد بـ 45 دقيقة على الأقل.\n4. يلتزم المكتب بتوفير السكن الفندقي والنقل والإرشاد الديني المذكور في تفاصيل الباقة.',
  defaultCancellationPolicy:
    '• الإلغاء قبل موعد الرحلة بـ 7 أيام أو أكثر: استرداد كامل المبلغ.\n• الإلغاء قبل موعد الرحلة بـ 3 إلى 6 أيام: خصم 25% رسوم حجز فندقي.\n• الإلغاء قبل موعد الرحلة بأقل من 48 ساعة: لا يمكن استرداد المبلغ، ويمكن تحويل المقعد لمسافر بديل بعد التنسيق مع المكتب.',
};

export const DEFAULT_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'form_umrah_domestic',
    name: 'استمارة رحلات العمرة والرحلات الداخلية',
    description: 'نموذج مخصص لرحلات مكة المكرمة والمدينة المنورة يتطلب الهوية الوطنية أو الإقامة وتفضيلات السكن.',
    isDefault: true,
    fields: [
      {
        id: 'full_name',
        label: 'الاسم الرباعي (كما في الهوية)',
        type: 'text',
        required: true,
        placeholder: 'مثال: محمد عبدالله علي السالم',
      },
      {
        id: 'national_id',
        label: 'رقم الهوية الوطنية / الإقامة',
        type: 'number',
        required: true,
        placeholder: '10XXXXXXXX',
      },
      {
        id: 'birth_date',
        label: 'تاريخ الميلاد',
        type: 'date',
        required: true,
      },
      {
        id: 'gender',
        label: 'الجنس',
        type: 'radio',
        required: true,
        options: ['ذكر', 'أنثى'],
      },
      {
        id: 'room_type',
        label: 'تفضيل الغرفة الفندقية',
        type: 'select',
        required: true,
        options: ['غرفة رباعية (ضمن الباقة)', 'غرفة ثلاثية', 'غرفة ثنائية خاصة (برسوم إضافية)'],
      },
      {
        id: 'id_document',
        label: 'صورة الهوية الوطنية أو الإقامة',
        type: 'file',
        required: true,
        helpText: 'يُقبل ملف صورة واضح (JPG / PNG) أو PDF',
      },
      {
        id: 'special_needs',
        label: 'ملاحظات صحية أو كرسي متحرك (اختياري)',
        type: 'text',
        required: false,
        placeholder: 'اتركه فارغاً في حال عدم وجود متطلبات خاصة',
      },
    ],
  },
  {
    id: 'form_international_visa',
    name: 'استمارة الرحلات الدولية وتأشيرة الشنغن',
    description: 'نموذج متقدم لباقات أوروبا والرحلات الدولية يتضمن بيانات الجواز وحالة التأشيرة والتأمين.',
    isDefault: false,
    fields: [
      {
        id: 'english_name',
        label: 'الاسم الكامل بالإنجليزية (مطابق لجواز السفر)',
        type: 'text',
        required: true,
        placeholder: 'MOHAMMED ABDULLAH ALSALEM',
      },
      {
        id: 'passport_number',
        label: 'رقم جواز السفر',
        type: 'text',
        required: true,
        placeholder: 'P12345678',
      },
      {
        id: 'passport_expiry',
        label: 'تاريخ انتهاء جواز السفر',
        type: 'date',
        required: true,
        helpText: 'يجب أن يكون الجواز سارياً لمدة لا تقل عن 6 أشهر',
      },
      {
        id: 'visa_status',
        label: 'حالة تأشيرة الدخول (الشنغن)',
        type: 'select',
        required: true,
        options: [
          'لدي تأشيرة شنغن سارية',
          'أحتاج مساعدة المكتب في استخراج التأشيرة',
          'أحمل جوازاً معفياً من التأشيرة',
        ],
      },
      {
        id: 'addons',
        label: 'خدمات إضافية مطلوبة',
        type: 'multiselect',
        required: false,
        options: ['تأمين سفر طبي شامل', 'استقبال VIP من المطار', 'وجبة حلال خاصة بالطائرة', 'ترقية درجة المقعد'],
      },
      {
        id: 'passport_scan',
        label: 'صورة صفحة البيانات في جواز السفر',
        type: 'file',
        required: true,
        helpText: 'صورة واضحة لصفحة الصورة والبيانات في الجواز',
      },
    ],
  },
  {
    id: 'form_family_turkey',
    name: 'استمارة الرحلات العائلية — تركيا والوجهات الإقليمية',
    description: 'نموذج مخصص للرحلات السياحية العائلية يشمل الجواز وصلة القرابة وتفضيل الجولات.',
    isDefault: false,
    fields: [
      {
        id: 'english_name',
        label: 'الاسم بالإنجليزية كما في الجواز',
        type: 'text',
        required: true,
        placeholder: 'AHMED SALEM',
      },
      {
        id: 'passport_number',
        label: 'رقم جواز السفر',
        type: 'text',
        required: true,
        placeholder: 'G87654321',
      },
      {
        id: 'relation',
        label: 'صلة القرابة بصاحب الحجز',
        type: 'select',
        required: true,
        options: ['المسافر الرئيسي', 'زوج / زوجة', 'ابن / ابنة', 'والد / والدة', 'مرافق'],
      },
      {
        id: 'birth_date',
        label: 'تاريخ الميلاد',
        type: 'date',
        required: true,
      },
      {
        id: 'passport_copy',
        label: 'صورة جواز السفر',
        type: 'file',
        required: true,
      },
    ],
  },
];

