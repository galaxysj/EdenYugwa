import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AdminHeader } from "@/components/admin-header";
import type { Order, Setting, DashboardContent, User } from "@shared/schema";
import * as XLSX from 'xlsx';

// 가격 포맷팅 함수
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
};

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
  const [actualPaidAmount, setActualPaidAmount] = useState(order.actualPaidAmount?.toString() || order.totalAmount.toString());
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
            주문번호: {order.orderNumber} | 총 주문금액: {formatPriceLocal(order.totalAmount)}
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
              미입금: {formatPriceLocal(Math.max(0, order.totalAmount - (Number(actualPaidAmount) || 0) - (Number(discountAmount) || 0)))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1 btn-dynamic-sm">
              확인
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 btn-dynamic-sm">
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
                                      description: ''
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

  const expectedAmount = order.totalAmount;
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
              <div><strong>주문금액:</strong> {order.totalAmount.toLocaleString()}원</div>
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
  const { user, logout } = useAuth();
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
    // 팝업 관련 설정
    popupEnabled: false,
    popupTitle: "",
    popupContent: "",
    popupButtonText: "확인",
    // 텍스트 스타일 설정
    mainTitleColor: "#8B4513",
    mainTitleSize: "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
    mainTitleAlign: "text-center",
    mainTitleFont: "font-korean",
    mainDescriptionColor: "#6b7280",
    mainDescriptionSize: "text-sm sm:text-base md:text-lg",
    mainDescriptionAlign: "text-center",
    mainDescriptionFont: "font-korean"
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
        // 텍스트 스타일 설정 로딩
        if (item.key === 'mainTitleColor') updatedContent.mainTitleColor = item.value;
        if (item.key === 'mainTitleSize') updatedContent.mainTitleSize = item.value;
        if (item.key === 'mainTitleAlign') updatedContent.mainTitleAlign = item.value;
        if (item.key === 'mainTitleFont') updatedContent.mainTitleFont = item.value;
        if (item.key === 'mainDescriptionColor') updatedContent.mainDescriptionColor = item.value;
        if (item.key === 'mainDescriptionSize') updatedContent.mainDescriptionSize = item.value;
        if (item.key === 'mainDescriptionAlign') updatedContent.mainDescriptionAlign = item.value;
        if (item.key === 'mainDescriptionFont') updatedContent.mainDescriptionFont = item.value;
        // 팝업 관련 데이터 로딩
        if (item.key === 'popupEnabled') updatedContent.popupEnabled = item.value === 'true';
        if (item.key === 'popupTitle') updatedContent.popupTitle = item.value;
        if (item.key === 'popupContent') updatedContent.popupContent = item.value;
        if (item.key === 'popupButtonText') updatedContent.popupButtonText = item.value;
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
      // 순수익 = 총매출 - 원가 - 할인금액 - 미입금금액
      const discountAmount = order.discountAmount || 0;
      const actualPaid = order.actualPaidAmount || order.totalAmount;
      const unpaidAmount = (actualPaid < order.totalAmount && !discountAmount) 
        ? (order.totalAmount - actualPaid) : 0;
      const netProfit = order.totalAmount - totalCost - discountAmount - unpaidAmount;
      
      return {
        '주문번호': order.orderNumber,
        '주문일': new Date(order.createdAt).toLocaleDateString('ko-KR'),
        '주문시간': new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        '고객명': order.customerName,
        '받는분': order.recipientName || order.customerName,
        '전화번호': order.customerPhone,
        '주소': `${order.address1} ${order.address2 || ''}`.trim(),
        '상품': [
          order.smallBoxQuantity > 0 ? `한과한과1호(약1.1kg)×${order.smallBoxQuantity}개` : '',
          order.largeBoxQuantity > 0 ? `한과한과2호(약2.5kg)×${order.largeBoxQuantity}개` : '',
          order.wrappingQuantity > 0 ? `보자기×${order.wrappingQuantity}개` : ''
        ].filter(Boolean).join(', '),
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
      acc.totalAmount += order.totalAmount;
      acc.actualRevenue += order.actualPaidAmount || order.totalAmount;
      acc.totalDiscounts += order.discountAmount || 0;
      acc.totalPartialUnpaid += (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
        ? (order.totalAmount - order.actualPaidAmount) : 0;
      
      // Calculate net profit dynamically including shipping costs
      const orderRevenue = order.actualPaidAmount || order.totalAmount;
      const orderDiscounts = order.discountAmount || 0;
      
      // Use historical pricing and cost data stored in the order for accurate calculations
      // If no historical cost, use current dynamic costs
      const smallBoxCost = order.smallBoxQuantity * (order.smallBoxCost || smallBoxCostValue);
      const largeBoxCost = order.largeBoxQuantity * (order.largeBoxCost || largeBoxCostValue);
      const wrappingCost = order.wrappingQuantity * (order.wrappingCost || wrappingCostValue);
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
      
      const smallBoxPrice = order.smallBoxPrice || currentSmallPrice;
      const largeBoxPrice = order.largeBoxPrice || currentLargePrice;
      const wrappingPrice = order.wrappingPrice || currentWrappingPrice;
      
      // Calculate total order cost including shipping
      const totalOrderCost = smallBoxCost + largeBoxCost + wrappingCost + shippingCost;
      acc.totalCost += totalOrderCost;
      
      // Calculate net profit for this order
      acc.netProfit += orderRevenue - totalOrderCost - orderDiscounts;
      
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
              <h3 className="admin-text-sm font-bold text-eden-red mb-2">
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
                          <div className="font-semibold text-gray-700 mb-1 admin-text-xxs">주문건수</div>
                          <div className="admin-text-xs font-bold text-gray-800">{filteredTotals.count}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-amber-700 mb-1 admin-text-xxs">한과1호</div>
                          <div className="admin-text-xs font-bold text-amber-600">{filteredTotals.smallBoxQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-orange-700 mb-1 admin-text-xxs">한과2호</div>
                          <div className="admin-text-xs font-bold text-orange-600">{filteredTotals.largeBoxQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-eden-brown mb-1 admin-text-xxs">보자기</div>
                          <div className="admin-text-xs font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</div>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-700 mb-1 admin-text-xxs">택배건수</div>
                          <div className="admin-text-xs font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-red-700 mb-1 admin-text-xxs">환불건수</div>
                          <div className="admin-text-xs font-bold text-red-600">{refundedOrders.length}건</div>
                        </div>
                        <div>
                          <div className="font-semibold text-green-700 mb-1 admin-text-xxs">실제입금</div>
                          <div className="admin-text-xs font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-red-700 mb-1 admin-text-xxs">총원가</div>
                          <div className="admin-text-xs font-bold text-red-600">{formatPrice(filteredTotals.totalCost)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-purple-700 mb-1 admin-text-xxs">순수익</div>
                          <div className={`admin-text-xs font-bold ${(filteredTotals.totalAmount - filteredTotals.totalCost - filteredTotals.totalDiscounts) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
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
                            <div className={`font-semibold text-${colorClass}-700 mb-1 admin-text-xs`}>
                              {product.name}
                            </div>
                            <div className={`admin-text-sm font-bold text-${colorClass}-600`}>
                              {quantity}개
                            </div>
                          </div>
                        );
                      })}
                      
                      <div>
                        <div className="font-semibold text-blue-700 mb-1 admin-text-xs">택배건수</div>
                        <div className="admin-text-sm font-bold text-blue-600">{filteredTotals.shippingOrders}건</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-red-700 mb-1 admin-text-xs">환불건수</div>
                        <div className="admin-text-sm font-bold text-red-600">{refundedOrders.length}건</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-green-700 mb-1 admin-text-xs">실제입금</div>
                        <div className="admin-text-sm font-bold text-green-600">{formatPrice(filteredTotals.actualRevenue)}</div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-red-700 mb-1 admin-text-xs">총원가</div>
                        <div className="admin-text-sm font-bold text-red-600">
                          {formatPrice(filteredTotals.totalCost)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-semibold text-purple-700 mb-1 admin-text-xs">순수익</div>
                        <div className={`admin-text-sm font-bold ${filteredTotals.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                          {formatPrice(filteredTotals.netProfit)}
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
                        <div className={`text-sm md:text-lg font-bold ${filteredTotals.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                          {formatPrice(filteredTotals.netProfit)}
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
                  <div className="text-green-600 admin-text-xs font-medium mb-1">실제입금</div>
                  <div className="text-green-700 admin-text-sm font-bold">{formatPrice(filteredTotals.actualRevenue)}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-red-600 admin-text-xs font-medium mb-1">총원가</div>
                  <div className="text-red-700 admin-text-sm font-bold">{formatPrice(filteredTotals.totalCost)}</div>
                </div>
                <div className={`border rounded-lg p-3 text-center ${filteredTotals.netProfit >= 0 ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`admin-text-xs font-medium mb-1 ${filteredTotals.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>순수익</div>
                  <div className={`admin-text-sm font-bold ${filteredTotals.netProfit >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                    {formatPrice(filteredTotals.netProfit)}
                  </div>
                </div>
              </div>

              {/* 상세 정보 리스트 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="admin-text-xs text-gray-600">주문건수</span>
                  <span className="admin-text-sm font-bold text-gray-800">{filteredTotals.count}건</span>
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
                            <span className="admin-text-xs text-amber-600">한과1호</span>
                            <span className="admin-text-sm font-bold text-amber-700">{filteredTotals.smallBoxQuantity}개</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-200">
                            <span className="admin-text-xs text-orange-600">한과2호</span>
                            <span className="admin-text-sm font-bold text-orange-700">{filteredTotals.largeBoxQuantity}개</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-200">
                            <span className="admin-text-xs text-eden-brown">보자기</span>
                            <span className="admin-text-sm font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</span>
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
                          <span className={`admin-text-xs text-${colorClass}-600`}>
                            {product.name}
                          </span>
                          <span className={`admin-text-sm font-bold text-${colorClass}-700`}>
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
                          <span className="admin-text-xs text-amber-600">한과1호</span>
                          <span className="admin-text-sm font-bold text-amber-700">{filteredTotals.smallBoxQuantity}개</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="admin-text-xs text-orange-600">한과2호</span>
                          <span className="admin-text-sm font-bold text-orange-700">{filteredTotals.largeBoxQuantity}개</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="admin-text-xs text-eden-brown">보자기</span>
                          <span className="admin-text-sm font-bold text-eden-brown">{filteredTotals.wrappingQuantity}개</span>
                        </div>
                      </>
                    );
                  }
                })()}
                
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="admin-text-xs text-gray-600">택배건수</span>
                  <span className="admin-text-sm font-bold text-gray-700">{filteredTotals.shippingOrders}건</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="admin-text-xs text-gray-600">환불건수</span>
                  <span className="admin-text-sm font-bold text-gray-700">{refundedOrders.length}건</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 새로운 매출 상세내역 표 */}
        {orders.length > 0 && (
          <Card className="border-gray-200">
            <CardHeader className="bg-gray-50">
              <CardTitle className="flex items-center justify-between">
                <span className="admin-text-sm text-gray-800">📊 매출 상세내역</span>
                <span className="admin-text-xxs font-normal text-gray-600 bg-white px-2 py-1 rounded">
                  {orders.length}건
                </span>
              </CardTitle>
              <p className="admin-text-xxs text-gray-700 mt-1">
                매출 분석을 위한 주문별 상세 정보 (새로 최적화된 반응형 표)
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* 새로운 반응형 매출 상세내역 표 */}
              <div className="overflow-x-auto hidden md:block">
                <table className="admin-revenue-table w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="col-order-num admin-table-header text-left font-bold text-gray-800 border-r border-gray-300">주문번호</th>
                      <th className="col-customer admin-table-header text-left font-bold text-gray-800 border-r border-gray-300">고객명</th>
                      <th className="col-date admin-table-header text-left font-bold text-gray-800 border-r border-gray-300">주문일</th>
                      <th className="col-items admin-table-header text-left font-bold text-gray-800 border-r border-gray-300">주문내역</th>
                      <th className="col-revenue admin-table-header text-center font-bold text-gray-800 border-r border-gray-300">매출정보</th>
                      <th className="col-payment admin-table-header text-center font-bold text-gray-800 border-r border-gray-300">입금정보</th>
                      <th className="col-discount admin-table-header text-center font-bold text-gray-800 border-r border-gray-300">할인/미납</th>
                      <th className="col-cost admin-table-header text-center font-bold text-gray-800 border-r border-gray-300">원가분석</th>
                      <th className="col-profit admin-table-header text-center font-bold text-gray-800">순수익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((order: Order) => {
                        // 상품명 함수
                        const getOrderTimeProductName = (index: number, fallback: string) => {
                          if (dashboardContent.productNames && dashboardContent.productNames[index]) {
                            return dashboardContent.productNames[index].name;
                          }
                          return fallback;
                        };

                        // 가격 계산
                        const productNames = dashboardContent.productNames || [];
                        const smallBoxPrice = order.smallBoxPrice || smallBoxPriceValue || 
                                            (productNames[0]?.price ? parseInt(productNames[0].price) : 19000);
                        const largeBoxPrice = order.largeBoxPrice || largeBoxPriceValue || 
                                            (productNames[1]?.price ? parseInt(productNames[1].price) : 21000);
                        const wrappingPrice = order.wrappingPrice || wrappingPriceValue || 
                                            (productNames[2]?.price ? parseInt(productNames[2].price) : 1000);
                        
                        const shippingFee = order.shippingFee || 0;
                        
                        // 원가 계산
                        const getEffectiveCost = (orderCost: number | null | undefined, settingValue: number | null, productCost?: string) => {
                          if (orderCost && orderCost > 0) return orderCost;
                          if (settingValue && settingValue > 0) return settingValue;
                          if (productCost && parseInt(productCost) > 0) return parseInt(productCost);
                          return 0;
                        };
                        
                        const smallCost = getEffectiveCost(order.smallBoxCost, smallBoxCostValue, productNames[0]?.cost);
                        const largeCost = getEffectiveCost(order.largeBoxCost, largeBoxCostValue, productNames[1]?.cost);
                        const wrappingCost = getEffectiveCost(order.wrappingCost, wrappingCostValue, productNames[2]?.cost);
                        
                        // 동적 상품 원가 계산
                        let dynamicProductsCost = 0;
                        if (order.dynamicProductQuantities) {
                          try {
                            const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                              ? JSON.parse(order.dynamicProductQuantities) 
                              : order.dynamicProductQuantities;
                            Object.entries(dynamicQty).forEach(([index, quantity]) => {
                              const productIndex = parseInt(index);
                              const qty = Number(quantity);
                              const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
                              const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                                (productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
                              dynamicProductsCost += qty * productCost;
                            });
                          } catch (error) {
                            console.error('Dynamic product cost calculation error:', error);
                          }
                        }
                        
                        // 할인 및 미납 계산
                        const discountAmount = order.discountAmount || 0;
                        const unpaidAmount = (order.actualPaidAmount && order.actualPaidAmount < order.totalAmount && !order.discountAmount) 
                          ? (order.totalAmount - order.actualPaidAmount) : 0;
                        
                        // 총 원가 및 순수익 계산
                        const totalCost = order.smallBoxQuantity * smallCost + order.largeBoxQuantity * largeCost + 
                                        order.wrappingQuantity * wrappingCost + dynamicProductsCost + shippingFee;
                        const netProfit = order.totalAmount - totalCost - discountAmount - unpaidAmount;

                        return (
                          <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                            {/* 주문번호 */}
                            <td className="col-order-num admin-table-cell font-semibold text-gray-900 border-r border-gray-200">
                              #{order.orderNumber}
                            </td>
                            
                            {/* 고객명 */}
                            <td className="col-customer admin-table-cell font-medium text-gray-900 border-r border-gray-200">
                              {order.customerName}
                            </td>
                            
                            {/* 주문일 */}
                            <td className="col-date admin-table-cell text-gray-700 border-r border-gray-200">
                              <div className="font-medium">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
                              <div className="admin-table-cell text-gray-500">{new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            
                            {/* 주문내역 */}
                            <td className="col-items admin-table-cell border-r border-gray-200">
                              <div className="space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="font-medium text-gray-800 admin-table-cell">{getOrderTimeProductName(0, '한과1호')} × {order.smallBoxQuantity}개</div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="font-medium text-gray-800 admin-table-cell">{getOrderTimeProductName(1, '한과2호')} × {order.largeBoxQuantity}개</div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="font-medium text-gray-800 admin-table-cell">{getOrderTimeProductName(2, '보자기')} × {order.wrappingQuantity}개</div>
                                )}
                                {/* 동적 상품들 */}
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
                                        <div key={productIndex} className="font-medium text-gray-800 admin-table-cell">
                                          {productName} × {qty}개
                                        </div>
                                      ) : null;
                                    });
                                  } catch (error) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </td>
                            
                            {/* 매출정보 */}
                            <td className="col-revenue admin-table-cell text-center font-medium bg-blue-50 border-r border-gray-200">
                              <div className="text-gray-700 font-semibold admin-table-cell">
                                {formatPrice(order.totalAmount)}
                              </div>
                              <div className="admin-table-cell text-gray-600 mt-1">
                                주문금액
                              </div>
                            </td>
                            
                            {/* 입금정보 */}
                            <td className="col-payment admin-table-cell text-center font-medium bg-green-50 border-r border-gray-200">
                              <div className="text-gray-700 font-semibold admin-table-cell">
                                {order.actualPaidAmount ? formatPrice(order.actualPaidAmount) : formatPrice(order.totalAmount)}
                              </div>
                              <div className="admin-table-cell text-gray-600 mt-1">
                                실제입금
                              </div>
                            </td>
                            
                            {/* 할인/미납 */}
                            <td className="col-discount admin-table-cell text-center bg-yellow-50 border-r border-gray-200">
                              {discountAmount > 0 ? (
                                <div>
                                  <div className="text-orange-600 font-semibold admin-table-cell">
                                    {formatPrice(discountAmount)}
                                  </div>
                                  <div className="admin-table-cell text-gray-600 mt-1">
                                    할인금액
                                  </div>
                                </div>
                              ) : unpaidAmount > 0 ? (
                                <div>
                                  <div className="text-red-600 font-semibold admin-table-cell">
                                    {formatPrice(unpaidAmount)}
                                  </div>
                                  <div className="admin-table-cell text-gray-600 mt-1">
                                    미입금액
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-gray-500 font-semibold admin-table-cell">-</div>
                                  <div className="admin-table-cell text-gray-400 mt-1">완납</div>
                                </div>
                              )}
                            </td>
                            
                            {/* 원가분석 */}
                            <td className="col-cost admin-table-cell text-center bg-red-50 border-r border-gray-200">
                              <div className="space-y-1">
                                {order.smallBoxQuantity > 0 && (
                                  <div className="text-gray-600 admin-table-cell">
                                    {getOrderTimeProductName(0, '한과1호')}: {formatPrice(order.smallBoxQuantity * smallCost)}
                                  </div>
                                )}
                                {order.largeBoxQuantity > 0 && (
                                  <div className="text-gray-600 admin-table-cell">
                                    {getOrderTimeProductName(1, '한과2호')}: {formatPrice(order.largeBoxQuantity * largeCost)}
                                  </div>
                                )}
                                {order.wrappingQuantity > 0 && (
                                  <div className="text-gray-600 admin-table-cell">
                                    {getOrderTimeProductName(2, '보자기')}: {formatPrice(order.wrappingQuantity * wrappingCost)}
                                  </div>
                                )}
                                {/* 동적 상품 원가 */}
                                {order.dynamicProductQuantities && (() => {
                                  try {
                                    const dynamicQty = typeof order.dynamicProductQuantities === 'string' 
                                      ? JSON.parse(order.dynamicProductQuantities) 
                                      : order.dynamicProductQuantities;
                                    return Object.entries(dynamicQty).map(([index, quantity]) => {
                                      const productIndex = parseInt(index);
                                      const qty = Number(quantity);
                                      const productCostSetting = settings?.find(s => s.key === `product_${productIndex}Cost`);
                                      const productCost = productCostSetting ? parseInt(productCostSetting.value) : 
                                                        (productNames[productIndex]?.cost ? parseInt(productNames[productIndex].cost) : 0);
                                      const itemCost = qty * productCost;
                                      return qty > 0 ? (
                                        <div key={productIndex} className="text-gray-600 admin-table-cell">
                                          {getOrderTimeProductName(productIndex, `상품${productIndex + 1}`)}: {formatPrice(itemCost)}
                                        </div>
                                      ) : null;
                                    });
                                  } catch (error) {
                                    return null;
                                  }
                                })()}
                                {shippingFee > 0 && (
                                  <div className="text-gray-600 admin-table-cell">
                                    배송비: {formatPrice(shippingFee)}
                                  </div>
                                )}
                                <div className="font-semibold text-gray-700 border-t border-gray-300 pt-1 mt-2 admin-table-cell">
                                  총원가: {formatPrice(totalCost)}
                                </div>
                              </div>
                            </td>
                            
                            {/* 순수익 */}
                            <td className="col-profit admin-table-cell text-center bg-gray-50">
                              <div>
                                <div className={`font-bold admin-table-cell ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {formatPrice(netProfit)}
                                </div>
                                <div className="admin-table-cell text-gray-600 mt-1">
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
                  <p className="admin-text-sm font-bold text-gray-800 mb-1">
                    📊 매출 요약 ({orders.length}건)
                  </p>
                  <div className="grid grid-cols-2 gap-3 admin-text-xs">
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // 사용자 권한관리 컴포넌트
  const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showRoleDialog, setShowRoleDialog] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
      fetchUsers();
    }, []);

    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/auth/users');
        if (response.ok) {
          const userData = await response.json();
          setUsers(userData);
        }
      } catch (error) {
        console.error('사용자 목록 가져오기 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const updateUserRole = async (userId: number, newRole: 'admin' | 'manager' | 'user') => {
      try {
        const response = await fetch(`/api/auth/users/${userId}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
          toast({
            title: "성공",
            description: "사용자 권한이 업데이트되었습니다."
          });
          fetchUsers();
          setShowRoleDialog(false);
          setSelectedUser(null);
        } else {
          throw new Error('권한 업데이트 실패');
        }
      } catch (error) {
        toast({
          title: "오류",
          description: "권한 업데이트에 실패했습니다.",
          variant: "destructive"
        });
      }
    };

    if (isLoading) {
      return <div className="admin-text-sm text-gray-600">사용자 목록을 불러오는 중...</div>;
    }

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="admin-text-lg font-semibold text-gray-900">사용자 권한 관리</h3>
            <p className="admin-text-sm text-gray-600 mt-1">등록된 사용자들의 권한을 관리할 수 있습니다.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left admin-text-xs font-medium text-gray-500 uppercase tracking-wider">사용자명</th>
                  <th className="px-6 py-3 text-left admin-text-xs font-medium text-gray-500 uppercase tracking-wider">권한</th>
                  <th className="px-6 py-3 text-left admin-text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                  <th className="px-6 py-3 text-right admin-text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="admin-text-sm font-medium text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 admin-text-xs font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'manager' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'admin' ? '관리자' : user.role === 'manager' ? '매니저' : '일반사용자'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap admin-text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right admin-text-sm font-medium">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowRoleDialog(true);
                        }}
                      >
                        권한 변경
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 권한 변경 다이얼로그 */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>사용자 권한 변경</DialogTitle>
              <DialogDescription>
                {selectedUser?.username}님의 권한을 변경하시겠습니까?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="admin-text-sm font-medium">현재 권한: 
                  <span className="ml-2 font-semibold text-blue-600">
                    {selectedUser?.role === 'admin' ? '관리자' : 
                     selectedUser?.role === 'manager' ? '매니저' : '일반사용자'}
                  </span>
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedUser && updateUserRole(selectedUser.id, 'admin')}
                  disabled={selectedUser?.role === 'admin'}
                >
                  관리자로 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedUser && updateUserRole(selectedUser.id, 'manager')}
                  disabled={selectedUser?.role === 'manager'}
                >
                  매니저로 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedUser && updateUserRole(selectedUser.id, 'user')}
                  disabled={selectedUser?.role === 'user'}
                >
                  일반사용자로 변경
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowRoleDialog(false);
                setSelectedUser(null);
              }}>
                취소
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // 메인 컴포넌트 렌더링
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader userName={user?.username || ''} onLogout={logout} />
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="orders" className="admin-text-sm">주문 관리</TabsTrigger>
              <TabsTrigger value="revenue" className="admin-text-sm">매출 관리</TabsTrigger>
              <TabsTrigger value="content" className="admin-text-sm">콘텐츠 관리</TabsTrigger>
              <TabsTrigger value="settings" className="admin-text-sm">시스템 설정</TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              {/* Order Management will be implemented */}
              <div className="text-center py-8 text-gray-500">주문 관리 기능</div>
            </TabsContent>

            <TabsContent value="revenue">
              {/* Revenue Management will be implemented */}
              <div className="text-center py-8 text-gray-500">매출 관리 기능</div>
            </TabsContent>

            <TabsContent value="content">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="admin-text-lg">대시보드 콘텐츠 관리</CardTitle>
                    <CardDescription className="admin-text-sm">메인 페이지에 표시되는 콘텐츠를 관리할 수 있습니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="admin-text-sm text-gray-700">
                          여기서 메인 페이지의 제목, 설명, 상품명 등을 수정할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              {/* User Management will be implemented */}
              <div className="text-center py-8 text-gray-500">시스템 설정 기능</div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};
