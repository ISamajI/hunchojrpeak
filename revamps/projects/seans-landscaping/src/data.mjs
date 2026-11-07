// Site content for Sean's Landscaping, Inc.
// Source: the live www.seanslandscaping.com pages (scraped 2026-11-04). Copy is lightly edited
// for typos and readability; facts (values, contractors, dates, licenses) are unchanged.

export const U = "https://www.seanslandscaping.com/wp-content/uploads/";

export const company = {
  name: "Sean's Landscaping, Inc.",
  short: "Sean's Landscaping",
  street: "1766 Yardville Hamilton Square Rd.",
  city: "Hamilton",
  state: "NJ",
  zip: "08690",
  phone: "(609)\u00a0586\u20112876",
  phoneHref: "tel:+16095862876",
  fax: "(609)\u00a0586\u20117981",
  email: "seanslandscapinginc@gmail.com",
  facebook: "https://www.facebook.com/Seans-Landscaping-Inc-116747845102639/",
  serviceArea: ["New Jersey", "New York", "Delaware", "Eastern Pennsylvania"],
  url: "https://www.seanslandscaping.com/",
};

export const services = [
  {
    id: "site-prep",
    name: "Site Prep",
    short: "Subgrades, soils and final grading done to spec.",
    lead: "The key to a successful project is site preparation. This critically important step lays the foundation for the landscape.",
    body: "From subgrades, grades and soil amending (on or off site) to final grading, topsoil screening and installation — by hand or by 30-yard dump — our team takes extra time to make sure every aspect of this work is completed per the specifications.",
    points: ["Subgrade & finish grading", "Soil amending on or off site", "Topsoil screening", "Engineered & green-roof soils", "Hand or 30-yd dump install", "Water-feature piping prep"],
    images: [
      ["2018/10/SEANS0067-2560.jpg", "Soil installation"],
      ["2018/10/SEANS082_2560.jpg", "Soil in place, ready for planting"],
      ["2018/10/SEANS0068-2560.jpg", "Seeding machine for full coverage"],
      ["2018/10/SEANS085_2560.jpg", "Prepping for water-feature piping"],
      ["2018/10/SEANS087_2560.jpg", "Leaf-compost soil installation for an aquatic pond"],
    ],
  },
  {
    id: "landscaping",
    name: "Landscaping",
    short: "Native to exotic plantings, meadows and grasses.",
    lead: "From native plants to exotics, we offer an expansive inventory of trees and plant material — and contract growing for projects of every type.",
    body: "We work closely with suppliers to ensure the highest quality, and with architects and designers to prepare and install grasses and custom wildflower meadows that achieve the desired aesthetic. Years of experience with grasses let us plan, plant and space them correctly, so landscapes get better over time.",
    points: ["Trees & specimen plantings", "Contract growing", "Meadow & wildflower mixes", "Ornamental grasses & bioswales", "Sod & play areas", "Enclosed & children's gardens"],
    images: [
      ["2018/10/SEANS0005_2560.jpg", "Flowering and shade trees with mass planting"],
      ["2018/10/SEANS0018_2560.jpg", "Meadow mixes in fall color"],
      ["2018/10/SEANS0009_2560.jpg", "Hameln grasses in bioswales, early-winter color"],
      ["2018/10/SEANS092_2560.jpg", "Children's garden with play area and chalk wall"],
      ["2018/10/Summer-Color_2560.jpg", "Summer color"],
    ],
  },
  {
    id: "hardscape",
    name: "Hardscape",
    short: "Bluestone, granite, pavers and colored concrete.",
    lead: "Our own in-house craftsmen have installed every type of hardscape: bluestone, granite, tile, colored concrete and manufactured pavers.",
    body: "Pedestal-set roof plazas, vehicular pavers on asphalt or concrete bases, granite steps and bench walls — if the owner, contractor or architect can envision it, we can deliver it.",
    points: ["Bluestone & granite", "Pedestal paver systems", "Vehicular pavers", "Colored concrete", "Bench & seat walls", "Cobblestone walks"],
    images: [
      ["2018/10/SEANS0024_2560.jpg", "Colored concrete with bluestone for an outdoor café"],
      ["2018/10/SEANS0050_2560.jpg", "Pavers on pedestal base for a green roof"],
      ["2018/10/SEANS0021_2560.jpg", "Bluestone patio on contoured concrete base"],
      ["2018/10/SEANS098_2560.jpg", "Vehicular pavers, bollards and colored concrete"],
      ["2018/10/SEANS088_2560.jpg", "Bench wall, colored concrete and pavers"],
    ],
  },
  {
    id: "structures",
    name: "Structures",
    short: "Pergolas, walls, fences and flagpoles.",
    lead: "Pergolas and gazebos, retaining walls, bench walls, garden walls, flagpoles and fences — built for commercial landscapes for over 40 years.",
    body: "Our master craftsmen are known for exacting attention to detail and for following plans to the letter. It's one reason we have long-standing relationships with so many clients.",
    points: ["Pergolas & gazebos", "Retaining walls", "Garden & bench walls", "Fencing", "Flagpoles", "Teak & steel capping"],
    images: [
      ["2018/10/SEANS0004_2560.jpg", "Pergola with teak wood capping"],
      ["2018/10/SEANS0036_2560.jpg", "Roof-garden pergola with steel capping"],
      ["2018/10/SEANS0035_2560.jpg", "Pergola and garden walls with colored concrete"],
      ["2018/10/SEANS089_2560.jpg", "Pergola with teak capping"],
    ],
  },
  {
    id: "water-features",
    name: "Water Features",
    short: "Water walls, pools, streams and fountains.",
    lead: "Often the most dramatic focal point of a landscape. Water walls, pools, natural streams and fountains demand technical expertise and complex engineering.",
    body: "We've built a 120-foot-long, 35-foot-high cascading water wall, double-sided walls, streams dropping to stainless basins and features relocated from a client's old facility to its new home. Whatever you can imagine, we have the experience to bring it to life.",
    points: ["Cascading water walls", "Reflecting pools", "Natural streams", "Fountains & basins", "Pumps & piping", "Feature relocation"],
    images: [
      ["2018/10/SEANS0020_2560.jpg", "120 ft by 35 ft high cascading water wall"],
      ["2018/10/SEANS094_2560.jpg", "Water wall at night beside outdoor dining"],
      ["2018/10/SEANS091_2560.jpg", "Double-sided water wall"],
      ["2018/10/IMG_20120420_091632_2560.jpg", "Garden wall with a stream dropping to a stainless-steel basin"],
      ["2018/10/SEANS023_2560.jpg", "Water wall and patio"],
    ],
  },
  {
    id: "green-roofs",
    name: "Green Roofs",
    short: "Intensive & extensive roofs, certified installer.",
    lead: "From city towers to parking garages, more buildings are going green on top — to conserve energy and improve how the structure looks and lives.",
    body: "Once the architects and designers set their goals, they trust us to accomplish them on time and on budget. We've completed many complex green-roof projects, including 80,000 sq ft of intensive and extensive roof at Reading Hospital, and are certified Roof Meadows, American Hydrotech and LiveRoof installers.",
    points: ["Intensive & extensive systems", "Lightweight engineered soils", "Sedum & ground-cover", "Roof-top public parks", "Pedestal plazas", "Certified installer"],
    images: [
      ["2018/10/SEANS0033_2560.jpg", "Meandering walk, bench wall and site furnishings"],
      ["2018/10/SEANS0032_2560.jpg", "Thousands of ground-cover plantings"],
      ["2018/10/147_2560.jpg", "Lightweight soils installed"],
      ["2018/10/148_2560.jpg", "Roof-top seating area"],
      ["2018/10/Summer-2013-3-2560.jpg", "Mature plantings"],
    ],
  },
  {
    id: "wetlands",
    name: "Wetlands",
    short: "Restoration, preservation and creation.",
    lead: "We take pride in our expertise in wetland restoration, preservation and creation — including eleven acres of newly created wetland.",
    body: "Working closely with soil conservation districts, the NJ D.E.P. and our clients, we handle every aspect of the project: clearing, excavating, planting and protection. It's gratifying to see our labor directly preserving natural resources.",
    points: ["Wetland creation", "High & low marsh planting", "Aquatic ponds", "Excavation & clearing", "Geese & wildlife fencing", "Agency coordination"],
    images: [
      ["2018/10/SEANS0016-ret_2560.jpg", "Eleven acres of created wetland"],
      ["2018/10/SEANS0038_2560.jpg", "Aquatic pond"],
      ["2018/10/SEANS0072_2560.jpg", "High and low marsh planting"],
      ["2018/10/SEANS0048_2560.jpg", "High marsh planting"],
      ["2018/10/SEANS0074_2560.jpg", "High and low marsh after rain"],
    ],
  },
  {
    id: "irrigation",
    name: "Irrigation",
    short: "Licensed, in-house, conservation-first systems.",
    lead: "Licensed to install any type of irrigation system — on well systems, city water or water-storage tanks. All irrigation is handled in-house.",
    body: "Water conservation is a key consideration on every project, especially LEED (green) projects. Good irrigation is one of the most important steps in maintaining a property and keeping the landscape healthy and valuable.",
    points: ["Weather-sensing controllers", "Rainwater storage tanks", "Well & city water", "Matched-precipitation heads", "LEED water conservation", "NJ Irrigation License #285761"],
    images: [
      ["2018/10/SEANS0070_2560.jpg", "Rainwater storage tanks"],
      ["2018/10/SEANS0058_2560.jpg", "Control center with weather sensors"],
      ["2018/10/SEANS0059_2560.jpg", "Spray and rotary combination heads"],
      ["2018/10/SEANS0060_2560.jpg", "Water-conservation heads"],
    ],
  },
  {
    id: "lighting",
    name: "Lighting",
    short: "Feature, safety and after-dark lighting.",
    lead: "Landscape lighting enhances every project and is particularly effective at showing off a dramatic water feature or structure.",
    body: "Lighting also contributes to safety and lets people enjoy the landscape well into the evening — from fiber-optic wall capping to pool and water-wall illumination.",
    points: ["Water-feature lighting", "Fiber-optic accents", "Pool lighting", "Pathway & safety lighting", "Recessed LED in granite", "Coordinated with electrical"],
    images: [
      ["2018/10/SEANS095_2560.jpg", "Water wall illuminated"],
      ["2018/10/SEANS0040_2560.jpg", "Fiber-optic lighting along wall capping"],
      ["2018/10/SEANS0041_2560.jpg", "Pool lighting"],
      ["2018/10/SEANS0042_2560.jpg", "Pool lighting for safety and aesthetics"],
    ],
  },
];

