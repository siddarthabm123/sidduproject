import React, { useState } from "react";
import {
  MapPin,
  Search,
  Filter,
  Truck,
  CheckCircle,
  Star,
  Compass,
  Layers,
  Phone,
  ArrowRight,
  ShieldCheck,
  Building2,
  SlidersHorizontal,
  Navigation,
} from "lucide-react";

export interface DemoMachine {
  id: string;
  title: string;
  category: string;
  owner: string;
  ownerPhone: string;
  rating: number;
  distanceKm: number;
  rateHourly: number;
  ratePerFoot?: number;
  location: string;
  latPct: number; // For trial map pin position
  lngPct: number;
  verified: boolean;
  status: string;
  specs: string[];
  image: string;
}

const sampleSurroundingMachinery: DemoMachine[] = [
  {
    id: "m-map-1",
    title: "DrillMax 600 Borewell Rig",
    category: "Borewell Rig",
    owner: "GroundTruth Water & Drilling Services",
    ownerPhone: "+91 98765 11223",
    rating: 4.9,
    distanceKm: 3.2,
    rateHourly: 4200,
    ratePerFoot: 95,
    location: "Electronic City Phase 1, Bengaluru",
    latPct: 35,
    lngPct: 62,
    verified: true,
    status: "READY",
    specs: ["600m depth capability", "200 bar compressor", "₹95/ft rate"],
    image: "/assets/borewell-rig.jpg",
  },
  {
    id: "m-map-2",
    title: "CAT 320 Heavy Excavator",
    category: "Excavator",
    owner: "Northline Earthworks & Infra",
    ownerPhone: "+91 98765 44332",
    rating: 4.8,
    distanceKm: 5.8,
    rateHourly: 2850,
    location: "Whitefield Main Rd, Bengaluru",
    latPct: 52,
    lngPct: 78,
    verified: true,
    status: "READY",
    specs: ["20 Tonne Operating Weight", "1.4 m³ Bucket"],
    image: "/assets/heavy-excavator.jpg",
  },
  {
    id: "m-map-3",
    title: "Mahindra 4WD Heavy Tractor",
    category: "Tractor",
    owner: "Kisan Agro & Machinery Rentals",
    ownerPhone: "+91 98765 77889",
    rating: 4.7,
    distanceKm: 2.1,
    rateHourly: 1250,
    location: "Yelahanka New Town, Bengaluru",
    latPct: 25,
    lngPct: 35,
    verified: true,
    status: "READY",
    specs: ["75 HP 4WD Engine", "Trailer & Plough attachment"],
    image: "/assets/tractor-4wd.jpg",
  },
  {
    id: "m-map-4",
    title: "Volvo 16T Tipper Hauler",
    category: "Tipper Truck",
    owner: "Apex Haulage & Logistics Ltd.",
    ownerPhone: "+91 98765 99001",
    rating: 4.6,
    distanceKm: 8.4,
    rateHourly: 1650,
    location: "Hosur Road Checkpost, Bengaluru",
    latPct: 70,
    lngPct: 50,
    verified: true,
    status: "READY",
    specs: ["16 Tonne Payload", "10-Wheel Heavy Body"],
    image: "/assets/tipper-truck.jpg",
  },
  {
    id: "m-map-5",
    title: "Bobcat S650 Skid Steer",
    category: "Skid Steer",
    owner: "Mitra Compact Utility Hire",
    ownerPhone: "+91 98765 33445",
    rating: 4.9,
    distanceKm: 4.1,
    rateHourly: 1850,
    location: "Peenya Industrial Area, Bengaluru",
    latPct: 42,
    lngPct: 22,
    verified: false,
    status: "READY",
    specs: ["High-flow hydraulics", "Compact utility loader"],
    image: "/assets/skid-steer.jpg",
  },
];

