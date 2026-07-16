import FAQ from '@/components/Sections/FAQ';

export const metadata = {
  title: 'FAQ | Property Peace',
  description: 'Frequently asked questions about Property Peace — the property management software built for independent landlords.',
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <FAQ />
    </div>
  );
}
