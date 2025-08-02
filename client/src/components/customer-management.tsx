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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, User, Phone, MapPin, Package, Upload, FileSpreadsheet, Eye } from "lucide-react";
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
        description: "고객 정보가 성공적으로 삭제되었습니다.",
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
    if (window.confirm(`${customer.customerName} 고객 정보를 삭제하시겠습니까?`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  };

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

  const formatLastOrderDate = (date: string | null) => {
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