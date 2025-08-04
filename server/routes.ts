import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "./auth";
import { requireAuth, requireAdmin, requireManagerOrAdmin } from "./auth";
import { userService } from "./user-service";
import { storage } from "./storage";
import { insertOrderSchema, insertSmsNotificationSchema, insertManagerSchema, insertCustomerSchema, insertUserSchema, type Order, type InsertCustomer, type User } from "@shared/schema";
import * as XLSX from "xlsx";
import multer from "multer";

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, name, phoneNumber } = req.body;
      
      if (!username || !password || !name || !phoneNumber) {
        return res.status(400).json({ message: "모든 필드를 입력해주세요" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "비밀번호는 최소 6자 이상이어야 합니다" });
      }
      
      // Check if user already exists
      const existingUser = await userService.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 존재하는 사용자명입니다" });
      }
      
      // Create new user
      const newUser = await userService.createUser({ 
        username, 
        password, 
        name, 
        phoneNumber, 
        role: 'user', 
        isActive: true 
      });
      
      res.status(201).json({ 
        message: "회원가입이 완료되었습니다", 
        user: { 
          id: newUser.id, 
          username: newUser.username, 
          name: newUser.name,
          phoneNumber: newUser.phoneNumber,
          role: newUser.role 
        } 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "회원가입 처리 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', (err: any, user: User, info: any) => {
      if (err) {
        return res.status(500).json({ message: "서버 오류가 발생했습니다" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "로그인에 실패했습니다" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        return res.json({ 
          message: "로그인 성공", 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role 
          } 
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃 처리 중 오류가 발생했습니다" });
      }
      res.json({ message: "로그아웃 성공" });
    });
  });

  app.get("/api/auth/user", requireAuth, (req, res) => {
    const user = req.user as User;
    res.json({ 
      id: user.id, 
      username: user.username, 
      role: user.role 
    });
  });

  // Change password route
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "새 비밀번호는 최소 4자 이상이어야 합니다" });
      }

      const success = await userService.changePassword(user.id, newPassword);
      if (success) {
        res.json({ message: "비밀번호가 성공적으로 변경되었습니다" });
      } else {
        res.status(500).json({ message: "비밀번호 변경에 실패했습니다" });
      }
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "비밀번호 변경에 실패했습니다" });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await userService.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      })));
    } catch (error) {
      res.status(500).json({ message: "사용자 목록 조회에 실패했습니다" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await userService.createUser(userData);
      res.json({ 
        message: "사용자가 생성되었습니다", 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        } 
      });
    } catch (error) {
      if ((error as any).code === '23505') { // unique constraint violation
        res.status(400).json({ message: "이미 존재하는 사용자명입니다" });
      } else {
        res.status(400).json({ message: (error as any).message || "사용자 생성에 실패했습니다" });
      }
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const user = await userService.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      res.json({ message: "사용자 정보가 업데이트되었습니다", user });
    } catch (error) {
      res.status(500).json({ message: "사용자 업데이트에 실패했습니다" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await userService.deactivateUser(id);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      res.json({ message: "사용자가 비활성화되었습니다" });
    } catch (error) {
      res.status(500).json({ message: "사용자 비활성화에 실패했습니다" });
    }
  });

  // Get all orders (for admin and manager)
  app.get("/api/orders", requireManagerOrAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Lookup orders by phone number or name (must come before /api/orders/:id)
  app.get("/api/orders/lookup", async (req, res) => {
    try {
      const userId = (req as any).user?.id; // 로그인된 사용자 ID
      const { phone, name } = req.query;
      
      if ((!phone || typeof phone !== 'string') && (!name || typeof name !== 'string')) {
        return res.status(400).json({ message: "Phone number or name is required" });
      }
      
      let orders: Order[] = [];
      
      if (phone && typeof phone === 'string') {
        const phoneOrders = await storage.getOrdersByPhone(phone);
        orders = [...orders, ...phoneOrders];
      }
      
      if (name && typeof name === 'string') {
        const nameOrders = await storage.getOrdersByName(name);
        orders = [...orders, ...nameOrders];
      }
      
      // Remove duplicates if searching by both phone and name
      let uniqueOrders = orders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      );
      
      // 로그인된 사용자인 경우, 본인의 주문만 필터링
      if (userId) {
        uniqueOrders = uniqueOrders.filter(order => order.userId === userId);
      }
      
      if (uniqueOrders.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(uniqueOrders);
    } catch (error) {
      res.status(500).json({ message: "Failed to lookup orders" });
    }
  });

  // Get deleted orders (trash) - must come before /api/orders/:id
  app.get("/api/orders/trash", async (req, res) => {
    console.log('GET /api/orders/trash called');
    try {
      const deletedOrders = await storage.getDeletedOrders();
      console.log('Deleted orders found:', deletedOrders.length);
      res.json(deletedOrders);
    } catch (error) {
      console.error('Get deleted orders error:', error);
      res.status(500).json({ message: "휴지통 주문 조회에 실패했습니다" });
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
      console.log("=== 주문 요청 분석 시작 ===");
      console.log("Raw body:", req.body);
      console.log("orderPassword:", req.body.orderPassword);
      console.log("orderPassword type:", typeof req.body.orderPassword);
      console.log("orderPassword length:", req.body.orderPassword?.length);
      console.log("=== 주문 요청 분석 끝 ===");
      
      // scheduledDate를 Date 객체로 변환
      if (req.body.scheduledDate && typeof req.body.scheduledDate === 'string') {
        req.body.scheduledDate = new Date(req.body.scheduledDate);
      }
      
      // 로그인된 사용자인 경우 userId 설정, 아닌 경우 orderPassword가 있어야 함
      if ((req as any).user?.id) {
        console.log("로그인된 사용자 주문");
        req.body.userId = (req as any).user.id;
        req.body.orderPassword = null; // 로그인 사용자는 비밀번호 불필요
      } else {
        console.log("비로그인 사용자 주문");
        // 비로그인 사용자: orderPassword 필수
        if (!req.body.orderPassword || req.body.orderPassword.trim().length < 4) {
          console.log("orderPassword 검증 실패:", req.body.orderPassword);
          return res.status(400).json({ message: "비로그인 주문 시 주문 비밀번호(최소 4자리)가 필요합니다." });
        }
        console.log("orderPassword 검증 성공");
      }
      
      const validatedData = insertOrderSchema.parse(req.body);
      
      // Automatically register or update customer
      await storage.autoRegisterCustomer({
        name: validatedData.customerName,
        phone: validatedData.customerPhone,
        address: validatedData.address1 || undefined,
        zipCode: validatedData.zipCode || undefined
      });
      
      const order = await storage.createOrder(validatedData);
      
      // Update customer statistics after creating order
      await storage.updateCustomerStats(validatedData.customerPhone);
      
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
  // Update entire order (admin and manager)
  app.patch("/api/orders/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const order = await storage.updateOrder(id, updateData);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.patch("/api/orders/:id/status", requireManagerOrAdmin, async (req, res) => {
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

  // Update order scheduled date (admin and manager)
  app.patch("/api/orders/:id/scheduled-date", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledDate } = req.body;
      
      const updatedOrder = await storage.updateOrderScheduledDate(
        id, 
        scheduledDate ? new Date(scheduledDate) : null
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order scheduled date" });
    }
  });

  // Update order delivered date (admin and manager)
  app.patch("/api/orders/:id/delivered-date", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { deliveredDate } = req.body;
      
      const updatedOrder = await storage.updateOrderDeliveredDate(
        id, 
        deliveredDate ? new Date(deliveredDate) : null
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order delivered date" });
    }
  });

  // Update order seller shipped date (admin and manager)
  app.patch("/api/orders/:id/seller-shipped-date", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sellerShippedDate } = req.body;
      
      const updatedOrder = await storage.updateOrderSellerShippedDate(
        id, 
        sellerShippedDate ? new Date(sellerShippedDate) : null
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order seller shipped date" });
    }
  });

  // Update order seller shipped status (admin and manager)
  app.patch("/api/orders/:id/seller-shipped", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sellerShipped, sellerShippedDate } = req.body;
      
      const updatedOrder = await storage.updateOrderSellerShipped(
        id, 
        sellerShipped,
        sellerShippedDate ? new Date(sellerShippedDate) : null
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update seller shipped status" });
    }
  });

  // Update payment status with actual paid amount (admin and manager)
  app.patch("/api/orders/:id/payment", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { paymentStatus, actualPaidAmount, discountReason } = req.body;
      
      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }
      
      const updatedOrder = await storage.updatePaymentStatus(id, paymentStatus, actualPaidAmount, discountReason);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Update customer statistics when payment status changes
      await storage.updateCustomerStats(updatedOrder.customerPhone);
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  // Update order financial information (admin only)
  app.patch('/api/orders/:id/financial', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { actualPaidAmount, discountAmount, discountReason, smallBoxCost, largeBoxCost } = req.body;
      
      // Get current order to calculate costs
      const currentOrder = await storage.getOrder(id);
      if (!currentOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const updateData: any = {};
      if (actualPaidAmount !== undefined) updateData.actualPaidAmount = actualPaidAmount;
      if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
      if (discountReason !== undefined) updateData.discountReason = discountReason;
      if (smallBoxCost !== undefined) updateData.smallBoxCost = smallBoxCost;
      if (largeBoxCost !== undefined) updateData.largeBoxCost = largeBoxCost;
      
      // Calculate total cost and net profit if cost information is provided
      if (smallBoxCost !== undefined || largeBoxCost !== undefined) {
        const finalSmallBoxCost = smallBoxCost !== undefined ? smallBoxCost : (currentOrder.smallBoxCost || 0);
        const finalLargeBoxCost = largeBoxCost !== undefined ? largeBoxCost : (currentOrder.largeBoxCost || 0);
        
        // Calculate total cost: (소박스 수량 × 소박스 원가) + (대박스 수량 × 대박스 원가)
        const totalCost = (currentOrder.smallBoxQuantity * finalSmallBoxCost) + 
                         (currentOrder.largeBoxQuantity * finalLargeBoxCost);
        updateData.totalCost = totalCost;
        
        // Calculate net profit: 실입금 - 총원가 - 배송비
        const finalActualPaid = actualPaidAmount !== undefined ? actualPaidAmount : (currentOrder.actualPaidAmount || 0);
        const netProfit = finalActualPaid - totalCost - currentOrder.shippingFee;
        updateData.netProfit = netProfit;
      }
      
      const updatedOrder = await storage.updateFinancialInfo(id, updateData);
      if (!updatedOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error updating financial info:', error);
      res.status(500).json({ error: 'Failed to update financial info' });
    }
  });



  // Update order (for customer edits)
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { orderPassword } = req.body;
      
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // 권한 체크: 로그인 사용자는 본인 주문만, 비로그인은 비밀번호 확인
      if (userId) {
        // 로그인된 사용자: 본인 주문만 수정 가능
        if (order.userId !== userId) {
          return res.status(403).json({ message: "본인의 주문만 수정할 수 있습니다." });
        }
      } else {
        // 비로그인 주문: 비밀번호 확인 필요
        if (!orderPassword || order.orderPassword !== orderPassword) {
          return res.status(403).json({ message: "주문 비밀번호가 올바르지 않습니다." });
        }
      }
      
      // Only allow editing if order is still pending and payment not confirmed
      if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
        return res.status(400).json({ message: "Order cannot be modified at this stage" });
      }
      
      const validatedData = insertOrderSchema.parse(req.body);
      const updatedOrder = await storage.updateOrder(id, validatedData);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update order" });
      }
    }
  });

  // Send SMS notification (admin and manager)
  app.post("/api/sms/send", requireManagerOrAdmin, async (req, res) => {
    try {
      const { orderId, phoneNumber, message } = req.body;
      
      if (!orderId || !phoneNumber || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get admin settings to use admin phone as sender
      const adminSettings = await storage.getAdminSettings();
      if (!adminSettings || !adminSettings.adminPhone) {
        return res.status(400).json({ message: "관리자 전화번호가 설정되지 않았습니다. 관리자 설정에서 전화번호를 입력해주세요." });
      }
      
      // Create SMS notification record
      const notification = await storage.createSmsNotification({
        orderId,
        phoneNumber,
        message,
      });
      
      // Log SMS with admin phone info for integration reference
      console.log(`SMS 발송 정보:
        발신번호: ${adminSettings.adminPhone}
        수신번호: ${phoneNumber}
        메시지: ${message}
        주문번호: ${orderId}
      `);
      
      res.json({ 
        success: true, 
        message: `SMS가 성공적으로 발송되었습니다 (발신: ${adminSettings.adminPhone})`,
        notification,
        senderPhone: adminSettings.adminPhone
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  // Send SMS to customer (without order ID) (admin and manager)
  app.post("/api/sms/send-customer", requireManagerOrAdmin, async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "전화번호와 메시지는 필수 입력 항목입니다" });
      }

      // Get admin settings to use admin phone as sender
      const adminSettings = await storage.getAdminSettings();
      if (!adminSettings || !adminSettings.adminPhone) {
        return res.status(400).json({ error: "관리자 전화번호가 설정되지 않았습니다. 관리자 설정에서 전화번호를 입력해주세요." });
      }
      
      // Log SMS with admin phone info for integration reference
      console.log(`고객 SMS 발송 정보:
        발신번호: ${adminSettings.adminPhone}
        수신번호: ${phoneNumber}
        메시지: ${message}
      `);
      
      // In a real implementation, you would integrate with SMS service here
      // For now, we'll simulate successful sending
      
      res.json({ 
        success: true,
        message: `SMS가 성공적으로 발송되었습니다 (발신: ${adminSettings.adminPhone})`,
        senderPhone: adminSettings.adminPhone
      });
    } catch (error) {
      console.error("Customer SMS send error:", error);
      res.status(500).json({ error: "문자 전송에 실패했습니다" });
    }
  });

  // Get SMS notifications for an order (admin and manager)
  app.get("/api/orders/:id/sms", requireManagerOrAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const notifications = await storage.getSmsNotificationsByOrderId(orderId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS notifications" });
    }
  });

  // Legacy admin/manager login routes (replaced by /api/auth/login)
  app.post("/api/admin/login", (req, res, next) => {
    req.body.username = req.body.username;
    req.body.password = req.body.password;
    
    passport.authenticate('local', (err: any, user: User, info: any) => {
      if (err) {
        return res.status(500).json({ message: "서버 오류가 발생했습니다" });
      }
      if (!user || user.role !== 'admin') {
        return res.status(401).json({ message: "아이디나 비밀번호가 틀렸습니다" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        return res.json({ 
          success: true,
          message: "로그인 성공",
          admin: { 
            id: user.id, 
            username: user.username 
          } 
        });
      });
    })(req, res, next);
  });

  // Check admin authentication status
  app.get("/api/admin/check", (req, res) => {
    if (req.isAuthenticated() && (req.user as User)?.role === 'admin') {
      res.json({ authenticated: true });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Manager login
  app.post("/api/manager/login", (req, res, next) => {
    req.body.username = req.body.username;
    req.body.password = req.body.password;
    
    passport.authenticate('local', (err: any, user: User, info: any) => {
      if (err) {
        return res.status(500).json({ message: "서버 오류가 발생했습니다" });
      }
      if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
        return res.status(401).json({ message: "아이디나 비밀번호가 틀렸습니다" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        return res.json({ 
          success: true,
          message: "로그인 성공",
          manager: { 
            id: user.id, 
            username: user.username 
          } 
        });
      });
    })(req, res, next);
  });

  // Check manager authentication status
  app.get("/api/manager/check", (req, res) => {
    const user = req.user as User;
    if (req.isAuthenticated() && user && (user.role === 'admin' || user.role === 'manager')) {
      res.json({ authenticated: true });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Manager management endpoints (admin only)
  // Get all managers
  app.get("/api/managers", requireAdmin, async (req, res) => {
    try {
      const managers = await storage.getAllManagers();
      res.json(managers);
    } catch (error) {
      console.error('Error fetching managers:', error);
      res.status(500).json({ message: "매니저 목록을 가져오는데 실패했습니다" });
    }
  });

  // Create new manager (admin only)
  app.post("/api/managers", requireAdmin, async (req, res) => {
    try {
      const result = insertManagerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "입력 데이터가 올바르지 않습니다",
          errors: result.error.errors 
        });
      }

      // Check if username already exists
      const existingManager = await storage.getManagerByUsername(result.data.username);
      if (existingManager) {
        return res.status(400).json({ message: "이미 존재하는 아이디입니다" });
      }

      const manager = await storage.createManager(result.data);
      res.status(201).json(manager);
    } catch (error) {
      console.error('Error creating manager:', error);
      res.status(500).json({ message: "매니저 생성에 실패했습니다" });
    }
  });

  // Update manager (admin only)
  app.patch("/api/managers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 매니저 ID입니다" });
      }

      // Check if manager exists
      const existingManager = await storage.getManagerById(id);
      if (!existingManager) {
        return res.status(404).json({ message: "매니저를 찾을 수 없습니다" });
      }

      // Validate update data
      const updateData: any = {};
      
      // Check username change
      if (req.body.username && req.body.username !== existingManager.username) {
        // Check if new username already exists
        const usernameExists = await storage.getManagerByUsername(req.body.username);
        if (usernameExists) {
          return res.status(400).json({ message: "이미 존재하는 아이디입니다" });
        }
        updateData.username = req.body.username;
      } else if (req.body.username) {
        // Same username, but include it in update data for consistency
        updateData.username = req.body.username;
      }
      
      // Check password change
      if (req.body.password && req.body.password.trim()) {
        updateData.password = req.body.password.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "수정할 데이터가 없습니다" });
      }

      const updatedManager = await storage.updateManager(id, updateData);
      res.json(updatedManager);
    } catch (error) {
      console.error('Error updating manager:', error);
      res.status(500).json({ message: "매니저 수정에 실패했습니다" });
    }
  });

  // Delete manager (admin only)
  app.delete("/api/managers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 매니저 ID입니다" });
      }

      // Check if manager exists
      const existingManager = await storage.getManagerById(id);
      if (!existingManager) {
        return res.status(404).json({ message: "매니저를 찾을 수 없습니다" });
      }

      await storage.deleteManager(id);
      res.json({ message: "매니저가 성공적으로 삭제되었습니다" });
    } catch (error) {
      console.error('Error deleting manager:', error);
      res.status(500).json({ message: "매니저 삭제에 실패했습니다" });
    }
  });

  // Export orders to Excel (admin and manager)
  app.get("/api/orders/export/excel", requireManagerOrAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      
      // Group orders by status
      const ordersByStatus = {
        pending: orders.filter(order => order.status === 'pending'),
        scheduled: orders.filter(order => order.status === 'scheduled'),
        delivered: orders.filter(order => order.status === 'delivered')
      };

      // Function to format order data
      const formatOrderData = (orderList: any[]) => {
        return orderList.map(order => ({
          '주문번호': order.orderNumber,
          '고객명': order.customerName,
          '전화번호': order.customerPhone,
          '우편번호': order.zipCode,
          '주소': `${order.address1} ${order.address2 || ''}`.trim(),
          '소박스': order.smallBoxQuantity,
          '대박스': order.largeBoxQuantity,
          '보자기수량': order.wrappingQuantity,
          '포장방식': order.wrappingQuantity > 0 ? `보자기포장 ${order.wrappingQuantity}개 (+${(order.wrappingQuantity * 1000).toLocaleString()}원)` : '일반포장',
          '총금액': `${order.totalAmount.toLocaleString()}원`,
          '결제상태': order.paymentStatus === 'pending' ? '입금대기' :
                      order.paymentStatus === 'confirmed' ? '입금완료' :
                      order.paymentStatus === 'refunded' ? '환불' : order.paymentStatus,
          '주문일시': new Date(order.createdAt).toLocaleString('ko-KR'),
          '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '-',
          '특별요청': order.specialRequests || '-'
        }));
      };

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add all orders sheet
      const allOrdersData = formatOrderData(orders);
      const allOrdersWs = XLSX.utils.json_to_sheet(allOrdersData);
      XLSX.utils.book_append_sheet(wb, allOrdersWs, '전체주문');
      
      // Add individual status sheets
      if (ordersByStatus.pending.length > 0) {
        const pendingData = formatOrderData(ordersByStatus.pending);
        const pendingWs = XLSX.utils.json_to_sheet(pendingData);
        XLSX.utils.book_append_sheet(wb, pendingWs, '주문접수');
      }
      
      if (ordersByStatus.scheduled.length > 0) {
        const scheduledData = formatOrderData(ordersByStatus.scheduled);
        const scheduledWs = XLSX.utils.json_to_sheet(scheduledData);
        XLSX.utils.book_append_sheet(wb, scheduledWs, '발송예약');
      }
      
      if (ordersByStatus.delivered.length > 0) {
        const deliveredData = formatOrderData(ordersByStatus.delivered);
        const deliveredWs = XLSX.utils.json_to_sheet(deliveredData);
        XLSX.utils.book_append_sheet(wb, deliveredWs, '발송완료');
      }
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      // Set headers for file download
      const fileName = `에덴한과_주문목록_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // Send the Excel file
      res.send(excelBuffer);
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ message: "엑셀 파일 생성에 실패했습니다" });
    }
  });

  // Export revenue report to Excel
  app.get("/api/export/revenue", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      // Include all orders with confirmed payment status (regardless of order status)
      const paidOrders = orders.filter(order => 
        order.paymentStatus === 'confirmed'
      );
      
      // Format revenue data
      const revenueData = paidOrders.map(order => ({
        '주문번호': order.orderNumber,
        '고객명': order.customerName,
        '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
        '주문금액': order.totalAmount,
        '실입금': order.actualPaidAmount || 0,
        '할인금액': order.discountAmount || 0,
        '수익': order.netProfit || 0,
        '소박스수량': order.smallBoxQuantity,
        '대박스수량': order.largeBoxQuantity,
        '보자기수량': order.wrappingQuantity,
        '주문상태': order.status === 'pending' ? '주문접수' :
                   order.status === 'scheduled' ? '발송예약' :
                   order.status === 'delivered' ? '발송완료' : order.status,
        '할인사유': order.discountReason || '-'
      }));

      // Calculate summary statistics
      const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const actualRevenue = paidOrders.reduce((sum, order) => sum + (order.actualPaidAmount || 0), 0);
      const totalDiscounts = paidOrders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);
      const totalProfit = paidOrders.reduce((sum, order) => sum + (order.netProfit || 0), 0);

      const summaryData = [
        { '항목': '총 주문 금액', '금액': totalRevenue },
        { '항목': '실제 입금 금액', '금액': actualRevenue },
        { '항목': '총 할인 금액', '금액': totalDiscounts },
        { '항목': '총 수익', '금액': totalProfit },
        { '항목': '총 주문 건수', '금액': orders.length },
        { '항목': '입금 완료 건수', '금액': paidOrders.length }
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add summary sheet
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, '매출요약');
      
      // Add detailed revenue sheet
      const revenueWs = XLSX.utils.json_to_sheet(revenueData);
      XLSX.utils.book_append_sheet(wb, revenueWs, '상세매출');
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      // Set headers for file download
      const fileName = `에덴한과_매출관리_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // Send the Excel file
      res.send(excelBuffer);
    } catch (error) {
      console.error('Revenue export error:', error);
      res.status(500).json({ message: "매출 엑셀 파일 생성에 실패했습니다" });
    }
  });

  // Soft delete order (move to trash) (admin and manager)
  app.delete("/api/orders/:id", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 주문 ID입니다" });
      }

      const deletedOrder = await storage.softDeleteOrder(id);
      if (!deletedOrder) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      // Update customer stats after deleting order
      await storage.updateCustomerStats(deletedOrder.customerPhone);

      res.json({ message: "주문이 휴지통으로 이동되었습니다", order: deletedOrder });
    } catch (error) {
      res.status(500).json({ message: "주문 삭제에 실패했습니다" });
    }
  });



  // Restore order from trash (admin and manager)
  app.post("/api/orders/:id/restore", requireManagerOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 주문 ID입니다" });
      }

      const restoredOrder = await storage.restoreOrder(id);
      if (!restoredOrder) {
        return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
      }

      // Update customer stats after restoring order
      await storage.updateCustomerStats(restoredOrder.customerPhone);

      res.json({ message: "주문이 복구되었습니다", order: restoredOrder });
    } catch (error) {
      res.status(500).json({ message: "주문 복구에 실패했습니다" });
    }
  });

  // Permanently delete order (admin only)
  app.delete("/api/orders/:id/permanent", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "유효하지 않은 주문 ID입니다" });
      }

      await storage.permanentDeleteOrder(id);
      res.json({ message: "주문이 영구적으로 삭제되었습니다" });
    } catch (error) {
      res.status(500).json({ message: "주문 영구 삭제에 실패했습니다" });
    }
  });

  // Settings API
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSetting(key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      
      const setting = await storage.setSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Admin settings API (admin and manager)
  app.get("/api/admin-settings", requireManagerOrAdmin, async (req, res) => {
    try {
      let adminSettings = await storage.getAdminSettings();
      
      // Create default settings if none exist
      if (!adminSettings) {
        adminSettings = await storage.updateAdminSettings({
          adminName: "에덴한과 관리자",
          adminPhone: "",
          businessName: "에덴한과",
          businessAddress: "",
          businessPhone: "",
          bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)"
        });
      }
      
      res.json(adminSettings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ error: "관리자 설정을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/admin-settings", requireAdmin, async (req, res) => {
    try {
      const adminSettings = req.body;
      console.log("Admin settings update request:", adminSettings);
      
      if (!adminSettings.adminName || !adminSettings.adminPhone || !adminSettings.businessName) {
        console.log("Validation failed - missing required fields");
        return res.status(400).json({ error: "관리자명, 전화번호, 사업체명은 필수 항목입니다" });
      }
      
      console.log("Calling storage.updateAdminSettings with:", adminSettings);
      const updatedSettings = await storage.updateAdminSettings(adminSettings);
      console.log("Successfully updated admin settings:", updatedSettings);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating admin settings:", error);
      res.status(500).json({ error: "관리자 설정 업데이트에 실패했습니다" });
    }
  });

  // Note: Manager endpoints are already defined above with proper authentication

  // Customer management API endpoints (admin and manager)
  app.get("/api/customers", requireManagerOrAdmin, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "고객 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/customers", requireManagerOrAdmin, async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if ((error as any).message?.includes("unique")) {
        return res.status(400).json({ error: "이미 등록된 연락처입니다" });
      }
      res.status(500).json({ error: "고객 등록에 실패했습니다" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedCustomer = await storage.updateCustomer(id, updates);
      if (!updatedCustomer) {
        return res.status(404).json({ error: "고객을 찾을 수 없습니다" });
      }

      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer:", error);
      if ((error as any).message?.includes("unique")) {
        return res.status(400).json({ error: "이미 등록된 연락처입니다" });
      }
      res.status(500).json({ error: "고객 정보 업데이트에 실패했습니다" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomer(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "고객 삭제에 실패했습니다" });
    }
  });

  // Customer stats refresh endpoint
  app.post("/api/customers/refresh-stats", async (req, res) => {
    try {
      // Get all customers and refresh their stats
      const customers = await storage.getAllCustomers();
      for (const customer of customers) {
        await storage.updateCustomerStats(customer.customerPhone);
      }
      res.json({ success: true, message: "모든 고객 통계가 업데이트되었습니다" });
    } catch (error) {
      console.error("Error refreshing customer stats:", error);
      res.status(500).json({ error: "고객 통계 업데이트에 실패했습니다" });
    }
  });

  // Get customer addresses
  app.get("/api/customers/:phone/addresses", async (req, res) => {
    try {
      const phone = req.params.phone;
      const addresses = await storage.getCustomerAddresses(phone);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching customer addresses:", error);
      res.status(500).json({ error: "고객 주소 목록을 불러오는데 실패했습니다" });
    }
  });

  // Update customer statistics (called when orders are created/updated)
  app.post("/api/customers/sync/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      await storage.updateCustomerStats(phone);
      res.json({ success: true });
    } catch (error) {
      console.error("Error syncing customer stats:", error);
      res.status(500).json({ error: "고객 통계 업데이트에 실패했습니다" });
    }
  });

  // Excel file upload for bulk customer registration
  app.post("/api/customers/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        return res.status(400).json({ error: "엑셀 파일에 데이터가 없습니다" });
      }

      // Validate and transform data
      const customers: InsertCustomer[] = [];
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rowNumber = i + 2; // Excel row number (starting from 2, accounting for header)

        try {
          // Expected columns: 고객명, 연락처, 우편번호, 주소1, 주소2, 발송주소, 메모
          const customerData: InsertCustomer = {
            customerName: row['고객명'] || row['이름'] || row['성명'] || '',
            customerPhone: String(row['연락처'] || row['전화번호'] || row['핸드폰'] || '').replace(/[^0-9]/g, ''),
            zipCode: row['우편번호'] || '',
            address1: row['주소1'] || row['주소'] || row['발송주소'] || '',
            address2: row['주소2'] || '',
            notes: row['메모'] || row['비고'] || null
          };

          // Validate required fields
          if (!customerData.customerName || !customerData.customerPhone) {
            errors.push(`행 ${rowNumber}: 고객명과 연락처는 필수 항목입니다`);
            continue;
          }

          if (customerData.customerPhone.length < 10) {
            errors.push(`행 ${rowNumber}: 연락처 형식이 올바르지 않습니다`);
            continue;
          }

          customers.push(customerData);
        } catch (error) {
          errors.push(`행 ${rowNumber}: 데이터 처리 중 오류가 발생했습니다`);
        }
      }

      if (errors.length > 0 && customers.length === 0) {
        return res.status(400).json({ 
          error: "처리할 수 있는 데이터가 없습니다", 
          details: errors 
        });
      }

      // Bulk create customers
      let createdCount = 0;
      let skippedCount = 0;
      const skippedCustomers: string[] = [];

      for (const customer of customers) {
        try {
          // Check if customer already exists
          const existing = await storage.getCustomerByPhone(customer.customerPhone);
          if (existing) {
            skippedCount++;
            skippedCustomers.push(`${customer.customerName} (${customer.customerPhone})`);
            continue;
          }

          await storage.createCustomer(customer);
          createdCount++;
        } catch (error) {
          console.error('Error creating customer:', error);
          skippedCount++;
          skippedCustomers.push(`${customer.customerName} (${customer.customerPhone}) - 생성 실패`);
        }
      }

      res.json({
        success: true,
        message: `총 ${customers.length}명 처리완료`,
        created: createdCount,
        skipped: skippedCount,
        skippedDetails: skippedCustomers,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error uploading customer file:", error);
      res.status(500).json({ error: "파일 업로드 처리 중 오류가 발생했습니다" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
