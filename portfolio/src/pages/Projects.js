import axios from "axios";
import React, { Suspense, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import ProjectsView from "../components/ProjectsView";
import Sectiontitle from "../components/Sectiontitle";
import Spinner from "../components/Spinner";

const Projects = () =>{
  const [projects, setPortfoios] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [projectsPerPage] = useState(9);

  useEffect(() => {
    let mounted = true;
    axios.get("/api/projects").then((response) => {
      if (mounted) {
        setPortfoios(response.data);
      }
    });
    return () => (mounted = false);
  }, []);

  const indexOfLastProjects = currentPage * projectsPerPage;
  const indexOfFirstProjects = indexOfLastProjects - projectsPerPage;
  const currentProjects = projects.slice(
    indexOfFirstProjects,
    indexOfLastProjects
  );

  const paginate = (e, pageNumber) => {
    e.preventDefault();
    setCurrentPage(pageNumber);
  };

  return (
    <Layout>
      <Helmet>
        <title>Projects - Thomas Brown Personal Project Template</title>
        <meta
          name="description"
          content="Thomas Brown Personal Project Template Projects Page"
        />
      </Helmet>
      <Suspense fallback={<Spinner />}>
        <div className="mi-about mi-section mi-padding-top mi-padding-bottom">
          <div className="container">
            <Sectiontitle title="Projects" />
            {<ProjectsView projects={currentProjects} />}
            {!(projects.length > projectsPerPage) ? null : (
              <Pagination
                className="mt-50"
                itemsPerPage={projectsPerPage}
                totalItems={projects.length}
                paginate={paginate}
                currentPage={currentPage}
              />
            )}
          </div>
        </div>
      </Suspense>
    </Layout>
  );
}

export default Projects;
