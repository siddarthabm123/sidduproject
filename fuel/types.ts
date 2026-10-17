export type FuelType = 'diesel' | 'petrol';
export type VoucherStatus = 'GENERATED' | 'REDEEMED' | 'EXPIRED';
export interface MapPin { id: string; latitude: number; longitude: number }
export interface FuelBunk extends MapPin {
  name: string; brand: string; address: string; discount_per_litre: number;
  is_partner: boolean; fuel_types_available: FuelType[]; contact_phone: string;
  created_at: string; distance_km: number;
}
export interface FuelVoucher {
  id: string; owner_id: string; bunk_id: string; equipment_id: string | null;
  fuel_type: 'DIESEL' | 'PETROL'; quantity_litres: number; discount_rate: number;
  estimated_savings: number; voucher_code: string; verification_token: string;
  status: VoucherStatus; expires_at: string; created_at: string; request_id: string;
  bunk_name: string; bunk_address: string; demo?: boolean;
}
export type PublicFuelVoucher = Pick<FuelVoucher, 'id'|'bunk_id'|'bunk_name'|'bunk_address'|'fuel_type'|'quantity_litres'|'discount_rate'|'estimated_savings'|'voucher_code'|'status'|'expires_at'>;
export interface FuelCenter extends MapPin { label: string }
export interface FuelContext {
  can_register: boolean; can_offer_discounts: boolean; can_generate: boolean;
  equipment: { id: string; title: string }[]; centers: FuelCenter[];
}
export interface NearbyFuelResponse { bunks: FuelBunk[] }
export interface VoucherResponse { voucher: FuelVoucher }
export interface BunkRegistration {
  name: string; brand: string; address: string; latitude: number; longitude: number;
  discount_per_litre: number; is_partner: boolean; fuel_types_available: FuelType[]; contact_phone: string;
}
