import { apiClient } from './client';
const BASE='/api/v1/vendor/support';
export type VendorSupportMessage={id:string;sender_type:string;message:string;created_at:string};
export type VendorSupportTicket={id:string;subject:string;category:string;priority:string;status:string;updated_at:string;messages?:VendorSupportMessage[]};
export const vendorSupportApi={
  list:()=>apiClient.get<{items:VendorSupportTicket[];total:number}>(`${BASE}/tickets`),
  create:(body:Record<string,unknown>)=>apiClient.post<VendorSupportTicket>(`${BASE}/tickets`,body),
  get:(id:string)=>apiClient.get<VendorSupportTicket>(`${BASE}/tickets/${encodeURIComponent(id)}`),
  message:(id:string,message:string)=>apiClient.post<VendorSupportTicket>(`${BASE}/tickets/${encodeURIComponent(id)}/messages`,{message}),
  close:(id:string)=>apiClient.patch<VendorSupportTicket>(`${BASE}/tickets/${encodeURIComponent(id)}/close`,{}),
};
