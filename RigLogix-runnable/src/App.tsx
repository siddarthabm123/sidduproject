import { useEffect, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import DownloadBondButton from "@/components/download-bond-button";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  CreditCard,
  Edit3,
  ExternalLink,
  Fuel,
  Gauge,
  Hammer,
  House,
  Layers3,
  LogOut,
  MapPin,
  Menu,
  Mic,
  PackageCheck,
  PhoneCall,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Truck,
  Users,
  X,
} from "lucide-react";

type Role = "customer" | "owner";
type AccountProfile = {
  role: Role;
  fullName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  postalCode: string;
  business?: string;
  password?: string;
};
type UserSession = AccountProfile & { demo?: boolean };
type Machinery = {
  id: string;
  title: string;
  sector: string;
  category: string;
  owner: string;
  rating: number;
  distanceKm: number;
  baseRateHourly: number;
  baseRatePerFoot?: number;
  location: string;
  verified: boolean;
  availability: string;
  specs: string[];
  plainEnglishGuide: string;
  primaryApplication: string;
  fuelPct: number;
  engineHours: number;
  telematicsId: string;
  status: string;
  image: string;
};
type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "MOBILIZING"
  | "ON SITE"
  | "IN PROGRESS"
  | "COMPLETED";
type Booking = {
  id: string;
  machineryId: string;
  machineryTitle: string;
  ownerName: string;
  customerName: string;
  location: string;
  date: string;
  durationHours: number;
  baseCost: number;
  platformFee: number;
  totalCost: number;
  ownerEarnings: number;
  status: BookingStatus;
  billingUnit?: "hour" | "foot" | "survey";
  quantity?: number;
  units?: number;
  unitRate?: number;
  serviceType?: string;
  shift?: string;
  startTime?: string;
  jobSite?: string;
  siteCoordinates?: string;
  siteInstructions?: string;
  casingDepth?: number;
  casingType?: string;
  walletReserve?: number;
  cancellationPenalty?: number;
  baseMobilization?: number;
  fuelSurcharge?: number;
  review?: { rating: number; text: string };
};
type Bid = {
  id: string;
  operator: string;
  equipment: string;
  amount: number;
  eta: string;
  rating: number;
  distance: number;
};
type Auction = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  requiredDate: string;
  maxPrice: number;
  lowestBid: number;
  bidCount: number;
  status: string;
  bids: Bid[];
  unitLabel?: string;
  timeLeft?: string;
};
type FleetItem = {
  id: string;
  equipment: string;
  registration: string;
  capacity: string;
  rate: number;
  status: string;
  fuel: number;
  engineHours: number;
  telematicsId: string;
  currentJob: string;
  availableFrom?: string;
};
type Activity = {
  id: string;
  label: string;
  detail: string;
  time: string;
  type: string;
};

const AS = "/assets/";
const machinerySeed: Machinery[] = [
  {
    id: "m-101",
    title: "X300 Crawler Excavator",
    sector: "Construction",
    category: "Excavator",
    owner: "Northline Earthworks",
    rating: 4.9,
    distanceKm: 8.4,
    baseRateHourly: 2850,
    location: "Whitefield, Bengaluru",
    verified: true,
    availability: "Available today",
    specs: [
      "30 tonne operating weight",
      "1.5 m³ bucket",
      "6.7 m digging depth",
    ],
    plainEnglishGuide:
      "A powerful tracked digger for foundations, bulk excavation and hard ground. The operator is included.",
    primaryApplication: "Foundations & bulk earthworks",
    fuelPct: 78,
    engineHours: 2140,
    telematicsId: "TL-X300-804",
    status: "READY",
    image: AS + "heavy-excavator.jpg",
  },
  {
    id: "m-102",
    title: "DT420 Tipper Truck",
    sector: "Logistics",
    category: "Tipper Truck",
    owner: "Apex Haulage Co.",
    rating: 4.7,
    distanceKm: 12.1,
    baseRateHourly: 1650,
    location: "Hosur Road, Bengaluru",
    verified: true,
    availability: "Available tomorrow",
    specs: ["16 tonne payload", "10 wheel drive", "14 m³ body"],
    plainEnglishGuide:
      "Moves loose material quickly between your excavation and dump site. Best booked with a clear route plan.",
    primaryApplication: "Aggregate & debris hauling",
    fuelPct: 64,
    engineHours: 3890,
    telematicsId: "TL-DT420-112",
    status: "READY",
    image: AS + "tipper-truck.jpg",
  },
  {
    id: "m-103",
    title: "DrillMax 600 Borewell Rig",
    sector: "Water & Drilling",
    category: "Borewell Rig",
    owner: "GroundTruth Drilling",
    rating: 4.8,
    distanceKm: 22.7,
    baseRateHourly: 4200,
    baseRatePerFoot: 95,
    location: "Electronic City, Bengaluru",
    verified: true,
    availability: "Available in 3 days",
    specs: [
      "600 m drilling depth",
      "Hydraulic drive",
      "200 bar compressor",
      "Depth-based ₹/ft pricing",
    ],
    plainEnglishGuide:
      "A deep-drilling rig for borewells. This job is priced by completed drilling depth, not by hours. Add a water-point survey when you need the site assessed.",
    primaryApplication: "Borewell drilling & water-point surveys",
    fuelPct: 91,
    engineHours: 1760,
    telematicsId: "TL-DM600-094",
    status: "READY",
    image: AS + "borewell-rig.jpg",
  },
  {
    id: "m-104",
    title: "Compact 5T Excavator",
    sector: "Construction",
    category: "Excavator",
    owner: "Mitra Plant Hire",
    rating: 4.6,
    distanceKm: 5.8,
    baseRateHourly: 1450,
    location: "Yelahanka, Bengaluru",
    verified: false,
    availability: "Available from 29 Sep",
    specs: ["5 tonne operating weight", "0.25 m³ bucket", "Zero tail swing"],
    plainEnglishGuide:
      "Small footprint, big access. Fits through tighter sites and handles trenching, grading and landscaping.",
    primaryApplication: "Utility trenches & landscaping",
    fuelPct: 52,
    engineHours: 4210,
    telematicsId: "TL-C5-561",
    status: "SERVICE DUE",
    image: AS + "heavy-excavator.jpg",
  },
  {
    id: "m-105",
    title: "AgriPro 55 Tractor",
    sector: "Agriculture",
    category: "Tractor",
    owner: "Greenfield Farm Services",
    rating: 4.7,
    distanceKm: 16.3,
    baseRateHourly: 950,
    location: "Devanahalli, Bengaluru",
    verified: true,
    availability: "Available today",
    specs: ["55 HP diesel engine", "4WD traction", "Rotavator-ready PTO"],
    plainEnglishGuide:
      "A versatile farm tractor for field preparation, towing and seasonal work. Confirm the attachment you need before booking.",
    primaryApplication: "Ploughing, towing & field preparation",
    fuelPct: 73,
    engineHours: 2450,
    telematicsId: "TL-AG55-118",
    status: "READY",
    image: AS + "tractor-4wd.jpg",
  },
  {
    id: "m-109",
    title: "FarmMate 75 HP 4WD Tractor",
    sector: "Agriculture",
    category: "Tractor",
    owner: "Kaveri Agri Rentals",
    rating: 4.8,
    distanceKm: 9.4,
    baseRateHourly: 1200,
    location: "Hoskote, Bengaluru",
    verified: true,
    availability: "Available today",
    specs: [
      "75 HP diesel engine",
      "4WD + differential lock",
      "Rear PTO + 3-point hitch",
    ],
    plainEnglishGuide:
      "A heavy farm tractor for deep ploughing, rotavation and pulling loaded trailers. Its rear PTO and three-point hitch support common farm implements.",
    primaryApplication: "Deep ploughing, rotavation & heavy trailer work",
    fuelPct: 81,
    engineHours: 1890,
    telematicsId: "TL-FM75-309",
    status: "READY",
    image: AS + "tractor-4wd.jpg",
  },
  {
    id: "m-110",
    title: "Swaraj 744 Tractor + Rear Trailer",
    sector: "Agriculture",
    category: "Tractor Trailer",
    owner: "Greenfield Farm Services",
    rating: 4.7,
    distanceKm: 17.8,
    baseRateHourly: 1450,
    location: "Devanahalli, Bengaluru",
    verified: true,
    availability: "Available tomorrow",
    specs: ["60 HP tractor", "6 tonne rear trailer", "Hydraulic tipping body"],
    plainEnglishGuide:
      "The tractor pulls a rear trailer for moving harvested produce, manure, sand or small aggregate around a farm and between nearby sites.",
    primaryApplication: "Farm produce, sand & aggregate hauling",
    fuelPct: 76,
    engineHours: 2760,
    telematicsId: "TL-ST744-212",
    status: "READY",
    image: AS + "tractor-trailer.jpg",
  },
  {
    id: "m-111",
    title: "OrchardPro Compact Tractor",
    sector: "Agriculture",
    category: "Compact Tractor",
    owner: "Mango Valley Implements",
    rating: 4.6,
    distanceKm: 6.8,
    baseRateHourly: 780,
    location: "Chikkaballapur Road, Bengaluru",
    verified: true,
    availability: "Available today",
    specs: [
      "35 HP narrow-body tractor",
      "Orchard-friendly turning radius",
      "PTO sprayer-ready",
    ],
    plainEnglishGuide:
      "A compact tractor that fits between orchard rows for spraying, inter-cultivation and light trailer work without damaging planted trees.",
    primaryApplication: "Mango orchard rows, spraying & inter-cultivation",
    fuelPct: 68,
    engineHours: 1640,
    telematicsId: "TL-OP35-087",
    status: "READY",
    image: AS + "compact-tractor.jpg",
  },
  {
    id: "m-106",
    title: "CAT 140K Motor Grader",
    sector: "Road & Infrastructure",
    category: "Motor Grader",
    owner: "CivicBuild Equipment",
    rating: 4.8,
    distanceKm: 18.5,
    baseRateHourly: 2350,
    location: "Tumakuru Road, Bengaluru",
    verified: true,
    availability: "Available tomorrow",
    specs: ["14 ft moldboard", "Articulated frame", "Fine grading control"],
    plainEnglishGuide:
      "Shapes and levels road base, shoulders and large sites. Best for long, even passes rather than tight excavation.",
    primaryApplication: "Road base & site grading",
    fuelPct: 69,
    engineHours: 5980,
    telematicsId: "TL-CAT140-230",
    status: "READY",
    image: AS + "motor-grader.jpg",
  },
  {
    id: "m-107",
    title: "SkidPro Compact Loader",
    sector: "Landscaping & Utilities",
    category: "Skid Steer Loader",
    owner: "Mitra Plant Hire",
    rating: 4.5,
    distanceKm: 9.6,
    baseRateHourly: 1250,
    location: "Jakkur, Bengaluru",
    verified: false,
    availability: "Available in 2 days",
    specs: [
      "Compact footprint",
      "0.45 m³ bucket",
      "Attachment-ready hydraulics",
    ],
    plainEnglishGuide:
      "A nimble loader for landscaping, utility trenches and material movement where larger equipment cannot fit.",
    primaryApplication: "Landscaping, utilities & tight-access work",
    fuelPct: 58,
    engineHours: 3140,
    telematicsId: "TL-SKID-332",
    status: "READY",
    image: AS + "skid-steer.jpg",
  },
  {
    id: "m-108",
    title: "Atlas Copco 1500ft High-Pressure Borewell Rig",
    sector: "Agriculture",
    category: "Borewell Rig",
    owner: "AquaCore Drilling",
    rating: 4.9,
    distanceKm: 11.2,
    baseRateHourly: 4800,
    baseRatePerFoot: 95,
    location: "Hoskote, Bengaluru",
    verified: true,
    availability: "Available tomorrow",
    specs: [
      "1,500 ft rated depth",
      "1200 CFM / 350 PSI compressor",
      "DTH hammer + rotary mud support",
    ],
    plainEnglishGuide:
      "A verified high-pressure rig for farm borewells and hard rock. Choose the terrain rate in the estimator, then reserve this rig for the quoted depth.",
    primaryApplication: "Agricultural borewells & groundwater access",
    fuelPct: 88,
    engineHours: 1320,
    telematicsId: "TL-AT1500-441",
    status: "READY",
    image: AS + "borewell-rig.jpg",
  },
];
const sectorOptions = [
  "Agriculture",
  "Construction",
  "Logistics",
  "Road & Infrastructure",
  "Water & Drilling",
  "Landscaping & Utilities",
];
const surveyFee = 3500;
const equipmentUnit = (m: Machinery) =>
  m.category === "Borewell Rig" ? "foot" : "hour";