// cats: green-roofs hardscape water-features landscaping | sector: healthcare universities civic corporate
export const projects = [
  { slug: "firestone-library-princeton", name: "Firestone Library Green Roofs", full: "88 & 71 Green Roof Projects, Firestone Library", loc: "Princeton University, NJ", gc: "Massimino Building Corp.", done: "Late fall 2017", pm: "Gerry Brady", value: 2136000, scope: "Removed the existing green roofs and soils, then reinstalled, landscaped and installed bluestone patios.", cats: "green-roofs hardscape universities", thumb: "2018/10/Firestone.jpg", images: ["2018/10/Firestone-library-6_9_18-1_2560.jpg", "2018/10/Firestone-library-2_23_18_2560.jpg"], video: "firestone-roof" },
  { slug: "villanova-hardscape", name: "Villanova University Phase 4 Hardscape", loc: "Villanova, PA", gc: "Hunter Roberts", done: "Late fall 2018", pm: "James Dixon", value: 4148000, scope: "Installed new pavers, bluestone and granite on a 6″ concrete base, including monumental granite steps.", cats: "hardscape universities", thumb: "2018/10/Villanova4T.jpg", images: ["2018/10/Villanova-2-7_26_18_2560.jpg", "2018/10/Granite-Steps-@Villanova-2_24_18_2560.jpg", "2018/10/IMG_2367_2560.jpg", "2018/10/IMG_2369_2560.jpg"] },
  { slug: "chop-schuylkill-ave", name: "CHOP Schuylkill Ave", full: "Children's Hospital of Philadelphia — Schuylkill Avenue", loc: "Philadelphia, PA", gc: "L.F. Driscoll", done: "Spring 2017", pm: "James Dixon", value: 6879000, scope: "Provided and installed the landscape plaza, green-roof soils, landscaping, decking, cobblestone, irrigation and hardscaping.", cats: "green-roofs hardscape landscaping healthcare", thumb: "2018/10/CHOPT.jpg", images: ["2018/10/Chop-Skuk-7_21_17-1_2560.jpg", "2018/10/CHOP-skuk-7_21_17-2_2560.jpg"], video: "chop-schuylkill" },
  { slug: "reading-hospital", name: "Reading Hospital 7th Ave. Building", loc: "Reading, PA", gc: "L.F. Driscoll", done: "Summer 2017", pm: "James Dixon", value: 5871000, scope: "Provided and installed 80,000 sq ft of intensive and extensive green roof, a water feature, hardscape and Corten steel walls.", cats: "green-roofs water-features hardscape healthcare", thumb: "2018/10/ReadingHospitalT.jpg", images: ["2018/10/Reading-hospital-2-6_14_18_2560.jpg", "2018/10/Reading-hospital-3-6_14_18_2560.jpg", "2018/10/Reading-hospital-4-6_14_18_2560.jpg"], video: "reading-water-feature" },
  { slug: "1800-arch-st", name: "1800 Arch St. / Comcast Tower 2", loc: "Philadelphia, PA", gc: "L.F. Driscoll", done: "Fall 2018", pm: "James Dixon", value: 1150000, scope: "Structural soils for the landscape, street-tree planting and 35-ft-tall interior Winter Garden ficus trees.", cats: "landscaping corporate", thumb: "2018/10/ComcastT.jpg", images: ["2018/10/Comcast-winter-garden-1_2560.jpg", "2018/10/Comcast-Street-1-7_21_17_2560.jpg", "2018/10/Comcast-trees-2-5_11_18_2560.jpg"] },
  { slug: "20-washington-rd", name: "20 Washington Rd., Princeton University", loc: "Princeton, NJ", gc: "Barr & Barr", done: "Late summer 2017", pm: "Chris Dixon", value: 1665000, scope: "Removed all existing soils, installed new bluestone and cobblestone walks and planted new landscape trees.", cats: "hardscape landscaping universities", thumb: "2018/10/20-WashingtonT.jpg", images: ["2018/10/20-Washington-Rd-6_9_18-1_2560.jpg", "2018/10/20-Washington-Rd-6_9_18-2_2560.jpg", "2018/10/20-Washinton-rd.-6_9_18-3_2560.jpg", "2018/10/IMG_7299-1_2560.jpg"] },
  { slug: "500-walnut-st", name: "500 Walnut St. Roof Deck", loc: "Philadelphia, PA", gc: "Intech Construction", done: "Summer 2017", pm: "James Dixon", value: 289000, scope: "Provided and installed custom planters, green screen, soils, landscaping and irrigation on the fourth-floor roof deck.", cats: "green-roofs landscaping corporate", thumb: "2018/10/500-WalnutT.jpg", images: ["2018/10/500-Walnut-St-1-10_21_17_2560.jpg", "2018/10/500-Walnut-street-9_7_17-3_2560.jpg"] },
  { slug: "carpenters-training-facility", name: "NJ Carpenters Fund Training Facility", loc: "Edison, NJ", gc: "Fitzpatrick & Associates", done: "Fall 2017", pm: "Gerry Brady", value: 711000, scope: "Provided landscaping soils, irrigation, 10,000 sq ft of paver patios and site amenities.", cats: "hardscape landscaping corporate", thumb: "2018/10/Carpenters-Training-Ctr-2_23_18_2560-917x630.jpg", images: ["2018/10/Carpenters-Training-Ctr-2_23_18_2560.jpg"] },
  { slug: "hope-tower", name: "Hope Tower, Jersey Shore Medical Center", full: "Hope Tower, Jersey Shore Medical Center — Meridian Health", loc: "Neptune, NJ", gc: "L.F. Driscoll", done: "Late fall 2017", pm: "Chris Dixon", value: 987000, scope: "Provided all landscaping, irrigation, soils, profiles, green roof, living walls and masonry.", cats: "green-roofs landscaping healthcare", thumb: "2018/10/JerseyShore.jpg", images: ["2018/10/Jersey-Shore-6_9_18-4_2560.jpg", "2018/10/Hopetower-jersey-shore-2_23_18_2560.jpg"] },
  { slug: "rutgers-chem-bio", name: "Rutgers Chemistry & Chemical Biology Building", loc: "Piscataway, NJ", gc: "Barr & Barr", done: "Fall 2017", pm: "Hernan Avelar", value: 763000, scope: "Provided soils, landscaping and sod for the new Chemistry & Chemical Biology building.", cats: "landscaping universities", thumb: "2018/10/RutgersT.jpg", images: ["2018/10/Rutgers-1-5_30_18_2560.jpg", "2018/10/Rutgers-2-5_30_18_2560.jpg", "2018/10/Rutgers-2-10_21_17_2560.jpg", "2018/10/Rutgers-3-10_21_17_2560.jpg", "2018/10/Rutgers-5_30_18-4_2560.jpg"] },
  { slug: "princeton-childcare-center", name: "Princeton University Childcare Center", loc: "Princeton, NJ", gc: "Princeton University", done: "Summer 2017", pm: "Chris Dixon", value: 1136000, scope: "Installed full daycare playground equipment, landscaping and fencing.", cats: "landscaping universities", thumb: "2018/10/PrincetonDayCareT.jpg", images: ["2018/10/Princeton-daycare-3-5_9_17_2560.jpg", "2018/10/Princeton-daycare-4-8_8_17_2560.jpg", "2018/10/Princeton-daycare-5-8_8_17_2560.jpg", "2018/10/Princeton-Daycare-6-8_8_17_2560_ret.jpg"] },
  { slug: "76ers-training-facility", name: "Philadelphia 76ers Training Facility", loc: "Camden, NJ", gc: "Intech Construction", done: "Summer 2017", pm: "Gerry Brady", value: 716000, scope: "Installed soils, landscaping, irrigation and hardscape.", cats: "hardscape landscaping corporate", thumb: "2018/10/763ersT.jpg", images: ["2018/10/76ers-1-10_11_16_2560.jpg", "2018/10/76ers-4-10_11_16_2560.jpg"] },
  { slug: "chop-buerger-center", name: "CHOP Buerger Center", full: "CHOP — Buerger Center for Advanced Pediatric Care", loc: "Philadelphia, PA", gc: "Turner Construction Co.", done: "June 2015", pm: "James Dixon", value: 5700325, scope: "Buerger plaza and 6th-floor roof landscape and hardscape: extruded polystyrene installation, lightweight aggregate build-up, soil mixes, irrigation, landscaping, site furnishings and hardscape.", cats: "green-roofs hardscape landscaping healthcare", thumb: "2018/11/CHOP-BuergerT.jpg", images: ["2018/11/Buerger-Center-2-05.26.16_2560.jpg", "2018/11/Buerger-Center-3-05.26.16_2560.jpg", "2018/11/Buerger-Ctr-07.27.15_2560.jpg", "2018/11/Buerger-plaza-6.1_2560.jpg", "2018/11/CHOP-1-6.18.15_2560.jpg", "2018/11/CHOP-Buerger-8.4.15_2560.jpg", "2018/11/CHOP-Buerger-plaza-2-12.18.15_2560.jpg", "2018/11/CHOP-Buerger-plaza-3-12.18.15_2560.jpg"], video: "philadelphia-rooftop-buerger-center" },
  { slug: "andlinger-center", name: "Andlinger Center for Energy & the Environment", loc: "Princeton University, NJ", gc: "F.J. Sciame", done: "Summer 2015", pm: "Chris Dixon", value: 1935815, scope: "Landscaping, irrigation, a sedum-covered green roof and decomposed-granite walks.", cats: "green-roofs landscaping universities", thumb: "2018/11/AndlingerT.jpg", images: ["2018/11/Andlinger_2560.jpg", "2018/11/Andlinger-2-11.1.15_2560.jpg", "2018/11/Andlinger-4-11.1.15_2560.jpg", "2018/11/Andlinger-6-11.1.15_2560.jpg", "2018/11/Andlinger-7_4_17-4_2560.jpg", "2018/11/Andlinger-7_4_17-5_2560.jpg", "2018/11/Andlinger-Princeton-5.2.16_2560.jpg"] },
  { slug: "cira-garage", name: "Cira South Garage Roof-Top Park", full: "Cira South Garage Green Roof — Roof-Top Public Park", loc: "Philadelphia, PA", gc: "Hunter Roberts", done: "Summer 2015", pm: "James Dixon", value: 2069520, scope: "Green roof, irrigation, a 20,000 sq ft hardscape plaza and 20,000 sq ft of soil mixes, planters and sod.", cats: "green-roofs hardscape civic", thumb: "2018/11/CIRA-GarageT.jpg", images: ["2018/11/Cira-garage-1_2560.jpg", "2018/11/Cira-garage-2_2560.jpg", "2018/11/Cira-garage-3_2560.jpg", "2018/11/Cira-garage-4_2560-.jpg"], video: "cira-south-garage-green-roof" },
  { slug: "pennsylvania-presbyterian-medical-center", name: "Penn Presbyterian Medical Center", loc: "Philadelphia, PA", gc: "L.F. Driscoll", done: "May 2016", pm: "Chris Dixon", value: 871350, scope: "Landscaping, hardscape, granite curb walls and sod, plus site build-up: drainage, decomposed granite and topsoil import.", cats: "hardscape landscaping healthcare", thumb: "2018/11/Penn-PresbyterianT.jpg", images: ["2018/11/Penn-Pres.-5.3.16_2560.jpg", "2018/11/Penn-Pres.-2-5.3.16_2560.jpg", "2018/11/Penn-Pres.-5.4.16_2560.jpg", "2018/11/Penn-Presby-photo-6-8-16_2560.jpg"] },
  { slug: "nemours", name: "Nemours / A.I. duPont Children's Hospital", loc: "Wilmington, DE", gc: "Skanska USA", done: "Fall 2014", pm: "Chris Dixon", value: 1916666, scope: "Roof gardens, landscape, a water feature, pedestal pavers, soils and irrigation, including a sedum roof install.", cats: "green-roofs water-features hardscape healthcare", thumb: "2018/11/Neumors-T.jpg", images: ["2018/11/Roof-Garden-Nem_2560.jpg", "2018/11/NW1_2560.jpg", "2018/11/nw2_2560.jpg", "2018/11/Nemours-3_2560.jpg", "2018/11/Nemours-4_2560.jpg", "2018/11/Neumors-Sedum-roof-install-4_14_16_2560-1.jpg"] },
  { slug: "franklin-institute", name: "The Franklin Institute", loc: "Philadelphia, PA", gc: "Skanska USA", done: "Summer 2014", pm: "Finbarr Brady", value: 489000, scope: "Landscaping, soils and a rain garden.", cats: "landscaping civic", thumb: "2018/11/Franklin-InstituteT.jpg", images: ["2018/11/frank-i-outdoor_2560.jpg", "2018/11/FI_2560.jpg", "2018/11/fr-inst_2560.jpg"] },
  { slug: "novo-nordisk", name: "Novo Nordisk Campus", loc: "Plainsboro, NJ", gc: "L.F. Driscoll", done: "Late spring 2013", pm: "Chris Dixon", value: 4599637, scope: "Landscape refurbishment, hardscape install, a water feature flowing over bluestone, irrigation refurbishment, recessed LED lighting in Fürstenberg granite and interior/exterior concrete work.", cats: "water-features hardscape landscaping corporate", thumb: "2018/11/NovoNordiskT.jpg", images: ["2018/11/Waterfeature-flows-over-bluestone.jpg", "2018/11/Furstenberg-granite-with-recessed-lighting.jpg", "2018/11/L.E.D.-Lighting.jpg", "2018/11/Waterfeature-ready-to-flow.jpg"] },
  { slug: "temple-university-residences", name: "Temple University Student Residences", loc: "Philadelphia, PA", gc: "L.F. Driscoll", done: "Spring 2013", pm: "James Dixon", value: 780441, scope: "Roof-top terrace landscape over a parking garage, street trees, ground-level landscape and irrigation — with 3,000 cubic yards of engineered planting soils.", cats: "green-roofs landscaping universities", thumb: "2018/11/TempleUT.jpg", images: ["2018/11/Plaza-Over-Parking-Garage.jpg", "2018/11/Plaza-Over-Parking-Garage-2.jpg", "2018/11/Plaza-Over-Parking-Garage-4.jpg", "2018/11/Street-Tree-Planting.jpg", "2018/11/Photo-Jul-11-1-35-54-PM.jpg"] },
  { slug: "hamilton-family-zoo", name: "Hamilton Family Zoo, Philadelphia Zoo", loc: "Philadelphia, PA", gc: "W.S. Cumby", done: "Spring 2013", pm: "Gerry Brady", value: 578800, scope: "Installed hardscape, water features, engineered soils, landscaping and irrigation.", cats: "water-features hardscape landscaping civic", thumb: "2018/11/HamiltonZooT.png", images: ["2018/11/Photo-Sep-06-8-26-48-AM_2560.jpg", "2018/11/Photo-Apr-23-9-40-44-AM_2560.jpg", "2018/11/Photo-Sep-06-8-35-27-AM_2560.jpg", "2018/11/Photo-Sep-06-8-39-07-AM_2560.jpg", "2018/11/Photo-Sep-07-7-15-30-AM_2560.jpg"] },
  { slug: "philadelphia-museum-of-art", name: "Philadelphia Museum of Art", loc: "Philadelphia, PA", gc: "L.F. Driscoll", done: "Fall 2012", pm: "James Dixon", value: 792793, scope: "South-side hardscape using Hanover asphalt pavers with a Deer Isle granite border over roof decking, plus planters with irrigation.", cats: "hardscape green-roofs civic", thumb: "2018/11/Phily-MuseumT.jpg", images: ["2018/11/Hanover-Asphalt-Pavers-with-Deer-Isle-Granite-Paver-Border.jpg", "2018/11/Irrigation-and-Planting.jpg"] },
  { slug: "bedford-fields", name: "Bedford Fields, Princeton University", loc: "Princeton, NJ", gc: "Fitzpatrick & Associates", done: "Spring 2013", pm: "Chris Dixon", value: 388551, scope: "Storm and sanitary piping and structures, building water service, demolition and site prep, asphalt under bleachers, pavers on asphalt base and landscaping.", cats: "hardscape landscaping universities", thumb: "2018/11/BedfordFieldT.jpg", images: ["2018/11/Bedford-Field-Princeton-NJ.jpg"] },
  { slug: "rwj-hospital", name: "RWJ University Hospital Hamilton", loc: "Hamilton, NJ", gc: "RWJ Hospital (direct)", done: "Ongoing since 1994", pm: "Gerry Brady", value: 450000, scope: "Landscaping and irrigation for the main hospital campus, including the courtyard and reflecting pool — a relationship going back to 1994.", cats: "landscaping water-features healthcare", thumb: "2018/11/RWJT.jpg", images: ["2018/11/RWJ-Univ.-Hosp-courtyard.jpg", "2018/11/RWJ-Univ.-Hosp.jpg", "2018/11/RWJ-Hospital-reflective-pool.jpg"] },
];

