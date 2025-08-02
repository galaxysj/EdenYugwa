import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { type InsertOrder } from "@shared/schema";
import { 
  Loader2, Package, MapPin, User, Phone, Calendar, Gift, Copy, Check, 
  Home, FileText, ShoppingCart, Search 
} from "lucide-react";

// Public order form schema
const publicOrderSchema = z.object({
  customerName: z.string().min(1, "고객명을 입력해주세요"),
  customerPhone: z.string().min(1, "연락처를 입력해주세요"),
  zipCode: z.string().optional(),
  address1: z.string().min(1, "주소를 입력해주세요"),
  address2: z.string().optional(),
  smallBoxQuantity: z.number().min(0).default(0),
  largeBoxQuantity: z.number().min(0).default(0),
  wrappingQuantity: z.number().min(0).default(0),
  specialRequests: z.string().optional(),
  scheduledDate: z.string().optional(),
});

type PublicOrderForm = z.infer<typeof publicOrderSchema>;

export default function PublicOrder() {
  const { toast } = useToast();
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "about" | "order" | "lookup">("home");
  const [linkCopied, setLinkCopied] = useState(false);

  const form = useForm<PublicOrderForm>({
    resolver: zodResolver(publicOrderSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      zipCode: "",
      address1: "",
      address2: "",
      smallBoxQuantity: 0,
      largeBoxQuantity: 0,
      wrappingQuantity: 0,
      specialRequests: "",
      scheduledDate: "",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: InsertOrder) => api.orders.create(data),
    onSuccess: (newOrder) => {
      setOrderNumber(newOrder.orderNumber);
      setOrderComplete(true);
      toast({
        title: "주문이 완료되었습니다",
        description: `주문번호: ${newOrder.orderNumber}`,
      });
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast({
        title: "주문 실패",
        description: "주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PublicOrderForm) => {
    const smallBoxPrice = 30000;
    const largeBoxPrice = 50000;
    const wrappingPrice = 2000;
    
    const totalAmount = 
      (data.smallBoxQuantity * smallBoxPrice) +
      (data.largeBoxQuantity * largeBoxPrice) +
      (data.wrappingQuantity * wrappingPrice);

    const orderData: InsertOrder = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      zipCode: data.zipCode || null,
      address1: data.address1,
      address2: data.address2 || null,
      smallBoxQuantity: data.smallBoxQuantity,
      largeBoxQuantity: data.largeBoxQuantity,
      wrappingQuantity: data.wrappingQuantity,
      specialRequests: data.specialRequests || null,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      totalAmount,
      status: "pending",
      paymentStatus: "pending",
    };

    createOrderMutation.mutate(orderData);
  };

  const calculateTotal = () => {
    const smallBoxPrice = 30000;
    const largeBoxPrice = 50000;
    const wrappingPrice = 2000;
    
    const smallBoxQuantity = form.watch("smallBoxQuantity") || 0;
    const largeBoxQuantity = form.watch("largeBoxQuantity") || 0;
    const wrappingQuantity = form.watch("wrappingQuantity") || 0;
    
    return (smallBoxQuantity * smallBoxPrice) + 
           (largeBoxQuantity * largeBoxPrice) + 
           (wrappingQuantity * wrappingPrice);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + "원";
  };

  const copyCurrentLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      toast({
        title: "링크가 복사되었습니다",
        description: "고객에게 이 링크를 공유하여 주문받으세요",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "링크 복사 실패",
        description: "다시 시도해주세요",
        variant: "destructive",
      });
    }
  };

  const scrollToSection = (sectionId: string) => {
    setCurrentView(sectionId as any);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-eden-cream via-white to-eden-cream/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-eden-brown/20 shadow-lg">
          <CardHeader className="text-center bg-eden-brown text-white rounded-t-lg">
            <CardTitle className="text-2xl font-korean flex items-center justify-center gap-2">
              <Gift className="h-6 w-6" />
              주문 완료
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-green-800 font-semibold text-lg mb-2">
                주문이 성공적으로 접수되었습니다
              </div>
              <div className="text-green-700">
                주문번호: <span className="font-bold">#{orderNumber}</span>
              </div>
            </div>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <Phone className="h-4 w-4" />
                <span>주문 확인 연락을 드릴 예정입니다</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>배송일정은 별도 안내드립니다</span>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button 
                onClick={() => {
                  setOrderComplete(false);
                  setOrderNumber("");
                  form.reset();
                  setCurrentView("order");
                  scrollToSection("order");
                }}
                className="w-full bg-eden-brown hover:bg-eden-brown/90"
              >
                새 주문하기
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setOrderComplete(false);
                  setCurrentView("home");
                  scrollToSection("home");
                }}
                className="w-full"
              >
                홈으로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Navigation */}
      <header className="bg-white shadow-sm border-b border-eden-beige sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-eden-sage text-2xl">🌿</div>
              <h1 className="text-2xl font-bold text-eden-brown font-korean">에덴한과</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <button 
                onClick={() => scrollToSection('home')}
                className={`text-eden-dark hover:text-eden-brown transition-colors flex items-center gap-2 ${
                  currentView === 'home' ? 'text-eden-brown font-semibold' : ''
                }`}
              >
                <Home className="h-4 w-4" />
                홈
              </button>
              <button 
                onClick={() => scrollToSection('about')}
                className={`text-eden-dark hover:text-eden-brown transition-colors flex items-center gap-2 ${
                  currentView === 'about' ? 'text-eden-brown font-semibold' : ''
                }`}
              >
                <FileText className="h-4 w-4" />
                소개
              </button>
              <button 
                onClick={() => scrollToSection('order')}
                className={`text-eden-dark hover:text-eden-brown transition-colors flex items-center gap-2 ${
                  currentView === 'order' ? 'text-eden-brown font-semibold' : ''
                }`}
              >
                <ShoppingCart className="h-4 w-4" />
                주문하기
              </button>
              <button 
                onClick={() => scrollToSection('lookup')}
                className={`text-eden-dark hover:text-eden-brown transition-colors flex items-center gap-2 ${
                  currentView === 'lookup' ? 'text-eden-brown font-semibold' : ''
                }`}
              >
                <Search className="h-4 w-4" />
                주문 조회
              </button>
              
              {/* Link Copy Button */}
              <Button
                onClick={copyCurrentLink}
                variant="outline"
                size="sm"
                className="bg-eden-brown text-white hover:bg-eden-brown/90 border-eden-brown"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    링크복사
                  </>
                )}
              </Button>
            </nav>

            {/* Mobile Menu */}
            <div className="flex items-center gap-2 md:hidden">
              <Button
                onClick={copyCurrentLink}
                variant="outline"
                size="sm"
                className="bg-eden-brown text-white hover:bg-eden-brown/90 border-eden-brown"
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? "✕" : "☰"}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-eden-beige pt-4">
              <div className="flex flex-col space-y-4">
                <button 
                  onClick={() => {
                    scrollToSection('home');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2 flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  홈
                </button>
                <button 
                  onClick={() => {
                    scrollToSection('about');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  소개
                </button>
                <button 
                  onClick={() => {
                    scrollToSection('order');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2 flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  주문하기
                </button>
                <button 
                  onClick={() => {
                    scrollToSection('lookup');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2 flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  주문 조회
                </button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Home Section */}
      <section id="home" className="relative overflow-hidden bg-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-eden-brown mb-6 leading-tight font-korean max-w-4xl mx-auto">
              진안에서 온 <span className="text-eden-red">정성 가득</span> 유과
            </h2>
            <p className="text-base sm:text-lg text-eden-dark mb-8 leading-relaxed max-w-2xl mx-auto">
              에덴한과에서 직접 만드는 찹쌀유과로 100% 국내산 찹쌀로 만든 한과입니다.<br className="hidden sm:block" />
              달지 않고 고소한 맛이 일품으로 선물로도 완벽한 에덴한과입니다.
            </p>
          </div>

          {/* Bank Account Information */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gradient-to-r from-eden-sage/10 to-eden-brown/10 rounded-lg p-6 border border-eden-brown/20">
              <div className="text-center">
                <h4 className="text-3xl font-bold text-eden-red mb-3 font-korean">입금계좌</h4>
                <div className="text-2xl font-bold text-eden-red">
                  농협 352-1701-3342-63 (예금주: 손*진)
                </div>
                <p className="text-sm text-gray-600 mt-2">주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-eden-cream/50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-bold text-eden-brown mb-8 font-korean">에덴한과 소개</h3>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h4 className="text-xl font-semibold text-eden-brown mb-4">🌾 100% 국내산 찹쌀</h4>
                <p className="text-gray-700">
                  엄선된 국내산 찹쌀만을 사용하여 고소하고 담백한 맛을 살렸습니다.
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h4 className="text-xl font-semibold text-eden-brown mb-4">❤️ 정성스러운 수작업</h4>
                <p className="text-gray-700">
                  하나하나 정성스럽게 만든 전통 유과로 깊은 맛과 향을 자랑합니다.
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h4 className="text-xl font-semibold text-eden-brown mb-4">🎁 선물로 완벽</h4>
                <p className="text-gray-700">
                  고급스러운 포장으로 특별한 날 선물용으로 최적입니다.
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h4 className="text-xl font-semibold text-eden-brown mb-4">🏞️ 진안 직송</h4>
                <p className="text-gray-700">
                  전북 진안에서 직접 제조하여 신선하게 배송해드립니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Section */}
      <section id="order" className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-eden-brown mb-4 font-korean">주문하기</h3>
              <p className="text-gray-600">아래 정보를 입력하여 주문해주세요</p>
            </div>
            
            <Card className="border-eden-brown/20 shadow-lg">
              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Customer Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <User className="h-5 w-5 text-eden-brown" />
                        <h3 className="text-lg font-semibold text-gray-900">주문자 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>고객명 *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="홍길동" />
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
                              <FormLabel>연락처 *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="010-1234-5678" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Delivery Information */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <MapPin className="h-5 w-5 text-eden-brown" />
                        <h3 className="text-lg font-semibold text-gray-900">배송 정보</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>우편번호</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="12345" />
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
                                  <Input {...field} placeholder="서울시 강남구 테헤란로 123" />
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
                            <FormLabel>상세주소</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="101동 502호" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Product Selection */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <Gift className="h-5 w-5 text-eden-brown" />
                        <h3 className="text-lg font-semibold text-gray-900">상품 선택</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                          <div className="text-center">
                            <h4 className="font-semibold text-gray-900">한과1호 (소박스)</h4>
                            <p className="text-2xl font-bold text-eden-brown">30,000원</p>
                          </div>
                          <FormField
                            control={form.control}
                            name="smallBoxQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>수량</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                          <div className="text-center">
                            <h4 className="font-semibold text-gray-900">한과2호 (대박스)</h4>
                            <p className="text-2xl font-bold text-eden-brown">50,000원</p>
                          </div>
                          <FormField
                            control={form.control}
                            name="largeBoxQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>수량</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                          <div className="text-center">
                            <h4 className="font-semibold text-gray-900">보자기 포장</h4>
                            <p className="text-2xl font-bold text-eden-brown">2,000원</p>
                          </div>
                          <FormField
                            control={form.control}
                            name="wrappingQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>수량</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Special Requests */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="specialRequests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>특별 요청사항</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field}
                                value={field.value || ""}
                                placeholder="배송 관련 요청사항이나 기타 문의사항을 적어주세요"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Scheduled Date */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="scheduledDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>희망 배송일 (선택사항)</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field}
                                value={field.value || ""}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Order Summary */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">주문 요약</h3>
                      <div className="space-y-2 text-sm">
                        {(form.watch("smallBoxQuantity") || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>한과1호×{form.watch("smallBoxQuantity") || 0}개</span>
                            <span>{formatPrice((form.watch("smallBoxQuantity") || 0) * 30000)}</span>
                          </div>
                        )}
                        {(form.watch("largeBoxQuantity") || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>한과2호×{form.watch("largeBoxQuantity") || 0}개</span>
                            <span>{formatPrice((form.watch("largeBoxQuantity") || 0) * 50000)}</span>
                          </div>
                        )}
                        {(form.watch("wrappingQuantity") || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>보자기×{form.watch("wrappingQuantity") || 0}개</span>
                            <span>{formatPrice((form.watch("wrappingQuantity") || 0) * 2000)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-4">
                          <div className="flex justify-between text-lg font-semibold text-eden-brown">
                            <span>총 주문금액</span>
                            <span>{formatPrice(calculateTotal())}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      disabled={createOrderMutation.isPending || calculateTotal() === 0}
                      className="w-full bg-eden-brown hover:bg-eden-brown/90 text-lg py-6"
                    >
                      {createOrderMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          주문 처리 중...
                        </>
                      ) : (
                        "주문하기"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Lookup Section */}
      <section id="lookup" className="bg-eden-cream/50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-3xl font-bold text-eden-brown mb-8 font-korean">주문 조회</h3>
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <p className="text-gray-600 mb-6">
                주문 조회는 주문 시 제공된 주문번호와 연락처로 확인하실 수 있습니다.
              </p>
              <div className="space-y-4">
                <Input placeholder="주문번호를 입력하세요" className="text-center" />
                <Input placeholder="주문 시 입력한 연락처를 입력하세요" className="text-center" />
                <Button className="w-full bg-eden-brown hover:bg-eden-brown/90">
                  <Search className="h-4 w-4 mr-2" />
                  주문 조회
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                주문 조회에 문제가 있으시면 고객센터로 연락해주세요.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}