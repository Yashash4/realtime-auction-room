// Bundled sample roster — used to prefill the "create room" player list and to
// seed the demo rooms. Base prices are in raw units (e.g. 2,000,000 = 20 lakh).
// No images (avoids licensing); the UI renders initials avatars.

export type SamplePlayer = {
  name: string;
  role: string;
  country: string;
  base_price: number;
};

export const SAMPLE_PLAYERS: SamplePlayer[] = [
  { name: "Virat Kohli", role: "Batter", country: "India", base_price: 2000000 },
  { name: "Rohit Sharma", role: "Batter", country: "India", base_price: 2000000 },
  { name: "Jasprit Bumrah", role: "Bowler", country: "India", base_price: 2000000 },
  { name: "Ravindra Jadeja", role: "All-rounder", country: "India", base_price: 1600000 },
  { name: "KL Rahul", role: "Wicket-keeper", country: "India", base_price: 1700000 },
  { name: "Hardik Pandya", role: "All-rounder", country: "India", base_price: 1500000 },
  { name: "Suryakumar Yadav", role: "Batter", country: "India", base_price: 1500000 },
  { name: "Pat Cummins", role: "Bowler", country: "Australia", base_price: 2000000 },
  { name: "Travis Head", role: "Batter", country: "Australia", base_price: 1400000 },
  { name: "Glenn Maxwell", role: "All-rounder", country: "Australia", base_price: 1100000 },
  { name: "Mitchell Starc", role: "Bowler", country: "Australia", base_price: 2000000 },
  { name: "Rashid Khan", role: "Bowler", country: "Afghanistan", base_price: 1800000 },
  { name: "Jos Buttler", role: "Wicket-keeper", country: "England", base_price: 1600000 },
  { name: "Ben Stokes", role: "All-rounder", country: "England", base_price: 1600000 },
  { name: "Jofra Archer", role: "Bowler", country: "England", base_price: 1500000 },
  { name: "Kagiso Rabada", role: "Bowler", country: "South Africa", base_price: 1400000 },
  { name: "Heinrich Klaasen", role: "Wicket-keeper", country: "South Africa", base_price: 1300000 },
  { name: "Rachin Ravindra", role: "All-rounder", country: "New Zealand", base_price: 900000 },
  { name: "Trent Boult", role: "Bowler", country: "New Zealand", base_price: 1200000 },
  { name: "Nicholas Pooran", role: "Wicket-keeper", country: "West Indies", base_price: 1300000 },
  { name: "Shubman Gill", role: "Batter", country: "India", base_price: 1700000 },
  { name: "Yashasvi Jaiswal", role: "Batter", country: "India", base_price: 1300000 },
  { name: "Mohammed Shami", role: "Bowler", country: "India", base_price: 1400000 },
  { name: "Shreyas Iyer", role: "Batter", country: "India", base_price: 1200000 },
];

/** One player per line: "Name, Role, Country, BasePrice". */
export const SAMPLE_PLAYERS_TEXT = SAMPLE_PLAYERS.map(
  (p) => `${p.name}, ${p.role}, ${p.country}, ${p.base_price}`,
).join("\n");