export const projectFilters = [
  ["all", "All projects"],
  ["green-roofs", "Green roofs"],
  ["hardscape", "Hardscape"],
  ["water-features", "Water features"],
  ["landscaping", "Landscaping"],
  ["healthcare", "Healthcare"],
  ["universities", "Universities"],
  ["civic", "Cultural & civic"],
  ["corporate", "Corporate"],
];

export const catLabels = {
  "green-roofs": "Green roof", hardscape: "Hardscape", "water-features": "Water feature", landscaping: "Landscaping",
  healthcare: "Healthcare", universities: "University", civic: "Civic", corporate: "Corporate",
};

export const videos = [
  { slug: "cira-south-garage-green-roof", title: "Cira South Garage Green Roof", loc: "Philadelphia, PA", thumb: "2018/11/CIRA-South-Green-RoofT.jpg", src: "Videos/CIRA-South-Green%20Roof.mp4" },
  { slug: "chop-schuylkill", title: "CHOP Schuylkill", loc: "Philadelphia, PA", thumb: "2018/11/CHOP-SchuylkillT.jpg", src: "Videos/CHOP.mp4" },
  { slug: "chop-roof-top-gardens", title: "CHOP Roof-Top Gardens", loc: "Philadelphia, PA", thumb: "2018/12/CHOP-roof-top-gardensT.jpg", src: "2018/12/CHOP-roof-top-gardens.mp4" },
  { slug: "princeton-university-tree-install", title: "Princeton University Tree Install", loc: "Princeton, NJ", thumb: "2018/12/Princeton-Tree-installT.jpg", src: "2018/12/Princeton-University-Tree-Install.mp4" },
  { slug: "water-wall-at-capital-health", title: "Water Wall at Capital Health", loc: "Hopewell, NJ", thumb: "2018/12/Water-Wall-At-Capital-Health-T.jpg", src: "2018/12/Water-Wall-At-Capital-Health-Hopewell-NJ.mp4" },
  { slug: "philadelphia-rooftop-buerger-center", title: "Rooftop at the Buerger Center", loc: "Philadelphia, PA", thumb: "2018/12/Philadelphia-Rooftop-Buerger-Center-T.jpg", src: "2018/12/Philadelphia-Rooftop-Buerger-Center.mp4" },
  { slug: "cira-green-roof", title: "Cira Green Roof", loc: "Philadelphia, PA", thumb: "2018/11/CiraGreenRoofT.jpg", src: "Videos/Cira-Green-Roof.mp4" },
  { slug: "reading-water-feature", title: "Reading Hospital Water Feature", loc: "Reading, PA", thumb: "2018/11/Reading-Water-FeatureT.jpg", src: "Videos/Reading-Water-Feature.mp4" },
  { slug: "firestone-roof", title: "Firestone Library Roof", loc: "Princeton, NJ", thumb: "2018/11/FirestoneRoofT.jpg", src: "Videos/Firestone-Roof.mp4" },
];

