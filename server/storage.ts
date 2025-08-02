import { orders, smsNotifications, admins, managers, settings, adminSettings, type Order, type InsertOrder, type SmsNotification, type InsertSmsNotification, type Admin, type InsertAdmin, type Manager, type InsertManager, type Setting, type InsertSetting, type AdminSettings, type InsertAdminSettings } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

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
  
  // Manager authentication and management
  getManagerByUsername(username: string): Promise<Manager | undefined>;
  createManager(manager: InsertManager): Promise<Manager>;
  getAllManagers(): Promise<Manager[]>;
  getManagerById(id: number): Promise<Manager | undefined>;
  updateManager(id: number, manager: Partial<InsertManager>): Promise<Manager | undefined>;
  deleteManager(id: number): Promise<void>;
  
  // Settings management
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string, description?: string): Promise<Setting>;
  getAllSettings(): Promise<Setting[]>;
  
  // Admin settings management
  getAdminSettings(): Promise<AdminSettings | undefined>;
  updateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;
  
  // Trash/Delete operations
  softDeleteOrder(id: number): Promise<Order | undefined>;
  restoreOrder(id: number): Promise<Order | undefined>;
  getDeletedOrders(): Promise<Order[]>;
  permanentDeleteOrder(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private orderCounter: number = 1;

  constructor() {
    this.initializeOrderCounter();
    this.ensureDefaultAdmin();
    this.ensureDefaultManager();
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

  private async ensureDefaultManager() {
    try {
      const existingManager = await this.getManagerByUsername("manager");
      if (!existingManager) {
        await this.createManager({
          username: "manager",
          password: "eden2024!",
        });
      }
    } catch (error) {
      console.error('Failed to create default manager:', error);
    }
  }

  private async generateOrderNumber(): Promise<string> {
    // Get current date in YYYYMMDD format
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Get all orders created today to determine the sequence number
    const todayStart = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);
    
    const todayOrders = await db.select()
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, todayStart),
          lte(orders.createdAt, todayEnd)
        )
      );
    
    // Sequence number is the count of today's orders + 1
    const sequenceNumber = (todayOrders.length + 1).toString().padStart(2, '0');
    
    return `ED${dateStr}${sequenceNumber}`;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = await this.generateOrderNumber();
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
      scheduledDate: insertOrder.scheduledDate,
      shippingFee: insertOrder.shippingFee || 0,
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
    const allOrders = await db.select().from(orders)
      .where(eq(orders.isDeleted, false))
      .orderBy(
        // 예약발송일이 있는 주문을 먼저, 그 다음 생성일 역순
        orders.scheduledDate,
        desc(orders.createdAt)
      );
    
    // Get global cost settings
    const smallBoxCostSetting = await this.getSetting("smallBoxCost");
    const largeBoxCostSetting = await this.getSetting("largeBoxCost");
    
    const globalSmallBoxCost = smallBoxCostSetting ? parseInt(smallBoxCostSetting.value) : 0;
    const globalLargeBoxCost = largeBoxCostSetting ? parseInt(largeBoxCostSetting.value) : 0;
    
    // Apply global costs and calculate profits for orders that don't have custom costs
    return allOrders.map(order => {
      const smallBoxCost = order.smallBoxCost || globalSmallBoxCost;
      const largeBoxCost = order.largeBoxCost || globalLargeBoxCost;
      
      // Calculate total cost (including wrapping cost)
      const wrappingCost = order.wrappingQuantity * 2000; // 보자기 개당 2,000원
      const totalCost = (smallBoxCost * order.smallBoxQuantity) + (largeBoxCost * order.largeBoxQuantity) + wrappingCost;
      
      // Calculate shipping fee
      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
      const shippingFee = totalItems >= 6 ? 0 : 4000;
      
      // Calculate net profit
      const actualPaid = order.actualPaidAmount || 0;
      const netProfit = actualPaid - totalCost - shippingFee;
      
      return {
        ...order,
        smallBoxCost,
        largeBoxCost,
        totalCost,
        netProfit
      };
    });
  }

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(eq(orders.customerPhone, phone), eq(orders.isDeleted, false)))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByName(name: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(eq(orders.customerName, name), eq(orders.isDeleted, false)))
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
    const updateData: any = { status };
    
    // 발송완료 상태로 변경하는 경우 현재 날짜를 설정
    if (status === 'delivered') {
      updateData.deliveredDate = new Date();
    }
    
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async updatePaymentStatus(id: number, paymentStatus: string, actualPaidAmount?: number, discountReason?: string): Promise<Order | undefined> {
    const updateData: any = { 
      paymentStatus,
      paymentConfirmedAt: paymentStatus === 'confirmed' ? new Date() : null
    };

    // If actual paid amount is provided and payment is confirmed, calculate discount
    if (paymentStatus === 'confirmed' && actualPaidAmount !== undefined) {
      const currentOrder = await this.getOrder(id);
      if (currentOrder) {
        updateData.actualPaidAmount = actualPaidAmount;
        
        // Calculate discount amount (주문금액 - 실입금액)
        const discountAmount = currentOrder.totalAmount - actualPaidAmount;
        
        if (discountAmount > 0) {
          // 부분미입금인지 할인인지 구분
          if (discountReason && discountReason.includes('할인')) {
            // 할인인 경우 - 입금완료로 처리
            updateData.discountAmount = discountAmount;
            updateData.discountReason = discountReason;
            updateData.paymentStatus = 'confirmed';
          } else {
            // 부분미입금인 경우 - 부분결제로 처리
            updateData.discountAmount = 0;
            updateData.discountReason = discountReason || `부분미입금 (미입금: ${discountAmount.toLocaleString()}원)`;
            updateData.paymentStatus = 'partial';
          }
        } else if (discountAmount < 0) {
          // 과납입의 경우
          updateData.discountAmount = 0;
          updateData.discountReason = discountReason || `과납입 (${Math.abs(discountAmount).toLocaleString()}원 추가 입금)`;
          updateData.paymentStatus = 'confirmed';
        } else {
          // 정확한 금액 입금
          updateData.discountAmount = 0;
          updateData.discountReason = null;
          updateData.paymentStatus = 'confirmed';
        }
      }
    }

    const [order] = await db
      .update(orders)
      .set(updateData)
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

  async updateOrderDeliveredDate(id: number, deliveredDate: Date | null): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ deliveredDate })
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

  // Manager authentication
  async getManagerByUsername(username: string): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.username, username));
    return manager || undefined;
  }

  async createManager(insertManager: InsertManager): Promise<Manager> {
    const [manager] = await db
      .insert(managers)
      .values(insertManager)
      .returning();
    return manager;
  }

  async getAllManagers(): Promise<Manager[]> {
    return await db.select().from(managers).orderBy(desc(managers.createdAt));
  }

  async getManagerById(id: number): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.id, id));
    return manager || undefined;
  }

  async updateManager(id: number, manager: Partial<InsertManager>): Promise<Manager | undefined> {
    const [updatedManager] = await db
      .update(managers)
      .set(manager)
      .where(eq(managers.id, id))
      .returning();
    return updatedManager || undefined;
  }

  async deleteManager(id: number): Promise<void> {
    await db.delete(managers).where(eq(managers.id, id));
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

  // Settings management
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string, description?: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ 
          value, 
          description: description || existing.description,
          updatedAt: new Date()  
        })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(settings)
        .values({ key, value, description })
        .returning();
      return created;
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  // Trash/Delete operations
  async softDeleteOrder(id: number): Promise<Order | undefined> {
    const [deletedOrder] = await db.update(orders)
      .set({ 
        isDeleted: true,
        deletedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    return deletedOrder || undefined;
  }

  async restoreOrder(id: number): Promise<Order | undefined> {
    const [restoredOrder] = await db.update(orders)
      .set({ 
        isDeleted: false,
        deletedAt: null
      })
      .where(eq(orders.id, id))
      .returning();
    return restoredOrder || undefined;
  }

  async getDeletedOrders(): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.isDeleted, true))
      .orderBy(desc(orders.deletedAt));
  }

  async permanentDeleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Admin settings management
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [adminSetting] = await db.select().from(adminSettings).limit(1);
    return adminSetting || undefined;
  }

  async updateAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    // Check if admin settings exist
    const existing = await this.getAdminSettings();
    
    if (existing) {
      // Update existing settings
      const [updated] = await db.update(adminSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(adminSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db.insert(adminSettings)
        .values(settings)
        .returning();
      return created;
    }
  }

  // Manager management functions
  async getAllManagers(): Promise<Manager[]> {
    return await db.select().from(managers).orderBy(managers.createdAt);
  }

  async getManagerById(id: number): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.id, id));
    return manager || undefined;
  }

  async updateManager(id: number, manager: Partial<InsertManager>): Promise<Manager | undefined> {
    const [updated] = await db.update(managers)
      .set(manager)
      .where(eq(managers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteManager(id: number): Promise<void> {
    await db.delete(managers).where(eq(managers.id, id));
  }
}

export const storage = new DatabaseStorage();