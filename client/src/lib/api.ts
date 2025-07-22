import { apiRequest } from './queryClient';

export const api = {
  orders: {
    create: (data: any) => apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updateStatus: (id: number, status: string) => apiRequest(`/api/orders/${id}/status`, {
      method: 'PATCH', 
      body: JSON.stringify({ status }),
    }),
    updatePaymentStatus: (id: number, paymentStatus: string) => apiRequest(`/api/orders/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentStatus }),
    }),
  },
  sms: {
    send: (data: { orderId: number; phoneNumber: string; message: string }) => 
      apiRequest('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  admin: {
    login: (credentials: { username: string; password: string }) =>
      apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    check: () => apiRequest('/api/admin/check'),
  },
};