// CLAVO DULCE — Analytics & Data.
// Opportunity score 0-100: how much LTGPeak can improve this business's web presence.
// Every point is tied to an observed finding, so the score is explainable.

export function scoreOpportunity(business, site, siteError) {
  let value = 0;
  const reasons = [];
  const add = (pts, why) => { value += pts; reasons.push(`+${pts} ${why}`); };

  if (!business.website) {
    add(55, 'no website listed');
  } else if (siteError || !site) {
    add(45, `website unreachable (${siteError || 'no response'})`);
  } else {
    if (site.status >= 400) add(40, `website returns HTTP ${site.status}`);
    if (!site.https) add(10, 'no HTTPS');
    if (!site.mobile_viewport) add(15, 'not mobile-friendly (no viewport meta)');
    if (['Wix', 'GoDaddy Builder', 'Weebly'].includes(site.platform)) add(8, `built on ${site.platform} template`);
    const year = new Date().getFullYear();
    if (site.copyright_year && year - site.copyright_year >= 3) add(10, `copyright footer stale (${site.copyright_year})`);
    if (!site.description) add(5, 'missing meta description (SEO)');
    if (!site.has_schema_org) add(4, 'no structured data (local SEO)');
    if (!site.has_booking && /hair|barber|beauty|salon|spa|nail|dentist|tattoo|fitness|gym/i.test(business.category || '')) add(10, 'no online booking for an appointment business');
    if (!site.has_online_ordering && /restaurant|cafe|bakery|fast_food/i.test(business.category || '')) add(6, 'no online ordering link');
    if (!site.has_contact_form) add(4, 'no contact form');
    if (site.response_ms > 3000) add(6, `slow response (${site.response_ms}ms)`);
    if (site.text_length < 400) add(6, 'very thin content');
  }
  // Reachability: we need a way to contact them.
  if (!business.email && !business.phone) {
    value -= 20;
    reasons.push('-20 no email or phone to reach them');
  }
  const rating = business.raw?.rating;
  const reviews = business.raw?.review_count;
  if (rating >= 4.3 && reviews >= 25) add(8, `strong reputation (${rating}★, ${reviews} reviews) worth showcasing`);

  value = Math.max(0, Math.min(100, value));
  const tier = value >= 60 ? 'hot' : value >= 40 ? 'warm' : 'cold';
  return { value, tier, reasons };
}