export const team = [
  { name: "Gerry Brady", role: "President", since: 1985, email: "gerry@seanslandscaping.com", bio: "Worked his way up through the ranks, learning every aspect of the business. His work ethic sets the tone for the company — every general contractor knows that when you hire Sean's, Gerry will be on site, working closely with the crews." },
  { name: "Finbarr Brady", role: "Controller", since: 1994, email: "finn@seanslandscaping.com", bio: "Finn's attention to detail and promptness play a key role in making sure projects come to fruition." },
  { name: "James Dixon", role: "Senior Project Manager", since: 2000, email: "james@seanslandscaping.com", bio: "Personally supervises a wide array of projects with a keen sense of timing — including Roberts Stadium at Princeton, CHOP Buerger, Cira Green, Reading Hospital, Comcast Tower 2, Penn First Pavilion and the Philadelphia Museum of Art." },
  { name: "Chris Dixon", role: "Senior Project Manager", since: 2001, email: "cdixon@seanslandscaping.com", bio: "A get-it-done PM who excels at calculations, layout and clear communication. Projects include Capital Health Hopewell, RWJ Lake Tower, Princeton's Andlinger Center and Firestone Library, Hope Tower and Johnson & Johnson." },
  { name: "Michele James", role: "Office Manager", since: 2007, email: "michele@seanslandscaping.com", bio: "Directs all incoming inquiries and keeps every project running smoothly — from the initial bid invitation to close-out." },
  { name: "Ernie Funari", role: "Lead Estimator", since: 2015, email: "ernie@seanslandscaping.com", bio: "Brings detail-oriented estimates to every part of a project, from green roofs to ground-level landscapes." },
];

