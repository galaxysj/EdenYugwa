import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { insertOrderSchema, type Order } from "@shared/schema";
import { z } from "zod";

const editOrderSchema = insertOrderSchema.extend({
  customerName: z.string().min(1, "이름을 입력해주세요"),
  customerPhone: z.string().min(1, "전화번호를 입력해주세요"),
  address1: z.string().min(1, "주소를 입력해주세요"),
  boxSize: z.enum(["small", "large"]),
  quantity: z.number().min(1, "수량은 1개 이상이어야 합니다"),
  hasWrapping: z.enum(["yes", "no"]),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

export default function OrderEdit() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
  });

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) {
          throw new Error('주문을 찾을 수 없습니다');
        }
        const orderData = await response.json();
        setOrder(orderData);
        
        // Check if order can be edited
        if (orderData.status !== 'pending' || orderData.paymentStatus !== 'pending') {
          toast({
            title: "수정 불가",
            description: "이미 처리된 주문은 수정할 수 없습니다.",
            variant: "destructive",
          });
          setLocation('/order-lookup');
          return;
        }

        // Set form values
        form.reset({
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          zipCode: orderData.zipCode || '',
          address1: orderData.address1,
          address2: orderData.address2 || '',
          specialRequests: orderData.specialRequests || '',
          boxSize: orderData.boxSize,
          quantity: orderData.quantity,
          hasWrapping: orderData.hasWrapping,
        });
      } catch (error) {
        toast({
          title: "오류",
          description: "주문 정보를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setLocation('/order-lookup');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchOrder();
    }
  }, [id, form, toast, setLocation]);

  const calculateTotal = (boxSize: string, quantity: number, hasWrapping: string) => {
    const basePrice = boxSize === 'small' ? 15000 : 18000;
    const wrappingPrice = hasWrapping === 'yes' ? 1000 : 0;
    return (basePrice + wrappingPrice) * quantity;
  };

  const onSubmit = async (data: EditOrderFormData) => {
    setIsSaving(true);
    try {
      const totalAmount = calculateTotal(data.boxSize, data.quantity, data.hasWrapping);
      
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          totalAmount,
        }),
      });

      if (!response.ok) {
        throw new Error('주문 수정에 실패했습니다');
      }

      toast({
        title: "수정 완료",
        description: "주문이 성공적으로 수정되었습니다.",
      });
      
      setLocation('/order-lookup');
    } catch (error) {
      toast({
        title: "수정 실패",
        description: "주문 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const boxSize = form.watch('boxSize');
  const quantity = form.watch('quantity');
  const hasWrapping = form.watch('hasWrapping');

  const currentTotal = boxSize && quantity && hasWrapping 
    ? calculateTotal(boxSize, quantity, hasWrapping)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eden-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
          <p className="text-eden-dark">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Header */}
      <div className="bg-eden-red text-white p-6">
        <div className="container mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/order-lookup">
              <Button variant="ghost" className="text-white hover:text-gray-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                주문 조회로
              </Button>
            </Link>
            <h1 className="text-2xl font-bold font-korean">주문 수정</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Warning */}
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="text-orange-800">
                주문번호 #{order.orderNumber} - 입금 전 주문만 수정 가능합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-korean">주문 정보 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">주문자 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>이름 *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>전화번호 *</FormLabel>
                          <FormControl>
                            <Input placeholder="010-1234-5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">배송 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>우편번호</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>주소 *</FormLabel>
                            <FormControl>
                              <Input placeholder="기본 주소를 입력해주세요" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>상세 주소</FormLabel>
                        <FormControl>
                          <Input placeholder="상세 주소를 입력해주세요" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="specialRequests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>배송 요청사항</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="배송 시 요청사항이 있으시면 입력해주세요"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Product Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">상품 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="boxSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>박스 크기 *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="크기 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="small">소박스 (15,000원)</SelectItem>
                              <SelectItem value="large">대박스 (18,000원)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>수량 *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hasWrapping"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>보자기 포장</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="포장 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="no">일반 포장</SelectItem>
                              <SelectItem value="yes">보자기 포장 (+1,000원)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Total */}
                {currentTotal > 0 && (
                  <Card className="bg-eden-sage/10 border-eden-sage">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">총 결제 금액</span>
                        <span className="text-2xl font-bold text-eden-brown">
                          {currentTotal.toLocaleString()}원
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <Link href="/order-lookup">
                    <Button type="button" variant="outline">
                      취소
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-eden-brown hover:bg-eden-dark text-white"
                  >
                    {isSaving ? (
                      "저장 중..."
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        수정 완료
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}