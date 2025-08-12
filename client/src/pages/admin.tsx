import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ArrowLeft, Settings, Package, Truck, CheckCircle, Clock, Eye, LogOut, DollarSign, AlertCircle, Download, Calendar, Trash2, Edit, Cog, RefreshCw, X, Users, Key, MessageSquare, RotateCcw, Upload, Plus, Calculator, Save, Undo, Shield, Monitor, Activity, MapPin, Smartphone, Laptop, Tablet, Globe, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { SmsDialog } from "@/components/sms-dialog";
import ScheduledDatePicker from "@/components/scheduled-date-picker";
import { DeliveredDatePicker } from "@/components/delivered-date-picker";
import { SellerShippedDatePicker } from "@/components/seller-shipped-date-picker";
import { CustomerManagement } from "@/components/customer-management";
import { UserManagement } from "@/components/user-management";
import { ObjectUploader } from "@/components/ObjectUploader";

import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import AdminHeader from "@/components/admin-header";
import type { Order, Setting, DashboardContent } from "@shared/schema";
import * as XLSX from 'xlsx';

// Security-related interfaces
interface UserSession {
  id: number;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  deviceType?: string;
  browserInfo?: string;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
  isCurrent?: boolean;
}

interface LoginAttempt {
  id: number;
  username?: string;
  ipAddress: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
}

interface AccessControlSettings {
  userId: number;
  allowedIpRanges: string[];
  allowedCountries: string[];
  allowedDeviceTypes: string[];
  blockUnknownDevices: boolean;
  maxConcurrentSessions: number;
  sessionTimeout: number;
  requireLocationVerification: boolean;
  isEnabled: boolean;
}

interface ApprovalRequest {
  id: number;
  userId: number;
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
  requestReason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
}



const statusLabels = {
  pending: "주문접수",
  scheduled: "발송주문",
  delivered: "발송완료",
};

const statusIcons = {
  pending: Clock,
  scheduled: Calendar,
  delivered: CheckCircle,
};

// 제주도 및 도서산간지역 감지 함수
const checkRemoteArea = (address: string) => {
  if (!address) return false;
  
  // 울릉도(섬) 포함 - 경북 울릉군 포함
  if (address.includes('울릉도') || address.includes('울릉군')) {
    return true;
  }
  
  const remoteAreaKeywords = [
    '제주', '제주도', '제주시', '서귀포', '서귀포시',
    '독도',
    '강화', '강화도', '강화군',
    '백령', '백령도',
    '연평', '연평도',
    '흑산', '흑산도',
    '진도', '진도군',
    '가파리', '가파도',
    '영도', '영도구'
  ];
  
  return remoteAreaKeywords.some(keyword => address.includes(keyword));
};