export const DemoMapExplorer: React.FC<{
  onSelectMachine?: (machine: DemoMachine) => void;
}> = ({ onSelectMachine }) => {
  const [selectedLocation, setSelectedLocation] = useState("Bengaluru, Karnataka");
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activePin, setActivePin] = useState<DemoMachine | null>(sampleSurroundingMachinery[0]);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");

  const filteredMachines = sampleSurroundingMachinery.filter((m) => {
    const matchCategory = categoryFilter === "All" || m.category === categoryFilter;
    const matchRadius = m.distanceKm <= radiusKm;
    return matchCategory && matchRadius;
  });

  return (
    <div className="rounded-3xl border border-[#ded9ca] bg-[#fbf9f2] p-5 shadow-lg">
      
      {/* Top Controls Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#ded9ca] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#ee8b18]/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#b9680d]">
              Demo Trial Feature
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-[#1a7d78]">
              <Navigation size={13} /> Live Google Maps Explorer
            </span>
          </div>
          <h3 className="display mt-1 text-xl font-bold text-[#18303a]">
            Surrounding Equipment & Owner Locator
          </h3>
          <p className="text-xs text-[#68777b]">
            Explore verified machinery, borewell rigs, and owner contact details within your job location.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Location Picker */}
          <div className="flex items-center gap-2 rounded-xl border border-[#ded9ca] bg-white px-3 py-2 text-xs font-semibold text-[#18303a]">
            <MapPin size={15} className="text-[#ee8b18]" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs font-bold"
            >
              <option value="Bengaluru, Karnataka">Bengaluru, KA</option>
              <option value="Electronic City, Bengaluru">Electronic City, KA</option>
              <option value="Whitefield, Bengaluru">Whitefield, KA</option>
              <option value="Mysuru, Karnataka">Mysuru, KA</option>
              <option value="Hyderabad, Telangana">Hyderabad, TS</option>
              <option value="Chennai, Tamil Nadu">Chennai, TN</option>
              <option value="Mumbai, Maharashtra">Mumbai, MH</option>
            </select>
          </div>

          {/* Map Layer Toggle */}
          <button
            type="button"
            onClick={() => setMapType(mapType === "standard" ? "satellite" : "standard")}
            className="flex items-center gap-1.5 rounded-xl border border-[#ded9ca] bg-white px-3 py-2 text-xs font-bold text-[#18303a] hover:bg-[#f6f3ea]"
          >
            <Layers size={14} />
            <span>{mapType === "standard" ? "Satellite View" : "Map View"}</span>
          </button>
        </div>
      </div>

      {/* Filter Options Row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-[#ece8dc] p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#526169] flex items-center gap-1">
            <Filter size={13} /> Category:
          </span>
          {["All", "Borewell Rig", "Excavator", "Tractor", "Tipper Truck", "Skid Steer"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                categoryFilter === cat
                  ? "bg-[#ee8b18] text-white shadow-sm"
                  : "bg-white text-[#526169] hover:text-[#18303a]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-[#526169]">
          <SlidersHorizontal size={13} />
          <span>Radius: {radiusKm} km</span>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-24 accent-[#ee8b18] cursor-pointer"
          />
        </div>
      </div>

      {/* Interactive Map Visual Section */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        
        {/* Map Canvas Frame */}
        <div
          className={`relative h-[380px] w-full overflow-hidden rounded-2xl border-2 border-[#ded9ca] shadow-inner transition-all ${
            mapType === "satellite"
              ? "bg-[#1d2b27]"
              : "bg-[#e5e0d3]"
          }`}
          style={{
            backgroundImage:
              mapType === "standard"
                ? "radial-gradient(#c5beae 1.5px, transparent 1.5px)"
                : "radial-gradient(#2d453f 2px, transparent 2px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Map Compass & Trial Tag */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-[#18303a] shadow-sm">
            <Compass size={16} className="text-[#ee8b18] animate-spin-slow" />
            <span>Trial GPS Radius: {radiusKm} km surrounding {selectedLocation}</span>
          </div>

          {/* Roads & Terrain Mock Lines */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-30 stroke-[#8c826b]" strokeWidth="2.5" fill="none">
            <path d="M 0 120 Q 200 180 400 100 T 800 300" />
            <path d="M 150 0 Q 180 200 350 400" />
            <path d="M 0 320 Q 300 280 600 380" strokeDasharray="6,6" />
          </svg>

          {/* Center User Location Pin */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#18303a] text-white shadow-lg ring-4 ring-[#ee8b18]/40 animate-pulse">
              <MapPin size={18} className="text-[#ee8b18]" />
            </div>
            <span className="mt-1 rounded-md bg-[#18303a] px-2 py-0.5 text-[9px] font-bold text-white shadow-md">
              Your Job Site
            </span>
          </div>

          {/* Interactive Equipment Map Pins */}
          {filteredMachines.map((m) => {
            const isActive = activePin?.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActivePin(m)}
                style={{ top: `${m.latPct}%`, left: `${m.lngPct}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group transition-all transform hover:scale-110 ${
                  isActive ? "scale-110 z-30" : ""
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-xs shadow-md transition-all border ${
                    isActive
                      ? "bg-[#ee8b18] text-white border-white ring-4 ring-[#ee8b18]/30 scale-105"
                      : "bg-white text-[#18303a] border-[#ded9ca] hover:border-[#ee8b18]"
                  }`}
                >
                  <Truck size={13} className={isActive ? "text-white" : "text-[#ee8b18]"} />
                  <span>{m.title.split(" ")[0]}</span>
                  <span className="text-[10px] opacity-80">({m.distanceKm}km)</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Machine Detail Drawer */}
        {activePin ? (
          <div className="flex flex-col justify-between rounded-2xl border border-[#ded9ca] bg-white p-5 shadow-md">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded-md bg-[#e6f2ee] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#1a7d78]">
                    {activePin.category}
                  </span>
                  <h4 className="display mt-1 text-lg font-bold text-[#18303a]">
                    {activePin.title}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-[#18303a]">
                    ₹{activePin.rateHourly}
                  </span>
                  <span className="text-[10px] text-[#68777b]">/hr</span>
                  {activePin.ratePerFoot && (
                    <p className="text-[11px] font-bold text-[#1a7d78]">
                      ₹{activePin.ratePerFoot}/ft
                    </p>
                  )}
                </div>
              </div>

              {/* Owner Information Box */}
              <div className="mt-4 rounded-xl border border-[#ece8dc] bg-[#fbf9f2] p-3">
                <p className="text-[11px] font-bold uppercase text-[#526169] flex items-center gap-1">
                  <Building2 size={13} className="text-[#ee8b18]" /> Equipment Owner Details
                </p>
                <p className="mt-1 font-bold text-sm text-[#18303a] flex items-center gap-1.5">
                  {activePin.owner}
                  {activePin.verified && (
                    <ShieldCheck size={16} className="text-emerald-600" />
                  )}
                </p>
                <p className="text-xs text-[#68777b] mt-0.5 flex items-center gap-1">
                  <Phone size={12} /> {activePin.ownerPhone}
                </p>
              </div>

              {/* Distance & Location */}
              <div className="mt-3 flex items-center justify-between text-xs text-[#526169]">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin size={13} className="text-[#ee8b18]" /> {activePin.location}
                </span>
                <span className="font-bold text-[#18303a]">{activePin.distanceKm} km away</span>
              </div>

              {/* Specs Chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activePin.specs.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-[#ece8dc] px-2.5 py-1 text-[11px] font-semibold text-[#526169]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-[#ece8dc] flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectMachine && onSelectMachine(activePin)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ee8b18] hover:bg-[#d97d10] text-white py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>Select & Book Equipment</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#ded9ca] p-6 text-center text-xs text-[#68777b]">
            Click on any equipment pin on the map to inspect details.
          </div>
        )}
      </div>

    </div>
  );
};

export default DemoMapExplorer;
