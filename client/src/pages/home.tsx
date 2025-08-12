
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Leaf, Heart, BicepsFlexed, Sprout, Church, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ShoppingCart, Info, Package, Settings } from "lucide-react";
import OrderForm from "@/components/order-form";
import edenHangwaImage from "@assets/image_1753160591635.png";
import edenHangwaImage2 from "@assets/image_1753160530604.png";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { isAuthenticated, isManagerOrAdmin, isAdmin, isManager, user } = useAuth();

  // Fetch dashboard content for dynamic text and product names
  const { data: contentData } = useQuery({
    queryKey: ['/api/dashboard-content'],
    staleTime: 1000 * 60, // 1 minute cache
  });

  // Convert array to object for easier access
  const dashboardContent = Array.isArray(contentData) ? contentData.reduce((acc: any, item: any) => {
    if (item.key === 'heroImages' || item.key === 'productNames') {
      try {
        acc[item.key] = JSON.parse(item.value || '[]');
      } catch {
        acc[item.key] = item.key === 'heroImages' ? [] : [];
      }
    } else {
      acc[item.key] = item.value;
    }
    return acc;
  }, {}) : {};

  // Get settings data for pricing
  const { data: settingsData } = useQuery({
    queryKey: ['/api/settings'],
    staleTime: 1000 * 60 * 5,
  });

  const settings = settingsData;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-eden-cream">
      {/* Navigation */}
      <header className="bg-white shadow-sm border-b border-eden-beige sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="md:flex md:items-center md:justify-between">
            {/* 브랜드 로고와 모바일 버튼들을 세로로 배치 */}
            <div className="md:flex md:items-center md:space-x-3">
              <div className="flex items-center space-x-3 justify-center md:justify-start">
                {dashboardContent.logoUrl ? (
                  <img 
                    src={dashboardContent.logoUrl} 
                    alt="로고" 
                    className="h-8 md:h-10 w-auto object-contain"
                  />
                ) : (
                  <Leaf className="text-eden-sage text-2xl" />
                )}
                <h1 className="text-2xl font-bold text-eden-brown font-korean">
                  {dashboardContent.brandName || "에덴한과"}
                </h1>
              </div>
              
              {/* 모바일 메뉴 버튼들 - 제목 아래 배치 */}
              <div className="flex md:hidden items-center justify-center gap-2 mt-3">
                {/* 주문조회 버튼 - 항상 표시 */}
                <Link href="/order-lookup">
                  <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                    주문조회
                  </button>
                </Link>
                
                {/* 관리자일 때 관리자패널과 매니저패널 버튼 표시 */}
                {isAuthenticated && user?.role === 'admin' && (
                  <>
                    <Link href="/admin">
                      <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                        관리자패널
                      </button>
                    </Link>
                    <Link href="/manager">
                      <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                        매니저패널
                      </button>
                    </Link>
                  </>
                )}
                
                {/* 매니저일 때 매니저패널 버튼 표시 */}
                {isAuthenticated && user?.role === 'manager' && (
                  <Link href="/manager">
                    <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                      매니저패널
                    </button>
                  </Link>
                )}
                
                {/* 비로그인 상태 - 로그인/회원가입 버튼 */}
                {!isAuthenticated ? (
                  <>
                    <Link href="/login">
                      <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                        로그인
                      </button>
                    </Link>
                    <Link href="/register">
                      <button className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                        회원가입
                      </button>
                    </Link>
                  </>
                ) : (
                  /* 로그인 상태 - 로그아웃 버튼 */
                  <button 
                    onClick={() => {
                      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                        .then(() => window.location.reload());
                    }}
                    className="text-xs bg-gray-100 text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            </div>


            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <button 
                onClick={() => scrollToSection('order')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                주문하기
              </button>
              <Link href="/order-lookup">
                <Button variant="ghost" className="text-eden-brown hover:text-eden-dark text-[16px]">
                  주문 조회
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link href="/login">
                  <Button variant="outline" className="text-eden-brown border-eden-brown hover:bg-eden-brown hover:text-white">
                    로그인/회원가입
                  </Button>
                </Link>
              )}
              {isAuthenticated && user?.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" className="text-eden-red hover:text-eden-brown">
                    관리자
                  </Button>
                </Link>
              )}
              {isAuthenticated && (user?.role === 'admin' || user?.role === 'manager') && (
                <Link href="/manager">
                  <Button variant="ghost" className="text-eden-sage hover:text-eden-brown">
                    매니저
                  </Button>
                </Link>
              )}
              {isAuthenticated && (
                <Button 
                  variant="outline" 
                  className="text-eden-brown border-eden-brown hover:bg-eden-brown hover:text-white"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      if (response.ok) {
                        window.location.href = '/';
                      }
                    } catch (error) {
                      console.error('로그아웃 실패:', error);
                    }
                  }}
                >
                  로그아웃
                </Button>
              )}

            </nav>


          </div>


        </div>
      </header>
      {/* Order Section - Main Content */}
      <section id="home" className="relative overflow-hidden bg-white">
        <div className="container mx-auto px-4 py-6 md:py-12">


          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-eden-brown mb-4 md:mb-6 leading-tight font-korean max-w-4xl mx-auto whitespace-pre-line">
              {dashboardContent.mainTitle || "진안에서 온 정성 가득 유과"}
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-eden-dark mb-6 md:mb-8 leading-relaxed max-w-2xl mx-auto px-2 whitespace-pre-line">
              {dashboardContent.mainDescription || "부모님이 100% 국내산 찹쌀로 직접 만드는 찹쌀유과\n달지않고 고소한 맛이 일품! 선물로도 완벽한 에덴한과 ^^"}
            </p>
          </div>

          {/* Product Images */}
          <div className="max-w-4xl mx-auto mb-8 md:mb-16">
            {dashboardContent.heroImages && dashboardContent.heroImages.length > 0 ? (
              <div className={`grid gap-3 md:gap-4 ${
                dashboardContent.heroImages.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                dashboardContent.heroImages.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                dashboardContent.heroImages.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
                dashboardContent.heroImages.length === 4 ? 'grid-cols-2 md:grid-cols-2' :
                dashboardContent.heroImages.length === 5 ? 'grid-cols-2 md:grid-cols-3' :
                dashboardContent.heroImages.length === 6 ? 'grid-cols-2 md:grid-cols-3' :
                'grid-cols-2 md:grid-cols-4'
              }`}>
                {dashboardContent.heroImages.map((imageUrl: string, index: number) => (
                  <div key={index} className="flex justify-center">
                    <img 
                      src={imageUrl} 
                      alt={`에덴한과 유과 상품 ${index + 1}`} 
                      className={`rounded-xl shadow-md w-full object-cover ${
                        dashboardContent.heroImages.length === 1 ? 'max-w-md aspect-square' :
                        dashboardContent.heroImages.length <= 4 ? 'max-w-xs md:max-w-sm aspect-square' :
                        'max-w-[150px] md:max-w-[180px] aspect-square'
                      }`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              // Fallback to default images when no custom images
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex justify-center">
                  <img 
                    src={edenHangwaImage} 
                    alt="에덴한과 유과 상품" 
                    className="rounded-xl shadow-md w-full max-w-xs md:max-w-sm"
                  />
                </div>
                <div className="hidden md:flex justify-center">
                  <img 
                    src={edenHangwaImage2} 
                    alt="에덴한과 유과 상품" 
                    className="rounded-xl shadow-md w-full max-w-sm"
                  />
                </div>
              </div>
            )}
          </div>







          {/* Bank Account Information */}
          <div className="max-w-lg mx-auto mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-eden-sage/10 to-eden-brown/10 rounded-lg p-3 md:p-4 border border-eden-brown/20 mx-2 md:mx-0">
              <div className="text-center">
                <div className="text-sm md:text-base font-bold break-keep text-[#0d0000] whitespace-pre-line">입금계좌 
                {dashboardContent.bankAccount || "농협 352-1701-3342-63 (예금주: 손*진)"}</div>
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{dashboardContent.bankMessage || "주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다"}</p>
              </div>
            </div>
          </div>

          {/* Order Form Section */}
          <div id="order" className="mb-8 md:mb-16">
            <div className="max-w-4xl mx-auto">
              <div className="bg-eden-cream rounded-2xl p-4 md:p-8 shadow-lg mx-2 md:mx-0">
                <h3 className="text-xl md:text-2xl font-bold text-eden-brown mb-4 md:mb-6 text-center font-korean">
                  주문하기
                </h3>
                <OrderForm />
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
