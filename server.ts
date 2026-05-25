import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import webpush from "web-push";
import Pusher from "pusher";

dotenv.config();

// Pusher Setup
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "mock_id",
  key: process.env.PUSHER_KEY || "mock_key",
  secret: process.env.PUSHER_SECRET || "mock_secret",
  cluster: process.env.PUSHER_CLUSTER || "eu",
  useTLS: true
});

// Web Push Setup
const publicVapidKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLcg05SR1oE8";
const privateVapidKey = "iU_O40P4D9ZkSps3Eksd6PqZ0JgWd5_P_4Z71VlXN7k";
webpush.setVapidDetails("mailto:admin@bedsoreguardian.com", publicVapidKey, privateVapidKey);

// Initialize Express
const app = express();
app.use(express.json());

const PORT = 3000;

// Push Subscriptions Store
let subscriptions: any[] = [];

app.post("/api/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscriptions.some(s => s.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
  }
  res.status(201).json({});
});

let globalSirenActive = false;

app.post("/api/admin/siren", (req, res) => {
  globalSirenActive = true;
  pusher.trigger("bedsore-guardian", "siren-state", { active: true }).catch(console.error);
  // Send push notification to all subscribers
  const payload = {
    title: "🚨 إنذار عاجل للممرضين",
    body: "الرجاء الالتزام بجدول تقليب المرضي وعمل غيار علي القرح ان وجدت. إن الله يراك. شكرا لمجهودك العظيم.",
    type: "siren"
  };
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify(payload)).catch(e => console.error("Push error", e));
  });
  res.json({ success: true });
});

app.post("/api/admin/siren/stop", (req, res) => {
  globalSirenActive = false;
  pusher.trigger("bedsore-guardian", "siren-state", { active: false }).catch(console.error);
  res.json({ success: true });
});

app.get("/api/siren-status", (req, res) => {
  res.json({ active: globalSirenActive });
});

// Server-side Cron for Sending Background Notifications
let lastSentAlertTime = "";

setInterval(() => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isTargetHourContext = currentHour % 2 !== 0; // 1, 3, 5...
  const nextHourIsOdd = (currentHour + 1) % 2 !== 0; // if current is 0, 2, 4

  let payload = null;

  // Alert 10 minutes before the odd hour
  if (nextHourIsOdd && currentMinute === 50) {
    const key = `pre-${currentHour}`;
    if (lastSentAlertTime !== key) {
      lastSentAlertTime = key;
      payload = {
        title: "تنبيه: اقترب موعد التقليب الافتراضي!",
        body: `بقي 10 دقائق لموعد التقليب القادم (الساعة ${currentHour + 1}:00). الرجاء الاستعداد.`,
        type: "pre-alert"
      };
    }
  }

  // Alert exactly on the odd hour
  if (isTargetHourContext && currentMinute === 0) {
    const key = `alert-${currentHour}`;
    if (lastSentAlertTime !== key) {
      lastSentAlertTime = key;
      payload = {
        title: "تنبيه عاجل: موعد التقليب الآني!",
        body: `الساعة الآن ${currentHour}:00. حان الوقت لإجراء التقليب الإلزامي لجميع المرضى المدرجين بالجدول.`,
        type: "alert"
      };
    }
  }

  if (payload) {
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
        console.error("Push error:", err);
      });
    });
  }
}, 30000); // check every 30s


