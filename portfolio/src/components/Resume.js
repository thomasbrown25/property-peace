const Resume = ({ resumeData }) => {
  const { year, position, graduation, university, company, location, details, techList } =
    resumeData;
  const org = company || university;
  const orgDisplay = location ? `${org} · ${location}` : org;

  return (
    <div className="mi-resume mt-30">
      <div className="mi-resume-summary">
        <h6 className="mi-resume-year">{year}</h6>
      </div>
      <div className="mi-resume-details">
        <h5>{position || graduation}</h5>
        <h6 className="mi-resume-company">{orgDisplay}</h6>
        <p>{details}</p>
        {techList && (
          <ul className="mi-project-tech-list">
            Tech Stack:
            {techList.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Resume;
