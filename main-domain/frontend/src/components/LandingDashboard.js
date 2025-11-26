import React, { useState, useEffect } from 'react';

const LandingDashboard = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [visibleSections, setVisibleSections] = useState(new Set());

  // Trigger initial animations on component mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    // Observe all sections
    const sections = document.querySelectorAll('[data-animate-section]');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // Helpers
  const getInitials = (name) => {
    const parts = name.split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts[parts.length - 1]?.[0] || '';
    return (first + last).toUpperCase();
  };

  // Data (monochrome, professional style)
  const businessStats = [
    { label: 'Years of Experience', value: '15+', description: 'Industry expertise', icon: 'star' },
    { label: 'Properties Managed', value: '500+', description: 'Across Cebu City', icon: 'building' },
    { label: 'Happy Tenants', value: '2000+', description: 'Satisfied customers', icon: 'users' },
    { label: 'Cities Covered', value: '8', description: 'Major locations', icon: 'city' }
  ];

  const services = [
    {
      title: 'Property Management',
      description:
        'End-to-end management for landlords and investors: tenant relations, rent collection, and maintenance oversight.',
      icon: 'home',
      features: ['Tenant Relations', 'Rent Collection', 'Maintenance', 'Compliance']
    },
    {
      title: 'Tenant Screening',
      description:
        'Reliable screening: background checks, employment and reference verification for risk-free occupancy.',
      icon: 'search',
      features: ['Background Check', 'Credit Review', 'Employment Verify', 'References']
    },
    {
      title: 'Maintenance Services',
      description:
        '24/7 responsive maintenance with verified vendors and proactive prevention to reduce downtime.',
      icon: 'wrench',
      features: ['Emergency Repairs', 'Preventive Care', 'Quality Control', 'Vendor Network']
    },
    {
      title: 'Financial Management',
      description:
        'Transparent accounting: income/expense tracking, monthly reports, and tax-ready exports.',
      icon: 'report',
      features: ['Income Tracking', 'Expense Logs', 'Reports', 'Tax Prep']
    }
  ];

  const testimonials = [
    {
      name: 'Maria Santos',
      role: 'Property Owner',
      text:
        'They manage my rentals professionally and consistently. Payouts are on time and communication is excellent.',
      rating: 5
    },
    {
      name: 'Juan Dela Cruz',
      role: 'Tenant',
      text:
        'Quick maintenance responses and well-kept spaces. Moving in and living here has been seamless and secure.',
      rating: 5
    },
    {
      name: 'Ana Rodriguez',
      role: 'Investor',
      text:
        'Efficient operations and clear reporting. A trustworthy partner for growing a real estate portfolio.',
      rating: 5
    }
  ];

  const partners = [
    { name: 'Ayala Land', category: 'Real Estate' },
    { name: 'SM Development Corporation', category: 'Development' },
    { name: 'Megaworld Corporation', category: 'Real Estate' },
    { name: 'Robinsons Land Corporation', category: 'Real Estate' },
    { name: 'Filinvest Land', category: 'Development' },
    { name: 'DMCI Homes', category: 'Real Estate' }
  ];

  // Icons (monochrome SVG)
  const Icon = ({ name, className = 'w-6 h-6' }) => {
    switch (name) {
      case 'star':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        );
      case 'building':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 9h.01M13 9h.01M9 13h.01M13 13h.01M9 17h.01M13 17h.01" />
          </svg>
        );
      case 'users':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4-3 1.79-3 4 1.343 4 3 4zM8 11c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4z" />
            <path d="M2 21v-1a5 5 0 015-5h2" />
            <path d="M14 15h2a5 5 0 015 5v1" />
          </svg>
        );
      case 'city':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 21h18M5 21V8l4-2 4 2v13M13 21V4l4 2v15" />
            <path d="M7 10h.01M11 10h.01M15 8h.01M7 14h.01M11 14h.01M15 12h.01" />
          </svg>
        );
      case 'home':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 11l9-7 9 7" />
            <path d="M9 22V12h6v10" />
          </svg>
        );
      case 'search':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-3.8-3.8" />
          </svg>
        );
      case 'wrench':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14.7 6.3a4 4 0 10-5.66 5.66l8.49 8.49a2 2 0 102.83-2.83l-8.49-8.49z" />
          </svg>
        );
      case 'report':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M9 3h6a2 2 0 012 2v14l-5-3-5 3V5a2 2 0 012-2z" />
          </svg>
        );
      case 'check':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        );
      case 'star-solid':
        return (
          <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-16 md:space-y-24 lg:space-y-32">
      {/* Hero Section */}
      <section 
        id="hero" 
        data-animate-section
        className={`relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-black via-gray-900 to-black text-white transform transition-all duration-1000 ease-out ${
          isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
        }`}
      >
        <div className="absolute inset-0 opacity-10 animate-pulse" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '24px 24px'}} />
        <div className="relative px-6 md:px-12 lg:px-20 py-16 md:py-20 lg:py-24 text-center">
          <div 
            className={`inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur text-xs md:text-sm font-semibold tracking-wide border border-white/20 transform transition-all duration-800 delay-300 ease-out ${
              isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
            }`}
          >
            Trusted by thousands nationwide
          </div>
          <h1 
            className={`mt-6 md:mt-8 text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent transform transition-all duration-1000 delay-500 ease-out ${
              isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            Professional Property Management
          </h1>
          <p 
            className={`mt-4 md:mt-6 text-sm md:text-lg lg:text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed transform transition-all duration-800 delay-700 ease-out ${
              isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Joint Association & Community System delivers modern, transparent, and reliable services for owners and tenants across Cebu City and surrounding areas.
          </p>
          <div 
            className={`mt-8 md:mt-10 lg:mt-12 flex flex-col sm:flex-row justify-center gap-4 md:gap-6 transform transition-all duration-800 delay-900 ease-out ${
              isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <button className="px-6 md:px-8 lg:px-10 py-3 md:py-4 rounded-xl bg-white text-black font-bold text-sm md:text-base hover:bg-gray-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 active:scale-95">
              Explore Rent Spaces
            </button>
            <button className="px-6 md:px-8 lg:px-10 py-3 md:py-4 rounded-xl border border-white text-white font-bold text-sm md:text-base hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 hover:-translate-y-1">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Business Statistics */}
      <section 
        id="stats" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`text-center mb-12 md:mb-16 lg:mb-20 transform transition-all duration-800 ease-out ${
            visibleSections.has('stats') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-black bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
            Why Choose Us
          </h2>
          <p className="mt-3 md:mt-4 text-gray-600 text-sm md:text-lg lg:text-xl max-w-3xl mx-auto">
            Over a decade of trusted service with measurable results
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {businessStats.map((stat, index) => (
            <div 
              key={stat.label} 
              className={`group bg-white border border-gray-200 rounded-3xl p-6 md:p-8 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 cursor-pointer transform ${
                visibleSections.has('stats') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gray-100 mx-auto mb-4 md:mb-6 transform transition-all duration-300 group-hover:bg-black group-hover:scale-110 group-hover:rotate-12">
                <Icon name={stat.icon} className="w-6 h-6 md:w-7 md:h-7 text-gray-800 group-hover:text-white transition-colors duration-300" />
              </div>
              <p className="text-3xl md:text-4xl font-black text-black text-center group-hover:scale-110 transition-transform duration-300">
                {stat.value}
              </p>
              <p className="mt-1 md:mt-2 font-semibold text-gray-800 text-center text-sm md:text-base">{stat.label}</p>
              <p className="mt-1 text-xs md:text-sm text-gray-500 text-center">{stat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section 
        id="services" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`text-center mb-12 md:mb-16 lg:mb-20 transform transition-all duration-800 ease-out ${
            visibleSections.has('services') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-black bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
            Our Services
          </h2>
          <p className="mt-3 md:mt-4 text-gray-600 text-sm md:text-lg lg:text-xl max-w-3xl mx-auto">
            Tailored solutions for owners, investors, and tenants
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
          {services.map((service, index) => (
            <article 
              key={service.title} 
              className={`bg-white border border-gray-200 rounded-3xl p-6 md:p-8 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 cursor-pointer group transform ${
                visibleSections.has('services') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gray-100 flex items-center justify-center transform transition-all duration-300 group-hover:bg-black group-hover:scale-110 group-hover:rotate-12">
                  <Icon name={service.icon} className="w-6 h-6 md:w-7 md:h-7 text-gray-800 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-black text-black mb-2 md:mb-4 group-hover:text-gray-800 transition-colors duration-300">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm md:text-base mb-4 md:mb-6 group-hover:text-gray-700 transition-colors duration-300">
                    {service.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {service.features.map((feature, featureIndex) => (
                      <div 
                        key={feature} 
                        className={`flex items-center text-xs md:text-sm text-gray-700 transform transition-all duration-300 group-hover:translate-x-2 ${
                          visibleSections.has('services') ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                        }`}
                        style={{ transitionDelay: `${(index * 200) + (featureIndex * 100)}ms` }}
                      >
                        <Icon name="check" className="w-3 h-3 md:w-4 md:h-4 mr-2 text-black flex-shrink-0 group-hover:scale-125 transition-transform duration-300" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* About */}
      <section 
        id="about" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200 rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl transform transition-all duration-1000 ease-out ${
            visibleSections.has('about') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
          }`}
        >
          <div 
            className={`text-center mb-12 md:mb-16 lg:mb-20 transform transition-all duration-800 delay-200 ease-out ${
              visibleSections.has('about') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-black bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
              About Joint Association & Community System
            </h2>
            <p className="mt-3 md:mt-4 text-gray-600 text-sm md:text-lg lg:text-xl max-w-4xl mx-auto">
              Building communities and managing properties with excellence since 2009
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-start">
            <div 
              className={`space-y-4 md:space-y-6 lg:space-y-8 transform transition-all duration-800 delay-400 ease-out ${
                visibleSections.has('about') ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <p className="text-gray-700 leading-relaxed text-sm md:text-base lg:text-lg hover:text-gray-900 transition-colors duration-300">
                We specialize in professional property management, enabling owners to maximize value while providing tenants with comfortable, well-managed homes.
              </p>
              <p className="text-gray-700 leading-relaxed text-sm md:text-base lg:text-lg hover:text-gray-900 transition-colors duration-300">
                Our approach is modern and transparent—powered by clear reporting, proactive maintenance, and responsive support.
              </p>
              <p className="text-gray-700 leading-relaxed text-sm md:text-base lg:text-lg hover:text-gray-900 transition-colors duration-300">
                With a presence across major Philippine cities, we bring consistency and quality to every property we manage.
              </p>
            </div>
            <div 
              className={`bg-white rounded-3xl p-6 md:p-8 lg:p-10 shadow-xl border border-gray-100 transform transition-all duration-800 delay-600 ease-out hover:scale-105 hover:shadow-2xl group ${
                visibleSections.has('about') ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
              }`}
            >
              <h3 className="text-lg md:text-xl lg:text-2xl font-black text-black mb-6 md:mb-8 group-hover:text-gray-800 transition-colors duration-300">
                Our Values
              </h3>
              <ul className="space-y-3 md:space-y-4">
                {['Professional Excellence', 'Customer Satisfaction', 'Transparency & Trust', 'Community Building'].map((value, index) => (
                  <li 
                    key={value} 
                    className={`flex items-center p-3 md:p-4 rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 hover:translate-x-2 ${
                      visibleSections.has('about') ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                    }`}
                    style={{ transitionDelay: `${600 + (index * 150)}ms` }}
                  >
                    <div className="w-8 h-8 md:w-10 md:h-10 mr-3 md:mr-4 rounded-full bg-gray-900 text-white flex items-center justify-center flex-shrink-0 transform transition-all duration-300 hover:bg-black hover:scale-110 hover:rotate-12">
                      <Icon name="check" className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <span className="text-gray-800 font-semibold text-sm md:text-base hover:text-black transition-colors duration-300">
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section 
        id="partners" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`text-center mb-12 md:mb-16 lg:mb-20 transform transition-all duration-800 ease-out ${
            visibleSections.has('partners') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-black bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
            Our Trusted Partners
          </h2>
          <p className="mt-3 md:mt-4 text-gray-600 text-sm md:text-lg lg:text-xl max-w-3xl mx-auto">
            Working with leading developers and real estate groups
          </p>
        </div>
        <div 
          className={`bg-white border border-gray-200 rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl transform transition-all duration-1000 ease-out ${
            visibleSections.has('partners') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
          }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8 lg:gap-10 items-center">
            {partners.map((p, index) => (
              <div 
                key={p.name} 
                className={`text-center group transform transition-all duration-500 hover:scale-110 hover:-translate-y-2 ${
                  visibleSections.has('partners') ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-full mx-auto">
                  <div className="inline-flex items-center justify-center px-3 md:px-4 py-2 md:py-3 rounded-xl bg-gray-100 text-gray-900 font-semibold text-xs md:text-sm lg:text-base hover:bg-gray-900 hover:text-white transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3">
                    {p.name}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 group-hover:text-gray-700 transition-colors duration-300">
                  {p.category}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section 
        id="testimonials" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`text-center mb-12 md:mb-16 lg:mb-20 transform transition-all duration-800 ease-out ${
            visibleSections.has('testimonials') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-black bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
            What Our Clients Say
          </h2>
          <p className="mt-3 md:mt-4 text-gray-600 text-sm md:text-lg lg:text-xl max-w-3xl mx-auto">
            Real feedback from owners, tenants, and investors
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
          {testimonials.map((t, index) => (
            <article 
              key={t.name} 
              className={`bg-white border border-gray-200 rounded-3xl p-6 md:p-8 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 cursor-pointer group transform ${
                visibleSections.has('testimonials') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <div className="flex items-center mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold mr-3 md:mr-4 text-sm md:text-base transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                  {getInitials(t.name)}
                </div>
                <div>
                  <p className="font-black text-black text-sm md:text-base group-hover:text-gray-800 transition-colors duration-300">
                    {t.name}
                  </p>
                  <p className="text-gray-500 text-xs md:text-sm group-hover:text-gray-600 transition-colors duration-300">
                    {t.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center mb-3 md:mb-4 text-black">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Icon 
                    key={i} 
                    name="star-solid" 
                    className={`w-3 h-3 md:w-4 md:h-4 mr-1 transform transition-all duration-300 group-hover:scale-125 ${
                      visibleSections.has('testimonials') ? 'rotate-0 opacity-100' : 'rotate-180 opacity-0'
                    }`}
                    style={{ transitionDelay: `${(index * 200) + (i * 100)}ms` }}
                  />
                ))}
              </div>
              <p className="text-gray-700 italic text-sm md:text-base leading-relaxed group-hover:text-gray-900 transition-colors duration-300">
                "{t.text}"
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section 
        id="cta" 
        data-animate-section
        className="px-4 md:px-6 lg:px-8"
      >
        <div 
          className={`bg-gradient-to-br from-black via-gray-900 to-black text-white rounded-3xl p-8 md:p-12 lg:p-16 text-center shadow-2xl relative overflow-hidden transform transition-all duration-1000 ease-out ${
            visibleSections.has('cta') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
          }`}
        >
          <div className="absolute inset-0 opacity-10 animate-pulse" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '24px 24px'}} />
          <div className="relative max-w-4xl mx-auto">
            <h2 
              className={`text-2xl md:text-4xl lg:text-5xl font-black mb-4 md:mb-6 lg:mb-8 bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent transform transition-all duration-800 delay-200 ease-out ${
                visibleSections.has('cta') ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              Ready to Get Started?
            </h2>
            <p 
              className={`text-gray-300 text-sm md:text-base lg:text-lg mb-6 md:mb-8 lg:mb-10 transform transition-all duration-800 delay-400 ease-out ${
                visibleSections.has('cta') ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              Join thousands who trust us to manage and maintain quality homes and profitable properties.
            </p>
            <div 
              className={`flex flex-col sm:flex-row gap-4 md:gap-6 justify-center transform transition-all duration-800 delay-600 ease-out ${
                visibleSections.has('cta') ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <button className="px-8 md:px-10 lg:px-12 py-3 md:py-4 rounded-xl bg-white text-black font-black text-sm md:text-base hover:bg-gray-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 active:scale-95">
                Contact Us
              </button>
              <button className="px-8 md:px-10 lg:px-12 py-3 md:py-4 rounded-xl border border-white text-white font-black text-sm md:text-base hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 hover:-translate-y-1">
                Schedule a Consultation
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingDashboard;
