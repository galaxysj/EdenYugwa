import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Leaf, Heart, BicepsFlexed, Sprout, Church, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ShoppingCart, Info, Menu, X } from "lucide-react";
import OrderForm from "@/components/order-form";
import edenHangwaImage from "@assets/image_1753160591635.png";
import edenHangwaImage2 from "@assets/image_1753160530604.png";

export default function Home() {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
              <Link href="/admin">
                <Button variant="ghost" className="text-eden-red hover:text-eden-brown">
                  관리자
                </Button>
              </Link>
              <Link href="/manager">
                <Button variant="ghost" className="text-eden-sage hover:text-eden-brown">
                  매니저
                </Button>
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
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
                    className="text-left text-eden-brown hover:text-eden-dark transition-colors py-2 w-full"
                  >
                    주문 조회
                  </button>
                </Link>
                <Link href="/admin">
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-left text-eden-red hover:text-eden-brown transition-colors py-2 w-full"
                  >
                    관리자
                  </button>
                </Link>
                <Link href="/manager">
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-left text-eden-sage hover:text-eden-brown transition-colors py-2 w-full"
                  >
                    매니저
                  </button>
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>
      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-4xl md:text-5xl font-bold text-eden-brown mb-6 leading-tight font-korean">
                진안에서 온<br />
                <span className="text-eden-red">정성 가득</span> 유과
              </h2>
              <p className="text-lg text-eden-dark mb-8 leading-relaxed">
                부모님이 직접 만드시는 찹쌀유과로<br />
                100% 국내산 찹쌀로 만든 한과입니다.<br />
                달지 않고 고소한 맛이 일품으로<br />
                선물로도 완벽한 에덴한과입니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  onClick={() => scrollToSection('order')}
                  className="bg-eden-brown text-white px-8 py-3 hover:bg-eden-dark transition-colors"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  지금 주문하기
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => scrollToSection('about')}
                  className="border-2 border-eden-brown text-eden-brown hover:bg-eden-brown hover:text-white transition-colors"
                >
                  자세히 알아보기
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <img 
                  src={edenHangwaImage} 
                  alt="에덴한과 유과 상품" 
                  className="rounded-2xl shadow-2xl w-full max-w-md"
                />
                <div className="absolute -bottom-4 -right-4 bg-eden-red text-white px-4 py-2 rounded-lg font-semibold shadow-lg">
                  <Heart className="inline mr-1 h-4 w-4" />
                  수제 한과
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* About Section */}
      <section id="about" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-eden-brown mb-4 font-korean">에덴한과 이야기</h3>
            <p className="text-eden-dark max-w-2xl mx-auto text-[20px]">
              국내산 찹쌀과 물엿, 튀밥, 생강, 콩기름(식용유) 등으로 만들고 있으며,<br />
              생강 향과 물엿의 달콤함이 어우러진 맛을 자랑합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-sage rounded-full flex items-center justify-center mx-auto mb-4">
                  <BicepsFlexed className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-4 leading-tight">믿을 수 있는 재료 사용</h4>
                <p className="text-eden-dark text-sm leading-relaxed px-2">
                  우리 가족이 먹을 음식이기에 최대한 깨끗하고 건강하게 만드는 찹쌀한과입니다.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-brown rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sprout className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-4 leading-tight">정성과 손길로<br />빚어낸 한과</h4>
                <p className="text-eden-dark text-sm leading-relaxed px-2">
                  색 유과로 예쁘게 가지런히 담고,<br />
                  하얀색 유과로 차곡차곡 정성을 담아 담습니다.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-eden-cream">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-eden-red rounded-full flex items-center justify-center mx-auto mb-4">
                  <Church className="text-white text-2xl" />
                </div>
                <h4 className="text-xl font-semibold text-eden-brown mb-4 leading-tight">특별한 순간에<br />딱 맞는 간식</h4>
                <p className="text-eden-dark text-sm leading-relaxed px-2">
                  명절 선물, 아이들 간식, 부모님과 함께하는 티타임 등 다양한 순간에 어울리는 한과입니다.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Product Showcase */}
          <div className="gradient-card rounded-2xl p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <img 
                  src={edenHangwaImage2} 
                  alt="전통 한과 재료" 
                  className="rounded-xl shadow-lg w-full"
                />
              </div>
              <div>
                <h4 className="text-2xl font-bold text-eden-brown mb-6">우리 유과의 특별함</h4>
                <ul className="space-y-4">
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">엄선된 국산 재료만을 사용하여 건강하고 안전합니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">전통 제조 방식을 고수하여 깊은 맛과 향을 자랑합니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">과도하지 않은 단맛으로 부담 없이 즐길 수 있습니다</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-eden-sage rounded-full flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-eden-dark">아름다운 포장으로 선물용으로도 완벽합니다</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Order Section */}
      <section id="order" className="py-16 bg-eden-cream">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-eden-brown mb-4 font-korean">주문하기</h3>
            <p className="text-eden-dark mb-2">신선하고 정성스런 에덴한과를 주문해보세요</p>
            <p className="text-sm text-eden-sage">
              <Info className="inline mr-1 h-4 w-4" />
              배송까지 1-2일 소요됩니다
            </p>
          </div>

          <OrderForm />
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-eden-dark text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Leaf className="text-eden-sage text-2xl" />
                <h3 className="text-xl font-bold font-korean">에덴한과</h3>
              </div>
              <p className="text-gray-300 mb-4">
                하나님의 은혜로 시작된 진안의 정성스런 수제 유과
              </p>
              <div className="flex space-x-4">
                <Facebook className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
                <Instagram className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
                <Youtube className="text-eden-sage cursor-pointer hover:text-eden-cream transition-colors" />
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">연락처</h4>
              <div className="space-y-2 text-gray-300">
                <p><Phone className="inline mr-2 h-4 w-4" /> 063-123-4567</p>
                <p><Mail className="inline mr-2 h-4 w-4" /> eden@hansik.co.kr</p>
                <p><MapPin className="inline mr-2 h-4 w-4" /> 전라북도 진안군</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">운영시간</h4>
              <div className="space-y-2 text-gray-300">
                <p>평일: 09:00 - 18:00</p>
                <p>토요일: 09:00 - 15:00</p>
                <p>일요일: 휴무</p>
                <p className="text-sm text-eden-sage mt-4">
                  <Info className="inline mr-1 h-4 w-4" />
                  주문 후 3-5일 소요됩니다
                </p>
              </div>
            </div>
          </div>
          
          <hr className="border-gray-600 my-8" />
          
          <div className="text-center text-gray-400">
            <p>&copy; 2024 에덴한과. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
