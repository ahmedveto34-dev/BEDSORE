export interface BradenScore {
  sensoryPerception: number; // 1-4
  moisture: number; // 1-4
  activity: number; // 1-4
  mobility: number; // 1-4
  nutrition: number; // 1-4
  frictionShear: number; // 1-3
  total: number; // 6-23
}

export interface ArabicReport {
  title: string;
  riskLevelArabic: string;
  immediateAction: string;
  nextTurningInstructions: string;
  escalationWarning: string;
  isEscalated: boolean;
}

export interface AnalysisResponse {
  bradenScore: BradenScore;
  riskLevel: "Severe Risk" | "High Risk" | "Moderate Risk" | "Low Risk";
  turningIntervalHours: number;
  isEscalated: boolean;
  arabicReport: ArabicReport;
  wardHeadNurseNote: string;
  _isFallback?: boolean;
  fallbackMessage?: string;
}

export interface Patient {
  id: string;
  name: string;
  bedNo: string;
  age: number;
  admissionReason: string;
  lastClinicalText: string;
  bradenScore?: BradenScore;
  riskLevel?: string;
  riskLevelArabic?: string;
  turningIntervalHours?: number;
  nextTurningTime?: string; // ISO string
  isEscalated: boolean;
  escalationMessage?: string;
  qrCodeValue: string;
  scanStatus: "PENDING_SCAN" | "VERIFIED" | "VIOLATION";
  existingUlcers?: string[]; // Added: array of current ulcer locations
}

export interface TurnLog {
  id: string;
  patientId: string;
  patientName: string;
  bedNo: string;
  timestamp: string;
  actionTaken: string;
  nurseNotes: string;
  bradenScoreText: string;
  isEscalated: boolean;
  verificationMethod: "QR_BEDSIDE_SCAN" | "MOCK_FORCE" | "STALE_VIOLATION";
  status: "COMPLIANT" | "VIOLATION" | "PENDING_VERIFICATION";
}
