import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Edit3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

interface SellerShippedDatePickerProps {
  order: Order;
}

export function SellerShippedDatePicker({ order }: SellerShippedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [sellerShippedDate, setSellerShippedDate] = useState(
    order.sellerShippedDate ? new Date(order.sellerShippedDate).toISOString().split('T')[0] : ''
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSellerShippedDateMutation = useMutation({
    mutationFn: async ({ id, sellerShippedDate }: { id: number; sellerShippedDate: string | null }) => {
      return await apiRequest("PATCH", `/api/orders/${id}/seller-shipped-date`, { sellerShippedDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "판매자발송일 수정 완료",
        description: "판매자발송일이 성공적으로 수정되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "판매자발송일 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    updateSellerShippedDateMutation.mutate({
      id: order.id,
      sellerShippedDate: sellerShippedDate || null,
    });
  };

  const handleClear = () => {
    updateSellerShippedDateMutation.mutate({
      id: order.id,
      sellerShippedDate: null,
    });
  };

  // 판매자발송이 완료된 경우에만 컴포넌트를 표시
  if (!order.sellerShipped) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className="seller-shipped-date-trigger flex items-center gap-1 h-7 text-xs px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <Calendar className="h-3 w-3" />
          판매자발송일 수정
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            판매자발송일 수정
          </DialogTitle>
          <DialogDescription>
            주문 {order.orderNumber}의 판매자발송일을 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="seller-shipped-date" className="text-right">
              판매자발송일
            </Label>
            <Input
              id="seller-shipped-date"
              type="date"
              value={sellerShippedDate}
              onChange={(e) => setSellerShippedDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          {order.sellerShippedDate && (
            <div className="text-sm text-gray-500">
              현재 판매자발송일: {new Date(order.sellerShippedDate).toLocaleDateString('ko-KR')}
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={updateSellerShippedDateMutation.isPending}
          >
            날짜 삭제
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateSellerShippedDateMutation.isPending}
          >
            {updateSellerShippedDateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}