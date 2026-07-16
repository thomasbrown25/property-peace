import axios from 'axios';
import React, { Suspense, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '../components/Layout';
import Particle from '../components/Particle';
import Socialicons from '../components/Socialicons';
import Spinner from '../components/Spinner';

function Home() {
  const [information, setInformation] = useState('');

  useEffect(() => {
    axios.get('/api/information').then((response) => {
      setInformation(response.data);
    });
  }, []);

  return (
    <Layout>
      <Helmet>
        <title>Home - Thomas Brown Personal Portfolio </title>
        <meta
          name="description"
          content="Thomas Brown Personal Portfolio  Homepage"
        />
      </Helmet>
      <Suspense fallback={<Spinner />}>
        <div className="mi-home-area mi-padding-section">
          <Particle lightMode={false} />
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10 col-12">
                <div className="mi-home-content">
                  <h1>
                    Hi, I'm{' '}
                    <span className="color-theme">{information.name}</span>
                  </h1>
                  {information.tagline && (
                    <p className="mi-home-tagline">{information.tagline}</p>
                  )}
                  <p>{information.aboutContent}</p>
                  <Socialicons bordered />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Suspense>
    </Layout>
  );
}

export default Home;
