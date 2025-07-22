import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Box, User, ShoppingCart } from "lucide-react";

const orderSchema = z.object({
  customerName: z.string().min(1, "이름을 입력해주세요"),
  customerPhone: z.string().min(1, "전화번호를 입력해주세요"),
  zipCode: z.string().optional(),
  address1: z.string().min(1, "주소를 입력해주세요"),
  address2: z.string().optional(),
  specialRequests: z.string().optional(),
  boxSize: z.enum(["small", "large"]),
  quantity: z.number().min(1, "수량은 1개 이상이어야 합니다"),
  hasWrapping: z.enum(["yes", "no"]),
});

type OrderFormData = z.infer<typeof orderSchema>;

const prices = {
  small: 15000,
  large: 18000,
  wrapping: 1000,
};

export default function OrderForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [totalAmount, setTotalAmount] = useState(15000);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      zipCode: "",
      address1: "",
      address2: "",
      specialRequests: "",
      boxSize: "small",
      quantity: 1,
      hasWrapping: "no",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: api.orders.create,
    onSuccess: (order) => {
      // Invalidate orders cache so admin panel updates
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "주문 완료",
        description: `주문번호 ${order.orderNumber}로 접수되었습니다. 감사합니다!`,
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "주문 실패",
        description: "주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const watchedValues = form.watch(["boxSize", "quantity", "hasWrapping"]);

  useEffect(() => {
    const [boxSize, quantity, hasWrapping] = watchedValues;
    const basePrice = prices[boxSize as keyof typeof prices] || prices.small;
    const productTotal = basePrice * quantity;
    const wrappingTotal = hasWrapping === "yes" ? prices.wrapping * quantity : 0;
    const total = productTotal + wrappingTotal;
    setTotalAmount(total);
  }, [watchedValues]);

  const onSubmit = (data: OrderFormData) => {
    const orderData = {
      ...data,
      totalAmount,
    };
    createOrderMutation.mutate(orderData);
  };

  const formatPrice = (price: number) => `${price.toLocaleString()}원`;

  const basePrice = prices[form.watch("boxSize")] || prices.small;
  const productTotal = basePrice * form.watch("quantity");
  const wrappingTotal = form.watch("hasWrapping") === "yes" ? prices.wrapping * form.watch("quantity") : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Product Selection */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <h4 className="text-xl font-semibold text-eden-brown mb-6 font-korean">
              <Box className="inline mr-2 h-5 w-5" />
              상품 선택
            </h4>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Box Size Selection */}
                <FormField
                  control={form.control}
                  name="boxSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-4"
                        >
                          <div className="border-2 border-eden-beige rounded-lg p-4 hover:border-eden-brown transition-colors cursor-pointer has-[:checked]:border-eden-brown has-[:checked]:bg-eden-cream">
                            <div className="flex justify-between items-center">
                              <div>
                                <h5 className="font-semibold text-eden-dark">소 박스</h5>
                                <p className="text-sm text-gray-600">전통 유과 15개입</p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-eden-brown">15,000원</div>
                                <RadioGroupItem value="small" id="small" className="mt-2" />
                              </div>
                            </div>
                          </div>
                          
                          <div className="border-2 border-eden-beige rounded-lg p-4 hover:border-eden-brown transition-colors cursor-pointer has-[:checked]:border-eden-brown has-[:checked]:bg-eden-cream">
                            <div className="flex justify-between items-center">
                              <div>
                                <h5 className="font-semibold text-eden-dark">대 박스</h5>
                                <p className="text-sm text-gray-600">전통 유과 25개입</p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-eden-brown">18,000원</div>
                                <RadioGroupItem value="large" id="large" className="mt-2" />
                              </div>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quantity & Wrapping */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>수량</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
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
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="flex space-x-4 mt-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="no-wrap" />
                              <Label htmlFor="no-wrap">없음</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="yes-wrap" />
                              <Label htmlFor="yes-wrap">있음 (+1,000원)</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Price Summary */}
                <div className="bg-eden-cream rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>상품 금액:</span>
                      <span>{formatPrice(productTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>보자기 포장:</span>
                      <span>{formatPrice(wrappingTotal)}</span>
                    </div>
                    <hr className="border-eden-beige" />
                    <div className="flex justify-between font-bold text-lg text-eden-brown">
                      <span>총 금액:</span>
                      <span>{formatPrice(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <h4 className="text-xl font-semibold text-eden-brown mb-6 font-korean">
              <User className="inline mr-2 h-5 w-5" />
              주문자 정보
            </h4>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름 *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="주문자 성함을 입력해주세요"
                          {...field}
                          className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                        />
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
                        <Input 
                          placeholder="010-1234-5678"
                          {...field}
                          className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>배송 주소 *</Label>
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder="우편번호"
                            {...field}
                            className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address1"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder="기본 주소"
                            {...field}
                            className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            placeholder="상세 주소"
                            {...field}
                            className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>요청사항</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="배송 시 특별한 요청사항이 있으시면 적어주세요"
                          rows={3}
                          {...field}
                          className="focus:ring-2 focus:ring-eden-sage focus:border-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={createOrderMutation.isPending}
                  className="w-full bg-eden-brown text-white py-4 font-semibold text-lg hover:bg-eden-dark transition-colors"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {createOrderMutation.isPending ? "주문 처리 중..." : "주문하기"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