export const extraContacts = [
  { name: "Bradley Palmer", role: "Aftercare", email: "brad@seanslandscaping.com" },
  { name: "Ryan Brady", role: "Office", email: "seanslandscapinginc@gmail.com" },
  { name: "Brenna Brady", role: "Office", email: "seanslandscapinginc@gmail.com" },
];

export const licenses = [
  ["NJ Business Contractor", "License #13VH00954100"],
  ["NJ Business", "License #13VH02240100"],
  ["NJ Business", "Certificate #0648480"],
  ["NJ Public Works Contractor", "Registered — NJ Dept. of Labor & Workforce Development"],
  ["NJ Plant Dealer", "Certificate #11004215"],
  ["NJ Dept. of Agriculture", "Plant Nursery"],
  ["NJ Pesticide Applicator Business", "License #90789B"],
  ["PA Pesticide Applicator Business", "License #BU12579"],
  ["NJ Landscape Irrigation", "License #285761"],
  ["Delaware Business", "License #2012603360"],
  ["City of Philadelphia Business", "License #581170"],
  ["Pennsylvania Business", "License #4125354"],
];

export const certifications = [
  "Certified Roof Meadows Green Roof Contractor",
  "Certified American Hydrotech Contractor",
  "LiveRoof Certified Contractor",
  "ISNetworld Registered — #400-222281",
  "Avetta Member since 08/2017",
  "Paymode & Textura Registered",
  "NJ Small Business Entity",
  "Brady Services LLC — WBE",
];

