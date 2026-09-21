import { Company, VerificationResult } from "./db/schema";

interface DummyCompanyData {
  domain: string;
  name: string;
  importedRevenue?: number;
  importedEmployees?: number;
  importedOwner?: string;
  importedPhone?: string;
  importedEmail?: string;
  verification: {
    ownerName?: string;
    ownerQuote?: string;
    ownerSource?: string;
    foundingYear?: number;
    foundingQuote?: string;
    foundingSource?: string;
    locationCount?: number;
    locationQuote?: string;
    locationSource?: string;
    teamSize?: number;
    teamSizeQuote?: string;
    teamSizeSource?: string;
    phone?: string;
    phoneQuote?: string;
    phoneSource?: string;
    email?: string;
    emailVerified?: boolean;
    emailSource?: string;
    conflicts?: string[];
    callBrief?: string;
  };
}

const dummyCompanies: DummyCompanyData[] = [
  {
    domain: "greenleaflandscaping.com",
    name: "Greenleaf Landscaping",
    importedRevenue: 850000,
    importedEmployees: 12,
    importedOwner: "John Smith",
    verification: {
      ownerName: "John Smith",
      ownerQuote: "Founded by John Smith in 2005, Greenleaf Landscaping has been serving the Portland area for nearly two decades.",
      ownerSource: "greenleaflandscaping.com/about",
      foundingYear: 2005,
      foundingQuote: "Founded by John Smith in 2005, Greenleaf Landscaping has been serving the Portland area for nearly two decades.",
      foundingSource: "greenleaflandscaping.com/about",
      locationCount: 1,
      locationQuote: "Visit us at our Portland location: 1234 Oak Street, Portland, OR 97201",
      locationSource: "greenleaflandscaping.com/contact",
      teamSize: 12,
      teamSizeQuote: "Our dedicated team of 12 professionals brings decades of combined experience to every project.",
      teamSizeSource: "greenleaflandscaping.com/about",
      phone: "(503) 555-0123",
      phoneQuote: "Call us today at (503) 555-0123",
      phoneSource: "greenleaflandscaping.com/contact",
      email: "info@greenleaflandscaping.com",
      emailVerified: true,
      emailSource: "greenleaflandscaping.com/contact",
      conflicts: [],
      callBrief: "John Smith founded Greenleaf Landscaping in 2005 (19 years in business). Single location in Portland with 12 employees, matching imported data. Owner-operated with verified contact information. Strong acquisition target."
    }
  },
  {
    domain: "bayareaplumbing.com",
    name: "Bay Area Plumbing Solutions",
    importedRevenue: 1200000,
    importedEmployees: 15,
    importedOwner: "Maria Garcia",
    verification: {
      ownerName: "Maria Garcia",
      ownerQuote: "Owner and Master Plumber Maria Garcia leads our team with over 25 years of experience.",
      ownerSource: "bayareaplumbing.com/about",
      foundingYear: 1998,
      foundingQuote: "Established in 1998, we've been the Bay Area's trusted plumbing partner for over 25 years.",
      foundingSource: "bayareaplumbing.com/",
      locationCount: 2,
      locationQuote: "We have two convenient locations: San Francisco and Oakland offices ready to serve you.",
      locationSource: "bayareaplumbing.com/locations",
      teamSize: 18,
      teamSizeQuote: "Our company employs 18 licensed plumbers and support staff across both locations.",
      teamSizeSource: "bayareaplumbing.com/team",
      phone: "(415) 555-0198",
      phoneQuote: "Emergency service available 24/7 at (415) 555-0198",
      phoneSource: "bayareaplumbing.com/contact",
      email: "service@bayareaplumbing.com",
      emailVerified: true,
      emailSource: "bayareaplumbing.com/contact",
      conflicts: ["Team size: imported says 15, website says 18"],
      callBrief: "Maria Garcia owns Bay Area Plumbing Solutions, established 1998 (26 years). Two locations (San Francisco, Oakland). Website shows 18 employees vs. imported 15 - verify current headcount. Long operating history and owner-led make this a solid prospect."
    }
  },
  {
    domain: "techrepairpros.com",
    name: "Tech Repair Pros",
    importedRevenue: 450000,
    importedEmployees: 6,
    verification: {
      ownerName: "David Chen",
      ownerQuote: "David Chen, founder and lead technician, started Tech Repair Pros to provide honest, affordable computer repair.",
      ownerSource: "techrepairpros.com/about",
      foundingYear: 2018,
      foundingQuote: "Since opening our doors in 2018, we've repaired over 5,000 devices.",
      foundingSource: "techrepairpros.com/",
      locationCount: 1,
      locationQuote: "Located in downtown Austin at 456 Tech Avenue, Suite 100",
      locationSource: "techrepairpros.com/contact",
      teamSize: 5,
      teamSizeQuote: "Our small but mighty team of 5 certified technicians handles everything from smartphones to servers.",
      teamSizeSource: "techrepairpros.com/team",
      phone: "(512) 555-0142",
      phoneQuote: "Schedule your repair: (512) 555-0142",
      phoneSource: "techrepairpros.com/contact",
      email: "hello@techrepairpros.com",
      emailVerified: true,
      emailSource: "techrepairpros.com/",
      conflicts: ["Team size: imported says 6, website says 5"],
      callBrief: "David Chen founded Tech Repair Pros in 2018 (6 years old). Single Austin location with 5-6 employees. Newer business but owner-operated. Good candidate for buyers interested in tech services sector."
    }
  },
  {
    domain: "sweetsdesserts.com",
    name: "Sweet's Desserts & Bakery",
    importedRevenue: 620000,
    importedEmployees: 8,
    importedOwner: "Sarah Sweet",
    verification: {
      ownerName: "Sarah Sweet",
      ownerQuote: "Sarah Sweet, pastry chef and owner, brings European baking traditions to every creation.",
      ownerSource: "sweetsdesserts.com/about",
      foundingYear: 2012,
      foundingQuote: "Sweet's Desserts opened in 2012 as a small family bakery and has grown into a community favorite.",
      foundingSource: "sweetsdesserts.com/story",
      locationCount: 1,
      locationQuote: "Visit our charming bakery at 789 Main Street, Charleston, SC 29401",
      locationSource: "sweetsdesserts.com/visit",
      teamSize: 9,
      teamSizeQuote: "Our team of 9 bakers and decorators works daily to create fresh, beautiful desserts.",
      teamSizeSource: "sweetsdesserts.com/about",
      phone: "(843) 555-0176",
      phoneQuote: "Place your order at (843) 555-0176 or visit us in person",
      phoneSource: "sweetsdesserts.com/contact",
      email: "orders@sweetsdesserts.com",
      emailVerified: true,
      emailSource: "sweetsdesserts.com/contact",
      conflicts: ["Team size: imported says 8, website says 9"],
      callBrief: "Sarah Sweet owns Sweet's Desserts, founded 2012 (12 years). Single Charleston location with ~9 employees. Owner-operated bakery with strong local presence. Matches acquisition criteria well."
    }
  },
  {
    domain: "summitroofing.com",
    name: "Summit Roofing & Construction",
    importedRevenue: 2100000,
    importedEmployees: 25,
    importedOwner: "Mike Thompson",
    verification: {
      ownerName: "Mike Thompson",
      ownerQuote: "Owner Mike Thompson has been roofing homes in Colorado for over 30 years.",
      ownerSource: "summitroofing.com/about",
      foundingYear: 1995,
      foundingQuote: "Summit Roofing was established in 1995 and has completed over 10,000 projects.",
      foundingSource: "summitroofing.com/",
      locationCount: 1,
      locationQuote: "Serving Denver and surrounding areas from our main office at 321 Mountain View Drive",
      locationSource: "summitroofing.com/contact",
      teamSize: 28,
      teamSizeQuote: "We employ 28 full-time roofers, project managers, and office staff",
      teamSizeSource: "summitroofing.com/team",
      phone: "(303) 555-0165",
      phoneQuote: "Free estimates: call (303) 555-0165",
      phoneSource: "summitroofing.com/",
      email: "info@summitroofing.com",
      emailVerified: true,
      emailSource: "summitroofing.com/contact",
      conflicts: ["Team size: imported says 25, website says 28"],
      callBrief: "Mike Thompson owns Summit Roofing, founded 1995 (29 years). Established business with single Denver location. Website shows 28 employees vs imported 25. Higher revenue tier. Strong track record and owner-operated."
    }
  },
  {
    domain: "quickcleanservices.com",
    name: "QuickClean Commercial Services",
    importedRevenue: 780000,
    importedEmployees: 20,
    verification: {
      foundingYear: 2015,
      foundingQuote: "Since 2015, QuickClean has provided commercial cleaning to businesses across Seattle.",
      foundingSource: "quickcleanservices.com/about",
      locationCount: 3,
      locationQuote: "We serve clients from our Seattle, Bellevue, and Tacoma facilities",
      locationSource: "quickcleanservices.com/locations",
      teamSize: 22,
      teamSizeQuote: "QuickClean employs 22 professional cleaners across our three locations",
      teamSizeSource: "quickcleanservices.com/about",
      phone: "(206) 555-0189",
      phoneQuote: "Request a quote: (206) 555-0189",
      phoneSource: "quickcleanservices.com/contact",
      email: "info@quickcleanservices.com",
      emailVerified: true,
      emailSource: "quickcleanservices.com/",
      conflicts: ["Team size: imported says 20, website says 22"],
      callBrief: "QuickClean founded 2015 (9 years old). Three locations (Seattle, Bellevue, Tacoma) - may be too distributed for typical acquisition criteria. No owner name found on website. Employee count ~22. Multi-location structure is a concern."
    }
  },
  {
    domain: "northstarpetcare.com",
    name: "North Star Pet Care Center",
    importedRevenue: 890000,
    importedEmployees: 11,
    importedOwner: "Dr. Jennifer Lee",
    verification: {
      ownerName: "Dr. Jennifer Lee",
      ownerQuote: "Dr. Jennifer Lee, founder and head veterinarian, opened North Star Pet Care in 2010.",
      ownerSource: "northstarpetcare.com/about",
      foundingYear: 2010,
      foundingQuote: "Dr. Lee founded North Star Pet Care Center in 2010 with a mission to provide compassionate veterinary care.",
      foundingSource: "northstarpetcare.com/our-story",
      locationCount: 1,
      locationQuote: "We're located at 555 Paws Lane, Minneapolis, MN 55401",
      locationSource: "northstarpetcare.com/location",
      teamSize: 11,
      teamSizeQuote: "Our practice includes 11 staff members: 3 veterinarians, 5 vet techs, and 3 support staff.",
      teamSizeSource: "northstarpetcare.com/team",
      phone: "(612) 555-0134",
      phoneQuote: "Call us at (612) 555-0134 to schedule an appointment",
      phoneSource: "northstarpetcare.com/contact",
      email: "care@northstarpetcare.com",
      emailVerified: true,
      emailSource: "northstarpetcare.com/contact",
      conflicts: [],
      callBrief: "Dr. Jennifer Lee founded North Star Pet Care in 2010 (14 years). Single Minneapolis location with 11 employees, matching import data perfectly. Veterinary practice with clear owner-operator structure. Excellent acquisition candidate."
    }
  },
  {
    domain: "alphamechanicalservices.com",
    name: "Alpha Mechanical Services",
    importedRevenue: 1450000,
    importedEmployees: 18,
    verification: {
      ownerName: "Robert Williams",
      ownerQuote: "Founded by Robert Williams, a master HVAC technician with 40 years of experience",
      ownerSource: "alphamechanicalservices.com/about",
      foundingYear: 2001,
      foundingQuote: "Alpha Mechanical Services has been keeping homes and businesses comfortable since 2001.",
      foundingSource: "alphamechanicalservices.com/",
      locationCount: 1,
      locationQuote: "Located in Phoenix, AZ, we serve the entire greater Phoenix metro area",
      locationSource: "alphamechanicalservices.com/service-area",
      teamSize: 19,
      teamSizeQuote: "Our crew of 19 includes certified HVAC technicians, electricians, and customer service specialists",
      teamSizeSource: "alphamechanicalservices.com/team",
      phone: "(602) 555-0145",
      phoneQuote: "24/7 emergency service: (602) 555-0145",
      phoneSource: "alphamechanicalservices.com/",
      email: "service@alphamechanicalservices.com",
      emailVerified: true,
      emailSource: "alphamechanicalservices.com/contact",
      conflicts: ["Team size: imported says 18, website says 19"],
      callBrief: "Robert Williams founded Alpha Mechanical in 2001 (23 years). Single Phoenix location with ~19 employees. Owner is experienced master technician. Long operating history, owner-led HVAC business is attractive acquisition target."
    }
  },
  {
    domain: "coastalhomebuilders.com",
    name: "Coastal Home Builders",
    importedRevenue: 3200000,
    importedEmployees: 35,
    importedOwner: "Tom Anderson",
    verification: {
      foundingYear: 1989,
      foundingQuote: "Coastal Home Builders was established in 1989 and has built over 500 custom homes.",
      foundingSource: "coastalhomebuilders.com/history",
      locationCount: 4,
      locationQuote: "With offices in Miami, Fort Lauderdale, West Palm Beach, and Naples, we serve all of South Florida",
      locationSource: "coastalhomebuilders.com/locations",
      teamSize: 42,
      teamSizeQuote: "Our team of 42 includes architects, project managers, and master craftsmen",
      teamSizeSource: "coastalhomebuilders.com/about",
      phone: "(305) 555-0178",
      phoneQuote: "Contact our main office at (305) 555-0178",
      phoneSource: "coastalhomebuilders.com/contact",
      email: "info@coastalhomebuilders.com",
      emailVerified: true,
      emailSource: "coastalhomebuilders.com/",
      conflicts: ["Owner name: imported says Tom Anderson, but no owner name found on website", "Team size: imported says 35, website says 42"],
      callBrief: "Coastal Home Builders founded 1989 (35 years old). Four locations across South Florida - larger multi-location operation. Website shows 42 employees vs imported 35. No owner name on website despite import data showing Tom Anderson - needs verification. Size and structure may exceed typical search fund criteria."
    }
  },
  {
    domain: "peakperformancegym.com",
    name: "Peak Performance Gym",
    importedRevenue: 580000,
    importedEmployees: 9,
    importedOwner: "Lisa Martinez",
    verification: {
      ownerName: "Lisa Martinez",
      ownerQuote: "Lisa Martinez, former Olympic athlete and gym owner, founded Peak Performance to help others reach their fitness goals.",
      ownerSource: "peakperformancegym.com/about",
      foundingYear: 2016,
      foundingQuote: "Since opening in 2016, Peak Performance has helped over 2,000 members transform their lives.",
      foundingSource: "peakperformancegym.com/",
      locationCount: 1,
      locationQuote: "Located in Boulder, Colorado at 888 Fitness Drive",
      locationSource: "peakperformancegym.com/visit",
      teamSize: 8,
      teamSizeQuote: "Our staff of 8 certified trainers and nutritionists provides personalized coaching",
      teamSizeSource: "peakperformancegym.com/trainers",
      phone: "(720) 555-0156",
      phoneQuote: "Call to book your free consultation: (720) 555-0156",
      phoneSource: "peakperformancegym.com/contact",
      email: "hello@peakperformancegym.com",
      emailVerified: true,
      emailSource: "peakperformancegym.com/",
      conflicts: ["Team size: imported says 9, website says 8"],
      callBrief: "Lisa Martinez, former Olympian, founded Peak Performance Gym in 2016 (8 years). Single Boulder location with 8-9 employees. Boutique fitness concept, owner-operated. Newer business but strong founder credentials. Good fit for fitness sector buyers."
    }
  }
];

export function generateDummyData() {
  return dummyCompanies;
}

export function getDummyCompanyCount() {
  return dummyCompanies.length;
}
