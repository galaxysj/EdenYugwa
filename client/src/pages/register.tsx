import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

// 전화번호 자동 포맷팅 함수
const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // 폼 상태
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !confirmPassword || !name || !phoneNumber) {
      setError("모든 필드를 입력해주세요");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    if (password.length < 4) {
      setError("비밀번호는 최소 4자 이상이어야 합니다");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, name, phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '회원가입에 실패했습니다');
      }

      setSuccess("회원가입이 완료되었습니다! 로그인해주세요.");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setPhoneNumber("");
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 p-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="text-orange-700 hover:text-orange-800 p-2"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          홈으로
        </Button>
        <h1 className="text-xl font-bold text-orange-800">회원가입</h1>
        <div className="w-16"></div> {/* 균형을 위한 공간 */}
      </div>

      {/* 회원가입 폼 */}
      <Card className="w-full max-w-sm mx-auto shadow-lg">
        <CardHeader className="pb-4 pt-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-orange-800 mb-1">에덴한과</h2>
            <p className="text-sm text-orange-600">새 계정 만들기</p>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 pb-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 bg-green-50 text-green-800 border-green-300">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">아이디</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력 (최소 4자)"
                  className="h-11 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 다시 입력"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">이름</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 입력"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-sm">전화번호</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                placeholder="010-1234-5678"
                className="h-11"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white mt-6"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  가입 중...
                </>
              ) : (
                "회원가입"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 하단 버튼들 */}
      <div className="mt-6 space-y-3 max-w-sm mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate("/login")}
          className="w-full h-11 text-orange-600 border-orange-300 hover:bg-orange-50"
        >
          이미 계정이 있나요? 로그인하기
        </Button>

        <Button
          variant="ghost"
          onClick={() => navigate("/order-lookup")}
          className="w-full h-11 text-gray-600 hover:text-gray-800"
        >
          📋 비회원 주문조회
        </Button>
      </div>
    </div>
  );
}