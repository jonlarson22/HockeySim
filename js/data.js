// data.js

// 1. Conference Tiers
// Tier 1 represents elite powerhouses, Tier 3 represents lower-budget programs.
export const conferences = [
    { id: "conf_ne", name: "Northeast Elite", tier: 1 },
    { id: "conf_gl", name: "Great Lakes Collegiate", tier: 2 },
    { id: "conf_cp", name: "Central Plains Classic", tier: 2 }, // NEW MID-TIER
    { id: "conf_mw", name: "Mountain West Invitational", tier: 3 }
];
// 2. Base Teams
// Prestige is on a 0-100 scale. This dictates budget, recruit interest, and job security.
export const teams = [
    // Tier 1: Northeast Elite (Prestige 80+)
    { id: "team_bos", name: "Boston Atlantic", abbr: "BOS", confId: "conf_ne", prestige: 92, color: "#8b0000" },
    { id: "team_pro", name: "Providence Tech", abbr: "PRO", confId: "conf_ne", prestige: 88, color: "#000000" },
    { id: "team_mai", name: "Maine State", abbr: "MAI", confId: "conf_ne", prestige: 82, color: "#003366" },
    { id: "team_nye", name: "New York Empire", abbr: "NYE", confId: "conf_ne", prestige: 85, color: "#0055a4" },
    { id: "team_ver", name: "Vermont Frost", abbr: "VER", confId: "conf_ne", prestige: 81, color: "#00573F" },
    { id: "team_con", name: "Connecticut Sound", abbr: "CON", confId: "conf_ne", prestige: 84, color: "#0C2340" },
    { id: "team_nh",  name: "New Hampshire Pines", abbr: "NHP", confId: "conf_ne", prestige: 80, color: "#041E42" },
    { id: "team_rhi", name: "Rhode Island Bay", abbr: "RHI", confId: "conf_ne", prestige: 83, color: "#68ABE8" },

    // Tier 2: Great Lakes Collegiate (Prestige 60-79)
    { id: "team_min", name: "Minnesota Lakes", abbr: "MIN", confId: "conf_gl", prestige: 75, color: "#7a0019" },
    { id: "team_mic", name: "Michigan Central", abbr: "MIC", confId: "conf_gl", prestige: 70, color: "#ffcb05" },
    { id: "team_wis", name: "Wisconsin State", abbr: "WIS", confId: "conf_gl", prestige: 68, color: "#c5050c" },
    { id: "team_chi", name: "Chicago Metro", abbr: "CHI", confId: "conf_gl", prestige: 62, color: "#418fde" },
    { id: "team_ohi", name: "Ohio Valley", abbr: "OHI", confId: "conf_gl", prestige: 72, color: "#CE1141" },
    { id: "team_ind", name: "Indiana Crossroads", abbr: "IND", confId: "conf_gl", prestige: 65, color: "#011739" },
    { id: "team_ill", name: "Illinois Prairie", abbr: "ILL", confId: "conf_gl", prestige: 67, color: "#E84A27" },
    { id: "team_eri", name: "Erie Shores", abbr: "ERI", confId: "conf_gl", prestige: 61, color: "#002D62" },

    // Tier 2: Central Plains Classic (Prestige 60-79)
    { id: "team_dak", name: "Dakota Frontier", abbr: "DAK", confId: "conf_cp", prestige: 78, color: "#009A44" },
    { id: "team_oma", name: "Omaha Rail", abbr: "OMA", confId: "conf_cp", prestige: 74, color: "#D71920" },
    { id: "team_iow", name: "Iowa Fields", abbr: "IOW", confId: "conf_cp", prestige: 66, color: "#FFCD00" },
    { id: "team_stl", name: "St. Louis Arch", abbr: "STL", confId: "conf_cp", prestige: 69, color: "#041E42" },
    { id: "team_kan", name: "Kansas Winds", abbr: "KAN", confId: "conf_cp", prestige: 63, color: "#0051BA" },
    { id: "team_mis", name: "Missouri River", abbr: "MIS", confId: "conf_cp", prestige: 64, color: "#F1B82D" },
    { id: "team_neb", name: "Nebraska Plains", abbr: "NEB", confId: "conf_cp", prestige: 60, color: "#E41C38" },
    { id: "team_wic", name: "Wichita Aviation", abbr: "WIC", confId: "conf_cp", prestige: 62, color: "#FFC629" },

    // Tier 3: Mountain West Invitational (Prestige <60)
    { id: "team_col", name: "Colorado Peak", abbr: "COL", confId: "conf_mw", prestige: 55, color: "#2f4f4f" },
    { id: "team_ida", name: "Idaho Valley", abbr: "IDA", confId: "conf_mw", prestige: 48, color: "#d9782d" },
    { id: "team_uta", name: "Utah Summit", abbr: "UTA", confId: "conf_mw", prestige: 42, color: "#cc0000" },
    { id: "team_nev", name: "Nevada Desert", abbr: "NEV", confId: "conf_mw", prestige: 35, color: "#b1b3b3" },
    { id: "team_wyo", name: "Wyoming Rangers", abbr: "WYO", confId: "conf_mw", prestige: 45, color: "#492F24" },
    { id: "team_mon", name: "Montana Big Sky", abbr: "MON", confId: "conf_mw", prestige: 50, color: "#732021" },
    { id: "team_nmx", name: "New Mexico Sun", abbr: "NMX", confId: "conf_mw", prestige: 38, color: "#BA0C2F" },
    { id: "team_ari", name: "Arizona Canyons", abbr: "ARI", confId: "conf_mw", prestige: 40, color: "#8C1D40" }
];

