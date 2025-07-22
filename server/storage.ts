import { orders, smsNotifications, admins, type Order, type InsertOrder, type SmsNotification, type InsertSmsNotification, type Admin, type InsertAdmin } from "@shared/schema";

export interface IStorage {
  // Order management
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  updatePaymentStatus(id: number, paymentStatus: string): Promise<Order | undefined>;
  
  // SMS notifications
  createSmsNotification(notification: InsertSmsNotification): Promise<SmsNotification>;
  getSmsNotificationsByOrderId(orderId: number): Promise<SmsNotification[]>;

  // Admin authentication
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
}

export class MemStorage implements IStorage {
  private orders: Map<number, Order>;
  private smsNotifications: Map<number, SmsNotification>;
  private admins: Map<number, Admin>;
  private currentOrderId: number;
  private currentSmsId: number;
  private currentAdminId: number;
  private orderCounter: number;

  constructor() {
    this.orders = new Map();
    this.smsNotifications = new Map();
    this.admins = new Map();
    this.currentOrderId = 1;
    this.currentSmsId = 1;
    this.currentAdminId = 1;
    this.orderCounter = 1;

    // Create default admin account
    this.createAdmin({
      username: "admin",
      password: "eden2024!",
    });
  }

  private generateOrderNumber(): string {
    const number = this.orderCounter.toString().padStart(3, '0');
    this.orderCounter++;
    return `ED${number}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const orderNumber = this.generateOrderNumber();
    const order: Order = {
      ...insertOrder,
      id,
      orderNumber,
      zipCode: insertOrder.zipCode || null,
      address2: insertOrder.address2 || null,
      specialRequests: insertOrder.specialRequests || null,
      status: insertOrder.status || "pending",
      paymentStatus: "pending",
      paymentConfirmedAt: null,
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(
      (order) => order.orderNumber === orderNumber,
    );
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (order) {
      const updatedOrder = { ...order, status };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    }
    return undefined;
  }

  async updatePaymentStatus(id: number, paymentStatus: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (order) {
      const updatedOrder = { 
        ...order, 
        paymentStatus,
        paymentConfirmedAt: paymentStatus === 'confirmed' ? new Date() : order.paymentConfirmedAt
      };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    }
    return undefined;
  }

  async createSmsNotification(insertNotification: InsertSmsNotification): Promise<SmsNotification> {
    const id = this.currentSmsId++;
    const notification: SmsNotification = {
      ...insertNotification,
      id,
      sentAt: new Date(),
    };
    this.smsNotifications.set(id, notification);
    return notification;
  }

  async getSmsNotificationsByOrderId(orderId: number): Promise<SmsNotification[]> {
    return Array.from(this.smsNotifications.values()).filter(
      (notification) => notification.orderId === orderId,
    );
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(
      (admin) => admin.username === username,
    );
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const id = this.currentAdminId++;
    const admin: Admin = {
      ...insertAdmin,
      id,
      createdAt: new Date(),
    };
    this.admins.set(id, admin);
    return admin;
  }
}

export const storage = new MemStorage();
