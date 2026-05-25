/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  HeartPulse, 
  Activity, 
  User, 
  Clock, 
  ShieldAlert, 
  QrCode, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Plus, 
  Users, 
  Sliders, 
  Calendar, 
  ChevronRight, 
  Sparkles, 
  Lock, 
  AlertOctagon, 
  Bell, 
  Search, 
  CheckCircle2, 
  RefreshCw, 
  Info, 
  ChevronLeft,
  X,
  FileText,
  BellOff,
  Settings,
  AudioLines,
  Edit3
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { INITIAL_PATIENTS, INITIAL_LOGS, ARABIC_SAMPLE_LOGS } from "./data";
import { Patient, TurnLog, AnalysisResponse, BradenScore } from "./types";

import { initAuth, googleSignIn, logout } from "./lib/auth";
import { saveLogToFirestore } from "./lib/db";
import type { User as FirebaseUser } from "firebase/auth";

import { translations } from "./i18n";

export default function App() {
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const t = translations[lang];

  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("p1");
  const [logs, setLogs] = useState<TurnLog[]>(INITIAL_LOGS);
  
  // Custom input state
  const [clinicalText, setClinicalText] = useState<string>(INITIAL_PATIENTS[0].lastClinicalText);
  const [isDelayAttempted, setIsDelayAttempted] = useState<boolean>(false);
  const [delayReason, setDelayReason] = useState<string>("");
  
  // API Call state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Last analysis result per patient
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  // QR Bedside simulator state
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [simulatedCameraFeed, setSimulatedCameraFeed] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [audioBeep, setAudioBeep] = useState<boolean>(false);

  // Manual Adjuster State (Allows manual override of Braden factors in UI)
  const [bradenSliders, setBradenSliders] = useState<BradenScore>({
    sensoryPerception: 1,
    moisture: 1,
    activity: 1,
    mobility: 1,
    nutrition: 2,
    frictionShear: 1,
    total: 7
  });

  // New Patient Form state
  const [isAddingPatient, setIsAddingPatient] = useState<boolean>(false);
  const [newPatientName, setNewPatientName] = useState<string>("");
  const [newPatientBed, setNewPatientBed] = useState<string>("");
  const [newPatientAge, setNewPatientAge] = useState<number>(65);
  const [newPatientAdmission, setNewPatientAdmission] = useState<string>("");

  // Countdown timer simulation for next turning
  const [timeLeftStr, setTimeLeftStr] = useState<string>("01:29:55");

  // Google Auth & Sheets State
  const [needsAuth, setNeedsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);

  // Admin View State
  const [showAdminView, setShowAdminView] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminTab, setAdminTab] = useState<"settings" | "patients">("settings");
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editPatientData, setEditPatientData] = useState<Partial<Patient>>({});

  // Load patient details on select
  const currentPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  // Notifications State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const lastNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const handleRequestNotification = async () => {
    if (!("Notification" in window)) {
      alert("هذا المتصفح لا يدعم التنبيهات.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("تم تفعيل التنبيهات", {
        body: "سيتم تنبيهك قبل 10 دقائق من موعد التقليب القادم."
      });
    } else {
      alert("تم رفض التنبيهات. يرجى تفعيلها من إعدادات المتصفح.");
    }
  };

  useEffect(() => {
    if (notificationsEnabled && currentPatient) {
      if (timeLeftStr === "00:10:00") {
        const notifKey = currentPatient.id + "-10min-" + (new Date()).toDateString();
        if (lastNotifiedRef.current !== notifKey) {
          lastNotifiedRef.current = notifKey;
          
          if (Notification.permission === "granted") {
            new Notification(`تنبيه: اقترب موعد التقليب!`, {
              body: `المريض: ${currentPatient.name}\nسرير: ${currentPatient.bedNo}\nمتبقي 10 دقائق لموعد التقليب القادم. الرجاء الاستعداد.`
            });
            try {
              // optional fallback sound
              const audio = new Audio("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
              audio.play().catch(() => {});
            } catch(e) {}
          }
        }
      }
    }
  }, [timeLeftStr, notificationsEnabled, currentPatient]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveToSheets = async () => {
    if (!token) {
      setNeedsAuth(true);
      alert("يرجى تسجيل الدخول أولاً بحساب جوجل.");
      return;
    }
    
    setIsSavingSheet(true);
    try {
      const sheetId = '1S1BLzDeCHS3_xbeEgDF3kNOxJ17d_TmEKYLUeP1f15I';
      const range = 'Sheet1!A1:H1'; 
      const timestamp = new Date().toLocaleString("ar-EG");
      
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [
            [
              timestamp, 
              currentPatient.name, 
              currentPatient.bedNo, 
              currentPatient.age, 
              currentPatient.riskLevelArabic || currentPatient.riskLevel, 
              bradenSliders.total, 
              currentPatient.scanStatus === 'VERIFIED' ? 'مطابق' : 'مخالف/معلق',
              currentPatient.lastClinicalText || ""
            ]
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save to Google Sheets');
      }
      alert('تم حفظ التقرير بنجاح في Google Sheets!');
    } catch (err) {
      console.error("Sheets error:", err);
      alert("حدث خطأ أثناء الحفظ. تأكد من توفر الصلاحيات.");
    } finally {
      setIsSavingSheet(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      setNeedsAuth(true);
      alert("يرجى تسجيل الدخول أولاً بحساب جوجل.");
      return;
    }
    
    setIsSavingFirestore(true);
    try {
      const timestamp = new Date().toISOString();
      await saveLogToFirestore({
        timestamp,
        patientName: currentPatient.name,
        bedNo: currentPatient.bedNo,
        patientAge: currentPatient.age.toString(),
        riskLevel: currentPatient.riskLevelArabic || currentPatient.riskLevel,
        bradenTotal: bradenSliders.total,
        scanStatus: currentPatient.scanStatus === 'VERIFIED' ? 'مطابق' : 'مخالف/معلق',
        clinicalText: currentPatient.lastClinicalText || ""
      });
      alert('تم حفظ التقرير بنجاح في قاعدة بيانات Firestore المدمجة الآمنة!');
    } catch (err) {
      console.error("Firestore error:", err);
      alert("حدث خطأ أثناء الحفظ في Firestore.");
    } finally {
      setIsSavingFirestore(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Admin Setup
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode === "1234") {
      setIsAdminLoggedIn(true);
      setAdminError("");
      setAdminPasscode("");
    } else {
      setAdminError(t.invalidPassword);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setShowAdminView(false);
    setAdminTab("settings");
    setEditingPatientId(null);
  };

  const startEditPatient = (p: Patient) => {
    setEditingPatientId(p.id);
    setEditPatientData({ ...p });
  };

  const savePatientEdit = () => {
    if (!editingPatientId) return;
    setPatients(prev => prev.map(p => p.id === editingPatientId ? { ...p, ...editPatientData } as Patient : p));
    setEditingPatientId(null);
  };

  const cancelEditPatient = () => {
    setEditingPatientId(null);
    setEditPatientData({});
  };

  const riskDistributionData = useMemo(() => {
    let severeCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    
    patients.forEach(p => {
      const score = p.bradenScore?.total || 15;
      if (score <= 9) severeCount++;
      else if (score <= 12) highCount++;
      else if (score <= 14) moderateCount++;
      else lowCount++;
    });

    return [
      { name: t.riskSevere, value: severeCount, color: "#e11d48" }, // rose-600
      { name: t.riskHigh, value: highCount, color: "#f59e0b" }, // amber-500
      { name: t.riskModerate, value: moderateCount, color: "#3b82f6" }, // blue-500
      { name: t.riskLow, value: lowCount, color: "#14b8a6" } // teal-500
    ].filter(d => d.value > 0);
  }, [patients, t]);

  useEffect(() => {
    if (currentPatient) {
      setClinicalText(currentPatient.lastClinicalText);
      setIsDelayAttempted(currentPatient.isEscalated);
      // Initialize sliders to patient's current Braden score if exists
      if (currentPatient.bradenScore) {
        setBradenSliders({ ...currentPatient.bradenScore });
      }
    }
  }, [selectedPatientId]);

  // Recalculate slider totals
  useEffect(() => {
    const total = 
      bradenSliders.sensoryPerception + 
      bradenSliders.moisture + 
      bradenSliders.activity + 
      bradenSliders.mobility + 
      bradenSliders.nutrition + 
      bradenSliders.frictionShear;
    
    setBradenSliders(prev => ({ ...prev, total }));
  }, [
    bradenSliders.sensoryPerception,
    bradenSliders.moisture,
    bradenSliders.activity,
    bradenSliders.mobility,
    bradenSliders.nutrition,
    bradenSliders.frictionShear
  ]);

  // Live countdown timer state simulation
  useEffect(() => {
    const timer = setInterval(() => {
      // Pick random seconds decrement to simulate a real-time countdown
      const parts = timeLeftStr.split(":");
      let hrs = parseInt(parts[0]);
      let mins = parseInt(parts[1]);
      let secs = parseInt(parts[2]);

      if (secs > 0) {
        secs--;
      } else {
        secs = 59;
        if (mins > 0) {
          mins--;
        } else {
          mins = 59;
          if (hrs > 0) {
            hrs--;
          } else {
            hrs = 1; // loop back safely for demo
          }
        }
      }

      const format = (num: number) => num.toString().padStart(2, '0');
      setTimeLeftStr(`${format(hrs)}:${format(mins)}:${format(format === undefined ? 0 : secs)}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeftStr]);

  // Handle Preset Case quick-insertion
  const handlePresetInsert = (text: string) => {
    setClinicalText(text);
  };

  // Trigger analysis POST
  const handleAnalyzeLogs = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/analyze-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clinicalText,
          isDelayAttempted,
          delayReason: isDelayAttempted ? (delayReason || "عجز تشغيلي مؤقت بالكادر") : ""
        })
      });

      if (!response.ok) {
        throw new Error("فشل الاتصال بالمحرك الطبي السحابي. جاري التحول التلقائي للمحرك اللامركزي الاحتياطي.");
      }

      const data: AnalysisResponse = await response.json();
      setAnalysisResult(data);
      
      // Update patient profile locally
      setPatients(prev => prev.map(p => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            bradenScore: data.bradenScore,
            riskLevel: data.riskLevel,
            riskLevelArabic: data.arabicReport.riskLevelArabic,
            turningIntervalHours: data.turningIntervalHours,
            isEscalated: data.isEscalated,
            escalationMessage: data.wardHeadNurseNote,
            lastClinicalText: clinicalText,
            // If escalated due to delay attempts, set state to violation until QR bed scan
            scanStatus: data.isEscalated ? "PENDING_SCAN" : p.scanStatus
          };
        }
        return p;
      }));

      // Update interactive sliders to synchronize
      setBradenSliders(data.bradenScore);

      // Play synthesized tone
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.value = data.isEscalated ? 440 : 880; // deep warnings for critical, pleasant high chime for normal
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // Safe to ignore audio constraints
      }

    } catch (err: any) {
      console.warn(err);
      setAnalysisError(err.message || "حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Perform physical Bedside QR scan simulation
  const triggerBedsideScan = (method: "CAMERA" | "INSTANT") => {
    setIsScanningActive(true);
    setScanMessage("جاري الاتصال بقارئ الباركود وتنشيط الكاميرا بجوار السرير...");
    
    if (method === "CAMERA") {
      setSimulatedCameraFeed(true);
    }

    setTimeout(() => {
      // Simulate successful bed scan
      setAudioBeep(true);
      // Play beep sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.frequency.value = 1046.50; // High C note (beep!)
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {}

      // Update scanner UI
      setScanMessage(`✅ تم بنجاح التحقق والمطابقة الفيزيائية للرمز [${currentPatient.qrCodeValue}] بجوار سرير المريض! تم فك تعليق النشاط.`);
      
      // Update patient status to VERIFIED
      setPatients(prev => prev.map(p => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            scanStatus: "VERIFIED",
            isEscalated: false // Scanning clears immediate escalation blocks
          };
        }
        return p;
      }));

      // Append verified log
      const newLog: TurnLog = {
        id: `log_${Date.now()}`,
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        bedNo: currentPatient.bedNo,
        timestamp: new Date().toISOString(),
        actionTaken: "تقليب مادي معتمد والتحقق من التواجد الفعلي عبر رمز QR السريري",
        nurseNotes: `المطابقة اليدوية لرمز الاستجابة السريعة: ${currentPatient.qrCodeValue}. مستوى الخطورة المعتمد: ${currentPatient.riskLevelArabic || "شديدة"}. تم إلغاء أي مخالفة معلقة للتقليب.`,
        bradenScoreText: `درجة برادن: ${currentPatient.bradenScore?.total || bradenSliders.total} (${currentPatient.riskLevelArabic || "مخاطر عالية"})`,
        isEscalated: false,
        verificationMethod: "QR_BEDSIDE_SCAN",
        status: "COMPLIANT"
      };

      setLogs(prev => [newLog, ...prev]);

      // If we had an analysis result, clear the escalation state
      if (analysisResult) {
        setAnalysisResult(prev => prev ? {
          ...prev,
          isEscalated: false,
          arabicReport: {
            ...prev.arabicReport,
            escalationWarning: "🟢 تم إنهاء حالة التصعيد بنجاح عقب إتمام المسح السريري المتطابق بجوار السرير.",
            isEscalated: false
          }
        } : null);
      }

      setTimeout(() => {
        setIsScanningActive(false);
        setSimulatedCameraFeed(false);
        setScanMessage(null);
        setAudioBeep(false);
      }, 3500);

    }, 2000);
  };

  // Reset/Clear Simulation Violation Status to force compliance testing
  const setAsViolationForce = () => {
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          scanStatus: "VIOLATION",
          isEscalated: true
        };
      }
      return p;
    }));

    // Add immediate violation to compliance timeline
    const violationLog: TurnLog = {
      id: `log_${Date.now()}`,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      bedNo: currentPatient.bedNo,
      timestamp: new Date().toISOString(),
      actionTaken: "تحذير: تجاوز المهلة الإلزامية لتغيير وضعية الجسم دون مسح الكود الطبي الكامن",
      nurseNotes: "مخالفة مرصودة بالملفات الطبية للأمن والامتثال التابع للوزارة الحكومية وصحة المرضى.",
      bradenScoreText: `تجاوز الموعد (مقياس برادن ${currentPatient.bradenScore?.total || 7})`,
      isEscalated: true,
      verificationMethod: "STALE_VIOLATION",
      status: "VIOLATION"
    };
    setLogs(prev => [violationLog, ...prev]);
  };

  // Add new Custom Patient Handler
  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName || !newPatientBed) {
      alert("الرجاء تعبئة اسم المريض ورقم السرير");
      return;
    }

    const newP: Patient = {
      id: `p_${Date.now()}`,
      name: newPatientName,
      bedNo: newPatientBed,
      age: Number(newPatientAge),
      admissionReason: newPatientAdmission || "حالة مراقبة جلدية عامة وقرح الفراش",
      lastClinicalText: "المريض تحت الفحص والمراقبة. الجلد سليم مؤقتاً ولكن يحتاج إلى تقييم أولي وبناء الخطة.",
      bradenScore: {
        sensoryPerception: 3,
        moisture: 3,
        activity: 3,
        mobility: 3,
        nutrition: 3,
        frictionShear: 2,
        total: 17
      },
      riskLevel: "Low Risk",
      riskLevelArabic: "خطورة منخفضة (Low Risk)",
      turningIntervalHours: 4.0,
      nextTurningTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      isEscalated: false,
      qrCodeValue: `BEDS-${newPatientBed.replace(/\s+/g, '')}_NEW`,
      scanStatus: "PENDING_SCAN"
    };

    setPatients(prev => [...prev, newP]);
    setSelectedPatientId(newP.id);
    setIsAddingPatient(false);
    // Reset Form
    setNewPatientName("");
    setNewPatientBed("");
    setNewPatientAge(65);
    setNewPatientAdmission("");
  };

  // Manual Adjuster submit-override to clinical assessment
  const applyManualBradenCalculation = () => {
    let riskL: "Severe Risk" | "High Risk" | "Moderate Risk" | "Low Risk" = "Low Risk";
    let riskAr = "خطورة منخفضة (Low Risk)";
    let hours = 4.0;

    const score = bradenSliders.total;
    if (score <= 9) {
      riskL = "Severe Risk";
      riskAr = "خطورة بالغة جداً (Severe Risk)";
      hours = 1.5;
    } else if (score <= 12) {
      riskL = "High Risk";
      riskAr = "خطورة عالية (High Risk)";
      hours = 2.0;
    } else if (score <= 14) {
      riskL = "Moderate Risk";
      riskAr = "خطورة متوسطة (Moderate Risk)";
      hours = 3.0;
    } else {
      riskL = "Low Risk";
      riskAr = "خطورة منخفضة (Low Risk)";
      hours = 4.0;
    }

    const overrideResponse: AnalysisResponse = {
      bradenScore: { ...bradenSliders },
      riskLevel: riskL,
      turningIntervalHours: hours,
      isEscalated: isDelayAttempted,
      arabicReport: {
        title: "تقرير تقييم يدوي معتمد من الممرض المناوب",
        riskLevelArabic: riskAr,
        immediateAction: `**الإجراء الفوري المطلوب**:\n` +
          `• تفعيل خطة الرعاية المتوافقة مع درجة برادن المحسوبة يدوياً للسرير (${score}/23).\n` +
          `• الحفاظ على روتين النظافة وحماية البروزات العظمية في غضون نوبة العمل والمراقبة المستمرة.`,
        nextTurningInstructions: `**تعليمات التقليب القادمة**:\n` +
          `• تقليب متواصل يدوياً كل ${hours} ساعة وبزاوية 30 درجة كاملة.\n` +
          `• يجب مطابقة رمز QR وتوثيق الإجراء مخرجات السير المعمول بها لتلافي انتهاك الأنظمة الطبية.`,
        escalationWarning: isDelayAttempted ? 
          `🛑 **تحذير حالة تصعيد**: تم تفعيل بروتوكول التصعيد التلقائي بسبب الإيقاظ اليدوي لزر التأخير المحظور.` :
          `🟢 التقييم اليدوي متزامن ومتطابق مع بروتوكولات الأمن القائمة للوقاية من القرح.`,
        isEscalated: isDelayAttempted
      },
      wardHeadNurseNote: isDelayAttempted ?
        `🚨 إشعار تصعيد فوري إلى رئيسة تمريض القسم بسبب اتخاذ قرار تأخير غير قانوني عن الموعد.` :
        `الحالة مستقرة ومتوافقة مع المعايير العلاجية.`
    };

    setAnalysisResult(overrideResponse);
    
    // Update active patient metadata
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          bradenScore: bradenSliders,
          riskLevel: riskL,
          riskLevelArabic: riskAr,
          turningIntervalHours: hours,
          isEscalated: isDelayAttempted,
          scanStatus: isDelayAttempted ? "PENDING_SCAN" : p.scanStatus
        };
      }
      return p;
    }));
  };

  return (
    <div className={`flex flex-col h-screen min-h-[768px] w-full bg-slate-100 font-sans overflow-hidden ${lang === "ar" ? "text-right" : "text-left"} select-none text-slate-800`} dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* HEADER SECTION (from Professional Polish Mockup specs) */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-md border-b border-rose-950 flex-shrink-0 print:hidden">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-rose-600 rounded-lg flex items-center justify-center font-black text-2xl tracking-tighter shadow-md animate-pulse">
            BG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-arabic">{t.title}</h1>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded border border-rose-500/40">{t.version}</span>
            </div>
            <p className="text-xs text-slate-400 font-arabic">{t.subtitle}</p>
          </div>
        </div>

        {/* Header Metadata Display */}
        <div className="flex flex-wrap gap-4 md:gap-6 text-sm items-center mt-3 md:mt-0 w-full md:w-auto justify-start md:justify-end">
          <div className={`border-${lang === "ar" ? "l" : "r"} border-slate-700 px-2`}>
            <p className="text-slate-400 text-[10px] uppercase font-arabic mb-0.5">{t.activePatientTitle}</p>
            <p className="font-semibold text-rose-200 text-xs md:text-sm">
              {currentPatient.name} <span className="text-white font-mono font-bold bg-slate-805 px-1.5 py-0.5 rounded bg-slate-800">{t.bed}: {currentPatient.bedNo}</span>
            </p>
          </div>
          <div className={`border-${lang === "ar" ? "l" : "r"} border-slate-700 px-2`}>
            <p className="text-slate-400 text-[10px] uppercase font-arabic mb-0.5">{t.nurseTitle}</p>
            <p className="font-semibold text-teal-300 text-xs md:text-sm">د. سارة العتيبي (RN-772)</p>
          </div>
          <div className="border-r border-slate-700 pr-4 pl-2">
            <p className="text-slate-400 text-[10px] uppercase font-arabic mb-0.5">{t.wardTitle}</p>
            <p className="font-semibold text-slate-300 font-arabic text-xs">{t.icu}</p>
          </div>
          
          {/* Compliance overview indicator badge */}
          <div className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${currentPatient.scanStatus === "VERIFIED" ? "bg-teal-900/40 text-teal-200 border border-teal-600" : "bg-rose-950/60 text-rose-200 border border-rose-700"}`}>
            <div className={`w-2 h-2 rounded-full ${currentPatient.scanStatus === "VERIFIED" ? "bg-teal-400" : "bg-rose-500 animate-ping"}`}></div>
            <span className="text-xs font-bold font-arabic">
              {currentPatient.scanStatus === "VERIFIED" ? t.complianceFull : t.compliancePending}
            </span>
          </div>
          <div className="border-r border-slate-700 pr-4 pl-2 flex items-center justify-center">
            <button 
              onClick={handleRequestNotification}
              className={`p-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors border ${notificationsEnabled ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700 hover:bg-indigo-900/60' : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:border-slate-400'}`}
              title={notificationsEnabled ? 'التنبيهات مفعلة' : 'تفعيل التنبيهات'}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4 animate-pulse" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
          <div className="pl-2 flex items-center justify-center gap-2">
            <button 
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="p-1 px-3 rounded-md text-xs font-bold transition-colors border bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:border-slate-400 cursor-pointer text-center"
            >
              {t.languageToggle}
            </button>
            <button 
              onClick={() => setShowAdminView(!showAdminView)}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors border ${showAdminView ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-800 text-slate-400 border-slate-600 hover:text-white hover:border-slate-400"} cursor-pointer`}
              title={t.adminPanelTitle}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {showAdminView ? (
        <main className={`flex-1 p-8 flex flex-col items-center bg-slate-50 overflow-y-auto ${lang === "ar" ? "text-right" : "text-left"}`} dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            {!isAdminLoggedIn ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pattern-bg">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-md shadow-slate-300">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-6 font-arabic">{t.adminLoginTitle}</h2>
                <form onSubmit={handleAdminLogin} className="w-full max-w-sm flex flex-col gap-4">
                  <div>
                    <input
                      type="password"
                      placeholder={t.passwordPlaceholder}
                      value={adminPasscode}
                      onChange={e => setAdminPasscode(e.target.value)}
                      className="w-full text-center text-xl tracking-widest p-3 border-2 border-slate-300 rounded focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                    {adminError && <p className="text-rose-600 text-xs font-bold mt-2">{adminError}</p>}
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded uppercase tracking-wide cursor-pointer text-sm transition-all shadow-md">
                    {t.loginBtn}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Admin Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {t.adminPanelTitle}
                  </h2>
                  <button onClick={handleAdminLogout} className="text-slate-400 hover:text-white px-3 py-1 rounded border border-slate-700 hover:border-slate-500 text-xs font-bold transition-all cursor-pointer">
                    {t.logoutBtn}
                  </button>
                </div>
                
                {/* Admin Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <button 
                    onClick={() => setAdminTab("settings")}
                    className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${adminTab === "settings" ? "text-indigo-700 border-b-2 border-indigo-700 bg-white" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <AudioLines size={16} />
                    {t.settingsTab}
                  </button>
                  <button 
                    onClick={() => setAdminTab("patients")}
                    className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${adminTab === "patients" ? "text-indigo-700 border-b-2 border-indigo-700 bg-white" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <Users size={16} />
                    {t.patientsTab}
                  </button>
                </div>

                {/* Admin Content */}
                <div className="flex-1 p-6 bg-white overflow-y-auto">
                  {adminTab === "settings" && (
                    <div className="max-w-xl mx-auto space-y-6">
                      <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm mb-1">{t.enableAudio}</h3>
                          <p className="text-xs text-slate-500">تفعيل/إلغاء التنبيهات الصوتية للتطبيقات والإشعارات المتأخرة.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={notificationsEnabled}
                            onChange={() => setNotificationsEnabled(!notificationsEnabled)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  )}

                  {adminTab === "patients" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {patients.map(p => (
                          <div key={p.id} className="border border-slate-200 p-4 rounded-lg flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{p.name}</h4>
                                <span className="text-xs text-slate-500 inline-block bg-slate-100 px-1.5 py-0.5 rounded mt-1">{t.bed}: {p.bedNo}</span>
                              </div>
                              <button 
                                onClick={() => startEditPatient(p)}
                                className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded"
                              >
                                <Edit3 size={16} />
                              </button>
                            </div>
                            
                            {editingPatientId === p.id && (
                              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 mt-2">
                                <input 
                                  value={editPatientData.name || ""} 
                                  onChange={e => setEditPatientData({...editPatientData, name: e.target.value})}
                                  placeholder={t.patientNamePlaceholder}
                                  className="text-xs p-2 border border-slate-300 rounded w-full"
                                />
                                <div className="flex gap-2">
                                  <input 
                                    value={editPatientData.bedNo || ""} 
                                    onChange={e => setEditPatientData({...editPatientData, bedNo: e.target.value})}
                                    placeholder={t.bedNoPlaceholder}
                                    className="text-xs p-2 border border-slate-300 rounded w-full flex-1"
                                  />
                                  <input 
                                    type="number"
                                    value={editPatientData.age || ""} 
                                    onChange={e => setEditPatientData({...editPatientData, age: Number(e.target.value)})}
                                    placeholder={t.ageLabel}
                                    className="text-xs p-2 border border-slate-300 rounded w-20"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end mt-2">
                                  <button onClick={cancelEditPatient} className="text-[10px] px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer transition-colors">
                                    {t.cancelBtn}
                                  </button>
                                  <button onClick={savePatientEdit} className="text-[10px] px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer transition-colors">
                                    {t.saveChanges}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      ) : (
      <>
      {/* MAIN CONTENT WORKSPACE - 3 Column Layout */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-y-auto ltr">
        
        {/* RIGHT COLUMN (Arabic Right): Patient list, state management, Braden calculator sliders */}
        <aside className={`col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 ${lang === "ar" ? "text-right" : "text-left"} order-1 print:hidden`} dir={lang === "ar" ? "rtl" : "ltr"}>

          
          {/* 1. Patient Selection Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-slate-800 text-sm font-bold flex items-center gap-2">
                <Users size={16} className="text-slate-500" />
                <span>{t.patientListTitle}</span>
              </h2>
              <button 
                onClick={() => setIsAddingPatient(!isAddingPatient)} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded p-1 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>{t.newPatient}</span>
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative mb-3">
              <input 
                type="text" 
                placeholder={t.searchPlaceholder} 
                className={`w-full text-xs p-2 ${lang === "ar" ? "pr-8" : "pl-8"} border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400`}
                readOnly
              />
              <Search size={14} className={`absolute ${lang === "ar" ? "right-2.5" : "left-2.5"} top-2.5 text-slate-400`} />
            </div>

            {/* Patients list container */}
            <div className={`space-y-2 max-h-48 overflow-y-auto ${lang === "ar" ? "pr-1" : "pl-1"}`}>
              {patients.map(p => {
                const isActive = p.id === selectedPatientId;
                const isPsevere = (p.bradenScore?.total || 15) <= 12;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isActive 
                        ? "bg-slate-900 text-white border-slate-900 shadow" 
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${p.scanStatus === "VERIFIED" ? "bg-teal-500" : p.scanStatus === "VIOLATION" ? "bg-rose-600" : "bg-amber-500"}`} />
                        <span className="font-bold text-xs md:text-sm">{p.name}</span>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                        {t.bed}: {p.bedNo}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 text-[10px]">
                      <span className={isActive ? "text-slate-300" : "text-slate-500"}>{t.ageLabel}: {p.age} {t.years}</span>
                      <span className={`px-1 rounded-sm font-bold ${
                        isPsevere 
                          ? (isActive ? "bg-rose-500/30 text-rose-200" : "bg-rose-100 text-rose-800") 
                          : (isActive ? "bg-teal-500/30 text-teal-200" : "bg-teal-100 text-teal-800")
                      }`}>
                        {p.riskLevelArabic ? p.riskLevelArabic.split(" ")[0] : t.initialAssessment}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Patient Modal/Form inline */}
            {isAddingPatient && (
              <form onSubmit={handleCreatePatient} className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-indigo-900">{t.addPatientTitle}</span>
                  <button type="button" onClick={() => setIsAddingPatient(false)} className="text-indigo-900 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder={t.patientNamePlaceholder} 
                  required
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  className="w-full text-xs p-1.5 border border-indigo-200 bg-white rounded focus:ring-1 focus:ring-indigo-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder={t.bedNoPlaceholder} 
                    required
                    value={newPatientBed}
                    onChange={e => setNewPatientBed(e.target.value)}
                    className="w-full text-xs p-1.5 border border-indigo-200 bg-white rounded focus:ring-1 focus:ring-indigo-400"
                  />
                  <input 
                    type="number" 
                    placeholder={t.ageLabel} 
                    required
                    value={newPatientAge}
                    onChange={e => setNewPatientAge(Number(e.target.value))}
                    className="w-full text-xs p-1.5 border border-indigo-200 bg-white rounded focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder={t.admissionReasonPlaceholder} 
                  value={newPatientAdmission}
                  onChange={e => setNewPatientAdmission(e.target.value)}
                  className="w-full text-xs p-1.5 border border-indigo-200 bg-white rounded focus:ring-1 focus:ring-indigo-400"
                />
                <button type="submit" className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-1 rounded text-xs transition-all cursor-pointer">
                  {t.confirmSaveBtn}
                </button>
              </form>
            )}
          </div>

          {/* 1.5. Risk Category Dashboard Pie Chart */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col">
            <h2 className="text-slate-800 text-xs font-bold mb-3 flex items-center gap-1.5 border-b pb-2">
              <Activity size={14} className="text-indigo-600" />
              <span>{t.riskDistTitle}</span>
            </h2>
            <div className="h-36 w-full ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {riskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ fontSize: '12px', borderRadius: '4px', textAlign: 'right', direction: 'rtl' }}
                    itemStyle={{ color: '#334155' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', right: 0, paddingBottom: "5px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Braden Scale Live Interactive Override Sliders */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-1 border-b pb-2">
              <h2 className="text-slate-800 text-xs font-bold uppercase flex items-center gap-1.5">
                <Sliders size={14} className="text-rose-600" />
                <span>{t.bradenTitle}</span>
              </h2>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                {t.physicalScore}
              </span>
            </div>

            {/* Slider items */}
            <div className="space-y-3 my-2 text-xs flex-1 overflow-y-auto pr-1">
              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">1. الإدراك الحسي (Sensory Perception)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.sensoryPerception} / 4</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={bradenSliders.sensoryPerception}
                  onChange={e => setBradenSliders(prev => ({...prev, sensoryPerception: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.sensoryPerception === 1 && "محدود تماماً (سلس أو غيبوبة)"}
                  {bradenSliders.sensoryPerception === 2 && "محدود جداً (ألم موضعي خفيف)"}
                  {bradenSliders.sensoryPerception === 3 && "محدود جزئياً (صعوبات تواصل لفظي)"}
                  {bradenSliders.sensoryPerception === 4 && "غير محدود طبيعي بالكامل"}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">2. رطوبة الجلد (Skin Moisture)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.moisture} / 4</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={bradenSliders.moisture}
                  onChange={e => setBradenSliders(prev => ({...prev, moisture: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.moisture === 1 && "رطوبة مستمرة (سلس مستديم للبول)"}
                  {bradenSliders.moisture === 2 && "رطب جداً (تبديل مستمر للملاءات)"}
                  {bradenSliders.moisture === 3 && "رطب أحياناً (رطوبة أثناء المجهود)"}
                  {bradenSliders.moisture === 4 && "جاف بشكل طبيعي وآمن"}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">3. مستوى النشاط (Activity Stage)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.activity} / 4</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={bradenSliders.activity}
                  onChange={e => setBradenSliders(prev => ({...prev, activity: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.activity === 1 && "طريح الفراش تماماً (Bedfast)"}
                  {bradenSliders.activity === 2 && "جليس الكرسي المتحرك (Chairfast)"}
                  {bradenSliders.activity === 3 && "يمشي أحياناً بمساعدة مرافقة"}
                  {bradenSliders.activity === 4 && "يمشي بتناغم واستقلالية خارج الغرفة"}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">4. القدرة الحركية (Mobility Control)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.mobility} / 4</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={bradenSliders.mobility}
                  onChange={e => setBradenSliders(prev => ({...prev, mobility: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.mobility === 1 && "عديم الحركة تماماً (Immobile)"}
                  {bradenSliders.mobility === 2 && "محدود جداً (تغيير طفيف للوضعية)"}
                  {bradenSliders.mobility === 3 && "محدود جزئياً (يتحرك باستقلالية خفيفة)"}
                  {bradenSliders.mobility === 4 && "كامل السيطرة ولا يعاني من قيود"}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">5. نمط التغذية (Nutrition Habits)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.nutrition} / 4</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={bradenSliders.nutrition}
                  onChange={e => setBradenSliders(prev => ({...prev, nutrition: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.nutrition === 1 && "تغذية سيئة للغاية (أو صيام مستمر)"}
                  {bradenSliders.nutrition === 2 && "غير كافية (سوائل وتغدية منقوصة)"}
                  {bradenSliders.nutrition === 3 && "مقبولة (يتناول معظم الوجبات)"}
                  {bradenSliders.nutrition === 4 && "ممتازة (مأكولات طبيعية كلياً)"}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-slate-700">6. الاحتكاك وقوى القص (Friction & Shear)</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{bradenSliders.frictionShear} / 3</span>
                </div>
                <input 
                  type="range" min="1" max="3" 
                  value={bradenSliders.frictionShear}
                  onChange={e => setBradenSliders(prev => ({...prev, frictionShear: Number(e.target.value)}))}
                  className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer" 
                />
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                  {bradenSliders.frictionShear === 1 && "مشكلة قائمة (يحتاج لرفع وسحب دائم)"}
                  {bradenSliders.frictionShear === 2 && "مشكلة محتملة (ضعف جزئي وحك جلدي)"}
                  {bradenSliders.frictionShear === 3 && "لا توجد أي مشكلة ظاهرة على الملاءة"}
                </p>
              </div>
            </div>

            {/* Live aggregated score status */}
            <div className="mt-2 pt-3 border-t border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-[10px] leading-tight">المجموع الإجمالي المحسوب للدرجات</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-black text-rose-600 font-mono">{bradenSliders.total}</span>
                  <span className="text-[12px] font-bold text-slate-700">
                    {bradenSliders.total <= 9 && "🚨 خطورة بالغة"}
                    {bradenSliders.total > 9 && bradenSliders.total <= 12 && "⚠️ خطورة عالية"}
                    {bradenSliders.total > 12 && bradenSliders.total <= 14 && "💡 خطورة متوسطة"}
                    {bradenSliders.total > 14 && "🟢 خطورة منخفضة"}
                  </span>
                </div>
              </div>
              <button
                onClick={applyManualBradenCalculation}
                className="bg-slate-900 border border-slate-705 text-white font-arabic font-semibold px-2 py-1.5 rounded text-[11px] hover:bg-slate-800 transition-all cursor-pointer"
              >
                اعتماد وتطبيق فوراً
              </button>
            </div>
          </div>
        </aside>

        {/* MIDDLE COLUMN: Interactive Medical AI input and clinical evaluations (Arabic Center) */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-6 flex flex-col gap-4 text-right order-2 print:col-span-12 print:block print:w-full" dir="rtl">
          
          {/* Patient Background Card */}
          <div className="bg-slate-900 text-white rounded-lg border border-slate-800 p-4 shadow flex justify-between items-center">
            <div className="space-y-1">
              <span className="bg-rose-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wide font-arabic">
                الملف السريري الحالي الخاضع للمطابقة
              </span>
              <h3 className="text-base font-black text-white">{currentPatient.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-arabic max-w-lg mb-3">
                <span className="font-bold text-rose-300">التنويم: </span>
                {currentPatient.admissionReason}
              </p>
              
              <div className="flex flex-wrap gap-2 print:hidden">
                {needsAuth ? (
                  <button onClick={handleLogin} className="flex gap-2 items-center bg-white text-slate-900 border border-slate-200 px-3 py-1.5 rounded text-xs font-bold transition-all hover:bg-slate-50 cursor-pointer">
                    <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    <span>{t.loginToSave}</span>
                  </button>
                ) : (
                  <>
                    <button onClick={handleSaveToFirestore} disabled={isSavingFirestore} className="flex gap-1.5 items-center bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer">
                      <FileText size={14} />
                      <span>{isSavingFirestore ? t.saving : t.saveToFirestore}</span>
                    </button>
                    <button onClick={handleSaveToSheets} disabled={isSavingSheet} className="flex gap-1.5 items-center bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer">
                      <FileText size={14} />
                      <span>{isSavingSheet ? t.saving : t.saveToSheets}</span>
                    </button>
                  </>
                )}
                
                <button onClick={handlePrintReport} className="flex gap-1.5 items-center bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer">
                  <span>🖨️ {t.printReport}</span>
                </button>
              </div>
            </div>
            
            <div className="text-center bg-slate-800 p-3 rounded-lg border border-slate-700 shrink-0 hidden md:block print:bg-white print:border-slate-300">
              <p className="text-slate-400 text-[10px] font-arabic">{t.qrCodeLabel}</p>
              <div className="bg-white p-1 rounded-md inline-block my-1 animate-pulse">
                {/* Visual rendering of a mock QR using simple HTML grid patterns */}
                <div className="w-12 h-12 bg-slate-900 grid grid-cols-4 gap-0.5 p-0.5">
                  <div className="bg-white col-span-2 row-span-2"></div>
                  <div className="bg-white"></div>
                  <div className="bg-slate-905"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white col-span-2"></div>
                </div>
              </div>
              <p className="text-[9px] text-teal-400 font-mono font-bold">{currentPatient.qrCodeValue}</p>
            </div>
          </div>

          {/* Clinical input section: Formulate AI Log */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col print:hidden">
            <h2 className="text-slate-900 text-sm font-black mb-3 flex items-center gap-2">
              <Sparkles className="text-teal-600 w-5 h-5 animate-spin-slow" />
              <span>{t.aiEvalTitle}</span>
            </h2>

            {/* Preset Samples Accordion */}
            <div className="mb-4">
              <p className="text-[11px] text-slate-500 mb-2 font-arabic font-bold">{t.presetsLabel}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {ARABIC_SAMPLE_LOGS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetInsert(sample.text)}
                    className="p-2 text-right bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-[10px] text-slate-700 rounded border border-slate-200 transition-all font-arabic block cursor-pointer"
                  >
                    💡 {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Core Text Input Area */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-arabic">
                  {t.nurseNotesLabel}
                </label>
                <textarea
                  rows={4}
                  value={clinicalText}
                  onChange={e => setClinicalText(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full text-xs p-3 border border-slate-300 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-rose-500 font-arabic leading-relaxed"
                />
                <p className="text-[10px] text-slate-400">
                  {t.aiNotice}
                </p>
              </div>

              {/* Turning Delay Switch Trigger */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-rose-600 w-4 h-4 animate-bounce" />
                    <div>
                      <span className="text-xs font-black text-rose-900 font-arabic">{t.delayAttemptTitle}</span>
                      <p className="text-[9px] text-rose-700 font-arabic">{t.delayAttemptDesc}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isDelayAttempted}
                    onChange={e => setIsDelayAttempted(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>

                {isDelayAttempted && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold text-rose-950 mb-1 font-arabic">
                      {t.delayReasonLabel}
                    </label>
                    <input
                      type="text"
                      value={delayReason}
                      onChange={e => setDelayReason(e.target.value)}
                      placeholder={t.delayReasonPlaceholder}
                      className="w-full text-xs p-1.5 border border-rose-300 bg-white text-rose-900 rounded focus:ring-1 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={setAsViolationForce}
                  type="button"
                  className="bg-slate-100 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  title="محاكاة تخطي الموعد كلياً لتسجيل حالة مخالفة"
                >
                  <AlertOctagon size={14} />
                  <span>{t.simViolationBtn}</span>
                </button>

                <button
                  onClick={handleAnalyzeLogs}
                  disabled={isAnalyzing}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-arabic font-bold px-6 py-2 rounded shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{t.analyzingBtn}</span>
                    </>
                  ) : (
                    <>
                      <HeartPulse size={14} />
                      <span>{t.analyzeBtn}</span>
                    </>
                  )}
                </button>
              </div>

              {analysisError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
                  <Info className="flex-shrink-0" size={14} />
                  <p>{analysisError}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis Output Display */}
          {(analysisResult || currentPatient.bradenScore) && (
            <div className={`rounded-lg border-2 p-5 shadow-md flex-1 relative bg-white ${
              (analysisResult?.isEscalated || currentPatient.isEscalated) ? "border-rose-600 animate-border" : "border-slate-800"
            }`}>
              
              {/* Mandatory header stamp from Professional Polish mockup */}
              <div className={`absolute top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} text-white px-3 py-0.5 text-[9px] font-bold uppercase ${
                (analysisResult?.isEscalated || currentPatient.isEscalated) ? "bg-rose-600" : "bg-slate-900"
              }`}>
                {t.mandatoryOrdersLabel}
              </div>

              <div className="flex justify-between items-start mt-2 pb-3 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {analysisResult ? analysisResult.arabicReport.title : t.latestReportTitle}
                  </h3>
                  <div className="flex gap-2 items-center mt-1">
                    <span className={`px-2 py-0.5 text-xs font-black rounded ${
                      (analysisResult ? analysisResult.bradenScore.total : (currentPatient.bradenScore?.total || 15)) <= 12 
                        ? "bg-rose-100 text-rose-800" 
                        : "bg-teal-100 text-teal-800"
                    }`}>
                      {analysisResult ? analysisResult.arabicReport.riskLevelArabic : (currentPatient.riskLevelArabic || t.lowRiskLevel)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {t.bradenScaleLabel} {analysisResult ? analysisResult.bradenScore.total : (currentPatient.bradenScore?.total || 15)} / 23
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 text-white rounded p-1 text-center min-w-20 font-mono">
                  <p className="text-[8px] uppercase tracking-wide opacity-80">{t.turningPeriodLabel}</p>
                  <p className="text-lg font-bold">
                    {analysisResult ? analysisResult.turningIntervalHours : (currentPatient.turningIntervalHours || 4.0)} {t.hoursLabel}
                  </p>
                </div>
              </div>

              {/* Warnings and alerts output */}
              <div className="space-y-3">
                
                {/* 1. Next Turning deadline visual badge */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center">
                    <p className="text-[9px] text-slate-500 uppercase">{t.nextTurningLabel}</p>
                    <p className="text-xl font-mono font-black text-rose-600 mt-1">{timeLeftStr}</p>
                    <p className="text-[8px] text-rose-500 font-bold mt-0.5">{t.delayWarning}</p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center">
                    <p className="text-[9px] text-slate-500 uppercase">{t.protocolLabel}</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {(analysisResult ? analysisResult.turningIntervalHours : (currentPatient.turningIntervalHours || 4.0)) <= 2.0 ? t.strictProtocol : t.normalProtocol}
                    </p>
                    <p className="text-[8px] text-slate-500 font-bold mt-0.5">
                      {(analysisResult ? analysisResult.turningIntervalHours : (currentPatient.turningIntervalHours || 4.0)) <= 1.5 ? t.microclimateCare : t.standardCare}
                    </p>
                  </div>
                </div>

                {/* 2. Immediate Action REQUIRED */}
                <div className="bg-slate-50 p-3 rounded-md border-r-4 border-slate-900 text-xs">
                  <h4 className="font-bold text-slate-950 mb-1">📋 الإجراء الفوري الواجب اتخاذه من قبل الممرضة بالقسم:</h4>
                  <div className="text-slate-700 leading-relaxed font-arabic whitespace-pre-line text-[11px]">
                    {analysisResult ? analysisResult.arabicReport.immediateAction : `البدء بالتنظيف المستمر للمناطق المعرضة للرطوبة وجدولتها بزاوية ميلان 30 درجة مع الحفاظ على ملاءات مسطحة لمنع قوى القص الحسي.`}
                  </div>
                </div>

                {/* 3. Next Turning Instructions */}
                <div className="bg-teal-50 p-3 rounded-md border-r-4 border-teal-600 text-xs">
                  <h4 className="font-bold text-teal-900 mb-1">🔄 اتجاهات وتوجيهات عملية التقليب القادم:</h4>
                  <div className="text-teal-950 leading-relaxed font-arabic whitespace-pre-line text-[11px]">
                    {analysisResult ? analysisResult.arabicReport.nextTurningInstructions : `تقسيم الضغط عن طريق الوسائد الإسفنجية تحت الكعبين والكوعين وتطبيق نظام تفريغ مستمر للضغط.`}
                  </div>
                </div>

                {/* 4. Head Nurse Escalation protocol (Mandatory alert warning) */}
                {(analysisResult?.isEscalated || currentPatient.isEscalated) && (
                  <div className="bg-rose-50 p-3 rounded border border-rose-100 flex items-start gap-2.5">
                    <AlertTriangle className="text-rose-600 mt-1 flex-shrink-0 animate-bounce" size={18} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-rose-700 uppercase">أمن الامتثال: حالة التصعيد حرج (Escalation Status: CRITICAL)</span>
                        <span className="text-[9px] bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded">رئيسة التمريض المنبهة</span>
                      </div>
                      <p className="text-xs font-bold text-rose-900 leading-normal">
                        {analysisResult ? analysisResult.arabicReport.escalationWarning : `🛑 تحذير طبي قانوني صارم: تم تفعيل بروتوكول التصعيد التلقائي نتيجة لتأخر التقليب المجدول.`}
                      </p>
                      
                      <div className="mt-2 text-[10px] text-rose-700 italic border-t border-rose-200 pt-1">
                        🔊 {analysisResult ? analysisResult.wardHeadNurseNote : `🚨 إشعار عاجل: يرجى التدخل الفوري لتنفيذ التقليب وتدقيق الأسباب لتجنب وقوع خطأ طبي ومسؤولية جزائية.`}
                      </div>
                    </div>
                  </div>
                )}

                {/* Safe state summary if not escalated */}
                {!(analysisResult?.isEscalated || currentPatient.isEscalated) && (
                  <div className="bg-teal-50/50 p-2 text-[10px] text-teal-800 rounded border border-teal-200">
                    🟢 المريض لا يعاني من حالة تصعيد حالياً. يرجى المداومة على فحص السرير والتقليب بالوقت المبرمج.
                  </div>
                )}

                {/* 5. BED-SIDE SCAN REQUIREMENT (Mandatory Warning clause displayed cleanly) */}
                <div className="bg-amber-50 p-3 rounded-md border border-amber-300 text-[10px] leading-relaxed text-amber-900">
                  <div className="flex gap-2 items-start text-xs font-bold font-arabic text-amber-950 mb-1">
                    <Lock size={14} className="text-amber-700 flex-shrink-0" />
                    <span>متطلب التحقق الفعلي بجوار السير (Bedside-Scan Enforced)</span>
                  </div>
                  <p>
                    {t.scanInstructions}
                  </p>
                </div>

              </div>
            </div>
          )}

        </section>

        {/* LEFT COLUMN: Compliance audits, logs, timeline and physical camera barcode simulator (Arabic Left) */}
        <aside className="col-span-12 lg:col-span-12 xl:col-span-3 flex flex-col gap-4 text-right order-3 print:hidden" dir="rtl">
          
          {/* Bedside QR Code Badge Showcase & Interaction */}
          <div className="bg-white rounded-lg border-2 border-slate-900 p-4 shadow-sm flex flex-col items-center">
            <span className="bg-slate-900 text-white text-[9px] font-bold px-3 py-0.5 rounded-full mb-2">
              {t.bedsideScanTitle}
            </span>
            
            <p className="text-[10px] text-slate-500 text-center mb-3">
              هذه التذكرة مطبوعة كملصق طبي مادي بجانب الوسادات لتأكيد الحضور البشري:
            </p>

            <div className="p-3 bg-slate-50 border border-dashed border-slate-400 rounded-lg text-center flex flex-col items-center justify-center w-full max-w-[200px]">
              <div className="font-mono text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded mb-2">
                سرير: {currentPatient.bedNo}
              </div>
              
              {/* QR Render container */}
              <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-inner flex flex-col items-center">
                <div className="w-28 h-28 bg-slate-900 grid grid-cols-6 gap-0.5 p-1 relative">
                  {/* Visual simulated QR landmarks */}
                  <div className="bg-white col-span-2 row-span-2 border-2 border-slate-900"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white"></div>
                  <div className="bg-white col-span-2 row-span-2 absolute top-1 left-1"></div>
                  
                  <div className="bg-white"></div>
                  <div className="bg-slate-900"></div>
                  <div className="bg-white col-span-2 row-span-2 absolute bottom-1 right-1"></div>
                  <div className="bg-white"></div>
                  <div className="bg-slate-900"></div>
                  <div className="bg-slate-900"></div>
                  <div className="bg-white"></div>
                  <div className="bg-slate-900"></div>
                  <div className="bg-white"></div>
                  <div className="bg-slate-950"></div>
                  <div className="bg-white"></div>
                  <div className="bg-slate-900"></div>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 font-mono font-bold">{currentPatient.qrCodeValue}</span>
              </div>

              <div className="mt-2 space-y-1 w-full">
                <span className="text-[9px] font-bold text-slate-600 block">عبد الرحمن الشمري</span>
                <span className={`text-[9px] font-bold block px-1 py-0.5 rounded ${
                  currentPatient.scanStatus === "VERIFIED" ? "bg-teal-100 text-teal-800" : "bg-rose-100 text-rose-800"
                }`}>
                  الحالة: {currentPatient.scanStatus === "VERIFIED" ? "تم المسح والمطابقة" : "بانتظار مسح القارئ"}
                </span>
              </div>
            </div>

            {/* Simulated Handset Scanner Controls */}
            <div className="mt-4 w-full space-y-2">
              <button
                onClick={() => triggerBedsideScan("CAMERA")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                <Camera size={14} className="animate-pulse" />
                <span>{t.activateCameraBtn}</span>
              </button>

              <button
                onClick={() => triggerBedsideScan("INSTANT")}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-3 rounded text-[11px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode size={13} />
                <span>{t.bypassBtn}</span>
              </button>
            </div>
          </div>

          {/* Interactive Smartphone Camera Viewer overlay / mockup feedback */}
          {isScanningActive && (
            <div className="p-4 bg-slate-900 text-white rounded-lg border-2 border-teal-500 shadow-lg space-y-3 relative overflow-hidden">
              <div className="absolute top-1 right-1 bg-red-600 px-2 py-0.5 text-[8px] rounded uppercase tracking-wider font-mono animate-pulse">
                LIVE SCANNER
              </div>
              <p className="text-xs font-bold text-teal-400">كاميرا المسح المحاكاة بجوال الممرض:</p>
              
              {simulatedCameraFeed ? (
                <div className="relative w-full h-32 bg-slate-950 rounded border border-slate-700 flex items-center justify-center overflow-hidden">
                  {/* Simulated laser scanline animation */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 animate-strike opacity-85 z-10 shadow-[0_0_10px_#ef4444]"></div>
                  
                  {/* Subtle target alignment brackets */}
                  <div className="absolute border-2 border-teal-400 w-24 h-24 pointer-events-none rounded opacity-60"></div>

                  {audioBeep ? (
                    <div className="text-center p-2 bg-teal-900/95 rounded border border-teal-400 text-teal-100 animate-bounce text-xs font-bold">
                      🔔 تم رصد الكود بنجاح (1046hz)
                    </div>
                  ) : (
                    <div className="text-center z-0">
                      <div className="w-8 h-8 rounded-full border-4 border-slate-500 border-t-teal-500 animate-spin mx-auto mb-2"></div>
                      <p className="text-[10px] text-slate-300">جاري توجيه الكاميرا نحو المصلق الطبي بجوار السرير...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-800 text-xs rounded border border-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping inline-block left-2 shrink-0"></div>
                  <span className="mr-2 text-teal-300 font-bold">تم إرسال موجه المطابقة الذكي...</span>
                </div>
              )}

              <p className="text-[10px] leading-relaxed text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-center">
                {scanMessage}
              </p>
            </div>
          )}

          {/* 3. Compliance Timeline & Audit Log */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex-1 flex flex-col">
            <h2 className="text-slate-800 text-xs font-black uppercase mb-3 border-b pb-2 flex items-center gap-1.5">
              <Activity size={14} className="text-teal-600" />
              <span>{t.systemAlertTitle}</span>
            </h2>

            <div className="flex-1 space-y-3 max-h-[350px] overflow-y-auto pr-1">
              
              {logs.map((log) => {
                const isViolation = log.status === "VIOLATION" || log.isEscalated;
                return (
                  <div 
                    key={log.id} 
                    className={`text-xs p-3 rounded border transition-all ${
                      isViolation 
                        ? "bg-rose-50 border-rose-200 text-rose-950 font-semibold" 
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isViolation ? "bg-rose-600 text-white" : "bg-teal-700 text-white"
                      }`}>
                        {isViolation ? "مخالفة (Violation)" : "طبيعي (Compliant)"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] font-black">{log.patientName} - سرير: {log.bedNo}</p>
                    <p className="text-[10px] text-slate-600 mt-1 leading-normal">{log.actionTaken}</p>
                    
                    <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100/50 text-[9px] text-slate-500 font-arabic">
                      <span>التحقق: {log.verificationMethod === "QR_BEDSIDE_SCAN" ? "متطابق QR" : log.verificationMethod === "STALE_VIOLATION" ? "تجاوز وقت" : "نظام أوتوماتيكي"}</span>
                      <span className="font-mono bg-slate-200 px-1 text-slate-700 rounded block">{log.bradenScoreText}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50 p-2.5 rounded text-center">
              <p className="text-[10px] text-slate-500 uppercase">مستجدات سلامة الجلسة الحالية</p>
              <div className="flex justify-center items-center gap-2 mt-1">
                <Lock className="text-teal-600" size={12} />
                <span className="text-[10px] font-bold text-slate-700">تشفير خادم طبي متصل 256-bit</span>
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
              </div>
            </div>
          </div>
          
        </aside>

      </main>
      </>
      )}

      {/* FOOTER - Proactive warning and camera launch */}
      <footer className="h-auto md:h-16 bg-slate-900 border-t-2 border-rose-600 flex flex-col md:flex-row items-center px-6 py-3 md:py-0 justify-between gap-3 md:gap-0 flex-shrink-0 text-white print:hidden">
        <div className="flex items-center gap-2.5 text-rose-400 animate-pulse text-center md:text-right">
          <AlertOctagon className="w-5 h-5 flex-shrink-0" />
          <span className="text-[11px] md:text-xs font-black uppercase tracking-wide font-arabic">
            {t.footerWarning}
          </span>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => triggerBedsideScan("CAMERA")}
            className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded font-bold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all uppercase"
          >
            <span>بدء مسح الكود بجانب السرير</span>
            <Camera size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
}
