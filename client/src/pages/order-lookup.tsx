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
import { ArrowLeft, Search, Package, Truck, CheckCircle, Clock, MapPin, Phone, User, Calendar, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { Order } from "@shared/schema";

const lookupSchema = z.object({
  phoneNumber: z.string().min(1, "전화번호를 입력해주세요"),
});

type LookupFormData = z.infer<typeof lookupSchema>;

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
    },
  });

  const onSubmit = async (data: LookupFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/orders/lookup?phone=${encodeURIComponent(data.phoneNumber)}`);
      if (!response.ok) {
        throw new Error('주문 조회에 실패했습니다');
      }
      const foundOrders = await response.json();
      setOrders(foundOrders);
      setHasSearched(true);
      
      if (foundOrders.length === 0) {
        toast({
          title: "주문 없음",
          description: "해당 전화번호로 등록된 주문이 없습니다.",
        });
      }
    } catch (error) {
      toast({
        title: "조회 실패",
        description: "주문 조회 중 오류가 발생했습니다.",
        variant: "destructive",
      });
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

  const getDeliveryStatus = (order: Order) => {
    const baseInfo = {
      company: "CJ대한통운",
      trackingNumber: `${order.orderNumber}TRACK`,
    };

    switch (order.status) {
      case 'pending':
        return {
          ...baseInfo,
          status: "주문 접수",
          statusDescription: "주문이 접수되었습니다. 상품 준비 중입니다.",
          estimatedShipping: "1-2일 후 발송 예정",
          trackingAvailable: false,
        };
      case 'preparing':
        return {
          ...baseInfo,
          status: "상품 준비",
          statusDescription: "정성껏 상품을 준비하고 있습니다.",
          estimatedShipping: "오늘 또는 내일 발송 예정",
          trackingAvailable: false,
        };
      case 'shipping':
        return {
          ...baseInfo,
          status: "배송 중",
          statusDescription: "상품이 배송 중입니다.",
          currentLocation: "대전 허브터미널",
          estimatedDelivery: "내일 오후 도착 예정",
          trackingAvailable: true,
        };
      case 'delivered':
        return {
          ...baseInfo,
          status: "배송 완료",
          statusDescription: "상품이 배송 완료되었습니다.",
          deliveredDate: new Date(order.createdAt).toLocaleDateString('ko-KR'),
          trackingAvailable: true,
        };
      default:
        return null;
    }
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
            <p className="text-gray-600">주문 시 입력하신 전화번호로 주문 내역을 조회할 수 있습니다.</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-eden-brown hover:bg-eden-dark text-white"
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
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">해당 전화번호로 등록된 주문이 없습니다.</p>
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
                          <p className="text-gray-500 flex items-center mt-1">
                            <Calendar className="mr-1 h-4 w-4" />
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </Badge>
                          <br />
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
                            <div>
                              <div className="font-medium">
                                에덴한과 유과 {order.boxSize === 'small' ? '소박스' : '대박스'}
                              </div>
                              <div className="text-gray-600 mt-1">
                                수량: {order.quantity}개
                              </div>
                              <div className="text-gray-600">
                                포장: {order.hasWrapping === 'yes' ? '보자기 포장 (+1,000원)' : '일반 포장'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-eden-brown">
                                {formatPrice(order.totalAmount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Status */}
                      {(() => {
                        const deliveryInfo = getDeliveryStatus(order);
                        if (!deliveryInfo) return null;
                        
                        return (
                          <div>
                            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                              <Truck className="mr-2 h-4 w-4" />
                              배송 조회
                            </h3>
                            <div className={`p-4 rounded border text-sm ${
                              order.status === 'delivered' ? 'bg-green-50 border-green-200' :
                              order.status === 'shipping' ? 'bg-blue-50 border-blue-200' :
                              'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="mb-3">
                                <div className="flex items-center space-x-2 mb-2">
                                  {order.status === 'delivered' ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                  ) : order.status === 'shipping' ? (
                                    <Truck className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <Clock className="h-5 w-5 text-gray-600" />
                                  )}
                                  <span className="font-medium text-lg">{deliveryInfo.status}</span>
                                </div>
                                <p className="text-gray-700">{deliveryInfo.statusDescription}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <span className="text-gray-600">택배사: </span>
                                  <span className="font-medium">{deliveryInfo.company}</span>
                                </div>
                                
                                {deliveryInfo.trackingAvailable && (
                                  <div>
                                    <span className="text-gray-600">운송장번호: </span>
                                    <span className="font-medium">{deliveryInfo.trackingNumber}</span>
                                  </div>
                                )}
                                
                                {deliveryInfo.currentLocation && (
                                  <div>
                                    <span className="text-gray-600">현재위치: </span>
                                    <span className="font-medium">{deliveryInfo.currentLocation}</span>
                                  </div>
                                )}
                                
                                {deliveryInfo.estimatedDelivery && (
                                  <div>
                                    <span className="text-gray-600">배송예정: </span>
                                    <span className="font-medium">{deliveryInfo.estimatedDelivery}</span>
                                  </div>
                                )}
                                
                                {deliveryInfo.estimatedShipping && (
                                  <div>
                                    <span className="text-gray-600">발송예정: </span>
                                    <span className="font-medium">{deliveryInfo.estimatedShipping}</span>
                                  </div>
                                )}
                                
                                {deliveryInfo.deliveredDate && (
                                  <div>
                                    <span className="text-gray-600">배송완료일: </span>
                                    <span className="font-medium">{deliveryInfo.deliveredDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

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
                        {(() => {
                          const deliveryInfo = getDeliveryStatus(order);
                          return deliveryInfo?.trackingAvailable && (
                            <Button variant="outline" size="sm" onClick={() => {
                              window.open(`https://www.cjlogistics.com/ko/tool/parcel/tracking?paramInvc=${deliveryInfo.trackingNumber}`, '_blank');
                            }}>
                              <Truck className="mr-2 h-4 w-4" />
                              배송 추적
                            </Button>
                          );
                        })()}
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