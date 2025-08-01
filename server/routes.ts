import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertSmsNotificationSchema, type Order } from "@shared/schema";
import * as XLSX from "xlsx";

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

  // Lookup orders by phone number or name (must come before /api/orders/:id)
  app.get("/api/orders/lookup", async (req, res) => {
    try {
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
      const uniqueOrders = orders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      );
      
      if (uniqueOrders.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(uniqueOrders);
    } catch (error) {
      res.status(500).json({ message: "Failed to lookup orders" });
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
      // scheduledDate를 Date 객체로 변환
      if (req.body.scheduledDate && typeof req.body.scheduledDate === 'string') {
        req.body.scheduledDate = new Date(req.body.scheduledDate);
      }
      
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
  // Update entire order
  app.patch("/api/orders/:id", async (req, res) => {
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

  // Update order scheduled date
  app.patch("/api/orders/:id/scheduled-date", async (req, res) => {
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

  // Update order financial information (admin only)
  app.patch('/api/orders/:id/financial', async (req, res) => {
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
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
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

  // Export orders to Excel
  app.get("/api/orders/export/excel", async (req, res) => {
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

  // Delete order
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOrder(id);
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete order" });
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

  app.post("/api/settings", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
