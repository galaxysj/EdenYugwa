import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Leaf, Heart, BicepsFlexed, Sprout, Church, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ShoppingCart, Info, Menu, X } from "lucide-react";
import OrderForm from "@/components/order-form";
import edenHangwaImage from "@assets/image_1753160591635.png";
import edenHangwaImage2 from "@assets/image_1753160530604.png";

export default function Home() {
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
      {/* Order Section - Main Content */}
      <section id="home" className="relative overflow-hidden bg-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-eden-brown mb-6 leading-tight font-korean max-w-4xl mx-auto">
              진안에서 온 <span className="text-eden-red">정성 가득</span> 유과
            </h2>
            <p className="text-base sm:text-lg text-eden-dark mb-8 leading-relaxed max-w-2xl mx-auto">
              에덴한과에서 직접 만드는 찹쌀유과로 100% 국내산 찹쌀로 만든 한과입니다.<br className="hidden sm:block" />
              달지 않고 고소한 맛이 일품으로 선물로도 완벽한 에덴한과입니다.
            </p>
          </div>

          {/* Product Images */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex justify-center">
                <img 
                  src={edenHangwaImage} 
                  alt="에덴한과 유과 상품" 
                  className="rounded-xl shadow-md w-full max-w-sm"
                />
              </div>
              <div className="flex justify-center">
                <img 
                  src={edenHangwaImage2} 
                  alt="에덴한과 유과 상품" 
                  className="rounded-xl shadow-md w-full max-w-sm"
                />
              </div>
            </div>
          </div>

          {/* Bank Account Information */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-gradient-to-r from-eden-sage/10 to-eden-brown/10 rounded-lg p-6 border border-eden-brown/20">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-eden-red mb-3 font-korean">입금계좌</h4>
                <div className="text-2xl font-bold text-eden-red">
                  농협 352-1701-3342-63 (예금주: 손*진)
                </div>
                <p className="text-sm text-gray-600 mt-2">주문 후 위 계좌로 입금해 주시면 확인 후 발송해 드립니다</p>
              </div>
            </div>
          </div>

          {/* Order Form Section */}
          <div id="order" className="mb-16">
            <div className="max-w-4xl mx-auto">
              <div className="bg-eden-cream rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-eden-brown mb-6 text-center font-korean">
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
