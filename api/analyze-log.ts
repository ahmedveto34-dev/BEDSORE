import { GoogleGenAI } from "@google/genai";

// Fallback logic when Gemini API key is missing or calls fail
function performAlgorithmicEvaluation(clinicalText: string, isDelayAttempted: boolean, delayReason: string) {
  const textLower = (clinicalText || "").toLowerCase();
  
  let sensoryPerception = 3;
  let moisture = 3;         
  let activity = 2;         
  let mobility = 2;         
  let nutrition = 2;        
  let frictionShear = 2;     

  if (textLower.includes("لا يشعر") || textLower.includes("غيبوبة") || textLower.includes("coma") || textLower.includes("paralyzed") || textLower.includes("شلل")) {
    sensoryPerception = 1;
  } else if (textLower.includes("محدود جزي") || textLower.includes("limited perception") || textLower.includes("ضعف إحساس")) {
    sensoryPerception = 2;
  }

  if (textLower.includes("عرق دائم") || textLower.includes("رطوبة مستمرة") || textLower.includes("constantly moist") || textLower.includes("سلس بول") || textLower.includes("incontinence")) {
    moisture = 1;
  } else if (textLower.includes("رطب جدا") || textLower.includes("very moist") || textLower.includes("مبلل")) {
    moisture = 2;
  }

  if (textLower.includes("طريح الفراش") || textLower.includes("bedridden") || textLower.includes("لا يتحرك") || textLower.includes("immobile")) {
    activity = 1;
    mobility = 1;
  } else if (textLower.includes("كرسي متحرك") || textLower.includes("wheelchair") || textLower.includes("chairfast")) {
    activity = 2;
    mobility = 2;
  }

  if (textLower.includes("سؤ تغذية") || textLower.includes("لا يأكل") || textLower.includes("nutrition poor") || textLower.includes("ضعيف جدا") || textLower.includes("poor diet")) {
    nutrition = 1;
  }

  if (textLower.includes("انزلاق") || textLower.includes("friction") || textLower.includes("shear") || textLower.includes("احتكاك")) {
    frictionShear = 1; 
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
  
  const immediateAction = `**الإجراء الفوري المطلوب**:\n` +
    `1. البدء ببروتوكول الوقاية من قرح الفراش المعتمد بالفئة لخطورة (${riskLevelArabic}).\n` +
    `2. المحافظة التامة على جفاف الجلد وبخاصة مناطق الضغط العظمي.\n` +
    `3. استبدال مفروشات السرير بملاءات نفاذة للهواء.\n` +
    `4. استخدام مرطبات عازلة مصممة لمنع نضح السوائل وإجراء فحص جلدي شامل في كل نوبة تقليب.`;

  const nextTurningInstructions = `**تعليمات التقليب القادم**:\n` +
    `- الالتزام الصارم بـ **معدل التقليب كل ${turningHours} ساعة** تبعاً لتصنيف Braden لدرجات الخطورة العالية.\n` +
    `- تطبيق مناورات تخفيف الضغط بزاوية 30 درجة مائلة.\n` +
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

// Vercel serverless function entrypoint
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clinicalText, isDelayAttempted, delayReason } = req.body || {};
  
  if (!clinicalText) {
    return res.status(400).json({ error: "الرجاء إدخال النص السريري للتقييم." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const ai = new GoogleGenAI({ apiKey });
    
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
    "sensoryPerception": number, 
    "moisture": number, 
    "activity": number, 
    "mobility": number, 
    "nutrition": number, 
    "frictionShear": number, 
    "total": number 
  },
  "riskLevel": "Severe Risk" | "High Risk" | "Moderate Risk" | "Low Risk",
  "turningIntervalHours": number,
  "isEscalated": boolean, 
  "arabicReport": {
    "title": "تقرير تقييم قرح الفراش والالتزام بالتقليب",
    "riskLevelArabic": string, 
    "immediateAction": string, 
    "nextTurningInstructions": string, 
    "escalationWarning": string, 
    "isEscalated": boolean
  },
  "wardHeadNurseNote": string 
}

Crucial: Return ONLY raw JSON, with no backticks, markdown markers, or leading/trailing text. Ensure valid JSON parsing.`;

    const userPromptText = `Clinical Assessment Log Entered by Nurse:
"${clinicalText}"

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
    let parsedResult;
    try {
      parsedResult = JSON.parse(textOutput.trim());
    } catch (jsonErr) {
      console.error("Failed to parse JSON from Gemini directly.");
      let cleaned = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    return res.status(200).json(parsedResult);
  } catch (err: any) {
    console.error("Vercel Gemini API call failed, falling back to algorithmic simulation:", err.message);
    const fallbackVal = performAlgorithmicEvaluation(clinicalText, isDelayAttempted || false, delayReason || "");
    return res.status(200).json({
      ...fallbackVal,
      _isFallback: true,
      fallbackMessage: "تم تشغيل المحرك الاحتياطي المحلي لتقييم الحالات لعدم توفر مفتاح الذكاء الاصطناعي."
    });
  }
}