export const unions = [
  "Operating Engineers Local 825",
  "Laborers Locals 172 & 472",
  "Building Trades Local 77",
  "Laborers Local 332 (Philadelphia)",
  "Bricklayers & Allied Craftworkers Local 1 (PA/NJ)",
  "Operating Engineers Local 542 (PA)",
];

export const surety = "Allegheny Casualty Co. (through KOG International)";

export const clients = ["A&E Construction", "AP Construction", "Bancroft USA", "Bannett Group", "Barr & Barr", "Barrett Builders, LLC", "BDT Group Construction", "Bedwell Co.", "Bencardino Excavating", "Brandywine Realty Trust", "Breaker Electric", "Capital Health Hamilton", "CentraState Healthcare System", "Daniel J. Keating", "Delco", "Du-Rite Construction, Inc.", "E.P. Guidi, Inc.", "Enviroscapes, Inc.", "Epic Management", "Erickson & Sons", "FH Paschen Construction", "Fitzpatrick & Associates", "FJ Sciame Construction Co.", "Furbish", "Furino & Sons", "Garcia Sequeira, Inc.", "GeoMatrix Construction", "George M. Pastor & Sons", "Gilbane", "Golden Crown Contractors", "Gres Paving", "Hamilton Township", "HSC Builders & Construction Mgrs.", "Hunt Construction Group", "Hunter Roberts Construction Group", "Haines & Kibblehouse", "IMC Construction", "Intech Construction", "Jeffrey M. Brown Assoc. Inc.", "Jonathan Alderson Landscape Architects", "Joseph Natoli Construction", "JPC Group", "L.F. Driscoll Co.", "Major Builders", "March Assoc.", "Massimino Building Corp.", "McCormick Mgmt Services", "McDonald Building Co.", "Mercer County Community College", "Meridian Health", "Michael Riesz & Co.", "Michael Van Valkenburgh Associates", "Miller Brothers", "Penn Presbyterian Medical Center", "Pennsylvania Horticultural Society", "Philadelphia Museum of Art", "PHJ Architecture", "Pike Construction", "Princeton University", "Rodney Robinson Landscape Architects", "RSI Construction", "RWJBH Hospital at Hamilton", "Sano-Rubin Construction", "Santoni", "Shawmut Design & Construction", "Shoemaker Synterra", "Sikora Wells Appel", "Skanska USA", "Sordoni Construction", "Stony Brook-Millstone Watershed Association", "Structure Tone", "Target Building Construction", "Tend Landscape", "Thomas Roofing", "Tishman Construction", "TN Ward Co.", "TolTest, Inc.", "Turner Construction", "Tutor Perini", "University of Pennsylvania Medical Centers", "Vollers Excavating & Construction", "Warfel Construction", "Waters & Bugbee", "WH Myers", "Whiting-Turner Contracting Co.", "William Blanchard Co."];

