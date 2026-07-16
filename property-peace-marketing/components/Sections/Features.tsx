'use client';

import { useEffect, useRef, useState } from 'react';
import { FiDollarSign, FiFileText, FiShield, FiSettings } from 'react-icons/fi';

export default function Features() {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = cardRefs.current.map((ref, index) => {
      if (!ref) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleCards((prev) => {
                if (!prev.includes(index)) {
                  return [...prev, index];
                }
                return prev;
              });
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  const features = [
    {
      icon: FiDollarSign,
      title: 'Cost Efficiency',
      description: 'SaaS solutions typically operate on a subscription basis, eliminating the need for significant upfront.',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: FiFileText,
      title: 'Scalability & Flexibility',
      description: 'Many SaaS solutions are designed to comply with industry standards and regulations.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      icon: FiShield,
      title: 'Enhanced Security',
      description: 'Provider regularly deploy updates and fresh features, so that you always get most latest tools.',
      color: 'text-green-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: FiSettings,
      title: 'Automatic Updates',
      description: 'Access your financial data from anywhere with internet, so you can work fast.',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    }
  ];

  return (
    <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 bg-[#fcfbfa]">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            const isVisible = visibleCards.includes(index);
            return (
              <div
                key={index}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className={`bg-white p-6 border transition-all duration-700 ease-out ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{
                  fontFamily: '"Inter", "Inter Placeholder", sans-serif',
                  borderColor: '#f9f6f4',
                  borderRadius: '20px'
                }}
              >
                <div className={`w-12 h-12 ${feature.bgColor} ${feature.color} rounded-lg flex items-center justify-center mb-24`}>
                  <IconComponent className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-primary-main mb-3" style={{ fontFamily: '"Poppins", sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-[#737373] text-sm leading-relaxed" style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
