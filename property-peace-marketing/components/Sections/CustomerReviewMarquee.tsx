import Image from 'next/image';

const reviews = [
  {
    quote: 'After years of managing rentals in Excel, I can finally see my day-to-day work in one place. Property Peace saves me time and makes the whole portfolio easier to manage.',
    name: 'David M.',
    location: 'Florida | United States',
    image: '/images/reviews/david-m.jpg',
  },
  {
    quote: 'I replaced Google Sheets, QuickBooks, and Excel with Property Peace. Everything is easier to understand now, and I am very happy I made the switch.',
    name: 'Alexander C.',
    location: 'Ohio | United States',
    image: '/images/reviews/alexander-c.jpg',
  },
  {
    quote: 'The support team listened to my feature requests and helped me get comfortable with the software. It genuinely feels like the people behind Property Peace care.',
    name: 'Priya S.',
    location: 'Colorado | United States',
    image: '/images/reviews/priya-s.jpg',
  },
];

export default function CustomerReviewMarquee() {
  return (
    <section
      data-homepage-review-marquee="true"
      aria-labelledby="customer-review-marquee-heading"
      className="relative overflow-hidden bg-[#061E35] px-4 pb-24 pt-20 text-white sm:px-6 sm:pb-28 sm:pt-24 lg:px-8 lg:pt-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/landing/section-1.png)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#061E35_0%,rgba(6,30,53,0.96)_35%,rgba(6,30,53,0.87)_76%,#061E35_100%)]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <h2
            id="customer-review-marquee-heading"
            className="text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl lg:text-[3.35rem]"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.1 }}
          >
            Trusted by <span className="text-green-400">500+ Landlords Worldwide</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Independent landlords use one calm place to replace scattered tools, stay organized, and keep everyday rental work moving.
          </p>
        </div>

        <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8 lg:gap-12" aria-label="Property Peace customer reviews">
          {reviews.map((review) => (
            <li key={review.name} data-review-card="true" className="min-w-0">
              <figure className="flex h-full flex-col">
                <div className="relative h-48 w-44 shrink-0 overflow-hidden bg-[#263e52] sm:h-52 sm:w-48">
                  <Image
                    src={review.image}
                    alt={`Portrait of ${review.name}`}
                    fill
                    sizes="(max-width: 639px) 176px, 192px"
                    className="object-cover"
                  />
                </div>
                <blockquote className="mt-7 max-w-md text-lg leading-8 text-white/95" style={{ fontFamily: '"Inter", sans-serif' }}>
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-6 text-sm leading-6">
                  <span className="block font-bold text-white" style={{ fontFamily: '"Poppins", sans-serif' }}>{review.name}</span>
                  <span className="block text-white/65">{review.location}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
