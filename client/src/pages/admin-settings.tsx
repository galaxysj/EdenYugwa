import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Settings, Phone, Building, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AdminSettings } from "@shared/schema";

const adminSettingsSchema = z.object({
  adminName: z.string().min(1, "관리자명을 입력해주세요"),
  adminPhone: z.string().min(1, "관리자 전화번호를 입력해주세요"),
  businessName: z.string().min(1, "사업체명을 입력해주세요"),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  bankAccount: z.string().optional(),
});

type AdminSettingsFormData = z.infer<typeof adminSettingsSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminSettings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['/api/admin-settings'],
    retry: false,
  });

  const form = useForm<AdminSettingsFormData>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      adminName: "",
      adminPhone: "",
      businessName: "에덴한과",
      businessAddress: "",
      businessPhone: "",
      bankAccount: "농협 352-1701-3342-63 (예금주: 손*진)",
    },
  });

  // Reset form when data is loaded
  React.useEffect(() => {
    if (adminSettings) {
      form.reset({
        adminName: adminSettings.adminName || "",
        adminPhone: adminSettings.adminPhone || "",
        businessName: adminSettings.businessName || "에덴한과",
        businessAddress: adminSettings.businessAddress || "",
        businessPhone: adminSettings.businessPhone || "",
        bankAccount: adminSettings.bankAccount || "농협 352-1701-3342-63 (예금주: 손*진)",
      });
    }
  }, [adminSettings, form]);

  const updateMutation = useMutation({
    mutationFn: (data: AdminSettingsFormData) => {
      console.log("Sending admin settings data:", data);
      return apiRequest('POST', '/api/admin-settings', data);
    },
    onSuccess: (response) => {
      console.log("Admin settings update successful:", response);
      queryClient.invalidateQueries({ queryKey: ['/api/admin-settings'] });
      toast({
        title: "설정 업데이트 완료",
        description: "관리자 설정이 성공적으로 업데이트되었습니다.",
      });
    },
    onError: (error: any) => {
      console.error("Admin settings update error:", error);
      toast({
        title: "설정 업데이트 실패",
        description: error.message || "설정 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdminSettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-eden-brown" />
        <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            관리자 정보 설정
          </CardTitle>
          <CardDescription>
            SMS 발송 및 사업 정보에 사용되는 관리자 정보를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 관리자 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    관리자 정보
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="adminName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>관리자명 *</FormLabel>
                        <FormControl>
                          <Input placeholder="관리자명을 입력하세요" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adminPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          관리자 전화번호 * (SMS 발송용)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="010-1234-5678" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-gray-500">
                          고객에게 SMS를 발송할 때 발신번호로 사용됩니다.
                        </p>
                      </FormItem>
                    )}
                  />
                </div>

                {/* 사업체 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    사업체 정보
                  </h3>

                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업체명 *</FormLabel>
                        <FormControl>
                          <Input placeholder="에덴한과" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업체 전화번호</FormLabel>
                        <FormControl>
                          <Input placeholder="02-1234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* 주소 및 계좌 정보 */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="businessAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>사업체 주소</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="사업체 주소를 입력하세요" 
                          rows={2} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>입금 계좌 정보</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="농협 352-1701-3342-63 (예금주: 손*진)" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500">
                        고객에게 안내되는 입금 계좌 정보입니다.
                      </p>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "저장 중..." : "설정 저장"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* SMS 발송 안내 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Phone className="h-5 w-5" />
            SMS 발송 안내
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>SMS 발송 연동:</strong> 위에서 설정한 관리자 전화번호가 고객에게 SMS를 발송할 때 
              발신번호로 사용됩니다. 주문 관리 페이지에서 "SMS 발송" 버튼을 클릭하면 
              설정된 관리자 번호를 통해 고객에게 배송 알림 메시지가 전송됩니다.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              기본 메시지: "[에덴한과] 고객명님, 주문번호 XX 상품이 발송되었습니다. 3일이내 미 도착 시 반드시 연락주세요. 감사합니다. ^^"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}