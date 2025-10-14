'use client';

import { useState } from 'react';

interface KoreanSupplier {
  id: string;
  name: string;
  korean_name: string;
  business_type: string;
  city: string;
  district: string;
  specialties: string[];
  minimum_order_usd: number;
  verification_status: string;
  response_rate: number;
  avg_response_time_hours: number;
  contact_email: string;
  whatsapp_number?: string;
  public_description: string;
  group_buy_eligible: boolean;
}

interface SupplierDirectoryWidgetProps {}

export default function SupplierDirectoryWidget({}: SupplierDirectoryWidgetProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<KoreanSupplier | null>(null);
  const [contactForm, setContactForm] = useState({
    message: '',
    productInterest: '',
    quantity: '',
    timeline: ''
  });

  // Mock data - would come from API
  const suppliers: KoreanSupplier[] = [
    {
      id: '1',
      name: 'Seoul Beauty Hub',
      korean_name: '서울뷰티허브',
      business_type: 'distributor',
      city: 'Seoul',
      district: 'Gangnam',
      specialties: ['skincare', 'makeup'],
      minimum_order_usd: 200,
      verification_status: 'verified',
      response_rate: 0.95,
      avg_response_time_hours: 24,
      contact_email: 'contact@seoulbeautyhub.kr',
      whatsapp_number: '+82-10-1234-5678',
      public_description: 'Premium Korean beauty distributor specializing in authentic K-beauty brands. Direct partnerships with major manufacturers.',
      group_buy_eligible: true
    },
    {
      id: '2',
      name: 'K-Beauty Direct',
      korean_name: '케이뷰티다이렉트',
      business_type: 'wholesaler',
      city: 'Seoul',
      district: 'Hongdae',
      specialties: ['skincare', 'tools'],
      minimum_order_usd: 150,
      verification_status: 'verified',
      response_rate: 0.92,
      avg_response_time_hours: 12,
      contact_email: 'info@kbeautydirect.co.kr',
      public_description: 'Wholesale Korean beauty supplier with competitive pricing. Specializes in emerging brands and innovative products.',
      group_buy_eligible: true
    },
    {
      id: '3',
      name: 'Myeongdong Beauty Supply',
      korean_name: '명동뷰티서플라이',
      business_type: 'retailer',
      city: 'Seoul',
      district: 'Jung-gu',
      specialties: ['skincare', 'makeup', 'tools'],
      minimum_order_usd: 100,
      verification_status: 'pending',
      response_rate: 0.88,
      avg_response_time_hours: 48,
      contact_email: 'sales@mdbeauty.kr',
      public_description: 'Located in the heart of Myeongdong shopping district. Wide selection of popular Korean beauty brands.',
      group_buy_eligible: false
    }
  ];

  const handleContactSubmit = () => {
    // Handle contact form submission
    console.log('Contact form submitted:', contactForm);
    alert('Your message has been sent to the supplier. They typically respond within 24-48 hours.');
    setContactForm({ message: '', productInterest: '', quantity: '', timeline: '' });
    setSelectedSupplier(null);
  };

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">WHOLESALE ACCESS</p>
          <h3 className="text-2xl font-light text-white">Korean Supplier Directory</h3>
          <p className="text-luxury-gray mt-2">
            Verified Seoul suppliers for wholesale pricing and group buying
          </p>
        </div>
        <div className="text-right">
          <div className="text-luxury-gold text-lg font-light">
            {suppliers.filter(s => s.verification_status === 'verified').length}
          </div>
          <p className="text-luxury-gray text-xs uppercase tracking-wider">
            VERIFIED SUPPLIERS
          </p>
        </div>
      </div>

      {selectedSupplier ? (
        <div className="border border-luxury-gold border-opacity-20 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h4 className="text-white text-xl font-light mb-2">
                {selectedSupplier.name}
              </h4>
              <p className="text-luxury-gray mb-4">
                {selectedSupplier.korean_name} • {selectedSupplier.district}, {selectedSupplier.city}
              </p>
            </div>
            <button
              onClick={() => setSelectedSupplier(null)}
              className="text-luxury-gray hover:text-luxury-gold transition-colors duration-300"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h5 className="text-white font-light mb-4">Supplier Information</h5>
              <div className="space-y-4">
                <div>
                  <p className="text-luxury-gray text-sm uppercase tracking-wider mb-1">
                    BUSINESS TYPE
                  </p>
                  <p className="text-white capitalize">{selectedSupplier.business_type}</p>
                </div>
                <div>
                  <p className="text-luxury-gray text-sm uppercase tracking-wider mb-1">
                    SPECIALTIES
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSupplier.specialties.map((specialty, idx) => (
                      <span key={idx} className="bg-luxury-gold bg-opacity-20 text-luxury-gold px-2 py-1 text-xs capitalize">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-luxury-gray text-sm uppercase tracking-wider mb-1">
                    MINIMUM ORDER
                  </p>
                  <p className="text-white">${selectedSupplier.minimum_order_usd} USD</p>
                </div>
                <div>
                  <p className="text-luxury-gray text-sm uppercase tracking-wider mb-1">
                    RESPONSE TIME
                  </p>
                  <p className="text-white">
                    {selectedSupplier.avg_response_time_hours} hours average ({(selectedSupplier.response_rate * 100).toFixed(0)}% response rate)
                  </p>
                </div>
                <div>
                  <p className="text-luxury-gray text-sm uppercase tracking-wider mb-1">
                    GROUP BUYING
                  </p>
                  <p className={selectedSupplier.group_buy_eligible ? 'text-luxury-gold' : 'text-luxury-gray'}>
                    {selectedSupplier.group_buy_eligible ? 'Available' : 'Not Available'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-white font-light mb-4">Contact Supplier</h5>
              <div className="space-y-4">
                <div>
                  <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                    Product Interest
                  </label>
                  <input
                    type="text"
                    value={contactForm.productInterest}
                    onChange={(e) => setContactForm(prev => ({ ...prev, productInterest: e.target.value }))}
                    placeholder="e.g., COSRX Snail Essence, Beauty of Joseon SPF..."
                    className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-2 focus:border-luxury-gold focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                      Quantity
                    </label>
                    <input
                      type="text"
                      value={contactForm.quantity}
                      onChange={(e) => setContactForm(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="e.g., 50 units"
                      className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-2 focus:border-luxury-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                      Timeline
                    </label>
                    <select
                      value={contactForm.timeline}
                      onChange={(e) => setContactForm(prev => ({ ...prev, timeline: e.target.value }))}
                      className="w-full bg-black border border-luxury-gold border-opacity-30 text-white px-4 py-2 focus:border-luxury-gold focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="immediate">Immediate</option>
                      <option value="1-2weeks">1-2 weeks</option>
                      <option value="1month">1 month</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-luxury-gray text-sm uppercase tracking-wider mb-2">
                    Message
                  </label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Introduce yourself and specify your requirements..."
                    rows={4}
                    className="w-full bg-transparent border border-luxury-gold border-opacity-30 text-white px-4 py-2 focus:border-luxury-gold focus:outline-none resize-none"
                  />
                </div>
                <button
                  onClick={handleContactSubmit}
                  className="w-full bg-luxury-gold text-black py-3 text-sm uppercase tracking-wider font-medium hover:bg-opacity-90 transition-all duration-300"
                >
                  SEND MESSAGE
                </button>
                <div className="text-center text-xs text-luxury-gray">
                  <p>Response time: {selectedSupplier.avg_response_time_hours} hours average</p>
                  <p>Contact directly: {selectedSupplier.contact_email}</p>
                  {selectedSupplier.whatsapp_number && (
                    <p>WhatsApp: {selectedSupplier.whatsapp_number}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="border border-luxury-gold border-opacity-10 p-6 hover:border-opacity-30 transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedSupplier(supplier)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-luxury-gold bg-opacity-10 rounded flex items-center justify-center">
                      <span className="text-luxury-gold text-lg">🇰🇷</span>
                    </div>
                    <div>
                      <h4 className="text-white font-light text-lg">
                        {supplier.name}
                      </h4>
                      <p className="text-luxury-gray text-sm">
                        {supplier.korean_name} • {supplier.district}, {supplier.city}
                      </p>
                    </div>
                    {supplier.verification_status === 'verified' && (
                      <span className="bg-luxury-gold text-black px-2 py-1 text-xs uppercase tracking-wider font-medium">
                        VERIFIED
                      </span>
                    )}
                  </div>

                  <p className="text-luxury-gray text-sm mb-4 max-w-2xl">
                    {supplier.public_description}
                  </p>

                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-luxury-gray">Min Order:</span>
                      <span className="text-white ml-2">${supplier.minimum_order_usd}</span>
                    </div>
                    <div>
                      <span className="text-luxury-gray">Response:</span>
                      <span className="text-white ml-2">{supplier.avg_response_time_hours}h</span>
                    </div>
                    <div>
                      <span className="text-luxury-gray">Specialties:</span>
                      <span className="text-white ml-2">{supplier.specialties.slice(0, 2).join(', ')}</span>
                    </div>
                    {supplier.group_buy_eligible && (
                      <span className="bg-luxury-gold bg-opacity-20 text-luxury-gold px-2 py-1 text-xs">
                        GROUP BUY
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-2">
                    <div className="text-luxury-gold text-lg font-light">
                      {(supplier.response_rate * 100).toFixed(0)}%
                    </div>
                    <p className="text-luxury-gray text-xs uppercase tracking-wider">
                      RESPONSE RATE
                    </p>
                  </div>
                  <button className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100">
                    CONTACT →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-luxury-gold border-opacity-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🤝</div>
            <h4 className="text-white font-light mb-2">Verified Partners</h4>
            <p className="text-luxury-gray text-sm">
              All suppliers are manually verified for authenticity and reliability
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">💰</div>
            <h4 className="text-white font-light mb-2">Wholesale Pricing</h4>
            <p className="text-luxury-gray text-sm">
              Access Korean wholesale prices typically 30-70% below US retail
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">📦</div>
            <h4 className="text-white font-light mb-2">Group Buying</h4>
            <p className="text-luxury-gray text-sm">
              Join group orders to meet minimum quantities and reduce shipping costs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}