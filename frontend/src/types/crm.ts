/**
 * CRM Module Types
 * Types for customer, location, and contact management
 */
// src/types/crm.ts
export interface Customer {
  id: number;
  company_name: string;
  gstin?: string;
  address?: string;
  created_at?: string;
}

export interface CustomerLocation {
  id: number;
  customer_id: number;
  location_name: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  is_active: number;
  created_at?: string;
}

export interface CustomerContact {
  id: number;
  location_id: number;
  contact_name: string;
  phone?: string;
  email?: string;
  is_primary: number;
  is_active: number;
  created_at?: string;
}

/**
 * Snapshot types for quotation data capture
 * These are immutable values stored with the quotation
 */
export interface QuotationSnapshot {
  customer_id: number;
  customer_name: string;
  location_id: number;
  location_name: string;
  location_address?: string;
  contact_id: number;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface CrmSelectionState {
  selectedCustomer: Customer | null;
  selectedLocation: CustomerLocation | null;
  selectedContact: CustomerContact | null;
  locations: CustomerLocation[];
  contacts: CustomerContact[];
  loadingLocations: boolean;
  loadingContacts: boolean;
}

export interface CreateCustomerPayload {
  company_name: string;
  gstin?: string;
  address?: string;
}

export interface CreateLocationPayload {
  location_name: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface CreateContactPayload {
  contact_name: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
}
