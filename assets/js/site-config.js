/**
 * Aurelia Residences — editable content.
 *
 * Every value in square brackets in the markup is a placeholder. Change them
 * here and the page updates itself (see applyConfig in main.js). The markup
 * already contains working demo values, so the site is fully readable even if
 * this file is never edited and even with JavaScript disabled.
 */
export const site = {
  brand: 'Aurelia Residences',
  property: 'Aurelia House',

  /* Location — the working demo assumes a Mediterranean waterfront address. */
  city: 'Marbella',
  region: 'Andalusia',
  country: 'Spain',
  location: 'Marbella, Spain',
  locale: 'en_GB',

  /* Credibility section: replace with the real names and dates you are
     allowed to publish, or leave the bracketed placeholders in place. */
  studio: '[STUDIO NAME]',
  developer: '[DEVELOPER NAME]',
  completion: '[DATE]',
  release: '[DATE]',

  /* Contact details shown in the footer and after a viewing request. */
  email: 'residences@aurelia.example',
  phone: '+34 951 23 45 67',
  whatsapp: '34951234567',
  instagram: 'https://www.instagram.com/',

  /* Approximate travel times — editable sample information for the demo. */
  travel: {
    city: '[8 min]',
    airport: '[15 min]',
    marina: '[12 min]',
    school: '[5 min]'
  },

  /* Property facts. These feed the structured data and the snapshot grid. */
  facts: {
    type: 'Private waterfront villa',
    interior: 620,
    plot: 1200,
    bedrooms: 5,
    bathrooms: 6,
    availability: 'Private release'
  }
};

export default site;
