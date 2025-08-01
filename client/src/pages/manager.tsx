import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Truck, 
  User, 
  Calendar,
  Phone,
  MapPin,
  ArrowLeft,
  Send,
  Edit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { Order } from "@shared/schema";
import { Link } from "wouter";

const smsSchema = z.object({
  message: z.string().min(1, "메시지를 입력해주세요"),
});

type SMSFormData = z.infer<typeof smsSchema>;

const statusLabels = {
  pending: "주문 접수",
  preparing: "제작 중", 
  shipping: "배송 중",
  delivered: "배송 완료",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  shipping: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
};



const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const smsTemplates = [
  {
    label: "주문 접수 완료",
    message: "안녕하세요, 에덴한과입니다. 고객님의 주문이 접수되었습니다. 정성껏 준비하겠습니다. 감사합니다."
  },
  {
    label: "제작 시작",
    message: "안녕하세요, 에덴한과입니다. 고객님의 주문 상품 제작을 시작했습니다. 최고 품질로 준비하겠습니다."
  },
  {
    label: "배송 시작",
    message: "안녕하세요, 에덴한과입니다. 고객님의 주문 상품이 배송 시작되었습니다. 곧 만나뵙겠습니다."
  },
  {
    label: "배송 완료",
    message: "안녕하세요, 에덴한과입니다. 고객님의 주문 상품이 배송 완료되었습니다. 맛있게 드시고 좋은 후기 부탁드립니다."
  }
];

export default function Manager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const { toast } = useToast();

  const smsForm = useForm<SMSFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      message: "",
    },
  });

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('주문 조회에 실패했습니다');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      toast({
        title: "오류",
        description: "주문 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSMSHistory = async (orderId: number) => {
    try {
      const response = await fetch(`/api/sms/history/${orderId}`);
      if (!response.ok) throw new Error('SMS 기록 조회에 실패했습니다');
      const data = await response.json();
      setSmsHistory(data);
    } catch (error) {
      console.error('SMS 기록 조회 실패:', error);
      setSmsHistory([]);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('상태 업데이트에 실패했습니다');

      // 주문 목록 새로고침
      fetchOrders();
      
      toast({
        title: "상태 업데이트",
        description: "주문 상태가 성공적으로 업데이트되었습니다.",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };



  const sendSMS = async (data: SMSFormData) => {
    if (!selectedOrder) return;

    setIsSendingSMS(true);
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          phoneNumber: selectedOrder.customerPhone,
          message: data.message,
        }),
      });

      if (!response.ok) throw new Error('SMS 전송에 실패했습니다');

      toast({
        title: "SMS 전송 완료",
        description: "SMS가 성공적으로 전송되었습니다.",
      });

      // SMS 기록 새로고침
      fetchSMSHistory(selectedOrder.id);
      
      // 폼 리셋
      smsForm.reset();
    } catch (error) {
      toast({
        title: "SMS 전송 실패",
        description: "SMS 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    fetchSMSHistory(order.id);
  };

  const applyTemplate = (template: string) => {
    smsForm.setValue('message', template);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto"></div>
          <p className="mt-4 text-gray-600">주문 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-eden-brown text-white py-8">
        <div className="container mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:text-gray-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>  
            </Link>
            <h1 className="text-3xl font-bold font-korean">매니저 관리</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-korean">주문 목록</CardTitle>
                <p className="text-gray-600">총 {orders.length}개의 주문</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>주문번호</TableHead>
                        <TableHead>고객명</TableHead>
                        <TableHead>전화번호</TableHead>
                        <TableHead>상품 정보</TableHead>
                        <TableHead>주문 상태</TableHead>
                        <TableHead>주문일시</TableHead>
                        <TableHead>관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow 
                          key={order.id}
                          className={selectedOrder?.id === order.id ? "bg-eden-sage/10" : ""}
                        >
                          <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell>{order.customerPhone}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{order.boxSize === 'small' ? '소박스' : '대박스'} x {order.quantity}</div>
                              <div className="text-gray-500">
                                {order.wrappingQuantity > 0 ? `보자기 ${order.wrappingQuantity}개` : '일반 포장'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">주문 접수</SelectItem>
                                <SelectItem value="preparing">제작 중</SelectItem>
                                <SelectItem value="shipping">배송 중</SelectItem>
                                <SelectItem value="delivered">배송 완료</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(order.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOrderSelect(order)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Link href={`/order-edit/${order.id}`}>
                                <Button size="sm" variant="outline">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SMS Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="font-korean">SMS 관리</CardTitle>
                {selectedOrder && (
                  <p className="text-gray-600">
                    주문번호: #{selectedOrder.orderNumber}<br />
                    고객: {selectedOrder.customerName} ({selectedOrder.customerPhone})
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <div className="space-y-4">
                    {/* SMS Templates */}
                    <div>
                      <h4 className="font-medium mb-2">빠른 메시지</h4>
                      <div className="space-y-1">
                        {smsTemplates.map((template, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-left h-auto p-2"
                            onClick={() => applyTemplate(template.message)}
                          >
                            <div>
                              <div className="font-medium text-sm">{template.label}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {template.message.substring(0, 50)}...
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* SMS Form */}
                    <Form {...smsForm}>
                      <form onSubmit={smsForm.handleSubmit(sendSMS)} className="space-y-4">
                        <FormField
                          control={smsForm.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>메시지 내용</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="고객에게 보낼 메시지를 입력하세요"
                                  className="min-h-24"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit" 
                          disabled={isSendingSMS}
                          className="w-full bg-eden-brown hover:bg-eden-dark"
                        >
                          {isSendingSMS ? (
                            "전송 중..."
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              SMS 전송
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>

                    {/* SMS History */}
                    {smsHistory.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">전송 기록</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {smsHistory.map((sms) => (
                            <div key={sms.id} className="bg-gray-50 p-3 rounded text-sm">
                              <div className="font-medium text-gray-700 mb-1">
                                {formatDate(sms.sentAt)}
                              </div>
                              <div className="text-gray-600">{sms.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p>주문을 선택하여 SMS를 관리하세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}