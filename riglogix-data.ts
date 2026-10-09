import { supabase } from './supabase';

export type UserRole = 'customer' | 'owner';

export type SignUpProfile = {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  workspaceName: string;
  phone?: string;
  serviceArea?: string;
  upiId?: string;
  bankName?: string;
  aadhaarLast4?: string;
  address?: string;
};

export type ProfileUpdate = {
  fullName: string;
  workspaceName: string;
  phone?: string;
  serviceArea?: string;
  upiId?: string;
  bankName?: string;
};

export type EmailOtpProfile = {
  email: string;
  role: UserRole;
  fullName: string;
  workspaceName: string;
  phone?: string;
  serviceArea?: string;
  aadhaarLast4: string;
};

export type BookingInsert = {
  public_code: string;
  customer_id: string;
  owner_id: string;
  equipment_id: string;
  requested_date: string;
  job_address: string;
  job_lat: number;
  job_lng: number;
  billing_unit: 'hour' | 'foot' | 'survey' | 'km';
  quantity?: number;
  unit_rate_paise?: number;
  base_cost_paise: number;
  platform_fee_paise: number;
  total_cost_paise: number;
  owner_earnings_paise: number;
  wallet_hold_paise: number;
  penalty_amount_paise: number;
  route_km?: number;
  pickup_lat?: number;
  pickup_lng?: number;
  instructions?: string;
  casing_option_id?: string;
  casing_depth_feet?: number;
  terrain_rate_id?: string;
};

export async function signUpWithProfile(profile: SignUpProfile) {
  if (!supabase) return { data: { user: null, session: null }, error: new Error('Real accounts require Supabase. Use the demo profiles until it is connected.') };
  return supabase.auth.signUp({
    email: profile.email,
    password: profile.password,
    options: {
      data: {
        role: profile.role,
        full_name: profile.fullName,
        workspace_name: profile.workspaceName,
        phone: profile.phone,
        service_area: profile.serviceArea,
        upi_id: profile.upiId,
        bank_name: profile.bankName,
        aadhaar_last4: profile.aadhaarLast4,
        address: profile.address,
      },
    },
  });
}

export async function loadCurrentAppState() {
  if (!supabase) return { data: {} as Record<string, unknown>, error: null };
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return { data: {} as Record<string, unknown>, error: sessionError ?? new Error('Authentication required') };
  const result = await supabase.from('user_app_state').select('state').eq('user_id', sessionData.user.id).maybeSingle();
  return { data: (result.data?.state ?? {}) as Record<string, unknown>, error: result.error };
}

export async function initializeCurrentAppState() {
  if (!supabase) return { data: null, error: null };
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return { data: null, error: sessionError ?? new Error('Authentication required') };
  return loadCurrentAppState();
}

export async function saveCurrentAppStateValue(key: string, value: unknown) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase.rpc('set_app_state_value', { p_key: key, p_value: value });
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) return { data: { user: null, session: null }, error: new Error('Real accounts require Supabase. Use the demo profiles until it is connected.') };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function sendPhoneOtp(phone: string, role: UserRole) {
  if (!supabase) return { data: null, error: new Error('Supabase phone login is not configured yet') };
  return supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
      data: {
        role,
        full_name: role === 'customer' ? 'New customer' : 'New equipment owner',
        workspace_name: role === 'customer' ? 'Customer workspace' : 'Owner workspace',
        phone,
      },
    },
  });
}

