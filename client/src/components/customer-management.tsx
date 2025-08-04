import { useState } from "react";
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
    refetchInterval: 10000, // 10초마다 자동 새로고침
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
    },
    onError: (error: any) => {
      toast({
        title: "고객 등록 실패",
        description: error.response?.data?.error || "고객 등록 중 오류가 발생했습니다.",
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
    },
    onError: (error: any) => {
      toast({
        title: "고객 정보 수정 실패",
        description: error.response?.data?.error || "고객 정보 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "고객 삭제 완료",
        description: "고객이 휴지통으로 이동되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "고객 삭제 실패",
        description: "고객 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteCustomersMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/api/customers/bulk-delete", { ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomers(new Set());
      toast({
        title: "일괄 삭제 완료",
        description: data.message || "선택된 고객들이 휴지통으로 이동되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "일괄 삭제 실패",
        description: error.response?.data?.error || "고객 일괄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const restoreCustomerMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/customers/${id}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      toast({
        title: "고객 복구 완료",
        description: "고객이 성공적으로 복구되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "고객 복구 실패",
        description: error.response?.data?.error || "고객 복구 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteCustomerMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/customers/${id}/permanent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      toast({
        title: "고객 영구 삭제 완료",
        description: "고객이 영구적으로 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "고객 영구 삭제 실패",
        description: error.response?.data?.error || "고객 영구 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkRestoreCustomersMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/api/customers/bulk-restore", { ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      setSelectedTrashCustomers(new Set());
      toast({
        title: "일괄 복구 완료",
        description: data.message || "선택된 고객들이 복구되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "일괄 복구 실패",
        description: error.response?.data?.error || "고객 일괄 복구 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const bulkPermanentDeleteCustomersMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/api/customers/bulk-permanent-delete", { ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/trash"] });
      setSelectedTrashCustomers(new Set());
      toast({
        title: "일괄 영구 삭제 완료",
        description: data.message || "선택된 고객들이 영구적으로 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "일괄 영구 삭제 실패",
        description: error.response?.data?.error || "고객 일괄 영구 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const refreshStatsMutation = useMutation({
    mutationFn: () => api.post("/api/customers/refresh-stats", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "통계 업데이트 완료",
        description: "모든 고객의 주문횟수와 통계가 업데이트되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "통계 업데이트 실패",
        description: error.response?.data?.error || "통계 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const uploadCustomersMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/customers/upload', {
        method: 'POST',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || '파일 업로드에 실패했습니다');
        }
        return res.json();
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "엑셀 업로드 완료",
        description: `${data.message} (신규등록: ${data.created}명, 중복제외: ${data.skipped}명)`,
      });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "엑셀 업로드 실패",
        description: error.message,
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
    setIsDialogOpen(false);
  };

  const openAddressDialog = (customerPhone: string) => {
    setSelectedCustomerPhone(customerPhone);
    setIsAddressDialogOpen(true);
  };

  const getFullAddress = (customer: Customer) => {
    const parts = [customer.zipCode, customer.address1, customer.address2].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '주소 없음';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.customerPhone) {
      toast({
        title: "필수 정보 누락",
        description: "고객명과 연락처는 필수 입력 항목입니다.",
        variant: "destructive",
      });
      return;
    }

    const customerData: InsertCustomer = {
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      zipCode: formData.zipCode || null,
      address1: formData.address1 || null,
      address2: formData.address2 || null,
      notes: formData.notes || null,
    };

    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, data: customerData });
    } else {
      createCustomerMutation.mutate(customerData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      zipCode: customer.zipCode || "",
      address1: customer.address1 || "",
      address2: customer.address2 || "",
      notes: customer.notes || "",
    });
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    if (window.confirm(`${customer.customerName} 고객 정보를 휴지통으로 이동하시겠습니까?`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  };

  // Selection helper functions
  const toggleCustomerSelection = (customerId: number) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleTrashCustomerSelection = (customerId: number) => {
    const newSelected = new Set(selectedTrashCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedTrashCustomers(newSelected);
  };

  const selectAllCustomers = () => {
    setSelectedCustomers(new Set(customers.map(c => c.id)));
  };

  const selectAllTrashCustomers = () => {
    setSelectedTrashCustomers(new Set(trashedCustomers.map(c => c.id)));
  };

  const clearAllSelections = () => {
    setSelectedCustomers(new Set());
    setSelectedTrashCustomers(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedCustomers.size === 0) return;
    
    if (window.confirm(`선택된 ${selectedCustomers.size}개 고객을 휴지통으로 이동하시겠습니까?`)) {
      bulkDeleteCustomersMutation.mutate(Array.from(selectedCustomers));
    }
  };

  const handleBulkRestore = () => {
    if (selectedTrashCustomers.size === 0) return;
    
    if (window.confirm(`선택된 ${selectedTrashCustomers.size}개 고객을 복구하시겠습니까?`)) {
      bulkRestoreCustomersMutation.mutate(Array.from(selectedTrashCustomers));
    }
  };

  const handleBulkPermanentDelete = () => {
    if (selectedTrashCustomers.size === 0) return;
    
    if (window.confirm(`선택된 ${selectedTrashCustomers.size}개 고객을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      bulkPermanentDeleteCustomersMutation.mutate(Array.from(selectedTrashCustomers));
    }
  };

  const openSmsDialog = (customer: Customer) => {
    setSelectedCustomerForSms(customer);
    setSmsMessage("");
    setIsSmsDialogOpen(true);
  };

  const sendSmsMutation = useMutation({
    mutationFn: ({ phoneNumber, message }: { phoneNumber: string; message: string }) => 
      api.post("/api/sms/send-customer", { phoneNumber, message }),
    onSuccess: () => {
      toast({
        title: "문자 전송 완료",
        description: "고객에게 문자가 성공적으로 전송되었습니다.",
      });
      setIsSmsDialogOpen(false);
      setSmsMessage("");
      setSelectedCustomerForSms(null);
    },
    onError: (error: any) => {
      toast({
        title: "문자 전송 실패",
        description: error.response?.data?.error || "문자 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  };

  const formatAddress = (customer: Customer) => {
    const parts = [];
    if (customer.zipCode) parts.push(`[${customer.zipCode}]`);
    if (customer.address1) parts.push(customer.address1);
    if (customer.address2) parts.push(customer.address2);
    return parts.join(" ") || "-";
  };

  const formatLastOrderDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ko-KR");
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString() + "원";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          고객관리
        </CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refreshStatsMutation.mutate()}
            disabled={refreshStatsMutation.isPending}
          >
            {refreshStatsMutation.isPending ? "업데이트중..." : "통계 새로고침"}
          </Button>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                엑셀 업로드
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>엑셀 파일로 고객 일괄 등록</DialogTitle>
                <DialogDescription>
                  엑셀 파일을 업로드하여 여러 고객을 한번에 등록할 수 있습니다.
                  <br />
                  필수 컬럼: 고객명, 연락처 | 선택 컬럼: 우편번호, 주소1, 주소2, 발송주소, 메모
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">엑셀 파일 (.xlsx, .xls)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsUploadDialogOpen(false);
                      setUploadFile(null);
                    }}
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={() => uploadFile && uploadCustomersMutation.mutate(uploadFile)}
                    disabled={!uploadFile || uploadCustomersMutation.isPending}
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
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                고객 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "고객 정보 수정" : "새 고객 등록"}
              </DialogTitle>
              <DialogDescription>
                {editingCustomer 
                  ? "고객 정보를 수정해주세요." 
                  : "새로운 고객 정보를 입력해주세요."
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">고객명 *</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">연락처 *</Label>
                  <Input
                    id="customerPhone"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    placeholder="010-1234-5678"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="zipCode">우편번호</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    placeholder="12345"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address1">주소</Label>
                  <Input
                    id="address1"
                    value={formData.address1}
                    onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                    placeholder="서울시 강남구 테헤란로 123"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address2">상세주소</Label>
                <Input
                  id="address2"
                  value={formData.address2}
                  onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                  placeholder="101동 502호"
                />
              </div>

              <div>
                <Label htmlFor="notes">메모</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="고객 관련 메모를 입력하세요"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  취소
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                >
                  {editingCustomer ? "수정" : "등록"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers">활성 고객</TabsTrigger>
            <TabsTrigger value="trash">휴지통</TabsTrigger>
          </TabsList>
          
          <TabsContent value="customers" className="mt-4">
            {/* 일괄 삭제 버튼 영역 */}
            {selectedCustomers.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedCustomers.size}개 고객이 선택됨
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={clearAllSelections}
                    >
                      선택 해제
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteCustomersMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      선택된 고객 삭제
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                등록된 고객이 없습니다. 첫 고객을 등록해보세요.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCustomers.size === customers.length && customers.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllCustomers();
                            } else {
                              clearAllSelections();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>고객명</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>주소</TableHead>
                      <TableHead className="text-center">주문횟수</TableHead>
                      <TableHead className="text-center">총주문금액</TableHead>
                      <TableHead className="text-center">마지막주문일</TableHead>
                      <TableHead className="text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomers.has(customer.id)}
                            onCheckedChange={() => toggleCustomerSelection(customer.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            {customer.customerName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            {formatPhoneNumber(customer.customerPhone)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <div className="flex items-center gap-2">
                              <span className="max-w-xs truncate" title={getFullAddress(customer)}>
                                {getFullAddress(customer)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAddressDialog(customer.customerPhone)}
                                className="h-6 px-2 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                주소목록
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Package className="h-4 w-4 text-gray-500" />
                            <Badge variant="secondary">
                              {customer.orderCount}회 (2년)
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatAmount(customer.totalSpent)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatLastOrderDate(customer.lastOrderDate)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSmsDialog(customer)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(customer)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
          
          {/* 휴지통 탭 */}
          <TabsContent value="trash" className="mt-4">
            {/* 일괄 복구/삭제 버튼 영역 */}
            {selectedTrashCustomers.size > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-800">
                    {selectedTrashCustomers.size}개 고객이 선택됨
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={clearAllSelections}
                    >
                      선택 해제
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={handleBulkRestore}
                      disabled={bulkRestoreCustomersMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      선택된 고객 복구
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkPermanentDeleteCustomersMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      영구 삭제
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isLoadingTrash ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : trashedCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                휴지통이 비어있습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedTrashCustomers.size === trashedCustomers.length && trashedCustomers.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllTrashCustomers();
                            } else {
                              clearAllSelections();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>고객명</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>삭제일</TableHead>
                      <TableHead className="text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trashedCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTrashCustomers.has(customer.id)}
                            onCheckedChange={() => toggleTrashCustomerSelection(customer.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-gray-500">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {customer.customerName}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {formatPhoneNumber(customer.customerPhone)}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {customer.deletedAt ? new Date(customer.deletedAt).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => restoreCustomerMutation.mutate(customer.id)}
                              className="text-green-600 hover:text-green-700"
                              disabled={restoreCustomerMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm(`${customer.customerName} 고객을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                                  permanentDeleteCustomerMutation.mutate(customer.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                              disabled={permanentDeleteCustomerMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Address Dialog */}
      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>고객 주소 목록</DialogTitle>
            <DialogDescription>
              이 고객이 주문할 때 사용한 모든 주소입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {customerAddresses.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                주소 정보가 없습니다.
              </div>
            ) : (
              customerAddresses.map((addressInfo, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {addressInfo.address}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {addressInfo.orderCount}개의 주문에서 사용
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {addressInfo.orderCount}회
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>문자 메시지 전송</DialogTitle>
            <DialogDescription>
              {selectedCustomerForSms && `${selectedCustomerForSms.customerName} (${formatPhoneNumber(selectedCustomerForSms.customerPhone)})님에게 문자를 전송합니다.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-message">메시지 내용</Label>
              <textarea
                id="sms-message"
                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="전송할 메시지를 입력하세요..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                maxLength={1000}
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {smsMessage.length}/1000자
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsSmsDialogOpen(false);
                  setSmsMessage("");
                  setSelectedCustomerForSms(null);
                }}
              >
                취소
              </Button>
              <Button 
                onClick={() => {
                  if (selectedCustomerForSms && smsMessage.trim()) {
                    sendSmsMutation.mutate({ 
                      phoneNumber: selectedCustomerForSms.customerPhone, 
                      message: smsMessage.trim() 
                    });
                  }
                }}
                disabled={!smsMessage.trim() || sendSmsMutation.isPending}
              >
                {sendSmsMutation.isPending ? "전송 중..." : "전송"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Helper functions
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function formatLastOrderDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}