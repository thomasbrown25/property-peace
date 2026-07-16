import Mock from '../mock';

const database = {
  information: {
    name: 'Thomas Brown',
    tagline: 'Senior Software Engineer',
    aboutContent:
      "I build full-stack products and cloud solutions—from property management platforms to automated systems for major ports. Right now I'm solo-developing Peace of Property (peaceproperty.io) and leading development at Nascent Technology. Previously I spent three years at Microsoft as an Azure Support Engineer, tuning app performance and reliability for customers globally.",
    aboutPageContent:
      "I'm a Senior Software Engineer based in Charlotte, NC. I lead development of automated gate systems at Nascent Technology (promoted to Senior within six months) and solo-built Peace of Property—a full-stack property management platform with .NET 9, React, Stripe, DocuSign, and AI-assisted features. Before that I was an Azure Support Engineer at Microsoft, doing performance tuning, root-cause analysis, and building internal diagnostic tools. I have a Bachelor's in IT from Furman University and full-stack training from UNC Charlotte, and I'm certified in Azure Fundamentals (AZ-900), Azure AI (AI-900), and App Service Performance. I focus on clean architecture, modern .NET and React, and shipping products that scale.",
    age: 29,
    phone: '',
    nationality: 'American',
    language: 'English, Spanish',
    email: '',
    freelanceStatus: 'Available',
    socialLinks: {
      facebook: 'https://www.facebook.com/thomasbrown1125/',
      twitter: 'https://x.com/Thomasbrown1125',
      pinterest: '',
      behance: '',
      linkedin: 'https://www.linkedin.com/in/thomas-brown-a8005413b/',
      dribbble: '',
      github: 'https://github.com/thomasbrown25?tab=repositories'
    },
    brandImage: '/images/brand-image.JPG',
    aboutImage: '/images/about-image.jpg',
    aboutImageLg: '/images/about-image.jpg',
    cvfile: '/files/Thomas_Brown_SoftwareEngineer.pdf'
  },
  services: [
    {
      title: 'Software Solutions',
      icon: 'code',
      details:
        'As a software engineer, I specialize in delivering pristine software solutions tailored to your needs, encompassing automated systems, intuitive management portals, and beyond. My expertise lies in crafting efficient and user-centric software that streamlines processes and enhances productivity across your operations.'
    },
    {
      title: 'Web Development',
      icon: 'code',
      details:
        "I specialize in cutting-edge web development, leveraging modern technologies like JavaScript, React, TypeScript, and Node.js to create dynamic and responsive web applications. With a keen focus on user experience and scalability, I harness these tools to build robust and innovative solutions that meet the evolving demands of today's digital landscape."
    },
    {
      title: 'Mobile Application',
      icon: 'mobile',
      details:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Autem tenetur ratione quod.'
    }
  ],
  reviews: [
    {
      id: 1,
      content:
        'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Expedita impedit nobis tempore quaerat quibusdam, aliquid maxime tempora.',
      author: {
        name: 'Burdette Turner',
        designation: 'Web Developer, Abc Company'
      }
    },
    {
      id: 2,
      content:
        'Lorem ipsum dolor, sit amet consectetur adipisicing elit. Expedita impedit nobis tempore quaerat quibusdam.',
      author: {
        name: 'Susan Yost',
        designation: 'Client'
      }
    },
    {
      id: 3,
      content: 'Lorem ipsum dolor, sit amet consectetur adipisicing elit.',
      author: {
        name: 'Irving Feeney',
        designation: 'Fiverr Client'
      }
    }
  ],
  skills: [
    { title: 'Azure', value: 95 },
    { title: 'C# / .NET 8/9', value: 95 },
    { title: 'React', value: 94 },
    { title: 'TypeScript', value: 92 },
    { title: 'ASP.NET / Entity Framework', value: 90 },
    { title: 'Node.js', value: 88 },
    { title: 'MS SQL', value: 88 },
    { title: 'GoLang', value: 80 },
    { title: 'Microservices', value: 85 }
  ],
  projects: [
    {
      id: 1,
      title: 'Property Peace',
      subtitle:
        'Property Peace is a property management and real estate platform built with the brownstone-hub-app. It streamlines property listings, tenant communications, and maintenance tracking. The application is live at propertypeace.io, offering a modern web experience for property owners and managers.',
      imageUrl: '/images/property-peace-img.png',
      largeImageUrl: ['/images/property-peace-img.png'],
      githubUrl: '',
      url: 'https://propertypeace.io',
      techList: ['React', 'TypeScript', 'Node.js', 'Web']
    }
  ],
  experience: {
    workingExperience: [
      {
        id: 1,
        year: '2023 - Present',
        position: 'Senior Software Engineer',
        company: 'Nascent Technology',
        location: 'Charlotte, NC',
        details:
          'Lead development of Automated Gate Systems for major intermodal port clients in an Agile environment. Architected and delivered solutions using .NET 8/9, React, Microservices, WinForms, and Window services. Promoted to Senior Engineer within 6 months based on delivery impact and leadership.',
        techList: [
          'GoLang',
          'ASP.NET',
          'C#',
          '.NET 8/9',
          'VB.NET',
          'MS SQL',
          'React',
          'TypeScript',
          'Microservices',
          'Entity Framework'
        ]
      },
      {
        id: 2,
        year: '2020 - 2023',
        position: 'Azure Support Engineer',
        company: 'Microsoft',
        location: 'Charlotte, NC',
        details:
          'Provided advanced performance tuning and optimization for Azure App Services customers globally. Resolved complex issues related to app performance, availability, and scalability. Conducted root cause analysis (IIS, memory dumps, Azure diagnostics) and authored technical documentation. Designed and developed internal diagnostic and troubleshooting tools using .NET and Azure services.',
        techList: [
          'Azure App Services',
          'Azure Services',
          'IIS',
          '.NET Core',
          'C#',
          'JavaScript',
          'Node.js',
          'Linux'
        ]
      },
      {
        id: 3,
        year: '2018 - 2020',
        position: 'Software Engineer',
        company: 'Nascent Technology',
        location: 'Charlotte, NC',
        details:
          'Designed and implemented Automated Gate Systems for key port clients (Port of San Juan, SC Ports Authority, Port of Virginia). Delivered systems that improved operational throughput and revenue for clients.',
        techList: [
          'ASP.NET',
          'C#',
          'VB.NET',
          'MS SQL',
          'Microservices',
          'Window Services',
          'React',
          'WinForms',
          'Entity Framework'
        ]
      },
      {
        id: 4,
        year: '2018 - 2019',
        position: 'Web App Developer (Contract)',
        company: 'Marlo Holdings LLC',
        location: 'Charlotte, NC',
        details:
          'Built and optimized high-ranking websites using React and Next.js, with a focus on SEO performance. Delivered responsive, SEO-friendly front-end solutions to improve client visibility and traffic.',
        techList: ['React', 'Next.js', 'JavaScript', 'HTML', 'CSS']
      }
    ],
    educationExperience: [
      {
        id: 1,
        year: '2018',
        graduation: 'Coding Bootcamp | Full Stack Web Development',
        university: 'University of North Carolina Charlotte',
        location: 'NC',
        details:
          'Modern fullstack development (React, Node, Mongo, SQL)'
      },
      {
        id: 2,
        year: '2016',
        graduation: "Bachelor's degree in Information Technology",
        university: 'Furman University',
        location: 'Greenville, SC',
        details:
          'Data Structures & Algorithms, History of CS, .NET'
      }
    ],
    certificationExperience: [
      {
        id: 1,
        graduation: 'AI-900 Azure AI Fundamentals',
        university: 'Microsoft Certified'
      },
      {
        id: 2,
        graduation: 'AZ-900 Azure Fundamentals',
        university: 'Microsoft Certified'
      },
      {
        id: 3,
        graduation: 'Azure App Service Performance & Availability',
        university: 'Microsoft Certified'
      }
    ]
  },
  blogs: [
    // {
    //   id: 1,
    //   title: 'Markdown & Html supported blog.',
    //   featuredImage: '/images/blog-image-1.jpg',
    //   filesource: '../../blog/markdown-html-supported-blog.md',
    //   createDay: "20",
    //   createMonth: 'February',
    //   createYear: "2020"
    // }
  ],
  contactInfo: {
    phoneNumbers: ['+1 (864) 324-7107'],
    emailAddress: ['tbrown@brownstonehub.com']
  }
};

Mock.onGet('/api/information').reply((config) => {
  const response = database.information;
  return [200, response];
});

Mock.onGet('/api/services').reply((config) => {
  const response = database.services;
  return [200, response];
});

Mock.onGet('/api/reviews').reply((config) => {
  const response = database.reviews;
  return [200, response];
});

Mock.onGet('/api/skills').reply((config) => {
  const response = database.skills;
  return [200, response];
});

Mock.onGet('/api/projects').reply((config) => {
  const response = database.projects;
  return [200, response];
});

Mock.onGet('/api/experience').reply((config) => {
  const response = database.experience;
  return [200, response];
});

Mock.onGet('/api/blog').reply((config) => {
  const response = database.blogs;
  return [200, response];
});

Mock.onGet('/api/contactinfo').reply((config) => {
  const response = database.contactInfo;
  return [200, response];
});
