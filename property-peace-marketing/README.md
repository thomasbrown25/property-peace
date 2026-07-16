# Brownstone Hub Marketing Landing Page

A modern, responsive Next.js landing page for Brownstone Hub property management platform.

## Features

- **Modern Design**: Clean black/white/grey color scheme inspired by TaskHub template
- **Fully Responsive**: Mobile-first design that works on all devices
- **Performance Optimized**: Built with Next.js 16 for optimal performance and SEO
- **Smooth Animations**: Framer Motion animations for engaging user experience

## Sections

1. **Navigation** - Fixed header with logo, menu items, and CTA buttons
2. **Hero** - Main headline, sub-headline, and dashboard preview
3. **Trusted By** - Social proof with company logos (placeholders)
4. **What Makes Us Different** - Three feature cards with dashboard previews
5. **Features** - Detailed feature showcases with calendar integration
6. **Integrations** - Stripe and DocuSign integration highlights
7. **Dashboard Overview** - Split design showing dashboard preview and features
8. **Testimonials** - Customer testimonials with ratings
9. **Pricing** - Starter and Growth plans with monthly/yearly toggle
10. **FAQ** - Accordion-style frequently asked questions
11. **Footer** - Dark footer with links, newsletter signup, and company info

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the page.

### Build

```bash
npm run build
npm start
```

## Customization

### Replace Placeholder Content

- **Company Logos**: Update `components/TrustedBy.tsx` with real company logos
- **Dashboard Screenshots**: Replace placeholder images in Hero, DashboardOverview, and feature sections
- **Testimonials**: Update `components/Testimonials.tsx` with real customer testimonials
- **Avatar Images**: Replace placeholder avatars in testimonials section

### Styling

The color scheme is defined in `app/globals.css` using CSS variables. All components use Tailwind CSS classes with the black/white/grey theme.

### Links

Update the following links to point to your actual application:
- Login: `https://app.propertypeace.io/login`
- Register: `https://app.propertypeace.io/register`
- Demo booking: Update the "Book a Demo" button link
- Contact: Update the "Contact Sales" button link

## Deployment

This Next.js app can be deployed to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS Amplify**
- Any static hosting service (with static export)

### Environment Variables

No environment variables are currently required. Add them as needed for analytics, contact forms, etc.

## Next Steps

1. Replace placeholder content with real data
2. Add actual dashboard screenshots
3. Configure DNS for `brownstonehub.com` → marketing app
4. Set up analytics (Google Analytics, etc.)
5. Add contact form functionality
6. Implement newsletter signup backend
