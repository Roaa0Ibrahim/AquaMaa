/* Arabic for every page (14 Nov). When the page is in Arabic (the عربي button: <html lang="ar">), this translates the
 * text the dashboard draws, on every page and after every live update: exact labels from the dictionary below, then
 * patterns for text with numbers ("3 wells", "Last 24 hours", "5 min ago"). Placeholders and tooltips too.
 * Not translated: the AquaMaa chat box (it has its own language button), what people type, and names (wells, crops
 * typed by the user, device IDs). English mode is untouched.
 */
(function () {
  'use strict';
  const T = {
    // sign in
    'Groundwater Intelligence': 'ذكاء المياه الجوفية', 'Sign in': 'تسجيل الدخول', 'Email': 'البريد الإلكتروني', 'Password': 'كلمة المرور',
    "Turning groundwater data into smarter decisions for Qatar's water future.": 'نحوّل بيانات المياه الجوفية إلى قرارات أذكى لمستقبل المياه في قطر.',
    'Demonstration accounts (click to fill email):': 'حسابات العرض التجريبي (اضغط لتعبئة البريد):', 'Connecting…': 'جارٍ الاتصال…', 'Loading…': 'جارٍ التحميل…',
    'Groundwater Monitoring Officer': 'مسؤولة مراقبة المياه الجوفية', 'Farm owner': 'صاحب مزرعة',
    'Ministry of Environment and Climate Change': 'وزارة البيئة والتغير المناخي', 'Al Khor farm': 'مزرعة الخور',
    // dashboard
    'Annual': 'سنوي', 'Extraction MCM / year': 'الاستخراج (مليون م³ / سنة)', 'Comparison ratio': 'نسبة المقارنة', 'Safe yield MCM / year': 'العائد الآمن (مليون م³ / سنة)',
    'Estimated safe yield': 'العائد الآمن المقدّر', 'No extraction record for this year.': 'لا يوجد سجل استخراج لهذه السنة.',
    'INSIGHT FOR YOUR ROLE': 'رؤية لدورك', 'Million m³ / year': 'مليون م³ / سنة', 'No sector data for this year.': 'لا توجد بيانات قطاعية لهذه السنة.',
    'Not enough data.': 'لا توجد بيانات كافية.', 'State of Qatar': 'دولة قطر', 'TDS ppm': 'الأملاح الذائبة (جزء في المليون)',
    'wells': 'آبار', 'stations': 'محطات', 'Agriculture': 'الزراعة', 'Municipal': 'البلدية', 'Industrial': 'الصناعة',
    // map, wells, quality, extraction
    'Wells and monitoring stations. Coordinates are demonstration values.': 'الآبار ومحطات المراقبة. الإحداثيات قيم تجريبية.',
    'LAYERS': 'الطبقات', 'Wells': 'الآبار', 'Monitoring stations': 'محطات المراقبة', 'Wells with data gaps': 'آبار بها فجوات بيانات',
    'Red station marker = inactive.': 'علامة المحطة الحمراء = غير نشطة.', 'No matching records': 'لا توجد سجلات مطابقة', 'MONITORING STATIONS': 'محطات المراقبة',
    'No data': 'لا توجد بيانات', 'REGISTERED WELLS · DEMONSTRATION DATA': 'الآبار المسجلة · بيانات تجريبية', '≤ threshold': '≤ الحد', 'above threshold': 'أعلى من الحد',
    'Filter wells…': 'تصفية الآبار…', 'Code': 'الرمز', 'Name': 'الاسم', 'Aquifer': 'الخزان الجوفي', 'Depth (m)': 'العمق (م)', 'TDS (mg/L)': 'الأملاح الذائبة (ملغم/لتر)',
    'Station': 'المحطة', 'Last measured': 'آخر قياس', 'Status': 'الحالة', 'Readings 2022': 'قراءات 2022', 'Data': 'البيانات', 'Year': 'السنة', 'Total (MCM)': 'الإجمالي (مليون م³)',
    'active': 'نشطة', 'inactive': 'غير نشطة', 'Rus': 'الرس', 'Umm Er Radhuma': 'أم الرضمة',
    // reports, notifications, settings
    'Mark read': 'تعليم كمقروء', 'Export current platform data as CSV. Exports include each record\'s data status.': 'صدّر بيانات المنصة الحالية بصيغة CSV. يتضمن التصدير حالة بيانات كل سجل.',
    'Role': 'الدور', 'Institution': 'المؤسسة', 'Back to dashboard': 'العودة إلى لوحة المعلومات', 'Something went wrong': 'حدث خطأ',
    'Language': 'اللغة', 'Account': 'الحساب', 'Profile': 'الملف الشخصي', 'Download': 'تنزيل', 'Export': 'تصدير',
    // live sensors (dashboard and quality pages, status bar)
    'Preliminary': 'أولي', 'No readings in this period': 'لا توجد قراءات في هذه الفترة', 'Sensor data unavailable': 'بيانات الحساسات غير متاحة',
    'Preliminary sensor-based indicator': 'مؤشر أولي مبني على الحساسات', 'Parameters with valid data': 'المؤشرات ذات البيانات الصالحة',
    'Outside thresholds': 'خارج الحدود', 'Devices needing attention': 'أجهزة تحتاج انتباهًا', 'Devices offline': 'أجهزة غير متصلة',
    'Parameter': 'المؤشر', 'Network value': 'قيمة الشبكة', 'Reference': 'المرجع', 'Connectivity & alerts': 'الاتصال والتنبيهات', 'Well': 'البئر',
    'Sensors': 'الحساسات', 'Last reading': 'آخر قراءة', 'Turb. raw': 'العكارة (خام)', 'No wells': 'لا توجد آبار', 'Sensor': 'الحساس', 'No devices': 'لا توجد أجهزة',
    'LIVE SENSOR ANALYTICS': 'تحليلات الحساسات المباشرة', 'Device': 'الجهاز', 'All devices (network)': 'كل الأجهزة (الشبكة)', 'Database error': 'خطأ في قاعدة البيانات',
    'Unavailable': 'غير متاح', 'Loading': 'جارٍ التحميل', 'No readings': 'لا توجد قراءات', 'raw reading · not NTU': 'قراءة خام · ليست NTU', 'Raw reading · not NTU': 'قراءة خام · ليست NTU',
    'pH over time': 'درجة الحموضة عبر الزمن', 'Temperature over time': 'الحرارة عبر الزمن', 'TDS over time': 'الأملاح الذائبة عبر الزمن',
    'Turbidity (raw) over time': 'العكارة (خام) عبر الزمن', 'ppm': 'جزء في المليون', 'raw': 'خام', 'Not started': 'لم يبدأ',
    'Last 24 hours': 'آخر 24 ساعة', 'Last 7 days': 'آخر 7 أيام', 'Last 30 days': 'آخر 30 يومًا', 'Within reference': 'ضمن المرجع', 'Not assessed': 'غير مُقيَّم',
    'Awaiting calibration': 'بانتظار المعايرة', 'Not configured': 'غير مُعد', 'No threshold set': 'لا يوجد حد محدد', 'Unusual change': 'تغير غير معتاد',
    'Reporting': 'يرسل', 'Not calibrated': 'غير معايَر', 'Turbidity': 'العكارة', 'Online': 'متصل', 'Offline': 'غير متصل', 'pH': 'درجة الحموضة',
    'Water temperature': 'درجة حرارة الماء', 'Total dissolved solids': 'الأملاح الذائبة الكلية', 'Latest per well': 'آخر قراءة لكل بئر',
    'Last known value': 'آخر قيمة معروفة', 'Above reference': 'أعلى من المرجع', 'Below reference': 'أقل من المرجع', 'Normal': 'طبيعي', 'Attention': 'انتباه',
    'Insufficient Data': 'بيانات غير كافية', 'Neutral': 'متعادل', 'Acidic': 'حمضي', 'Alkaline': 'قلوي', 'Stale': 'قديمة',
    // data status tags
    'Verified': 'موثّق', 'Official': 'رسمي', 'Measured': 'مقاس', 'Estimated': 'تقديري', 'Modelled': 'نموذجي', 'Demonstration': 'تجريبي',
  };
  const RULES = [
    [/^Live · (\d+)s$/, 'مباشر · كل $1 ث'], [/^(\d+) active$/, '$1 نشطة'], [/^(\d+) wells?$/, '$1 آبار'], [/^(\d+) stations?$/, '$1 محطات'],
    [/^(\d+) min ago$/, 'قبل $1 دقيقة'], [/^(\d+) h ago$/, 'قبل $1 ساعة'], [/^(\d+) d ago$/, 'قبل $1 يوم'], [/^just now$/, 'الآن'],
    [/Sensor data updated/, 'آخر تحديث لبيانات الحساسات'], [/devices reporting/, 'أجهزة ترسل'], [/^Sensors:$/, 'الحساسات:'], [/\bof\b/g, 'من'],
    [/(\d+) wells? with data/, '$1 آبار بها بيانات'], [/without data/, 'بدون بيانات'], [/demonstration data/gi, 'بيانات تجريبية'],
    [/registered wells/gi, 'آبار مسجلة'], [/monitoring stations/gi, 'محطات مراقبة'], [/All records are/gi, 'كل السجلات'],
  ];
  const SKIP = 'script,style,textarea,input,select option,[class*="aq-"],.well-head h3,.mono,code';

  function tr(text) {
    const key = text.trim();
    if (!key || /[؀-ۿ]/.test(key) || !/[A-Za-z]/.test(key)) return null;
    if (T[key]) return text.replace(key, T[key]);
    let out = key, hit = false;
    for (const [re, ar] of RULES) if (re.test(out)) { out = out.replace(re, ar); hit = true; }
    return hit ? text.replace(key, out) : null;
  }

  function translate(root) {
    if (document.documentElement.lang !== 'ar' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const n of nodes) {
      const el = n.parentElement;
      if (!el || el.closest(SKIP)) continue;
      const t = tr(n.nodeValue);
      if (t !== null && t !== n.nodeValue) n.nodeValue = t;
    }
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    for (const el of els) {
      if (el.closest('[class*="aq-"]')) continue;
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        const t = v && tr(v);
        if (t && t !== v) el.setAttribute(a, t);
      }
    }
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending || document.documentElement.lang !== 'ar') return;
    pending = true;
    requestAnimationFrame(() => { pending = false; translate(document.getElementById('app')); translate(document.getElementById('login')); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['lang'] });
  new MutationObserver(() => { translate(document.getElementById('app')); translate(document.getElementById('login')); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
