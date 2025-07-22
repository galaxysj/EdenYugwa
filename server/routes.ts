import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertSmsNotificationSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all orders (for admin)
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get single order
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Create new order
  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create order" });
      }
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Update payment status
  app.patch("/api/orders/:id/payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paymentStatus } = req.body;
      
      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }
      
      const updatedOrder = await storage.updatePaymentStatus(id, paymentStatus);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  // Send SMS notification
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { orderId, phoneNumber, message } = req.body;
      
      if (!orderId || !phoneNumber || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create SMS notification record
      const notification = await storage.createSmsNotification({
        orderId,
        phoneNumber,
        message,
      });
      
      // TODO: Integrate with actual SMS service (Twilio, AWS SNS, etc.)
      console.log(`SMS sent to ${phoneNumber}: ${message}`);
      
      res.json({ 
        success: true, 
        message: "SMS sent successfully",
        notification 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  // Get SMS notifications for an order
  app.get("/api/orders/:id/sms", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const notifications = await storage.getSmsNotificationsByOrderId(orderId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS notifications" });
    }
  });

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "아이디와 비밀번호를 모두 입력해주세요" });
      }
      
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin || admin.password !== password) {
        return res.status(401).json({ message: "아이디나 비밀번호가 틀렸습니다" });
      }
      
      // In a real app, you would use proper session management or JWT
      res.json({ 
        success: true, 
        message: "로그인 성공",
        admin: {
          id: admin.id,
          username: admin.username
        }
      });
    } catch (error) {
      res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
    }
  });

  // Check admin authentication status
  app.get("/api/admin/check", async (req, res) => {
    // Simple check - in a real app you would validate JWT or session
    res.json({ authenticated: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
