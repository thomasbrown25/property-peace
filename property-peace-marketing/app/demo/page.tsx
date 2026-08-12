'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiCalendar } from 'react-icons/fi';

export default function DemoPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    numberOfUnits: '',
    howCanWeHelp: '',
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/tbrown-brownstonehub';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    if (!formData.numberOfUnits.trim()) {
      newErrors.numberOfUnits = 'Number of units is required';
    } else if (!Number.isInteger(Number(formData.numberOfUnits)) || Number(formData.numberOfUnits) < 1) {
      newErrors.numberOfUnits = 'Please enter a valid number of units';
    }

    if (!formData.howCanWeHelp.trim()) {
      newErrors.howCanWeHelp = 'Please select how we can help';
    }

    if (!consentChecked) {
      newErrors.consent = 'You must agree to the terms and privacy policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    window.location.href = calendlyUrl;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1
              className="text-4xl md:text-5xl font-bold text-primary-main mb-4"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              Simplify Your Property Management
            </h1>
            <p
              className="text-xl text-[#737373] max-w-2xl mx-auto"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              See how Property Peace can streamline your property management. Schedule a personalized demo with our team.
            </p>
          </motion.div>

          {/* Progress Indicator */}
          <motion.div
            className="flex items-center justify-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            <div className="flex items-center space-x-4">
              {/* Step 1 - Active */}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-primary-main flex items-center justify-center">
                  <FiCheck className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3">
                  <p
                    className="text-sm font-semibold text-primary-main"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Fill out this form
                  </p>
                </div>
              </div>

              {/* Connector */}
              <div className="w-16 h-0.5 bg-[#E5E5E5] mx-4"></div>

              {/* Step 2 - Inactive */}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#E5E5E5] flex items-center justify-center">
                  <FiCalendar className="w-5 h-5 text-[#737373]" />
                </div>
                <div className="ml-3">
                  <p
                    className="text-sm font-medium text-[#737373]"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Pick a time to chat
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div
            className="bg-white rounded-2xl p-8 md:p-12 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          >
            <form onSubmit={handleSubmit}>
              {/* Form Fields - Two Columns */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* First Name */}
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.firstName ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="First Name"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.lastName ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="Last Name"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.lastName}
                    </p>
                  )}
                </div>

                {/* Company Name */}
                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.companyName ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="Company Name"
                  />
                  {errors.companyName && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.companyName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.email ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="Email"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.phone ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="Phone"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Number of Units */}
                <div>
                  <label
                    htmlFor="numberOfUnits"
                    className="block text-sm font-medium text-primary-main mb-2"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    Number of Units *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    id="numberOfUnits"
                    name="numberOfUnits"
                    value={formData.numberOfUnits}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors ${
                      errors.numberOfUnits ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                    style={{ fontFamily: '"Inter", sans-serif' }}
                    placeholder="Number of Units"
                  />
                  {errors.numberOfUnits && (
                    <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                      {errors.numberOfUnits}
                    </p>
                  )}
                </div>
              </div>

              {/* How can we help - Full Width */}
              <div className="mb-6">
                <label
                  htmlFor="howCanWeHelp"
                  className="block text-sm font-medium text-primary-main mb-2"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  How can we help you? *
                </label>
                <select
                  id="howCanWeHelp"
                  name="howCanWeHelp"
                  value={formData.howCanWeHelp}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#217eff] transition-colors bg-white ${
                    errors.howCanWeHelp ? 'border-red-500' : 'border-[#E5E5E5]'
                  }`}
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  <option value="">How can we help you?</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Product Demo">Product Demo</option>
                  <option value="Pricing Questions">Pricing Questions</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Other">Other</option>
                </select>
                {errors.howCanWeHelp && (
                  <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {errors.howCanWeHelp}
                  </p>
                )}
              </div>

              {/* Consent Checkbox */}
              <div className="mb-6">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => {
                      setConsentChecked(e.target.checked);
                      if (errors.consent) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.consent;
                          return newErrors;
                        });
                      }
                    }}
                    className="mt-1 mr-3 w-4 h-4 text-[#217eff] border-[#E5E5E5] rounded focus:ring-[#217eff]"
                  />
                  <span
                    className="text-sm text-[#737373]"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    By submitting this form, you consent to the use of your contact information in accordance with{' '}
                    <a href="/terms" className="text-[#217eff] hover:underline" target="_blank" rel="noopener noreferrer">
                      Property Peace Terms
                    </a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-[#217eff] hover:underline" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-1 text-sm text-red-600" style={{ fontFamily: '"Inter", sans-serif' }}>
                    {errors.consent}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-8 py-4 bg-primary-main text-white rounded-none hover:bg-primary-hover font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ fontFamily: '"Inter", "Inter Placeholder", sans-serif' }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'REQUEST A DEMO'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
