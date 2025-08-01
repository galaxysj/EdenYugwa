import { apiRequest } from './queryClient';

export const api = {
  orders: {
    create: async (data: any) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('주문 생성에 실패했습니다');
      }
      
      return response.json();
    },
    getAll: async () => {
      const response = await fetch('/api/orders');
      
      if (!response.ok) {
        throw new Error('주문 목록 조회에 실패했습니다');
      }
      
      return response.json();
    },
    updateStatus: async (id: number, status: string) => {
      const response = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error('주문 상태 업데이트에 실패했습니다');
      }
      
      return response.json();
    },
    updatePaymentStatus: async (id: number, paymentStatus: string) => {
      const response = await fetch(`/api/orders/${id}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentStatus }),
      });
      
      if (!response.ok) {
        throw new Error('입금 상태 업데이트에 실패했습니다');
      }
      
      return response.json();
    },
    update: async (id: number, data: any) => {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('주문 수정에 실패했습니다');
      }
      
      return response.json();
    },
  },
  sms: {
    send: async (data: { orderId: number; phoneNumber: string; message: string }) => {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('SMS 전송에 실패했습니다');
      }
      
      return response.json();
    },
  },
  admin: {
    login: async (credentials: { username: string; password: string }) => {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        throw new Error('로그인에 실패했습니다');
      }
      
      return response.json();
    },
    check: async () => {
      const response = await fetch('/api/admin/check');
      
      if (!response.ok) {
        throw new Error('인증 확인에 실패했습니다');
      }
      
      return response.json();
    },
  },
};