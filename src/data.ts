import { Patient, TurnLog } from "./types";

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: "p1",
    name: "الحاج عبد الرحمن الشمري",
    bedNo: "A-204",
    age: 72,
    admissionReason: "جلطة دماغية حادة شلت الجانب الأيسر بالكامل مع فقدان الوعي الجزئي (شبه غيبوبة)",
    lastClinicalText: "المريض طريح الفراش تماماً ولا يستجيب لتنبيهات الألم بشكل طبيعي. هناك رطوبة مستمرة ومفرطة بسبب العرق الكثيف وسلس البول للمثانة العصبية. التغذية معتمدة كلياً على الأنبوب الأنفي المعدي، وجلده رقيق جداً مع بوادر احمرار عند الفقرات العجزية بسبب قوى الاحتكاك والقص أثناء تحريكه.",
    bradenScore: {
      sensoryPerception: 1, // Completely limited
      moisture: 1,          // Constantly moist
      activity: 1,          // Bedfast
      mobility: 1,          // Completely immobile
      nutrition: 2,         // Probably inadequate
      frictionShear: 1,     // Problem
      total: 7
    },
    riskLevel: "Severe Risk",
    riskLevelArabic: "خطورة بالغة جداً (Severe Risk)",
    turningIntervalHours: 1.5,
    nextTurningTime: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
    isEscalated: false,
    qrCodeValue: "BEDS-A204_ABDULRAHMAN",
    scanStatus: "PENDING_SCAN",
    existingUlcers: ["منطقة العجز (أسفل الظهر)", "الكعب الأيمن"]
  },
  {
    id: "p2",
    name: "الأستاذ سمير الهاشمي",
    bedNo: "B-108",
    age: 58,
    admissionReason: "عملية تثبيت معقدة لكسر عظمة الفخذ والعمود الفقري السفلي إثر حادث مروري",
    lastClinicalText: "المريض في كامل وعيه ويتحسس الآلام بشكل ممتاز، ولكنه يعاني من عجز حركي قسري بالسرير بسبب جبائر القدم والتثبيت الفقري. جلده جاف في معظم الأوقات باستثناء رطوبة بسيطة أثناء تغيير الملاءات. يتناول وجباته بشكل طبيعي بنظام غني بالبروتين، ولديه قدرة على مساعدة الممرض جزئياً برفع الجزء العلوي باستخدام الرافعة العلاجية لتلافي الاحتكاك.",
    bradenScore: {
      sensoryPerception: 4, // No impairment
      moisture: 3,          // Occasionally moist
      activity: 1,          // Bedfast
      mobility: 2,          // Very limited
      nutrition: 4,         // Excellent
      frictionShear: 3,     // No apparent problem
      total: 17
    },
    riskLevel: "Low Risk",
    riskLevelArabic: "خطورة منخفضة (Low Risk)",
    turningIntervalHours: 4.0,
    nextTurningTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    isEscalated: false,
    qrCodeValue: "BEDS-B108_SAMEER",
    scanStatus: "VERIFIED"
  },
  {
    id: "p3",
    name: "الوالدة عائشة الحربي",
    bedNo: "C-302",
    age: 81,
    admissionReason: "قصور كلوي حاد مع ضعف شديد بالبنية الجسدية وهشاشة العظام مع زهايمر متقدم",
    lastClinicalText: "المريضة تستجيب فقط للأصوات العالية والألم العنيف وتتألم بالتحريك. السلس البولي متكرر ويسبب بللاً مستمراً للملابس والملاءات. تعتذر عن تناول معظم الوجبات وتكتفي بالسوائل، وتتحرك بالسرير حركة عشوائية ضعيفة تؤدي لاحتكاك دائم لمناطق أسفل الظهر مع الشراشف الجافة.",
    bradenScore: {
      sensoryPerception: 2, // Very limited
      moisture: 2,          // Very moist
      activity: 1,          // Bedfast
      mobility: 2,          // Very limited
      nutrition: 1,         // Very poor
      frictionShear: 1,     // Problem
      total: 9
    },
    riskLevel: "Severe Risk",
    riskLevelArabic: "خطورة بالغة (Severe Risk)",
    turningIntervalHours: 1.5,
    nextTurningTime: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
    isEscalated: false,
    qrCodeValue: "BEDS-C302_AISHA",
    scanStatus: "PENDING_SCAN",
    existingUlcers: ["الورك الأيسر"]
  }
];

export const INITIAL_LOGS: TurnLog[] = [
  {
    id: "l1",
    patientId: "p1",
    patientName: "الحاج عبد الرحمن الشمري",
    bedNo: "A-204",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    actionTaken: "تقليب كامل على الجانب الأيمن بزاوية 30 درجة وتدعيم الظهر بالوسادة الهوائية.",
    nurseNotes: "تم الحفاظ على جفاف الجلد وتطبيق مرطب العزل. المريض لا يستطيع الحركة بنفسه.",
    bradenScoreText: "مقياس برادن: 7 (خطورة بالغة جداً)",
    isEscalated: false,
    verificationMethod: "QR_BEDSIDE_SCAN",
    status: "COMPLIANT"
  },
  {
    id: "l2",
    patientId: "p3",
    patientName: "الوالدة عائشة الحربي",
    bedNo: "C-302",
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    actionTaken: "محاولة تأخير التقليب مجدولة لعدم تفرغ الكادر بسبب حالة حرجة بالقسم الرئيسي.",
    nurseNotes: "تأخير غير مصرح به لظروف تشغيلية بالقسم.",
    bradenScoreText: "مقياس برادن: 9 (خطورة بالغة)",
    isEscalated: true,
    verificationMethod: "STALE_VIOLATION",
    status: "VIOLATION"
  }
];

export const ARABIC_SAMPLE_LOGS = [
  {
    label: "غيبوبة تامة مع سلس مستمر (Severe Risk)",
    text: "المريض فاقد الوعي تماماً بالرعاية المركزة بوضعية النوم على الظهر. رطوبة الجلد عالية جداً بسبب التعرق المستمر وسلس بول غير متحكم به بالمكانس. لا يستجيب للآلام ولا يتحرك مطلقاً. التغذية ضعيفة جداً سائلة بالأنبوب، تظهر علامات احمرار خفيف أسفل منطقة الظهر والعصعص مع احتكاك بملاءات الفراش."
  },
  {
    label: "شلل نصفي وبشرة رطبة (High Risk)",
    text: "مريض يعاني من شلل شقي كامل بالجانب الأيمن. يستجيب لفظياً وصعوبة بالغة بالحركة الذاتية. رطوبة الجلد متوسطة نتيجة رجه متعرق. التغذية مقبولة نسبياً للمأكولات الطرية. تلاحظ قوى قص عالية أثناء محاولات تعديل جلسته بالسرير لرفع رأسه."
  },
  {
    label: "تحرك بسيط مع نوبة نقاهة (Moderate Risk)",
    text: "مريض في فترة النقاهة بعد جراحة دقيقة بالبطن. الحركة محدودة ومؤلمة مع استجابة حسية منزعجة للألم. مستوى الرطوبة طبيعي إجمالاً، والتغذية جيدة متكاملة ولكنه يحتاج لمساعدة خفيفة للالتفاف لتفادي احتكاك خط الجرح."
  }
];
