import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, User, Phone, MapPin, Package, Upload, FileSpreadsheet, Eye, MessageSquare, RefreshCw, X } from "lucide-react";
import type { Customer, InsertCustomer } from "@shared/schema";

interface CustomerFormData {
  customerName: string;
  customerPhone: string;
  zipCode: string;
  address1: string;
  address2: string;
  notes: string;
}

interface CustomerAddress {
  address: string;
  orderCount: number;
}

export function CustomerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [selectedCustomerForSms, setSelectedCustomerForSms] = useState<Customer | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"customers" | "trash">("customers");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
  const [selectedTrashCustomers, setSelectedTrashCustomers] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState<CustomerFormData>({
    customerName: "",
    customerPhone: "",
    zipCode: "",
    address1: "",
    address2: "",
    notes: "",
  });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    refetchInterval: 10000,
  });

  const { data: trashedCustomers = [], isLoading: isLoadingTrash } = useQuery<Customer[]>({
    queryKey: ["/api/customers/trash"],
    enabled: activeTab === "trash",
    refetchInterval: activeTab === "trash" ? 10000 : false,
  });

  const { data: customerAddresses = [] } = useQuery<CustomerAddress[]>({
    queryKey: ["/api/customers", selectedCustomerPhone, "addresses"],
    queryFn: () => fetch(`/api/customers/${selectedCustomerPhone}/addresses`).then(res => res.json()),
    enabled: !!selectedCustomerPhone,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: InsertCustomer) => api.post("/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "고객 등록 완료",
        description: "새 고객이 성공적으로 등록되었습니다.",
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "등록 실패",
        description: "고객 등록에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertCustomer> }) => 
      api.patch(`/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "고객 정보 수정 완료",
        description: "고객 정보가 성공적으로 수정되었습니다.",
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "수정 실패",
        description: "고객 정보 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      toast({
        title: "고객 삭제",
        description: "고객이 휴지통으로 이동되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "고객 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const restoreCustomerMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/customers/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      toast({
        title: "고객 복구 완료",
        description: "고객이 성공적으로 복구되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "복구 실패",
        description: "고객 복구에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const refreshStatsMutation = useMutation({
    mutationFn: () => api.post('/api/customers/refresh-stats'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "통계 업데이트 완료",
        description: "고객 통계가 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "업데이트 실패",
        description: "통계 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const uploadCustomersMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/customers/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('업로드 실패');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "엑셀 업로드 완료",
        description: `${data.count}개의 고객이 업로드되었습니다.`,
      });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
    },
    onError: () => {
      toast({
        title: "업로드 실패",
        description: "엑셀 파일 업로드에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: ({ phoneNumber, message }: { phoneNumber: string; message: string }) =>
      api.post('/api/sms/send', { phoneNumber, message }),
    onSuccess: () => {
      toast({
        title: "SMS 전송 완료",
        description: "SMS가 성공적으로 전송되었습니다.",
      });
      setIsSmsDialogOpen(false);
      setSmsMessage("");
      setSelectedCustomerForSms(null);
    },
    onError: () => {
      toast({
        title: "SMS 전송 실패",
        description: "SMS 전송에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      zipCode: "",
      address1: "",
      address2: "",
      notes: "",
    });
    setEditingCustomer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCustomer) {
      updateCustomerMutation.mutate({
        id: editingCustomer.id,
        data: formData,
      });
    } else {
      createCustomerMutation.mutate(formData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customerName || "",
      customerPhone: customer.customerPhone || "",
      zipCode: customer.zipCode || "",
      address1: customer.address1 || "",
      address2: customer.address2 || "",
      notes: customer.notes || "",
    });
    setIsDialogOpen(true);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()}원`;
  };

  const formatLastOrderDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <User className="h-5 w-5" />
            고객관리
          </CardTitle>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refreshStatsMutation.mutate()}
              disabled={refreshStatsMutation.isPending}
              className="flex-1 sm:flex-none text-xs md:text-sm"
            >
              {refreshStatsMutation.isPending ? "업데이트중..." : "통계 새로고침"}
            </Button>
            
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs md:text-sm">
                  <Upload className="h-4 w-4 mr-2" />
                  엑셀 업로드
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">엑셀 파일로 고객 일괄 등록</DialogTitle>
                  <DialogDescription className="text-sm md:text-base">
                    엑셀 파일을 업로드하여 여러 고객을 한번에 등록할 수 있습니다.
                    <br />
                    필수 컬럼: 고객명, 연락처 | 선택 컬럼: 우편번호, 주소1, 주소2, 발송주소, 메모
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file" className="text-sm md:text-base">엑셀 파일 (.xlsx, .xls)</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="mt-1 text-sm md:text-base"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsUploadDialogOpen(false);
                        setUploadFile(null);
                      }}
                      className="text-sm md:text-base"
                    >
                      취소
                    </Button>
                    <Button 
                      onClick={() => uploadFile && uploadCustomersMutation.mutate(uploadFile)}
                      disabled={!uploadFile || uploadCustomersMutation.isPending}
                      className="text-sm md:text-base"
                    >
                      {uploadCustomersMutation.isPending ? (
                        <>처리중...</>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          업로드
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} size="sm" className="flex-1 sm:flex-none text-xs md:text-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  고객 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">
                    {editingCustomer ? "고객 정보 수정" : "새 고객 등록"}
                  </DialogTitle>
                  <DialogDescription className="text-sm md:text-base">
                    {editingCustomer 
                      ? "고객 정보를 수정해주세요." 
                      : "새로운 고객 정보를 입력해주세요."
                    }
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerName" className="text-sm md:text-base">고객명 *</Label>
                      <Input
                        id="customerName"
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="홍길동"
                        required
                        className="text-sm md:text-base"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerPhone" className="text-sm md:text-base">연락처 *</Label>
                      <Input
                        id="customerPhone"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="010-1234-5678"
                        required
                        className="text-sm md:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="zipCode" className="text-sm md:text-base">우편번호</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        placeholder="12345"
                        className="text-sm md:text-base"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="address1" className="text-sm md:text-base">주소</Label>
                      <Input
                        id="address1"
                        value={formData.address1}
                        onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                        placeholder="서울시 강남구 테헤란로 123"
                        className="text-sm md:text-base"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address2" className="text-sm md:text-base">상세주소</Label>
                    <Input
                      id="address2"
                      value={formData.address2}
                      onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                      placeholder="101호"
                      className="text-sm md:text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-sm md:text-base">메모</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="배송 관련 특이사항 등"
                      className="min-h-[80px] text-sm md:text-base"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1 text-sm md:text-base"
                    >
                      취소
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                      className="flex-1 text-sm md:text-base"
                    >
                      {(createCustomerMutation.isPending || updateCustomerMutation.isPending) ? (
                        "처리중..."
                      ) : (
                        editingCustomer ? "수정" : "등록"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "customers" | "trash")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers" className="text-sm md:text-base">고객 목록 ({customers.length})</TabsTrigger>
            <TabsTrigger value="trash" className="text-sm md:text-base">휴지통 ({trashedCustomers.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="customers" className="mt-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-sm md:text-base">로딩 중...</div>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-sm md:text-base">등록된 고객이 없습니다. 첫 고객을 등록해보세요.</div>
              </div>
            ) : (
              <>
                {/* 데스크탑 테이블 뷰 */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">고객명</TableHead>
                        <TableHead className="text-xs md:text-sm">연락처</TableHead>
                        <TableHead className="text-xs md:text-sm">주소</TableHead>
                        <TableHead className="text-xs md:text-sm">주문수</TableHead>
                        <TableHead className="text-xs md:text-sm">총금액</TableHead>
                        <TableHead className="text-xs md:text-sm">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="text-xs md:text-sm font-medium">{customer.customerName}</TableCell>
                          <TableCell className="text-xs md:text-sm">{formatPhoneNumber(customer.customerPhone)}</TableCell>
                          <TableCell className="text-xs md:text-sm max-w-[200px] truncate">
                            {customer.address1 ? `${customer.address1} ${customer.address2 || ''}`.trim() : '-'}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">{customer.orderCount || 0}</TableCell>
                          <TableCell className="text-xs md:text-sm">{formatAmount(customer.totalOrderAmount || 0)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(customer)}
                                className="text-xs"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteCustomerMutation.mutate(customer.id)}
                                className="text-xs"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 모바일 카드 뷰 */}
                <div className="md:hidden space-y-4">
                  {customers.map((customer) => (
                    <Card key={customer.id} className="p-4">
                      <div className="space-y-3">
                        {/* 상단: 이름과 연락처 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-lg">{customer.customerName}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              <span>{formatPhoneNumber(customer.customerPhone)}</span>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-gray-600">주문 {customer.orderCount || 0}회</div>
                            <div className="font-medium">{formatAmount(customer.totalOrderAmount || 0)}</div>
                          </div>
                        </div>
                        
                        {/* 중간: 주소 */}
                        {customer.address1 && (
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="break-all">
                              {`${customer.address1} ${customer.address2 || ''}`.trim()}
                            </span>
                          </div>
                        )}
                        
                        {/* 하단: 작업 버튼 */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            수정
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteCustomerMutation.mutate(customer.id)}
                            className="flex-1"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="trash" className="mt-6">
            {isLoadingTrash ? (
              <div className="text-center py-8">
                <div className="text-sm md:text-base">로딩 중...</div>
              </div>
            ) : trashedCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-sm md:text-base">휴지통이 비어있습니다.</div>
              </div>
            ) : (
              <>
                {/* 데스크탑 테이블 뷰 */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">고객명</TableHead>
                        <TableHead className="text-xs md:text-sm">연락처</TableHead>
                        <TableHead className="text-xs md:text-sm">삭제일</TableHead>
                        <TableHead className="text-xs md:text-sm">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trashedCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="text-xs md:text-sm font-medium">{customer.customerName}</TableCell>
                          <TableCell className="text-xs md:text-sm">{formatPhoneNumber(customer.customerPhone)}</TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {customer.deletedAt ? formatLastOrderDate(customer.deletedAt) : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreCustomerMutation.mutate(customer.id)}
                              className="text-xs"
                            >
                              복구
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 모바일 카드 뷰 */}
                <div className="md:hidden space-y-4">
                  {trashedCustomers.map((customer) => (
                    <Card key={customer.id} className="p-4 bg-gray-50">
                      <div className="space-y-3">
                        {/* 상단: 이름과 연락처 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-lg text-gray-600">{customer.customerName}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Phone className="h-4 w-4" />
                              <span>{formatPhoneNumber(customer.customerPhone)}</span>
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>삭제일</div>
                            <div>{customer.deletedAt ? formatLastOrderDate(customer.deletedAt) : '-'}</div>
                          </div>
                        </div>
                        
                        {/* 하단: 복구 버튼 */}
                        <div className="pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreCustomerMutation.mutate(customer.id)}
                            className="w-full"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            복구
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}