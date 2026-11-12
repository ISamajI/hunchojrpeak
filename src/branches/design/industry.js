// Industry knowledge: detection, typical services (phrased generically — never claims
// about this specific business), voice, schema.org type and photographic subjects.

export const INDUSTRIES = {
  barber: {
    match: /barber|hairdresser|hair/i, schema: 'HairSalon', noun: 'barbershop',
    services: [
      ['Signature Cut', 'Consultation, precision cut and a finish styled for how you actually wear it.'],
      ['Skin Fade', 'Seamless graduation from skin, blended by hand and detailed with a straight edge.'],
      ['Beard Sculpt', 'Shape, line-up and condition — tailored to your jaw and growth pattern.'],
      ['Hot Towel Shave', 'Steamed towels, rich lather and a close straight-razor shave.'],
      ['Kids Cut', 'Patient, quick and clean — for the youngest regulars.'],
    ],
    headlines: { luxe: ['The Art of the Cut', 'Precision, Unhurried', 'Sharp by Design'], bold: ['Fresh Cuts. No Shortcuts.', 'Fades That Speak', 'Built for the Chair'], warm: ['Your Neighbourhood Chair', 'Good Cuts, Good Company'] },
    sub: {luxe: 'Considered cuts, unhurried service and a finish you notice.', bold: 'Sit down, switch off, leave sharp.', warm: 'Good cuts, easy conversation, right in the neighbourhood.'},
    cta: 'Book a Chair', subjects: {
      hero: 'a barber\'s hands mid-fade with clippers, client in a classic leather barber chair, mirror reflections softly out of focus',
      story: 'barbershop interior details: straight razors, leather strop, vintage chair, warm pendant light',
      services: ['close-up of a precise skin fade line on the side of a head', 'beard being shaped with scissors and comb in profile', 'hot towel steam rising over a reclined client'],
    },
  },
  tattoo: {
    match: /tattoo/i, schema: 'TattooParlor', noun: 'studio',
    services: [['Custom Pieces', 'Original designs drawn with you, from first sketch to final line.'], ['Fine Line', 'Delicate, precise linework and lettering.'], ['Cover-Ups', 'Thoughtful redesigns that give old work new life.'], ['Touch-Ups', 'Refreshing healed work so it stays sharp.']],
    headlines: { luxe: ['Ink, Considered'], bold: ['Wear Your Story', 'Lines That Last'], warm: ['Art You Live With'] },
    sub: {luxe: 'Original work, drawn with you and built to last a lifetime.', bold: 'Custom work with clean lines and zero compromise.', warm: 'A friendly studio for your next piece.'},
    cta: 'Book a Consultation', subjects: { hero: 'tattoo artist\'s gloved hands working a fine-line design on a forearm, shallow depth of field, studio lamp', story: 'studio flash sheets pinned on a wall, ink caps, sketchbook', services: ['custom sketch on tracing paper', 'fine-line needle close-up', 'healed blackwork on skin'] },
  },
  beauty: {
    match: /beauty|nail|salon|spa|lash|brow/i, schema: 'BeautySalon', noun: 'salon',
    services: [['Signature Manicure', 'Shaping, cuticle care and a flawless, long-wearing finish.'], ['Luxe Pedicure', 'Soak, exfoliation and massage, finished with polish of your choice.'], ['Gel & Builder Sets', 'Durable, natural-looking strength and shape.'], ['Brows & Lashes', 'Shaping, tinting and lifts that frame the face.']],
    headlines: { luxe: ['Quiet Luxury, Every Visit', 'Beauty, Unhurried'], bold: ['Look Good. Feel Better.'], warm: ['Your Hour of Calm', 'Made to Feel Like You'] },
    sub: {luxe: 'Considered treatments, calm surroundings and a finish that lasts.', bold: 'Nails, brows and lashes done with precision.', warm: 'Your hour to slow down and be looked after.'},
    cta: 'Book an Appointment', subjects: { hero: 'manicured hands resting on soft linen with a ceramic dish, diffused window light', story: 'calm salon interior with curved mirror, dried flowers, soft blush tones', services: ['nail technician applying gel polish close-up', 'pedicure basin with petals and warm water', 'brow shaping with a fine brush in profile'] },
  },
  restaurant: {
    match: /restaurant|fast_food|food|kitchen|grill|pizza|taco|bistro|diner|trattoria/i, schema: 'Restaurant', noun: 'kitchen',
    services: [['Dine In', 'A seat at the table, plates straight from the pass.'], ['Takeout', 'Packed with care so it travels well.'], ['Catering', 'Feeding your celebration, office or event.'], ['Daily Specials', 'What the kitchen is excited about today.']],
    headlines: { luxe: ['Made by Fire, Served with Care'], bold: ['Come Hungry', 'Big Flavour, Every Plate'], warm: ['Pull Up a Chair', 'Cooked Like We Mean It', 'Your Table Is Ready'] },
    sub: {luxe: 'Seasonal cooking, generous hospitality and a table worth lingering at.', bold: 'Big flavour, honest plates, no shortcuts.', warm: 'Hearty food and warm welcomes, every night.'},
    cta: 'Reserve a Table', subjects: { hero: 'chef plating a dish at the pass under warm heat lamps, steam rising, motion in the background kitchen', story: 'rustic dining room with set tables, candlelight and warm wood, evening', services: ['overhead shot of shared plates on a wooden table', 'takeout bag being packed on a stainless counter', 'catering spread on long table with natural light'] },
  },
  cafe: {
    match: /cafe|coffee|bakery|espresso|roaster/i, schema: 'CafeOrCoffeeShop', noun: 'café',
    services: [['Espresso Bar', 'Classic drinks pulled with care, all day.'], ['Fresh Bakes', 'Pastries and bread baked through the morning.'], ['Breakfast & Lunch', 'Simple, seasonal plates done properly.'], ['Catering Orders', 'Coffee and bakes for meetings and events.']],
    headlines: { luxe: ['The Ritual, Perfected'], bold: ['Coffee Worth Crossing Town For'], warm: ['Your Morning Starts Here', 'Slow Coffee, Good Company', 'The Neighbourhood Table'] },
    sub: {luxe: 'Carefully sourced coffee and bakes made with patience.', bold: 'Serious coffee, fresh bakes, no fuss.', warm: 'Great coffee, fresh bakes and a seat by the window.'},
    cta: 'Visit Today', subjects: { hero: 'barista pouring latte art into a ceramic cup, morning side light, shallow depth of field', story: 'café counter with pastries under glass, wooden shelves, plants', services: ['espresso extraction close-up from a portafilter', 'croissants on a cooling rack dusted with flour', 'breakfast plate on a marble table by a window'] },
  },
  auto: {
    match: /car_repair|auto|mechanic|tire|tyre|garage|collision/i, schema: 'AutoRepair', noun: 'shop',
    services: [['Diagnostics', 'Computer diagnostics and a clear explanation before any work.'], ['Brakes & Suspension', 'Inspection, pads, rotors and steering components.'], ['Oil & Maintenance', 'Scheduled service that keeps your warranty and engine happy.'], ['General Repair', 'From check-engine lights to the strange noises.']],
    headlines: { luxe: ['Engineered Care'], bold: ['Honest Work. Back on the Road.', 'Fixed Right the First Time'], warm: ['Your Local Garage'] },
    sub: {luxe: 'Meticulous diagnostics and repairs explained in plain language.', bold: 'Straight answers, quality parts, back on the road fast.', warm: 'Honest repairs from a local shop you can trust.'},
    cta: 'Request Service', subjects: { hero: 'mechanic under a lifted car in a clean workshop, orange work light rim-lighting the chassis', story: 'organized tool wall in a garage, socket sets, cool fluorescent light', services: ['diagnostic tablet plugged into a car OBD port', 'brake rotor and caliper close-up', 'engine oil being poured, golden backlight'] },
  },
  health: {
    match: /dentist|dental|clinic|doctor|health|physio|chiro|optometr/i, schema: 'Dentist', noun: 'practice',
    services: [['Checkups & Cleanings', 'Thorough, gentle preventative care.'], ['Consultations', 'Unhurried time to talk through your options.'], ['Treatments', 'Modern care explained clearly, step by step.'], ['New Patients', 'Easy first visits and transfers.']],
    headlines: { luxe: ['Care, Considered'], bold: ['Modern Care, Made Easy'], warm: ['Care You Can Count On', 'Calm, Gentle, Thorough'] },
    sub: {luxe: 'Unhurried appointments and modern care, explained clearly.', bold: 'Modern care that fits around your life.', warm: 'Gentle, thorough care for the whole family.'},
    cta: 'Request an Appointment', subjects: { hero: 'bright modern clinic room with soft daylight and calm teal accents, no people', story: 'reception with plants and natural wood, airy and calm', services: ['clinician hands with dental mirror, soft focus', 'consultation desk with tablet and chairs', 'clean treatment room detail'] },
  },
  fitness: {
    match: /fitness|gym|crossfit|yoga|pilates|boxing/i, schema: 'ExerciseGym', noun: 'gym',
    services: [['Open Gym', 'Quality equipment and room to train.'], ['Personal Training', 'Coaching built around your goals.'], ['Group Classes', 'Energy, structure and people who show up.'], ['Memberships', 'Flexible options to fit your schedule.']],
    headlines: { luxe: ['Train With Intent'], bold: ['Show Up. Get Stronger.', 'No Shortcuts'], warm: ['Your Community Gym'] },
    sub: {luxe: 'Thoughtful coaching and space to train with intent.', bold: 'Real equipment, real coaching, real results.', warm: 'A welcoming gym where everyone belongs.'},
    cta: 'Start Training', subjects: { hero: 'athlete mid-deadlift in a dark gym, dramatic rim light, chalk dust in the air', story: 'rack of dumbbells and kettlebells, moody overhead light', services: ['coach spotting a lift', 'group class in motion blur', 'close-up of chalked hands on a barbell'] },
  },
  retail: {
    match: /clothes|clothing|shoes|boutique|jewel|gift|store|shop/i, schema: 'Store', noun: 'store',
    services: [['New Arrivals', 'The latest pieces, chosen with care.'], ['Best Sellers', 'The pieces customers keep coming back for.'], ['In-Store Pickup', 'Order ahead and collect when it suits you.'], ['Gift Cards', 'The easy, always-right gift.']],
    headlines: { luxe: ['Curated, Not Crowded'], bold: ['Style That Speaks'], warm: ['Pieces You\'ll Keep'] },
    sub: {luxe: 'A carefully edited collection, chosen piece by piece.', bold: 'Statement pieces you won’t find anywhere else.', warm: 'Thoughtful finds and friendly help in store.'},
    cta: 'Visit the Store', subjects: { hero: 'curated product display on a plinth with gallery lighting and long soft shadows', story: 'boutique interior with clothing rail and natural materials', services: ['folded garments with texture detail', 'product flat-lay on linen', 'gift box with ribbon on a marble surface'] },
  },
  trades: {
    match: /plumb|electric|contractor|craft|roof|hvac|carpent|landscap|clean/i, schema: 'HomeAndConstructionBusiness', noun: 'team',
    services: [['Repairs', 'Fast, tidy fixes done properly.'], ['Installations', 'New systems fitted to code and explained clearly.'], ['Inspections', 'Honest assessments before you spend.'], ['Emergency Calls', 'Help when it can\'t wait.']],
    headlines: { luxe: ['Craftsmanship You Can Trust'], bold: ['Done Right the First Time'], warm: ['Your Local Pros', 'Reliable, Local, On Time'] },
    sub: {luxe: 'Careful workmanship, clear quotes and tidy job sites.', bold: 'Fast response, fair quotes, done right the first time.', warm: 'Reliable local pros who show up when they say.'},
    cta: 'Get a Free Quote', subjects: { hero: 'tradesperson\'s hands with tools on a clean job site, clear daylight', story: 'organized work van interior with labeled tool cases', services: ['close-up of precise pipe fitting', 'electrical panel with neat wiring', 'inspection with flashlight and clipboard'] },
  },
  general: {
    match: /./, schema: 'LocalBusiness', noun: 'business',
    services: [['Our Services', 'What we do best, done properly.'], ['Consultations', 'Time to understand exactly what you need.'], ['Custom Orders', 'Tailored to the job in front of us.'], ['Local Delivery', 'Bringing it to your door.']],
    headlines: { luxe: ['Quality, Quietly'], bold: ['Proudly Local'], warm: ['Here for Our Community'] },
    sub: {luxe: 'Quality work and personal service, done properly.', bold: 'Local, reliable and ready when you are.', warm: 'Friendly, reliable and right here in the community.'},
    cta: 'Get in Touch', subjects: { hero: 'welcoming storefront detail at golden hour, shallow depth of field', story: 'hands at work in a small business interior', services: ['detail of craftsmanship', 'friendly counter interaction, faces not visible', 'neatly organized workspace'] },
  },
};

