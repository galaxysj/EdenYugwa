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
  getOrdersByName(name: string): Promise<Order[]>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  updateOrderScheduledDate(id: number, scheduledDate: Date | null): Promise<Order | undefined>;
  updatePaymentStatus(id: number, paymentStatus: string): Promise<Order | undefined>;
  
  // SMS notifications
  createSmsNotification(notification: InsertSmsNotification): Promise<SmsNotification>;
  getSmsNotificationsByOrderId(orderId: number): Promise<SmsNotification[]>;

  // Admin authentication
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
}

export class DatabaseStorage implements IStorage {
  private orderCounter: number = 1;

  constructor() {
    this.initializeOrderCounter();
    this.ensureDefaultAdmin();
  }

  private async initializeOrderCounter() {
    try {
      const lastOrder = await db.select().from(orders).orderBy(desc(orders.id)).limit(1);
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
    const orderData = {
      customerName: insertOrder.customerName,
      customerPhone: insertOrder.customerPhone,
      zipCode: insertOrder.zipCode,
      address1: insertOrder.address1,
      address2: insertOrder.address2,
      smallBoxQuantity: insertOrder.smallBoxQuantity,
      largeBoxQuantity: insertOrder.largeBoxQuantity,
      wrappingQuantity: insertOrder.wrappingQuantity,
      totalAmount: insertOrder.totalAmount,
      specialRequests: insertOrder.specialRequests,
      orderNumber,
      status: insertOrder.status || "pending",
      paymentStatus: "pending",
    };
    
    const [order] = await db
      .insert(orders)
      .values(orderData)
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
    return await db.select().from(orders).orderBy(
      // 예약발송일이 있는 주문을 먼저, 그 다음 생성일 역순
      orders.scheduledDate,
      desc(orders.createdAt)
    );
  }

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.customerPhone, phone))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByName(name: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.customerName, name))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrder(id: number, updateData: Partial<InsertOrder>): Promise<Order | undefined> {
    // Convert string dates to Date objects if needed
    const processedData: any = { ...updateData };
    if (processedData.scheduledDate && typeof processedData.scheduledDate === 'string') {
      processedData.scheduledDate = new Date(processedData.scheduledDate);
    }
    
    const [order] = await db
      .update(orders)
      .set(processedData)
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

  async updateOrderScheduledDate(id: number, scheduledDate: Date | null): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ scheduledDate })
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

  async updateFinancialInfo(id: number, data: {
    actualPaidAmount?: number;
    discountAmount?: number;
    discountReason?: string;
    smallBoxCost?: number;
    largeBoxCost?: number;
    totalCost?: number;
    netProfit?: number;
  }): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set(data)
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }
}

export const storage = new DatabaseStorage();