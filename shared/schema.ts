import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
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
  specialRequests: text("special_requests"),
  smallBoxQuantity: integer("small_box_quantity").notNull().default(0), // 소박스(한과1호) 수량
  largeBoxQuantity: integer("large_box_quantity").notNull().default(0), // 대박스(한과2호) 수량
  wrappingQuantity: integer("wrapping_quantity").notNull().default(0), // 보자기 포장 수량
  shippingFee: integer("shipping_fee").notNull().default(0), // 배송비
  totalAmount: integer("total_amount").notNull(),
  actualPaidAmount: integer("actual_paid_amount").default(0), // 실제 입금된 금액
  discountAmount: integer("discount_amount").default(0), // 할인 금액
  discountReason: text("discount_reason"), // 할인 사유
  status: text("status").notNull().default("pending"), // 'pending', 'preparing', 'scheduled', 'shipping', 'delivered'
  scheduledDate: timestamp("scheduled_date"),
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending', 'confirmed', 'refunded'
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
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
    z.string(), 
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
