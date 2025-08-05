import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Leaf, Heart, BicepsFlexed, Sprout, Church, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ShoppingCart, Info, Menu, X, Package, Settings } from "lucide-react";
import OrderForm from "@/components/order-form";
import edenHangwaImage from "@assets/image_1753160591635.png";
import edenHangwaImage2 from "@assets/image_1753160530604.png";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, isManagerOrAdmin, isAdmin, isManager, user } = useAuth();

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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Leaf className="text-eden-sage text-2xl" />
              <h1 className="text-2xl font-bold text-eden-brown font-korean">에덴한과</h1>
            </div>
            
            {/* 모바일 헤더 버튼들 - 오른쪽으로 이동 */}
            <div className="flex md:hidden gap-2">
              <Link href="/order-lookup">
                <button className="text-xs bg-white text-gray-600 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors">
                  주문조회
                </button>
              </Link>
              <Link href="/login">
                <button className="text-xs bg-white text-gray-600 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-colors">
                  회원가입
                </button>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <button 
                onClick={() => scrollToSection('home')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                홈
              </button>
              <button 
                onClick={() => scrollToSection('about')}
                className="text-eden-dark hover:text-eden-brown transition-colors"
              >
                소개
              </button>
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

            {/* Mobile Menu Button - Desktop only */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:block"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-eden-beige pt-4">
              <div className="flex flex-col space-y-4">
                <button 
                  onClick={() => {
                    scrollToSection('home');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2"
                >
                  홈
                </button>
                <button 
                  onClick={() => {
                    scrollToSection('about');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2"
                >
                  소개
                </button>
                <button 
                  onClick={() => {
                    scrollToSection('order');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-eden-dark hover:text-eden-brown transition-colors py-2"
                >
                  주문하기
                </button>
                <Link href="/order-lookup">
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-left text-eden-brown hover:text-eden-dark transition-colors py-3 px-4 w-full border border-eden-brown rounded-lg bg-white hover:bg-eden-brown hover:text-white"
                  >
                    📋 주문 조회
                  </button>
                </Link>
                {!isAuthenticated && (
                  <Link href="/login">
                    <button 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-left text-eden-brown hover:text-eden-dark transition-colors py-2 w-full border border-eden-brown rounded px-3 bg-white hover:bg-eden-brown hover:text-white"
                    >
                      로그인/회원가입
                    </button>
                  </Link>
                )}

                {isAuthenticated && (
                  <button 
                    className="text-left text-eden-brown hover:text-eden-dark transition-colors py-2 w-full border border-eden-brown rounded px-3 bg-white hover:bg-eden-brown hover:text-white"
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
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
                  </button>
                )}

              </div>
            </nav>
          )}
        </div>
      </header>
      {/* Order Section - Main Content */}
      <section id="home" className="relative overflow-hidden bg-white">
        <div className="container mx-auto px-4 py-6 md:py-12">


          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-eden-brown mb-4 md:mb-6 leading-tight font-korean max-w-4xl mx-auto">
              진안에서 온 <span className="text-eden-brown">정성 가득</span> 유과
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-eden-dark mb-6 md:mb-8 leading-relaxed max-w-2xl mx-auto px-2">
              부모님이 100% 국내산 찹쌀로 직접 만드는 찹쌀유과<br />
              달지않고 고소한 맛이 일품! 선물로도 완벽한 에덴한과 ^^
            </p>
          </div>

          {/* Product Images */}
          <div className="max-w-4xl mx-auto mb-8 md:mb-16">
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
          </div>

          {/* Bank Account Information */}
          <div className="max-w-lg mx-auto mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-eden-sage/10 to-eden-brown/10 rounded-lg p-3 md:p-4 border border-eden-brown/20 mx-2 md:mx-0">
              <div className="text-center">
                <h4 className="text-sm md:text-base font-bold text-eden-red mb-1 md:mb-2 font-korean">입금계좌</h4>
                <div className="text-sm md:text-base font-bold text-eden-red break-keep">
                  농협 352-1701-3342-63<br />
                  (예금주: 손*진)
                </div>
                <p className="text-xs text-gray-600 mt-1 px-2">주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다</p>
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