export const collaborators = [
  ["Advanced Coring & Cutting Corp.", "Concrete coring for irrigation, water features and lighting"],
  ["Breaker Electric", "Lighting up our projects — Freehold, NJ"],
  ["Bucks Concrete Services, Inc.", "Conveyor placement of bulk soil and stone"],
  ["Downes Forest Products", "Erosion control and soil aggregate — Hawthorne, NJ"],
  ["Mercer Tree Service", "Tree pruning, removal and stump removal — Hamilton, NJ"],
  ["Superior Groundcover", "Soil-mix pumping systems — Hudsonville, MI"],
  ["Jorge Brothers", "Concrete finishing — South River, NJ"],
];

export const suppliers = ["Accessible Gardens", "Acme/Lingo Flagpole", "ADR Bulbs", "Advanced Coring and Cutting Corp.", "American Hydrotech", "Angersteins", "Architectural Playground Equipment", "ARJ Custom Fabricators", "Atlantic Irrigation", "A.M. Leonard", "Applewood Seed", "Britton Industries", "Caterina Supply", "Certified Testing Laboratories Inc.", "Chesterfield Gardens Inc.", "Church Brick Co.", "Clayton Block", "Clayton Concrete", "Code Impex Granite Importers", "Collins Wharf Sod", "Cora Bike", "Creston Hydraulics", "C.W. Gravatt & Son Inc.", "Dal-Tile", "Delaware Quarries", "DeepRoot Green Infrastructure LLC", "Dero Bike Racks", "Design Plastic Systems", "Diadem USA Inc.", "Diggers Tree Service", "EME Inc.", "Ernst Seed", "Evergreen Slate", "FastSigns", "Fernbrook Nursery", "Forms & Surfaces", "Fountain Supply Co.", "Garden State Bobcat", "Garden State Precast", "Gatti Morrison", "Generator & Starter Exchange", "Glazelock Shims Inc.", "Greenpro Material", "Hajoca", "Hanes Geo", "Hanover Architectural Products", "Harmony Sand & Gravel", "HMA Concrete", "Interstate Aerials", "Irrigation Technologies", "JD Russell", "JDM Materials", "J. Thomas Parts", "Jerith Manufacturing", "Jesco", "John Deere Landscapes", "Johnston & Rhodes", "Jorge Brothers", "Jonathan Green Seeds", "JP Steffer LLC", "Kenseal Construction Material", "Krando Metal Products", "KubePak Floral Supply", "Kuckner Haney Paint Co.", "Landscape Forms Inc.", "Laurel Valley Farms", "Lincoln Supply", "Live Wall", "Marble & Granite Fabricators Inc.", "Mercer Group International", "Mershon Concrete", "Met Fin Co. Inc.", "MJ Ironworks", "Modern Equipment Rental", "Mountain View Layout Services", "National Reprographics", "National Seed Co. of NJ Inc.", "NJ Gravel & Sand", "North Creek Nurseries", "Northeast Fence", "Nottie Corp.", "Nova Crete", "Onyx Fasteners", "Ottey & Hoopes Granite", "Penn Jersey", "Penn Stainless", "Permaloc Corp.", "Pinelands Nursery", "Planters Unlimited", "Platipus Anchors Inc.", "Pleasant Run Nursery", "Premier Trailer", "Quality Woods", "Rappleyea's Nursery", "Reeds Sod Farm", "Riephoff Saw Mill", "Riverbend Nursery", "Roman Fountains", "Safety Turf, Inc.", "Schofield Stone", "Select Tree Farms, Inc.", "Shemin Nurseries, Inc.", "Sign-A-Rama", "Silvi Concrete", "SiteOne Landscape Supply", "Skyland USA LLC", "South Jersey Well Drilling Inc.", "Specialty Deck Supply Co.", "StepStone", "Stevenson Supply Co. Inc.", "Stone Forest", "Staples Engineering Bond", "Sunbelt Rentals", "Superior Groundcover", "Taylor Oil Co.", "Taylor Rental", "Thievon Horticultural", "Tidwell Nurseries", "Timothy's", "Tompkins Bluestone", "Tournesol Siteworks", "Trap Rock", "Trenton Sheet Metal", "Tuckahoe Nurseries", "United Detailers, Inc.", "V&S Delaware Galvanizing LLC", "Vinch Recycling Inc.", "Waterproofing Systems Inc.", "Wausau Tile", "Weatherend Furniture", "Wolbert and Master", "Yarde Metals", "Yardville Supply", "ZinCo USA Inc.", "Zone Striping"];

export const equipment = ["2018/11/SEANS0044-1600x1200.jpg", "2018/11/JCB-lul-7_21_17_2560-1200x1600.jpg", "2018/11/SEANS0047-1600x1200.jpg", "2018/11/SEANS0062-1600x1200.jpg", "2018/11/SEANS0064-1600x1200.jpg", "2018/11/SEANS0071-1600x1200.jpg", "2018/11/SEANS0076-1600x1200.jpg", "2018/11/SEANS086-1600x1200.jpg", "2018/11/IMG_8539_2560-1600x1200.jpg", "2018/11/125-1600x1200.jpg", "2018/11/SEANS096-1600x1200.jpg", "2018/11/SEANS097-1600x1200.jpg"];