// Lazy initialize Gemini AI with safe check
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set correctly. Using fallback algorithmic evaluator.");
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Fallback logic when Gemini API key is missing or calls fail
function performAlgorithmicEvaluation(clinicalText: string, isDelayAttempted: boolean, delayReason: string) {
  // Simple NLP checking for Braden factors in Arabic and English
  const textLower = (clinicalText || "").toLowerCase();
  
  // Scoring parameters initialized to decent defaults
  let sensoryPerception = 3; // slightly limited
  let moisture = 3;          // occasionally moist
  let activity = 2;          // chairfast
  let mobility = 2;          // very limited
  let nutrition = 2;         // probably inadequate
  let frictionShear = 2;      // potential problem

  // Heuristics for sensory
  if (textLower.includes("لا يشعر") || textLower.includes("غيبوبة") || textLower.includes("coma") || textLower.includes("paralyzed") || textLower.includes("شلل")) {
    sensoryPerception = 1; // completely limited
  } else if (textLower.includes("محدود جزي") || textLower.includes("limited perception") || textLower.includes("ضعف إحساس")) {
    sensoryPerception = 2;
  }

  // Heuristics for moisture
  if (textLower.includes("عرق دائم") || textLower.includes("رطوبة مستمرة") || textLower.includes("constantly moist") || textLower.includes("سلس بول") || textLower.includes("incontinence")) {
    moisture = 1; // constantly moist
  } else if (textLower.includes("رطب جدا") || textLower.includes("very moist") || textLower.includes("مبلل")) {
    moisture = 2;
  }

  // Heuristics for activity and mobility
  if (textLower.includes("طريح الفراش") || textLower.includes("bedridden") || textLower.includes("لا يتحرك") || textLower.includes("immobile")) {
    activity = 1;
    mobility = 1;
  } else if (textLower.includes("كرسي متحرك") || textLower.includes("wheelchair") || textLower.includes("chairfast")) {
    activity = 2;
    mobility = 2;
  }

  // Heuristics for nutrition
  if (textLower.includes("سؤ تغذية") || textLower.includes("لا يأكل") || textLower.includes("nutrition poor") || textLower.includes("ضعيف جدا") || textLower.includes("poor diet")) {
    nutrition = 1;
  }

  // Heuristics for friction & shear
  if (textLower.includes("انزلاق") || textLower.includes("friction") || textLower.includes("shear") || textLower.includes("احتكاك")) {
    frictionShear = 1; // problem
  }

  const totalScore = sensoryPerception + moisture + activity + mobility + nutrition + frictionShear;
  
  let riskLevel = "Low Risk";
  let riskLevelArabic = "خطورة منخفضة (Low Risk)";
  let turningHours = 4.0;

  if (totalScore <= 9) {
    riskLevel = "Severe Risk";
    riskLevelArabic = "خطورة بالغة (Severe Risk)";
    turningHours = 1.5;
  } else if (totalScore <= 12) {
    riskLevel = "High Risk";
    riskLevelArabic = "خطورة عالية (High Risk)";
    turningHours = 2.0;
  } else if (totalScore <= 14) {
    riskLevel = "Moderate Risk";
    riskLevelArabic = "خطورة متوسطة (Moderate Risk)";
    turningHours = 3.0;
  } else if (totalScore <= 18) {
    riskLevel = "Low Risk";
    riskLevelArabic = "خطورة منخفضة (Low Risk)";
    turningHours = 4.0;
  } else {
    riskLevel = "Low Risk";
    riskLevelArabic = "لا توجد خطورة تذكر (No Risk)";
    turningHours = 4.0;
  }

  const isEscalated = isDelayAttempted;
  
  // Assemble beautiful Medical Arabic Markdown
  let marker = isEscalated ? "⚠️ **Escalation Status: CRITICAL / حالة التصعيد: حرجة** ⚠️" : "✅ **Status: Active Monitoring / حالة المراقبة: نشطة**";
  
  const immediateAction = `**الإجراء الفوري المطلوب**:\n` +
    `1. البدء ببروتوكول الوقاية من قرح الفراش المعتمد بالفئة لخطورة (${riskLevelArabic}).\n` +
    `2. المحافظة التامة على جفاف الجلد وبخاصة مناطق الضغط العظمي (الردفين، الكعبين، ولوحي الكتف).\n` +
    `3. استبدال مفروشات السرير بملاءات نفاذة للهواء ومقاومة للرطوبة لتجنب التميع الحكّي للجلد (Incontinence-associated dermatitis).\n` +
    `4. استخدام مرطبات عازلة مصممة لمنع نضح السوائل وإجراء فحص جلدي شامل في كل نوبة تقليب.`;

  const nextTurningInstructions = `**تعليمات التقليب القادم**:\n` +
    `- الالتزام الصارم بـ **معدل التقليب كل ${turningHours} ساعة** تبعاً لتصنيف Braden لدرجات الخطورة العالية.\n` +
    `- تطبيق مناورات تخفيف الضغط بزاوية 30 درجة مائلة وجدولة السحب بالملاءات لتلافي قوى القص الاحتكاكية.\n` +
    `- استخدام مخدات إسفنجية لتأمين الكعبين طوال الوقت.`;

  const escalationWarning = isEscalated ?
    `🛑 **تحذير طبي قانوني صارم**: تم رصد إبلاغ عن تأخير في التقليب أو محاولة تأجيل غير مصرح بها. السبب المقدم: "${delayReason || 'غير محدد'}". هذا يشكل انتهاكاً لبروتوكول السلامة الإلزامي وقد يؤدي إلى إلحاق الضرر بالمريض.` :
    `🟢 **الالتزام بالجدول**: لا توجد محاولات تأخير مرصودة حالياً. الاستمرار في الالتزام بالجدول لضمان جودة الرعاية.`;

  return {
    bradenScore: {
      sensoryPerception,
      moisture,
      activity,
      mobility,
      nutrition,
      frictionShear,
      total: totalScore
    },
    riskLevel,
    turningIntervalHours: turningHours,
    isEscalated,
    arabicReport: {
      title: "تقرير تقييم درجات قرح الفراش وحالة الالتزام بالتقليب الجسدي",
      riskLevelArabic,
      immediateAction,
      nextTurningInstructions,
      escalationWarning,
      isEscalated
    },
    wardHeadNurseNote: isEscalated ? 
      `🚨 إشعار عاجل لرئيسة التمريض: محاولة تأجيل التقليب للمريض أو تسجيل تأخير مباشر. يرجى التدخل الفوري لتنفيذ التقليب وتدقيق الأسباب لتجنب وقوع خطأ طبي وعقوبات إدارية.` :
      `التزام مستمر بالبروتوكول الطبي من قبل الكادر التمريضي.`
  };
}