export async function verifyPhoneOtp(phone: string, token: string) {
  if (!supabase) return { data: null, error: new Error('Supabase phone login is not configured yet') };
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

export async function sendEmailSignupOtp(profile: EmailOtpProfile) {
  if (!supabase) return { data: null, error: new Error('Supabase email verification is not configured yet') };
  return supabase.auth.signInWithOtp({
    email: profile.email,
    options: {
      shouldCreateUser: true,
      data: {
        role: profile.role,
        full_name: profile.fullName,
        workspace_name: profile.workspaceName,
        phone: profile.phone,
        service_area: profile.serviceArea,
        aadhaar_last4: profile.aadhaarLast4,
      },
    },
  });
}

export async function verifyEmailSignupOtp(email: string, token: string) {
  if (!supabase) return { data: null, error: new Error('Supabase email verification is not configured yet') };
  return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export async function setCurrentPassword(password: string) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase.auth.updateUser({ password });
}

export async function markAadhaarReferenceVerified(aadhaarLast4: string) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return { data: null, error: sessionError ?? new Error('Authentication required') };
  return supabase
    .from('users')
    .update({ aadhaar_last4: aadhaarLast4, updated_at: new Date().toISOString() })
    .eq('id', sessionData.user.id)
    .select('*')
    .single();
}

export async function signOutSupabase() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

export async function getCurrentProfile() {
  if (!supabase) return { data: null, error: null };
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return { data: null, error: sessionError };
  return supabase.from('users').select('*, wallets(*)').eq('id', sessionData.user.id).single();
}

export async function updateCurrentProfile(profile: ProfileUpdate) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) return { data: null, error: sessionError ?? new Error('Authentication required') };

  const userUpdate = await supabase
    .from('users')
    .update({
      full_name: profile.fullName,
      workspace_name: profile.workspaceName,
      phone: profile.phone,
      service_area: profile.serviceArea,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionData.user.id)
    .select('*')
    .single();

  if (userUpdate.error) return userUpdate;

  const walletUpdate = await supabase.rpc('update_wallet_profile', {
    p_upi: profile.upiId || 'set-upi@bank',
    p_bank: profile.bankName || 'Linked bank pending',
  });
  if (walletUpdate.error) return { data: null, error: walletUpdate.error };
  return getCurrentProfile();
}

export async function createBookingRequest(payload: BookingInsert) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return { data: null, error: new Error('Use request_equipment_booking: prices and owner IDs must be calculated on the server.') };
}

export async function listVerifiedEquipment() {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from('equipment')
    .select('*')
    .eq('is_verified', true)
    .order('created_at', { ascending: false });
}

export async function listBorewellRates() {
  if (!supabase) return { data: { terrain: [], casing: [] }, error: null };
  const [terrain, casing] = await Promise.all([
    supabase.from('borewell_terrain_rates').select('*').eq('is_active', true).order('rate_paise_per_foot'),
    supabase.from('borewell_casing_options').select('*').eq('is_active', true).order('rate_paise_per_foot'),
  ]);

  return {
    data: {
      terrain: terrain.data ?? [],
      casing: casing.data ?? [],
    },
    error: terrain.error ?? casing.error,
  };
}

export async function depositToWallet(_amountPaise: number, _reference?: string) {
  return { data: null, error: new Error('Payments are not connected. No real deposit has been made.') };
}

export async function withdrawFromWallet(_amountPaise: number, _reference?: string) {
  return { data: null, error: new Error('Payments are not connected. No bank transfer has been made.') };
}

export async function acceptBooking(bookingId: string) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase.rpc('accept_booking', { p_booking_id: bookingId });
}

export async function cancelBooking(bookingId: string) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase.rpc('cancel_booking', { p_booking_id: bookingId });
}

export async function completeBooking(bookingId: string) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured') };
  return supabase.rpc('complete_booking', { p_booking_id: bookingId });
}

export async function listMyBookings(userId: string) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from('bookings')
    .select('*, equipment(*)')
    .or(`customer_id.eq.${userId},owner_id.eq.${userId}`)
    .order('created_at', { ascending: false });
}

export async function listWallet(userId: string) {
  if (!supabase) return { data: null, error: null };
  return supabase.from('wallets').select('*').eq('user_id', userId).single();
}

export async function listOwnerEquipmentLocations(ownerId: string) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from('equipment_locations')
    .select('*, equipment!inner(*)')
    .eq('equipment.owner_id', ownerId)
    .order('recorded_at', { ascending: false });
}