// 3. Name Generation Arrays
// A mix of traditional North American and common hockey-centric names.
export const firstNames = [
  // North American
  "Liam", "Noah", "Jack", "Connor", "Cole", "Dylan", "Logan", "Owen", "Mason", "Carter",
  "Nolan", "Brady", "Colton", "Dawson", "Tyler", "Ryan", "Kyle", "Jake", "Luke", "Ethan",
  "Oliver", "James", "William", "Benjamin", "Lucas", "Henry", "Alexander", "Jackson", "Daniel", "Michael",
  "Samuel", "Jacob", "John", "Joseph", "Wyatt", "David", "Declan", "Gavin", "Asher", "Aiden",
  // Swedish
  "Elias", "Lars", "Sven", "Hugo", "Filip", "Viktor", "Anton", "Emil", "Oskar", "Nils",
  "Sebastian", "Theodore", "Levi", "Mateo",
  // Finnish
  "Mikko", "Aleksi", "Ville", "Jussi", "Pekka", "Teemu", "Saku", "Eero", "Onni", "Antti",
  "Juhani", "Lasse", "Olli", "Petri",
  // Russian
  "Dmitri", "Ivan", "Nikolai", "Sergei", "Pavel", "Andrei", "Evgeni", "Nikita", "Artem", "Maxim",
  "Igor", "Vladimir", "Alexei", "Kirill",
  // Czech / Slovak
  "Jakub", "Tomas", "Martin", "Petr", "Jan", "Lukas", "Ondrej", "Marek", "Zdeno", "Radek",
  "Juraj", "Matej",
  // Extra
  "Elijah", "Nathan", "Aaron", "Joel", "Simon", "Caleb",
];

export const lastNames = [
  // Canadian (English)
  "Smith", "Brown", "Wilson", "Taylor", "Moore", "Clark", "Lewis", "Walker", "Hall", "Young",
  "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Carter", "Mitchell", "Turner",
  // Canadian (French)
  "Roy", "Bouchard", "Tremblay", "Gagnon", "Pelletier", "Lavoie", "Couture", "Morin", "Bergeron", "Gallagher",
  "Lindholm", "St-Jean", "O'Connor", "MacDonald",
  // American
  "Johnson", "Williams", "Jones", "Miller", "Davis", "Thomas", "Jackson", "White", "Harris", "Martin",
  "Thompson", "Robinson", "Lee", "Fisher",
  // Swedish
  "Karlsson", "Andersson", "Johansson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson",
  "Pettersson", "Jonsson", "Lundqvist", "Hedman",
  // Finnish
  "Korhonen", "Virtanen", "Makinen", "Nieminen", "Laine", "Rantanen", "Aho", "Barkov", "Heiskanen", "Rinne",
  // Russian
  "Ivanov", "Petrov", "Kuznetsov", "Popov", "Sokolov", "Mikhailov", "Tarasov", "Orlov", "Volkov", "Semenov",
  // Czech / Slovak
  "Novak", "Svoboda", "Dvorak", "Prochazka", "Krejci", "Hertl", "Pastrnak", "Chara", "Hossa", "Gaborik",
  // Swiss / German
  "Weber", "Muller", "Schmid", "Keller", "Fiala", "Hischier", "Draisaitl", "Stutzle",
  // Famous hockey bloodlines (is he related?)
  "Gretzky", "Howe", "Ovechkin", "Crosby", "Modano", "Chelios", "Zubov", "Lemieux",
  "Orr", "Messier", "Yzerman", "Sakic", "Forsberg", "Lidstrom", "Brodeur", "Hasek",
  "Jagr", "Fedorov", "Bure", "Hull",
];

export const regularLastNames = lastNames.slice(0, 100);
export const famousLastNames = lastNames.slice(100);

// Second wave of bloodlines (30 total at the same 4% weight — each one rarer).
famousLastNames.push(
  "Richard", "Beliveau", "Lafleur", "Bossy", "Trottier",
  "Potvin", "Esposito", "Selanne", "Lindros", "McDavid"
);

// 4. Helper Function: Generate a Random Player Name
export function getRandomFirstName() {
    return firstNames[Math.floor(Math.random() * firstNames.length)];
}

export function getRandomLastName() {
    // Famous bloodlines are rare: 4% of players (~1 per team).
    if (Math.random() < 0.04) return famousLastNames[Math.floor(Math.random() * famousLastNames.length)];
    return regularLastNames[Math.floor(Math.random() * regularLastNames.length)];
}
