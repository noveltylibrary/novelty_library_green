import { supabase } from '@/lib/supabase';

export const REPORT_REASONS = [
  'Abusive or threatening language',
  'Harassment or bullying',
  'Hate or discriminatory content',
  'Misleading or fabricated profile information',
  'Misleading or fabricated stories',
  'Impersonation',
  'Spam or promotional abuse',
  'Inappropriate profile picture or banner',
  'Copyright or intellectual-property concern',
  'Sexual or explicit content',
  'Fraud, scam or deceptive activity',
  'Privacy violation / sharing someone else’s information',
  'Other',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];

export interface BlacklistedUser {
  user_id: string;
  name: string | null;
  novelty_username: string | null;
  avatar_url: string | null;
  report_count: number;
  blacklisted_at: string | null;
  blacklist_reason: string | null;
}

export interface GrievanceRecord {
  id: string;
  category: string;
  subject: string;
  details: string;
  status: string;
  reference_no: string;
  created_at: string;
  updated_at: string;
}

export async function reportUser(targetUserId: string, reason: ReportReason, details?: string) {
  const { data, error } = await supabase.rpc('submit_user_report', {
    p_target_user_id: targetUserId,
    p_reason: reason,
    p_details: details?.trim().slice(0, 2000) || null,
  });
  if (error) throw error;
  return data as { report_count: number; blacklisted: boolean };
}

export async function isUserBlacklisted(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_profile_blacklisted', { p_username: username });
  if (error) throw error;
  return Boolean(data);
}

export async function createGrievance(category: string, subject: string, details: string) {
  const { data, error } = await supabase.rpc('submit_grievance', {
    p_category: category.trim().slice(0, 80),
    p_subject: subject.trim().slice(0, 160),
    p_details: details.trim().slice(0, 5000),
  });
  if (error) throw error;
  return data as GrievanceRecord;
}

export async function fetchMyGrievances(): Promise<GrievanceRecord[]> {
  const { data, error } = await supabase
    .from('user_grievances')
    .select('id,category,subject,details,status,reference_no,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GrievanceRecord[];
}

export async function fetchBlacklistedUsers(): Promise<BlacklistedUser[]> {
  const { data, error } = await supabase.rpc('admin_list_blacklisted_users');
  if (error) throw error;
  return (data ?? []) as BlacklistedUser[];
}
