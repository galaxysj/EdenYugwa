import { orders, smsNotifications, admins, managers, settings, adminSettings, customers, users, dashboardContent, productPrices, type Order, type InsertOrder, type SmsNotification, type InsertSmsNotification, type Admin, type InsertAdmin, type Manager, type InsertManager, type Setting, type InsertSetting, type AdminSettings, type InsertAdminSettings, type Customer, type InsertCustomer, type User, type InsertUser, type DashboardContent, type InsertDashboardContent, type ProductPrice, type InsertProductPrice } from "@shared/schema";
import { db, isSQLite } from "./db";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";

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
  updateOrderDeliveredDate(id: number, deliveredDate: Date | null): Promise<Order | undefined>;
  updateOrderSellerShipped(id: number, sellerShipped: boolean, sellerShippedDate: Date | null): Promise<Order | undefined>;
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
  
  // Customer management
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomerById(id: number): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;
  updateCustomerStats(customerPhone: string): Promise<void>;
  autoRegisterCustomer(customerData: {name: string, phone: string, address?: string, zipCode?: string}): Promise<Customer | null>;
  bulkCreateCustomers(customers: InsertCustomer[]): Promise<Customer[]>;
  
  // User management
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;
  
  // Dashboard content management
  getDashboardContent(key: string): Promise<DashboardContent | undefined>;
  setDashboardContent(key: string, value: string, type?: string): Promise<DashboardContent>;
  getAllDashboardContent(): Promise<DashboardContent[]>;
  updateDashboardContent(key: string, value: string): Promise<DashboardContent | undefined>;
  
  // Product prices management
  getProductPrice(productIndex: number): Promise<ProductPrice | undefined>;
  setProductPrice(productPrice: InsertProductPrice): Promise<ProductPrice>;
  getAllProductPrices(): Promise<ProductPrice[]>;
  updateProductPrice(productIndex: number, price: number, cost: number): Promise<ProductPrice | undefined>;
  deleteProductPrice(productIndex: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private orderCounter: number = 1;

  constructor() {
    this.initializeOrderCounter();
    this.ensureDefaultAdmin();
    this.ensureDefaultManager();
    this.ensureDefaultSettings();
  }

  private async ensureDefaultSettings() {
    try {
      const defaultSettings = [
        { key: 'smallBoxCost', value: '15000', description: '한과1호 원가 (개당)' },
        { key: 'largeBoxCost', value: '17000', description: '한과2호 원가 (개당)' },
        { key: 'wrappingCost', value: '500', description: '보자기 포장 원가 (개당)' },
        { key: 'shippingFee', value: '4000', description: '배송비 (6개 미만 주문 시)' },
        { key: 'freeShippingThreshold', value: '6', description: '무료배송 최소 수량' },
      ];

      for (const setting of defaultSettings) {
        const existing = await this.getSetting(setting.key);
        if (!existing) {
          await this.setSetting(setting.key, setting.value, setting.description);
        }
      }
    } catch (error) {
      console.error('Failed to create default settings:', error);
    }
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
    if (isSQLite) {
      return;
    }
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
    if (isSQLite) {
      return;
    }
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
    // Get current date in YYMMDD format (2-digit year)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    let sequenceNumber = 1;
    let orderNumber = '';
    let isUnique = false;
    
    // Keep trying until we find a unique order number
    while (!isUnique) {
      orderNumber = `${dateStr}-${sequenceNumber}`;
      
      // Check if this order number already exists
      const existingOrder = await db.select()
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1);
      
      if (existingOrder.length === 0) {
        isUnique = true;
      } else {
        sequenceNumber++;
      }
    }
    
    return orderNumber;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = await this.generateOrderNumber();
    const orderData: any = {
      customerName: insertOrder.customerName,
      customerPhone: insertOrder.customerPhone,
      zipCode: insertOrder.zipCode,
      address1: insertOrder.address1,
      address2: insertOrder.address2,
      // 받는 분 정보
      recipientName: insertOrder.recipientName,
      recipientPhone: insertOrder.recipientPhone,
      recipientZipCode: insertOrder.recipientZipCode,
      recipientAddress1: insertOrder.recipientAddress1,
      recipientAddress2: insertOrder.recipientAddress2,
      // 예금자 정보
      isDifferentDepositor: insertOrder.isDifferentDepositor || false,
      depositorName: insertOrder.depositorName,
      smallBoxQuantity: insertOrder.smallBoxQuantity,
      largeBoxQuantity: insertOrder.largeBoxQuantity,
      wrappingQuantity: insertOrder.wrappingQuantity,
      dynamicProductQuantities: insertOrder.dynamicProductQuantities,
      totalAmount: insertOrder.totalAmount,
      specialRequests: insertOrder.specialRequests,
      scheduledDate: insertOrder.scheduledDate,
      shippingFee: insertOrder.shippingFee || 0,
      orderNumber,
      status: "pending", // 예약날짜와 상관없이 항상 pending으로 시작
      paymentStatus: "pending",
      // 인증 관련 필드
      userId: insertOrder.userId,
      orderPassword: insertOrder.orderPassword,
    };
    
    if (isSQLite) {
      orderData.createdAt = new Date();
    }
    
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
      .orderBy(desc(orders.createdAt)); // 기본적으로 생성일 역순으로 정렬
    
    // Get global cost settings
    const smallBoxCostSetting = await this.getSetting("smallBoxCost");
    const largeBoxCostSetting = await this.getSetting("largeBoxCost");
    
    const globalSmallBoxCost = smallBoxCostSetting ? parseInt(smallBoxCostSetting.value) : 0;
    const globalLargeBoxCost = largeBoxCostSetting ? parseInt(largeBoxCostSetting.value) : 0;
    
    // Apply global costs and calculate profits for orders that don't have custom costs
    const ordersWithCalculations = allOrders.map(order => {
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

    // 복합 정렬: 1) 주문상태 우선 (접수>예약>완료), 2) 각 상태 내에서 날짜 순, 3) 주문번호 순
    return ordersWithCalculations.sort((a, b) => {
      // 1. 주문상태별 우선순위 설정 (pending > scheduled > delivered)
      const statusPriority = { 'pending': 1, 'scheduled': 2, 'delivered': 3 };
      const aStatusPriority = statusPriority[a.status as keyof typeof statusPriority] || 999;
      const bStatusPriority = statusPriority[b.status as keyof typeof statusPriority] || 999;
      
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }
      
      // 2. 같은 상태 내에서의 세부 정렬
      if (a.status === 'pending' || a.status === 'scheduled') {
        // 예약발송일이 있는 경우 예약발송일 기준으로 정렬 (빠른 날짜 우선)
        if (a.scheduledDate && b.scheduledDate) {
          const aScheduledTime = new Date(a.scheduledDate).getTime();
          const bScheduledTime = new Date(b.scheduledDate).getTime();
          if (aScheduledTime !== bScheduledTime) {
            return aScheduledTime - bScheduledTime;
          }
        }
        
        // 예약발송일이 있는 주문을 우선 배치
        if (a.scheduledDate && !b.scheduledDate) return -1;
        if (!a.scheduledDate && b.scheduledDate) return 1;
      }
      
      if (a.status === 'delivered') {
        // 발송완료 상태에서는 발송완료일 기준으로 정렬 (빠른 날짜 우선)
        if (a.deliveredDate && b.deliveredDate) {
          const aDeliveredTime = new Date(a.deliveredDate).getTime();
          const bDeliveredTime = new Date(b.deliveredDate).getTime();
          if (aDeliveredTime !== bDeliveredTime) {
            return aDeliveredTime - bDeliveredTime;
          }
        }
        
        // 발송완료일이 있는 주문을 우선 배치
        if (a.deliveredDate && !b.deliveredDate) return -1;
        if (!a.deliveredDate && b.deliveredDate) return 1;
      }
      
      // 3. 마지막으로 주문번호 기준으로 정렬 (빠른 번호가 아래로)
      const aOrderNum = parseInt(a.orderNumber.split('-')[1] || '0');
      const bOrderNum = parseInt(b.orderNumber.split('-')[1] || '0');
      return bOrderNum - aOrderNum; // 큰 번호가 위로 (최신이 위로)
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

  async getOrdersByUserId(userId: number): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.isDeleted, false)))
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
    
    // 상태별 필드 초기화 및 설정
    if (status === 'pending') {
      // 주문접수 상태로 변경 시 모든 발송 관련 필드 초기화
      updateData.sellerShipped = false;
      updateData.sellerShippedDate = null;
      updateData.scheduledDate = null;
      updateData.deliveredDate = null;
    } else if (status === 'scheduled') {
      // 발송주문 상태로 변경 시 예약발송일 설정 (발송완료 관련 필드는 초기화)
      updateData.deliveredDate = null;
      updateData.sellerShipped = false;
      updateData.sellerShippedDate = null;
    } else if (status === 'delivered') {
      // 발송완료 상태로 변경하는 경우 현재 날짜를 설정
      updateData.deliveredDate = new Date();
    }
    
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async updateOrderPaymentStatus(id: number, paymentStatus: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ paymentStatus })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  // PaymentDetailsDialog에서 직접 전달받은 할인액을 사용하는 메서드
  async updatePaymentWithDiscount(id: number, paymentStatus: string, actualPaidAmount?: number, discountAmount?: number): Promise<Order | undefined> {
    console.log(`결제 정보 업데이트: ID=${id}, 상태=${paymentStatus}, 실입금=${actualPaidAmount}, 할인=${discountAmount}`);
    
    const updateData: any = { 
      paymentStatus,
      paymentConfirmedAt: paymentStatus === 'confirmed' ? new Date() : null
    };

    if (actualPaidAmount !== undefined) {
      updateData.actualPaidAmount = actualPaidAmount;
      console.log(`실입금액 설정: ${actualPaidAmount}`);
    }

    if (discountAmount !== undefined) {
      updateData.discountAmount = discountAmount;
      console.log(`할인금액 설정: ${discountAmount}`);
    }

    // 입금대기 상태로 변경시 discountReason도 초기화
    if (paymentStatus === 'pending') {
      updateData.discountReason = null;
      console.log('입금대기로 변경: discountReason도 null로 초기화');
    }

    console.log('DB 업데이트 데이터:', updateData);

    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    
    console.log('업데이트 완료. 결과:', order ? `ID=${order.id}, 실입금=${order.actualPaidAmount}, 할인=${order.discountAmount}` : '주문 없음');
    
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

  async updateOrderSellerShippedDate(id: number, sellerShippedDate: Date | null): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ sellerShippedDate })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  async updateOrderSellerShipped(id: number, sellerShipped: boolean, sellerShippedDate: Date | null): Promise<Order | undefined> {
    try {
      const updateData: any = { 
        sellerShipped,
        sellerShippedDate: sellerShipped ? sellerShippedDate : null
      };
      
      // If seller shipped is true, also update status to delivered and set delivered date
      if (sellerShipped) {
        updateData.status = 'delivered';
        updateData.deliveredDate = sellerShippedDate;
      }
      
      console.log(`Updating order ${id} with data:`, updateData);
      
      const [order] = await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, id))
        .returning();
        
      console.log(`Update result for order ${id}:`, order ? 'success' : 'not found');
      return order || undefined;
    } catch (error) {
      console.error(`Error updating order ${id}:`, error);
      throw error;
    }
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
    const values = isSQLite 
      ? { ...insertAdmin, createdAt: new Date() }
      : insertAdmin;
    const [admin] = await db
      .insert(admins)
      .values(values as any)
      .returning();
    return admin;
  }

  // Manager authentication
  async getManagerByUsername(username: string): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.username, username));
    return manager || undefined;
  }

  async createManager(insertManager: InsertManager): Promise<Manager> {
    const values = isSQLite 
      ? { ...insertManager, createdAt: new Date() }
      : insertManager;
    const [manager] = await db
      .insert(managers)
      .values(values as any)
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



  // Customer management functions
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const values: any = { ...customer };
    if (isSQLite) {
      values.createdAt = new Date();
      values.updatedAt = new Date();
    }
    const [newCustomer] = await db.insert(customers).values(values).returning();
    return newCustomer;
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.customerPhone, phone));
    return customer || undefined;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers)
      .where(eq(customers.isDeleted, false))
      .orderBy(desc(customers.createdAt));
  }

  async getTrashedCustomers(): Promise<Customer[]> {
    return await db.select().from(customers)
      .where(eq(customers.isDeleted, true))
      .orderBy(desc(customers.deletedAt));
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    // 업데이트 전에 기존 고객 정보 조회
    const existingCustomer = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    const oldPhone = existingCustomer[0]?.customerPhone;
    
    const [updated] = await db.update(customers)
      .set({
        ...customer,
        updatedAt: new Date()
      })
      .where(eq(customers.id, id))
      .returning();
    
    // 연락처가 변경된 경우에만 주문 테이블의 연락처 업데이트 (주소는 각 주문의 원본 유지)
    if (updated && oldPhone && customer.customerPhone && customer.customerPhone !== oldPhone) {
      await db.update(orders)
        .set({ customerPhone: customer.customerPhone })
        .where(eq(orders.customerPhone, oldPhone));
    }
    
    return updated || undefined;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.update(customers)
      .set({ 
        isDeleted: true, 
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(customers.id, id));
  }

  async restoreCustomer(id: number): Promise<void> {
    await db.update(customers)
      .set({ 
        isDeleted: false, 
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(customers.id, id));
  }

  async permanentlyDeleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async bulkDeleteCustomers(ids: number[]): Promise<void> {
    await db.update(customers)
      .set({ 
        isDeleted: true, 
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(inArray(customers.id, ids));
  }

  async bulkRestoreCustomers(ids: number[]): Promise<void> {
    await db.update(customers)
      .set({ 
        isDeleted: false, 
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(inArray(customers.id, ids));
  }

  async bulkPermanentlyDeleteCustomers(ids: number[]): Promise<void> {
    await db.delete(customers).where(inArray(customers.id, ids));
  }

  async updateCustomerStats(phoneNumber: string): Promise<void> {
    console.log(`고객 통계 업데이트 시작: ${phoneNumber}`);
    
    // Get all orders for this customer (excluding deleted ones)
    const customerOrders = await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.customerPhone, phoneNumber),
          eq(orders.isDeleted, false) // 삭제된 주문만 제외
        )
      )
      .orderBy(desc(orders.createdAt));

    console.log(`${phoneNumber} 고객의 실제 주문 개수: ${customerOrders.length}`);

    // Get existing customer record
    const existingCustomer = await this.getCustomerByPhone(phoneNumber);
    
    if (customerOrders.length === 0) {
      // No orders found, set count to 0
      if (existingCustomer) {
        await db.update(customers)
          .set({
            orderCount: 0,
            totalSpent: 0,
            lastOrderDate: null,
            updatedAt: new Date()
          })
          .where(eq(customers.id, existingCustomer.id));
        console.log(`${phoneNumber} 고객 통계를 0으로 초기화`);
      }
      return;
    }

    // Calculate statistics for all non-deleted orders
    const orderCount = customerOrders.length;
    
    // Calculate total spent (confirmed payments only)
    const totalSpent = customerOrders
      .filter(order => order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial')
      .reduce((sum, order) => sum + (order.actualPaidAmount || order.totalAmount), 0);
    
    const lastOrderDate = customerOrders[0].createdAt; // First in descending order

    console.log(`${phoneNumber} 새로운 통계: 주문횟수=${orderCount}, 총구매금액=${totalSpent}, 마지막주문일=${lastOrderDate}`);
    
    if (existingCustomer) {
      // Update existing customer
      await db.update(customers)
        .set({
          orderCount,
          totalSpent,
          lastOrderDate,
          updatedAt: new Date()
        })
        .where(eq(customers.id, existingCustomer.id));
      console.log(`${phoneNumber} 고객 통계 업데이트 완료`);
    } else {
      // Create new customer record from first order
      const firstOrder = customerOrders[customerOrders.length - 1]; // Last in descending order = first chronologically
      const newCustomerData: any = {
        customerName: firstOrder.customerName,
        customerPhone: phoneNumber,
        zipCode: firstOrder.zipCode,
        address1: firstOrder.address1,
        address2: firstOrder.address2,
        orderCount,
        totalSpent,
        lastOrderDate,
        notes: null
      };
      if (isSQLite) {
        newCustomerData.createdAt = new Date();
        newCustomerData.updatedAt = new Date();
      }
      await db.insert(customers).values(newCustomerData);
      console.log(`${phoneNumber} 새로운 고객 생성 완료`);
    }
  }

  async autoRegisterCustomer(customerData: {
    name: string, 
    phone: string, 
    address?: string, 
    zipCode?: string,
    userId?: number,
    userRegisteredName?: string,
    userRegisteredPhone?: string
  }): Promise<Customer | null> {
    try {
      // Check if customer already exists
      const existingCustomer = await this.getCustomerByPhone(customerData.phone);
      if (existingCustomer) {
        // Update customer with user info if provided and not already linked
        const updateData: any = {};
        
        if (customerData.address && customerData.address !== existingCustomer.address1) {
          updateData.address1 = customerData.address;
          updateData.zipCode = customerData.zipCode;
        }
        
        // Link user info if provided and not already linked
        if (customerData.userId && !existingCustomer.userId) {
          updateData.userId = customerData.userId;
          updateData.userRegisteredName = customerData.userRegisteredName;
          updateData.userRegisteredPhone = customerData.userRegisteredPhone;
        }
        
        if (Object.keys(updateData).length > 0) {
          await this.updateCustomer(existingCustomer.id, updateData);
        }
        
        return existingCustomer;
      }

      // Create new customer with user link if provided
      const customerValues: any = {
        customerName: customerData.name,
        customerPhone: customerData.phone,
        address1: customerData.address || '',
        address2: '',
        zipCode: customerData.zipCode,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: null,
        notes: null,
        userId: customerData.userId || null,
        userRegisteredName: customerData.userRegisteredName || null,
        userRegisteredPhone: customerData.userRegisteredPhone || null
      };
      if (isSQLite) {
        customerValues.createdAt = new Date();
        customerValues.updatedAt = new Date();
      }
      const [newCustomer] = await db.insert(customers).values(customerValues).returning();

      return newCustomer;
    } catch (error) {
      console.error('Auto register customer error:', error);
      return null;
    }
  }

  async bulkCreateCustomers(customersData: InsertCustomer[]): Promise<Customer[]> {
    try {
      const values = isSQLite 
        ? customersData.map(c => ({ ...c, createdAt: new Date(), updatedAt: new Date() }))
        : customersData;
      const result = await db.insert(customers).values(values as any).returning();
      return result;
    } catch (error) {
      console.error('Bulk create customers error:', error);
      throw error;
    }
  }

  async getCustomerAddresses(phoneNumber: string): Promise<{address: string, orderCount: number}[]> {
    const customerOrders = await db.select({
      address1: orders.address1,
      address2: orders.address2,
      zipCode: orders.zipCode
    })
    .from(orders)
    .where(eq(orders.customerPhone, phoneNumber));

    // Group addresses and count orders
    const addressMap = new Map<string, number>();
    
    customerOrders.forEach(order => {
      const fullAddress = [order.zipCode, order.address1, order.address2]
        .filter(Boolean)
        .join(' ');
      
      if (fullAddress) {
        addressMap.set(fullAddress, (addressMap.get(fullAddress) || 0) + 1);
      }
    });

    return Array.from(addressMap.entries()).map(([address, count]) => ({
      address,
      orderCount: count
    })).sort((a, b) => b.orderCount - a.orderCount);
  }

  // User management methods
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(userData: InsertUser): Promise<User> {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const [user] = await db.insert(users).values({
      username: userData.username,
      passwordHash: hashedPassword,
      name: userData.name,
      phoneNumber: userData.phoneNumber,
      role: userData.role || 'user',
      isActive: userData.isActive ?? true
    }).returning();
    
    return user;
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Dashboard content management
  async getDashboardContent(key: string): Promise<DashboardContent | undefined> {
    const [content] = await db.select().from(dashboardContent).where(eq(dashboardContent.key, key));
    return content || undefined;
  }

  async setDashboardContent(key: string, value: string, type: string = 'text'): Promise<DashboardContent> {
    const existing = await this.getDashboardContent(key);
    
    if (existing) {
      const [updated] = await db
        .update(dashboardContent)
        .set({ 
          value,
          type,
          updatedAt: new Date()  
        })
        .where(eq(dashboardContent.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(dashboardContent)
        .values({ key, value, type })
        .returning();
      return created;
    }
  }

  async getAllDashboardContent(): Promise<DashboardContent[]> {
    return await db.select().from(dashboardContent);
  }

  async updateDashboardContent(key: string, value: string): Promise<DashboardContent | undefined> {
    const [updated] = await db
      .update(dashboardContent)
      .set({ 
        value,
        updatedAt: new Date()  
      })
      .where(eq(dashboardContent.key, key))
      .returning();
    return updated || undefined;
  }

  // Product prices management implementation
  async getProductPrice(productIndex: number): Promise<ProductPrice | undefined> {
    const productPrice = await db.select().from(productPrices)
      .where(eq(productPrices.productIndex, productIndex))
      .limit(1);
    return productPrice[0];
  }

  async setProductPrice(productPrice: InsertProductPrice): Promise<ProductPrice> {
    // Check if product price already exists
    const existingPrice = await db.select().from(productPrices)
      .where(eq(productPrices.productIndex, productPrice.productIndex))
      .limit(1);

    if (existingPrice.length > 0) {
      // Update existing product price
      const [updated] = await db.update(productPrices)
        .set({
          productName: productPrice.productName,
          price: productPrice.price,
          cost: productPrice.cost,
          isActive: productPrice.isActive,
          updatedAt: new Date()
        })
        .where(eq(productPrices.productIndex, productPrice.productIndex))
        .returning();
      return updated;
    } else {
      // Create new product price
      const [created] = await db.insert(productPrices)
        .values(productPrice)
        .returning();
      return created;
    }
  }

  async getAllProductPrices(): Promise<ProductPrice[]> {
    return await db.select().from(productPrices)
      .where(eq(productPrices.isActive, true))
      .orderBy(productPrices.productIndex);
  }

  async updateProductPrice(productIndex: number, price: number, cost: number): Promise<ProductPrice | undefined> {
    const [updated] = await db.update(productPrices)
      .set({ price, cost, updatedAt: new Date() })
      .where(eq(productPrices.productIndex, productIndex))
      .returning();
    return updated;
  }

  async deleteProductPrice(productIndex: number): Promise<void> {
    await db.update(productPrices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(productPrices.productIndex, productIndex));
  }
}

export const storage = new DatabaseStorage();