import axios from 'axios';
import FsLightbox from 'fslightbox-react';
import React, { Suspense, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import ProgressiveImage from 'react-progressive-graceful-image';
import Slider from 'react-slick';
import Layout from '../components/Layout';
import Sectiontitle from '../components/Sectiontitle';
import Service from '../components/Service';
import Spinner from '../components/Spinner';
import Testimonial from '../components/Testimonial';

function About() {
  const [toggler, setToggler] = useState(false);
  const [information, setInformation] = useState('');
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);

  const sliderSettings = {
    dots: false,
    infinite: true,
    arrows: false,
    speed: 500,
    slidesToShow: 2,
    slidesToScroll: 2,
    autoplay: true,
    autoplaySpeed: 6000,
    pauseOnHover: true,
    adaptiveHeight: true,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };

  const handleToggler = (event) => {
    setToggler(!toggler);
  };

  useEffect(() => {
    axios.get('/api/information').then((response) => {
      setInformation(response.data);
    });
    axios.get('/api/services').then((response) => {
      setServices(response.data);
    });
    axios.get('/api/reviews').then((response) => {
      setReviews(response.data);
    });
  }, []);

  return (
    <Layout>
      <Helmet>
        <title>About - Thomas Brown Personal Portfolio </title>
        <meta
          name="description"
          content="Thomas Brown Personal Portfolio  About Page"
        />
      </Helmet>
      <Suspense fallback={<Spinner />}>
        <div className="mi-about-area mi-section mi-padding-top">
          <div className="container">
            <Sectiontitle title="About Me" />
            <div className="row align-items-top flex">
              <div className="col-lg-6">
                <div className="mi-about-image">
                  <ProgressiveImage
                    src={information.aboutImage}
                    placeholder="/images/about-image-placeholder.png"
                  >
                    {(src) => (
                      <img
                        src={src}
                        alt="aboutimage"
                        onClick={() => handleToggler(!toggler)}
                      />
                    )}
                  </ProgressiveImage>
                  <FsLightbox
                    toggler={toggler}
                    sources={[information.aboutImageLg]}
                  />
                </div>
              </div>
              <div className="col-lg-6">
                <div className="mi-about-content">
                  <h3>
                    I am <span className="color-theme">{information.name}</span>
                  </h3>
                  <p className="mt-30">
                    {information.aboutPageContent ||
                      "I'm a Senior Software Engineer based in Charlotte, NC. I lead development at Nascent Technology and built Peace of Property—a full-stack property management platform. I previously spent three years as an Azure Support Engineer at Microsoft. I focus on full-stack delivery, Azure, and building products that scale."}
                  </p>

                  <a
                    href={information.cvfile}
                    className="mi-button"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download CV
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <div className="mi-service-area mi-section mi-padding-top">
          <div className="container">
            <Sectiontitle title="Services" />
            <div className="mi-service-wrapper">
              <div className="row mt-30-reverse">
                {services.map((service) => (
                  <div
                    className="col-lg-4 col-md-6 col-12 mt-30"
                    key={service.title}
                  >
                    <Service content={service} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mi-review-area mi-section mi-padding-top mi-padding-bottom">
          <div className="container">
            <Sectiontitle title="Reviews" />
            <div className="row justify-content-center">
              <div className="col-12">
                <Slider className="mi-testimonial-slider" {...sliderSettings}>
                  {reviews.map((review) => (
                    <Testimonial key={review.id} content={review} />
                  ))}
                </Slider>
              </div>
            </div>
          </div>
        </div> */}
      </Suspense>
    </Layout>
  );
}

export default About;
