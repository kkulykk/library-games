// Curated destination pool for Globetrotter. Pure data — no React, no logic.
// Coordinates are approximate landmark positions (good to well under the
// 25 km bullseye radius, which is all the scoring needs).

/**
 * A 360° equirectangular panorama of the location. The curated pool below is
 * hand-picked from Wikimedia Commons (freely licensed, CORS-enabled,
 * hotlinking permitted); Random World rounds also come from Panoramax. `url`
 * is a rendition sized for WebGL textures, `page` the archive's own page for
 * the picture, used for attribution.
 */
export interface GeoPano {
  url: string
  page: string
  author: string
  license: string
  /**
   * Archive the panorama came from, credited alongside the photographer.
   * Absent on the curated pool and the offline reserve, which are Commons
   * throughout.
   */
  source?: string
}

/** Reverse-geocoded settlement, filled in for Random World rounds. */
export interface GeoPlace {
  name: string
  country: string | null
}

export interface GeoLocation {
  name: string
  country: string
  lat: number
  lng: number
  emoji: string
  clues: string[]
  pano?: GeoPano
  place?: GeoPlace
}

export const LOCATIONS: GeoLocation[] = [
  {
    name: 'Eiffel Tower',
    country: 'France',
    lat: 48.858,
    lng: 2.294,
    emoji: '🗼',
    clues: [
      'You are in a temperate European capital split by a slow, romantic river.',
      'Locals carry baguettes past Haussmann façades and café terraces.',
      'A wrought-iron lattice tower from an 1889 world fair dominates the skyline.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Pont_de_Bir-Hakeim_and_the_Eiffel_Tower%2C_April_2007.jpg/3840px-Pont_de_Bir-Hakeim_and_the_Eiffel_Tower%2C_April_2007.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Pont_de_Bir-Hakeim_and_the_Eiffel_Tower,_April_2007.jpg',
      author: 'Alexandre Duret-Lutz',
      license: 'CC BY-SA 2.0',
    },
  },
  {
    name: '9/11 Memorial',
    country: 'United States',
    lat: 40.711,
    lng: -74.013,
    emoji: '🗽',
    clues: [
      'You are among dense skyscrapers near the tip of an Atlantic harbor island.',
      'Yellow cabs stream past, and a copper-green statue lifts her torch across the water.',
      'Two vast reflecting pools sit in the footprints of fallen twin towers.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Ground-Zero-Memorial-Photo-Sphere.jpg/3840px-Ground-Zero-Memorial-Photo-Sphere.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Ground-Zero-Memorial-Photo-Sphere.jpg',
      author: 'MartinThoma',
      license: 'CC0',
    },
  },
  {
    name: 'Great Pyramid of Giza',
    country: 'Egypt',
    lat: 29.979,
    lng: 31.134,
    emoji: '🐪',
    clues: [
      'You are on a dusty desert plateau at the edge of a huge African metropolis.',
      'Camels plod past vendors, and a great river delta lies just to the east.',
      'Three ancient royal tombs rise from the sand beside a lion-bodied statue.',
    ],
  },
  {
    name: 'Sydney Opera House',
    country: 'Australia',
    lat: -33.857,
    lng: 151.215,
    emoji: '🎭',
    clues: [
      'You are in a sunny southern-hemisphere harbor city where December is beach season.',
      'Ferries criss-cross the bay beneath a giant steel arch bridge.',
      'White sail-shaped shells house one of the most famous concert halls on Earth.',
    ],
  },
  {
    name: 'Machu Picchu',
    country: 'Peru',
    lat: -13.163,
    lng: -72.545,
    emoji: '⛰️',
    clues: [
      'You are high in a misty South American mountain range, short of breath.',
      'Llamas graze on terraces and a famous multi-day trekking trail ends here.',
      'A lost 15th-century Inca citadel clings to a ridge above a river gorge.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Mapillary_%2838thnbClp0kOZUc5WNDfYK%29_%28jaderbavaresco%29_2023-12-29_09H43M40S750_%28751996310315754_via_GoPro_GoPro_Max%29.jpg/3840px-Mapillary_%2838thnbClp0kOZUc5WNDfYK%29_%28jaderbavaresco%29_2023-12-29_09H43M40S750_%28751996310315754_via_GoPro_GoPro_Max%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Mapillary_(38thnbClp0kOZUc5WNDfYK)_(jaderbavaresco)_2023-12-29_09H43M40S750_(751996310315754_via_GoPro_GoPro_Max).jpg',
      author: 'jaderbavaresco',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Taj Mahal',
    country: 'India',
    lat: 27.175,
    lng: 78.042,
    emoji: '🕌',
    clues: [
      'You are on a hot river plain in South Asia, and the traffic is chaos.',
      'Rickshaws honk past street vendors selling chai and samosas.',
      'A white marble mausoleum built by an emperor for his wife glows at dawn.',
    ],
  },
  {
    name: 'Great Wall at Mutianyu',
    country: 'China',
    lat: 40.432,
    lng: 116.57,
    emoji: '🧱',
    clues: [
      'You are on a ridge of green hills north of a vast East Asian capital.',
      'Watchtowers march along the mountain crests as far as you can see.',
      'You are standing on a stone fortification thousands of kilometers long.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Mutianyu_%E2%80%93_Panorama_%28Greg_Zaal_via_Poly_Haven%29.jpg/3840px-Mutianyu_%E2%80%93_Panorama_%28Greg_Zaal_via_Poly_Haven%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Mutianyu_%E2%80%93_Panorama_(Greg_Zaal_via_Poly_Haven).jpg',
      author: 'Greg Zaal',
      license: 'CC0',
    },
  },
  {
    name: 'Christ the Redeemer',
    country: 'Brazil',
    lat: -22.952,
    lng: -43.21,
    emoji: '⛪',
    clues: [
      'You are on a granite peak above a South American beach city famous for carnival.',
      'Below you, samba drifts up from Copacabana and Ipanema.',
      'An enormous art-deco statue spreads its arms over the bay.',
    ],
  },
  {
    name: 'Colosseum',
    country: 'Italy',
    lat: 41.89,
    lng: 12.492,
    emoji: '🏛️',
    clues: [
      'You are in a Mediterranean capital where every street corner hides ruins.',
      'Espresso is drunk standing up, and scooters swarm the cobblestones.',
      'A 2,000-year-old elliptical amphitheater once hosted gladiators here.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg/3840px-Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Colosseum_%E2%80%93_Panorama_(Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven).jpg',
      author: 'Greg Zaal (Panorama)',
      license: 'CC0',
    },
  },
  {
    name: 'Westminster, London',
    country: 'United Kingdom',
    lat: 51.5,
    lng: -0.125,
    emoji: '🕰️',
    clues: [
      'You are in a drizzly island capital where traffic drives on the left.',
      'Red double-decker buses roll past a river lined with government buildings.',
      'A famous clock tower chimes beside a gothic parliament.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/360_panoramic_view_of_Westminster_Abbey%2C_London%2C_UK.jpg/1920px-360_panoramic_view_of_Westminster_Abbey%2C_London%2C_UK.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:360_panoramic_view_of_Westminster_Abbey,_London,_UK.jpg',
      author: 'Subhashish Panigrahi',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Mount Fuji',
    country: 'Japan',
    lat: 35.361,
    lng: 138.727,
    emoji: '🗻',
    clues: [
      'You are on an island nation in East Asia where bullet trains glide past.',
      'Vending machines and torii gates dot the villages around a great lake.',
      'A perfectly symmetrical snow-capped volcano towers over everything.',
    ],
  },
  {
    name: 'Santorini',
    country: 'Greece',
    lat: 36.393,
    lng: 25.461,
    emoji: '🌅',
    clues: [
      'You are on a crescent-shaped Mediterranean island formed by a volcanic eruption.',
      'Donkeys carry visitors up cliff paths from a deep blue caldera.',
      'Whitewashed houses with blue domes spill down the cliffs at sunset.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Imerovigli_view_from_drone_-_Santorini.jpg/3840px-Imerovigli_view_from_drone_-_Santorini.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Imerovigli_view_from_drone_-_Santorini.jpg',
      author: 'User:Anna.Tsolidou',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Petra',
    country: 'Jordan',
    lat: 30.329,
    lng: 35.444,
    emoji: '🏜️',
    clues: [
      'You are walking through a narrow desert canyon in the Middle East.',
      'Bedouin guides offer rides past tombs cut into rose-colored rock.',
      'The canyon opens onto a treasury façade carved into the cliff itself.',
    ],
  },
  {
    name: 'Angkor Wat',
    country: 'Cambodia',
    lat: 13.412,
    lng: 103.867,
    emoji: '🛕',
    clues: [
      'You are in humid Southeast Asian jungle, and strangler figs swallow old stones.',
      'Monks in orange robes walk causeways over a vast moat.',
      'The largest religious monument on Earth — a Khmer temple city — surrounds you.',
    ],
  },
  {
    name: 'Golden Gate Bridge',
    country: 'United States',
    lat: 37.82,
    lng: -122.478,
    emoji: '🌉',
    clues: [
      'You are on a foggy Pacific-coast strait beside a hilly tech-obsessed city.',
      'Cable cars climb the streets and sea lions bark at the piers.',
      'An "international orange" suspension bridge vanishes into the mist.',
    ],
  },
  {
    name: 'Niagara Falls',
    country: 'Canada',
    lat: 43.08,
    lng: -79.074,
    emoji: '💦',
    clues: [
      'You are on a border between two large North American countries.',
      'Everyone around you is wearing a plastic poncho on a tour boat.',
      'A horseshoe-shaped curtain of water thunders over the edge.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/360_photo_between_Horseshoe_and_American_Falls_Niagara_Falls_Canada_2025-09-06_19-12-46_1.jpg/3840px-360_photo_between_Horseshoe_and_American_Falls_Niagara_Falls_Canada_2025-09-06_19-12-46_1.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:360_photo_between_Horseshoe_and_American_Falls_Niagara_Falls_Canada_2025-09-06_19-12-46_1.jpg',
      author: 'G. Edward Johnson',
      license: 'CC BY 4.0',
    },
  },
  {
    name: 'Stonehenge',
    country: 'United Kingdom',
    lat: 51.179,
    lng: -1.826,
    emoji: '🪨',
    clues: [
      'You are on a windswept green plain in northwestern Europe.',
      'Sheep graze around earthworks older than the pyramids.',
      'A prehistoric ring of standing stones aligns with the solstice sun.',
    ],
  },
  {
    name: 'Sagrada Família',
    country: 'Spain',
    lat: 41.404,
    lng: 2.174,
    emoji: '🏗️',
    clues: [
      'You are in a Mediterranean city laid out on a giant grid with chamfered corners.',
      'Tapas bars line boulevards full of Gaudí’s wavy architecture.',
      'A basilica has been under construction here since 1882 — and still is.',
    ],
  },
  {
    name: 'Burj Khalifa',
    country: 'United Arab Emirates',
    lat: 25.197,
    lng: 55.274,
    emoji: '🏙️',
    clues: [
      'You are in a scorching Gulf city that grew from desert in a single generation.',
      'Indoor ski slopes and gold souks share the same skyline.',
      'You crane your neck at the tallest building humans have ever built.',
    ],
  },
  {
    name: 'Table Mountain',
    country: 'South Africa',
    lat: -33.963,
    lng: 18.409,
    emoji: '🏔️',
    clues: [
      'You are at the meeting point of two oceans at the tip of a continent.',
      'Penguins waddle on nearby beaches while a cable car climbs behind the city.',
      'A perfectly flat-topped mountain wears a "tablecloth" of cloud.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Wikimania_2018_scouting_trip%2C_Table_Mountain_-_360_degrees.jpg/3840px-Wikimania_2018_scouting_trip%2C_Table_Mountain_-_360_degrees.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Wikimania_2018_scouting_trip,_Table_Mountain_-_360_degrees.jpg',
      author: 'Discott',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Serengeti Plains',
    country: 'Tanzania',
    lat: -2.333,
    lng: 34.833,
    emoji: '🦁',
    clues: [
      'You are on endless golden savanna just south of the equator in East Africa.',
      'A million wildebeest rumble past your safari jeep in the great migration.',
      'Lions doze under acacia trees in Africa’s most famous national park.',
    ],
  },
  {
    name: 'Victoria Falls',
    country: 'Zambia',
    lat: -17.924,
    lng: 25.857,
    emoji: '🌊',
    clues: [
      'You are in southern Africa and can hear a roar from kilometers away.',
      'Locals call this place "the smoke that thunders".',
      'A river over a kilometer wide plunges into a basalt gorge on a national border.',
    ],
  },
  {
    name: 'Rapa Nui Moai',
    country: 'Chile',
    lat: -27.113,
    lng: -109.35,
    emoji: '🗿',
    clues: [
      'You are on one of the most remote inhabited islands in the Pacific Ocean.',
      'The nearest continent is over 3,500 km away to the east.',
      'Hundreds of giant stone heads gaze inland across the grassy slopes.',
    ],
  },
  {
    name: 'Grand Canyon',
    country: 'United States',
    lat: 36.107,
    lng: -112.113,
    emoji: '🏜️',
    clues: [
      'You are in the arid southwest of North America, far from any coast.',
      'Condors ride thermals over layered red rock.',
      'A river has carved a gorge here nearly two kilometers deep.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Grandeur_Point_-_Grand_Canyon_National_Park_-_R0010513_-_29201417827.jpg/3840px-Grandeur_Point_-_Grand_Canyon_National_Park_-_R0010513_-_29201417827.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Grandeur_Point_-_Grand_Canyon_National_Park_-_R0010513_-_29201417827.jpg',
      author: 'Grand Canyon NPS',
      license: 'CC BY 2.0',
    },
  },
  {
    name: 'Lake Louise',
    country: 'Canada',
    lat: 51.417,
    lng: -116.217,
    emoji: '🏞️',
    clues: [
      'You are high in the Rocky Mountains of a huge, sparsely populated country.',
      'Canoes glide across impossibly turquoise glacier water.',
      'A grand railway hotel faces a wall of ice at the end of the lake.',
    ],
  },
  {
    name: 'Reykjavik',
    country: 'Iceland',
    lat: 64.147,
    lng: -21.94,
    emoji: '🌋',
    clues: [
      'You are on a volcanic North Atlantic island just below the Arctic Circle.',
      'Locals bathe outdoors in geothermal water while it snows.',
      'This is the northernmost capital city of a sovereign state.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Hallgr%C3%ADmskirkja_Reykjavik_Iceland_360_degree_panorama_2026-02-08_08-00-31_1.jpg/3840px-Hallgr%C3%ADmskirkja_Reykjavik_Iceland_360_degree_panorama_2026-02-08_08-00-31_1.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Hallgr%C3%ADmskirkja_Reykjavik_Iceland_360_degree_panorama_2026-02-08_08-00-31_1.jpg',
      author: 'G. Edward Johnson',
      license: 'CC BY 4.0',
    },
  },
  {
    name: 'Moscow',
    country: 'Russia',
    lat: 55.754,
    lng: 37.62,
    emoji: '🏰',
    clues: [
      'You are in a vast, cold capital that spans Europe’s eastern edge.',
      'The metro stations look like underground palaces.',
      'Swirling candy-colored onion domes rise beside a fortress wall.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Moscow-tram-station-Nagatino-360-january-2016.jpg/3840px-Moscow-tram-station-Nagatino-360-january-2016.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Moscow-tram-station-Nagatino-360-january-2016.jpg',
      author: 'Artem Svetlov',
      license: 'CC BY 2.0',
    },
  },
  {
    name: 'Istanbul',
    country: 'Turkey',
    lat: 41.009,
    lng: 28.98,
    emoji: '🕌',
    clues: [
      'You are in the only major city that straddles two continents.',
      'Ferries cross a strait between bazaars, minarets, and tea gardens.',
      'A 1,500-year-old domed basilica-turned-mosque anchors the old town.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Mapillary_%280ZGi8UCLY6TblqMo3s91yz%29_%28ademturkmen%29_2021-12-11_11H33M20S000.jpg/3840px-Mapillary_%280ZGi8UCLY6TblqMo3s91yz%29_%28ademturkmen%29_2021-12-11_11H33M20S000.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Mapillary_(0ZGi8UCLY6TblqMo3s91yz)_(ademturkmen)_2021-12-11_11H33M20S000.jpg',
      author: 'ademturkmen',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Marrakesh Medina',
    country: 'Morocco',
    lat: 31.626,
    lng: -7.989,
    emoji: '🏺',
    clues: [
      'You are in a maze of alleys in North Africa, with snowy peaks on the horizon.',
      'Snake charmers and spice pyramids fill a famous evening square.',
      'The walls of this old imperial city glow dusty red at sunset.',
    ],
  },
  {
    name: 'Uluru',
    country: 'Australia',
    lat: -25.345,
    lng: 131.037,
    emoji: '🦘',
    clues: [
      'You are in the dead center of a huge, dry southern continent.',
      'Kangaroos rest in the shade of desert oaks in the red outback.',
      'A single sandstone monolith, sacred to its traditional owners, changes color at dusk.',
    ],
  },
  {
    name: 'Neuschwanstein Castle',
    country: 'Germany',
    lat: 47.558,
    lng: 10.75,
    emoji: '🏰',
    clues: [
      'You are in green alpine foothills in central Europe.',
      'Cowbells clank in the valleys below a fairy-tale ridge.',
      'A 19th-century king built the turreted castle that inspired a theme-park logo.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Schwangau_Panorama.jpg/3840px-Schwangau_Panorama.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Schwangau_Panorama.jpg',
      author: 'SimonWaldherr',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Museumplein, Amsterdam',
    country: 'Netherlands',
    lat: 52.358,
    lng: 4.881,
    emoji: '🚲',
    clues: [
      'You are below sea level in a flat European country of windmills and dikes.',
      'Thousands of bicycles rattle over bridges past narrow gabled houses.',
      'Ring-shaped 17th-century canals define this famously liberal capital.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Museumplein_%E2%80%93_Panorama_%28Greg_Zaal_via_Poly_Haven%29.jpg/3840px-Museumplein_%E2%80%93_Panorama_%28Greg_Zaal_via_Poly_Haven%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Museumplein_%E2%80%93_Panorama_(Greg_Zaal_via_Poly_Haven).jpg',
      author: 'Greg Zaal',
      license: 'CC0',
    },
  },
  {
    name: 'Gyeongbokgung Palace',
    country: 'South Korea',
    lat: 37.579,
    lng: 126.977,
    emoji: '🏯',
    clues: [
      'You are in a hyper-modern East Asian capital wedged between mountains.',
      'Visitors in rented hanbok pose for photos beneath painted eaves.',
      'A Joseon-dynasty royal palace sits at the head of a grand boulevard.',
    ],
  },
  {
    name: 'Bangkok',
    country: 'Thailand',
    lat: 13.75,
    lng: 100.492,
    emoji: '🍜',
    clues: [
      'You are in a steamy Southeast Asian capital of tuk-tuks and street food.',
      'Long-tail boats race along a river past golden spires.',
      'A dazzling royal compound houses a tiny, revered Emerald Buddha.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Mapillary_%28JIgtm4r7flTEpoxc28sjDG%29_%28mapconcierge%29_2024-12-18_01H58M33S537.jpg/3840px-Mapillary_%28JIgtm4r7flTEpoxc28sjDG%29_%28mapconcierge%29_2024-12-18_01H58M33S537.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Mapillary_(JIgtm4r7flTEpoxc28sjDG)_(mapconcierge)_2024-12-18_01H58M33S537.jpg',
      author: 'mapconcierge',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Marina Bay Sands',
    country: 'Singapore',
    lat: 1.284,
    lng: 103.86,
    emoji: '🌴',
    clues: [
      'You are in a spotless equatorial city-state at the tip of a peninsula.',
      'Hawker centers serve laksa beneath futuristic "supertree" gardens.',
      'A ship-shaped skypark bridges three hotel towers above the bay.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Singapore_Marina_Bay_Aerial.jpg/3840px-Singapore_Marina_Bay_Aerial.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Singapore_Marina_Bay_Aerial.jpg',
      author: 'Omar David Sandoval Sida',
      license: 'CC BY-SA 4.0',
    },
  },
  {
    name: 'Tegallalang Rice Terraces',
    country: 'Indonesia',
    lat: -8.432,
    lng: 115.279,
    emoji: '🌾',
    clues: [
      'You are on a lush volcanic island in a vast equatorial archipelago.',
      'Offerings of flowers sit outside Hindu temples between the palms.',
      'Emerald rice paddies staircase down the hillsides of this famous island.',
    ],
  },
  {
    name: 'Everest Base Camp',
    country: 'Nepal',
    lat: 27.988,
    lng: 86.925,
    emoji: '🎏',
    clues: [
      'You are gasping for air at over 5,000 meters in a Himalayan kingdom.',
      'Yaks haul gear past prayer flags and stone stupas.',
      'Climbers gather here before attempting the highest summit on Earth.',
    ],
  },
  {
    name: 'Registan Square',
    country: 'Uzbekistan',
    lat: 39.655,
    lng: 66.976,
    emoji: '🐫',
    clues: [
      'You are in Central Asia on the ancient Silk Road between deserts.',
      'Melon sellers trade beside turquoise-tiled madrasahs.',
      'Three monumental tiled schools frame the heart of Samarkand.',
    ],
  },
  {
    name: 'Rovaniemi',
    country: 'Finland',
    lat: 66.503,
    lng: 25.729,
    emoji: '🎅',
    clues: [
      'You are in a snowy Nordic forest right on the Arctic Circle.',
      'Reindeer sleds glide beneath the northern lights.',
      'This town markets itself as the official hometown of Santa Claus.',
    ],
  },
  {
    name: 'Geirangerfjord',
    country: 'Norway',
    lat: 62.101,
    lng: 7.206,
    emoji: '⛴️',
    clues: [
      'You are in Scandinavia, sailing between kilometer-high cliff walls.',
      'Waterfalls named after brides and their suitors plunge into dark water.',
      'This UNESCO-listed fjord is the poster child of its country.',
    ],
  },
  {
    name: 'Old Havana',
    country: 'Cuba',
    lat: 23.137,
    lng: -82.359,
    emoji: '🚗',
    clues: [
      'You are on the largest island in the Caribbean.',
      'Classic 1950s American cars cruise past pastel colonial arcades.',
      'Son cubano drifts from bars along the Malecón seawall.',
    ],
  },
  {
    name: 'Chichén Itzá',
    country: 'Mexico',
    lat: 20.684,
    lng: -88.568,
    emoji: '🐍',
    clues: [
      'You are on a hot limestone peninsula dotted with freshwater sinkholes.',
      'At the equinox, a serpent of shadow slithers down a staircase here.',
      'A stepped Maya pyramid dominates this ancient ball-playing city.',
    ],
  },
  {
    name: 'Galápagos Islands',
    country: 'Ecuador',
    lat: -0.777,
    lng: -91.142,
    emoji: '🐢',
    clues: [
      'You are on a volcanic archipelago straddling the equator in the Pacific.',
      'Iguanas swim in the surf and boobies have bright blue feet.',
      'Giant tortoises here helped inspire the theory of evolution.',
    ],
  },
  {
    name: 'Torres del Paine',
    country: 'Chile',
    lat: -50.942,
    lng: -73.407,
    emoji: '🦙',
    clues: [
      'You are near the stormy southern tip of South America.',
      'Guanacos graze beneath glaciers while condors circle overhead.',
      'Three granite towers give this Patagonian park its name.',
    ],
  },
  {
    name: 'Timbuktu',
    country: 'Mali',
    lat: 16.766,
    lng: -3.003,
    emoji: '📜',
    clues: [
      'You are at the southern edge of the Sahara, near a great river bend.',
      'Salt caravans still arrive at this legendary trading town.',
      'Mud-brick mosques guard ancient manuscript libraries.',
    ],
  },
  {
    name: 'Antarctic Peninsula',
    country: 'Antarctica',
    lat: -64.774,
    lng: -64.053,
    emoji: '🐧',
    clues: [
      'You are on the coldest, driest, windiest continent on Earth.',
      'Penguin colonies squabble on the shore between blue icebergs.',
      'Research stations are the only settlements for thousands of kilometers.',
    ],
  },
  {
    name: 'Bora Bora',
    country: 'French Polynesia',
    lat: -16.5,
    lng: -151.742,
    emoji: '🏝️',
    clues: [
      'You are in the South Pacific, roughly halfway between South America and Australia.',
      'Overwater bungalows ring a lagoon in every shade of blue.',
      'A jagged extinct volcano rises from the middle of this honeymoon island.',
    ],
  },
  {
    name: 'Hobbiton',
    country: 'New Zealand',
    lat: -37.872,
    lng: 175.683,
    emoji: '🐑',
    clues: [
      'You are on rolling green sheep pasture on a Pacific island nation.',
      'This country has ten times more sheep than people.',
      'Round doors are set into the hillsides of a famous movie set.',
    ],
  },
  {
    name: 'La Boca',
    country: 'Argentina',
    lat: -34.635,
    lng: -58.363,
    emoji: '💃',
    clues: [
      'You are in a South American capital that loves steak and stays up very late.',
      'Tango dancers perform between houses painted in leftover ship paint.',
      'This colorful dockside barrio is home to a famous blue-and-gold football club.',
    ],
  },
  {
    name: 'Alfama, Lisbon',
    country: 'Portugal',
    lat: 38.714,
    lng: -9.139,
    emoji: '🚋',
    clues: [
      'You are in Europe’s westernmost mainland capital, on a wide river mouth.',
      'Yellow trams grind up tiled alleys as fado drifts from taverns.',
      'Custard tarts and a hilltop Moorish castle complete the postcard.',
    ],
  },
  {
    name: 'Piazza San Marco',
    country: 'Italy',
    lat: 45.434,
    lng: 12.339,
    emoji: '🛶',
    clues: [
      'You are in a European city where the streets are made of water.',
      'Gondolas glide under arched bridges past slowly sinking palazzos.',
      'A winged-lion column and a soaring brick campanile guard this famous square.',
    ],
    pano: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Piazza_san_marco_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg/3840px-Piazza_san_marco_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Piazza_san_marco_%E2%80%93_Panorama_(Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven).jpg',
      author: 'Greg Zaal (Panorama)',
      license: 'CC0',
    },
  },
]
