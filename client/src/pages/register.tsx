import { useEffect } from "react";
import { useLocation } from "wouter";
import { RegisterForm } from "@/components/RegisterForm";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // 사용자 역할에 따라 리다이렉트
      if (user.role === 'admin') {
        navigate("/admin");
      } else if (user.role === 'manager') {
        navigate("/manager");
      } else {
        navigate("/");
      }
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const handleRegisterSuccess = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-start justify-center p-2 md:p-4">
      <div className="w-full max-w-md mt-4">
        {/* 뒤로가기 버튼 */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-orange-700 hover:text-orange-800 p-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-orange-800 mb-2">에덴한과</h1>
          <p className="text-sm md:text-base text-orange-600">회원가입</p>
        </div>
        
        <RegisterForm 
          onSuccess={handleRegisterSuccess}
        />
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-3">
            이미 계정이 있으신가요?
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
            className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            로그인하기
          </Button>
        </div>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/order-lookup")}
            className="w-full text-gray-600 hover:text-gray-800"
          >
            📋 비회원 주문조회
          </Button>
        </div>
      </div>
    </div>
  );
}