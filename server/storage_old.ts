import { orders, smsNotifications, admins, type Order, type InsertOrder, type SmsNotification, type InsertSmsNotification, type Admin, type InsertAdmin } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Order management
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByPhone(phone: string): Promise<Order[]>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
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

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.customerPhone === phone)
      .sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
  }

  async updateOrder(id: number, updateData: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const updatedOrder: Order = {
      ...order,
      ...updateData,
    };

    this.orders.set(id, updatedOrder);
    return updatedOrder;
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

export class DatabaseStorage implements IStorage {
  private orderCounter: number = 1;

  constructor() {
    this.initializeOrderCounter();
    this.ensureDefaultAdmin();
  }

  private async initializeOrderCounter() {
    try {
      const lastOrder = await db.select().from(orders).orderBy(orders.id).limit(1);
      if (lastOrder.length > 0) {
        // Extract number from orderNumber (e.g., "ED003" -> 3)
        const match = lastOrder[0].orderNumber.match(/ED(\d+)/);
        if (match) {
          this.orderCounter = parseInt(match[1]) + 1;
        }
      }
    } catch (error) {
      console.error('Failed to initialize order counter:', error);
    }
  }

  private async ensureDefaultAdmin() {
    try {
      const existingAdmin = await this.getAdminByUsername("admin");
      if (!existingAdmin) {
        await this.createAdmin({
          username: "admin",
          password: "eden2024!",
        });
      }
    } catch (error) {
      console.error('Failed to create default admin:', error);
    }
  }

  private generateOrderNumber(): string {
    const number = this.orderCounter.toString().padStart(3, '0');
    this.orderCounter++;
    return `ED${number}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = this.generateOrderNumber();
    const [order] = await db
      .insert(orders)
      .values({
        ...insertOrder,
        orderNumber,
        status: insertOrder.status || "pending",
        paymentStatus: "pending",
      })
      .returning();
    return order;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.customerPhone, phone))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrder(id: number, updateData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async updatePaymentStatus(id: number, paymentStatus: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ 
        paymentStatus,
        paymentConfirmedAt: paymentStatus === 'confirmed' ? new Date() : null
      })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async createSmsNotification(insertNotification: InsertSmsNotification): Promise<SmsNotification> {
    const [notification] = await db
      .insert(smsNotifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async getSmsNotificationsByOrderId(orderId: number): Promise<SmsNotification[]> {
    return await db.select().from(smsNotifications)
      .where(eq(smsNotifications.orderId, orderId))
      .orderBy(desc(smsNotifications.sentAt));
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db
      .insert(admins)
      .values(insertAdmin)
      .returning();
    return admin;
  }
}

export const storage = new DatabaseStorage();