// REST API for processing clinical logs
app.post("/api/analyze-log", async (req, res) => {
  const { clinicalText, isDelayAttempted, delayReason, existingUlcers } = req.body;
  
  if (!clinicalText) {
    return res.status(400).json({ error: "الرجاء إدخال النص السريري للتقييم." });
  }

  try {
    const ai = getGeminiClient();
    
    const systemPrompt = `You are the authoritative medical AI core engine for "BedSore Guardian", a high-priority and mandatory nursing application for pressure ulcer prevention and workflow compliance in hospitals.
You process structured clinical logs from nurses and enforce absolute accountability.

Evaluate the patient's Clinical Log regarding Braden Scale categories:
1. Sensory Perception (1 to 4)
2. Moisture (1 to 4)
3. Activity (1 to 4)
4. Mobility (1 to 4)
5. Nutrition (1 to 4)
6. Friction and Shear (1 to 3)

Score definitions:
- Severe Risk: Total Braden Score <= 9
- High Risk: 10 - 12
- Moderate Risk: 13 - 14
- Low Risk (Mild/No Risk): >= 15

Based on the score, dictate mandatory, legally binding turning and repositioning schedule intervals:
- Severe Risk: Strict every 1.5 hours + microclimate management adjustments
- High Risk: Strict every 2 hours
- Moderate Risk: Every 3 hours
- Low Risk: Every 4 hours

Analyze existing ulcers if provided. If the patient has existing ulcers on certain parts of the body, strictly instruct the nurses NOT to position the patient on those specific areas, and instead provide safe alternative positioning angles. Mention the existing ulcers explicitly in the instructions to ensure they are handled properly.

Analyze delay attempts: If isDelayAttempted is true, or if the clinicalText indicates delayed turning or attempts an unauthorized delay:
1. Generate an authoritative legal/medical alert warning.
2. Output "Escalation Status: CRITICAL" (حالة التصعيد: حرجة!).
3. Set isEscalated to true.
4. Draft an urgent note for the Head Nurse.

Language Requirements:
You must respond in a clear, professional medical Arabic, structured with markdown for clean display on small nursing handset screens. Include fields for: Risk Level, Immediate Action Required, Next Turning Deadline, and Head Nurse Escalation Trigger (True/False).

You must return a JSON response matching this TypeScript schema:
{
  "bradenScore": {
    "sensoryPerception": number, // 1-4
    "moisture": number, // 1-4
    "activity": number, // 1-4
    "mobility": number, // 1-4
    "nutrition": number, // 1-4
    "frictionShear": number, // 1-3
    "total": number // 6-23
  },
  "riskLevel": "Severe Risk" | "High Risk" | "Moderate Risk" | "Low Risk",
  "turningIntervalHours": number, // 1.5, 2.0, 3.0, 4.0
  "isEscalated": boolean, // must be true if isDelayAttempted is true or reported delay detected
  "arabicReport": {
    "title": "تقرير تقييم قرح الفراش والالتزام بالتقليب",
    "riskLevelArabic": string, // e.g. "خطورة بالغة (Severe Risk)"
    "immediateAction": string, // Professional medical Arabic markdown detailing immediate skin nursing actions required
    "nextTurningInstructions": string, // Professional medical Arabic markdown detailing next turning timing, angles, bed adjustments, microclimate management. Ensure you warn about avoiding existing ulcers if they exist.
    "escalationWarning": string, // Strict medical-legal warning if delay is attempted, or positive compliance message
    "isEscalated": boolean
  },
  "wardHeadNurseNote": string // Direct Arabic urgent alert message to Head Nurse if isEscalated is true, otherwise standard compliance sign-off
}

Crucial: Return ONLY raw JSON, with no backticks, markdown markers, or leading/trailing text. Ensure valid JSON parsing.`;

    const userPromptText = `Clinical Assessment Log Entered by Nurse:
"${clinicalText}"

Existing known ulcers for this patient: ${existingUlcers ? existingUlcers.join(", ") : "None reported currently"}

Nurse reported unauthorized delay or shift delayed? ${isDelayAttempted ? "YES. Reason: " + delayReason : "NO"}
Please evaluate.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPromptText,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const textOutput = response.text || "";
    // Parse response safely
    let parsedResult;
    try {
      parsedResult = JSON.parse(textOutput.trim());
    } catch (jsonErr) {
      console.error("Failed to parse JSON from Gemini directly. Output was:", textOutput);
      // Clean possible markdown wrappers
      let cleaned = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    res.json(parsedResult);
  } catch (err: any) {
    console.error("Gemini API call failed, falling back to algorithmic simulation:", err.message);
    // Graceful fallback for demo safety & robust full stack performance
    const fallbackVal = performAlgorithmicEvaluation(clinicalText, isDelayAttempted || false, delayReason || "");
    res.json({
      ...fallbackVal,
      _isFallback: true,
      fallbackMessage: "تم تشغيل المحرك الاحتياطي المحلي لتقييم الحالات لعدم توفر مفتاح الذكاء الاصطناعي."
    });
  }
});

// Setup development or production build configurations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development server using Vite's middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BedSore Guardian] Full-stack clinical server running on http://localhost:${PORT}`);
  });
}

startServer();
