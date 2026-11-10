export type EducationMedium = 'english' | 'telugu';
export type LearningGoal = 'mock_test' | 'practice' | 'ai_support' | 'other';
export interface PublicUser {
  id: string; email: string; name: string | null; avatarUrl: string | null;
  accountType: 'FREE' | 'PREMIUM'; subscriptionStatus: 'NONE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  subscriptionExpiresAt: string | null; subscriptionPlan: string | null;
  /** 'web' = Razorpay / admin grant, 'google_play' = Play subscription. Older servers omit it. */
  subscriptionSource?: 'web' | 'google_play' | null;
  /** Active Google Play plan key, even when website access ends later. */
  playPlan?: string | null;
  role: 'user' | 'admin'; onboardingCompleted: boolean;
  educationMedium?: EducationMedium | null; learningGoals: LearningGoal[];
}
export interface PublicDevice {
  deviceId: string; platform: 'WEB' | 'ANDROID' | 'IOS'; firstLoginAt: string;
  lastLoginAt: string; loginCount: number; lastActivityAt: string | null;
  currentSessionStatus: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | null;
}
