import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState("login");

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // 사용자 역할에 따라 리다이렉트
      if (user.role === 'admin') {
        navigate("/admin");
      } else if (user.role === 'manager') {
        navigate("/manager"); // 매니저는 매니저 페이지로
      } else {
        navigate("/"); // 일반 사용자는 홈으로
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

  const handleLoginSuccess = () => {
    // useEffect에서 리다이렉트 처리
  };

  const handleRegisterSuccess = () => {
    setActiveTab("login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-800 mb-2">에덴한과</h1>
          <p className="text-orange-600">로그인 및 회원가입</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="register">회원가입</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="mt-6">
            <LoginForm 
              title="로그인"
              onSuccess={handleLoginSuccess}
            />
            <div className="mt-4 text-center text-sm text-gray-600">
              계정이 없으신가요?{" "}
              <button
                onClick={() => setActiveTab("register")}
                className="text-orange-600 hover:text-orange-700 underline"
              >
                회원가입하기
              </button>
            </div>
          </TabsContent>
          
          <TabsContent value="register" className="mt-6">
            <RegisterForm 
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => setActiveTab("login")}
            />
          </TabsContent>
        </Tabs>
        
        {/* 추가 메뉴 버튼들 */}
        <div className="mt-8 space-y-3">
          <div className="text-center">
            <button
              onClick={() => navigate("/order-lookup")}
              className="w-full bg-orange-100 text-orange-800 py-3 px-4 rounded-lg hover:bg-orange-200 transition-colors border border-orange-300"
            >
              📋 비회원 주문조회
            </button>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => navigate("/")}
              className="w-full bg-eden-beige text-eden-dark py-3 px-4 rounded-lg hover:bg-orange-50 transition-colors border border-orange-200"
            >
              🏠 홈으로 돌아가기
            </button>
          </div>
          

        </div>
      </div>
    </div>
  );
}