const displayRate = (m: Machinery) => m.baseRatePerFoot || m.baseRateHourly;
const bookingMeasure = (b: Booking) => {
  const measure =
    b.billingUnit === "foot"
      ? `${(b.quantity || 0).toLocaleString()} ft planned`
      : b.billingUnit === "survey"
        ? "flat-fee survey"
        : `${b.durationHours}h`;
  const details = [
    b.serviceType,
    b.shift,
    b.startTime && `starts ${b.startTime}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const unitCount = b.units && b.units > 1 ? `${b.units} units · ` : "";
  return `${unitCount}${details ? `${measure} · ${details}` : measure}`;
};

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
  string | undefined;
const rigLogixRelayNumber = import.meta.env.VITE_RIGLOGIX_CALL_NUMBER as
  string | undefined;

function GoogleMapPanel({
  query,
  className = "h-64",
}: {
  query: string;
  className?: string;
}) {
  const encoded = encodeURIComponent(query || "Bengaluru, India");
  const src = googleMapsApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsApiKey)}&q=${encoded}`
    : `https://maps.google.com/maps?q=${encoded}&z=13&output=embed`;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#b6d2ca] bg-[#e6f2ee]">
      <iframe
        title={`Google Map for ${query || "Bengaluru"}`}
        src={src}
        className={`w-full ${className}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-[#35565c]">
        <span>
          {googleMapsApiKey ? "Google Maps Embed API" : "Google Maps preview"}
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-[#1a7d78] hover:underline"
        >
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}

function CallRelayButton({ bookingId }: { bookingId: string }) {
  const [requested, setRequested] = useState(false);
  const requestCall = () => {
    const existing = read<Record<string, unknown>[]>(
      keyFor("call-requests"),
      [],
    );
    write(keyFor("call-requests"), [
      { bookingId, requestedAt: new Date().toISOString(), recorded: true },
      ...existing,
    ]);
    setRequested(true);
  };
  if (rigLogixRelayNumber) {
    return (
      <a
        href={`tel:${rigLogixRelayNumber}`}
        className="inline-flex items-center gap-2 rounded-xl border border-[#b6d2ca] bg-[#e6f2ee] px-3 py-2 text-xs font-bold text-[#1a7d78]"
      >
        <PhoneCall size={14} /> Call via RigLogix
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={requestCall}
      disabled={requested}
      className="inline-flex items-center gap-2 rounded-xl border border-[#b6d2ca] bg-[#e6f2ee] px-3 py-2 text-xs font-bold text-[#1a7d78] disabled:opacity-70"
    >
      <PhoneCall size={14} />{" "}
      {requested ? "Callback requested" : "Request recorded call"}
    </button>
  );
}
const borewellTerrainOptions = [
  { id: "hard", name: "Hard Granite / Blue Basalt", rig: "DTH Rig", rate: 95 },
  { id: "sandy", name: "Sandy Alluvium", rig: "Rotary Mud Rig", rate: 110 },
  { id: "soft", name: "Soft Soil / Red Earth", rig: "Rotary Rig", rate: 85 },
];
const borewellCasingOptions = [
  { id: "pvc", name: '6.5" Heavy Duty PVC', detail: "10 kg/cm²", rate: 360 },
  {
    id: "steel",
    name: '7" M.S. Steel Heavy Casing',
    detail: "High-load casing",
    rate: 620,
  },
  {
    id: "screen",
    name: "Slotted PVC Sand Screen",
    detail: "Aquifer filtration",
    rate: 420,
  },
];
const auctionSeed: Auction[] = [
  {
    id: "auc-agri-1",
    title: "1200ft Borewell Drilling for 40-Acre Mango Orchard",
    category: "Agriculture",
    location: "East Valley Farmlands · Hex #8828308281ff",
    description:
      "Bulk borewell requirement for a mango orchard. Quote the full drilling package and mobilize a verified high-pressure rig to the farm.",
    requiredDate: "2026-09-24",
    maxPrice: 135000,
    lowestBid: 118000,
    bidCount: 4,
    status: "OPEN",
    unitLabel: "project",
    timeLeft: "14m left",
    bids: [
      {
        id: "b-agri-1",
        operator: "AquaCore Drilling",
        equipment: "Atlas Copco 1500ft High-Pressure Borewell Rig",
        amount: 118000,
        eta: "2 days",
        rating: 4.9,
        distance: 11.2,
      },
      {
        id: "b-agri-2",
        operator: "GroundTruth Drilling",
        equipment: "DrillMax 600 Borewell Rig",
        amount: 121500,
        eta: "3 days",
        rating: 4.8,
        distance: 22.7,
      },
      {
        id: "b-agri-3",
        operator: "Kaveri Borewell Works",
        equipment: "DTH 1200 Deep Rig",
        amount: 126000,
        eta: "4 days",
        rating: 4.7,
        distance: 19.4,
      },
      {
        id: "b-agri-4",
        operator: "SouthRock Water Systems",
        equipment: "Rotary-DTH Combo Rig",
        amount: 130000,
        eta: "5 days",
        rating: 4.6,
        distance: 28.1,
      },
    ],
  },
  {
    id: "auc-log-1",
    title: "Charter 20-Ton Lorry: 320km Cement Bag Consignment",
    category: "Logistics",
    location: "Central Cement Plant to Harbor Construction Yard",
    description:
      "Move a bulk cement bag consignment across a fixed 320 km route. Include loading coordination, tarpaulin cover and delivery proof.",
    requiredDate: "2026-09-26",
    maxPrice: 280000,
    lowestBid: 225000,
    bidCount: 6,
    status: "OPEN",
    unitLabel: "consignment",
    timeLeft: "22m left",
    bids: [
      {
        id: "b-log-1",
        operator: "Apex Haulage Co.",
        equipment: "DT420 Tipper Truck",
        amount: 225000,
        eta: "1 day",
        rating: 4.7,
        distance: 12.1,
      },
      {
        id: "b-log-2",
        operator: "MetroLine Carriers",
        equipment: "20T Bulk Lorry",
        amount: 231000,
        eta: "1 day",
        rating: 4.6,
        distance: 15.8,
      },
      {
        id: "b-log-3",
        operator: "Ridgeway Transport",
        equipment: "Multi-Axle Cement Carrier",
        amount: 240000,
        eta: "2 days",
        rating: 4.8,
        distance: 21.2,
      },
      {
        id: "b-log-4",
        operator: "Bengaluru Freight Link",
        equipment: "20T Covered Lorry",
        amount: 248000,
        eta: "2 days",
        rating: 4.5,
        distance: 25.6,
      },
    ],
  },
  {
    id: "auc-con-1",
    title: "Foundation Trenching & Rock Breaker: 3 Days Excavation",
    category: "Construction",
    location: "Warehouse Logistics Hub Site, Phase 2",
    description:
      "Three-day foundation trenching package with hard-rock breaking, spoil loading and a clear daily site handover.",
    requiredDate: "2026-09-28",
    maxPrice: 52000,
    lowestBid: 44000,
    bidCount: 3,
    status: "OPEN",
    unitLabel: "project",
    timeLeft: "45m left",
    bids: [
      {
        id: "b-con-1",
        operator: "Northline Earthworks",
        equipment: "X300 Crawler Excavator",
        amount: 44000,
        eta: "3 hrs",
        rating: 4.9,
        distance: 8.4,
      },
      {
        id: "b-con-2",
        operator: "Mitra Plant Hire",
        equipment: "Compact 5T Excavator + Rock Breaker",
        amount: 46500,
        eta: "5 hrs",
        rating: 4.6,
        distance: 5.8,
      },
      {
        id: "b-con-3",
        operator: "CivicBuild Equipment",
        equipment: "Excavator and Breaker Package",
        amount: 48000,
        eta: "1 day",
        rating: 4.8,
        distance: 18.5,
      },
    ],
  },
];
const fleetSeed: FleetItem[] = [
  {
    id: "f-1",
    equipment: "X300 Crawler Excavator",
    registration: "KA 51 AB 1024",
    capacity: "30 tonne",
    rate: 2850,
    status: "Available",
    fuel: 78,
    engineHours: 2140,
    telematicsId: "TL-X300-804",
    currentJob: "—",
  },
  {
    id: "f-2",
    equipment: "DT420 Tipper Truck",
    registration: "KA 01 MN 8842",
    capacity: "16 tonne",
    rate: 1650,
    status: "On job",
    fuel: 64,
    engineHours: 3890,
    telematicsId: "TL-DT420-112",
    currentJob: "Ridgeview Villas",
  },
  {
    id: "f-3",
    equipment: "CAT 140K Motor Grader",
    registration: "KA 03 QX 7741",
    capacity: "14 ft blade",
    rate: 2350,
    status: "Maintenance",
    fuel: 31,
    engineHours: 5980,
    telematicsId: "TL-CAT140-230",
    currentJob: "Workshop bay 2",
    availableFrom: "2026-09-29",
  },
];
const activitySeed: Activity[] = [
  {
    id: "a1",
    label: "Booking request sent",
    detail: "X300 Crawler Excavator · Ridgeview Villas",
    time: "12 min ago",
    type: "booking",
  },
  {
    id: "a2",
    label: "Bid accepted",
    detail: "Apex Haulage Co. · DT420 Tipper Truck",
    time: "Yesterday",
    type: "auction",
  },
  {
    id: "a3",
    label: "Review pending",
    detail: "Tell Northline how the job went",
    time: "2 days ago",
    type: "review",
  },
];
const bookingSeed: Booking[] = [
  {
    id: "JOB-1042",
    machineryId: "m-101",
    machineryTitle: "X300 Crawler Excavator",
    ownerName: "Northline Earthworks",
    customerName: "Arjun Rao",
    location: "Whitefield, Bengaluru",
    date: "2026-09-24",
    durationHours: 24,
    baseCost: 68400,
    platformFee: 2394,
    totalCost: 70794,
    ownerEarnings: 68400,
    status: "MOBILIZING",
    billingUnit: "hour",
    quantity: 24,
    unitRate: 2850,
    serviceType: "Foundation excavation",
  },
  {
    id: "JOB-1037",
    machineryId: "m-102",
    machineryTitle: "DT420 Tipper Truck",
    ownerName: "Apex Haulage Co.",
    customerName: "Arjun Rao",
    location: "Hosur Road, Bengaluru",
    date: "2026-09-22",
    durationHours: 16,
    baseCost: 26400,
    platformFee: 924,
    totalCost: 27324,
    ownerEarnings: 26400,
    status: "CONFIRMED",
    billingUnit: "hour",
    quantity: 16,
    unitRate: 1650,
    serviceType: "Aggregate hauling",
  },
];
const sessionKey = "riglogix-session";
const profileKey = "riglogix-profile";
const accountsKey = "riglogix-accounts";
function isDemoSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
    return isRecord(session) && session.demo === true;
  } catch {
    return false;
  }
}
const keyFor = (k: string) =>
  k === "session"
    ? sessionKey
    : `riglogix-${isDemoSession() ? "demo-" : ""}${k}`;
const machineryForSession = () => machinerySeed;
const auctionsForSession = () => (isDemoSession() ? auctionSeed : []);
const fleetForSession = () => (isDemoSession() ? fleetSeed : []);
const activityForSession = () => (isDemoSession() ? activitySeed : []);
const bookingsForSession = () => (isDemoSession() ? bookingSeed : []);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return (Array.isArray(value) ? value.filter(isRecord) : fallback) as T;
    }
    if (fallback === null) {
      return (isRecord(value) ? value : fallback) as T;
    }
    if (isRecord(fallback)) {
      return (isRecord(value) ? { ...fallback, ...value } : fallback) as T;
    }
    return (typeof value === typeof fallback ? value : fallback) as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {}
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function storedRole(): Role | null {
  const session = read<Record<string, unknown> | null>(keyFor("session"), null);
  return session?.role === "customer" || session?.role === "owner"
    ? session.role
    : null;
}
function activeAccountName() {
  return read<UserSession | null>(sessionKey, null)?.fullName || "Customer";
}
const initialsFor = (name: string, fallback: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || fallback;
};
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const dateText = () => new Date().toISOString().slice(0, 10);
const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const nextMonday = () => {
  const d = new Date();
  const days = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl ${light ? "bg-[#f6b73c] text-[#18303a]" : "bg-[#ee8b18] text-[#18303a]"}`}
      >
        <span className="display text-lg font-bold">R</span>
      </span>
      <span
        className={`display text-xl font-bold tracking-tight ${light ? "text-[#f6f3ea]" : "text-[#18303a]"}`}
      >
        Rig<span className="text-[#ee8b18]">Logix</span>
      </span>
    </Link>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "neutral" | "teal";
}) {
  const c = {
    good: "bg-[#d9eee7] text-[#1a6d60]",
    warn: "bg-[#f9e3ba] text-[#8e5811]",
    teal: "bg-[#d7edeb] text-[#176761]",
    neutral: "bg-[#ece8dc] text-[#526169]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${c}`}
    >
      {children}
    </span>
  );
}
function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    primary: "bg-[#ee8b18] text-[#18303a] hover:bg-[#f5a42e]",
    secondary: "bg-[#18303a] text-[#f6f3ea] hover:bg-[#264752]",
    ghost:
      "border border-[#d5d0c2] bg-[#fbf9f2] text-[#18303a] hover:border-[#ee8b18]",
    danger: "bg-[#f6d7d1] text-[#943e32]",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${v} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Stat({
  label,
  value,
  detail,
  icon: Icon,
  accent = "orange",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[.15em] text-[#68777b]">
          {label}
        </span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ${accent === "teal" ? "bg-[#d7edeb] text-[#1a7d78]" : "bg-[#f9e3ba] text-[#b9680d]"}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="display text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-[#68777b]">{detail}</div>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#c9c4b8] bg-[#fbf9f2] p-10 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#ece8dc] text-[#68777b]">
        <Box size={22} />
      </div>
      <h3 className="display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[#68777b]">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobile, setMobile] = useState(false);
  const demo = isDemoSession();
  const session = read<UserSession>(sessionKey, {
    role,
    fullName: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    postalCode: "",
  });
  const liveName =
    session.fullName ||
    (role === "customer" ? "Customer account" : "Owner account");
  const liveLocation = [session.city, session.state].filter(Boolean).join(", ");
  const profile = demo
    ? role === "customer"
      ? { initials: "AR", name: "Arjun Rao", subtitle: "Site manager" }
      : { initials: "NS", name: "Neeraj Singh", subtitle: "Owner / operator" }
    : role === "customer"
      ? {
          initials: initialsFor(liveName, "CU"),
          name: liveName,
          subtitle: session.business || liveLocation || "Contractor desk",
        }
      : {
          initials: initialsFor(liveName, "OW"),
          name: liveName,
          subtitle: session.business || liveLocation || "Owner operations",
        };
  const customerNav = [
    ["/customer/dashboard", "Overview", House],
    ["/customer/machinery", "Find equipment", Search],
    ["/customer/auctions", "Reverse auctions", Hammer],
    ["/customer/radar", "Equipment radar", Radio],
    ["/customer/bookings", "My bookings", PackageCheck],
  ];
  const ownerNav = [
    ["/owner/dashboard", "Overview", House],
    ["/owner/fleet", "My fleet", Truck],
    ["/owner/jobs", "Jobs & bids", Layers3],
  ];
  const nav = role === "customer" ? customerNav : ownerNav;
  const signOut = () => {
    localStorage.removeItem(keyFor("session"));
    setLocation("/sign-in");
  };
  return (
    <div className="grain app-shell flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-[#18303a] p-5 text-[#f6f3ea] transition-transform md:static md:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-10 flex items-center justify-between">
          <Logo light />
          <button
            className="text-[#a5b6b6] md:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-7 rounded-2xl border border-[#36505a] bg-[#203e48] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#f6b73c] font-bold text-[#18303a]">
              {profile.initials}
            </div>
            <div>
              <p className="text-sm font-bold">{profile.name}</p>
              <p className="text-[11px] text-[#9cb0b0]">{profile.subtitle}</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href as string}
              href={href as string}
              onClick={() => setMobile(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${location === href ? "bg-[#f6b73c] text-[#18303a]" : "text-[#afc0c0] hover:bg-[#264752] hover:text-[#f6f3ea]"}`}
              data-testid={`link-nav-${label}`}
            >
              <Icon size={17} />
              {label as string}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-[#36505a] pt-4">
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#afc0c0] hover:bg-[#264752]"
            data-testid="link-nav-account"
          >
            <Settings2 size={17} />
            Account
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#afc0c0] hover:bg-[#264752]"
            data-testid="button-sign-out"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#ded9ca] bg-[#f6f3ea]/95 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3">
            <button
              className="text-[#18303a] md:hidden"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-[#68777b] md:flex">
              <span className="h-2 w-2 rounded-full bg-[#2caa87]"></span>
              {demo ? "Demo workspace" : "RigLogix workspace"}{" "}
              <span className="text-[#b2ada0]">/</span>{" "}
              {role === "customer" ? "Contractor desk" : "Owner operations"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative rounded-xl p-2 text-[#68777b] hover:bg-[#ece8dc]"
              data-testid="button-notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ee8b18]"></span>
            </button>
            <Link href="/account" className="hidden text-right sm:block">
              <p className="text-xs font-bold">{profile.name}</p>
              <p className="text-[10px] text-[#68777b]">
                {demo ? "Demo · Bengaluru" : "RigLogix"}
              </p>
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] p-5 md:p-9">{children}</div>
      </main>
    </div>
  );
}

function Landing() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-[#18303a] text-[#f6f3ea]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-10">
        <Logo light />
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-4 py-2 text-sm font-bold text-[#f6f3ea] hover:bg-[#264752] sm:block"
          >
            Sign in
          </Link>
          <Button onClick={() => setLocation("/demo")}>
            Open demo <ArrowRight size={16} />
          </Button>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-10 md:grid-cols-[.9fr_1.1fr] md:px-10 md:pb-28 md:pt-16">
        <div className="fade-up">
          <Badge tone="teal">Built for the hard-working middle</Badge>
          <h1 className="display mt-5 max-w-xl text-5xl font-bold leading-[.98] tracking-tight md:text-7xl">
            The right rig.
            <br />
            <span className="text-[#f6b73c]">Right when you need it.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#b8c6c3] md:text-lg">
            RigLogix connects active jobsites with verified equipment and
            operators — so you can move from “still looking” to “on site” with
            confidence.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => setLocation("/demo")}>
              Try contractor demo <ArrowRight size={16} />
            </Button>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-[#527078] px-4 py-2.5 text-sm font-bold text-[#f6f3ea]"
            >
              I own equipment <Truck size={16} />
            </Link>
          </div>
          <div className="mt-10 flex gap-8 border-t border-[#36505a] pt-6">
            <div>
              <p className="display text-2xl font-bold">Private</p>
              <p className="text-xs text-[#9cb0b0]">masked calls</p>
            </div>
            <div>
              <p className="display text-2xl font-bold">Direct</p>
              <p className="text-xs text-[#9cb0b0]">owner contact</p>
            </div>
            <div>
              <p className="display text-2xl font-bold">Clear</p>
              <p className="text-xs text-[#9cb0b0]">job milestones</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-[#527078] shadow-2xl shadow-black/20">
          <img
            src={AS + "hero-machinery.jpg"}
            className="h-[340px] w-full object-cover md:h-[500px]"
            alt="Heavy equipment at a connected jobsite"
          />
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/20 bg-[#18303a]/85 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[.15em] text-[#a9d9d1]">
                  Network pulse
                </p>
                <p className="mt-1 font-bold">
                  {machinerySeed.length} demo machines currently published
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2caa87] text-[#18303a]">
                <Radio size={17} />
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#f6f3ea] px-5 py-16 text-[#18303a] md:px-10 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#1a7d78]">
            One operating rhythm
          </p>
          <h2 className="display mt-3 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            From a clear need to a clean handover.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              [
                "01",
                "Discover",
                "Search verified equipment by what the job actually needs.",
              ],
              [
                "02",
                "Compare",
                "See hourly rates, fees and operator context side by side.",
              ],
              [
                "03",
                "Commit",
                "Book directly or let operators compete in a reverse auction.",
              ],
              [
                "04",
                "Complete",
                "Track milestones, close the job and leave a useful review.",
              ],
            ].map(([n, t, d]) => (
              <div key={n} className="border-t-2 border-[#ee8b18] pt-4">
                <span className="mono text-xs text-[#ee8b18]">{n}</span>
                <h3 className="display mt-6 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-[#68777b]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-[#36505a] bg-[#18303a] px-5 py-8 text-center text-sm text-[#9cb0b0]">
        RigLogix equipment marketplace
      </footer>
    </div>
  );
}

function SignIn() {
  const [location, setLocation] = useLocation();
  const savedProfile = read<AccountProfile>(profileKey, {
    role: "customer",
    fullName: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    postalCode: "",
    business: "",
  });
  const savedAccounts = read<AccountProfile[]>(accountsKey, []);
  const [role, setRole] = useState<Role>(savedProfile.role);
  const [mode, setMode] = useState<"demo" | "workspace">(
    location === "/demo" ? "demo" : "workspace",
  );
  const [authSubMode, setAuthSubMode] = useState<"login" | "register">(
    savedAccounts.length > 0 ? "login" : "register",
  );
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState("");
  const demo = mode === "demo";

  const enter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (demo) {
      write(sessionKey, {
        role,
        demo: true,
        fullName: role === "customer" ? "Arjun Rao" : "Neeraj Singh",
        phone: "",
        email: "",
        state: "Karnataka",
        city: "Bengaluru",
        postalCode: "",
      } satisfies UserSession);
      setLocation(
        role === "customer" ? "/customer/dashboard" : "/owner/dashboard",
      );
      return;
    }

    const data = new FormData(event.currentTarget);
    const currentAccounts = read<AccountProfile[]>(accountsKey, []);

    if (authSubMode === "login") {
      const identifier = String(data.get("identifier") || loginIdentifier).trim();
      const password = String(data.get("password") || loginPassword).trim();

      if (!identifier) {
        setError("Please enter your email address or phone number.");
        return;
      }
      if (!password) {
        setError("Please enter your password.");
        return;
      }

      const idLower = identifier.toLowerCase();
      const idDigits = identifier.replace(/\D/g, "");

      let matched = currentAccounts.find((acc) => {
        const accEmail = (acc.email || "").toLowerCase();
        const accPhoneDigits = (acc.phone || "").replace(/\D/g, "");
        return (
          (accEmail && accEmail === idLower) ||
          (accPhoneDigits && idDigits.length >= 10 && accPhoneDigits === idDigits)
        );
      });

      if (!matched && savedProfile.email) {
        const sEmail = (savedProfile.email || "").toLowerCase();
        const sPhoneDigits = (savedProfile.phone || "").replace(/\D/g, "");
        if (
          (sEmail && sEmail === idLower) ||
          (sPhoneDigits && idDigits.length >= 10 && sPhoneDigits === idDigits)
        ) {
          matched = savedProfile;
        }
      }

      if (!matched) {
        setError("No registered account found with these credentials. Please check details or create a new account.");
        return;
      }

      if (matched.password && matched.password !== password) {
        setError("Incorrect password. Please verify your credentials and try again.");
        return;
      }

      write(profileKey, matched);
      write(sessionKey, { ...matched, demo: false } satisfies UserSession);
      setLocation(
        matched.role === "customer" ? "/customer/dashboard" : "/owner/dashboard",
      );
    } else {
      const phone = String(data.get("phone") || "").trim();
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        setError("Enter a valid phone number with 10 to 15 digits.");
        return;
      }

      const email = String(data.get("email") || "").trim().toLowerCase();
      const password = String(data.get("password") || "").trim();
      const confirmPassword = String(data.get("confirmPassword") || "").trim();

      if (!password || password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter.");
        return;
      }

      const duplicate = currentAccounts.find((acc) => {
        const accEmail = (acc.email || "").toLowerCase();
        const accPhoneDigits = (acc.phone || "").replace(/\D/g, "");
        return accEmail === email || (digits.length >= 10 && accPhoneDigits === digits);
      });

      if (duplicate) {
        setError("An account with this email or phone number already exists. Please switch to the Log In tab.");
        return;
      }

      const profile: AccountProfile = {
        role,
        fullName: String(data.get("fullName") || "").trim(),
        phone,
        email,
        state: String(data.get("state") || "").trim(),
        city: String(data.get("city") || "").trim(),
        postalCode: String(data.get("postalCode") || "").trim(),
        business: String(data.get("business") || "").trim(),
        password,
      };

      write(accountsKey, [...currentAccounts, profile]);
      write(profileKey, profile);
      write(sessionKey, { ...profile, demo: false } satisfies UserSession);
      setLocation(
        role === "customer" ? "/customer/dashboard" : "/owner/dashboard",
      );
    }
  };

  const selectQuickAccount = (acc: AccountProfile) => {
    setRole(acc.role);
    setLoginIdentifier(acc.email || acc.phone);
    if (acc.password) {
      setLoginPassword(acc.password);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#18303a] p-4 md:p-5">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-[#f6f3ea] shadow-2xl md:grid-cols-[.85fr_1.15fr]">
        <div className="hidden bg-[#264752] p-10 text-[#f6f3ea] md:block">
          <Logo light />
          <div className="mt-28">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a9d9d1]">
              RigLogix
            </p>
            <h1 className="display mt-4 text-5xl font-bold leading-tight">
              Manage every machine move.
            </h1>
            <p className="mt-5 leading-7 text-[#b8c6c3]">
              Choose the workspace that matches how you use the marketplace.
            </p>
          </div>
        </div>
        <form
          onSubmit={enter}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-7 md:p-10"
        >
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="mt-8 grid grid-cols-2 rounded-xl bg-[#ece8dc] p-1 md:mt-0">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${demo ? "bg-[#fbf9f2] text-[#18303a] shadow-sm" : "text-[#68777b]"}`}
            >
              Demo profiles
            </button>
            <button
              type="button"
              onClick={() => setMode("workspace")}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${!demo ? "bg-[#fbf9f2] text-[#18303a] shadow-sm" : "text-[#68777b]"}`}
            >
              Clean workspace
            </button>
          </div>

          {!demo && (
            <div className="mt-5 flex rounded-xl border border-[#ded9ca] bg-[#ece8dc] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthSubMode("login");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  authSubMode === "login"
                    ? "bg-[#ee8b18] text-white shadow-sm"
                    : "text-[#526169] hover:text-[#18303a]"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthSubMode("register");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  authSubMode === "register"
                    ? "bg-[#ee8b18] text-white shadow-sm"
                    : "text-[#526169] hover:text-[#18303a]"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#1a7d78]">
            {demo
              ? "Choose a demo profile"
              : authSubMode === "login"
              ? "Sign in to workspace"
              : "Register new workspace account"}
          </p>
          <h2 className="display mt-2 text-3xl font-bold">
            {demo
              ? "How are you using RigLogix?"
              : authSubMode === "login"
              ? "Welcome back"
              : "Create your RigLogix account"}
          </h2>
          <p className="mt-2 text-sm text-[#68777b]">
            {demo
              ? "Explore the complete marketplace with clearly labelled sample equipment, jobs and bids."
              : authSubMode === "login"
              ? "Enter your account email/phone and password to log in to your workspace."
              : "Fill out your details to create an account. You can log into this account anytime."}
          </p>

          {(demo || authSubMode === "register") && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "customer",
                    demo ? "Arjun Rao" : "Customer / contractor",
                    "Find equipment, create requests and manage bookings",
                    demo ? "AR" : "CU",
                  ],
                  [
                    "owner",
                    demo ? "Neeraj Singh" : "Equipment owner / operator",
                    "Add equipment and manage incoming work",
                    demo ? "NS" : "OW",
                  ],
                ] as [Role, string, string, string][]
              ).map(([itemRole, title, detail, initials]) => (
                <button
                  type="button"
                  key={itemRole}
                  onClick={() => setRole(itemRole)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${role === itemRole ? "border-[#ee8b18] bg-[#f9e3ba]/50" : "border-[#d9d4c7] bg-[#fbf9f2] hover:border-[#a7b5b2]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-full font-bold ${role === itemRole ? "bg-[#ee8b18] text-white" : "bg-[#dce8e3] text-[#18303a]"}`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{title}</p>
                      <p className="mt-1 text-xs text-[#68777b]">{detail}</p>
                    </div>
                    {role === itemRole && (
                      <Check size={18} className="text-[#b9680d]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!demo && authSubMode === "login" && (
            <div className="mt-6 grid gap-4">
              <label className="text-xs font-bold text-[#526169]">
                Email or Phone number *
                <input
                  name="identifier"
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  required
                  placeholder="name@example.com or +91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-login-identifier"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                Password *
                <input
                  name="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-login-password"
                />
              </label>

              {savedAccounts.length > 0 && (
                <div className="mt-2 rounded-xl border border-[#e0dad0] bg-[#f3efe6] p-3">
                  <p className="text-xs font-bold text-[#526169] mb-2">
                    Registered accounts on this device:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {savedAccounts.map((acc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectQuickAccount(acc)}
                        className="flex items-center gap-2 rounded-lg border border-[#ded9ca] bg-white px-3 py-1.5 text-xs font-semibold text-[#18303a] hover:border-[#ee8b18] hover:bg-[#fff9f0]"
                      >
                        <span className="rounded bg-[#ee8b18]/20 px-1.5 py-0.5 text-[10px] uppercase font-bold text-[#b9680d]">
                          {acc.role}
                        </span>
                        <span>{acc.fullName || acc.email || acc.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!demo && authSubMode === "register" && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-[#526169]">
                Full name *
                <input
                  name="fullName"
                  defaultValue={savedProfile.fullName}
                  required
                  autoComplete="name"
                  placeholder="Your full name"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-name"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                Phone number *
                <input
                  name="phone"
                  defaultValue={savedProfile.phone}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-phone"
                />
              </label>
              <label className="text-xs font-bold text-[#526169] sm:col-span-2">
                Email address *
                <input
                  type="email"
                  name="email"
                  defaultValue={savedProfile.email}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-email"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                Password *
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Create a password"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-password"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                Confirm Password *
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-confirm-password"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                State *
                <input
                  name="state"
                  defaultValue={savedProfile.state}
                  required
                  autoComplete="address-level1"
                  placeholder="Karnataka"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-state"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                City / place *
                <input
                  name="city"
                  defaultValue={savedProfile.city}
                  required
                  autoComplete="address-level2"
                  placeholder="Bengaluru"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-city"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                PIN / postal code *
                <input
                  name="postalCode"
                  defaultValue={savedProfile.postalCode}
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="560001"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-postal"
                />
              </label>
              <label className="text-xs font-bold text-[#526169]">
                Company / organisation
                <input
                  name="business"
                  defaultValue={savedProfile.business}
                  autoComplete="organization"
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm font-normal text-[#18303a] outline-none focus:border-[#ee8b18]"
                  data-testid="input-account-business"
                />
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-xs leading-5 text-[#526169] sm:col-span-2">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-1 accent-[#ee8b18]"
                  data-testid="input-account-consent"
                />
                <span>
                  I confirm these details are correct and agree that RigLogix
                  may use them for bookings, service updates and safety
                  communications.
                </span>
              </label>
            </div>
          )}

          <p className="mt-5 rounded-xl bg-[#e6f2ee] p-3 text-xs leading-5 text-[#35565c]">
            {demo
              ? "Demo data only — nothing here represents live machinery, GPS tracking, payments or real users."
              : "Account credentials are saved locally in this browser workspace for instant login and persistence."}
          </p>
          {error && (
            <p
              className="mt-3 rounded-xl bg-[#fde7df] p-3 text-sm font-semibold text-[#9b3b1d]"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="mt-6 w-full py-3.5"
            data-testid="button-enter-workspace"
          >
            {demo
              ? "Continue to demo"
              : authSubMode === "login"
              ? "Log In & Continue"
              : "Create account & continue"}{" "}
            <ArrowRight size={16} />
          </Button>

          {!demo && (
            <div className="mt-4 text-center">
              {authSubMode === "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setAuthSubMode("register");
                    setError("");
                  }}
                  className="text-xs font-semibold text-[#ee8b18] hover:underline"
                >
                  Need a new account? Create one here
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthSubMode("login");
                    setError("");
                  }}
                  className="text-xs font-semibold text-[#ee8b18] hover:underline"
                >
                  Already have an account? Switch to Log In
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function PageHead({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#1a7d78]">
          {eyebrow}
        </p>
        <h1 className="display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68777b]">
          {detail}
        </p>
      </div>
      {action}
    </div>
  );
}
function CustomerDashboard() {
  const bookings = read<Booking[]>(keyFor("bookings"), bookingsForSession());
  const machinery = machineryForSession();
  const auctions = auctionsForSession();
  const activity = activityForSession();
  const active = bookings.filter((booking) => booking.status !== "COMPLETED");
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Contractor desk"
        title="Your workspace."
        detail="Review your saved bookings and find equipment when owners publish it."
        action={
          <Link href="/customer/machinery">
            <Button>
              <Search size={16} /> Find equipment
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Active bookings"
          value={String(active.length)}
          detail="Saved on this device"
          icon={PackageCheck}
        />
        <Stat
          label="Published equipment"
          value={String(machinery.length)}
          detail="Available in your marketplace"
          icon={Radio}
          accent="teal"
        />
        <Stat
          label="Open auctions"
          value={String(
            auctions.filter((auction) => auction.status === "OPEN").length,
          )}
          detail="Created by marketplace users"
          icon={Hammer}
        />
      </div>
      <section className="mt-7">
        <h2 className="mb-3 display text-xl font-bold">Recent bookings</h2>
        {active.length ? (
          <div className="space-y-3">
            {active.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4"
              >
                <p className="font-bold">{booking.machineryTitle}</p>
                <p className="text-sm text-[#68777b]">
                  {booking.location} · {booking.status}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No activity yet"
            detail="When you create a booking, it will appear here."
            action={
              <Link href="/customer/machinery">
                <Button>Find equipment</Button>
              </Link>
            }
          />
        )}
      </section>
      {activity.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 display text-xl font-bold">Recent activity</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4"
              >
                <p className="font-bold">{item.label}</p>
                <p className="mt-1 text-sm text-[#68777b]">{item.detail}</p>
                <p className="mt-3 text-xs font-semibold text-[#1a7d78]">
                  {item.time}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function MachineryCard({
  m,
  unitCount = 1,
  onOpen,
}: {
  m: Machinery;
  unitCount?: number;
  onOpen: () => void;
}) {
  const unit = equipmentUnit(m);
  return (
    <article
      className="lift overflow-hidden rounded-2xl border border-[#ded9ca] bg-[#fbf9f2]"
      data-testid={`card-machinery-${m.id}`}
    >
      <div className="relative h-44">
        <img
          src={m.image}
          alt={m.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          {m.verified && (
            <Badge tone="good">
              <ShieldCheck size={12} /> Verified
            </Badge>
          )}
          <Badge tone={m.status === "READY" ? "teal" : "warn"}>
            {m.status}
          </Badge>
        </div>
        <span className="absolute bottom-3 right-3 rounded-lg bg-[#18303a]/85 px-2 py-1 text-xs font-bold text-[#f6f3ea]">
          {m.distanceKm} km
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#1a7d78]">
              {m.sector} · {m.category}
            </p>
            <h3 className="display mt-1 text-lg font-bold">{m.title}</h3>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold">
            <Star size={13} className="fill-[#ee8b18] text-[#ee8b18]" />
            {m.rating}
          </span>
        </div>
        <p className="mt-2 text-xs text-[#68777b]">
          {m.owner} · {m.location}
        </p>
        {unitCount > 1 && (
          <p className="mt-2 inline-flex rounded-full bg-[#e6f2ee] px-2.5 py-1 text-[11px] font-bold text-[#1a7d78]">
            {unitCount} owner units available to compare
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-[#526169]">
          <span className="font-bold text-[#18303a]">Purpose:</span>{" "}
          {m.primaryApplication}
        </p>
        <div className="mt-5 flex items-end justify-between border-t border-[#e5e0d4] pt-3">
          <div>
            <span className="display text-lg font-bold">
              {money(displayRate(m))}
            </span>
            <span className="text-xs text-[#68777b]">
              {" "}
              / {unit === "foot" ? "ft" : "hour"}
            </span>
          </div>
          <Button onClick={onOpen} className="px-3 py-2 text-xs">
            {unit === "foot" ? "Plan drilling" : "View rig"}{" "}
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}

function MachineryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [radius, setRadius] = useState(30);
  const [selected, setSelected] = useState<Machinery | null>(null);
  const filtered = machinerySeed.filter(
    (m) =>
      (category === "All" || m.category === category) &&
      m.distanceKm <= radius &&
      `${m.title} ${m.owner} ${m.location}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Equipment exchange"
        title="Find the right machine."
        detail="Search the local network by application, distance and availability. Customer totals are shown without owner-side marketplace charges."
      />
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-[#87918d]" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search excavator, drilling, owner..."
            className="w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ee8b18]"
            data-testid="input-machinery-search"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-[#ded9ca] bg-[#f6f3ea] px-3 text-sm font-semibold outline-none"
          data-testid="select-category"
        >
          <option>All</option>
          <option>Excavator</option>
          <option>Tipper Truck</option>
          <option>Borewell Rig</option>
        </select>
        <label className="flex items-center gap-2 rounded-xl bg-[#f6f3ea] px-3 text-xs font-bold text-[#68777b]">
          <SlidersHorizontal size={15} />
          Radius {radius}km
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-20 accent-[#ee8b18]"
            data-testid="input-radius"
          />
        </label>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-[#68777b]">
          <span className="font-bold text-[#18303a]">
            {filtered.length} machines
          </span>{" "}
          match your brief
        </p>
        <span className="text-xs text-[#87918d]">
          Owner-published inventory
        </span>
      </div>
      {filtered.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MachineryCard key={m.id} m={m} onOpen={() => setSelected(m)} />
          ))}
        </div>
      ) : (
        <Empty
          title="No machines in that radius"
          detail="Try expanding the radius or clearing your search."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setRadius(50);
                setQuery("");
                setCategory("All");
              }}
            >
              Reset filters
            </Button>
          }
        />
      )}{" "}
      {selected && (
        <MachineryModal m={selected} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}

function WaterSurveyModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const base = surveyFee;
    const fee = base * 0.035;
    const b: Booking = {
      id: `SURVEY-${Math.floor(1000 + Math.random() * 8999)}`,
      machineryId: "water-survey",
      machineryTitle: "Water Point Survey",
      ownerName: "RigLogix survey partner",
      customerName: activeAccountName(),
      location: String(f.get("location")),
      date: String(f.get("date")),
      durationHours: 0,
      baseCost: base,
      platformFee: fee,
      totalCost: base + fee,
      ownerEarnings: base,
      status: "PENDING",
      billingUnit: "survey",
      quantity: 1,
      unitRate: base,
      serviceType: `Water-point survey · ${String(f.get("landUse"))}`,
    };
    const old = read<Booking[]>(keyFor("bookings"), bookingsForSession());
    write(keyFor("bookings"), [b, ...old]);
    onClose();
    setLocation("/customer/bookings");
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#18303a]/60 p-5"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[24px] bg-[#f6f3ea] p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#1a7d78]">
              Before you drill
            </p>
            <h2 className="display mt-1 text-2xl font-bold">
              Request a water-point survey
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68777b]">
              A survey partner reviews your site and returns a recommended
              drilling point. This is a flat-fee request, not an hourly machine
              booking.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-[#ece8dc]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="text-xs font-bold text-[#68777b]">
            Site location
            <input
              name="location"
              required
              placeholder="Village, plot or site address"
              className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#68777b]">
              Preferred survey date
              <input
                type="date"
                name="date"
                required
                defaultValue={dateText()}
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              />
            </label>
            <label className="text-xs font-bold text-[#68777b]">
              Land use
              <select
                name="landUse"
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              >
                <option>Agriculture</option>
                <option>Residential</option>
                <option>Construction site</option>
                <option>Industrial</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-bold text-[#68777b]">
            Expected depth, if known (feet)
            <input
              type="number"
              name="depth"
              min="0"
              placeholder="Optional estimate"
              className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 rounded-2xl bg-[#e6f2ee] p-4">
          <div className="flex justify-between text-sm">
            <span>Water-point survey</span>
            <span className="font-bold">{money(surveyFee)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-[#b6d2ca] pt-3 font-bold">
            <span>Total booking estimate</span>
            <span>{money(surveyFee * 1.035)}</span>
          </div>
        </div>
        <Button
          className="mt-5 w-full py-3"
          data-testid="button-submit-water-survey"
        >
          Request survey <ArrowRight size={16} />
        </Button>
        <p className="mt-3 text-center text-[11px] text-[#87918d]">
          The survey partner confirms scheduling after the request.
        </p>
      </form>
    </div>
  );
}

function BorewellModal({ m, onClose }: { m: Machinery; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [date, setDate] = useState(dateText());
  const [depth, setDepth] = useState(300);
  const [casingDepth, setCasingDepth] = useState(60);
  const [casingId, setCasingId] = useState("pvc");
  const [site, setSite] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [siteInstructions, setSiteInstructions] = useState("");
  const [addSurvey, setAddSurvey] = useState(false);
  const [validationError, setValidationError] = useState("");
  const rate = m.baseRatePerFoot || 95;
  const casing =
    borewellCasingOptions.find((option) => option.id === casingId) ||
    borewellCasingOptions[0];
  const drilling = rate * depth;
  const casingCost = casing.rate * casingDepth;
  const base = drilling + casingCost + (addSurvey ? surveyFee : 0);
  const fee = base * 0.035;
  const total = base + fee;
  const walletReserve = Math.round(total * 0.1);
  const cancellationPenalty = Math.round(total * 0.05);
  const book = () => {
    if (!site.trim()) {
      setValidationError(
        "Enter the exact borewell site address before requesting a quote.",
      );
      return;
    }
    const b: Booking = {
      id: `JOB-${Math.floor(1000 + Math.random() * 8999)}`,
      machineryId: m.id,
      machineryTitle: m.title,
      ownerName: m.owner,
      customerName: activeAccountName(),
      location: site || m.location,
      date,
      durationHours: 0,
      baseCost: base,
      platformFee: fee,
      totalCost: total,
      ownerEarnings: base,
      status: "PENDING",
      billingUnit: "foot",
      quantity: depth,
      unitRate: rate,
      jobSite: site.trim(),
      siteCoordinates: coordinates.trim() || undefined,
      siteInstructions: siteInstructions.trim() || undefined,
      casingDepth,
      casingType: casing.name,
      walletReserve,
      cancellationPenalty,
      serviceType: addSurvey
        ? `Borewell drilling · ${casing.name} · water-point survey`
        : `Borewell drilling · ${casing.name}`,
    };
    const old = read<Booking[]>(keyFor("bookings"), bookingsForSession());
    write(keyFor("bookings"), [b, ...old]);
    onClose();
    setLocation("/customer/bookings");
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#18303a]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-[#f6f3ea] p-5 sm:rounded-[28px] md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#1a7d78]">
              Water & Drilling · {m.distanceKm} km away
            </p>
            <h2 className="display mt-1 text-2xl font-bold">{m.title}</h2>
            <p className="mt-1 text-sm text-[#68777b]">
              {m.owner} · {m.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-[#ece8dc]"
            data-testid="button-close-borewell"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <img
              src={m.image}
              alt={m.title}
              className="h-56 w-full rounded-2xl object-cover"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {m.specs.map((s) => (
                <div
                  key={s}
                  className="rounded-xl bg-[#ece8dc] p-2 text-center text-xs font-semibold"
                >
                  {s}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#d7edeb] bg-[#e6f2ee] p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                <CircleHelp size={15} /> Depth-based quote
              </p>
              <p className="mt-2 text-sm leading-6 text-[#35565c]">
                Borewell cost is calculated from the estimated drilling depth in
                feet. It does not increase with machine hours. Add the survey
                when you want the water point checked before the rig is
                mobilized.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#68777b]">Owner drilling rate</p>
                <p className="display text-2xl font-bold">
                  {money(rate)}
                  <span className="text-sm font-normal text-[#68777b]">
                    {" "}
                    / ft
                  </span>
                </p>
              </div>
              <Badge tone="good">{m.availability}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-[#68777b]">
                Exact borewell site address{" "}
                <span className="text-[#b75820]">*</span>
                <input
                  value={site}
                  onChange={(e) => {
                    setSite(e.target.value);
                    setValidationError("");
                  }}
                  placeholder="Village, plot, landmark and gate access"
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                  required
                  aria-invalid={Boolean(validationError)}
                  data-testid="input-borewell-site"
                />
              </label>
              <label className="text-xs font-bold text-[#68777b]">
                Start date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-[#b6d2ca] bg-[#e6f2ee] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                  Mark site on Google Maps
                </p>
                <input
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                  placeholder="Optional: 12.9700, 77.6000"
                  aria-label="Site coordinates"
                  className="min-w-52 rounded-lg border border-[#b6d2ca] bg-[#f6f3ea] px-2.5 py-1.5 text-xs"
                  data-testid="input-borewell-coordinates"
                />
              </div>
              <GoogleMapPanel
                query={coordinates.trim() || site.trim() || m.location}
                className="h-48"
              />
              <p className="mt-2 text-xs leading-5 text-[#526169]">
                Add the exact coordinates or address, then open Google Maps to
                confirm the farm gate or site entry point.
              </p>
            </div>
            <label className="mt-3 block text-xs font-bold text-[#68777b]">
              Borewell route and site instructions
              <textarea
                value={siteInstructions}
                onChange={(e) => setSiteInstructions(e.target.value)}
                placeholder="Narrow approach road, bore point marking, gate access or local contact"
                rows={3}
                className="mt-1 w-full resize-y rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                data-testid="input-borewell-instructions"
              />
            </label>
            <label className="mt-3 block text-xs font-bold text-[#68777b]">
              Estimated drilling depth (feet)
              <input
                type="number"
                min="1"
                max="1968"
                value={depth}
                onChange={(e) => {
                  const next = Math.max(1, Number(e.target.value) || 1);
                  setDepth(next);
                  setCasingDepth((current) => Math.min(current, next));
                }}
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                data-testid="input-drilling-depth"
              />
            </label>
            <label className="mt-3 block text-xs font-bold text-[#68777b]">
              Casing pipe depth (feet)
              <input
                type="number"
                min="0"
                max={depth}
                value={casingDepth}
                onChange={(e) =>
                  setCasingDepth(
                    Math.min(depth, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                data-testid="input-borewell-casing-depth"
              />
            </label>
            <fieldset className="mt-4 rounded-2xl border border-[#e0be72] bg-[#fff8e8] p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-[.14em] text-[#895718]">
                Casing pipe price
              </legend>
              <div className="mt-1 grid gap-2">
                {borewellCasingOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setCasingId(option.id)}
                    aria-pressed={casingId === option.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left ${casingId === option.id ? "border-[#e69128] bg-[#ffe4ad]" : "border-[#ded9ca] bg-[#fbf9f2]"}`}
                    data-testid={`button-borewell-casing-${option.id}`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-[#18303a]">
                        {option.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#68777b]">
                        {option.detail}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-[#1a7d78]">
                      {money(option.rate)}/ft
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#b6d2ca] bg-[#e6f2ee] p-3 text-sm">
              <input
                type="checkbox"
                checked={addSurvey}
                onChange={(e) => setAddSurvey(e.target.checked)}
                className="mt-1 accent-[#1a7d78]"
                data-testid="checkbox-add-water-survey"
              />
              <span>
                <span className="block font-bold text-[#18303a]">
                  Add water-point survey{" "}
                  <span className="font-normal">(+{money(surveyFee)})</span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#526169]">
                  Request a site assessment before drilling starts.
                </span>
              </span>
            </label>
            <div className="mt-5 space-y-2 border-t border-[#ded9ca] pt-4 text-sm">
              <div className="flex justify-between">
                <span>
                  Drilling · {depth.toLocaleString()} ft × {money(rate)}
                </span>
                <span>{money(drilling)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>
                  Casing · {casingDepth.toLocaleString()} ft ×{" "}
                  {money(casing.rate)}
                </span>
                <span className="shrink-0">{money(casingCost)}</span>
              </div>
              {addSurvey && (
                <div className="flex justify-between">
                  <span>Water-point survey</span>
                  <span>{money(surveyFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#ded9ca] pt-3 font-bold">
                <span>Estimated RigLogix total</span>
                <span>{money(total)}</span>
              </div>
              <div className="flex justify-between gap-3 font-bold text-[#895718]">
                <span>Minimum wallet reserve before request</span>
                <span className="shrink-0">{money(walletReserve)}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs text-[#68777b]">
                <span>Cancellation charge after owner accepts</span>
                <span className="shrink-0">{money(cancellationPenalty)}</span>
              </div>
            </div>
            {validationError && (
              <p
                className="mt-3 rounded-xl bg-[#fff0e8] p-2.5 text-xs font-semibold text-[#a44719]"
                role="alert"
              >
                {validationError}
              </p>
            )}
            <Button
              onClick={book}
              className="mt-6 w-full py-3"
              data-testid="button-confirm-borewell"
            >
              Request depth-based quote <ArrowRight size={16} />
            </Button>
            <p className="mt-3 text-center text-[11px] text-[#87918d]">
              Final bore depth is confirmed on site. After the owner accepts,
              cancellation is locked and the cancellation charge is deducted
              from the wallet reserve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BorewellEstimator({ onSurvey }: { onSurvey: () => void }) {
  const [, setLocation] = useLocation();
  const rigs = machineryForSession().filter(
    (m) => m.category === "Borewell Rig" && m.verified,
  );
  const [selectedRigId, setSelectedRigId] = useState(rigs[0]?.id || "");
  const [depth, setDepth] = useState(850);
  const [casingDepth, setCasingDepth] = useState(80);
  const [terrainId, setTerrainId] = useState("hard");
  const [casingId, setCasingId] = useState("pvc");
  const terrain =
    borewellTerrainOptions.find((x) => x.id === terrainId) ||
    borewellTerrainOptions[0];
  const casing =
    borewellCasingOptions.find((x) => x.id === casingId) ||
    borewellCasingOptions[0];
  const selectedRig = rigs.find((x) => x.id === selectedRigId) || rigs[0];
  const drilling = depth * terrain.rate;
  const casingCost = casingDepth * casing.rate;
  const setup = 7500;
  const flushing = 2500;
  const subtotal = setup + drilling + casingCost + flushing;
  const platformFee = Math.round(subtotal * 0.035);
  const total = subtotal + platformFee;
  const brokerCut = Math.round(subtotal * 0.3);
  const book = () => {
    if (!selectedRig) return;
    const b: Booking = {
      id: `BORE-${Math.floor(1000 + Math.random() * 8999)}`,
      machineryId: selectedRig.id,
      machineryTitle: selectedRig.title,
      ownerName: selectedRig.owner,
      customerName: activeAccountName(),
      location: selectedRig.location,
      date: dateText(),
      durationHours: 0,
      baseCost: subtotal,
      platformFee,
      totalCost: total,
      ownerEarnings: subtotal,
      status: "PENDING",
      billingUnit: "foot",
      quantity: depth,
      unitRate: terrain.rate,
      serviceType: `Borewell drilling · ${terrain.name} · ${casing.name}`,
    };
    const old = read<Booking[]>(keyFor("bookings"), bookingsForSession());
    write(keyFor("bookings"), [b, ...old]);
    setLocation("/customer/bookings");
  };
  return (
    <section
      id="borewell-estimator"
      className="mb-7 overflow-hidden rounded-[26px] border border-[#2b3950] bg-[#101827] text-[#f6f3ea]"
    >
      <div className="border-b border-[#2b3950] p-5 md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-[#20c8b0]">
              <Hammer size={14} /> Borewell drilling & groundwater hub
            </p>
            <h2 className="mt-2 display text-2xl font-bold md:text-3xl">
              Borewell cost estimator
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#aab6c8]">
              Build a transparent estimate from target drilling depth, terrain
              and casing. The rig is priced by feet, not by hours.
            </p>
          </div>
          <div className="rounded-xl border border-[#1a655f] bg-[#123d3c] px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-[#20c8b0]">
            Market rates
            <br />
            <span className="text-[#f6f3ea]">INR estimate</span>
          </div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="rounded-2xl bg-[#182337] p-4">
            <div className="flex justify-between text-sm font-bold">
              <span>Target drilling depth</span>
              <span className="text-xl text-[#20c8b0]">
                {depth.toLocaleString()} feet
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="1500"
              step="10"
              value={depth}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDepth(next);
                setCasingDepth(Math.min(casingDepth, next));
              }}
              className="mt-4 w-full accent-[#20c8b0]"
              data-testid="input-target-depth"
            />
            <div className="mt-2 flex justify-between text-[11px] text-[#8290a7]">
              <span>100 ft</span>
              <span>1,500 ft rated</span>
            </div>
          </label>
          <label className="rounded-2xl bg-[#182337] p-4">
            <div className="flex justify-between text-sm font-bold">
              <span>Casing pipe depth</span>
              <span className="text-xl text-[#f68a1d]">
                {casingDepth.toLocaleString()} feet
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={depth}
              step="10"
              value={casingDepth}
              onChange={(e) => setCasingDepth(Number(e.target.value))}
              className="mt-4 w-full accent-[#f68a1d]"
              data-testid="input-casing-depth"
            />
            <div className="mt-2 flex justify-between text-[11px] text-[#8290a7]">
              <span>0 ft</span>
              <span>{depth.toLocaleString()} ft max</span>
            </div>
          </label>
        </div>
      </div>
      <div className="grid gap-6 p-5 md:p-7">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.14em] text-[#8290a7]">
                Geological terrain
              </p>
              <p className="mt-1 text-sm text-[#aab6c8]">
                Select the rig method and market rate for your ground.
              </p>
            </div>
            <Badge tone="teal">{terrain.rig}</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {borewellTerrainOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setTerrainId(option.id)}
                className={`rounded-xl border p-3 text-left transition-all ${terrainId === option.id ? "border-[#f68a1d] bg-[#2a2530]" : "border-[#28354b] bg-[#182337] hover:border-[#52708d]"}`}
                data-testid={`button-terrain-${option.id}`}
              >
                <span className="block text-sm font-bold">{option.name}</span>
                <span className="mt-1 block text-xs text-[#8290a7]">
                  {option.rig}
                </span>
                <span
                  className={`mt-2 block font-bold ${terrainId === option.id ? "text-[#20c8b0]" : "text-[#dbe3ed]"}`}
                >
                  {money(option.rate)}
                  <span className="text-xs font-normal">/ft</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[.14em] text-[#8290a7]">
              Casing pipe specification
            </p>
            <p className="mt-1 text-sm text-[#aab6c8]">
              Choose the casing finish included in the estimate.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {borewellCasingOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => setCasingId(option.id)}
                className={`rounded-xl border p-3 text-left transition-all ${casingId === option.id ? "border-[#f68a1d] bg-[#2a2530]" : "border-[#28354b] bg-[#182337] hover:border-[#52708d]"}`}
                data-testid={`button-casing-${option.id}`}
              >
                <span className="block text-sm font-bold">{option.name}</span>
                <span className="mt-1 block text-xs text-[#8290a7]">
                  {option.detail}
                </span>
                <span
                  className={`mt-2 block font-bold ${casingId === option.id ? "text-[#20c8b0]" : "text-[#dbe3ed"}`}
                >
                  {money(option.rate)}
                  <span className="text-xs font-normal">/ft</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#28354b] bg-[#182337] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#20c8b0]">
                Transparent upfront price breakdown
              </p>
              <p className="mt-1 text-xs text-[#8290a7]">
                Estimated for {depth.toLocaleString()} ft · {casingDepth} ft
                casing
              </p>
            </div>
            <Gauge className="text-[#f68a1d]" size={22} />
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 text-[#c2ccda]">
              <span>Base rig mobilization & hydraulic setup</span>
              <span className="shrink-0">{money(setup)}</span>
            </div>
            <div className="flex justify-between gap-4 text-[#c2ccda]">
              <span>
                Drilling ({depth.toLocaleString()} ft × {money(terrain.rate)}
                /ft)
              </span>
              <span className="shrink-0">{money(drilling)}</span>
            </div>
            <div className="flex justify-between gap-4 text-[#c2ccda]">
              <span>
                Casing pipe ({casingDepth} ft × {money(casing.rate)}/ft)
              </span>
              <span className="shrink-0">{money(casingCost)}</span>
            </div>
            <div className="flex justify-between gap-4 text-[#c2ccda]">
              <span>Compressor air flushing & heavy well cap</span>
              <span className="shrink-0">{money(flushing)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-[#2b3950] pt-3 text-lg font-bold">
              <span>Total estimated cost</span>
              <span className="shrink-0 text-[#f68a1d]">{money(total)}</span>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#123d3c] p-3 text-sm font-bold text-[#20c8b0]">
            Estimated farmer savings: {money(brokerCut)} vs local broker cut
            (30%)
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              onClick={book}
              className="w-full py-3"
              data-testid="button-book-estimate"
            >
              Book rig for this estimate ({depth} ft) <ArrowRight size={15} />
            </Button>
            <Button
              variant="ghost"
              onClick={onSurvey}
              className="w-full border-[#52708d] bg-[#182337] text-[#f6f3ea]"
              data-testid="button-estimator-survey"
            >
              <MapPin size={15} /> Water point survey
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[.14em] text-[#8290a7]">
                Nearby verified borewell rigs
              </p>
              <p className="mt-1 text-sm text-[#aab6c8]">
                {rigs.length} operators match this estimate
              </p>
            </div>
            <ShieldCheck className="text-[#20c8b0]" size={22} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {rigs.map((rig) => (
              <button
                type="button"
                key={rig.id}
                onClick={() => setSelectedRigId(rig.id)}
                className={`rounded-2xl border p-4 text-left transition-all ${selectedRigId === rig.id ? "border-[#20c8b0] bg-[#123d3c]" : "border-[#28354b] bg-[#182337] hover:border-[#52708d]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="teal">
                    {rig.sector} · {rig.category}
                  </Badge>
                  <span className="text-xs font-bold text-[#20c8b0]">
                    {rig.distanceKm} km
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold">{rig.title}</p>
                <p className="mt-1 text-xs text-[#aab6c8]">
                  {rig.owner} · {rig.location}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-[#f6b73c]">
                    <Star size={12} className="fill-[#f6b73c]" />
                    {rig.rating}
                  </span>
                  <span className="text-[#8290a7]">
                    {selectedRigId === rig.id
                      ? "Selected for booking"
                      : "Select rig"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MachineryPageV2() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [radius, setRadius] = useState(30);
  const [selected, setSelected] = useState<{
    machine: Machinery;
    ownerUnits: Machinery[];
  } | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const machinery = machineryForSession();
  const equipmentOptions = Array.from(
    new Set(
      machinery
        .filter((m) => sector === "All" || m.sector === sector)
        .map((m) => m.category),
    ),
  );
  const filtered = machinery.filter(
    (m) =>
      (sector === "All" || m.sector === sector) &&
      (equipment === "All" || m.category === equipment) &&
      m.distanceKm <= radius &&
      `${m.title} ${m.owner} ${m.location} ${m.sector} ${m.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const grouped = Array.from(
    filtered.reduce<Map<string, Machinery[]>>((groups, item) => {
      const key =
        item.category === "Borewell Rig"
          ? `${item.category}:${item.title}`
          : item.category;
      groups.set(key, [...(groups.get(key) || []), item]);
      return groups;
    }, new Map()),
  ).map(([key, ownerUnits]) => ({
    key,
    ownerUnits,
    machine:
      ownerUnits.find((unit) => unit.status === "READY") || ownerUnits[0],
  }));
  const reset = () => {
    setRadius(50);
    setQuery("");
    setSector("All");
    setEquipment("All");
  };
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Equipment exchange"
        title="Find the right machine."
        detail="Browse by sector, then narrow to the equipment your job needs. Hourly equipment stays hourly; borewell drilling is priced by completed feet."
      />
      <section className="mb-7 overflow-hidden rounded-[24px] border border-[#b6d2ca] bg-[#e6f2ee]">
        <div className="grid gap-5 p-5 md:grid-cols-[1.05fr_.95fr] md:p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1a7d78] text-[#f6f3ea]">
                <Compass size={18} />
              </span>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#1a7d78]">
                Specialist services
              </p>
            </div>
            <h2 className="display mt-3 text-2xl font-bold">
              Borewell & water-point desk
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#35565c]">
              The drilling rig is quoted by depth in feet, not by hours. If you
              are still deciding where to drill, request a water-point survey
              first and keep the survey and rig booking together in My bookings.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setSector("Water & Drilling");
                  setEquipment("Borewell Rig");
                }}
                data-testid="button-browse-borewell"
              >
                <Search size={15} /> Browse borewell rigs
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowSurvey(true)}
                data-testid="button-water-survey"
              >
                <MapPin size={15} /> Request water-point survey
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#b6d2ca] bg-[#f6f3ea]/75 p-4">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                Borewell drilling
              </p>
              <p className="mt-2 display text-2xl font-bold">
                ₹145{" "}
                <span className="text-sm font-normal text-[#68777b]">/ ft</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-[#68777b]">
                Depth-based estimate with no hourly counter.
              </p>
            </div>
            <div className="rounded-2xl border border-[#b6d2ca] bg-[#f6f3ea]/75 p-4">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                Water-point survey
              </p>
              <p className="mt-2 display text-2xl font-bold">
                ₹3,500{" "}
                <span className="text-sm font-normal text-[#68777b]">flat</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-[#68777b]">
                Site assessment request before drilling.
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-[#87918d]" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by equipment, sector or owner..."
            className="w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ee8b18]"
            data-testid="input-machinery-search"
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#ded9ca] bg-[#f6f3ea] px-3 text-xs font-bold text-[#68777b]">
          <span>Sector</span>
          <select
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setEquipment("All");
            }}
            className="min-w-32 bg-transparent text-sm font-semibold text-[#18303a] outline-none"
            data-testid="select-sector"
          >
            <option>All</option>
            {sectorOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#ded9ca] bg-[#f6f3ea] px-3 text-xs font-bold text-[#68777b]">
          <span>Available equipment</span>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="min-w-32 bg-transparent text-sm font-semibold text-[#18303a] outline-none"
            data-testid="select-equipment"
          >
            <option>All</option>
            {equipmentOptions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-[#f6f3ea] px-3 text-xs font-bold text-[#68777b]">
          <SlidersHorizontal size={15} />
          Radius {radius}km
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-20 accent-[#ee8b18]"
            data-testid="input-radius"
          />
        </label>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-[#68777b]">
          <span className="font-bold text-[#18303a]">
            {grouped.length} equipment types
          </span>{" "}
          · {filtered.length} owner units match your brief
        </p>
        <span className="text-xs text-[#87918d]">
          Owner-published inventory
        </span>
      </div>
      {grouped.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(({ key, machine, ownerUnits }) => (
            <MachineryCard
              key={key}
              m={machine}
              unitCount={ownerUnits.length}
              onOpen={() => setSelected({ machine, ownerUnits })}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No machines in that radius"
          detail="Try expanding the radius or clearing your search."
          action={
            <Button variant="ghost" onClick={reset}>
              Reset filters
            </Button>
          }
        />
      )}{" "}
      {selected &&
        (selected.machine.category === "Borewell Rig" ? (
          <BorewellModal
            m={selected.machine}
            onClose={() => setSelected(null)}
          />
        ) : (
          <MachineryModal
            m={selected.machine}
            ownerUnits={selected.ownerUnits}
            onClose={() => setSelected(null)}
          />
        ))}{" "}
      {showSurvey && <WaterSurveyModal onClose={() => setShowSurvey(false)} />}
    </AppShell>
  );
}

function MachineryModal({
  m,
  ownerUnits = [m],
  onClose,
}: {
  m: Machinery;
  ownerUnits?: Machinery[];
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [date, setDate] = useState(dateText());
  const [shift, setShift] = useState("09:00 AM (Day Shift)");
  const [startTime, setStartTime] = useState("09:00");
  const [jobSite, setJobSite] = useState("");
  const [hours, setHours] = useState(8);
  const [units, setUnits] = useState(1);
  const [selectedUnitId, setSelectedUnitId] = useState(m.id);
  const [material, setMaterial] = useState<"none" | "sand" | "small-stones">(
    "none",
  );
  const [stoneSize, setStoneSize] = useState("10");
  const selectedUnit =
    ownerUnits.find((unit) => unit.id === selectedUnitId) || m;
  const isTipper = selectedUnit.category === "Tipper Truck";
  const selectedUnitReady = selectedUnit.status === "READY";
  const firstAvailableDate = selectedUnitReady ? dateText() : dateOffset(8);
  const baseMobilization = 3000 * units;
  const workCost = selectedUnit.baseRateHourly * hours * units;
  const fuelSurcharge = Math.round(hours * 133.33 * units);
  const baseCost = baseMobilization + workCost + fuelSurcharge;
  const fee = baseCost * 0.035;
  const total = baseCost + fee;
  const broker = baseCost * 1.3;
  const materialLabel =
    material === "sand"
      ? "Sand"
      : material === "small-stones"
        ? `Small stones · ${stoneSize} mm`
        : "Tipper load material not specified";
  const book = () => {
    const b: Booking = {
      id: `JOB-${Math.floor(1000 + Math.random() * 8999)}`,
      machineryId: selectedUnit.id,
      machineryTitle: selectedUnit.title,
      ownerName: selectedUnit.owner,
      customerName: activeAccountName(),
      location: jobSite || selectedUnit.location,
      date,
      durationHours: hours,
      baseCost,
      platformFee: fee,
      totalCost: total,
      ownerEarnings: baseCost,
      status: "PENDING",
      billingUnit: "hour",
      units,
      serviceType: isTipper ? materialLabel : undefined,
      shift,
      startTime,
      jobSite: jobSite || selectedUnit.location,
      baseMobilization,
      fuelSurcharge,
    };
    const old = read<Booking[]>(keyFor("bookings"), bookingsForSession());
    write(keyFor("bookings"), [b, ...old]);
    onClose();
    setLocation("/customer/bookings");
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#18303a]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-[#f6f3ea] p-5 sm:rounded-[28px] md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#1a7d78]">
              {selectedUnit.category} · {selectedUnit.distanceKm} km away
            </p>
            <h2 className="display mt-1 text-2xl font-bold">
              {selectedUnit.title}
            </h2>
            <p className="mt-1 text-sm text-[#68777b]">
              {selectedUnit.owner} · {selectedUnit.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-[#ece8dc]"
            data-testid="button-close-equipment"
            aria-label="Close equipment details"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <img
              src={selectedUnit.image}
              alt={selectedUnit.title}
              className="h-56 w-full rounded-2xl object-cover"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {selectedUnit.specs.map((s) => (
                <div
                  key={s}
                  className="rounded-xl bg-[#ece8dc] p-2 text-center text-xs font-semibold"
                >
                  {s}
                </div>
              ))}
            </div>
            {ownerUnits.length > 1 && (
              <div className="mt-4 rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                  Choose the owner's vehicle
                </p>
                <div className="mt-3 space-y-2">
                  {ownerUnits.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => {
                        setSelectedUnitId(unit.id);
                        if (unit.status !== "READY") setDate(dateOffset(8));
                      }}
                      className={`w-full rounded-xl border p-3 text-left ${selectedUnit.id === unit.id ? "border-[#ee8b18] bg-[#fff4df]" : "border-[#ded9ca] bg-[#f6f3ea]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">{unit.owner}</p>
                          <p className="mt-1 text-xs text-[#68777b]">
                            {unit.title} · {unit.location}
                          </p>
                        </div>
                        <Badge tone={unit.status === "READY" ? "good" : "warn"}>
                          {unit.status === "READY"
                            ? "Available"
                            : "Service / repair"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#526169]">
                        {unit.availability} · {money(unit.baseRateHourly)}/hr
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-2xl border border-[#d7edeb] bg-[#e6f2ee] p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#1a7d78]">
                <CircleHelp size={15} /> In plain English
              </p>
              <p className="mt-2 text-sm leading-6 text-[#35565c]">
                {selectedUnit.plainEnglishGuide}
              </p>
              <p className="mt-3 border-t border-[#b6d2ca] pt-3 text-xs font-bold uppercase tracking-[.12em] text-[#1a7d78]">
                Best for
              </p>
              <p className="mt-1 text-sm font-semibold text-[#35565c]">
                {selectedUnit.primaryApplication}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[#68777b]">Owner rate</p>
                <p className="display text-2xl font-bold">
                  {money(selectedUnit.baseRateHourly)}
                  <span className="text-sm font-normal text-[#68777b]">
                    {" "}
                    / hr
                  </span>
                </p>
              </div>
              <Badge tone={selectedUnitReady ? "good" : "warn"}>
                {selectedUnit.availability}
              </Badge>
            </div>
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#68777b]">
                Rental date
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  [dateOffset(0), `Today, ${dateLabel(dateOffset(0))}`],
                  [dateOffset(1), `Tomorrow, ${dateLabel(dateOffset(1))}`],
                  [dateOffset(2), `In 2 days, ${dateLabel(dateOffset(2))}`],
                  [nextMonday(), `Next Monday, ${dateLabel(nextMonday())}`],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setDate(value)}
                    disabled={value < firstAvailableDate}
                    className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${date === value ? "border-[#ee8b18] bg-[#ee8b18] text-[#18303a]" : "border-[#d5d0c2] bg-[#f6f3ea] text-[#68777b] hover:border-[#ee8b18]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs font-bold text-[#68777b]">
                Selected date
                <input
                  type="date"
                  min={firstAvailableDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                  data-testid="input-rental-date"
                />
              </label>
            </div>
            <div className="mt-5">
              <p className="flex items-center gap-2 text-sm font-bold text-[#18303a]">
                <span className="text-[#ee8b18]">◷</span> Operating shift / time
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["07:00 AM (Morning Shift)", "07:00"],
                  ["09:00 AM (Day Shift)", "09:00"],
                  ["01:00 PM (Afternoon)", "13:00"],
                  ["06:00 PM (Night Shift)", "18:00"],
                ].map(([label, value]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      setShift(label);
                      setStartTime(value);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${shift === label ? "border-[#ee8b18] bg-[#ee8b18] text-[#18303a]" : "border-[#d5d0c2] bg-[#f6f3ea] text-[#68777b] hover:border-[#ee8b18]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs font-bold text-[#68777b]">
                Starting time
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#ee8b18] bg-[#f6f3ea] p-2.5 text-sm"
                  data-testid="input-start-time"
                />
              </label>
            </div>
            <label className="mt-5 block text-xs font-bold text-[#68777b]">
              Job site / farm location
              <input
                value={jobSite}
                onChange={(e) => setJobSite(e.target.value)}
                placeholder="Specify destination address, farm sector or plot"
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                data-testid="input-job-site"
              />
            </label>
            <div className="mt-3">
              <GoogleMapPanel query={jobSite || selectedUnit.location} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#68777b]">
                Number of units
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={units}
                  onChange={(e) =>
                    setUnits(
                      Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                  data-testid="input-unit-count"
                />
              </label>
              <label className="block text-xs font-bold text-[#68777b]">
                Operating hours per unit
                <input
                  type="number"
                  min="1"
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                  data-testid="input-operating-hours"
                />
              </label>
            </div>
            {isTipper && (
              <div className="mt-4 rounded-2xl border border-[#e8c98e] bg-[#fff8e9] p-4">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8e5811]">
                  Tipper load details
                </p>
                <p className="mt-1 text-sm text-[#526169]">
                  Tell the operator what material this lorry should carry.
                </p>
                <label className="mt-3 block text-xs font-bold text-[#68777b]">
                  Material
                  <select
                    value={material}
                    onChange={(e) =>
                      setMaterial(
                        e.target.value as "none" | "sand" | "small-stones",
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                    data-testid="select-tipper-material"
                  >
                    <option value="none">Choose material</option>
                    <option value="sand">Sand</option>
                    <option value="small-stones">Small stones</option>
                  </select>
                </label>
                {material === "small-stones" && (
                  <label className="mt-3 block text-xs font-bold text-[#68777b]">
                    Small stone size
                    <select
                      value={stoneSize}
                      onChange={(e) => setStoneSize(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#f6f3ea] p-2.5 text-sm"
                      data-testid="select-stone-size"
                    >
                      <option value="6">6 mm</option>
                      <option value="10">10 mm</option>
                      <option value="12">12 mm</option>
                      <option value="20">20 mm</option>
                      <option value="40">40 mm</option>
                    </select>
                  </label>
                )}
              </div>
            )}
            <div className="mt-5 rounded-2xl bg-[#182337] p-4 text-sm text-[#dbe3ed]">
              <p className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-[#20c8b0]">
                Upfront transparent pricing
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Base mobilization</span>
                  <span>{money(baseMobilization)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    Work cost ({units} {units > 1 ? "units" : "unit"} × {hours}
                    h)
                  </span>
                  <span>{money(workCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fuel index surcharge</span>
                  <span>{money(fuelSurcharge)}</span>
                </div>
                {isTipper && material !== "none" && (
                  <div className="flex justify-between gap-4 border-t border-[#2b3950] pt-2">
                    <span>Load request</span>
                    <span className="text-right">{materialLabel}</span>
                  </div>
                )}
                <div className="mt-3 flex justify-between border-t border-[#2b3950] pt-3 text-base font-bold">
                  <span>Total booking estimate</span>
                  <span className="text-[#f68a1d]">{money(total)}</span>
                </div>
                <p className="text-xs text-[#a9b7c8]">
                  Taxes and applicable service charges are included in this
                  total.
                </p>
              </div>
              <div className="mt-4 rounded-xl bg-[#123d3c] p-3 text-sm font-bold text-[#20c8b0]">
                Saved ≈ {money(broker - total)} vs traditional 30% broker
                commission
              </div>
            </div>
            <Button
              onClick={book}
              className="mt-6 w-full py-3"
              data-testid="button-confirm-booking"
            >
              <Radio size={16} /> Initiate rental request{" "}
              <span className="hidden sm:inline">(Status: Pending)</span>
              <ArrowRight size={16} />
            </Button>
            <p className="mt-3 text-center text-[11px] text-[#87918d]">
              The owner confirms availability before mobilization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>(() =>
    read<Auction[]>(keyFor("auctions"), auctionsForSession()),
  );
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [bid, setBid] = useState("");
  const persist = (a: Auction[]) => {
    setAuctions(a);
    write(keyFor("auctions"), a);
  };
  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const a: Auction = {
      id: `auc-${Date.now()}`,
      title: String(f.get("title")),
      category: String(f.get("category")),
      location: String(f.get("location")),
      description: String(f.get("description")),
      requiredDate: String(f.get("date")),
      maxPrice: Number(f.get("max")),
      lowestBid: Number(f.get("max")),
      bidCount: 0,
      status: "OPEN",
      unitLabel: "hour",
      timeLeft: "new",
      bids: [],
    };
    persist([a, ...auctions]);
    setShow(false);
  };
  const submit = () => {
    if (!selected) return;
    const n = Number(bid);
    if (!n || n >= selected.lowestBid) {
      alert("Enter a bid lower than the current lowest bid.");
      return;
    }
    const b: Bid = {
      id: `b-${Date.now()}`,
      operator: "Equipment owner",
      equipment: "Equipment submitted with bid",
      amount: n,
      eta: "Pending",
      rating: 0,
      distance: 0,
    };
    persist(
      auctions.map((a) =>
        a.id === selected.id
          ? {
              ...a,
              lowestBid: n,
              bidCount: a.bidCount + 1,
              bids: [b, ...a.bids],
            }
          : a,
      ),
    );
    setSelected({
      ...selected,
      lowestBid: n,
      bidCount: selected.bidCount + 1,
      bids: [b, ...selected.bids],
    });
    setBid("");
  };
  const accept = () => {
    if (!selected || !selected.bids[0]) return;
    const b = selected.bids[0];
    const booking: Booking = {
      id: `JOB-${Math.floor(1000 + Math.random() * 8999)}`,
      machineryId: "m-101",
      machineryTitle: b.equipment,
      ownerName: b.operator,
      customerName: activeAccountName(),
      location: selected.location,
      date: selected.requiredDate,
      durationHours: 8,
      baseCost: b.amount * 8,
      platformFee: b.amount * 8 * 0.035,
      totalCost: b.amount * 8 * 1.035,
      ownerEarnings: b.amount * 8,
      status: "CONFIRMED",
    };
    write(keyFor("bookings"), [
      booking,
      ...read<Booking[]>(keyFor("bookings"), bookingsForSession()),
    ]);
    persist(
      auctions.map((a) =>
        a.id === selected.id ? { ...a, status: "AWARDED" } : a,
      ),
    );
    setSelected(null);
    alert(`Booking ${booking.id} created from accepted bid.`);
  };
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Let the market work"
        title="Reverse auctions."
        detail="Post bulk vehicle and equipment requirements, then let verified operators compete on a clear project or route total."
        action={
          <Button onClick={() => setShow(true)}>
            <Plus size={16} /> Create auction
          </Button>
        }
      />
      <div className="mb-5 rounded-2xl border border-[#b6d2ca] bg-[#e6f2ee] p-4 text-sm text-[#35565c]">
        <span className="font-bold text-[#1a7d78]">Marketplace activity:</span>{" "}
        agriculture drilling, bulk logistics and construction packages are shown
        with live-style bid counts, time left and savings against your ceiling
        target.
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {auctions.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.status === "OPEN" ? "teal" : "neutral"}>
                    {a.category}
                  </Badge>
                  <span className="text-xs font-bold text-[#1a7d78]">
                    ◷ {a.timeLeft || "open"}
                  </span>
                </div>
                <h2 className="display mt-3 text-xl font-bold">{a.title}</h2>
                <p className="mt-1 text-sm text-[#68777b]">{a.location}</p>
              </div>
              <Badge tone={a.status === "OPEN" ? "good" : "neutral"}>
                {a.status}
              </Badge>
            </div>
            <p className="mt-5 text-sm leading-6 text-[#526169]">
              {a.description}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#ded9ca] pt-4">
              <div>
                <p className="text-xs text-[#68777b]">Ceiling target</p>
                <p className="font-bold">{money(a.maxPrice)}</p>
              </div>
              <div className="rounded-xl bg-[#d7edeb] p-3">
                <p className="text-xs text-[#1a7d78]">Lowest bid</p>
                <p className="font-bold text-[#1a7d78]">{money(a.lowestBid)}</p>
                <p className="text-xs font-bold text-[#1a7d78]">
                  Save {money(a.maxPrice - a.lowestBid)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-[#68777b]">
                <Users size={15} />
                {a.bidCount} bids · {a.unitLabel || "hour"} total
              </span>
              <Button variant="ghost" onClick={() => setSelected(a)}>
                Review bids <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {show && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#18303a]/60 p-5">
          <form
            onSubmit={create}
            className="w-full max-w-lg rounded-[24px] bg-[#f6f3ea] p-6"
          >
            <div className="flex justify-between">
              <h2 className="display text-2xl font-bold">
                Create a reverse auction
              </h2>
              <button type="button" onClick={() => setShow(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <input
                name="title"
                required
                placeholder="Auction title"
                className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  name="category"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                >
                  <option>Agriculture</option>
                  <option>Logistics</option>
                  <option>Construction</option>
                  <option>Excavator</option>
                  <option>Tipper Truck</option>
                  <option>Borewell Rig</option>
                </select>
                <input
                  name="location"
                  required
                  placeholder="Site location"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
              </div>
              <textarea
                name="description"
                required
                placeholder="What does the operator need to know?"
                className="min-h-24 rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  name="date"
                  required
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
                <input
                  type="number"
                  name="max"
                  required
                  placeholder="Ceiling target ₹"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
              </div>
            </div>
            <Button className="mt-5 w-full">
              Publish auction <ArrowRight size={16} />
            </Button>
          </form>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#18303a]/60 p-5">
          <div className="w-full max-w-lg rounded-[24px] bg-[#f6f3ea] p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#1a7d78]">
                  Bid room · {selected.category}
                </p>
                <h2 className="display mt-1 text-2xl font-bold">
                  {selected.title}
                </h2>
              </div>
              <button onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-[#e6f2ee] p-4">
              <p className="text-xs text-[#1a7d78]">Current lowest bid</p>
              <p className="display text-3xl font-bold">
                {money(selected.lowestBid)}
                <span className="text-sm font-normal">
                  {" "}
                  / {selected.unitLabel || "hour"}
                </span>
              </p>
              <p className="mt-1 text-xs text-[#1a7d78]">
                Ceiling {money(selected.maxPrice)} · save{" "}
                {money(selected.maxPrice - selected.lowestBid)}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {selected.bids.length ? (
                selected.bids.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{b.operator}</p>
                      <p className="text-xs text-[#68777b]">
                        {b.equipment} · {b.distance} km · ETA {b.eta}
                      </p>
                    </div>
                    <p className="font-bold">{money(b.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-[#68777b]">
                  No bids yet. Be the first operator to set a price.
                </p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <input
                type="number"
                value={bid}
                onChange={(e) => setBid(e.target.value)}
                placeholder={`Your lower bid / ${selected.unitLabel || "hour"}`}
                className="min-w-0 flex-1 rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              />
              <Button onClick={submit}>Submit bid</Button>
            </div>
            {selected.bids.length > 0 && (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={accept}
              >
                Accept lowest bid & create booking
              </Button>
            )}
            <p className="mt-4 text-center text-[11px] text-[#87918d]">
              Operator availability is confirmed after bid acceptance.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RadarPage() {
  const [radius, setRadius] = useState(25);
  const [selected, setSelected] = useState<Machinery | null>(null);
  const items = machineryForSession().filter((m) => m.distanceKm <= radius);
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Proximity search"
        title="Equipment radar."
        detail="A radius view of owner-published inventory around your selected site. Location results reflect listing information, not live GPS or telematics."
        action={
          <label className="flex items-center gap-3 rounded-xl border border-[#ded9ca] bg-[#fbf9f2] px-3 py-2 text-sm font-bold">
            <MapPin size={16} className="text-[#1a7d78]" /> {radius} km
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="accent-[#ee8b18]"
            />
          </label>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <GoogleMapPanel
            query={selected?.location || "Bengaluru, India"}
            className="h-[480px]"
          />
          <p className="mt-2 text-xs text-[#68777b]">
            Select an owner unit to focus Google Maps on its published service
            area. Exact live GPS remains private.
          </p>
        </div>
        <div className="space-y-3">
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-left hover:border-[#ee8b18]"
              data-testid={`card-radar-${m.id}`}
            >
              <img
                src={m.image}
                className="h-16 w-20 rounded-xl object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="truncate text-sm font-bold">{m.title}</p>
                  <span className="mono text-xs">{m.distanceKm}km</span>
                </div>
                <p className="mt-1 text-xs text-[#68777b]">{m.owner}</p>
                <div className="mt-2 flex gap-2">
                  <Badge tone="good">{m.availability}</Badge>
                  {m.verified && <Badge tone="teal">Verified</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <MachineryModal m={selected} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}

function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>(() =>
    read(keyFor("bookings"), bookingsForSession()),
  );
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const statuses: BookingStatus[] = [
    "PENDING",
    "CONFIRMED",
    "MOBILIZING",
    "ON SITE",
    "IN PROGRESS",
    "COMPLETED",
  ];
  const advance = (b: Booking) => {
    const idx = statuses.indexOf(b.status);
    if (idx >= statuses.length - 1) return;
    const n = { ...b, status: statuses[idx + 1] };
    const list = bookings.map((x) => (x.id === b.id ? n : x));
    setBookings(list);
    write(keyFor("bookings"), list);
  };
  const review = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reviewing) return;
    const f = new FormData(e.currentTarget);
    const n = {
      ...reviewing,
      review: { rating: Number(f.get("rating")), text: String(f.get("text")) },
    };
    const list = bookings.map((x) => (x.id === n.id ? n : x));
    setBookings(list);
    write(keyFor("bookings"), list);
    setReviewing(null);
  };
  return (
    <AppShell role="customer">
      <PageHead
        eyebrow="Job control"
        title="My bookings."
        detail="A clean handover from request to completed job. Advance milestones as the work moves."
        action={
          <Link href="/customer/machinery">
            <Button>
              <Plus size={16} /> New booking
            </Button>
          </Link>
        }
      />
      <div className="space-y-4">
        {bookings.length ? (
          bookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-5"
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-xs text-[#68777b]">{b.id}</span>
                    <Badge tone={b.status === "COMPLETED" ? "good" : "warn"}>
                      {b.status}
                    </Badge>
                  </div>
                  <h2 className="display mt-2 text-xl font-bold">
                    {b.machineryTitle}
                  </h2>
                  <p className="mt-1 text-sm text-[#68777b]">
                    {b.ownerName} · {b.location} · {b.date} ·{" "}
                    {bookingMeasure(b)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="display text-xl font-bold">
                    {money(b.totalCost)}
                  </p>
                  <p className="text-xs text-[#68777b]">
                    Customer booking total
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-1 sm:grid-cols-6">
                {statuses.map((s, i) => (
                  <div key={s}>
                    <div
                      className={`h-1.5 rounded-full ${i <= statuses.indexOf(b.status) ? "bg-[#1a7d78]" : "bg-[#ded9ca]"}`}
                    ></div>
                    <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-[#68777b]">
                      {s}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ded9ca] pt-4">
                <div>
                  <CallRelayButton bookingId={b.id} />
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-[#68777b]">
                    <Mic size={11} /> Numbers stay hidden; calls are recorded
                    after consent for safety.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadBondButton
                    bookingData={{
                      bookingId: b.id,
                      ownerName: b.ownerName,
                      customerName: b.customerName || "Arjun Rao (Customer)",
                      serviceDescription: `${b.machineryTitle} - ${b.serviceType || "Equipment Booking"}`,
                      completionDate: b.date,
                      totalAmount: b.totalCost,
                      amountPaid: Math.round(b.totalCost * 0.3),
                      remainingAmount: Math.round(b.totalCost * 0.7),
                      dueDate: "05 Oct 2026",
                    }}
                    variant="outline"
                  />
                  {b.status !== "COMPLETED" && (
                    <Button
                      variant="ghost"
                      onClick={() => advance(b)}
                      data-testid={`button-advance-${b.id}`}
                    >
                      Advance milestone <ArrowRight size={14} />
                    </Button>
                  )}
                  {b.status === "COMPLETED" && !b.review && (
                    <Button onClick={() => setReviewing(b)}>
                      <Star size={14} /> Leave review
                    </Button>
                  )}
                  {b.review && (
                    <span className="flex items-center gap-1 rounded-xl bg-[#f9e3ba] px-3 py-2 text-xs font-bold">
                      <Star
                        size={13}
                        className="fill-[#ee8b18] text-[#ee8b18]"
                      />{" "}
                      {b.review.rating}.0 reviewed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="Your job board is clear"
            detail="Book a machine from the exchange and its full milestone timeline will appear here."
            action={
              <Link href="/customer/machinery">
                <Button>Find equipment</Button>
              </Link>
            }
          />
        )}
      </div>
      {reviewing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#18303a]/60 p-5">
          <form
            onSubmit={review}
            className="w-full max-w-md rounded-3xl bg-[#f6f3ea] p-6"
          >
            <div className="flex justify-between">
              <h2 className="display text-2xl font-bold">How did it go?</h2>
              <button type="button" onClick={() => setReviewing(null)}>
                <X size={20} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-bold">
              Rating
              <select
                name="rating"
                className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3"
              >
                <option value="5">5 · Excellent</option>
                <option value="4">4 · Solid work</option>
                <option value="3">3 · Could be better</option>
              </select>
            </label>
            <textarea
              name="text"
              required
              placeholder="A useful note for the operator..."
              className="mt-3 min-h-28 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
            />
            <Button className="mt-4 w-full">
              Publish review <Check size={15} />
            </Button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function OwnerDashboard() {
  const fleet = read<FleetItem[]>(keyFor("fleet"), fleetForSession());
  const jobs = read<Booking[]>(keyFor("bookings"), bookingsForSession());
  const activeJobs = jobs.filter((job) => job.status !== "COMPLETED");
  return (
    <AppShell role="owner">
      <PageHead
        eyebrow="Owner operations"
        title="Your workspace."
        detail="Manage the equipment and jobs you add to RigLogix."
        action={
          <Link href="/owner/fleet">
            <Button>
              <Plus size={16} /> Add equipment
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Fleet items"
          value={String(fleet.length)}
          detail="Saved on this device"
          icon={Gauge}
          accent="teal"
        />
        <Stat
          label="Active jobs"
          value={String(activeJobs.length)}
          detail="Awaiting completion"
          icon={Truck}
        />
        <Stat
          label="Open requests"
          value="0"
          detail="Requests appear here when received"
          icon={Bell}
        />
      </div>
      <section className="mt-7">
        <h2 className="mb-3 display text-xl font-bold">Jobs in motion</h2>
        {activeJobs.length ? (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4"
              >
                <p className="font-bold">{job.machineryTitle}</p>
                <p className="text-sm text-[#68777b]">
                  {job.location} · {job.status}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No active jobs"
            detail="Accepted marketplace requests will appear here."
          />
        )}
      </section>
    </AppShell>
  );
}

function FleetPage() {
  const [fleet, setFleet] = useState<FleetItem[]>(() =>
    read(keyFor("fleet"), fleetForSession()),
  );
  const [edit, setEdit] = useState<FleetItem | null>(null);
  const [show, setShow] = useState(false);
  const serviceFleet = fleet.filter((item) => item.status === "Maintenance");
  const operatingFleet = fleet.filter((item) => item.status !== "Maintenance");
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const item: FleetItem = {
      id: edit?.id || `f-${Date.now()}`,
      equipment: String(f.get("equipment")),
      registration: String(f.get("registration")),
      capacity: String(f.get("capacity")),
      rate: Number(f.get("rate")),
      status: String(f.get("status")),
      fuel: Number(f.get("fuel")),
      engineHours: Number(f.get("hours")),
      telematicsId: String(f.get("telematics")),
      currentJob: edit?.currentJob || "—",
      availableFrom: String(f.get("availableFrom") || "") || undefined,
    };
    const list = edit
      ? fleet.map((x) => (x.id === edit.id ? item : x))
      : [item, ...fleet];
    setFleet(list);
    write(keyFor("fleet"), list);
    setEdit(null);
    setShow(false);
  };
  return (
    <AppShell role="owner">
      <PageHead
        eyebrow="Asset control"
        title="My fleet."
        detail="Keep rates, readiness and operating context current. Telematics IDs are reference labels, not a live feed."
        action={
          <Button
            onClick={() => {
              setEdit(null);
              setShow(true);
            }}
          >
            <Plus size={16} /> Add equipment
          </Button>
        }
      />
      <h2 className="mb-3 display text-xl font-bold">
        Bookable & active equipment
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#ded9ca] bg-[#fbf9f2]">
        <div className="hidden grid-cols-[1.5fr_1fr_.8fr_.7fr_.7fr_1fr_auto] gap-4 border-b border-[#ded9ca] bg-[#ece8dc] p-4 text-[11px] font-bold uppercase tracking-[.12em] text-[#68777b] md:grid">
          <span>Equipment</span>
          <span>Readiness</span>
          <span>Fuel</span>
          <span>Hours</span>
          <span>Rate</span>
          <span>Current job</span>
          <span></span>
        </div>
        {operatingFleet.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 border-b border-[#ded9ca] p-4 last:border-0 md:grid-cols-[1.5fr_1fr_.8fr_.7fr_.7fr_1fr_auto] md:items-center md:gap-4"
          >
            <div>
              <p className="font-bold">{item.equipment}</p>
              <p className="mt-1 text-xs text-[#68777b]">
                {item.registration} · {item.capacity}
              </p>
            </div>
            <div>
              <Badge
                tone={
                  item.status === "Available"
                    ? "good"
                    : item.status === "On job"
                      ? "warn"
                      : "neutral"
                }
              >
                {item.status}
              </Badge>
              <p className="mt-1 text-[10px] text-[#87918d]">
                ID {item.telematicsId}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Fuel size={14} className="text-[#1a7d78]" />
              {item.fuel}%
            </div>
            <div className="text-sm">{item.engineHours.toLocaleString()}h</div>
            <div className="font-bold">
              {money(item.rate)}
              <span className="text-xs font-normal">/h</span>
            </div>
            <div className="text-sm text-[#68777b]">{item.currentJob}</div>
            <Button
              variant="ghost"
              onClick={() => {
                setEdit(item);
                setShow(true);
              }}
              className="px-2.5 py-2"
              data-testid={`button-edit-fleet-${item.id}`}
            >
              <Edit3 size={15} />
            </Button>
          </div>
        ))}
      </div>
      {serviceFleet.length > 0 && (
        <section className="mt-7 rounded-2xl border border-[#e8c98e] bg-[#fff8e9] p-5">
          <h2 className="display text-xl font-bold">Service & repair</h2>
          <p className="mt-1 text-sm text-[#68777b]">
            These units are hidden from immediate booking but can accept
            requests from their next available date.
          </p>
          <div className="mt-4 space-y-3">
            {serviceFleet.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[#e8c98e] bg-[#fbf9f2] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-bold">{item.equipment}</p>
                  <p className="mt-1 text-xs text-[#68777b]">
                    {item.registration} · Workshop: {item.currentJob}
                  </p>
                  <p className="mt-2 text-xs font-bold text-[#8e5811]">
                    Available for advance booking from{" "}
                    {item.availableFrom || "date pending"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEdit(item);
                    setShow(true);
                  }}
                >
                  <Edit3 size={15} /> Update service status
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      {show && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#18303a]/60 p-5">
          <form
            onSubmit={save}
            className="w-full max-w-lg rounded-3xl bg-[#f6f3ea] p-6"
          >
            <div className="flex justify-between">
              <h2 className="display text-2xl font-bold">
                {edit ? "Edit equipment" : "Add equipment"}
              </h2>
              <button type="button" onClick={() => setShow(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <input
                name="equipment"
                defaultValue={edit?.equipment}
                required
                placeholder="Equipment name"
                className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="registration"
                  defaultValue={edit?.registration}
                  required
                  placeholder="Registration"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
                <input
                  name="capacity"
                  defaultValue={edit?.capacity}
                  required
                  placeholder="Capacity"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  name="rate"
                  defaultValue={edit?.rate}
                  required
                  placeholder="Rate / hour"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
                <select
                  name="status"
                  defaultValue={edit?.status || "Available"}
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                >
                  <option>Available</option>
                  <option>On job</option>
                  <option>Maintenance</option>
                </select>
              </div>
              <label className="text-xs font-bold text-[#68777b]">
                Next available date (for service / repair)
                <input
                  type="date"
                  name="availableFrom"
                  defaultValue={edit?.availableFrom}
                  className="mt-1 w-full rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  name="fuel"
                  defaultValue={edit?.fuel || 75}
                  placeholder="Fuel %"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
                <input
                  type="number"
                  name="hours"
                  defaultValue={edit?.engineHours || 0}
                  placeholder="Engine hours"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
                <input
                  name="telematics"
                  defaultValue={edit?.telematicsId}
                  placeholder="Telematics ID"
                  className="rounded-xl border border-[#ded9ca] bg-[#fbf9f2] p-3 text-sm"
                />
              </div>
            </div>
            <Button className="mt-5 w-full">
              {edit ? "Save changes" : "Add to fleet"} <Check size={15} />
            </Button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function JobsPage() {
  const [jobs] = useState<Booking[]>(() =>
    read(keyFor("bookings"), bookingsForSession()),
  );
  return (
    <AppShell role="owner">
      <PageHead
        eyebrow="Demand desk"
        title="Jobs & bids."
        detail="Incoming customer requests and accepted work appear here."
      />
      <section>
        <h2 className="mb-3 display text-xl font-bold">Accepted jobs</h2>
        {jobs.length ? (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-4"
              >
                <p className="font-bold">{job.machineryTitle}</p>
                <p className="text-sm text-[#68777b]">
                  {job.customerName} · {job.location}
                </p>
                <Badge tone={job.status === "COMPLETED" ? "good" : "warn"}>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No jobs yet"
            detail="New customer requests will appear here when marketplace data is connected."
          />
        )}
      </section>
    </AppShell>
  );
}

function AccountPage() {
  const [, setLocation] = useLocation();
  const session = read<UserSession>(sessionKey, {
    role: "customer",
    fullName: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    postalCode: "",
  });
  const role = session.role;
  const demo = session.demo === true;
  const profile = demo
    ? role === "customer"
      ? {
          initials: "AR",
          name: "Arjun Rao",
          area: "Bengaluru",
          contact: "+91 98765 43210",
          email: "arjun.demo@riglogix.local",
          business: "Rao Contracting",
        }
      : {
          initials: "NS",
          name: "Neeraj Singh",
          area: "Bengaluru",
          contact: "+91 99887 76655",
          email: "neeraj.demo@riglogix.local",
          business: "Northline Earthworks",
        }
    : {
        initials: initialsFor(
          session.fullName,
          role === "customer" ? "CU" : "OW",
        ),
        name:
          session.fullName ||
          (role === "customer" ? "Customer account" : "Owner account"),
        area:
          [session.city, session.state, session.postalCode]
            .filter(Boolean)
            .join(", ") || "Not configured",
        contact: session.phone || "Not configured",
        email: session.email || "Not configured",
        business: session.business || "Not provided",
      };
  const sign = () => {
    localStorage.removeItem(keyFor("session"));
    setLocation("/sign-in");
  };
  return (
    <AppShell role={role}>
      <PageHead
        eyebrow="Workspace settings"
        title="Account."
        detail="Your current workspace and locally saved preferences."
      />
      <div className="grid max-w-3xl gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#ded9ca] bg-[#fbf9f2] p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f6b73c] text-xl font-bold">
              {profile.initials}
            </div>
            <div>
              <h2 className="display text-xl font-bold">{profile.name}</h2>
              <p className="text-sm text-[#68777b]">
                {role === "customer"
                  ? "Customer / contractor"
                  : "Equipment owner / operator"}
              </p>
            </div>
          </div>
          <div className="mt-7 space-y-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#68777b]">
                Workspace
              </p>
              <p className="mt-1 font-semibold">
                {role === "customer" ? "Customer workspace" : "Owner workspace"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#68777b]">
                Service area
              </p>
              <p className="mt-1 font-semibold">{profile.area}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#68777b]">
                Contact
              </p>
              <p className="mt-1 font-semibold">{profile.contact}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#68777b]">
                Email
              </p>
              <p className="mt-1 break-all font-semibold">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#68777b]">
                Company / organisation
              </p>
              <p className="mt-1 font-semibold">{profile.business}</p>
            </div>
          </div>
          <Button
            variant="danger"
            className="mt-8"
            onClick={sign}
            data-testid="button-account-signout"
          >
            <LogOut size={15} /> Sign out
          </Button>
        </section>
        <section className="rounded-2xl bg-[#18303a] p-6 text-[#f6f3ea]">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9d9d1]">
            Workspace notes
          </p>
          <h2 className="display mt-3 text-2xl font-bold">
            Built to be honest.
          </h2>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-[#b8c6c3]">
            <li className="flex gap-3">
              <Check className="mt-1 shrink-0 text-[#f6b73c]" size={16} />
              All actions persist locally in your browser.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 shrink-0 text-[#f6b73c]" size={16} />
              Customer totals do not expose owner-side marketplace charges.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 shrink-0 text-[#f6b73c]" size={16} />
              Broker comparisons are estimates and may vary by market.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 shrink-0 text-[#f6b73c]" size={16} />
              GPS, payments, escrow and AI are not connected.
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f6f3ea] p-5 text-center">
      <div>
        <Logo />
        <h1 className="display mt-12 text-5xl font-bold">Off route.</h1>
        <p className="mt-3 text-[#68777b]">That page does not exist.</p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-bold text-[#1a7d78]"
        >
          Return home <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const role = storedRole();
  return (
    <Switch key={location}>
      <Route path="/" component={Landing} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/demo" component={SignIn} />
      <Route path="/customer/dashboard">
        {() => (role === "customer" ? <CustomerDashboard /> : <Redirect />)}
      </Route>
      <Route path="/customer/machinery">
        {() => (role === "customer" ? <MachineryPageV2 /> : <Redirect />)}
      </Route>
      <Route path="/customer/auctions">
        {() => (role === "customer" ? <AuctionsPage /> : <Redirect />)}
      </Route>
      <Route path="/customer/radar">
        {() => (role === "customer" ? <RadarPage /> : <Redirect />)}
      </Route>
      <Route path="/customer/bookings">
        {() => (role === "customer" ? <BookingsPage /> : <Redirect />)}
      </Route>
      <Route path="/owner/dashboard">
        {() => (role === "owner" ? <OwnerDashboard /> : <Redirect />)}
      </Route>
      <Route path="/owner/fleet">
        {() => (role === "owner" ? <FleetPage /> : <Redirect />)}
      </Route>
      <Route path="/owner/jobs">
        {() => (role === "owner" ? <JobsPage /> : <Redirect />)}
      </Route>
      <Route path="/account">
        {() => (role ? <AccountPage /> : <Redirect />)}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
function Redirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/sign-in");
  }, [setLocation]);
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f6f3ea]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#ee8b18]"></div>
    </div>
  );
}
export default function App() {
  return <Router />;
}
