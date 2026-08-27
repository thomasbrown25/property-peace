import Image from 'next/image';

type CustomerReview = {
  id: string;
  quote: string;
  name: string;
  location: string;
  initials: string;
  image?: string;
  placeholder?: true;
};

const reviews: CustomerReview[] = [
  {
    id: 'david-workflows',
    quote:
      'After years of managing rentals in Excel, I can finally see my day-to-day work in one place. Property Peace saves me time and makes the whole portfolio easier to manage.',
    name: 'David M.',
    location: 'Florida | United States',
    initials: 'DM',
    image: '/images/reviews/david-m.jpg',
  },
  {
    id: 'monica-balance',
    quote:
      'I manage five properties and wanted useful features without paying for a lot I would never touch. Property Peace gives me the simplicity and functionality I was looking for.',
    name: 'Monica R.',
    location: 'Texas | United States',
    initials: 'MR',
    image: '/images/reviews/monica-r.jpg',
  },
  {
    id: 'alexander-consolidation',
    quote:
      'I replaced Google Sheets, QuickBooks, and Excel with Property Peace. Everything is easier to understand now, and I am very happy I made the switch.',
    name: 'Alexander C.',
    location: 'Ohio | United States',
    initials: 'AC',
    image: '/images/reviews/alexander-c.jpg',
  },
  {
    id: 'priya-support',
    quote:
      'The support team listened to my feature requests and helped me get comfortable with the software. It genuinely feels like the people behind Property Peace care.',
    name: 'Priya S.',
    location: 'Colorado | United States',
    initials: 'PS',
    image: '/images/reviews/priya-s.jpg',
  },
  {
    id: 'jordan-small-portfolio',
    quote:
      'Property Peace is a great fit for a smaller portfolio. It is clear, affordable, and capable without feeling like enterprise software.',
    name: 'Jordan B.',
    location: 'North Carolina | United States',
    initials: 'JB',
    image: '/images/reviews/jordan-b.jpg',
  },
  {
    id: 'elena-setup',
    quote:
      'Setup was as simple as advertised. The owner walked me through it, answered my questions, and has been professional and courteous every step of the way.',
    name: 'Elena T.',
    location: 'Oregon | United States',
    initials: 'ET',
    image: '/images/reviews/elena-t.jpg',
  },
  // Placeholder reviews: replace with approved customer testimonials when available.
  {
    id: 'marcus-records',
    quote:
      'Property Peace gives me one place to track rental expenses and keep receipts organized. I spend less time rebuilding records when I need them.',
    name: 'Marcus L.',
    location: 'Illinois | United States',
    initials: 'ML',
    image: '/images/reviews/marcus-l.jpg',
    placeholder: true,
  },
  {
    id: 'mato-support',
    quote:
      'The software is straightforward, and the support has been responsive whenever I have a question. I never feel like I am figuring everything out alone.',
    name: 'Mato P.',
    location: 'Arizona | United States',
    initials: 'MP',
    image: '/images/reviews/mato-p.jpg',
    placeholder: true,
  },
  {
    id: 'samuel-overview',
    quote:
      'Rent records, maintenance requests, tenant details, and property documents finally live together. I can see what needs attention without checking several tools.',
    name: 'Samuel T.',
    location: 'Georgia | United States',
    initials: 'ST',
    image: '/images/reviews/samuel-t.jpg',
    placeholder: true,
  },
  {
    id: 'nina-simplicity',
    quote:
      'I wanted something easier than spreadsheets without the complexity of enterprise software. Property Peace has been simple to learn and practical for everyday work.',
    name: 'Nina P.',
    location: 'Washington | United States',
    initials: 'NP',
    image: '/images/reviews/nina-p.jpg',
    placeholder: true,
  },
];

function GoldStars() {
  return (
    <div
      data-review-stars="gold"
      role="img"
      aria-label="5 out of 5 stars"
      className="flex items-center gap-1 text-[#F5B940]"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-[1.15rem] w-[1.15rem] fill-current"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: CustomerReview }) {
  return (
    <li data-review-card="true" className="flex shrink-0">
      <article className="relative flex min-h-[21rem] w-[min(84vw,23.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#061E35] p-6 text-white shadow-[0_20px_46px_rgba(6,30,53,0.16)] sm:p-7">
        <div
          aria-hidden="true"
          className="absolute -right-5 -top-12 font-serif text-[10rem] leading-none text-white/[0.055]"
        >
          “
        </div>

        <div className="relative flex items-center gap-3.5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#F5B940]/70 bg-[#DDF7E8] text-sm font-bold text-[#061E35] shadow-sm">
            {review.image ? (
              <Image
                src={review.image}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              review.initials
            )}
          </div>
          <div>
            <p
              className="font-bold tracking-[-0.01em] text-white"
              style={{ fontFamily: '"Poppins", sans-serif' }}
            >
              {review.name}
            </p>
            <p
              className="mt-0.5 text-sm text-[#BDE8D0]"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              {review.location}
            </p>
          </div>
        </div>

        <blockquote
          className="relative mt-7 flex-1 text-[1.02rem] leading-7 text-white/90"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          “{review.quote}”
        </blockquote>

        <div className="relative mt-7 flex items-center border-t border-white/10 pt-5">
          <GoldStars />
        </div>
      </article>
    </li>
  );
}

function ReviewGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      data-review-group={duplicate ? 'duplicate' : 'primary'}
      aria-hidden={duplicate ? 'true' : undefined}
      className={`review-marquee-group flex shrink-0 gap-5 pr-5 ${duplicate ? 'review-marquee-duplicate' : ''}`}
    >
      {reviews.map((review) => (
        <ReviewCard key={`${duplicate ? 'duplicate-' : ''}${review.id}`} review={review} />
      ))}
    </ul>
  );
}

export default function CustomerReviewMarquee() {
  return (
    <section
      data-homepage-review-marquee="true"
      aria-labelledby="customer-review-marquee-heading"
      className="relative z-20 -mt-8 overflow-hidden rounded-t-[2rem] border-y border-[#DCE6ED] bg-white py-20 sm:-mt-10 sm:rounded-t-[2.5rem] sm:py-24 lg:-mt-12 lg:rounded-t-[3rem] lg:py-28"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] text-[#15803D]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            What landlords say
          </p>
          <h2
            id="customer-review-marquee-heading"
            className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#061E35] sm:text-4xl lg:text-[3.35rem]"
            style={{ fontFamily: '"Poppins", sans-serif', lineHeight: 1.1 }}
          >
            Rental management feels lighter with{' '}
            <span className="text-green-600">Property Peace.</span>
          </h2>
          <p
            className="mt-5 max-w-2xl text-base leading-7 text-[#405A70] sm:text-lg"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Independent landlords use one calm place to replace scattered tools, stay organized, and keep everyday rental work moving.
          </p>
        </div>
      </div>

      <div className="review-marquee-viewport relative mt-12" aria-label="Property Peace customer reviews">
        <div className="review-marquee-track flex w-max">
          <ReviewGroup />
          <ReviewGroup duplicate />
        </div>
      </div>
    </section>
  );
}
