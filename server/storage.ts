import { orders, smsNotifications, type Order, type InsertOrder, type SmsNotification, type InsertSmsNotification } from "@shared/schema";

export interface IStorage {
  // Order management
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  
  // SMS notifications
  createSmsNotification(notification: InsertSmsNotification): Promise<SmsNotification>;
  getSmsNotificationsByOrderId(orderId: number): Promise<SmsNotification[]>;
}

export class MemStorage implements IStorage {
  private orders: Map<number, Order>;
  private smsNotifications: Map<number, SmsNotification>;
  private currentOrderId: number;
  private currentSmsId: number;
  private orderCounter: number;

  constructor() {
    this.orders = new Map();
    this.smsNotifications = new Map();
    this.currentOrderId = 1;
    this.currentSmsId = 1;
    this.orderCounter = 1;
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
}

export const storage = new MemStorage();
