import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Package, MapPin, User, Calendar, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { Order } from "@shared/schema";

const lookupSchema = z.object({
  phoneNumber: z.string().optional(),
  customerName: z.string().optional(),
}).refine(data => data.phoneNumber || data.customerName, {
  message: "전화번호 또는 이름 중 하나는 입력해주세요",
  path: ["phoneNumber"],
});

type LookupFormData = z.infer<typeof lookupSchema>;

const statusLabels = {
  pending: "주문접수",
  scheduled: "발송주문",
  seller_shipped: "발송대기",
  delivered: "발송완료",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  seller_shipped: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
};

const paymentStatusLabels = {
  pending: "입금 대기",
  confirmed: "입금 완료",
  refunded: "환불",
};

const paymentStatusColors = {
  pending: "bg-red-100 text-red-800",
  confirmed: "bg-green-100 text-green-800",
  refunded: "bg-gray-100 text-gray-800",
};

export default function OrderLookup() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { toast } = useToast();

  const form = useForm<LookupFormData>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      phoneNumber: "",
      customerName: "",
    },
  });

  const onSubmit = async (data: LookupFormData) => {
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (data.phoneNumber) queryParams.append('phone', data.phoneNumber);
      if (data.customerName) queryParams.append('name', data.customerName);
      
      const response = await fetch(`/api/orders/lookup?${queryParams.toString()}`);
      
      if (response.status === 404) {
        // 404인 경우 주문 내역이 없음
        setOrders([]);
        setHasSearched(true);
        return;
      }
      
      if (!response.ok) {
        throw new Error('주문 조회에 실패했습니다');
      }
      
      const foundOrders = await response.json();
      setOrders(foundOrders);
      setHasSearched(true);
      
    } catch (error) {
      toast({
        title: "조회 실패",
        description: "주문 조회 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setOrders([]);
      setHasSearched(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };



  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Header */}
      <div className="bg-eden-red text-white p-6">
        <div className="container mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:text-gray-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>
            </Link>
            <h1 className="text-2xl font-bold font-korean">주문 조회</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-korean">주문 조회하기</CardTitle>
            <p className="text-gray-600">주문 시 입력하신 전화번호 또는 이름으로 주문 내역을 조회할 수 있습니다.</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>전화번호</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="010-1234-5678"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>주문자 이름</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="홍길동"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="text-sm text-gray-500 mt-2">
                  * 전화번호 또는 이름 중 하나만 입력해도 조회 가능합니다.
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-eden-brown hover:bg-eden-dark text-white w-full md:w-auto"
                >
                  {isLoading ? (
                    "조회 중..."
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      주문 조회
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Orders Results */}
        {hasSearched && (
          <div className="space-y-6">
            {orders.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="p-12 text-center">
                  <Package className="mx-auto h-16 w-16 text-gray-300 mb-6" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">주문 내역이 없습니다</h3>
                  <p className="text-gray-500 mb-4">
                    입력하신 전화번호로 등록된 주문을 찾을 수 없습니다.
                  </p>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>• 전화번호를 정확히 입력했는지 확인해 주세요</p>
                    <p>• 주문 시 사용한 번호와 동일한지 확인해 주세요</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => {
                return (
                  <Card key={order.id} className="border border-gray-200">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-korean">주문번호 #{order.orderNumber}</CardTitle>
                          <div className="text-gray-500 mt-1">
                            <div className="flex items-center">
                              <Calendar className="mr-1 h-4 w-4" />
                              {formatDate(order.createdAt)}
                            </div>
                            <div className="text-xs ml-5">
                              {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {order.scheduledDate && (
                              <div className="text-xs ml-5 mt-1 text-blue-600 font-medium">
                                예약발송일: {formatDate(order.scheduledDate)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                              {statusLabels[order.status as keyof typeof statusLabels]}
                            </Badge>
                            {order.status === 'delivered' && order.deliveredDate && (
                              <div className="text-xs text-gray-500 mt-1">
                                발송일: {formatDate(order.deliveredDate)}
                              </div>
                            )}
                          </div>
                          <Badge className={paymentStatusColors[order.paymentStatus as keyof typeof paymentStatusColors]}>
                            {paymentStatusLabels[order.paymentStatus as keyof typeof paymentStatusLabels]}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Customer Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          주문자 정보
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">이름: </span>
                            <span className="font-medium">{order.customerName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">전화번호: </span>
                            <span className="font-medium">{order.customerPhone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <MapPin className="mr-2 h-4 w-4" />
                          배송 정보
                        </h3>
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-gray-600">주소: </span>
                            <span className="font-medium">
                              {order.zipCode && `(${order.zipCode}) `}
                              {order.address1} {order.address2}
                            </span>
                          </div>

                          {order.specialRequests && (
                            <div>
                              <span className="text-gray-600">배송 요청사항: </span>
                              <span className="font-medium">{order.specialRequests}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                          <Package className="mr-2 h-4 w-4" />
                          주문 상품
                        </h3>
                        <div className="bg-gray-50 p-4 rounded border text-sm">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              {order.smallBoxQuantity > 0 && (
                                <div className="font-medium">
                                  한과1호(약 1.1kg) × {order.smallBoxQuantity}개
                                </div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="font-medium">
                                  한과2호(약 1.3kg) × {order.largeBoxQuantity}개
                                </div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-gray-600">
                                  보자기 수량 × {order.wrappingQuantity}개 (+{(order.wrappingQuantity * 1000).toLocaleString()}원)
                                </div>
                              )}
                              {order.shippingFee > 0 && (
                                <div className="text-gray-600">
                                  배송비: +{order.shippingFee.toLocaleString()}원
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-eden-brown">
                                {formatPrice(order.totalAmount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>



                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-2 pt-4 border-t">
                        {order.status === 'pending' && order.paymentStatus === 'pending' && (
                          <Link href={`/order-edit/${order.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="mr-2 h-4 w-4" />
                              주문 수정
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}