// Security helper functions
const getDeviceIcon = (deviceType: string = 'desktop') => {
  switch (deviceType.toLowerCase()) {
    case 'mobile':
    case 'smartphone':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    case 'laptop':
      return <Laptop className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
};

const getDeviceTypeLabel = (deviceType: string = 'desktop') => {
  switch (deviceType.toLowerCase()) {
    case 'mobile':
    case 'smartphone':
      return '모바일';
    case 'tablet':
      return '태블릿';
    case 'laptop':
      return '노트북';
    default:
      return '데스크톱';
  }
};

const getStatusColor = (success: boolean) => {
  return success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
};

// Payment Details Dialog Component
function PaymentDetailsDialog({ order, onUpdate, open, setOpen }: { order: Order; onUpdate: (orderId: number, paymentStatus: string, actualPaidAmount?: number, discountAmount?: number) => void; open: boolean; setOpen: (open: boolean) => void }) {
  // settings와 dashboardContent 데이터 가져오기 (매출내역과 동일한 방식)
  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });
  const { data: dashboardContent } = useQuery<any>({
    queryKey: ["/api/dashboard-content"],
  });
  // 매출내역과 동일한 방식으로 총 주문금액 계산 (현재 가격설정 우선 사용)
  const calculateRecalculatedTotal = (order: Order, settings?: any[], dashboardContent?: any) => {
    // 현재 가격설정에서 가격 우선 조회, 없으면 content management, 마지막으로 fallback
    const product0PriceSetting = settings?.find(s => s.key === "product_0Price");
    const product1PriceSetting = settings?.find(s => s.key === "product_1Price");
    const product2PriceSetting = settings?.find(s => s.key === "product_2Price");
    const product3PriceSetting = settings?.find(s => s.key === "product_3Price");
    
    const productNames = dashboardContent?.productNames || [];
    
    const smallBoxPrice = product0PriceSetting ? parseInt(product0PriceSetting.value) :
                          (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
    const largeBoxPrice = product1PriceSetting ? parseInt(product1PriceSetting.value) :
                          (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
    const wrappingPrice = (product2PriceSetting ? parseInt(product2PriceSetting.value) :
                          (product3PriceSetting ? parseInt(product3PriceSetting.value) :
                          (productNames[2]?.price ? parseInt(productNames[2].price) : 1000)));
    
    let total = (order.smallBoxQuantity * smallBoxPrice) +
                (order.largeBoxQuantity * largeBoxPrice) +
                (order.wrappingQuantity * wrappingPrice);
    
    // 동적 상품 가격 추가 (현재 가격설정 사용)
    if (order.dynamicProductQuantities) {
      try {
        const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
          ? JSON.parse(order.dynamicProductQuantities) 
          : order.dynamicProductQuantities;
        
        Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
          const idx = parseInt(index);
          const qty = Number(quantity);
          if (qty > 0 && idx >= 3) {
            const productPriceSetting = settings?.find(s => s.key === `product_${idx}Price`);
            const dynamicPrice = productPriceSetting ? parseInt(productPriceSetting.value) : 0;
            total += qty * dynamicPrice;
          }
        });
      } catch (error) {
        console.error('동적 상품 가격 계산 오류:', error);
      }
    }
    
    return total + (order.shippingFee || 0);
  };
  
  const recalculatedTotal = calculateRecalculatedTotal(order, settings, dashboardContent);
  const [actualPaidAmount, setActualPaidAmount] = useState(order.actualPaidAmount?.toString() || recalculatedTotal.toString());
  const [discountAmount, setDiscountAmount] = useState(order.discountAmount?.toString() || "0");

  const formatPriceLocal = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price) || price < 0) return '0원';
    return `${Math.round(price).toLocaleString()}원`;
  };

  const handleSubmit = () => {
    const paidAmount = Number(actualPaidAmount);
    const discount = Number(discountAmount);
    
    if (isNaN(paidAmount) || paidAmount < 0) {
      alert('올바른 입금액을 입력해주세요.');
      return;
    }
    
    if (isNaN(discount) || discount < 0) {
      alert('올바른 할인액을 입력해주세요.');
      return;
    }
    
    onUpdate(order.id, 'confirmed', paidAmount, discount);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>입금 내역 입력</DialogTitle>
          <DialogDescription>
            주문번호: {order.orderNumber} | 총 주문금액: {formatPriceLocal(recalculatedTotal)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="actualPaidAmount">실제 입금액</Label>
            <Input
              id="actualPaidAmount"
              type="number"
              value={actualPaidAmount}
              onChange={(e) => setActualPaidAmount(e.target.value)}
              placeholder="실제 입금된 금액을 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="discountAmount">할인액 (선택사항)</Label>
            <Input
              id="discountAmount"
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="할인 금액이 있으면 입력하세요"
            />
          </div>
          <div className="text-sm text-gray-600">
            <div>실입금: {formatPriceLocal(Number(actualPaidAmount) || 0)}</div>
            <div>할인액: {formatPriceLocal(Number(discountAmount) || 0)}</div>
            <div className="font-medium">
              미입금: {formatPriceLocal(Math.max(0, recalculatedTotal - (Number(actualPaidAmount) || 0) - (Number(discountAmount) || 0)))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">
              확인
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Admin Info Settings Dialog Component
function AdminInfoSettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: adminSettings } = useQuery<any>({
    queryKey: ["/api/admin-settings"],
  });
  
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  
  // Load existing settings when dialog opens
  useEffect(() => {
    if (adminSettings) {
      setAdminName(adminSettings.adminName || "");
      setAdminPhone(adminSettings.adminPhone || "");
      setBusinessName(adminSettings.businessName || "에덴한과");
      setBusinessAddress(adminSettings.businessAddress || "");
      setBusinessPhone(adminSettings.businessPhone || "");
      setBankAccount(adminSettings.bankAccount || "농협 352-1701-3342-63 (예금주: 손*진)");
    }
  }, [adminSettings]);
  
  const updateAdminMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('관리자 정보 업데이트 실패');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-settings"] });
      toast({
        title: "관리자 정보 업데이트 완료",
        description: "관리자 정보가 성공적으로 업데이트되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "관리자 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = async () => {
    if (!adminName || !adminPhone || !businessName) {
      toast({
        title: "입력 오류",
        description: "관리자명, 전화번호, 사업체명은 필수 항목입니다.",
        variant: "destructive",
      });
      return;
    }
    
    updateAdminMutation.mutate({
      adminName,
      adminPhone,
      businessName,
      businessAddress,
      businessPhone,
      bankAccount
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          관리자 정보
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>관리자 정보 설정</DialogTitle>
          <DialogDescription>
            관리자 및 사업체 정보를 설정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="adminName">관리자명 *</Label>
            <Input
              id="adminName"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="관리자 이름을 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="adminPhone">관리자 전화번호 *</Label>
            <Input
              id="adminPhone"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
          <div>
            <Label htmlFor="businessName">사업체명 *</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="사업체 이름을 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="businessAddress">사업체 주소</Label>
            <Input
              id="businessAddress"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="사업체 주소를 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="businessPhone">사업체 전화번호</Label>
            <Input
              id="businessPhone"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="사업체 전화번호를 입력하세요"
            />
          </div>
          <div>
            <Label htmlFor="bankAccount">계좌 정보</Label>
            <Input
              id="bankAccount"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="은행명 계좌번호 (예금주명)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateAdminMutation.isPending}
          >
            {updateAdminMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



// Price Settings Dialog Component
function PriceSettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // Fetch dashboard content for dynamic products
  const { data: contentData } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Convert array to object for easier access
  const dashboardContent = Array.isArray(contentData) ? contentData.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {}) : {};

  // Parse product names safely and get current products
  const getCurrentProducts = () => {
    try {
      if (!dashboardContent.productNames) return [];
      if (typeof dashboardContent.productNames === 'string') {
        return JSON.parse(dashboardContent.productNames);
      }
      return Array.isArray(dashboardContent.productNames) ? dashboardContent.productNames : [];
    } catch (error) {
      console.error('Error parsing product names:', error);
      return [];
    }
  };

  const currentProducts = getCurrentProducts();
  const [localProductNames, setLocalProductNames] = useState<any[]>([]);

  // Update local state when dashboard content changes
  useEffect(() => {
    const products = getCurrentProducts();
    setLocalProductNames(products);
  }, [contentData]);

  // Content management focuses on product names only
  // Price and cost management is handled in the "가격 설정" tab
  
  // Product price states
  const [productPrices, setProductPrices] = useState<{[key: string]: {cost: string, price: string, excludeFromShipping?: boolean}}>({});
  const [savingPrices, setSavingPrices] = useState<{[key: string]: boolean}>({});
  
  // Shipping settings
  const [shippingFee, setShippingFee] = useState("");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("");
  const [freeShippingType, setFreeShippingType] = useState("quantity"); // 'quantity' or 'amount'
  const [freeShippingMinAmount, setFreeShippingMinAmount] = useState("");
  
  // Load existing settings when dialog opens
  useEffect(() => {
    if (settings) {
      const shippingFeeSetting = settings.find(s => s.key === "shippingFee");
      const thresholdSetting = settings.find(s => s.key === "freeShippingThreshold");
      
      const freeShippingTypeSetting = settings.find(s => s.key === "freeShippingType");
      const freeShippingMinAmountSetting = settings.find(s => s.key === "freeShippingMinAmount");
      
      setShippingFee(shippingFeeSetting?.value || "");
      setFreeShippingThreshold(thresholdSetting?.value || "");
      setFreeShippingType(freeShippingTypeSetting?.value || "quantity");
      setFreeShippingMinAmount(freeShippingMinAmountSetting?.value || "");
      
      // Load product prices, preserving current input but adding new products
      setProductPrices(prevPrices => {
        const newProductPrices: {[key: string]: {cost: string, price: string, excludeFromShipping?: boolean}} = { ...prevPrices };
        
        localProductNames.forEach((product: any, index: number) => {
          const productKey = product.key || `product_${index}`;
          
          // Only add if this product doesn't already exist in state
          if (!newProductPrices[productKey]) {
            const costSetting = settings.find(s => s.key === `${productKey}Cost`);
            const priceSetting = settings.find(s => s.key === `${productKey}Price`);
            
            const excludeSetting = settings.find(s => s.key === `${productKey}ExcludeFromShipping`);
            
            newProductPrices[productKey] = {
              cost: costSetting?.value || "",
              price: priceSetting?.value || "",
              excludeFromShipping: excludeSetting?.value === 'true'
            };
          }
        });
        
        return newProductPrices;
      });
    }
  }, [settings, localProductNames]);
  
  const updateShippingMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description: string }) => {
      return await api.settings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "설정 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Individual price save mutation with cache invalidation for bulk save
  const saveIndividualPriceMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; description: string }) => {
      return await api.settings.create(data);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "설정 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Individual price save function
  const saveIndividualPrice = async (productKey: string, priceType: 'cost' | 'price', value: string, productName: string) => {
    const saveKey = `${productKey}-${priceType}`;
    if (savingPrices[saveKey]) return;
    
    setSavingPrices(prev => ({...prev, [saveKey]: true}));
    
    try {
      await saveIndividualPriceMutation.mutateAsync({
        key: `${productKey}${priceType === 'cost' ? 'Cost' : 'Price'}`,
        value: value,
        description: `${productName} ${priceType === 'cost' ? '원가' : '판매가'}`
      });
      
      toast({
        title: "저장 완료",
        description: `${productName}의 ${priceType === 'cost' ? '원가' : '판매가'}가 저장되었습니다.`,
      });
    } catch (error) {
      toast({
        title: "저장 실패",
        description: "저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setSavingPrices(prev => ({...prev, [saveKey]: false}));
    }
  };

  // Bulk save all prices
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  
  const saveAllPrices = async () => {
    if (isBulkSaving) return;
    
    setIsBulkSaving(true);
    
    try {
      const savePromises: Promise<any>[] = [];
      
      // Collect all prices to save from all products
      localProductNames.forEach((product: any, index: number) => {
        const productKey = product.key || `product_${index}`;
        const prices = productPrices[productKey];
        
        if (prices) {
          // Save cost if it has a value
          if (prices.cost && prices.cost.trim() !== "") {
            savePromises.push(
              saveIndividualPriceMutation.mutateAsync({
                key: `${productKey}Cost`,
                value: prices.cost.trim(),
                description: `${product.name} 원가`
              })
            );
          }
          
          // Save price if it has a value
          if (prices.price && prices.price.trim() !== "") {
            savePromises.push(
              saveIndividualPriceMutation.mutateAsync({
                key: `${productKey}Price`,
                value: prices.price.trim(),
                description: `${product.name} 판매가`
              })
            );
          }
        }
      });
      
      if (savePromises.length === 0) {
        toast({
          title: "저장할 가격 없음",
          description: "입력된 가격 정보가 없습니다. 가격을 먼저 입력해주세요.",
          variant: "destructive"
        });
        return;
      }
      
      // Execute all save operations
      await Promise.all(savePromises);
      
      toast({
        title: "일괄 저장 완료",
        description: `총 ${savePromises.length}개의 가격 정보가 저장되었습니다.`,
      });
      
      // Don't clear the product prices - keep the current input values
      
    } catch (error) {
      console.error("일괄 저장 오류:", error);
      toast({
        title: "일괄 저장 실패",
        description: "일부 가격 저장에 실패했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsBulkSaving(false);
    }
  };
  
  const handleSave = async () => {
    if (!shippingFee || (freeShippingType === 'quantity' && !freeShippingThreshold) || (freeShippingType === 'amount' && !freeShippingMinAmount)) {
      toast({
        title: "입력 오류",
        description: "배송비 설정 정보를 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const savePromises = [
        updateShippingMutation.mutateAsync({
          key: "shippingFee",
          value: shippingFee,
          description: "배송비"
        }),
        updateShippingMutation.mutateAsync({
          key: "freeShippingType",
          value: freeShippingType,
          description: "무료배송 조건 타입"
        })
      ];
      
      if (freeShippingType === 'quantity') {
        savePromises.push(updateShippingMutation.mutateAsync({
          key: "freeShippingThreshold",
          value: freeShippingThreshold,
          description: "무료배송 최소 수량"
        }));
      } else {
        savePromises.push(updateShippingMutation.mutateAsync({
          key: "freeShippingMinAmount",
          value: freeShippingMinAmount,
          description: "무료배송 최소 금액"
        }));
      }
      
      await Promise.all(savePromises);
      
      toast({
        title: "저장 완료",
        description: "배송비 설정이 저장되었습니다.",
      });
      
    } catch (error) {
      console.error("배송비 설정 저장 오류:", error);
      toast({
        title: "저장 실패",
        description: "배송비 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Cog className="w-4 h-4" />
          가격 설정
        </Button>
      </DialogTrigger>
      <DialogContent className="w-auto max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>가격 설정</DialogTitle>
          <DialogDescription>
            상품 원가, 판매가, 배송비 정책을 설정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-b border-gray-200 pb-4">
            <div className="mb-3">
              <h4 className="font-medium text-gray-900">상품 가격 관리</h4>
              <p className="text-sm text-gray-600">콘텐츠 관리에서 등록된 상품들의 가격과 원가를 설정합니다</p>
            </div>
            {localProductNames && localProductNames.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">각 상품별로 개별 저장하거나 전체 일괄 저장할 수 있습니다.</p>
                <div className="overflow-x-auto">
                  <table className="border border-gray-200 rounded-lg border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-800 border-b border-r">상품명</th>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-800 border-b border-r">원가 (원)</th>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-800 border-b border-r">판매가 (원)</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-gray-800 border-b">배송비 제외</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localProductNames.map((product: any, index: number) => {
                        const productKey = product.key || `product_${index}`;
                        return (
                          <tr key={index} className="hover:bg-gray-50 transition-colors duration-150 border-b last:border-b-0">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r align-top whitespace-nowrap">
                              {product.name}
                            </td>
                            <td className="px-3 py-2 border-r align-top">
                              <div className="flex gap-1 min-w-0">
                                <Input
                                  type="number"
                                  placeholder="원가"
                                  value={productPrices[productKey]?.cost || ""}
                                  onChange={(e) => setProductPrices(prev => ({
                                    ...prev,
                                    [productKey]: {
                                      cost: e.target.value,
                                      price: prev[productKey]?.price || "",
                                      excludeFromShipping: prev[productKey]?.excludeFromShipping || false
                                    }
                                  }))}
                                  className="w-20 text-sm h-7"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => saveIndividualPrice(
                                    productKey, 
                                    'cost', 
                                    productPrices[productKey]?.cost || "", 
                                    product.name
                                  )}
                                  disabled={savingPrices[`${productKey}-cost`] || !productPrices[productKey]?.cost}
                                  variant="ghost"
                                  className="px-2 py-0 text-xs h-7 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 whitespace-nowrap"
                                >
                                  {savingPrices[`${productKey}-cost`] ? '저장중' : '저장'}
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2 border-r align-top">
                              <div className="flex gap-1 min-w-0">
                                <Input
                                  type="number"
                                  placeholder="판매가"
                                  value={productPrices[productKey]?.price || ""}
                                  onChange={(e) => setProductPrices(prev => ({
                                    ...prev,
                                    [productKey]: {
                                      cost: prev[productKey]?.cost || "",
                                      price: e.target.value,
                                      excludeFromShipping: prev[productKey]?.excludeFromShipping || false
                                    }
                                  }))}
                                  className="w-20 text-sm h-7"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => saveIndividualPrice(
                                    productKey, 
                                    'price', 
                                    productPrices[productKey]?.price || "", 
                                    product.name
                                  )}
                                  disabled={savingPrices[`${productKey}-price`] || !productPrices[productKey]?.price}
                                  variant="ghost"
                                  className="px-2 py-0 text-xs h-7 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 whitespace-nowrap"
                                >
                                  {savingPrices[`${productKey}-price`] ? '저장중' : '저장'}
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={productPrices[productKey]?.excludeFromShipping || false}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setProductPrices(prev => ({
                                      ...prev,
                                      [productKey]: {
                                        cost: prev[productKey]?.cost || "",
                                        price: prev[productKey]?.price || "",
                                        excludeFromShipping: newValue
                                      }
                                    }));
                                    // Save immediately
                                    updateShippingMutation.mutate({ 
                                      key: `${productKey}ExcludeFromShipping`, 
                                      value: newValue.toString(),
                                      description: `${product.name} 배송비 제외 설정`
                                    });
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {productPrices[productKey]?.excludeFromShipping ? "제외" : "포함"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={saveAllPrices}
                    disabled={isBulkSaving}
                    variant="ghost"
                    className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                  >
                    {isBulkSaving ? "일괄 저장 중..." : "전체 일괄 저장"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <p className="text-base">등록된 상품이 없습니다.</p>
                <p className="text-sm mt-1">콘텐츠 관리에서 상품을 등록해주세요.</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3">
              <h4 className="font-medium text-gray-900">배송비 설정</h4>
              <p className="text-sm text-gray-600">주문 폼의 배송비 계산에 적용됩니다</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="shippingFee">배송비</Label>
                <Input
                  id="shippingFee"
                  type="number"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="배송비 입력 (원)"
                />
              </div>
              <div>
                <Label htmlFor="freeShippingType">무료배송 조건</Label>
                <select
                  id="freeShippingType"
                  value={freeShippingType}
                  onChange={(e) => setFreeShippingType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="quantity">수량 기준</option>
                  <option value="amount">금액 기준</option>
                </select>
              </div>
              {freeShippingType === 'quantity' ? (
                <div>
                  <Label htmlFor="freeShippingThreshold">무료배송 최소 수량</Label>
                  <Input
                    id="freeShippingThreshold"
                    type="number"
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    placeholder="개수 입력"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="freeShippingMinAmount">무료배송 최소 금액</Label>
                  <Input
                    id="freeShippingMinAmount"
                    type="number"
                    value={freeShippingMinAmount}
                    onChange={(e) => setFreeShippingMinAmount(e.target.value)}
                    placeholder="금액 입력 (원)"
                  />
                </div>
              )}

            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateShippingMutation.isPending}
          >
            {updateShippingMutation.isPending ? "배송비 저장 중..." : "배송비 저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Payment Confirmation Dialog Component
function PaymentConfirmDialog({ 
  order, 
  open, 
  setOpen, 
  onConfirm 
}: { 
  order: Order | null; 
  open: boolean; 
  setOpen: (open: boolean) => void;
  onConfirm: (actualPaidAmount: number, discountReason: string) => void;
}) {
  // settings와 dashboardContent 데이터 가져오기 (매출내역과 동일한 방식)
  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });
  const { data: dashboardContent } = useQuery<any>({
    queryKey: ["/api/dashboard-content"],
  });
  
  const [actualPaidAmount, setActualPaidAmount] = useState("");
  const [discountType, setDiscountType] = useState("partial"); // "partial" or "discount"
  
  const handleConfirm = () => {
    const amount = parseInt(actualPaidAmount);
    if (isNaN(amount) || amount < 0) {
      return;
    }

    const expectedAmount = order?.totalAmount || 0;
    const difference = expectedAmount - amount;
    
    let discountReason = "";
    if (difference > 0) {
      if (discountType === "partial") {
        discountReason = `부분미입금 (미입금: ${difference.toLocaleString()}원)`;
      } else {
        discountReason = `할인 (할인금액: ${difference.toLocaleString()}원)`;
      }
    } else if (difference < 0) {
      discountReason = `과납입 (${Math.abs(difference).toLocaleString()}원 추가 입금)`;
    }

    onConfirm(amount, discountReason);
    setActualPaidAmount("");
    setDiscountType("partial");
    setOpen(false);
  };

  if (!order) return null;

  // 매출내역과 동일한 방식으로 총 주문금액 계산 (현재 가격설정 우선 사용)
  const calculateOrderTotal = (order: Order, settings?: any[], dashboardContent?: any) => {
    // 현재 가격설정에서 가격 우선 조회, 없으면 content management, 마지막으로 fallback
    const product0PriceSetting = settings?.find(s => s.key === "product_0Price");
    const product1PriceSetting = settings?.find(s => s.key === "product_1Price");
    const product2PriceSetting = settings?.find(s => s.key === "product_2Price");
    const product3PriceSetting = settings?.find(s => s.key === "product_3Price");
    
    const productNames = dashboardContent?.productNames || [];
    
    const smallBoxPrice = product0PriceSetting ? parseInt(product0PriceSetting.value) :
                          (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
    const largeBoxPrice = product1PriceSetting ? parseInt(product1PriceSetting.value) :
                          (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
    const wrappingPrice = (product2PriceSetting ? parseInt(product2PriceSetting.value) :
                          (product3PriceSetting ? parseInt(product3PriceSetting.value) :
                          (productNames[2]?.price ? parseInt(productNames[2].price) : 1000)));
    
    let total = (order.smallBoxQuantity * smallBoxPrice) +
                (order.largeBoxQuantity * largeBoxPrice) +
                (order.wrappingQuantity * wrappingPrice);
    
    // 동적 상품 가격 추가 (현재 가격설정 사용)
    if (order.dynamicProductQuantities) {
      try {
        const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
          ? JSON.parse(order.dynamicProductQuantities) 
          : order.dynamicProductQuantities;
        
        Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
          const idx = parseInt(index);
          const qty = Number(quantity);
          if (qty > 0 && idx >= 3) {
            const productPriceSetting = settings?.find(s => s.key === `product_${idx}Price`);
            const dynamicPrice = productPriceSetting ? parseInt(productPriceSetting.value) : 0;
            total += qty * dynamicPrice;
          }
        });
      } catch (error) {
        console.error('동적 상품 가격 계산 오류:', error);
      }
    }
    
    return total + (order.shippingFee || 0);
  };

  const expectedAmount = calculateOrderTotal(order, settings, dashboardContent);
  const paidAmount = parseInt(actualPaidAmount) || 0;
  const difference = expectedAmount - paidAmount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>입금 확인</DialogTitle>
          <DialogDescription>
            실제 입금된 금액을 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-md">
            <div className="text-sm space-y-1">
              <div><strong>주문번호:</strong> {order.orderNumber}</div>
              <div><strong>고객명:</strong> {order.customerName}</div>
              <div><strong>주문금액:</strong> {expectedAmount.toLocaleString()}원</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="actualPaidAmount">실제 입금금액</Label>
            <Input
              id="actualPaidAmount"
              type="number"
              placeholder="실제 입금된 금액을 입력하세요"
              value={actualPaidAmount}
              onChange={(e) => setActualPaidAmount(e.target.value)}
            />
          </div>
          
          {actualPaidAmount && difference > 0 && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-md border">
                <div className="text-sm">
                  <div className="text-gray-700 font-medium">
                    미입금: {difference.toLocaleString()}원
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>미입금 사유 선택</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partial">부분미입금 (고객이 부분적으로만 입금)</SelectItem>
                    <SelectItem value="discount">할인 (의도적인 할인 적용)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {actualPaidAmount && difference < 0 && (
            <div className="p-3 bg-gray-50 rounded-md border">
              <div className="text-sm">
                <div className="text-gray-700 font-medium">
                  과납입: {Math.abs(difference).toLocaleString()}원
                </div>
              </div>
            </div>
          )}
          
          {actualPaidAmount && difference === 0 && (
            <div className="p-3 bg-gray-50 rounded-md border">
              <div className="text-sm">
                <div className="text-gray-700 font-medium">
                  정확한 금액 입금
                </div>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            <div>계좌: 농협 352-1701-3342-63 (예금주: 손*진)</div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setOpen(false);
                setActualPaidAmount("");
                setDiscountType("partial");
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!actualPaidAmount || paidAmount < 0}
              className="flex-1"
            >
              입금 확인
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);

  const [selectedTrashItems, setSelectedTrashItems] = useState<Set<number>>(new Set());
  const [selectedShippingItems, setSelectedShippingItems] = useState<Set<number>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  
  // 개별 저장 버튼 로딩 상태
  const [savingButtons, setSavingButtons] = useState<{[key: string]: boolean}>({});
  
  // 보안 관련 상태
  const [newIpRange, setNewIpRange] = useState("");
  const [newCountry, setNewCountry] = useState("");

  // Dashboard content management state
  const [dashboardContent, setDashboardContent] = useState({
    smallBoxName: "한과1호(약 1.1kg) 약 35.5×21×11.2cm",
    largeBoxName: "한과2호(약 2kg) 약 50×25×15cm",
    smallBoxDimensions: "약 35.5×21×11.2cm",
    largeBoxDimensions: "약 37×23×11.5cm",
    wrappingName: "보자기",
    wrappingPrice: "개당 +1,000원",
    wrappingPriceAmount: "1000",
    wrappingCost: "200",
    mainTitle: "이든 한과",
    mainDescription: "전통 한과를 맛보세요",
    heroImages: [] as string[],
    aboutText: "이든 한과는 전통 방식으로 만든 건강한 한과입니다.",
    bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)",
    bankMessage: "주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다",
    shippingInfo: "• 물건은 입금 확인 후 1~2일 이내 발송합니다.\n• 설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.\n• 주문 접수 후 3일 이내 미도착시 반드시 연락주세요.\n• 설날 명절 2주 전에는 미리 주문 부탁드려요.\n• 미리 주문 시 예약발송 가능합니다.",
    shippingTitle: "에덴한과 배송",
    productNames: [
      { name: '한과1호', price: '20000', cost: '5000', size: '(10cm × 7cm × 7cm)', weight: '300g' },
      { name: '한과2호', price: '30000', cost: '7000', size: '(14.5cm × 7cm × 7cm)', weight: '450g' }
    ],
    excludeWrappingFromShipping: false,
    logoUrl: ""
  });

  // Handle multiple image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check total images limit (max 8)
    if (dashboardContent.heroImages.length + files.length > 8) {
      toast({ 
        title: "이미지 개수 제한", 
        description: "최대 8개의 이미지까지 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({ 
          title: "파일 크기 오류", 
          description: `${file.name}: 이미지 파일은 5MB 이하여야 합니다.`,
          variant: "destructive"
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({ 
          title: "파일 형식 오류", 
          description: `${file.name}: 이미지 파일만 업로드 가능합니다.`,
          variant: "destructive"
        });
        return;
      }
    }

    try {
      // Show loading state
      toast({ title: "이미지 업로드 중..." });

      // Process files with compression
      const newImages: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Compress image before processing
        const compressedImageUrl = await new Promise<string>((resolve, reject) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            // Set max dimensions to reduce file size
            const maxWidth = 800;
            const maxHeight = 600;
            let { width, height } = img;
            
            // Calculate new dimensions
            if (width > height) {
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx?.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
            resolve(compressedDataUrl);
          };
          
          img.onerror = () => {
            // Fallback to original if compression fails
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          };
          
          const reader = new FileReader();
          reader.onload = (e) => {
            img.src = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
        
        newImages.push(compressedImageUrl);
      }

      // Update state and save to database
      const updatedImages = [...dashboardContent.heroImages, ...newImages];
      setDashboardContent({...dashboardContent, heroImages: updatedImages});
      
      try {
        await updateContentMutation.mutateAsync({ 
          key: 'heroImages', 
          value: JSON.stringify(updatedImages) 
        });
        toast({ title: `${files.length}개 이미지가 업로드되었습니다.` });
      } catch (dbError) {
        console.error('Database save error:', dbError);
        toast({ 
          title: "저장 실패", 
          description: "이미지가 압축되었지만 저장에 실패했습니다. 이미지 크기를 줄여보세요.",
          variant: "destructive"
        });
      }

      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      console.error('Image upload error:', error);
      toast({ 
        title: "업로드 실패", 
        description: "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Remove image function
  const removeImage = (index: number) => {
    const updatedImages = dashboardContent.heroImages.filter((_, i) => i !== index);
    setDashboardContent({...dashboardContent, heroImages: updatedImages});
    updateContentMutation.mutate({ key: 'heroImages', value: JSON.stringify(updatedImages) });
    toast({ title: "이미지가 삭제되었습니다." });
  };

  // Fetch dashboard content
  const { data: contentData } = useQuery<DashboardContent[]>({
    queryKey: ["/api/dashboard-content"],
  });

  // Load dashboard content from API
  useEffect(() => {
    if (contentData) {
      const updatedContent = { ...dashboardContent };
      contentData.forEach(item => {
        if (item.key === 'smallBoxName') updatedContent.smallBoxName = item.value;
        if (item.key === 'largeBoxName') updatedContent.largeBoxName = item.value;
        if (item.key === 'smallBoxDimensions') updatedContent.smallBoxDimensions = item.value;
        if (item.key === 'largeBoxDimensions') updatedContent.largeBoxDimensions = item.value;
        if (item.key === 'wrappingName') updatedContent.wrappingName = item.value;
        if (item.key === 'wrappingPrice') updatedContent.wrappingPrice = item.value;
        if (item.key === 'wrappingPriceAmount') updatedContent.wrappingPriceAmount = item.value;
        if (item.key === 'wrappingCost') updatedContent.wrappingCost = item.value;
        if (item.key === 'mainTitle') updatedContent.mainTitle = item.value;
        if (item.key === 'mainDescription') updatedContent.mainDescription = item.value;
        if (item.key === 'heroImages') {
          try {
            updatedContent.heroImages = JSON.parse(item.value || '[]');
          } catch {
            updatedContent.heroImages = [];
          }
        }
        // Legacy heroImageUrl support - convert to heroImages array
        if (item.key === 'heroImageUrl' && item.value && !updatedContent.heroImages?.length) {
          updatedContent.heroImages = [item.value];
        }
        if (item.key === 'aboutText') updatedContent.aboutText = item.value;
        if (item.key === 'bankAccount') updatedContent.bankAccount = item.value;
        if (item.key === 'bankMessage') updatedContent.bankMessage = item.value;
        if (item.key === 'shippingInfo') updatedContent.shippingInfo = item.value;
        if (item.key === 'shippingTitle') updatedContent.shippingTitle = item.value;
        if (item.key === 'productNames') {
          try {
            updatedContent.productNames = JSON.parse(item.value || '[]');
          } catch {
            updatedContent.productNames = [
              { name: '한과1호', price: '20000', cost: '5000', size: '(10cm × 7cm × 7cm)', weight: '300g' },
              { name: '한과2호', price: '30000', cost: '7000', size: '(14.5cm × 7cm × 7cm)', weight: '450g' }
            ];
          }
        }
        if (item.key === 'excludeWrappingFromShipping') updatedContent.excludeWrappingFromShipping = item.value === 'true';
        if (item.key === 'logoUrl') updatedContent.logoUrl = item.value;
      });
      setDashboardContent(updatedContent);
    }
  }, [contentData]);

  // Dashboard content mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ key, value, type = 'text' }: { key: string; value: string; type?: string }) => {
      const response = await fetch(`/api/dashboard-content/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value, type })
      });
      if (!response.ok) throw new Error('Content update failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-content"] });
      toast({
        title: "콘텐츠 업데이트 완료",
        description: "대시보드 콘텐츠가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "콘텐츠 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });
  
  const [selectedOrderItems, setSelectedOrderItems] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');

  // 주문 확장/축소 토글
  const toggleOrderExpansion = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };
  const [endDate, setEndDate] = useState<string>('');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [sellerShippedFilter, setSellerShippedFilter] = useState<string>('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [showPaymentDetailsDialog, setShowPaymentDetailsDialog] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'delivery-date' | 'scheduled-date' | 'order-status' | 'payment-status' | 'order-number'>('latest');
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});

  // Clear selections when switching tabs
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSelectedOrderItems(new Set());
    setSelectedTrashItems(new Set());
  };

  const handleLogout = () => {
    logout();
  };

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: () => api.orders.getAll(),
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch settings for cost calculations
  const { data: settings } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // 보안 관련 쿼리들
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<UserSession[]>({
    queryKey: ['/api/auth/sessions'],
    refetchInterval: 30000, // 30초마다 자동 새로고침
  });

  const { data: loginHistory = [], isLoading: historyLoading } = useQuery<LoginAttempt[]>({
    queryKey: ['/api/auth/login-history'],
  });

  const { data: approvalRequests = [], isLoading: approvalRequestsLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/auth/approval-requests'],
    refetchInterval: 10000, // 10초마다 자동 새로고침
  });

  const { data: accessSettings, isLoading: settingsLoading } = useQuery<AccessControlSettings>({
    queryKey: ['/api/auth/access-control'],
  });

  // 보안 관련 mutations
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('세션 종료에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
      toast({
        title: "세션 종료 완료",
        description: "해당 세션이 성공적으로 종료되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "세션 종료 실패",
        description: "세션 종료 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateAccessSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const response = await fetch('/api/auth/access-control', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
      
      if (!response.ok) {
        throw new Error('접근 제어 설정 업데이트에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/access-control'] });
      toast({
        title: "설정 업데이트 완료",
        description: "접근 제어 설정이 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "설정 업데이트 실패",
        description: "접근 제어 설정 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 보안 관련 helper functions
  const updateSetting = (key: string, value: any) => {
    updateAccessSettingMutation.mutate({ key, value });
  };

  const addIpRange = () => {
    if (!newIpRange.trim()) return;
    
    const currentRanges = accessSettings?.allowedIpRanges || [];
    const newRanges = [...currentRanges, newIpRange.trim()];
    updateSetting('allowedIpRanges', newRanges);
    setNewIpRange('');
  };

  const removeIpRange = (index: number) => {
    const currentRanges = accessSettings?.allowedIpRanges || [];
    const newRanges = currentRanges.filter((_, i) => i !== index);
    updateSetting('allowedIpRanges', newRanges);
  };

  // Fetch deleted orders (trash)
  const { data: deletedOrders = [], isLoading: isLoadingTrash, error: trashError } = useQuery({
    queryKey: ['/api/orders/trash'],
    queryFn: () => api.orders.getTrash(),
    enabled: true, // Always load trash data for tab counter
    retry: 3,
    refetchInterval: activeTab === "trash" ? 5000 : false, // Only auto-refresh when trash tab is active
  });

  // Restore order mutation
  const restoreOrderMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.restore(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      toast({
        title: "주문 복구 완료",
        description: "주문이 성공적으로 복구되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "복구 실패",
        description: "주문 복구에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Soft delete mutation
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "주문 삭제",
        description: "주문이 휴지통으로 이동되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "주문 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Permanent delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: (orderId: number) => api.orders.permanentDelete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      toast({
        title: "영구 삭제 완료",
        description: "주문이 영구적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "영구 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Bulk permanent delete mutation
  const bulkPermanentDeleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const deletePromises = orderIds.map(id => api.orders.permanentDelete(id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/trash'] });
      setSelectedTrashItems(new Set());
      toast({
        title: "영구 삭제 완료",
        description: `선택된 ${selectedTrashItems.size}개 주문이 영구적으로 삭제되었습니다.`,
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "일괄 영구 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const deletePromises = orderIds.map(id => api.orders.delete(id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedOrderItems(new Set());
      toast({
        title: "삭제 완료",
        description: `선택된 ${selectedOrderItems.size}개 주문이 삭제되었습니다.`,
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "일괄 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });



  // Toggle selection for trash items
  const toggleTrashSelection = (orderId: number) => {
    const newSelection = new Set(selectedTrashItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedTrashItems(newSelection);
  };

  // Select all trash items
  const selectAllTrash = () => {
    const allIds = new Set<number>(deletedOrders.map((order: Order) => order.id));
    setSelectedTrashItems(allIds);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedTrashItems(new Set());
    setSelectedOrderItems(new Set());
    setSelectedShippingItems(new Set());
  };

  // Order selection functions
  const toggleOrderSelection = (orderId: number) => {
    const newSelection = new Set(selectedOrderItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrderItems(newSelection);
  };

  const selectAllOrders = (ordersList: Order[]) => {
    const allIds = new Set(ordersList.map(order => order.id));
    setSelectedOrderItems(allIds);
  };

  // Handle bulk permanent delete
  const handleBulkPermanentDelete = () => {
    if (selectedTrashItems.size === 0) return;
    
    if (confirm(`선택된 ${selectedTrashItems.size}개 주문을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      bulkPermanentDeleteMutation.mutate(Array.from(selectedTrashItems));
    }
  };

  // 주문을 상품별로 분리하는 함수
  const expandOrdersToProducts = (orders: Order[]) => {
    // 동적 상품 이름 가져오기 함수
    const getProductName = (index: number) => {
      try {
        const productNames = Array.isArray(dashboardContent.productNames) 
          ? dashboardContent.productNames 
          : JSON.parse(dashboardContent.productNames || '[]');
        
        if (productNames[index] && productNames[index].name) {
          return productNames[index].name;
        }
        
        // 기본값 반환
        if (index === 0) return '한과1호';
        if (index === 1) return '한과2호';
        if (index === 2) return '보자기';
        return `상품${index + 1}`;
      } catch (error) {
        console.error('상품명 파싱 오류:', error);
        if (index === 0) return '한과1호';
        if (index === 1) return '한과2호';
        if (index === 2) return '보자기';
        return `상품${index + 1}`;
      }
    };

    const expandedItems: Array<{
      orderId: number;
      order: Order;
      productName: string;
      quantity: number;
      productIndex: number;
      isFirst: boolean;
      rowSpan: number;
    }> = [];

    orders.forEach(order => {
      const products: Array<{ name: string; quantity: number; index: number }> = [];

      // 기본 상품들 추가
      if (order.smallBoxQuantity > 0) {
        products.push({
          name: getProductName(0),
          quantity: order.smallBoxQuantity,
          index: 0
        });
      }
      if (order.largeBoxQuantity > 0) {
        products.push({
          name: getProductName(1),
          quantity: order.largeBoxQuantity,
          index: 1
        });
      }
      if (order.wrappingQuantity > 0) {
        products.push({
          name: getProductName(2),
          quantity: order.wrappingQuantity,
          index: 2
        });
      }

      // 동적 상품들 추가
      if (order.dynamicProductQuantities) {
        try {
          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
            ? JSON.parse(order.dynamicProductQuantities) 
            : order.dynamicProductQuantities;
          
          Object.entries(dynamicQty || {}).forEach(([index, quantity]: [string, any]) => {
            const productIndex = parseInt(index);
            const qty = Number(quantity);
            if (qty > 0 && productIndex >= 3) {
              products.push({
                name: getProductName(productIndex),
                quantity: qty,
                index: productIndex
              });
            }
          });
        } catch (error) {
          console.error('Dynamic product quantities parse error:', error);
        }
      }

      // 상품이 있으면 각각을 별도 행으로 추가
      if (products.length > 0) {
        const rowSpan = products.length;
        products.forEach((product, index) => {
          expandedItems.push({
            orderId: order.id,
            order,
            productName: product.name,
            quantity: product.quantity,
            productIndex: product.index,
            isFirst: index === 0,
            rowSpan: rowSpan
          });
        });
      }
    });

    return expandedItems;
  };

  // Excel export function for admin
  const exportToExcel = (ordersList: Order[], fileName: string) => {
    const excelData = ordersList.map(order => {
      // Get product costs from dashboard content first, fallback to settings
      const productNames = dashboardContent.productNames || [];
      const smallProductCost = productNames[0]?.cost ? parseInt(productNames[0].cost) : null;
      const largeProductCost = productNames[1]?.cost ? parseInt(productNames[1].cost) : null;
      const wrappingProductCost = dashboardContent.wrappingCost ? parseInt(dashboardContent.wrappingCost) : null;
      
      // Fallback to global cost settings if no product-specific cost
      const smallCostSetting = settings?.find((s: Setting) => s.key === "smallBoxCost");
      const largeCostSetting = settings?.find((s: Setting) => s.key === "largeBoxCost");
      const wrappingCostSetting = settings?.find((s: Setting) => s.key === "wrappingCost");
      
      // Use dynamic cost pricing from content management
      const smallCost = productNames[0]?.cost ? parseInt(productNames[0].cost) : 
                       (smallProductCost ?? (smallCostSetting ? parseInt(smallCostSetting.value) : 15000));
      const largeCost = productNames[1]?.cost ? parseInt(productNames[1].cost) : 
                       (largeProductCost ?? (largeCostSetting ? parseInt(largeCostSetting.value) : 16000));
      const wrappingCostValue = productNames[2]?.cost ? parseInt(productNames[2].cost) : 
                               (wrappingProductCost ?? (wrappingCostSetting ? parseInt(wrappingCostSetting.value) : 1000));
      
      // Calculate totals using prices from price settings first, then content management
      const product0PriceSetting = settings?.find((s: Setting) => s.key === "product_0Price");
      const product1PriceSetting = settings?.find((s: Setting) => s.key === "product_1Price");
      const product2PriceSetting = settings?.find((s: Setting) => s.key === "product_2Price");
      const product3PriceSetting = settings?.find((s: Setting) => s.key === "product_3Price");
      
      const smallBoxPrice = product0PriceSetting ? parseInt(product0PriceSetting.value) :
                            (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
      const largeBoxPrice = product1PriceSetting ? parseInt(product1PriceSetting.value) :
                            (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
      const wrappingPrice = (product2PriceSetting ? parseInt(product2PriceSetting.value) :
                            (product3PriceSetting ? parseInt(product3PriceSetting.value) :
                            (productNames[2]?.price ? parseInt(productNames[2].price) : 1000)));
      
      const smallBoxTotal = order.smallBoxQuantity * smallBoxPrice;
      const largeBoxTotal = order.largeBoxQuantity * largeBoxPrice;
      const wrappingTotal = order.wrappingQuantity * wrappingPrice;
      const totalItems = order.smallBoxQuantity + order.largeBoxQuantity;
      const shippingFee = totalItems >= 6 ? 0 : 4000;
      
      // Calculate costs
      const smallBoxesCost = order.smallBoxQuantity * smallCost;
      const largeBoxesCost = order.largeBoxQuantity * largeCost;
      const wrappingCost = order.wrappingQuantity * wrappingCostValue;
      const totalCost = smallBoxesCost + largeBoxesCost + wrappingCost;
      
      // Calculate total revenue (매출금액)
      const totalRevenue = smallBoxTotal + largeBoxTotal + wrappingTotal + shippingFee;
      
      // Calculate unpaid amount (미입금액)
      const unpaidAmount = (order.actualPaidAmount && order.actualPaidAmount < totalRevenue && !(order.discountAmount || 0)) 
        ? (totalRevenue - order.actualPaidAmount) : 0;
      
      // 순수익 = 매출금액 - 원가 - 할인금액 - 미입금액
      const netProfit = totalRevenue - totalCost - (order.discountAmount || 0) - unpaidAmount;
      
      return {
        '주문번호': order.orderNumber,
        '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
        '주문시간': new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        '고객명': order.customerName,
        '받는분': order.recipientName || order.customerName,
        '전화번호': order.customerPhone,
        '주소': `${order.address1} ${order.address2 || ''}`.trim(),
        '상품': [
          order.smallBoxQuantity > 0 ? `${getProductName(0, '한과1호')}×${order.smallBoxQuantity}개` : '',
          order.largeBoxQuantity > 0 ? `${getProductName(1, '한과2호')}×${order.largeBoxQuantity}개` : '',
          order.wrappingQuantity > 0 ? `${getProductName(2, '보자기')}×${order.wrappingQuantity}개` : '',
          ...(order.dynamicProductQuantities ? (() => {
            try {
              const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                ? JSON.parse(order.dynamicProductQuantities) 
                : order.dynamicProductQuantities;
              return Object.entries(dynamicQty || {}).map(([index, quantity]) => {
                const productIndex = parseInt(index);
                const qty = Number(quantity);
                const productName = getProductName(productIndex, `상품${productIndex + 1}`);
                return qty > 0 ? `${productName}×${qty}개` : '';
              }).filter(Boolean);
            } catch (error) {
              console.error('Dynamic product quantities parse error:', error);
              return [];
            }
          })() : [])
        ].filter(Boolean).join('\n'),
        '주문금액': order.totalAmount,
        '실입금액': order.actualPaidAmount || order.totalAmount,
        '할인금액': order.discountAmount || 0,
        '입금상태': order.paymentStatus === 'confirmed' ? '입금완료' : 
                   order.paymentStatus === 'partial' ? '부분결제' :
                   order.paymentStatus === 'refunded' ? '환불' : '입금대기',
        '주문상태': statusLabels[order.status as keyof typeof statusLabels],
        '발송상태': order.sellerShipped ? '발송완료' : '발송대기',
        '예약발송일': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('ko-KR') : '',
        '발송완료일': order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString('ko-KR') : '',
        '매니저발송일': order.sellerShippedDate ? new Date(order.sellerShippedDate).toLocaleDateString('ko-KR') : '',
        '원가합계': totalCost,
        '순수익': netProfit,
        '메모': order.specialRequests || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // 상품 컬럼에 줄바꿈 적용을 위한 스타일 설정
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const productColumnIndex = 7; // '상품' 컬럼은 8번째 (H열, 0-based로는 7)
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const productCellAddress = XLSX.utils.encode_cell({ r: R, c: productColumnIndex });
      if (ws[productCellAddress] && ws[productCellAddress].v) {
        // 줄바꿈 문자를 엑셀 내부 형식으로 변경
        const cellValue = ws[productCellAddress].v.toString().replace(/\n/g, String.fromCharCode(10));
        ws[productCellAddress].v = cellValue;
        ws[productCellAddress].t = 's'; // 문자열 타입으로 명시적 설정
        
        if (!ws[productCellAddress].s) ws[productCellAddress].s = {};
        ws[productCellAddress].s.alignment = { 
          wrapText: true, 
          vertical: 'top',
          horizontal: 'left'
        };
      }
    }
    
    // 행 높이 설정 (줄바꿈된 내용이 보이도록)
    if (!ws['!rows']) ws['!rows'] = [];
    for (let R = 1; R <= range.e.r; ++R) { // 헤더 제외하고 데이터 행만
      ws['!rows'][R] = { hpt: 60 }; // 행 높이를 60으로 설정
    }
    
    // 컬럼 너비 설정
    ws['!cols'] = [
      { width: 12 }, // 주문번호
      { width: 12 }, // 주문일
      { width: 10 }, // 주문시간
      { width: 12 }, // 고객명
      { width: 12 }, // 받는분
      { width: 15 }, // 전화번호
      { width: 30 }, // 주소
      { width: 25 }, // 상품
      { width: 12 }, // 주문금액
      { width: 12 }, // 실입금액
      { width: 12 }, // 할인금액
      { width: 12 }, // 입금상태
      { width: 12 }, // 주문상태
      { width: 12 }, // 발송상태
      { width: 15 }, // 예약발송일
      { width: 15 }, // 발송완료일
      { width: 15 }, // 매니저발송일
      { width: 12 }, // 원가합계
      { width: 12 }, // 순수익
      { width: 20 }  // 메모
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`);
    
    toast({
      title: "엑셀 다운로드 완료",
      description: `${ordersList.length}개 주문이 엑셀로 다운로드되었습니다.`,
    });
  };

  // Shipping selection functions
  const toggleShippingSelection = (orderId: number) => {
    const newSelection = new Set(selectedShippingItems);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedShippingItems(newSelection);
  };

  const selectAllShipping = (ordersList: Order[]) => {
    const eligibleOrders = ordersList.filter(order => !order.sellerShipped);
    const allIds = new Set(eligibleOrders.map(order => order.id));
    setSelectedShippingItems(allIds);
  };

  const handleBulkSellerShipped = () => {
    if (selectedShippingItems.size === 0) return;
    
    if (confirm(`선택된 ${selectedShippingItems.size}개 주문을 발송완료로 변경하시겠습니까?`)) {
      bulkSellerShippedMutation.mutate(Array.from(selectedShippingItems));
    }
  };

  // Filter orders by status
  const filterOrdersByStatus = (status: string) => {
    if (status === "all") return orders;
    if (status === "delivered") {
      // 발송완료: status가 delivered이거나 sellerShipped가 true인 주문
      return orders.filter((order: Order) => 
        order.status === status || (order.sellerShipped === true)
      );
    }
    return orders.filter((order: Order) => order.status === status);
  };

  // Helper function to get field value for sorting


  // Sort orders function
  const sortOrders = (ordersList: Order[]) => {
    const sorted = [...ordersList];
    
    // Universal sorting function that puts seller shipped orders at the bottom
    const sortWithSellerShippedAtBottom = (compareFn: (a: Order, b: Order) => number) => {
      return sorted.sort((a, b) => {
        // Seller shipped orders go to bottom
        if (a.sellerShipped && !b.sellerShipped) return 1;
        if (!a.sellerShipped && b.sellerShipped) return -1;
        
        // If both have same seller shipped status, use the provided compare function
        return compareFn(a, b);
      });
    };
    
    if (sortOrder === 'latest') {
      // Latest first
      return sortWithSellerShippedAtBottom((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortOrder === 'oldest') {
      // Oldest first
      return sortWithSellerShippedAtBottom((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sortOrder === 'delivery-date') {
      // Sort by delivery date: orders without delivery date first, then by delivery date (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
        // Orders without delivery date go to top
        if (!a.deliveredDate && b.deliveredDate) return -1;
        if (a.deliveredDate && !b.deliveredDate) return 1;
        
        // Both have delivery dates - sort by delivery date (earliest first)
        if (a.deliveredDate && b.deliveredDate) {
          return new Date(a.deliveredDate).getTime() - new Date(b.deliveredDate).getTime();
        }
        
        // Neither has delivery date - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'scheduled-date') {
      // Sort by scheduled date: orders without scheduled date first, then by scheduled date (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
        // Orders without scheduled date go to top
        if (!a.scheduledDate && b.scheduledDate) return -1;
        if (a.scheduledDate && !b.scheduledDate) return 1;
        
        // Both have scheduled dates - sort by scheduled date (earliest first)
        if (a.scheduledDate && b.scheduledDate) {
          return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        }
        
        // Neither has scheduled date - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'order-status') {
      // Sort by order status: pending -> scheduled -> delivered
      return sortWithSellerShippedAtBottom((a, b) => {
        const statusPriority = { 'pending': 1, 'scheduled': 2, 'delivered': 3 };
        const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 999;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Same status - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'payment-status') {
      // Sort by payment status: pending -> partial -> confirmed -> refunded
      return sortWithSellerShippedAtBottom((a, b) => {
        const paymentPriority = { 'pending': 1, 'partial': 2, 'confirmed': 3, 'refunded': 4 };
        const aPriority = paymentPriority[a.paymentStatus as keyof typeof paymentPriority] || 999;
        const bPriority = paymentPriority[b.paymentStatus as keyof typeof paymentPriority] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Same payment status - sort by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortOrder === 'order-number') {
      // Sort by order number (earliest first)
      return sortWithSellerShippedAtBottom((a, b) => {
        const aNum = parseInt(a.orderNumber.split('-')[1] || '0');
        const bNum = parseInt(b.orderNumber.split('-')[1] || '0');
        return aNum - bNum;
      });
    }
    
    return sorted;
  };

  // Filter orders for main list with multiple criteria
  const getFilteredOrdersList = (ordersList: Order[]) => {
    let filtered = ordersList;

    // Date filter
    if (orderDateFilter === 'today') {
      const today = new Date().toDateString();
      filtered = filtered.filter(order => new Date(order.createdAt).toDateString() === today);
    } else if (orderDateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(order => new Date(order.createdAt) >= weekAgo);
    } else if (orderDateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(order => new Date(order.createdAt) >= monthAgo);
    } else if (orderDateFilter === 'custom' && orderStartDate && orderEndDate) {
      const start = new Date(orderStartDate);
      const end = new Date(orderEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }

    // Customer name filter
    if (customerNameFilter.trim()) {
      filtered = filtered.filter(order => 
        order.customerName.toLowerCase().includes(customerNameFilter.toLowerCase().trim())
      );
    }

    // Payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    // Order status filter
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatusFilter);
    }

    // Seller shipped status filter
    if (sellerShippedFilter !== 'all') {
      if (sellerShippedFilter === 'shipped') {
        filtered = filtered.filter(order => order.sellerShipped === true);
      } else if (sellerShippedFilter === 'not_shipped') {
        filtered = filtered.filter(order => !order.sellerShipped);
      }
    }

    // Apply sorting
    return sortOrders(filtered);
  };

  const allOrders = getFilteredOrdersList(orders);
  const pendingOrders = getFilteredOrdersList(filterOrdersByStatus("pending"));
  const scheduledOrders = getFilteredOrdersList(filterOrdersByStatus("scheduled"));
  const sellerShippedOrders = getFilteredOrdersList(filterOrdersByStatus("seller_shipped"));
  const deliveredOrders = getFilteredOrdersList(filterOrdersByStatus("delivered"));
  const refundedOrders = getFilteredOrdersList(orders.filter((order: Order) => order.paymentStatus === "refunded"));

  // Render revenue report function
  const renderRevenueReport = () => {
    // Get product prices and costs from settings first (new price management system)
    const product0PriceSetting = settings?.find(s => s.key === "product_0Price");
    const product1PriceSetting = settings?.find(s => s.key === "product_1Price");
    const product2PriceSetting = settings?.find(s => s.key === "product_2Price");
    const product3PriceSetting = settings?.find(s => s.key === "product_3Price");
    
    const product0CostSetting = settings?.find(s => s.key === "product_0Cost");
    const product1CostSetting = settings?.find(s => s.key === "product_1Cost");
    const product2CostSetting = settings?.find(s => s.key === "product_2Cost");
    const product3CostSetting = settings?.find(s => s.key === "product_3Cost");
    
    // Fallback to content management and old settings
    const productNames = dashboardContent.productNames || [];
    const smallProductCost = productNames[0]?.cost ? parseInt(productNames[0].cost) : null;
    const largeProductCost = productNames[1]?.cost ? parseInt(productNames[1].cost) : null;
    const wrappingProductCost = dashboardContent.wrappingCost ? parseInt(dashboardContent.wrappingCost) : null;
    
    // Use dynamic pricing from price settings first, then content management, then fallback
    const smallBoxPriceValue = product0PriceSetting ? parseInt(product0PriceSetting.value) :
                              (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
    const largeBoxPriceValue = product1PriceSetting ? parseInt(product1PriceSetting.value) :
                              (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
    const wrappingPriceValue = (product2PriceSetting ? parseInt(product2PriceSetting.value) : 
                               (product3PriceSetting ? parseInt(product3PriceSetting.value) : 
                               (productNames[2]?.price ? parseInt(productNames[2].price) : 1000)));
    
    // Use dynamic cost pricing from price settings first, then content management, then fallback
    const smallBoxCostValue = product0CostSetting ? parseInt(product0CostSetting.value) :
                             (smallProductCost ?? (settings?.find(s => s.key === "smallBoxCost")?.value ? 
                             parseInt(settings.find(s => s.key === "smallBoxCost")?.value || "0") : 15000));
    const largeBoxCostValue = product1CostSetting ? parseInt(product1CostSetting.value) :
                             (largeProductCost ?? (settings?.find(s => s.key === "largeBoxCost")?.value ? 
                             parseInt(settings.find(s => s.key === "largeBoxCost")?.value || "0") : 16000));
    const wrappingCostValue = (product2CostSetting ? parseInt(product2CostSetting.value) : 
                              (product3CostSetting ? parseInt(product3CostSetting.value) : 
                              (wrappingProductCost ?? (settings?.find(s => s.key === "wrappingCost")?.value ? 
                              parseInt(settings.find(s => s.key === "wrappingCost")?.value || "0") : 1000))));
    
    // Include all orders with confirmed payment status (including scheduled and delivered orders)
    // Exclude refunded orders from revenue calculation
    const paidOrders = orders.filter((order: Order) => 
      order.paymentStatus === 'confirmed'
    );
    
    // Count refunded orders separately
    const refundedOrders = orders.filter((order: Order) => 
      order.paymentStatus === 'refunded'
    );
    
    // Filter orders by date
    const getFilteredOrders = () => {
      let filtered = paidOrders;
      
      if (dateFilter === 'today') {
        const today = new Date().toDateString();
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt).toDateString() === today);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt) >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = paidOrders.filter((order: Order) => new Date(order.createdAt) >= monthAgo);
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        filtered = paidOrders.filter((order: Order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= start && orderDate <= end;
        });
      }
      
      return filtered;
    };
    
    const filteredOrders = getFilteredOrders();
    
    // Calculate totals for filtered orders
    const filteredTotals = filteredOrders.reduce((acc: any, order: Order) => {
      acc.count++;
      
      // 주문 당시 가격을 우선 사용한 매출 계산
      const orderSmallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? order.smallBoxPrice : smallBoxPriceValue;
      const orderLargeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? order.largeBoxPrice : largeBoxPriceValue;
      const orderWrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? order.wrappingPrice : wrappingPriceValue;
      
      const calculatedSmallBoxAmount = order.smallBoxQuantity * orderSmallBoxPrice;
      const calculatedLargeBoxAmount = order.largeBoxQuantity * orderLargeBoxPrice;
      const calculatedWrappingAmount = order.wrappingQuantity * orderWrappingPrice;
      const calculatedShippingAmount = order.shippingFee || 0;
      
      // 동적 상품 금액 계산
      let calculatedDynamicAmount = 0;
      if (order.dynamicProductQuantities) {
        try {
          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
            ? JSON.parse(order.dynamicProductQuantities) 
            : order.dynamicProductQuantities;
          
          Object.entries(dynamicQty || {}).forEach(([index, quantity]: [string, any]) => {
            const productIndex = parseInt(index);
            const qty = Number(quantity);
            if (qty > 0 && productIndex >= 3) {
              // 주문 당시 동적 상품 가격을 우선 사용
              const storedDynamicPrice = order.dynamicProductPrices && order.dynamicProductPrices[productIndex];
              const dynamicPriceSetting = settings?.find(s => s.key === `product_${productIndex}Price`);
              const dynamicPrice = (storedDynamicPrice && storedDynamicPrice > 0) ? 
                storedDynamicPrice : 
                (dynamicPriceSetting ? parseInt(dynamicPriceSetting.value) : 0);
              calculatedDynamicAmount += qty * dynamicPrice;
            }
          });
        } catch (error) {
          console.error('동적 상품 가격 계산 오류:', error);
        }
      }
      
      const recalculatedTotalAmount = calculatedSmallBoxAmount + calculatedLargeBoxAmount + calculatedWrappingAmount + calculatedDynamicAmount + calculatedShippingAmount;
      
      acc.totalAmount += recalculatedTotalAmount;
      acc.actualRevenue += order.actualPaidAmount || recalculatedTotalAmount;
      acc.totalDiscounts += order.discountAmount || 0;
      acc.totalPartialUnpaid += (order.actualPaidAmount && order.actualPaidAmount < recalculatedTotalAmount && !order.discountAmount) 
        ? (recalculatedTotalAmount - order.actualPaidAmount) : 0;
      
      // 순수익을 재계산된 매출로 계산
      const orderActualRevenue = order.actualPaidAmount || recalculatedTotalAmount;
      const orderNetProfit = orderActualRevenue - (order.discountAmount || 0);
      acc.netProfit += orderNetProfit;
      
      // 가격설정의 원가를 우선 사용하여 정확한 계산
      const smallBoxCost = order.smallBoxQuantity * (smallBoxCostValue || 
        ((order.smallBoxCost && order.smallBoxCost > 0) ? order.smallBoxCost : 
        (productNames[0]?.cost ? parseInt(productNames[0].cost) : 0)));
      const largeBoxCost = order.largeBoxQuantity * (largeBoxCostValue || 
        ((order.largeBoxCost && order.largeBoxCost > 0) ? order.largeBoxCost : 
        (productNames[1]?.cost ? parseInt(productNames[1].cost) : 0)));
      const wrappingCost = order.wrappingQuantity * (wrappingCostValue || 
        ((order.wrappingCost && order.wrappingCost > 0) ? order.wrappingCost : 
        (productNames[2]?.cost ? parseInt(productNames[2].cost) : 0)));
      const shippingCost = order.shippingFee || 0;
      
      // Use historical selling prices for revenue calculations, fallback to current prices from settings
      const product0PriceSetting = settings?.find(s => s.key === "product_0Price");
      const product1PriceSetting = settings?.find(s => s.key === "product_1Price");
      const product2PriceSetting = settings?.find(s => s.key === "product_2Price");
      const product3PriceSetting = settings?.find(s => s.key === "product_3Price");
      
      const currentSmallPrice = product0PriceSetting ? parseInt(product0PriceSetting.value) :
                               (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
      const currentLargePrice = product1PriceSetting ? parseInt(product1PriceSetting.value) :
                               (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
      const currentWrappingPrice = (product2PriceSetting ? parseInt(product2PriceSetting.value) :
                                   (product3PriceSetting ? parseInt(product3PriceSetting.value) :
                                   (productNames[2]?.price ? parseInt(productNames[2].price) : 1000)));
      
      // 가격설정을 우선 사용 (저장된 주문가격은 무시하고 현재 설정 사용)
      const smallBoxPrice = currentSmallPrice;
      const largeBoxPrice = currentLargePrice; 
      const wrappingPrice = currentWrappingPrice;
      
      // 동적 상품 원가 계산 (인덱스 3부터)
      let dynamicProductsCost = 0;
      if (order.dynamicProductQuantities) {
        try {
          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
            ? JSON.parse(order.dynamicProductQuantities) 
            : order.dynamicProductQuantities;
          Object.entries(dynamicQty).forEach(([index, quantity]) => {
            const productIndex = parseInt(index);
            const qty = Number(quantity);
            // 인덱스 3부터가 동적 상품 (0,1,2는 기본 상품)
            if (productIndex >= 3 && qty > 0) {
              // 가격설정의 원가를 우선 사용
              const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
              const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                (productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
              dynamicProductsCost += qty * productCost;
            }
          });
        } catch (error) {
          console.error('Error parsing dynamic product quantities for cost calculation:', error);
        }
      }
      
      acc.totalCost += smallBoxCost + largeBoxCost + wrappingCost + shippingCost + dynamicProductsCost;
      acc.smallBoxAmount += order.smallBoxQuantity * smallBoxPrice;
      acc.largeBoxAmount += order.largeBoxQuantity * largeBoxPrice;
      acc.wrappingAmount += order.wrappingQuantity * wrappingPrice;
      
      // Calculate quantities
      acc.smallBoxQuantity += order.smallBoxQuantity;
      acc.largeBoxQuantity += order.largeBoxQuantity;
      acc.wrappingQuantity += order.wrappingQuantity;
      
      // Handle dynamic product quantities
      if (order.dynamicProductQuantities) {
        try {
          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
            ? JSON.parse(order.dynamicProductQuantities) 
            : order.dynamicProductQuantities;
          
          // Add dynamic quantities to accumulator
          if (!acc.dynamicProductQuantities) acc.dynamicProductQuantities = {};
          Object.entries(dynamicQty).forEach(([index, quantity]) => {
            const productIndex = parseInt(index);
            if (!acc.dynamicProductQuantities[productIndex]) {
              acc.dynamicProductQuantities[productIndex] = 0;
            }
            acc.dynamicProductQuantities[productIndex] += quantity;
          });
        } catch (error) {
          console.error('Error parsing dynamic product quantities:', error);
        }
      }
      
      // Calculate shipping fees and count orders with shipping
      if (shippingCost > 0) acc.shippingOrders++;
      acc.shippingAmount += shippingCost;
      
      return acc;
    }, {
      count: 0,
      totalAmount: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalPartialUnpaid: 0,
      netProfit: 0,
      totalCost: 0,
      smallBoxAmount: 0,
      largeBoxAmount: 0,
      wrappingAmount: 0,
      shippingAmount: 0,
      smallBoxQuantity: 0,
      largeBoxQuantity: 0,
      wrappingQuantity: 0,
      shippingOrders: 0,
      dynamicProductQuantities: {}
    });
    
    const handleRevenueExcelDownload = async () => {
      try {
        const response = await fetch('/api/export/revenue');
        
        if (!response.ok) {
          throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `에덴한과_매출관리_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "다운로드 완료",
          description: "매출관리 엑셀 파일이 성공적으로 다운로드되었습니다.",
        });
      } catch (error) {
        toast({
          title: "다운로드 실패",
          description: "매출관리 엑셀 파일 다운로드 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="space-y-6">
        {/* 매출 요약 */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm md:text-lg font-semibold">매출 관리 리포트</h3>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              입금완료된 모든 주문 (발송주문, 발송완료 포함)
            </p>
          </div>
          <Button onClick={handleRevenueExcelDownload} className="flex items-center gap-2 text-xs md:text-sm px-2 md:px-4">
            <Download className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">매출 엑셀 다운로드</span>
            <span className="sm:hidden">엑셀</span>
          </Button>
        </div>
        {/* 날짜 필터 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex flex-wrap gap-1 md:gap-2">
                <Button
                  size="sm"
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('all')}
                  className="text-xs md:text-sm px-2 md:px-3"
                >
                  전체
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('today')}
                  className="text-xs md:text-sm px-2 md:px-3"
                >
                  오늘
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('week')}
                  className="text-xs md:text-sm px-2 md:px-3"
                >
                  7일
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('month')}
                  className="text-xs md:text-sm px-2 md:px-3"
                >
                  30일
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('custom')}
                  className="text-xs md:text-sm px-2 md:px-3"
                >
                  기간설정
                </Button>
              </div>
              
              {dateFilter === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 md:px-3 py-1 border border-gray-300 rounded-md text-xs md:text-sm"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 md:px-3 py-1 border border-gray-300 rounded-md text-xs md:text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* 매출 총합계 - 데스크탑용 그리드, 모바일용 리스트 */}
        <Card className="bg-white border-eden-red/20">
          <CardContent className="p-4 md:p-6">
            <div className="text-center mb-4 md:mb-6">
              <h3 className="text-base md:text-xl font-bold text-eden-red mb-2">
                💰 매출 총합계 ({dateFilter === 'all' ? '전체' : 
                  dateFilter === 'today' ? '오늘' :
                  dateFilter === 'week' ? '7일' :
                  dateFilter === 'month' ? '30일' :
                  dateFilter === 'custom' && startDate && endDate ? `${startDate} ~ ${endDate}` : '기간 설정'})
              </h3>
            </div>
            
            {/* 데스크탑 그리드 뷰 */}
            <div className="hidden md:block bg-gray-50 rounded-lg p-4">
              {(() => {
                try {
                  // dashboardContent.productNames는 이미 파싱된 배열이므로 JSON.parse 불필요
                  const productNames = Array.isArray(dashboardContent.productNames) 
                    ? dashboardContent.productNames 
                    : (typeof dashboardContent.productNames === 'string' 
                       ? JSON.parse(dashboardContent.productNames || '[]') 
                       : []);
                  
                  const productCount = productNames.length;
                  const colors = ['amber', 'orange', 'eden-brown', 'green', 'blue', 'purple', 'pink', 'indigo'];
                  
                  // 상품이 없으면 기본 뷰로 표시
                  if (productCount === 0) {
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2 md:gap-4 text-center">
                        <div>
                          <div className="font-semibold text-gray-700 mb-1 text-xs md:text-sm">주문건수</div>
                          <div className="text-sm md:text-lg font-bold text-gray-800">{filteredTotals.count}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-amber-700 mb-1 text-xs md:text-sm">한과1호</div>
                          <div className="text-sm md:text-lg font-bold text-amber-600">{filteredTotals.smallBoxQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-orange-700 mb-1 text-xs md:text-sm">한과2호</div>
                          <div className="text-sm md:text-lg font-bold text-orange-600">{filteredTotals.largeBoxQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-eden-brown mb-1 text-xs md:text-sm">보자기</div>
                          <div className="text-sm md:text-lg font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-700 mb-1 text-xs md:text-sm">택배건수</div>
                          <div className="text-sm md:text-lg font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">환불건수</div>
                          <div className="text-sm md:text-lg font-bold text-red-600">{refundedOrders.length}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-green-700 mb-1 text-xs md:text-sm">실제입금</div>
                          <div className="text-sm md:text-lg font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">총원가</div>
                          <div className="text-sm md:text-lg font-bold text-red-600">{formatPrice(filteredTotals.totalCost)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-purple-700 mb-1 text-xs md:text-sm">순수익</div>
                          <div className={`text-sm md:text-lg font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                            {formatPrice(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts)}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className={`grid gap-2 md:gap-4 text-center ${
                      productCount <= 3 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9' :
                      productCount <= 5 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-11' :
                      'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-12'
                    }`}>
                      <div>
                        <div className="font-semibold text-gray-700 mb-1 text-xs md:text-sm">주문건수</div>
                        <div className="text-sm md:text-lg font-bold text-gray-800">{filteredTotals.count}건</div>
                      </div>
                      
                      {/* 동적 상품 목록 */}
                      {productNames.map((product: any, index: number) => {
                        const colorClass = colors[index % colors.length];
                        let quantity = 0;
                        
                        // 기존 데이터베이스 구조에 맞게 수량 매핑
                        if (index === 0) quantity = filteredTotals.smallBoxQuantity;
                        else if (index === 1) quantity = filteredTotals.largeBoxQuantity;
                        else if (index === 2 || product.name?.includes('보자기')) quantity = filteredTotals.wrappingQuantity;
                        else {
                          // 새로 추가된 상품들은 동적 상품 수량에서 가져오기
                          quantity = filteredTotals.dynamicProductQuantities?.[index] || 0;
                        }
                        
                        return (
                          <div key={index}>
                            <div className={`font-semibold text-${colorClass}-700 mb-1 text-xs md:text-sm`}>
                              {product.name}
                            </div>
                            <div className={`text-sm md:text-lg font-bold text-${colorClass}-600`}>
                              {quantity}개
                            </div>
                          </div>
                        );
                      })}
                      
                      <div>
                        <div className="font-semibold text-blue-700 mb-1 text-xs md:text-sm">택배건수</div>
                        <div className="text-sm md:text-lg font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">환불건수</div>
                        <div className="text-sm md:text-lg font-bold text-red-600">{refundedOrders.length}건</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-green-700 mb-1 text-xs md:text-sm">실제입금</div>
                        <div className="text-sm md:text-lg font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">총원가</div>
                        <div className="text-sm md:text-lg font-bold text-red-600">
                          {formatPrice(filteredTotals.totalCost)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-purple-700 mb-1 text-xs md:text-sm">순수익</div>
                        <div className={`text-sm md:text-lg font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                          {formatPrice(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts)}
                        </div>
                      </div>
                    </div>
                  );
                } catch (error) {
                  console.error('Product names parsing error:', error);
                  // 오류 발생 시 기본 뷰
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2 md:gap-4 text-center">
                      <div>
                        <div className="font-semibold text-gray-700 mb-1 text-xs md:text-sm">주문건수</div>
                        <div className="text-sm md:text-lg font-bold text-gray-800">{filteredTotals.count}건</div>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-700 mb-1 text-xs md:text-sm">한과1호</div>
                        <div className="text-sm md:text-lg font-bold text-amber-600">{filteredTotals.smallBoxQuantity}개</div>
                      </div>
                      <div>
                        <div className="font-semibold text-orange-700 mb-1 text-xs md:text-sm">한과2호</div>
                        <div className="text-sm md:text-lg font-bold text-orange-600">{filteredTotals.largeBoxQuantity}개</div>
                      </div>
                      <div>
                        <div className="font-semibold text-eden-brown mb-1 text-xs md:text-sm">보자기</div>
                        <div className="text-sm md:text-lg font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</div>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-700 mb-1 text-xs md:text-sm">택배건수</div>
                        <div className="text-sm md:text-lg font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">환불건수</div>
                        <div className="text-sm md:text-lg font-bold text-red-600">{refundedOrders.length}건</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-700 mb-1 text-xs md:text-sm">실제입금</div>
                        <div className="text-sm md:text-lg font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-700 mb-1 text-xs md:text-sm">총원가</div>
                        <div className="text-sm md:text-lg font-bold text-red-600">{formatPrice(filteredTotals.totalCost)}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-purple-700 mb-1 text-xs md:text-sm">순수익</div>
                        <div className={`text-sm md:text-lg font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                          {formatPrice(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts)}
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* 모바일 리스트 뷰 */}
            <div className="md:hidden space-y-2">
              {/* 핵심 수치 3개 */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-green-600 text-xs font-medium mb-1">실제입금</div>
                  <div className="text-green-700 text-sm font-bold">{formatPrice(filteredTotals.actualRevenue)}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-red-600 text-xs font-medium mb-1">총원가</div>
                  <div className="text-red-700 text-sm font-bold">{formatPrice(filteredTotals.totalCost)}</div>
                </div>
                <div className={`border rounded-lg p-3 text-center ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-xs font-medium mb-1 ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>순수익</div>
                  <div className={`text-sm font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                    {formatPrice(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts)}
                  </div>
                </div>
              </div>

              {/* 상세 정보 리스트 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="text-xs text-gray-600">주문건수</span>
                  <span className="text-sm font-bold text-gray-800">{filteredTotals.count}건</span>
                </div>
                
                {(() => {
                  try {
                    // dashboardContent.productNames는 이미 파싱된 배열이므로 JSON.parse 불필요
                    const productNames = Array.isArray(dashboardContent.productNames) 
                      ? dashboardContent.productNames 
                      : (typeof dashboardContent.productNames === 'string' 
                         ? JSON.parse(dashboardContent.productNames || '[]') 
                         : []);
                    
                    const colors = ['amber', 'orange', 'eden-brown', 'green', 'blue', 'purple', 'pink', 'indigo'];
                    
                    // 상품이 없으면 기본 상품들 표시
                    if (productNames.length === 0) {
                      return (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-gray-200">
                            <span className="text-xs text-amber-600">한과1호</span>
                            <span className="text-sm font-bold text-amber-700">{filteredTotals.smallBoxQuantity}개</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-200">
                            <span className="text-xs text-orange-600">한과2호</span>
                            <span className="text-sm font-bold text-orange-700">{filteredTotals.largeBoxQuantity}개</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-200">
                            <span className="text-xs text-eden-brown">보자기</span>
                            <span className="text-sm font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</span>
                          </div>
                        </>
                      );
                    }
                    
                    return productNames.map((product: any, index: number) => {
                      const colorClass = colors[index % colors.length];
                      let quantity = 0;
                      
                      // 기존 데이터베이스 구조에 맞게 수량 매핑
                      if (index === 0) quantity = filteredTotals.smallBoxQuantity;
                      else if (index === 1) quantity = filteredTotals.largeBoxQuantity;
                      else if (index === 2 || product.name?.includes('보자기')) quantity = filteredTotals.wrappingQuantity;
                      else {
                        // 새로 추가된 상품들은 동적 상품 수량에서 가져오기
                        quantity = filteredTotals.dynamicProductQuantities?.[index] || 0;
                      }
                      
                      return (
                        <div key={index} className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className={`text-xs text-${colorClass}-600`}>
                            {product.name}
                          </span>
                          <span className={`text-sm font-bold text-${colorClass}-700`}>
                            {quantity}개
                          </span>
                        </div>
                      );
                    });
                  } catch (error) {
                    console.error('Mobile product names parsing error:', error);
                    // 오류 발생 시 기본 상품들 표시
                    return (
                      <>
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-xs text-amber-600">한과1호</span>
                          <span className="text-sm font-bold text-amber-700">{filteredTotals.smallBoxQuantity}개</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-xs text-orange-600">한과2호</span>
                          <span className="text-sm font-bold text-orange-700">{filteredTotals.largeBoxQuantity}개</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-xs text-eden-brown">보자기</span>
                          <span className="text-sm font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</span>
                        </div>
                      </>
                    );
                  }
                })()}
                
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="text-xs text-gray-600">택배건수</span>
                  <span className="text-sm font-bold text-gray-700">{filteredTotals.shippingOrders}건</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-600">환불건수</span>
                  <span className="text-sm font-bold text-gray-700">{refundedOrders.length}건</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 매출관리 주문 상세 리스트 */}
        {orders.length > 0 && (
          <Card className="border-gray-200">
            <CardHeader className="bg-gray-50">
              <CardTitle className="flex items-center justify-between">
                <span className="text-base md:text-lg text-gray-800">📊 매출 상세내역</span>
                <span className="text-sm font-normal text-gray-600 bg-white px-2 py-1 rounded">
                  {orders.length}건
                </span>
              </CardTitle>
              <p className="text-xs md:text-sm text-gray-700 mt-1">
                매출 분석을 위한 주문별 상세 정보 (모바일에서 리스트형으로 최적화)
              </p>
            </CardHeader>
            <CardContent>
              {/* 데스크탑 테이블 뷰 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문번호</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">고객명</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문일</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">주문내역</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-gray-50 text-sm">매출정보</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-gray-50 text-sm">입금정보</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-gray-50 text-sm">할인/미입금</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-gray-50 text-sm">원가분석</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 bg-gray-50 text-sm">순수익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((order: Order) => {
                      // 주문 시점의 실제 상품명을 사용하기 위한 함수 (현재 콘텐츠관리의 상품명 참조)
                      const getOrderTimeProductName = (index: number, fallback: string) => {
                        if (dashboardContent.productNames && dashboardContent.productNames[index]) {
                          return dashboardContent.productNames[index].name;
                        }
                        return fallback;
                      };

                      // 주문 시점의 실제 선택 상품과 가격을 우선 사용 (원가분석의 정확성을 위해)
                      const productNames = dashboardContent.productNames || [];
                      
                      // 주문 당시 가격을 우선 사용, 없으면 현재 설정을 fallback으로 사용
                      const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                        order.smallBoxPrice : (smallBoxPriceValue || (productNames[0]?.price ? parseInt(productNames[0].price) : 19000));
                      const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                        order.largeBoxPrice : (largeBoxPriceValue || (productNames[1]?.price ? parseInt(productNames[1].price) : 21000));
                      const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                        order.wrappingPrice : (wrappingPriceValue || (productNames[2]?.price ? parseInt(productNames[2].price) : 1000));
                      
                      const smallBoxTotal = order.smallBoxQuantity * smallBoxPrice;
                      const largeBoxTotal = order.largeBoxQuantity * largeBoxPrice;
                      const wrappingTotal = order.wrappingQuantity * wrappingPrice;
                      
                      // 동적 상품 매출 계산
                      let dynamicProductsTotal = 0;
                      if (order.dynamicProductQuantities) {
                        try {
                          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                            ? JSON.parse(order.dynamicProductQuantities) 
                            : order.dynamicProductQuantities;
                          Object.entries(dynamicQty).forEach(([index, quantity]) => {
                            const productIndex = parseInt(index);
                            const qty = Number(quantity);
                            if (productIndex >= 3 && qty > 0) {
                              // 주문 당시 동적 상품 가격을 우선 사용, 없으면 현재 설정
                              const storedDynamicPrice = order.dynamicProductPrices && order.dynamicProductPrices[productIndex];
                              const productPriceSetting = settings?.find(s => s.key === `product_${productIndex}Price`);
                              const productPrice = (storedDynamicPrice && storedDynamicPrice > 0) ? 
                                storedDynamicPrice : 
                                (productPriceSetting ? parseInt(productPriceSetting.value) : 
                                (productNames[productIndex]?.price ? parseInt(productNames[productIndex].price) : 0));
                              dynamicProductsTotal += qty * productPrice;
                            }
                          });
                        } catch (error) {
                          console.error('Error parsing dynamic product quantities for revenue calculation:', error);
                        }
                      }
                      
                      // Get shipping fee from order
                      const shippingFee = order.shippingFee || 0;
                      
                      // 가격설정 기반 총 매출 계산
                      const recalculatedTotalRevenue = smallBoxTotal + largeBoxTotal + wrappingTotal + dynamicProductsTotal + shippingFee;
                      
                      // 가격설정의 원가를 우선 사용, 없으면 주문 시점 원가, 마지막으로 콘텐츠관리 원가
                      const smallCost = smallBoxCostValue || order.smallBoxCost || 
                                       (productNames[0]?.cost ? parseInt(productNames[0].cost) : 0);
                      const largeCost = largeBoxCostValue || order.largeBoxCost || 
                                       (productNames[1]?.cost ? parseInt(productNames[1].cost) : 0);
                      const wrappingCost = wrappingCostValue || order.wrappingCost || 
                                          (productNames[2]?.cost ? parseInt(productNames[2].cost) : 0);
                      
                      // Calculate actual costs using stored historical data
                      const smallBoxesCost = order.smallBoxQuantity * smallCost;
                      const largeBoxesCost = order.largeBoxQuantity * largeCost;
                      const wrappingCostTotal = order.wrappingQuantity * wrappingCost;
                      
                      // 동적 상품들의 원가 계산 (인덱스 3부터가 추가 동적 상품)
                      let dynamicProductsCost = 0;
                      if (order.dynamicProductQuantities) {
                        try {
                          const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                            ? JSON.parse(order.dynamicProductQuantities) 
                            : order.dynamicProductQuantities;
                          Object.entries(dynamicQty).forEach(([index, quantity]) => {
                            const productIndex = parseInt(index);
                            const qty = Number(quantity);
                            // 인덱스 3부터가 동적 상품 (0,1,2는 기본 상품)
                            if (productIndex >= 3 && qty > 0) {
                              // 가격설정에서 동적 상품 원가를 우선 사용
                              const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
                              const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                                (productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
                              dynamicProductsCost += qty * productCost;
                            }
                          });
                        } catch (error) {
                          console.error('Error parsing dynamic product quantities for cost calculation:', error);
                        }
                      }
                      
                      const totalCost = smallBoxesCost + largeBoxesCost + wrappingCostTotal + dynamicProductsCost + shippingFee;
                      
                      // Calculate discount amount first
                      const discountAmount = order.discountAmount || 0;
                      
                      // Calculate unpaid amount using recalculated revenue
                      const unpaidAmount = (order.actualPaidAmount && order.actualPaidAmount < recalculatedTotalRevenue && !discountAmount) 
                        ? (recalculatedTotalRevenue - order.actualPaidAmount) : 0;
                      
                      // Calculate net profit using recalculated revenue
                      const actualRevenue = order.actualPaidAmount || recalculatedTotalRevenue;
                      // 순수익 = 매출금액 - 원가 - 할인금액 - 미입금액
                      const netProfit = recalculatedTotalRevenue - totalCost - discountAmount - unpaidAmount;
                      
                      return (
                        <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-4 px-4 font-semibold text-gray-900 text-sm">#{order.orderNumber}</td>
                          <td className="py-4 px-4 font-medium text-gray-900 text-sm">{order.customerName}</td>
                          <td className="py-4 px-4 text-sm text-gray-700">
                            <div className="font-medium">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                            <div className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="py-4 px-4 text-sm">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="font-medium text-gray-800">{getOrderTimeProductName(0, '한과1호')}×{order.smallBoxQuantity}개</div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="font-medium text-gray-800">{getOrderTimeProductName(1, '한과2호')}×{order.largeBoxQuantity}개</div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="font-medium text-gray-800">{getOrderTimeProductName(2, '보자기')}×{order.wrappingQuantity}개</div>
                              )}
                              {/* 실제 주문에 저장된 동적 상품 수량 표시 */}
                              {order.dynamicProductQuantities && (() => {
                                try {
                                  const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                    ? JSON.parse(order.dynamicProductQuantities) 
                                    : order.dynamicProductQuantities;
                                  return Object.entries(dynamicQty).map(([index, quantity]) => {
                                    const productIndex = parseInt(index);
                                    const qty = Number(quantity);
                                    const productName = getOrderTimeProductName(productIndex, `상품${productIndex + 1}`);
                                    return qty > 0 ? (
                                      <div key={productIndex} className="font-medium text-gray-800">
                                        {productName}×{qty}개
                                      </div>
                                    ) : null;
                                  }).filter(Boolean);
                                } catch (error) {
                                  console.error('Dynamic product quantities parse error:', error);
                                  return null;
                                }
                              })()}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium bg-gray-50 border-l-2 border-gray-300">
                            <div className="text-gray-700 font-semibold">
                              {formatPrice(recalculatedTotalRevenue)}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              매출금액
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm font-medium bg-gray-50 border-l-2 border-gray-300">
                            <div className="text-gray-700 font-semibold">
                              {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(recalculatedTotalRevenue)}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              실제입금액
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm bg-gray-50 border-l-2 border-gray-300">
                            {discountAmount > 0 ? (
                              <div>
                                <div className="text-gray-700 font-semibold">
                                  {formatPrice(discountAmount)}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  할인금액
                                </div>
                              </div>
                            ) : unpaidAmount > 0 ? (
                              <div>
                                <div className="text-gray-700 font-semibold">
                                  {formatPrice(unpaidAmount)}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  미입금액
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-gray-500 font-semibold">-</div>
                                <div className="text-xs text-gray-400 mt-1">완납</div>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-xs bg-gray-50 border-l-2 border-gray-300">
                            <div className="space-y-1">
                              {order.smallBoxQuantity > 0 && (
                                <div className="text-gray-600">
                                  {getOrderTimeProductName(0, '한과1호')}: {formatPrice(smallBoxesCost)}
                                </div>
                              )}
                              {order.largeBoxQuantity > 0 && (
                                <div className="text-gray-600">
                                  {getOrderTimeProductName(1, '한과2호')}: {formatPrice(largeBoxesCost)}
                                </div>
                              )}
                              {order.wrappingQuantity > 0 && (
                                <div className="text-gray-600">
                                  {getOrderTimeProductName(2, '보자기')}: {formatPrice(wrappingCostTotal)}
                                </div>
                              )}
                              {/* 동적 상품들 원가 표시 (인덱스 3부터) */}
                              {order.dynamicProductQuantities && (() => {
                                try {
                                  const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                    ? JSON.parse(order.dynamicProductQuantities) 
                                    : order.dynamicProductQuantities;
                                  return Object.entries(dynamicQty).map(([index, quantity]) => {
                                    const productIndex = parseInt(index);
                                    const qty = Number(quantity);
                                    // 인덱스 3부터가 동적 상품 (0,1,2는 기본 상품)
                                    if (productIndex >= 3 && qty > 0) {
                                      // 가격설정에서 동적 상품 원가를 우선 사용
                                      const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
                                      const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                                        (productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
                                      const itemCost = qty * productCost;
                                      return (
                                        <div key={productIndex} className="text-gray-600">
                                          {getOrderTimeProductName(productIndex, `상품${productIndex + 1}`)}: {formatPrice(itemCost)}
                                        </div>
                                      );
                                    }
                                    return null;
                                  }).filter(Boolean);
                                } catch (error) {
                                  return null;
                                }
                              })()}
                              {shippingFee > 0 && (
                                <div className="text-gray-600">
                                  배송비: {formatPrice(shippingFee)}
                                </div>
                              )}
                              <div className="font-semibold text-gray-700 border-t border-gray-300 pt-1 mt-2">
                                총원가: {formatPrice(totalCost)}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-sm bg-gray-50 border-l-2 border-gray-300">
                            <div>
                              <div className={`font-bold text-lg ${netProfit >= 0 ? "text-gray-700" : "text-gray-600"}`}>
                                {formatPrice(netProfit)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                순수익
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 모바일 요약 뷰 */}
              <div className="md:hidden">
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    📊 매출 요약 ({orders.length}건)
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-2 rounded border">
                      <div className="text-gray-600">총 주문금액</div>
                      <div className="font-bold text-gray-700">{formatPrice(filteredTotals.totalAmount)}</div>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <div className="text-gray-600">실제 수익</div>
                      <div className="font-bold text-gray-700">{formatPrice(filteredTotals.actualRevenue)}</div>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <div className="text-gray-600">총 원가</div>
                      <div className="font-bold text-gray-600">{formatPrice(filteredTotals.totalCost)}</div>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <div className="text-gray-600">순수익</div>
                      <div className="font-bold text-gray-700">{formatPrice(filteredTotals.netProfit)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                {orders
                  .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((order: Order) => {
                  // 주문 시점의 실제 선택 상품과 가격을 우선 사용 (원가분석의 정확성을 위해)
                  const productNames = dashboardContent.productNames || [];
                  
                  // 가격설정의 판매가를 우선 사용, 주문 시점 가격이 0이면 현재 설정 사용
                  const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? order.smallBoxPrice : 
                                      (smallBoxPriceValue || (productNames[0]?.price ? parseInt(productNames[0].price) : 19000));
                  const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? order.largeBoxPrice : 
                                      (largeBoxPriceValue || (productNames[1]?.price ? parseInt(productNames[1].price) : 21000));
                  const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? order.wrappingPrice : 
                                      (wrappingPriceValue || (productNames[2]?.price ? parseInt(productNames[2].price) : 1000));
                  
                  const smallBoxTotal = order.smallBoxQuantity * smallBoxPrice;
                  const largeBoxTotal = order.largeBoxQuantity * largeBoxPrice;
                  const wrappingTotal = order.wrappingQuantity * wrappingPrice;
                  
                  // Get shipping fee from order
                  const shippingFee = order.shippingFee || 0;
                  
                  // 가격설정의 원가를 우선 사용, 없으면 주문 시점 원가, 마지막으로 콘텐츠관리 원가
                  const smallCost = smallBoxCostValue || order.smallBoxCost || 
                                   (productNames[0]?.cost ? parseInt(productNames[0].cost) : 0);
                  const largeCost = largeBoxCostValue || order.largeBoxCost || 
                                   (productNames[1]?.cost ? parseInt(productNames[1].cost) : 0);
                  const wrappingCost = wrappingCostValue || order.wrappingCost || 
                                      (productNames[2]?.cost ? parseInt(productNames[2].cost) : 0);
                  
                  // Calculate actual costs using stored historical data
                  const smallBoxesCost = order.smallBoxQuantity * smallCost;
                  const largeBoxesCost = order.largeBoxQuantity * largeCost;
                  const wrappingCostTotal = order.wrappingQuantity * wrappingCost;
                  
                  // 실제 주문에 저장된 동적 상품들의 원가 계산 (인덱스 3부터)
                  let dynamicProductsCost = 0;
                  if (order.dynamicProductQuantities) {
                    try {
                      const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                        ? JSON.parse(order.dynamicProductQuantities) 
                        : order.dynamicProductQuantities;
                      Object.entries(dynamicQty).forEach(([index, quantity]) => {
                        const productIndex = parseInt(index);
                        const qty = Number(quantity);
                        // 인덱스 3부터가 동적 상품 (0,1,2는 기본 상품)
                        if (productIndex >= 3 && qty > 0) {
                          // 가격설정의 원가를 우선 사용, 없으면 콘텐츠관리 원가
                          const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
                          const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                            (productNames && productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
                          dynamicProductsCost += qty * productCost;
                        }
                      });
                    } catch (error) {
                      console.error('Error parsing dynamic product quantities for cost calculation:', error);
                    }
                  }
                  
                  const totalCost = smallBoxesCost + largeBoxesCost + wrappingCostTotal + dynamicProductsCost + shippingFee;
                  
                  // Calculate discount and unpaid amounts
                  const discountAmount = order.discountAmount || 0;
                  const unpaidAmount = (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
                    ? (order.totalAmount - order.actualPaidAmount) : 0;
                  
                  // Calculate profit
                  const actualPaidAmount = order.actualPaidAmount || order.totalAmount;
                  const actualProfit = actualPaidAmount - totalCost - discountAmount;
                  
                  return (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        {/* 주문 헤더 */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-600 text-sm">#{order.orderNumber}</span>
                            <span className="text-sm">{order.customerName}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            order.paymentStatus === 'confirmed' 
                              ? 'bg-gray-100 text-gray-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {order.paymentStatus === 'confirmed' ? '입금완료' : '입금대기'}
                          </span>
                        </div>
                        
                        {/* 주문 정보 */}
                        <div className="text-xs text-gray-600 mb-2">
                          {new Date(order.createdAt).toLocaleDateString('ko-KR')} • 
                          {order.smallBoxQuantity > 0 && ` ${dashboardContent.productNames?.[0]?.name || '한과1호'}×${order.smallBoxQuantity}`}
                          {order.largeBoxQuantity > 0 && ` ${dashboardContent.productNames?.[1]?.name || '한과2호'}×${order.largeBoxQuantity}`}
                          {order.wrappingQuantity > 0 && ` ${dashboardContent.productNames?.[2]?.name || '보자기'}×${order.wrappingQuantity}`}
                          {/* 동적 상품 표시 */}
                          {order.dynamicProductQuantities && (() => {
                            try {
                              const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                ? JSON.parse(order.dynamicProductQuantities) 
                                : order.dynamicProductQuantities;
                              return Object.entries(dynamicQty).map(([index, quantity]) => {
                                const productIndex = parseInt(index);
                                const qty = Number(quantity);
                                const productName = dashboardContent.productNames?.[productIndex]?.name || `상품${productIndex + 1}`;
                                return qty > 0 ? ` ${productName}×${qty}` : '';
                              }).filter(Boolean).join('');
                            } catch (error) {
                              return '';
                            }
                          })()}
                        </div>
                        
                        {/* 수익 요약 */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-gray-500">주문금액</div>
                            <div className="font-bold">{formatPrice(order.totalAmount)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">원가</div>
                            <div className="font-bold text-red-600">{formatPrice(totalCost)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">순수익</div>
                            <div className={`font-bold ${actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPrice(actualProfit)}
                            </div>
                          </div>
                        </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render deleted orders function
  const renderTrashOrdersList = (ordersList: Order[]) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Trash2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>휴지통이 비어있습니다.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Bulk Actions Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTrashItems.size === ordersList.length && ordersList.length > 0}
                onChange={() => {
                  if (selectedTrashItems.size === ordersList.length) {
                    clearAllSelections();
                  } else {
                    selectAllTrash();
                  }
                }}
                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">
                전체 선택 ({selectedTrashItems.size}/{ordersList.length})
              </span>
            </div>
            {selectedTrashItems.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkPermanentDelete}
                disabled={bulkPermanentDeleteMutation.isPending}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                선택항목 영구삭제 ({selectedTrashItems.size}개)
              </Button>
            )}
          </div>
          {selectedTrashItems.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllSelections}
              className="text-gray-600"
            >
              선택 해제
            </Button>
          )}
        </div>

        {ordersList.map((order: Order) => (
          <Card key={order.id} className={`border-red-200 ${
            selectedTrashItems.has(order.id) ? 'bg-red-100 border-red-300' : 
            order.status === 'seller_shipped' ? 'bg-blue-50 border-blue-200' : 
            'bg-red-50'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedTrashItems.has(order.id)}
                    onChange={() => toggleTrashSelection(order.id)}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          주문번호: {order.orderNumber}
                        </h3>
                        <div className="text-xs text-gray-500">
                          <div>주문일: {new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                          <div>{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        삭제일: {order.deletedAt ? new Date(order.deletedAt).toLocaleDateString('ko-KR') : '-'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm">
                      <div>
                        <span className="font-medium">고객명:</span> {order.customerName}
                      </div>
                      <div>
                        <span className="font-medium">연락처:</span> {order.customerPhone}
                      </div>
                      <div>
                        <span className="font-medium">총 금액:</span> {order.totalAmount.toLocaleString()}원
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">주소:</span> ({order.zipCode}) {order.address1} {order.address2}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreOrderMutation.mutate(order.id)}
                    disabled={restoreOrderMutation.isPending}
                    className="flex items-center gap-1 text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    복구
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("이 주문을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                        permanentDeleteMutation.mutate(order.id);
                      }
                    }}
                    disabled={permanentDeleteMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    영구삭제
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Clear all filters
  const clearAllFilters = () => {
    setOrderDateFilter('all');
    setOrderStartDate('');
    setOrderEndDate('');
    setCustomerNameFilter('');
    setPaymentStatusFilter('all');
    setOrderStatusFilter('all');
    setSellerShippedFilter('all');
    setSortOrder('latest');
  };

  // Render filter UI
  const renderOrderFilters = () => (
    <div className="mb-4 p-3 md:p-4 bg-gray-50 rounded-lg border">
      {/* 모바일 최적화 레이아웃 */}
      <div className="lg:hidden space-y-3">
        {/* 기간 필터 - 모바일 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">기간</label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={orderDateFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('all')}
              className="flex-1 h-7 text-xs"
            >
              전체
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'today' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('today')}
              className="flex-1 h-7 text-xs"
            >
              오늘
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'week' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('week')}
              className="flex-1 h-7 text-xs"
            >
              7일
            </Button>
          </div>
        </div>

        {/* 검색과 정렬 - 모바일 2열 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">고객명</label>
            <input
              type="text"
              placeholder="고객명"
              value={customerNameFilter}
              onChange={(e) => setCustomerNameFilter(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs h-7"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">정렬</label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={sortOrder === 'latest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('latest')}
                className="flex-1 h-7 text-xs"
              >
                최신
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('oldest')}
                className="flex-1 h-7 text-xs"
              >
                오래된
              </Button>
            </div>
          </div>
        </div>

        {/* 상태 필터 - 모바일 2열 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">입금상태</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs h-7"
            >
              <option value="all">전체</option>
              <option value="pending">입금대기</option>
              <option value="confirmed">입금완료</option>
              <option value="partial">부분결제</option>
              <option value="refunded">환불</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">주문상태</label>
            <select
              value={orderStatusFilter}
              onChange={(e) => {
                const newStatus = e.target.value;
                setOrderStatusFilter(newStatus);
                if (newStatus === 'seller_shipped') {
                  setActiveTab('seller_shipped');
                }
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs h-7"
            >
              <option value="all">전체</option>
              <option value="scheduled">발송주문</option>
              <option value="delivered">발송완료</option>
            </select>
          </div>
        </div>
      </div>

      {/* 데스크탑 기존 레이아웃 */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        {/* Date Filter - Simplified */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기간</label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={orderDateFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('all')}
              className="flex-1 h-8 text-xs"
            >
              전체
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'today' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('today')}
              className="flex-1 h-8 text-xs"
            >
              오늘
            </Button>
            <Button
              size="sm"
              variant={orderDateFilter === 'week' ? 'default' : 'outline'}
              onClick={() => setOrderDateFilter('week')}
              className="flex-1 h-8 text-xs"
            >
              7일
            </Button>
          </div>
          {orderDateFilter === 'custom' && (
            <div className="flex gap-1 mt-2">
              <input
                type="date"
                value={orderStartDate}
                onChange={(e) => setOrderStartDate(e.target.value)}
                className="flex-1 px-2 py-1 border rounded text-xs"
              />
              <input
                type="date"
                value={orderEndDate}
                onChange={(e) => setOrderEndDate(e.target.value)}
                className="flex-1 px-2 py-1 border rounded text-xs"
              />
            </div>
          )}
        </div>

        {/* Customer Name Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">고객명</label>
          <input
            type="text"
            placeholder="고객명 검색"
            value={customerNameFilter}
            onChange={(e) => setCustomerNameFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          />
        </div>

        {/* Payment Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">입금상태</label>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="pending">입금대기</option>
            <option value="confirmed">입금완료</option>
            <option value="partial">부분결제</option>
            <option value="refunded">환불</option>
          </select>
        </div>

        {/* Order Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">주문상태</label>
          <select
            value={orderStatusFilter}
            onChange={(e) => {
              const newStatus = e.target.value;
              setOrderStatusFilter(newStatus);
              
              // 발송대기를 선택하면 자동으로 발송대기 탭으로 이동
              if (newStatus === 'seller_shipped') {
                setActiveTab('seller_shipped');
              }
            }}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="scheduled">발송주문</option>
            <option value="delivered">발송완료</option>
          </select>
        </div>

        {/* Seller Shipped Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매자발송</label>
          <select
            value={sellerShippedFilter}
            onChange={(e) => setSellerShippedFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm h-8"
          >
            <option value="all">전체</option>
            <option value="shipped">발송완료</option>
            <option value="not_shipped">미발송</option>
          </select>
        </div>
        </div>
        
        {/* Sort Options */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">정렬:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={sortOrder === 'latest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('latest')}
                className="h-7 text-xs"
              >
                최신순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                onClick={() => setSortOrder('oldest')}
                className="h-7 text-xs"
              >
                오래된순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'delivery-date' ? 'default' : 'outline'}
                onClick={() => setSortOrder('delivery-date')}
                className="h-7 text-xs"
              >
                발송일순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'scheduled-date' ? 'default' : 'outline'}
                onClick={() => setSortOrder('scheduled-date')}
                className="h-7 text-xs"
              >
                예약발송일순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'order-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('order-status')}
                className="h-7 text-xs"
              >
                주문상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'payment-status' ? 'default' : 'outline'}
                onClick={() => setSortOrder('payment-status')}
                className="h-7 text-xs"
              >
                입금상태순
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'order-number' ? 'default' : 'outline'}
                onClick={() => setSortOrder('order-number')}
                className="h-7 text-xs"
              >
                주문접수순
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600">
              검색결과: <span className="font-medium text-gray-900">{allOrders.length}건</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2"
            >
              초기화
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );



  const renderOrdersList = (ordersList: Order[]) => {
    if (ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          해당하는 주문이 없습니다.
        </div>
      );
    }

    return (
      <>


        {/* Desktop Table */}
        <div className="hidden lg:block bg-white rounded-lg border admin-table-container">
          <table className="w-full admin-table">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="col-checkbox text-center">
                  <input
                    type="checkbox"
                    checked={selectedOrderItems.size === ordersList.length && ordersList.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllOrders(ordersList);
                      } else {
                        setSelectedOrderItems(new Set());
                      }
                    }}
                    className="rounded border-gray-300 w-4 h-4"
                    title="삭제용 선택"
                  />
                </th>

                <th className="col-order-number text-left">주문번호</th>
                <th className="col-scheduled-date text-left">예약발송</th>
                <th className="col-customer-name text-left">주문자</th>
                <th className="col-customer-name text-left">예금자</th>
                <th className="col-order-details text-left">주문내역</th>
                <th className="col-phone text-left">연락처</th>
                <th className="col-address text-left">배송주소</th>
                <th className="col-address text-left">메모</th>
                <th className="col-amount text-center text-blue-700">매출</th>
                <th className="col-amount text-center text-green-700">실입금</th>
                <th className="col-amount text-center text-red-700">할인/미입금</th>
                <th className="col-status text-center">입금상태</th>
                <th className="col-status text-center">주문상태</th>
                <th className="col-status text-center">판매자발송</th>
                <th className="col-actions text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {ordersList.map((order: Order) => {
                const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
                return (
                  <tr key={order.id} className={`border-b border-gray-100 ${
                    order.paymentStatus === 'pending' ? 'bg-red-100 hover:bg-red-100' : 
                    order.status === 'seller_shipped' ? 'bg-blue-50 hover:bg-blue-100' : 
                    'hover:bg-gray-50'
                  }`} data-order-id={order.id}>
                    <td className="col-checkbox text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderItems.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300 w-4 h-4"
                        title="삭제용 선택"
                      />
                    </td>

                    <td className="col-order-number">
                      <div className="font-semibold text-gray-900 no-wrap">#{order.orderNumber}</div>
                      <div className="text-xs text-gray-500 no-wrap">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR', { 
                          year: '2-digit', 
                          month: '2-digit', 
                          day: '2-digit' 
                        })}
                      </div>
                      <div className="text-xs text-gray-400 no-wrap">
                        {new Date(order.createdAt).toLocaleTimeString('ko-KR', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false
                        })}시
                      </div>
                    </td>
                    <td className="col-scheduled-date">
                      {order.scheduledDate ? (
                        <div 
                          className="text-xs text-red-600 font-bold cursor-pointer hover:bg-red-50 px-1 py-1 rounded border border-transparent hover:border-red-200"
                          onClick={() => {
                            const scheduledDatePicker = document.querySelector(`[data-order-id="${order.id}"] .scheduled-date-trigger`);
                            if (scheduledDatePicker) {
                              (scheduledDatePicker as HTMLElement).click();
                            }
                          }}
                          title="클릭하여 예약발송일 수정"
                          style={{ whiteSpace: 'nowrap', minWidth: '70px' }}
                        >
                          {new Date(order.scheduledDate).toLocaleDateString('ko-KR', { 
                            year: '2-digit',
                            month: '2-digit', 
                            day: '2-digit' 
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400" style={{ whiteSpace: 'nowrap' }}>-</div>
                      )}
                    </td>

                    <td className="col-customer-name">
                      <div className="font-medium text-xs no-wrap">
                        {order.recipientName && order.recipientName !== order.customerName ? 
                          order.recipientName : order.customerName}
                      </div>
                    </td>
                    <td className="col-customer-name">
                      <div className="text-xs no-wrap">
                        {order.isDifferentDepositor && order.depositorName ? (
                          <span className="text-red-600">{order.depositorName}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="col-order-details">
                      <div className="text-xs space-y-0.5">
                        {(() => {
                          // 동적 상품 이름 가져오기
                          const getProductName = (index: number) => {
                            try {
                              const productNames = Array.isArray(dashboardContent.productNames) 
                                ? dashboardContent.productNames 
                                : JSON.parse(dashboardContent.productNames || '[]');
                              
                              if (productNames[index] && productNames[index].name) {
                                return productNames[index].name;
                              }
                              
                              // 기본값 반환
                              if (index === 0) return '한과1호';
                              if (index === 1) return '한과2호';
                              if (index === 2) return '보자기';
                              return `상품${index + 1}`;
                            } catch (error) {
                              console.error('상품명 파싱 오류:', error);
                              if (index === 0) return '한과1호';
                              if (index === 1) return '한과2호';
                              if (index === 2) return '보자기';
                              return `상품${index + 1}`;
                            }
                          };

                          const details = [];
                          
                          // 기본 상품들
                          if (order.smallBoxQuantity > 0) {
                            details.push(<div key="small">{getProductName(0)}×{order.smallBoxQuantity}개</div>);
                          }
                          if (order.largeBoxQuantity > 0) {
                            details.push(<div key="large">{getProductName(1)}×{order.largeBoxQuantity}개</div>);
                          }
                          if (order.wrappingQuantity > 0) {
                            details.push(<div key="wrapping">{getProductName(2)}×{order.wrappingQuantity}개</div>);
                          }

                          // 동적 상품들
                          if (order.dynamicProductQuantities) {
                            try {
                              const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                ? JSON.parse(order.dynamicProductQuantities) 
                                : order.dynamicProductQuantities;

                              Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                const idx = parseInt(index);
                                const qty = Number(quantity);
                                if (qty > 0 && idx >= 3) { // 인덱스 3부터가 동적 상품
                                  details.push(<div key={`dynamic-${idx}`}>{getProductName(idx)}×{qty}개</div>);
                                }
                              });
                            } catch (error) {
                              console.error('동적 상품 수량 파싱 오류:', error);
                            }
                          }

                          return details.length > 0 ? details : <div>주문상품 없음</div>;
                        })()}
                      </div>
                    </td>
                    <td className="col-phone">
                      <div className="text-xs no-wrap">{order.customerPhone}</div>
                    </td>
                    <td className="col-address">
                      <Dialog>
                        <DialogTrigger asChild>
                          <div>
                            <div 
                              className="text-xs text-gray-900 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded border border-transparent hover:border-blue-200 no-wrap"
                              title="클릭하여 전체 주소 보기"
                            >
                              {order.address1.length > 12 ? `${order.address1.substring(0, 12)}...` : order.address1}
                            </div>
                            {checkRemoteArea(order.address1) && (
                              <div className="text-xs text-red-600 font-bold">배송비추가</div>
                            )}
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>배송 주소</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm font-medium text-gray-700 mb-1">우편번호</div>
                              <div className="text-sm text-gray-900">{order.zipCode}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm font-medium text-gray-700 mb-1">기본 주소</div>
                              <div className="text-sm text-gray-900">{order.address1}</div>
                            </div>
                            {order.address2 && (
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">상세 주소</div>
                                <div className="text-sm text-gray-900">{order.address2}</div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                    <td className="col-address">
                      <div className="text-xs text-gray-600 no-wrap">{order.specialRequests ? 
                        (order.specialRequests.length > 8 ? `${order.specialRequests.substring(0, 8)}...` : order.specialRequests) 
                        : '-'}</div>
                    </td>
                    {/* 매출 */}
                    <td className="col-amount text-center">
                      <div className="text-xs font-medium text-blue-700 no-wrap">
                        {(() => {
                          // 주문 당시 가격을 우선 사용하고, 없으면 현재 설정을 fallback으로 사용
                          const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                            order.smallBoxPrice : 
                            (settings?.find(s => s.key === 'product_0Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_0Price')!.value) : 15000);
                          const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                            order.largeBoxPrice : 
                            (settings?.find(s => s.key === 'product_1Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_1Price')!.value) : 23000);
                          const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                            order.wrappingPrice : 
                            (settings?.find(s => s.key === 'product_2Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_2Price')!.value) : 1000);
                          
                          let recalculatedTotal = 
                            (order.smallBoxQuantity * smallBoxPrice) +
                            (order.largeBoxQuantity * largeBoxPrice) +
                            (order.wrappingQuantity * wrappingPrice);
                          
                          // 동적 상품 가격 추가
                          if (order.dynamicProductQuantities) {
                            try {
                              const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                ? JSON.parse(order.dynamicProductQuantities) 
                                : order.dynamicProductQuantities;
                              
                              Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                const idx = parseInt(index);
                                const qty = Number(quantity);
                                if (qty > 0 && idx >= 3) {
                                  const dynamicPrice = settings?.find(s => s.key === `product_${idx}Price`)?.value ? 
                                    parseInt(settings.find(s => s.key === `product_${idx}Price`)!.value) : 0;
                                  recalculatedTotal += qty * dynamicPrice;
                                }
                              });
                            } catch (error) {
                              console.error('동적 상품 가격 계산 오류:', error);
                            }
                          }
                          
                          // 배송비 추가
                          recalculatedTotal += order.shippingFee || 0;
                          
                          return formatPrice(recalculatedTotal);
                        })()}
                      </div>
                    </td>
                    {/* 실입금 */}
                    <td className="col-amount text-center">
                      {order.paymentStatus === 'confirmed' || order.paymentStatus === 'partial' ? (
                        <div
                          className="text-xs font-medium text-green-700 cursor-pointer hover:bg-green-50 px-1 py-1 rounded border border-transparent hover:border-green-200 no-wrap"
                          onClick={() => {
                            // 주문 당시 가격을 우선 사용 (기본값용)
                            const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                              order.smallBoxPrice : 
                              (settings?.find(s => s.key === 'product_0Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_0Price')!.value) : 15000);
                            const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                              order.largeBoxPrice : 
                              (settings?.find(s => s.key === 'product_1Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_1Price')!.value) : 23000);
                            const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                              order.wrappingPrice : 
                              (settings?.find(s => s.key === 'product_2Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_2Price')!.value) : 1000);
                            
                            let recalculatedTotal = 
                              (order.smallBoxQuantity * smallBoxPrice) +
                              (order.largeBoxQuantity * largeBoxPrice) +
                              (order.wrappingQuantity * wrappingPrice);
                            
                            // 동적 상품 가격 추가
                            if (order.dynamicProductQuantities) {
                              try {
                                const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                  ? JSON.parse(order.dynamicProductQuantities) 
                                  : order.dynamicProductQuantities;
                                
                                Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                  const idx = parseInt(index);
                                  const qty = Number(quantity);
                                  if (qty > 0 && idx >= 3) {
                                    const dynamicPrice = settings?.find(s => s.key === `product_${idx}Price`)?.value ? 
                                      parseInt(settings.find(s => s.key === `product_${idx}Price`)!.value) : 0;
                                    recalculatedTotal += qty * dynamicPrice;
                                  }
                                });
                              } catch (error) {
                                console.error('동적 상품 가격 계산 오류:', error);
                              }
                            }
                            
                            // 배송비 추가
                            recalculatedTotal += order.shippingFee || 0;
                            
                            const currentAmount = order.actualPaidAmount || recalculatedTotal;
                            const newAmount = prompt('실제 입금금액을 입력하세요:', currentAmount.toString());
                            if (newAmount && !isNaN(Number(newAmount))) {
                              handlePaymentStatusChange(order.id, order.paymentStatus, Number(newAmount));
                            }
                          }}
                          title="클릭하여 실제 입금금액 수정"
                        >
                          {(() => {
                            // 주문 당시 가격을 우선 사용 (실입금 기본값용)
                            const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                              order.smallBoxPrice : 
                              (settings?.find(s => s.key === 'product_0Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_0Price')!.value) : 15000);
                            const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                              order.largeBoxPrice : 
                              (settings?.find(s => s.key === 'product_1Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_1Price')!.value) : 23000);
                            const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                              order.wrappingPrice : 
                              (settings?.find(s => s.key === 'product_2Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_2Price')!.value) : 1000);
                            
                            let recalculatedTotal = 
                              (order.smallBoxQuantity * smallBoxPrice) +
                              (order.largeBoxQuantity * largeBoxPrice) +
                              (order.wrappingQuantity * wrappingPrice);
                            
                            // 동적 상품 가격 추가
                            if (order.dynamicProductQuantities) {
                              try {
                                const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                  ? JSON.parse(order.dynamicProductQuantities) 
                                  : order.dynamicProductQuantities;
                                
                                Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                  const idx = parseInt(index);
                                  const qty = Number(quantity);
                                  if (qty > 0 && idx >= 3) {
                                    const dynamicPrice = settings?.find(s => s.key === `product_${idx}Price`)?.value ? 
                                      parseInt(settings.find(s => s.key === `product_${idx}Price`)!.value) : 0;
                                    recalculatedTotal += qty * dynamicPrice;
                                  }
                                });
                              } catch (error) {
                                console.error('동적 상품 가격 계산 오류:', error);
                              }
                            }
                            
                            // 배송비 추가
                            recalculatedTotal += order.shippingFee || 0;
                            
                            return formatPrice(order.actualPaidAmount || recalculatedTotal);
                          })()}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">-</div>
                      )}
                    </td>
                    {/* 할인/미입금 */}
                    <td className="col-amount text-center">
                      <div className="text-xs no-wrap">
                        {order.discountAmount && order.discountAmount > 0 ? (
                          <span className="text-blue-600 font-medium">
                            -{formatPrice(Math.abs(order.discountAmount))}
                          </span>
                        ) : (() => {
                          // 주문 당시 가격으로 미입금액 계산
                          const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                            order.smallBoxPrice : 
                            (settings?.find(s => s.key === 'product_0Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_0Price')!.value) : 15000);
                          const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                            order.largeBoxPrice : 
                            (settings?.find(s => s.key === 'product_1Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_1Price')!.value) : 23000);
                          const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                            order.wrappingPrice : 
                            (settings?.find(s => s.key === 'product_2Price')?.value ? 
                              parseInt(settings.find(s => s.key === 'product_2Price')!.value) : 1000);
                          
                          let recalculatedTotal = 
                            (order.smallBoxQuantity * smallBoxPrice) +
                            (order.largeBoxQuantity * largeBoxPrice) +
                            (order.wrappingQuantity * wrappingPrice);
                          
                          // 동적 상품 가격 추가
                          if (order.dynamicProductQuantities) {
                            try {
                              const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                ? JSON.parse(order.dynamicProductQuantities) 
                                : order.dynamicProductQuantities;
                              
                              Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                const idx = parseInt(index);
                                const qty = Number(quantity);
                                if (qty > 0 && idx >= 3) {
                                  const dynamicPrice = settings?.find(s => s.key === `product_${idx}Price`)?.value ? 
                                    parseInt(settings.find(s => s.key === `product_${idx}Price`)!.value) : 0;
                                  recalculatedTotal += qty * dynamicPrice;
                                }
                              });
                            } catch (error) {
                              console.error('동적 상품 가격 계산 오류:', error);
                            }
                          }
                          
                          // 배송비 추가
                          recalculatedTotal += order.shippingFee || 0;
                          
                          return order.actualPaidAmount && order.actualPaidAmount < recalculatedTotal && !order.discountAmount && (recalculatedTotal - order.actualPaidAmount) > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatPrice(Math.max(0, recalculatedTotal - order.actualPaidAmount))}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="col-status text-center">
                      <Select
                        key={`payment-${order.id}-${order.paymentStatus}`}
                        value={
                          (() => {
                            // 주문 당시 가격으로 부분입금 상태 판단
                            const smallBoxPrice = (order.smallBoxPrice && order.smallBoxPrice > 0) ? 
                              order.smallBoxPrice : 
                              (settings?.find(s => s.key === 'product_0Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_0Price')!.value) : 15000);
                            const largeBoxPrice = (order.largeBoxPrice && order.largeBoxPrice > 0) ? 
                              order.largeBoxPrice : 
                              (settings?.find(s => s.key === 'product_1Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_1Price')!.value) : 23000);
                            const wrappingPrice = (order.wrappingPrice && order.wrappingPrice > 0) ? 
                              order.wrappingPrice : 
                              (settings?.find(s => s.key === 'product_2Price')?.value ? 
                                parseInt(settings.find(s => s.key === 'product_2Price')!.value) : 1000);
                            
                            let recalculatedTotal = 
                              (order.smallBoxQuantity * smallBoxPrice) +
                              (order.largeBoxQuantity * largeBoxPrice) +
                              (order.wrappingQuantity * wrappingPrice);
                            
                            // 동적 상품 가격 추가
                            if (order.dynamicProductQuantities) {
                              try {
                                const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                  ? JSON.parse(order.dynamicProductQuantities) 
                                  : order.dynamicProductQuantities;
                                
                                Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                  const idx = parseInt(index);
                                  const qty = Number(quantity);
                                  if (qty > 0 && idx >= 3) {
                                    const dynamicPrice = settings?.find(s => s.key === `product_${idx}Price`)?.value ? 
                                      parseInt(settings.find(s => s.key === `product_${idx}Price`)!.value) : 0;
                                    recalculatedTotal += qty * dynamicPrice;
                                  }
                                });
                              } catch (error) {
                                console.error('동적 상품 가격 계산 오류:', error);
                              }
                            }
                            
                            // 배송비 추가
                            recalculatedTotal += order.shippingFee || 0;
                            
                            return order.actualPaidAmount && order.actualPaidAmount < recalculatedTotal && !order.discountAmount && order.paymentStatus === 'confirmed'
                              ? 'partial'
                              : order.paymentStatus || 'pending';
                          })()
                        }
                        onValueChange={(newPaymentStatus) => {
                          setTimeout(() => {
                            handlePaymentStatusChange(order.id, newPaymentStatus);
                          }, 0);
                        }}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">입금대기</SelectItem>
                          <SelectItem value="confirmed">입금완료</SelectItem>
                          <SelectItem value="partial">부분결제</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="col-status text-center">
                      <Select
                        key={`status-${order.id}-${order.status}`}
                        value={order.status}
                        onValueChange={(newStatus) => {
                          setTimeout(() => {
                            handleStatusChange(order.id, newStatus);
                          }, 0);
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-24 h-6 text-xs">
                          <SelectValue>
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="seller_shipped">발송대기</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          {/* 관리자는 발송완료로 변경할 수 없음 - 매니저만 가능 */}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="col-status text-center">
                      <div className="text-xs no-wrap">
                        {order.sellerShipped ? (
                          <div className="text-green-600 font-medium">
                            완료
                            {order.sellerShippedDate && (
                              <div 
                                className="text-blue-600 cursor-pointer hover:bg-blue-50 px-1 py-1 rounded no-wrap"
                                onClick={() => {
                                  const sellerShippedDatePicker = document.querySelector(`[data-order-id="${order.id}"] .seller-shipped-date-trigger`);
                                  if (sellerShippedDatePicker) {
                                    (sellerShippedDatePicker as HTMLElement).click();
                                  }
                                }}
                                title="클릭하여 판매자발송일 수정"
                              >
                                {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400">미처리</div>
                        )}
                      </div>
                    </td>
                    <td className="col-actions text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <SmsDialog order={order}>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                            SMS
                          </Button>
                        </SmsDialog>
                        <div className="hidden" data-order-id={order.id}>
                          <DeliveredDatePicker order={order} />
                          <SellerShippedDatePicker order={order} />
                          <ScheduledDatePicker order={order} />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          className="h-6 text-xs px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile List - 간결한 리스트와 확장형 상세 뷰 */}
        <div className="lg:hidden space-y-1">
          {ordersList.map((order: Order) => {
            const StatusIcon = statusIcons[order.status as keyof typeof statusIcons];
            const discountAmount = order.discountAmount || 0;
            const actualPaidAmount = order.actualPaidAmount || order.totalAmount;
            const unpaidAmount = order.totalAmount - actualPaidAmount - discountAmount;
            const isExpanded = expandedOrders.has(order.id);
            
            return (
              <div key={order.id} className={`border border-gray-200 rounded-lg bg-white ${
                order.paymentStatus === 'pending' ? 'border-red-200 bg-red-50' : 
                order.status === 'seller_shipped' ? 'border-blue-200 bg-blue-50' : 
                ''
              }`}>
                {/* 간결한 리스트 뷰 - 항상 표시 */}
                <div 
                  className="p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleOrderExpansion(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedOrderItems.has(order.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleOrderSelection(order.id);
                        }}
                        className="rounded border-gray-300 w-4 h-4"
                        title="삭제용 선택"
                      />
                      <span className="font-bold text-gray-900 text-xs">#{order.orderNumber}</span>
                      <span className="text-gray-700 text-xs">{order.customerName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                        order.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        order.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed' ? '부분결제' :
                         order.paymentStatus === 'confirmed' ? '입금완료' :
                         order.paymentStatus === 'partial' ? '부분결제' :
                         order.paymentStatus === 'refunded' ? '환불' : '미입금'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 text-xs">{formatPrice(order.totalAmount)}</span>
                      <span className="text-xs text-gray-400">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 확장형 상세 뷰 - 클릭시에만 표시 */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    {/* 주문내역 */}
                    <div className="mb-2 pt-2">
                      <div className="text-xs text-gray-700 space-y-0.5 mb-2">
                        {(() => {
                          // 동적 상품 이름 가져오기
                          const getProductName = (index: number) => {
                            try {
                              const productNames = Array.isArray(dashboardContent.productNames) 
                                ? dashboardContent.productNames 
                                : JSON.parse(dashboardContent.productNames || '[]');
                              
                              if (productNames[index] && productNames[index].name) {
                                return productNames[index].name;
                              }
                              
                              // 기본값 반환
                              if (index === 0) return '한과1호';
                              if (index === 1) return '한과2호';
                              if (index === 2) return '보자기';
                              return `상품${index + 1}`;
                            } catch (error) {
                              console.error('상품명 파싱 오류:', error);
                              if (index === 0) return '한과1호';
                              if (index === 1) return '한과2호';
                              if (index === 2) return '보자기';
                              return `상품${index + 1}`;
                            }
                          };

                          const details = [];
                          
                          // 기본 상품들
                          if (order.smallBoxQuantity > 0) {
                            details.push(<div key="small">{getProductName(0)}×{order.smallBoxQuantity}개</div>);
                          }
                          if (order.largeBoxQuantity > 0) {
                            details.push(<div key="large">{getProductName(1)}×{order.largeBoxQuantity}개</div>);
                          }
                          if (order.wrappingQuantity > 0) {
                            details.push(<div key="wrapping">{getProductName(2)}×{order.wrappingQuantity}개</div>);
                          }

                          // 동적 상품들
                          if (order.dynamicProductQuantities) {
                            try {
                              const dynamicQuantities = typeof order.dynamicProductQuantities === 'string' 
                                ? JSON.parse(order.dynamicProductQuantities) 
                                : order.dynamicProductQuantities;

                              Object.entries(dynamicQuantities).forEach(([index, quantity]) => {
                                const idx = parseInt(index);
                                const qty = Number(quantity);
                                if (qty > 0 && idx >= 3) { // 인덱스 3부터가 동적 상품
                                  details.push(<div key={`dynamic-${idx}`}>{getProductName(idx)}×{qty}개</div>);
                                }
                              });
                            } catch (error) {
                              console.error('동적 상품 수량 파싱 오류:', error);
                            }
                          }

                          return details.length > 0 ? details : <div>주문상품 없음</div>;
                        })()}
                      </div>
                      <div className="flex justify-end">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          order.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'seller_shipped' ? 'bg-purple-100 text-purple-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {order.status === 'scheduled' ? '발송주문' :
                           order.status === 'delivered' ? '발송완료' :
                           order.status === 'seller_shipped' ? '발송대기' : '주문접수'}
                        </span>
                      </div>
                    </div>

                    {/* 연락처, 주소 */}
                    <div className="text-xs text-gray-700 mb-2">
                      <div>연락처: {order.customerPhone}</div>
                      <div>배송지: {order.address1} {order.address2}</div>
                      {order.depositorName && order.depositorName !== order.customerName && (
                        <div>예금자: {order.depositorName}</div>
                      )}
                    </div>



                    {/* 특별 정보 */}
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                      {order.scheduledDate && (
                        <span className="bg-orange-100 px-1 py-0.5 rounded text-orange-700">
                          예약: {new Date(order.scheduledDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </span>
                      )}

                      {order.sellerShippedDate && (
                        <span className="bg-blue-100 px-1 py-0.5 rounded text-blue-700">
                          발송: {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </span>
                      )}
                      {order.specialRequests && (
                        <span className="bg-yellow-100 px-1 py-0.5 rounded text-yellow-800">
                          요청: {order.specialRequests}
                        </span>
                      )}
                    </div>

                    {/* 상태 변경 및 액션 버튼 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Select
                        value={
                          order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount && order.paymentStatus === 'confirmed'
                            ? 'partial'
                            : order.paymentStatus || 'pending'
                        }
                        onValueChange={(newPaymentStatus) => handlePaymentStatusChange(order.id, newPaymentStatus)}
                        disabled={updatePaymentMutation.isPending}
                      >
                        <SelectTrigger className="w-full text-xs h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">입금대기</SelectItem>
                          <SelectItem value="confirmed">입금완료</SelectItem>
                          <SelectItem value="partial">부분결제</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={order.status}
                        onValueChange={(newStatus) => updateStatusMutation.mutate({ id: order.id, status: newStatus })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-full text-xs h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">주문접수</SelectItem>
                          <SelectItem value="scheduled">발송주문</SelectItem>
                          <SelectItem value="seller_shipped">발송대기</SelectItem>
                          {/* 관리자는 발송완료로 변경할 수 없음 - 매니저만 가능 */}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <SmsDialog order={order}>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                            SMS
                          </Button>
                        </SmsDialog>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order.id);
                          }}
                          disabled={deleteOrderMutation.isPending}
                          className="text-xs h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <input
                          type="checkbox"
                          checked={selectedShippingItems.has(order.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleShippingSelection(order.id);
                          }}
                          className="rounded border-gray-300 w-4 h-4"
                          disabled={order.sellerShipped || false}
                          title={order.sellerShipped ? "이미 발송됨" : "발송용 선택"}
                        />
                        <span className="text-xs text-gray-500">발송선택</span>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(order.id);
                        }}
                        disabled={deleteOrderMutation.isPending}
                        className="text-xs h-7 px-2"
                      >
                        삭제
                      </Button>
                    </div>

                    {/* 숨겨진 date picker들 */}
                    <div className="hidden" data-order-id={order.id}>
                      <DeliveredDatePicker order={order} />
                      <SellerShippedDatePicker order={order} />
                      <ScheduledDatePicker order={order} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };



  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      api.orders.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "상태 업데이트",
        description: "주문 상태가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // Seller shipped mutation
  const updateSellerShippedMutation = useMutation({
    mutationFn: (orderIds: number[]) => api.orders.updateSellerShipped(orderIds),
    onSuccess: async (updatedOrder, orderIds) => {
      // First update seller shipped status
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Then automatically update order status to delivered for each order
      if (Array.isArray(orderIds)) {
        orderIds.forEach(orderId => {
          updateStatusMutation.mutate({ id: orderId, status: 'delivered' });
        });
      }
      
      toast({
        title: "판매자 발송 완료",
        description: "판매자 발송이 완료되고 주문상태가 발송완료로 변경되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "판매자 발송 상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkSellerShippedMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      return api.patch('/api/orders/seller-shipped', { orderIds });
    },
    onSuccess: (data, orderIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedShippingItems(new Set());
      toast({
        title: "일괄 발송 완료",
        description: `${orderIds.length}개 주문이 발송완료로 변경되었습니다.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "일괄 발송 실패",
        description: error.message || "일괄 발송 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus, actualPaidAmount, discountAmount }: { id: number; paymentStatus: string; actualPaidAmount?: number; discountAmount?: number }) => {
      console.log(`API 호출: updatePaymentStatus(${id}, ${paymentStatus}, ${actualPaidAmount}, ${discountAmount})`);
      return api.orders.updatePaymentStatus(id, paymentStatus, actualPaidAmount, discountAmount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "입금 상태 업데이트",
        description: "입금 상태가 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "입금 상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // Handle payment confirmation with actual amount and discount reason
  const handlePaymentConfirmation = (actualPaidAmount: number, discountReason: string) => {
    if (selectedOrderForPayment) {
      updatePaymentMutation.mutate({
        id: selectedOrderForPayment.id,
        paymentStatus: 'confirmed',
        actualPaidAmount,
        discountAmount: 0 // Default value
      });
      setSelectedOrderForPayment(null);
    }
  };

  // Open payment confirmation dialog
  const openPaymentDialog = (order: Order) => {
    setSelectedOrderForPayment(order);
    setShowPaymentDialog(true);
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    // 관리자는 발송완료(delivered) 상태로 변경할 수 없음 - 매니저만 가능
    if (newStatus === 'delivered') {
      toast({
        title: "권한 없음",
        description: "발송완료 처리는 매니저만 할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handlePaymentStatusChange = (orderId: number, newPaymentStatus: string, actualAmount?: number, discountAmount?: number) => {
    if (actualAmount !== undefined) {
      // 실제 입금 금액이 제공된 경우 바로 업데이트
      updatePaymentMutation.mutate({ 
        id: orderId, 
        paymentStatus: newPaymentStatus,
        actualPaidAmount: actualAmount,
        discountAmount: discountAmount
      });
    } else if (newPaymentStatus === 'confirmed') {
      // 입금완료 선택시 PaymentDetailsDialog 열기
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
        setSelectedOrderForPayment(order);
        setShowPaymentDetailsDialog(true);
      }
    } else if (newPaymentStatus === 'partial') {
      // 부분결제 선택시도 실제 입금금액 입력 다이얼로그 열기
      const order = orders.find((o: Order) => o.id === orderId);
      if (order) {
        openPaymentDialog(order);
      }
    } else {
      // 입금대기로 변경시 입금금액과 할인금액 초기화
      if (newPaymentStatus === 'pending') {
        console.log(`입금대기로 변경: 주문 ID ${orderId}, 실입금 0으로, 할인 0으로 설정`);
        updatePaymentMutation.mutate({ 
          id: orderId, 
          paymentStatus: newPaymentStatus,
          actualPaidAmount: 0,
          discountAmount: 0
        });
      } else {
        console.log(`결제 상태 변경: 주문 ID ${orderId}, 상태 ${newPaymentStatus}`);
        // 다른 상태는 바로 업데이트
        updatePaymentMutation.mutate({ id: orderId, paymentStatus: newPaymentStatus });
      }
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    if (confirm("정말로 이 주문을 삭제하시겠습니까?")) {
      deleteOrderMutation.mutate(orderId);
    }
  };

  const handleSellerShipped = (orderId: number) => {
    updateSellerShippedMutation.mutate([orderId]);
  };

  const handleExcelDownload = async () => {
    try {
      const response = await fetch('/api/orders/export/excel');
      if (!response.ok) {
        throw new Error('엑셀 파일 다운로드에 실패했습니다');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `에덴한과_주문목록_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "다운로드 완료",
        description: "엑셀 파일이 성공적으로 다운로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "엑셀 파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price) || price < 0) return '0원';
    return `${Math.round(price).toLocaleString()}원`;
  };



  // Calculate stats with actual payment information
  const stats = orders.reduce(
    (acc: any, order: Order) => {
      acc.total++;
      acc[order.status as keyof typeof acc]++;
      if (order.paymentStatus === 'confirmed') acc.paidOrders++;
      if (order.paymentStatus === 'pending') acc.unpaidOrders++;
      if (order.paymentStatus === 'partial') acc.partialOrders++;
      
      // Financial calculations based on actual payment data
      acc.totalRevenue += order.totalAmount;
      
      // Add actual revenue calculations
      if (order.actualPaidAmount) {
        acc.actualRevenue += order.actualPaidAmount;
      } else if (order.paymentStatus === 'confirmed') {
        acc.actualRevenue += order.totalAmount;
      }
      
      // Track discounts and partial payments
      if (order.discountAmount && order.discountAmount > 0) {
        acc.totalDiscounts += order.discountAmount;
      }
      
      if (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) {
        acc.totalPartialUnpaid += (order.totalAmount - order.actualPaidAmount);
      }
      
      // Track net profit
      if (order.netProfit !== undefined && order.netProfit !== null) {
        acc.totalNetProfit += order.netProfit;
      }
      
      return acc;
    },
    { 
      total: 0, 
      pending: 0, 
      scheduled: 0, 
      seller_shipped: 0,
      delivered: 0, 
      paidOrders: 0, 
      unpaidOrders: 0,
      partialOrders: 0,
      totalRevenue: 0,
      actualRevenue: 0,
      totalDiscounts: 0,
      totalPartialUnpaid: 0,
      totalNetProfit: 0
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eden-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eden-brown mx-auto mb-4"></div>
          <p className="text-eden-dark">주문 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eden-cream">
      <AdminHeader 
        handleExcelDownload={handleExcelDownload}
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        costSettingsDialog={<PriceSettingsDialog />}
        passwordChangeDialog={<PasswordChangeDialog />}
      />
      <div className="container mx-auto p-2 sm:p-4 md:p-6">



        {/* Orders List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="font-korean text-lg md:text-xl">주문 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown mx-auto mb-4"></div>
                <div className="text-gray-500">주문 목록을 불러오는 중...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <div className="mb-2">주문 목록을 불러오는 중 오류가 발생했습니다.</div>
                <div className="text-sm text-gray-500">{error.message}</div>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="mt-4"
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* 모바일에서는 3줄로 나누어 표시 - 설정 탭 추가 */}
                <div className="block md:hidden">
                  <TabsList className="grid w-full grid-cols-4 mb-2">
                    <TabsTrigger value="all" className="text-sm px-1">전체 ({allOrders.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="text-sm px-1">주문접수 ({pendingOrders.length})</TabsTrigger>
                    <TabsTrigger value="seller_shipped" className="text-sm px-1">발송대기 ({sellerShippedOrders.length})</TabsTrigger>
                    <TabsTrigger value="scheduled" className="text-sm px-1">발송주문 ({scheduledOrders.length})</TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-3 mb-2">
                    <TabsTrigger value="delivered" className="text-sm px-1">발송완료 ({deliveredOrders.length})</TabsTrigger>
                    <TabsTrigger value="refunded" className="text-red-600 text-sm px-1">
                      환불내역 ({refundedOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="revenue" className="text-purple-600 text-sm px-1">
                      <DollarSign className="h-3 w-3 mr-1" />
                      매출관리
                    </TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-4 mb-2">
                    <TabsTrigger value="customers" className="text-blue-600 text-xs px-1">
                      <Users className="h-3 w-3 mr-1" />
                      고객관리
                    </TabsTrigger>
                    <TabsTrigger value="members" className="text-green-600 text-xs px-1">
                      <Key className="h-3 w-3 mr-1" />
                      회원관리
                    </TabsTrigger>
                    <TabsTrigger value="security" className="text-red-600 text-xs px-1">
                      <Shield className="h-3 w-3 mr-1" />
                      보안관리
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-orange-600 text-xs px-1">
                      <Cog className="h-3 w-3 mr-1" />
                      콘텐츠 및 상품관리
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* 데스크톱에서는 한 줄로 표시 */}
                <div className="hidden md:block">
                  <TabsList className="grid w-full grid-cols-11">
                    <TabsTrigger value="all" className="text-sm">전체 ({allOrders.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="text-sm">주문접수 ({pendingOrders.length})</TabsTrigger>
                    <TabsTrigger value="seller_shipped" className="text-sm">발송대기 ({sellerShippedOrders.length})</TabsTrigger>
                    <TabsTrigger value="scheduled" className="text-sm">발송주문 ({scheduledOrders.length})</TabsTrigger>
                    <TabsTrigger value="delivered" className="text-sm">발송완료 ({deliveredOrders.length})</TabsTrigger>
                    <TabsTrigger value="refunded" className="text-red-600 text-sm">환불내역 ({refundedOrders.length})</TabsTrigger>
                    <TabsTrigger value="revenue" className="text-purple-600 text-sm">매출관리</TabsTrigger>
                    <TabsTrigger value="customers" className="text-blue-600 text-sm">고객관리</TabsTrigger>
                    <TabsTrigger value="members" className="text-green-600 text-sm">회원관리</TabsTrigger>
                    <TabsTrigger value="security" className="text-red-600 text-sm">보안관리</TabsTrigger>
                    <TabsTrigger value="settings" className="text-orange-600 text-sm">콘텐츠 및 상품관리</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="all" className="mt-6">
                  {renderOrderFilters()}
                  
                  {/* 모바일 일괄 관리 버튼들 */}
                  <div className="lg:hidden mb-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportToExcel(allOrders, "전체주문목록")}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        엑셀
                      </Button>
                      {selectedShippingItems.size > 0 && (
                        <Button
                          size="sm"
                          onClick={() => bulkSellerShippedMutation.mutate(Array.from(selectedShippingItems))}
                          disabled={bulkSellerShippedMutation.isPending}
                          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700"
                        >
                          <Truck className="h-3 w-3" />
                          일괄발송 ({selectedShippingItems.size})
                        </Button>
                      )}
                      {selectedOrderItems.size > 0 && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                              bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                            }
                          }}
                          disabled={bulkDeleteMutation.isPending}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                          일괄삭제 ({selectedOrderItems.size})
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      총 {allOrders.length}개 주문
                      {selectedOrderItems.size > 0 && ` • 삭제선택: ${selectedOrderItems.size}개`}
                      {selectedShippingItems.size > 0 && ` • 발송선택: ${selectedShippingItems.size}개`}
                    </div>
                  </div>
                  
                  {/* 데스크톱 일괄 관리 */}
                  <div className="hidden lg:flex justify-between items-center mb-4">
                    <div className="text-xs md:text-sm text-gray-600">
                      총 {allOrders.length}개 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(allOrders, "전체주문목록")}
                      className="flex items-center gap-2 text-xs md:text-sm"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(allOrders)}
                </TabsContent>
                
                <TabsContent value="pending" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {pendingOrders.length}개 주문접수 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(pendingOrders, "주문접수목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(pendingOrders)}
                </TabsContent>
                
                <TabsContent value="seller_shipped" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {sellerShippedOrders.length}개 발송대기 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(sellerShippedOrders, "발송대기목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(sellerShippedOrders)}
                </TabsContent>
                
                <TabsContent value="scheduled" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {scheduledOrders.length}개 발송주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(scheduledOrders, "발송주문목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(scheduledOrders)}
                </TabsContent>
                
                <TabsContent value="delivered" className="mt-6">
                  {renderOrderFilters()}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      총 {deliveredOrders.length}개 발송완료 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(deliveredOrders, "발송완료목록")}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(deliveredOrders)}
                </TabsContent>



                <TabsContent value="refunded" className="mt-6">
                  {renderOrderFilters()}
                  {refundedOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      환불된 주문이 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-gray-600">
                          총 {refundedOrders.length}개 환불 주문
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportToExcel(refundedOrders, "환불내역목록")}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          엑셀 다운로드
                        </Button>
                      </div>
                      {selectedOrderItems.size > 0 && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-red-700">
                              {selectedOrderItems.size}개 주문이 선택되었습니다
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedOrderItems(new Set())}
                              >
                                선택 해제
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                    bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                                  }
                                }}
                                disabled={bulkDeleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                일괄 삭제
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {renderOrdersList(refundedOrders)}
                    </>
                  )}
                </TabsContent>
                
                <TabsContent value="orders" className="mt-6">
                  {renderOrderFilters()}
                  
                  {/* 모바일 일괄 관리 */}
                  <div className="lg:hidden mb-4">
                    <div className="text-xs text-gray-600 mb-2">
                      총 {allOrders.length}개 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(allOrders, "전체주문목록")}
                      className="flex items-center gap-2 text-xs w-full"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>

                  {/* 데스크톱 일괄 관리 */}
                  <div className="hidden lg:flex justify-between items-center mb-4">
                    <div className="text-xs md:text-sm text-gray-600">
                      총 {allOrders.length}개 주문
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportToExcel(allOrders, "전체주문목록")}
                      className="flex items-center gap-2 text-xs md:text-sm"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  </div>
                  {selectedOrderItems.size > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-red-700">
                          {selectedOrderItems.size}개 주문이 선택되었습니다
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderItems(new Set())}
                          >
                            선택 해제
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`선택된 ${selectedOrderItems.size}개 주문을 삭제하시겠습니까?`)) {
                                bulkDeleteMutation.mutate(Array.from(selectedOrderItems));
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            일괄 삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {renderOrdersList(allOrders)}
                </TabsContent>

                <TabsContent value="revenue" className="mt-6">
                  {renderRevenueReport()}
                </TabsContent>
                
                <TabsContent value="customers" className="mt-6">
                  <CustomerManagement />
                </TabsContent>

                <TabsContent value="members" className="mt-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-korean text-lg md:text-xl flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          회원관리
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <UserManagement />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="font-korean text-lg md:text-xl flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              통합 보안 관리
                            </CardTitle>
                            <p className="text-sm text-gray-600">
                              보안 설정, 활성 세션, 로그인 기록, 접근 제어를 한 화면에서 관리할 수 있습니다.
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            onClick={() => setActiveTab("all")}
                            className="flex items-center gap-2"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            뒤로가기
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-8">
                          {/* 보안설정 섹션 */}
                          <div>
                            <h3 className="text-lg font-medium mb-4 flex items-center">
                              <Key className="h-5 w-5 mr-2" />
                              보안 설정
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="flex flex-col space-y-4">
                                <PasswordChangeDialog 
                                  triggerComponent={
                                    <Button variant="outline" className="w-full justify-start">
                                      <Key className="h-4 w-4 mr-2" />
                                      비밀번호 변경
                                    </Button>
                                  }
                                />
                                
                                <div className="border rounded-lg p-4">
                                  <h4 className="font-medium mb-2 flex items-center">
                                    <Shield className="h-4 w-4 mr-2" />
                                    계정 보안 상태
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span>현재 활성 세션</span>
                                      <Badge variant="outline">{sessions.length}개</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>접근 제어 활성화</span>
                                      <Badge variant={accessSettings?.isEnabled ? "default" : "secondary"}>
                                        {accessSettings?.isEnabled ? "활성" : "비활성"}
                                      </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>최대 동시 세션</span>
                                      <span>{accessSettings?.maxConcurrentSessions || 3}개</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* 활성세션 섹션 */}
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-medium flex items-center">
                                <Monitor className="h-5 w-5 mr-2" />
                                활성 세션
                              </h3>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] })}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                새로고침
                              </Button>
                            </div>
                            
                            {sessionsLoading ? (
                              <div className="text-center py-8">세션 정보를 불러오는 중...</div>
                            ) : sessions.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                활성 세션이 없습니다.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {sessions.map((session) => (
                                  <div key={session.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          {getDeviceIcon(session.deviceType)}
                                          <span className="font-medium">
                                            {getDeviceTypeLabel(session.deviceType)}
                                          </span>
                                          {session.isCurrent && (
                                            <Badge variant="default" className="text-xs">현재 세션</Badge>
                                          )}
                                        </div>
                                        
                                        <div className="text-sm text-gray-600 space-y-1">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3 w-3" />
                                            <span>{session.location || '알 수 없음'}</span>
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {session.ipAddress}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            마지막 활동: {format(new Date(session.lastActivity), 'PPpp', { locale: ko })}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {!session.isCurrent && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => terminateSessionMutation.mutate(session.sessionId)}
                                          disabled={terminateSessionMutation.isPending}
                                          className="text-red-600 border-red-300 hover:bg-red-50"
                                        >
                                          <X className="h-4 w-4 mr-1" />
                                          종료
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Separator />

                          {/* 로그인기록 섹션 */}
                          <div>
                            <h3 className="text-lg font-medium mb-4 flex items-center">
                              <Activity className="h-5 w-5 mr-2" />
                              로그인 기록
                            </h3>
                            
                            {historyLoading ? (
                              <div className="text-center py-8">로그인 기록을 불러오는 중...</div>
                            ) : loginHistory.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                아직 로그인 기록이 없습니다.
                              </div>
                            ) : (
                              <div className="space-y-4 max-h-96 overflow-y-auto">
                                {loginHistory.slice(0, 10).map((attempt) => (
                                  <div key={attempt.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          {getDeviceIcon(attempt.deviceType)}
                                          <Badge
                                            variant={attempt.success ? "default" : "destructive"}
                                            className="text-xs"
                                          >
                                            {attempt.success ? '성공' : '실패'}
                                          </Badge>
                                          {attempt.deviceType && (
                                            <span className="text-sm text-gray-600">
                                              {getDeviceTypeLabel(attempt.deviceType)}
                                            </span>
                                          )}
                                        </div>
                                        
                                        <div className="text-sm text-gray-600 space-y-1">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3 w-3" />
                                            <span>{attempt.location || '알 수 없음'}</span>
                                            <span className="text-gray-400">•</span>
                                            <span>{attempt.ipAddress}</span>
                                          </div>
                                          {!attempt.success && attempt.failureReason && (
                                            <div className="text-red-600 text-xs">
                                              실패 사유: {attempt.failureReason}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="text-xs text-gray-500">
                                        {format(new Date(attempt.createdAt), 'PPpp', { locale: ko })}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Separator />

                          {/* 접근제어 섹션 */}
                          <div>
                            <h3 className="text-lg font-medium mb-4 flex items-center">
                              <Lock className="h-5 w-5 mr-2" />
                              접근 제어 설정
                            </h3>
                            
                            {settingsLoading ? (
                              <div className="text-center py-8">설정을 불러오는 중...</div>
                            ) : (
                              <div className="space-y-6">
                                {/* 접근 제어 활성화 */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-base font-medium">접근 제어 활성화</Label>
                                    <p className="text-sm text-gray-600">
                                      접근 제어 규칙을 활성화합니다
                                    </p>
                                  </div>
                                  <Switch
                                    checked={accessSettings?.isEnabled || false}
                                    onCheckedChange={(checked) => updateSetting('isEnabled', checked)}
                                  />
                                </div>

                                <Separator />

                                {/* 허용된 IP 범위 */}
                                <div className="space-y-3">
                                  <Label className="text-base font-medium">허용된 IP 범위</Label>
                                  <p className="text-sm text-gray-600">
                                    특정 IP 주소나 IP 범위에서만 로그인을 허용합니다
                                  </p>
                                  
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="예: 192.168.1.* 또는 192.168.1.100"
                                      value={newIpRange}
                                      onChange={(e) => setNewIpRange(e.target.value)}
                                      onKeyPress={(e) => e.key === 'Enter' && addIpRange()}
                                    />
                                    <Button onClick={addIpRange} disabled={!newIpRange.trim()}>
                                      추가
                                    </Button>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    {accessSettings?.allowedIpRanges?.map((ipRange, index) => (
                                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                        <span className="text-sm">{ipRange}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeIpRange(index)}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <Separator />

                                {/* 허용된 디바이스 타입 */}
                                <div className="space-y-3">
                                  <Label className="text-base font-medium">허용된 디바이스 타입</Label>
                                  <p className="text-sm text-gray-600">
                                    특정 디바이스 타입에서만 로그인을 허용합니다
                                  </p>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    {['mobile', 'desktop', 'tablet', 'laptop'].map((deviceType) => (
                                      <div key={deviceType} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={deviceType}
                                          checked={accessSettings?.allowedDeviceTypes?.includes(deviceType) || false}
                                          onChange={(e) => {
                                            const currentTypes = accessSettings?.allowedDeviceTypes || [];
                                            const newTypes = e.target.checked
                                              ? [...currentTypes, deviceType]
                                              : currentTypes.filter(t => t !== deviceType);
                                            updateSetting('allowedDeviceTypes', newTypes);
                                          }}
                                          className="rounded"
                                        />
                                        <label htmlFor={deviceType} className="text-sm">
                                          {getDeviceTypeLabel(deviceType)}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <Separator />

                                {/* 최대 동시 세션 수 */}
                                <div className="space-y-3">
                                  <Label className="text-base font-medium">최대 동시 세션 수</Label>
                                  <p className="text-sm text-gray-600">
                                    동시에 로그인할 수 있는 세션의 최대 개수
                                  </p>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={accessSettings?.maxConcurrentSessions || 3}
                                    onChange={(e) => updateSetting('maxConcurrentSessions', parseInt(e.target.value))}
                                    className="w-24"
                                  />
                                </div>

                                <Separator />

                                {/* 세션 타임아웃 */}
                                <div className="space-y-3">
                                  <Label className="text-base font-medium">세션 타임아웃 (시간)</Label>
                                  <p className="text-sm text-gray-600">
                                    세션이 자동으로 만료되는 시간
                                  </p>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="168"
                                    value={accessSettings?.sessionTimeout || 24}
                                    onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                                    className="w-24"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="trash" className="mt-6">
                  {isLoadingTrash ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eden-brown mx-auto mb-4"></div>
                      <div className="text-gray-500">휴지통을 불러오는 중...</div>
                    </div>
                  ) : trashError ? (
                    <div className="text-center py-8 text-red-500">
                      <div className="mb-2">휴지통을 불러오는 중 오류가 발생했습니다.</div>
                      <div className="text-sm text-gray-500">{trashError.message}</div>
                    </div>
                  ) : (
                    renderTrashOrdersList(deletedOrders)
                  )}
                </TabsContent>



                <TabsContent value="settings" className="mt-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-korean text-lg md:text-xl flex items-center gap-2">
                          <Cog className="h-5 w-5" />
                          시스템 설정
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* 컴팩트한 설정 버튼들 */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          <PriceSettingsDialog />
                          <AdminInfoSettingsDialog />
                          <PasswordChangeDialog 
                            triggerComponent={
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                비밀번호 변경
                              </Button>
                            }
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            새로고침
                          </Button>
                        </div>

                        {/* 컴팩트한 현재 설정값 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-gray-900">현재 설정값</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                            {settings && settings.map((setting) => (
                              <div key={setting.id} className="bg-gray-50 rounded p-2 text-center">
                                <div className="text-gray-600 truncate text-xs">{setting.description}</div>
                                <div className="font-medium text-gray-900">
                                  {setting.key.includes('Cost') || setting.key.includes('Fee') || setting.key.includes('Threshold') 
                                    ? `${parseInt(setting.value).toLocaleString()}원`
                                    : setting.value
                                  }
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="mt-6">
                  <div className="bg-white rounded-lg border border-gray-200">
                    {/* 헤더 */}
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        <Edit className="h-5 w-5" />
                        콘텐츠 및 상품 관리
                      </h2>
                      <Button
                        onClick={() => {
                          if (confirm('모든 콘텐츠를 기본값으로 완전히 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                            const defaultContent = {
                              smallBoxName: "한과1호(약 1.1kg)",
                              largeBoxName: "한과2호(약 1.3kg)", 
                              smallBoxDimensions: "약 35.5×21×11.2cm",
                              largeBoxDimensions: "약 37×23×11.5cm",
                              wrappingName: "보자기",
                              wrappingPrice: "개당 +1,000원",
                              mainTitle: "진안에서 온 정성 가득 유과",
                              mainDescription: "부모님이 100% 국내산 찹쌀로 직접 만드는 찹쌀유과\\n달지않고 고소한 맛이 일품! 선물로도 완벽한 에덴한과 ^^",
                              heroImages: [],
                              aboutText: "이든 한과는 전통 방식으로 만든 건강한 한과입니다.",
                              bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)",
                              bankMessage: "주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다"
                            };
                            setDashboardContent({...dashboardContent, ...defaultContent});
                            // 각각 업데이트
                            Object.entries(defaultContent).forEach(([key, value]) => {
                              updateContentMutation.mutate({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
                            });
                            toast({ title: "모든 콘텐츠가 기본값으로 초기화되었습니다." });
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        전체되돌리기
                      </Button>
                    </div>
                    
                    <div className="p-4 space-y-6">
                        <div className="space-y-6">
                          {/* 상품 정보 관리 */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900">상품 정보 관리</h3>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    try {
                                      await updateContentMutation.mutateAsync({ 
                                        key: 'productNames', 
                                        value: JSON.stringify(dashboardContent.productNames) 
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                      toast({
                                        title: "저장 완료",
                                        description: "모든 상품 정보가 저장되었습니다.",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "저장 실패",
                                        description: "상품 정보 저장 중 오류가 발생했습니다.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  전체저장
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (confirm('모든 상품 정보를 기본값으로 되돌리시겠습니까?')) {
                                      const defaultProductNames = [
                                        { name: '한과1호', price: '20000', cost: '5000', size: '(10cm × 7cm × 7cm)', weight: '300g' },
                                        { name: '한과2호', price: '30000', cost: '7000', size: '(14.5cm × 7cm × 7cm)', weight: '450g' },
                                        { name: '보자기', price: '1000', cost: '200', size: '', weight: '' }
                                      ];
                                      setDashboardContent({...dashboardContent, productNames: defaultProductNames});
                                      updateContentMutation.mutate({ 
                                        key: 'productNames', 
                                        value: JSON.stringify(defaultProductNames) 
                                      });
                                      updateContentMutation.mutate({ key: 'wrappingName', value: "보자기" });
                                      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  전체초기화
                                </Button>
                                <Button
                                  onClick={() => {
                                    const newProductNames = [...(dashboardContent.productNames || []), { name: '', price: '0', cost: '0', size: '', weight: '' }];
                                    setDashboardContent({...dashboardContent, productNames: newProductNames});
                                    updateContentMutation.mutate({ 
                                      key: 'productNames', 
                                      value: JSON.stringify(newProductNames) 
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  상품 추가
                                </Button>
                              </div>
                            </div>
                            
                            {/* Dynamic Product List with Pricing - Table Format */}
                            <div className="border rounded-lg overflow-hidden bg-white">
                              <table className="w-full">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-16">#</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">상품명</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">크기/규격</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">중량</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-36">작업</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(dashboardContent.productNames || []).map((product: any, index: number) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                                        {index + 1}
                                      </td>
                                      <td className="px-4 py-3">
                                        <Input
                                          value={product.name || ''}
                                          onChange={(e) => {
                                            const newProductNames = [...dashboardContent.productNames];
                                            newProductNames[index] = {...newProductNames[index], name: e.target.value};
                                            setDashboardContent({...dashboardContent, productNames: newProductNames});
                                          }}
                                          placeholder="상품명"
                                          className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <Input
                                          value={product.size || ''}
                                          onChange={(e) => {
                                            const newProductNames = [...dashboardContent.productNames];
                                            newProductNames[index] = {...newProductNames[index], size: e.target.value};
                                            setDashboardContent({...dashboardContent, productNames: newProductNames});
                                          }}
                                          placeholder="(가로×세로×높이)"
                                          className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <Input
                                          value={product.weight || ''}
                                          onChange={(e) => {
                                            const newProductNames = [...dashboardContent.productNames];
                                            newProductNames[index] = {...newProductNames[index], weight: e.target.value};
                                            setDashboardContent({...dashboardContent, productNames: newProductNames});
                                          }}
                                          placeholder="중량"
                                          className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        />
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex gap-1 justify-center">
                                          <Button
                                            size="sm"
                                            onClick={async () => {
                                              const buttonKey = `product-${index}`;
                                              if (savingButtons[buttonKey]) return;
                                              
                                              setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                              
                                              try {
                                                await updateContentMutation.mutateAsync({ 
                                                  key: 'productNames', 
                                                  value: JSON.stringify(dashboardContent.productNames) 
                                                });
                                                queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                                toast({
                                                  title: "상품 정보 저장 완료",
                                                  description: `${product.name} 정보가 업데이트되었습니다.`,
                                                });
                                              } catch (error) {
                                                toast({
                                                  title: "저장 실패",
                                                  description: "상품 정보 저장 중 오류가 발생했습니다.",
                                                  variant: "destructive"
                                                });
                                              } finally {
                                                setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                              }
                                            }}
                                            disabled={savingButtons[`product-${index}`]}
                                            variant="ghost"
                                            className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                          >
                                            <Save className="h-3 w-3 mr-1" />
                                            {savingButtons[`product-${index}`] ? '저장중' : '저장'}
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                              toast({
                                                title: "되돌리기 완료",
                                                description: `${product.name} 정보가 되돌려졌습니다.`,
                                              });
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                          >
                                            <Undo className="h-3 w-3 mr-1" />
                                            되돌리기
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              const newProductNames = dashboardContent.productNames.filter((_: any, i: number) => i !== index);
                                              setDashboardContent({...dashboardContent, productNames: newProductNames});
                                              updateContentMutation.mutate({ 
                                                key: 'productNames', 
                                                value: JSON.stringify(newProductNames) 
                                              });
                                              queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              
                              {(!dashboardContent.productNames || dashboardContent.productNames.length === 0) && (
                                <div className="text-center py-8 text-gray-500">
                                  <p className="text-sm">등록된 상품이 없습니다.</p>
                                  <p className="text-xs">상품 추가 버튼을 클릭하여 새 상품을 추가하세요.</p>
                                </div>
                              )}
                            </div>
                            
                            {/* 가격 설정 안내 */}
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Calculator className="h-4 w-4 text-blue-600" />
                                <h4 className="text-sm font-medium text-blue-800">가격 관리 안내</h4>
                              </div>
                              <p className="text-sm text-blue-700">
                                상품의 <strong>판매가와 원가</strong>는 <strong>"가격 설정"</strong> 탭에서 관리할 수 있습니다.
                                <br />
                                이곳에서는 상품명, 크기, 중량 등의 기본 정보만 수정하세요.
                              </p>
                            </div>

                          </div>

                          {/* 메인 콘텐츠 */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900">메인 콘텐츠</h3>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    try {
                                      const mainContentData = {
                                        mainTitle: dashboardContent.mainTitle,
                                        mainDescription: dashboardContent.mainDescription,
                                        heroImages: dashboardContent.heroImages,
                                        aboutText: dashboardContent.aboutText,
                                        logoUrl: dashboardContent.logoUrl
                                      };
                                      
                                      await Promise.all(Object.entries(mainContentData).map(([key, value]) =>
                                        updateContentMutation.mutateAsync({ key, value: typeof value === 'string' ? value : JSON.stringify(value) })
                                      ));
                                      
                                      toast({
                                        title: "저장 완료",
                                        description: "메인 콘텐츠가 모두 저장되었습니다.",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "저장 실패",
                                        description: "메인 콘텐츠 저장 중 오류가 발생했습니다.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  전체저장
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (confirm('기본값으로 되돌리시겠습니까?')) {
                                      const defaults = {
                                        mainTitle: "진안에서 온 정성 가득 유과",
                                        mainDescription: "부모님이 100% 국내산 찹쌀로 직접 만드는 찹쌀유과\\n달지않고 고소한 맛이 일품! 선물로도 완벽한 에덴한과 ^^",
                                        heroImages: [] as string[],
                                        aboutText: "이든 한과는 전통 방식으로 만든 건강한 한과입니다.",
                                        logoUrl: ""
                                      };
                                      setDashboardContent({...dashboardContent, ...defaults});
                                      Object.entries(defaults).forEach(([key, value]) => {
                                        updateContentMutation.mutate({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  전체초기화
                                </Button>
                              </div>
                            </div>
                            
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-32">항목</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">내용</th>
                                    <th className="px-4 py-3 text-center font-medium text-gray-700 w-32">작업</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">메인 제목</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.mainTitle}
                                        onChange={(e) => setDashboardContent({...dashboardContent, mainTitle: e.target.value})}
                                        placeholder="메인 제목 (줄바꿈 가능)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={2}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'mainTitle';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'mainTitle', 
                                                value: dashboardContent.mainTitle 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "제목 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "오류",
                                                description: "저장 실패",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['mainTitle']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['mainTitle'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "제목 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">
                                      <div>
                                        메인 제목 스타일
                                        <div className="text-xs text-gray-500 mt-1">
                                          글씨 크기, 색상, 정렬을 설정합니다
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">글씨 크기</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle).fontSize : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
                                              } catch {
                                                return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle) : {fontSize: '', color: 'text-eden-brown', textAlign: 'text-center'};
                                                const newStyle = {...currentStyle, fontSize: e.target.value};
                                                updateDashboardContent('mainTitleStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-lg">작게</option>
                                            <option value="text-xl md:text-2xl">중간</option>
                                            <option value="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">크게</option>
                                            <option value="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">매우 크게</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">색상</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle).color : 'text-eden-brown';
                                              } catch {
                                                return 'text-eden-brown';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle) : {fontSize: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl', color: '', textAlign: 'text-center'};
                                                const newStyle = {...currentStyle, color: e.target.value};
                                                updateDashboardContent('mainTitleStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-eden-brown">갈색 (기본)</option>
                                            <option value="text-eden-dark">진한 갈색</option>
                                            <option value="text-eden-sage">녹색</option>
                                            <option value="text-black">검정</option>
                                            <option value="text-gray-700">회색</option>
                                            <option value="text-eden-red">빨강</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">정렬</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle).textAlign : 'text-center';
                                              } catch {
                                                return 'text-center';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainTitleStyle ? JSON.parse(dashboardContent.mainTitleStyle) : {fontSize: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl', color: 'text-eden-brown', textAlign: ''};
                                                const newStyle = {...currentStyle, textAlign: e.target.value};
                                                updateDashboardContent('mainTitleStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-left">왼쪽</option>
                                            <option value="text-center">가운데</option>
                                            <option value="text-right">오른쪽</option>
                                          </select>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">
                                      <div>
                                        메인 설명 스타일
                                        <div className="text-xs text-gray-500 mt-1">
                                          글씨 크기, 색상, 정렬을 설정합니다
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">글씨 크기</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle).fontSize : 'text-sm sm:text-base md:text-lg';
                                              } catch {
                                                return 'text-sm sm:text-base md:text-lg';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle) : {fontSize: '', color: 'text-eden-dark', textAlign: 'text-center'};
                                                const newStyle = {...currentStyle, fontSize: e.target.value};
                                                updateDashboardContent('mainDescriptionStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-xs sm:text-sm">작게</option>
                                            <option value="text-sm sm:text-base md:text-lg">중간 (기본)</option>
                                            <option value="text-base sm:text-lg md:text-xl">크게</option>
                                            <option value="text-lg sm:text-xl md:text-2xl">매우 크게</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">색상</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle).color : 'text-eden-dark';
                                              } catch {
                                                return 'text-eden-dark';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle) : {fontSize: 'text-sm sm:text-base md:text-lg', color: '', textAlign: 'text-center'};
                                                const newStyle = {...currentStyle, color: e.target.value};
                                                updateDashboardContent('mainDescriptionStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-eden-dark">진한 갈색 (기본)</option>
                                            <option value="text-eden-brown">갈색</option>
                                            <option value="text-eden-sage">녹색</option>
                                            <option value="text-black">검정</option>
                                            <option value="text-gray-700">회색</option>
                                            <option value="text-gray-600">연한 회색</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600 block mb-1">정렬</label>
                                          <select 
                                            value={(() => {
                                              try {
                                                return dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle).textAlign : 'text-center';
                                              } catch {
                                                return 'text-center';
                                              }
                                            })()}
                                            onChange={(e) => {
                                              try {
                                                const currentStyle = dashboardContent.mainDescriptionStyle ? JSON.parse(dashboardContent.mainDescriptionStyle) : {fontSize: 'text-sm sm:text-base md:text-lg', color: 'text-eden-dark', textAlign: ''};
                                                const newStyle = {...currentStyle, textAlign: e.target.value};
                                                updateDashboardContent('mainDescriptionStyle', JSON.stringify(newStyle));
                                              } catch {}
                                            }}
                                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="text-left">왼쪽</option>
                                            <option value="text-center">가운데</option>
                                            <option value="text-right">오른쪽</option>
                                          </select>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">
                                      <div>
                                        브랜드명
                                        <div className="text-xs text-gray-500 mt-1">
                                          헤더에 표시되는 브랜드명입니다
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="text"
                                          placeholder="예: 에덴한과"
                                          value={editingValues.brandName ?? dashboardContent.brandName ?? "에덴한과"}
                                          onChange={(e) => setEditingValues({...editingValues, brandName: e.target.value})}
                                          className="flex-1 h-8 text-sm"
                                        />
                                        <Button
                                          onClick={() => updateDashboardContent('brandName', editingValues.brandName ?? dashboardContent.brandName ?? "에덴한과")}
                                          size="sm"
                                          disabled={savingButtons['brandName']}
                                          className="h-8 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['brandName'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            setEditingValues({...editingValues, brandName: "에덴한과"});
                                            updateDashboardContent('brandName', "에덴한과");
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          원상태
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">
                                      <div>
                                        헤더 로고
                                        <div className="text-xs text-gray-500 mt-1">
                                          브랜드명 왼쪽에 표시되는 나뭇잎 로고
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-4">
                                        {dashboardContent.logoUrl && (
                                          <div className="flex items-center gap-2">
                                            <img 
                                              src={dashboardContent.logoUrl} 
                                              alt="Current logo" 
                                              className="h-12 w-12 object-contain border rounded"
                                            />
                                            <span className="text-sm text-gray-600">현재 로고</span>
                                          </div>
                                        )}
                                        <ObjectUploader
                                          maxNumberOfFiles={1}
                                          maxFileSize={5485760} // 5MB
                                          onGetUploadParameters={async () => {
                                            const response = await fetch('/api/logo/upload-url', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include'
                                            });
                                            const { uploadURL } = await response.json();
                                            return { method: 'PUT', url: uploadURL };
                                          }}
                                          onComplete={async (result) => {
                                            if (result.successful && result.successful[0]) {
                                              const uploadedFile = result.successful[0];
                                              const logoUrl = uploadedFile.uploadURL?.split('?')[0]; // Remove query params
                                              
                                              // Update logo URL in content
                                              await fetch('/api/logo', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ logoUrl })
                                              });
                                              
                                              setDashboardContent({...dashboardContent, logoUrl});
                                              
                                              toast({
                                                title: "로고 업로드 완료",
                                                description: "새 나뭇잎 로고가 업로드되었습니다.",
                                              });
                                            }
                                          }}
                                          buttonClassName="h-8 px-3 text-xs"
                                        >
                                          <Upload className="h-3 w-3 mr-1" />
                                          로고 업로드
                                        </ObjectUploader>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          onClick={() => {
                                            if (confirm('로고를 원상태로 복원하시겠습니까? (기본 나뭇잎 아이콘만 표시)')) {
                                              setDashboardContent({...dashboardContent, logoUrl: ''});
                                              updateContentMutation.mutate({ key: 'logoUrl', value: '' });
                                              toast({
                                                title: "원상태 복원",
                                                description: "기본 나뭇잎 아이콘으로 복원되었습니다.",
                                              });
                                            }
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          원상태 복원
                                        </Button>
                                        {dashboardContent.logoUrl && (
                                          <Button
                                            onClick={() => {
                                              if (confirm('현재 로고를 삭제하시겠습니까?')) {
                                                setDashboardContent({...dashboardContent, logoUrl: ''});
                                                updateContentMutation.mutate({ key: 'logoUrl', value: '' });
                                                toast({
                                                  title: "로고 삭제됨",
                                                  description: "로고가 제거되었습니다.",
                                                });
                                              }
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            삭제
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">메인 설명</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.mainDescription}
                                        onChange={(e) => setDashboardContent({...dashboardContent, mainDescription: e.target.value})}
                                        placeholder="메인 설명 (줄바꿈 가능)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={3}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'mainDescription';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'mainDescription', 
                                                value: dashboardContent.mainDescription 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "설명 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "오류",
                                                description: "저장 실패",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['mainDescription']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['mainDescription'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "설명 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">히어로 이미지</td>
                                    <td className="px-4 py-3">
                                      <div className="space-y-2">
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          multiple
                                          onChange={handleImageUpload}
                                          className="cursor-pointer text-xs border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                          disabled={dashboardContent.heroImages.length >= 8}
                                        />
                                        
                                        {dashboardContent.heroImages.length > 0 && (
                                          <div className="grid grid-cols-4 gap-1">
                                            {dashboardContent.heroImages.map((imageUrl, index) => (
                                              <div key={index} className="relative group">
                                                <img 
                                                  src={imageUrl} 
                                                  alt={`이미지 ${index + 1}`} 
                                                  className="w-full h-12 object-cover rounded border"
                                                />
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  onClick={() => removeImage(index)}
                                                  className="absolute top-0 right-0 w-3 h-3 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <X className="h-2 w-2" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        
                                        <div className="flex justify-between text-xs text-gray-500">
                                          <span>최대 8개</span>
                                          <span>{dashboardContent.heroImages.length}/8</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'heroImages';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'heroImages', 
                                                value: JSON.stringify(dashboardContent.heroImages)
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "이미지 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['heroImages']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['heroImages'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "이미지 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">소개글</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.aboutText}
                                        onChange={(e) => setDashboardContent({...dashboardContent, aboutText: e.target.value})}
                                        placeholder="소개 텍스트"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={2}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'aboutText';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'aboutText', 
                                                value: dashboardContent.aboutText 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "소개글 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['aboutText']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['aboutText'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "소개글 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>



                          {/* 배송 정보 */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900">배송 정보</h3>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    try {
                                      const shippingData = {
                                        shippingTitle: dashboardContent.shippingTitle,
                                        shippingInfo: dashboardContent.shippingInfo
                                      };
                                      
                                      await Promise.all(Object.entries(shippingData).map(([key, value]) =>
                                        updateContentMutation.mutateAsync({ key, value })
                                      ));
                                      
                                      toast({
                                        title: "저장 완료",
                                        description: "배송 정보가 모두 저장되었습니다.",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "저장 실패",
                                        description: "배송 정보 저장 중 오류가 발생했습니다.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  전체저장
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (confirm('기본값으로 되돌리시겠습니까?')) {
                                      const defaults = {
                                        shippingTitle: "에덴한과 배송",
                                        shippingInfo: "• 물건은 입금 확인 후 1~2일 이내 발송합니다.\n• 설 명절 1~2주 전은 택배사의 과부하로 배송이 늦어질 수 있습니다.\n• 주문 접수 후 3일 이내 미도착시 반드시 연락주세요.\n• 설날 명절 2주 전에는 미리 주문 부탁드려요.\n• 미리 주문 시 예약발송 가능합니다."
                                      };
                                      setDashboardContent({...dashboardContent, ...defaults});
                                      Object.entries(defaults).forEach(([key, value]) => {
                                        updateContentMutation.mutate({ key, value });
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  전체초기화
                                </Button>
                              </div>
                            </div>
                            
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-32">항목</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">내용</th>
                                    <th className="px-4 py-3 text-center font-medium text-gray-700 w-32">작업</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">배송 제목</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.shippingTitle || ''}
                                        onChange={(e) => setDashboardContent({...dashboardContent, shippingTitle: e.target.value})}
                                        placeholder="에덴한과 배송 (줄바꿈 가능)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={2}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'shippingTitle';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'shippingTitle', 
                                                value: dashboardContent.shippingTitle || '' 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "배송 제목 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['shippingTitle']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['shippingTitle'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "배송 제목 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">배송 안내 내용</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.shippingInfo}
                                        onChange={(e) => setDashboardContent({...dashboardContent, shippingInfo: e.target.value})}
                                        placeholder="배송 안내 (줄바꿈 가능, • 로 시작하면 리스트로 표시)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={4}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'shippingInfo';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'shippingInfo', 
                                                value: dashboardContent.shippingInfo 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "배송 안내 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['shippingInfo']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['shippingInfo'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "배송 안내 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 계좌 정보 */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900">계좌 정보</h3>
                              <div className="flex gap-2">
                                <Button
                                  onClick={async () => {
                                    try {
                                      const accountData = {
                                        bankAccount: dashboardContent.bankAccount,
                                        bankMessage: dashboardContent.bankMessage
                                      };
                                      
                                      await Promise.all(Object.entries(accountData).map(([key, value]) =>
                                        updateContentMutation.mutateAsync({ key, value })
                                      ));
                                      
                                      toast({
                                        title: "저장 완료",
                                        description: "계좌 정보가 모두 저장되었습니다.",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "저장 실패",
                                        description: "계좌 정보 저장 중 오류가 발생했습니다.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  전체저장
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (confirm('기본값으로 되돌리시겠습니까?')) {
                                      const defaults = {
                                        bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)",
                                        bankMessage: "주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다"
                                      };
                                      setDashboardContent({...dashboardContent, ...defaults});
                                      Object.entries(defaults).forEach(([key, value]) => {
                                        updateContentMutation.mutate({ key, value });
                                      });
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  전체초기화
                                </Button>
                              </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-32">항목</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-700">내용</th>
                                    <th className="px-4 py-3 text-center font-medium text-gray-700 w-32">작업</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">입금 계좌</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.bankAccount}
                                        onChange={(e) => setDashboardContent({...dashboardContent, bankAccount: e.target.value})}
                                        placeholder="농협 352-1701-3342-63&#10;(예금주: 손*진)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={2}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'bankAccount';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'bankAccount', 
                                                value: dashboardContent.bankAccount 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "계좌 정보 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['bankAccount']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['bankAccount'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "계좌 정보 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  <tr>
                                    <td className="px-4 py-3 font-medium text-gray-600">입금 안내 메시지</td>
                                    <td className="px-4 py-3">
                                      <Textarea
                                        value={dashboardContent.bankMessage}
                                        onChange={(e) => setDashboardContent({...dashboardContent, bankMessage: e.target.value})}
                                        placeholder="주문 후 위 계좌로 입금해 주시면&#10;확인 후 발송해 드립니다 (줄바꿈 가능)"
                                        className="text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-transparent"
                                        rows={3}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          size="sm"
                                          onClick={async () => {
                                            const buttonKey = 'bankMessage';
                                            if (savingButtons[buttonKey]) return;
                                            
                                            setSavingButtons(prev => ({...prev, [buttonKey]: true}));
                                            
                                            try {
                                              await updateContentMutation.mutateAsync({ 
                                                key: 'bankMessage', 
                                                value: dashboardContent.bankMessage 
                                              });
                                              toast({
                                                title: "저장됨",
                                                description: "안내 메시지 저장 완료",
                                              });
                                            } catch (error) {
                                              toast({
                                                title: "저장 실패",
                                                description: "저장 중 오류가 발생했습니다.",
                                                variant: "destructive"
                                              });
                                            } finally {
                                              setSavingButtons(prev => ({...prev, [buttonKey]: false}));
                                            }
                                          }}
                                          disabled={savingButtons['bankMessage']}
                                          variant="ghost"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Save className="h-3 w-3 mr-1" />
                                          {savingButtons['bankMessage'] ? '저장중' : '저장'}
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard-content'] });
                                            toast({
                                              title: "되돌림",
                                              description: "안내 메시지 복원 완료",
                                            });
                                          }}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                                        >
                                          <Undo className="h-3 w-3 mr-1" />
                                          되돌리기
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

      </div>
      {/* Payment Confirmation Dialog */}
      <PaymentConfirmDialog
        order={selectedOrderForPayment}
        open={showPaymentDialog}
        setOpen={setShowPaymentDialog}
        onConfirm={handlePaymentConfirmation}
      />
      {/* Payment Details Dialog - for confirmed payment */}
      {selectedOrderForPayment && (
        <PaymentDetailsDialog 
          order={selectedOrderForPayment} 
          open={showPaymentDetailsDialog}
          setOpen={setShowPaymentDetailsDialog}
          onUpdate={(orderId, paymentStatus, actualPaidAmount, discountAmount) => {
            handlePaymentStatusChange(orderId, paymentStatus, actualPaidAmount, discountAmount);
            setSelectedOrderForPayment(null);
            setShowPaymentDetailsDialog(false);
          }} 
        />
      )}
    </div>
  );
}
