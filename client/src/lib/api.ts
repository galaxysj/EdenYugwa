import { apiRequest } from "./queryClient";
import type { InsertOrder, Order } from "@shared/schema";

export const api = {
  // Orders
  orders: {
    create: async (order: InsertOrder): Promise<Order> => {
      const response = await apiRequest("POST", "/api/orders", order);
      return response.json();
    },
    
    getAll: async (): Promise<Order[]> => {
      const response = await apiRequest("GET", "/api/orders");
      return response.json();
    },
    
    getById: async (id: number): Promise<Order> => {
      const response = await apiRequest("GET", `/api/orders/${id}`);
      return response.json();
    },
    
    updateStatus: async (id: number, status: string): Promise<Order> => {
      const response = await apiRequest("PATCH", `/api/orders/${id}/status`, { status });
      return response.json();
    },
  },
  
  // SMS
  sms: {
    send: async (data: { orderId: number; phoneNumber: string; message: string }) => {
      const response = await apiRequest("POST", "/api/sms/send", data);
      return response.json();
    },
  },
};
