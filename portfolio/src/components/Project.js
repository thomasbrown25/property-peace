import FsLightbox from 'fslightbox-react';
import React, { useState } from 'react';
import * as Icon from 'react-feather';
import ProgressiveImage from 'react-progressive-graceful-image';

const Projects = ({ content }) => {
  const [toggler, setToggler] = useState(false);
  const { title, subtitle, largeImageUrl, githubUrl, url, imageUrl, techList } =
    content;

  const handleToggler = (value) => {
    setToggler(value);
  };

  return (
    <div className="mi-project mi-project-visible">
      <div className="mi-project-image">
        <ProgressiveImage
          src={imageUrl}
          placeholder="/images/project-image-placeholder.png"
        >
          {(src) => (
            <img
              src={src}
              alt={title}
              onClick={largeImageUrl ? () => handleToggler(!toggler) : undefined}
              role={largeImageUrl ? 'button' : undefined}
              tabIndex={largeImageUrl ? 0 : undefined}
              onKeyDown={
                largeImageUrl
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleToggler(!toggler);
                    }
                  : undefined
              }
            />
          )}
        </ProgressiveImage>
        {url && (
          <a
            className="mi-project-image-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${title}`}
          >
            <Icon.Globe />
          </a>
        )}
      </div>

      {!url ? (
        <h5>{title}</h5>
      ) : (
        <h5>
          <a rel="noopener noreferrer" target="_blank" href={url}>
            {title}
          </a>
        </h5>
      )}

      {subtitle && <h6>{subtitle}</h6>}

      {largeImageUrl && (
        <FsLightbox toggler={toggler} sources={largeImageUrl} />
      )}

      {techList && (
        <ul class="mi-project-tech-list">
          {techList?.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Projects;
