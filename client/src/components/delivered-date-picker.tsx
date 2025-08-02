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

interface DeliveredDatePickerProps {
  order: Order;
}

export function DeliveredDatePicker({ order }: DeliveredDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [deliveredDate, setDeliveredDate] = useState(
    order.deliveredDate ? new Date(order.deliveredDate).toISOString().split('T')[0] : ''
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateDeliveredDateMutation = useMutation({
    mutationFn: async ({ id, deliveredDate }: { id: number; deliveredDate: string | null }) => {
      return await apiRequest(`/api/orders/${id}/delivered-date`, "PATCH", { deliveredDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "발송완료 날짜 수정 완료",
        description: "발송완료 날짜가 성공적으로 수정되었습니다.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "오류 발생",
        description: "발송완료 날짜 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    updateDeliveredDateMutation.mutate({
      id: order.id,
      deliveredDate: deliveredDate || null,
    });
  };

  const handleClear = () => {
    updateDeliveredDateMutation.mutate({
      id: order.id,
      deliveredDate: null,
    });
  };

  // 발송완료 상태가 아니면 컴포넌트를 표시하지 않음
  if (order.status !== 'delivered') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className="flex items-center gap-1 h-7 text-xs px-2"
        >
          <Calendar className="h-3 w-3" />
          발송완료일
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            발송완료 날짜 수정
          </DialogTitle>
          <DialogDescription>
            주문 {order.orderNumber}의 발송완료 날짜를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="delivered-date" className="text-right">
              발송완료일
            </Label>
            <Input
              id="delivered-date"
              type="date"
              value={deliveredDate}
              onChange={(e) => setDeliveredDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          {order.deliveredDate && (
            <div className="text-sm text-gray-500">
              현재 발송완료일: {new Date(order.deliveredDate).toLocaleDateString('ko-KR')}
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={updateDeliveredDateMutation.isPending}
          >
            날짜 삭제
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateDeliveredDateMutation.isPending}
          >
            {updateDeliveredDateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}