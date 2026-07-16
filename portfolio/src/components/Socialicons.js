import React, {useState, useEffect} from "react";
import axios from 'axios';
import LineIcon from 'react-lineicons';

function Socialicons(props){
  const [socialLinks, setSocialLinks] = useState({});

  useEffect(() => {
    axios.get('/api/information')
      .then(response =>{
        setSocialLinks(response.data.socialLinks);
      })
  }, [])

  return (
    <ul className={props.bordered ? 'mi-socialicons mi-socialicons-bordered' : 'mi-socialicons'}>
      {!socialLinks.facebook ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.facebook}>
          <LineIcon name="facebook"/>
        </a>
      </li>}
      {!socialLinks.twitter ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.twitter} aria-label="X (Twitter) profile">
          <svg viewBox="0 0 24 24" className="mi-socialicons-x" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </li>}
      {!socialLinks.pinterest ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.pinterest}>
          <LineIcon name="pinterest"/>
        </a>
      </li>}
      {!socialLinks.behance ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.behance}>
          <LineIcon name="behance"/>
        </a>
      </li>}
      {!socialLinks.linkedin ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.linkedin}>
          <LineIcon name="linkedin"/>
        </a>
      </li>}
      {!socialLinks.dribbble ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.dribbble}>
          <LineIcon name="dribbble"/>
        </a>
      </li>}
      {!socialLinks.github ? null : <li>
        <a rel="noopener noreferrer" target="_blank" href={socialLinks.github}>
          <LineIcon name="github"/>
        </a>
      </li>}
    </ul>
  );
}

export default Socialicons;
