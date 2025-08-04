import { pgTable, text, serial, integer, timestamp, boolean, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  zipCode: text("zip_code"),
  address1: text("address1").notNull(),
  address2: text("address2"),
  // 받는 분 정보
  recipientName: text("recipient_name"), // 받는 분 이름
  recipientPhone: text("recipient_phone"), // 받는 분 연락처
  recipientZipCode: text("recipient_zip_code"), // 받는 분 우편번호
  recipientAddress1: text("recipient_address1"), // 받는 분 주소1
  recipientAddress2: text("recipient_address2"), // 받는 분 주소2
  // 입금자 정보
  depositorName: text("depositor_name"), // 입금자 이름 (주문자와 다를 경우)
  isDifferentDepositor: boolean("is_different_depositor").notNull().default(false), // 입금자가 주문자와 다른지 여부
  specialRequests: text("special_requests"),
  smallBoxQuantity: integer("small_box_quantity").notNull().default(0), // 소박스(한과1호) 수량
  largeBoxQuantity: integer("large_box_quantity").notNull().default(0), // 대박스(한과2호) 수량
  wrappingQuantity: integer("wrapping_quantity").notNull().default(0), // 보자기 포장 수량
  shippingFee: integer("shipping_fee").notNull().default(0), // 배송비
  totalAmount: integer("total_amount").notNull(),
  actualPaidAmount: integer("actual_paid_amount").default(0), // 실제 입금된 금액
  discountAmount: integer("discount_amount").default(0), // 할인 금액
  discountReason: text("discount_reason"), // 할인 사유
  // 원가 정보
  smallBoxCost: integer("small_box_cost").default(0), // 한과1호 원가 (개당)
  largeBoxCost: integer("large_box_cost").default(0), // 한과2호 원가 (개당)
  totalCost: integer("total_cost").default(0), // 총 원가
  netProfit: integer("net_profit").default(0), // 실제 수익 (실입금 - 원가 - 배송비)
  status: text("status").notNull().default("pending"), // 'pending', 'preparing', 'scheduled', 'shipping', 'delivered'
  scheduledDate: timestamp("scheduled_date"),
  deliveredDate: timestamp("delivered_date"), // 발송완료 날짜
  sellerShipped: boolean("seller_shipped").default(false),
  sellerShippedDate: timestamp("seller_shipped_date"),
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending', 'confirmed', 'refunded'
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  paymentConfirmedAt: true,
  createdAt: true,
}).extend({
  scheduledDate: z.union([
    z.date(), 
    z.string().transform((str) => new Date(str)), 
    z.null()
  ]).optional().nullable(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// SMS notification schema
export const smsNotifications = pgTable("sms_notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertSmsNotificationSchema = createInsertSchema(smsNotifications).omit({
  id: true,
  sentAt: true,
});

export type InsertSmsNotification = z.infer<typeof insertSmsNotificationSchema>;
export type SmsNotification = typeof smsNotifications.$inferSelect;

// User authentication schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: text("role").notNull().default("user"), // 'admin', 'manager', 'user'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  lastLoginAt: true,
}).extend({
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Session storage table for express-session
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Admin authentication schema
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

// Manager authentication schema
export const managers = pgTable("managers", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertManagerSchema = createInsertSchema(managers).omit({
  id: true,
  createdAt: true,
});

export type InsertManager = z.infer<typeof insertManagerSchema>;
export type Manager = typeof managers.$inferSelect;

// Settings schema for global configurations
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Admin settings schema for business information
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  adminName: text("admin_name").notNull(),
  adminPhone: text("admin_phone").notNull(),
  businessName: text("business_name").notNull(),
  businessAddress: text("business_address"),
  businessPhone: text("business_phone"),
  bankAccount: text("bank_account"), // 계좌번호 정보
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;

// Customers schema for customer management
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull().unique(),
  zipCode: text("zip_code"),
  address1: text("address1"),
  address2: text("address2"),
  orderCount: integer("order_count").notNull().default(0), // 주문횟수
  totalSpent: integer("total_spent").notNull().default(0), // 총 주문금액
  lastOrderDate: timestamp("last_order_date"), // 마지막 주문일
  notes: text("notes"), // 메모
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  orderCount: true,
  totalSpent: true,
  lastOrderDate: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
