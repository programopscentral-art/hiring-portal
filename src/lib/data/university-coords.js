// Approximate real-world coordinates for the universities in the current plan.
// Keyed by `${state}::${name}` (case + whitespace normalized) so the same
// abbreviation can resolve to different coords in different states.
//
// Precision: rough city-level coords are good enough for visual positioning
// inside state polygons. Add an entry when a new university appears in the plan.

const RAW = {
  // Andhra Pradesh
  'Andhra Pradesh::Annamacharya': [14.19, 79.16],
  'Andhra Pradesh::BEST': [14.68, 77.60],                          // Anantapur
  'Andhra Pradesh::Chalapathi Institute of Technology': [16.34, 80.51], // Guntur
  'Andhra Pradesh::GMR': [18.79, 83.83],                           // Rajam
  'Andhra Pradesh::NRI Institute of Technology': [16.41, 80.91],   // Vijayawada
  'Andhra Pradesh::Univ 2': [15.91, 79.74],                        // AP centroid placeholder

  // Haryana
  'Haryana::Geeta University': [29.39, 76.96],                     // Panipat
  'Haryana::Sushant University': [28.42, 77.05],                   // Gurgaon

  // Karnataka
  'Karnataka::SPIHER': [13.10, 77.55],                             // ~Bangalore approx
  'Karnataka::St. Joseph University': [12.97, 77.61],              // Bengaluru
  'Karnataka::Univ 1 (1-2 hrs from BLR)': [12.93, 77.74],          // east of Bengaluru
  'Karnataka::Univ 2': [15.32, 75.71],                             // KA centroid placeholder
  'Karnataka::Yenepoya University': [12.85, 74.91],                // Mangalore

  // Kerala
  'Kerala::Univ 1': [10.85, 76.27],                                // Kerala centroid placeholder

  // Madhya Pradesh
  'Madhya Pradesh::Scope Global Skills University': [23.25, 77.41], // Bhopal

  // Maharashtra
  'Maharashtra::Ajeenkya DY Patil University': [18.59, 73.91],     // Pune
  'Maharashtra::Alard University': [18.52, 73.74],                 // Pune
  'Maharashtra::Sandip University': [20.07, 73.79],                // Nashik
  'Maharashtra::Sanjay Ghodawat University': [16.65, 74.43],       // Kolhapur
  'Maharashtra::University SkillTech': [19.07, 72.87],             // Mumbai

  // NCR (we map this to Delhi area)
  'NCR::Univ 1': [28.61, 77.21],                                   // Delhi

  // Odisha
  'Odisha::Sri Sri': [20.51, 86.04],                               // Cuttack

  // Rajasthan
  'Rajasthan::Vivekananda Global University': [26.96, 75.74],      // Jaipur

  // Tamil Nadu
  'Tamil Nadu::Bharath': [12.92, 80.14],                           // Chennai
  'Tamil Nadu::Crescent': [12.97, 80.15],                          // Chennai
  'Tamil Nadu::Joy University': [8.71, 77.76],                     // Tirunelveli
  'Tamil Nadu::NEW AMET University': [12.83, 80.25],               // Chennai coast
  'Tamil Nadu::SNS College of Technology': [11.07, 77.04],         // Coimbatore
  'Tamil Nadu::SPIHER': [12.91, 80.22],                            // Chennai-ish

  // Telangana
  'Telangana::Aurora Deemed University': [17.46, 78.34],           // Hyderabad
  'Telangana::Chaitanya Deemed University': [18.00, 79.59],        // Hanamkonda
  'Telangana::Chevella': [17.31, 78.13],
  'Telangana::KKH': [17.43, 78.45],                                // Hyderabad
  'Telangana::MRV New campus': [17.56, 78.45],                     // Hyderabad
  'Telangana::Malla Reddy University': [17.55, 78.43],             // Hyderabad
  'Telangana::Sohini Tech Park': [17.38, 78.50],                   // Hyderabad
  'Telangana::CDU': [17.40, 78.45],                                // Hyderabad
  "Telangana::St. Mary's University": [17.50, 78.50],              // Secunderabad

  // Uttar Pradesh
  'Uttar Pradesh::Noida International University': [28.41, 77.45], // Greater Noida
  'Uttar Pradesh::Sanskriti University': [27.42, 77.74],           // Mathura
  'Uttar Pradesh::Subharti University': [28.97, 77.74],            // Meerut
};

function normKey(state, name) {
  return `${(state || '').trim()}::${(name || '').trim()}`;
}

export function lookupUniversity(state, name) {
  const key = normKey(state, name);
  const c = RAW[key];
  if (c) return { lat: c[0], lon: c[1] };
  return null;
}