export function industryOf(category) {
  const c = String(category || '');
  for (const [key, ind] of Object.entries(INDUSTRIES)) if (key !== 'general' && ind.match.test(c)) return key;
  return 'general';
}

export function voiceOf(direction) {
  if (['noir-atelier', 'soft-salon', 'gallery-minimal', 'clinical-calm'].includes(direction.id)) return 'luxe';
  if (['street-grade', 'kinetic', 'precision-garage'].includes(direction.id)) return 'bold';
  return 'warm';
}

/** Parse simple OSM opening_hours like "Mo-Sa 09:00-19:00; Su off" → readable rows + days open. */
export function parseHours(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const NAMES = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
  const rows = [];
  const open = new Set();
  for (const part of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
    if (!m) return { text: raw, rows: null, daysOpen: null };
    const days = [];
    for (const seg of m[1].split(',')) {
      const [a, b] = seg.split('-');
      const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i;
      for (let k = i; k <= j; k++) days.push(DAYS[k]);
    }
    const closed = /^off|closed$/i.test(m[2]);
    if (!closed) days.forEach((d) => open.add(d));
    rows.push({ days: days.length > 1 ? `${NAMES[days[0]]}–${NAMES[days.at(-1)]}` : NAMES[days[0]], hours: closed ? 'Closed' : m[2].replace(/-/g, '–') });
  }
  return { text: raw, rows, daysOpen: open.size };
}
