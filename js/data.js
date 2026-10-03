// data.js

// 1. Conference Tiers
// Tier 1 represents elite powerhouses, Tier 3 represents lower-budget programs.
export const conferences = [
    { id: "conf_gmc", name: "Great Midwest Conference" },
    { id: "conf_wsc", name: "Western States Conference" },
    { id: "conf_yan", name: "Yankee Conference" },
    { id: "conf_ivy", name: "Ivy League" },
    { id: "conf_gll", name: "Great Lakes League" },
    { id: "conf_pat", name: "Patriot Conference" },
    { id: "conf_pcl", name: "Pacific Coast League" },
    { id: "conf_mwc", name: "Mountain West Conference" },
    { id: "conf_fro", name: "Frontier Conference" },
    { id: "conf_sou", name: "Southern Conference" },
];
// 2. Base Teams
// Prestige is on a 0-100 scale. This dictates budget, recruit interest, and job security.
export const teams = [
    { id: "team_mich", name: "Michigan", abbr: "MICH", confId: "conf_gmc", prestige: 88, color: "#00274C" },
    { id: "team_minn", name: "Minnesota", abbr: "MINN", confId: "conf_gmc", prestige: 78, color: "#7A0019" },
    { id: "team_wisc", name: "Wisconsin", abbr: "WISC", confId: "conf_gmc", prestige: 70, color: "#C5050C" },
    { id: "team_nd", name: "Notre Dame", abbr: "ND", confId: "conf_gmc", prestige: 62, color: "#0C2340" },
    { id: "team_osu", name: "Ohio State", abbr: "OSU", confId: "conf_gmc", prestige: 58, color: "#BB0000" },
    { id: "team_psu", name: "Penn State", abbr: "PSU", confId: "conf_gmc", prestige: 55, color: "#041E42" },
    { id: "team_msu", name: "Michigan State", abbr: "MSU", confId: "conf_gmc", prestige: 48, color: "#18453B" },
    { id: "team_iowa", name: "Iowa", abbr: "IOWA", confId: "conf_gmc", prestige: 35, color: "#FFCD00" },
    { id: "team_den", name: "Denver", abbr: "DEN", confId: "conf_wsc", prestige: 90, color: "#862633" },
    { id: "team_und", name: "North Dakota", abbr: "UND", confId: "conf_wsc", prestige: 78, color: "#009A44" },
    { id: "team_umd", name: "Minnesota Duluth", abbr: "UMD", confId: "conf_wsc", prestige: 70, color: "#A6192E" },
    { id: "team_wmu", name: "Western Michigan", abbr: "WMU", confId: "conf_wsc", prestige: 62, color: "#6C4023" },
    { id: "team_uno", name: "Omaha", abbr: "OMA", confId: "conf_wsc", prestige: 55, color: "#000000" },
    { id: "team_alaska", name: "Alaska", abbr: "AK", confId: "conf_wsc", prestige: 32, color: "#1D5FA8" },
    { id: "team_mia", name: "Miami", abbr: "MIA", confId: "conf_wsc", prestige: 45, color: "#C8102E" },
    { id: "team_isu", name: "Iowa State", abbr: "ISU", confId: "conf_wsc", prestige: 38, color: "#C8102E" },
    { id: "team_bc", name: "Boston College", abbr: "BC", confId: "conf_yan", prestige: 87, color: "#8C2232" },
    { id: "team_bu", name: "Boston University", abbr: "BU", confId: "conf_yan", prestige: 78, color: "#CC0000" },
    { id: "team_pc", name: "Providence", abbr: "PROV", confId: "conf_yan", prestige: 70, color: "#000000" },
    { id: "team_umass", name: "UMass", abbr: "UMASS", confId: "conf_yan", prestige: 62, color: "#881C1C" },
    { id: "team_uconn", name: "UConn", abbr: "CONN", confId: "conf_yan", prestige: 55, color: "#000E2F" },
    { id: "team_maine", name: "Maine", abbr: "MAINE", confId: "conf_yan", prestige: 50, color: "#003263" },
    { id: "team_unh", name: "New Hampshire", abbr: "UNH", confId: "conf_yan", prestige: 45, color: "#003591" },
    { id: "team_uvm", name: "Vermont", abbr: "UVM", confId: "conf_yan", prestige: 38, color: "#154734" },
    { id: "team_cor", name: "Cornell", abbr: "COR", confId: "conf_ivy", prestige: 75, color: "#B31B1B" },
    { id: "team_harv", name: "Harvard", abbr: "HARV", confId: "conf_ivy", prestige: 70, color: "#A41034" },
    { id: "team_yale", name: "Yale", abbr: "YALE", confId: "conf_ivy", prestige: 62, color: "#00356B" },
    { id: "team_prin", name: "Princeton", abbr: "PRIN", confId: "conf_ivy", prestige: 55, color: "#FF8F00" },
    { id: "team_dart", name: "Dartmouth", abbr: "DART", confId: "conf_ivy", prestige: 52, color: "#00693E" },
    { id: "team_colg", name: "Colgate", abbr: "COLG", confId: "conf_ivy", prestige: 48, color: "#821E3A" },
    { id: "team_brown", name: "Brown", abbr: "BRWN", confId: "conf_ivy", prestige: 40, color: "#4E3629" },
    { id: "team_nyu", name: "NYU", abbr: "NYU", confId: "conf_ivy", prestige: 30, color: "#57068C" },
    { id: "team_mnsu", name: "Minnesota State", abbr: "MNSU", confId: "conf_gll", prestige: 72, color: "#5B2D86" },
    { id: "team_bem", name: "Bemidji State", abbr: "BEM", confId: "conf_gll", prestige: 62, color: "#004C3F" },
    { id: "team_bgsu", name: "Bowling Green", abbr: "BGSU", confId: "conf_gll", prestige: 58, color: "#FE5000" },
    { id: "team_ferr", name: "Ferris State", abbr: "FER", confId: "conf_gll", prestige: 52, color: "#C8102E" },
    { id: "team_nmu", name: "Northern Michigan", abbr: "NMU", confId: "conf_gll", prestige: 50, color: "#0A4A2B" },
    { id: "team_ohio", name: "Ohio", abbr: "OHIO", confId: "conf_gll", prestige: 45, color: "#00694E" },
    { id: "team_ill", name: "Illinois", abbr: "ILL", confId: "conf_gll", prestige: 40, color: "#FF552E" },
    { id: "team_ilst", name: "Illinois State", abbr: "ILST", confId: "conf_gll", prestige: 35, color: "#CE1126" },
    { id: "team_army", name: "Army", abbr: "ARMY", confId: "conf_pat", prestige: 58, color: "#FFB81C" },
    { id: "team_afa", name: "Air Force", abbr: "AFA", confId: "conf_pat", prestige: 55, color: "#003087" },
    { id: "team_mercy", name: "Mercyhurst", abbr: "MER", confId: "conf_pat", prestige: 48, color: "#0C4C2C" },
    { id: "team_pitt", name: "Pittsburgh", abbr: "PITT", confId: "conf_pat", prestige: 45, color: "#003594" },
    { id: "team_vt", name: "Virginia Tech", abbr: "VT", confId: "conf_pat", prestige: 38, color: "#861F41" },
    { id: "team_bama", name: "Alabama", abbr: "BAMA", confId: "conf_pat", prestige: 32, color: "#A60C31" },
    { id: "team_tenn", name: "Tennessee", abbr: "TENN", confId: "conf_pat", prestige: 30, color: "#FF8200" },
    { id: "team_scar", name: "South Carolina", abbr: "SCAR", confId: "conf_pat", prestige: 28, color: "#73000A" },
    { id: "team_ucla", name: "UCLA", abbr: "UCLA", confId: "conf_pcl", prestige: 50, color: "#2774AE" },
    { id: "team_usc", name: "USC", abbr: "USC", confId: "conf_pcl", prestige: 48, color: "#990000" },
    { id: "team_stan", name: "Stanford", abbr: "STAN", confId: "conf_pcl", prestige: 45, color: "#8C1515" },
    { id: "team_wash", name: "Washington", abbr: "WASH", confId: "conf_pcl", prestige: 42, color: "#4B2E83" },
    { id: "team_ore", name: "Oregon", abbr: "ORE", confId: "conf_pcl", prestige: 40, color: "#154733" },
    { id: "team_unlv", name: "UNLV", abbr: "UNLV", confId: "conf_pcl", prestige: 38, color: "#CF0A2C" },
    { id: "team_seau", name: "Seattle U", abbr: "SEA", confId: "conf_pcl", prestige: 32, color: "#C8102E" },
    { id: "team_nau", name: "Northern Arizona", abbr: "NAU", confId: "conf_pcl", prestige: 30, color: "#003A5D" },
    { id: "team_utah", name: "Utah", abbr: "UTAH", confId: "conf_mwc", prestige: 55, color: "#CC0000" },
    { id: "team_colo", name: "Colorado", abbr: "COLO", confId: "conf_mwc", prestige: 48, color: "#CFB87C" },
    { id: "team_byu", name: "BYU", abbr: "BYU", confId: "conf_mwc", prestige: 40, color: "#002E5D" },
    { id: "team_csu", name: "Colorado State", abbr: "CSU", confId: "conf_mwc", prestige: 38, color: "#1E4D2B" },
    { id: "team_usu", name: "Utah State", abbr: "USU", confId: "conf_mwc", prestige: 32, color: "#003DA5" },
    { id: "team_weber", name: "Weber State", abbr: "WEB", confId: "conf_mwc", prestige: 30, color: "#492F7D" },
    { id: "team_wyo", name: "Wyoming", abbr: "WYO", confId: "conf_mwc", prestige: 28, color: "#FFC425" },
    { id: "team_unm", name: "New Mexico", abbr: "UNM", confId: "conf_mwc", prestige: 25, color: "#BA0C2F" },
    { id: "team_asu", name: "Arizona State", abbr: "ASU", confId: "conf_fro", prestige: 65, color: "#8C1D40" },
    { id: "team_ariz", name: "Arizona", abbr: "ARIZ", confId: "conf_fro", prestige: 50, color: "#CC3941" },
    { id: "team_neb", name: "Nebraska", abbr: "NEB", confId: "conf_fro", prestige: 45, color: "#E41C38" },
    { id: "team_nev", name: "Nevada", abbr: "NEV", confId: "conf_fro", prestige: 40, color: "#003366" },
    { id: "team_boise", name: "Boise State", abbr: "BSU", confId: "conf_fro", prestige: 38, color: "#0033A0" },
    { id: "team_ndsu", name: "North Dakota State", abbr: "NDSU", confId: "conf_fro", prestige: 35, color: "#006747" },
    { id: "team_mont", name: "Montana", abbr: "MONT", confId: "conf_fro", prestige: 32, color: "#651D32" },
    { id: "team_mtst", name: "Montana State", abbr: "MTST", confId: "conf_fro", prestige: 30, color: "#00205B" },
    { id: "team_tex", name: "Texas", abbr: "TEX", confId: "conf_sou", prestige: 48, color: "#BF5700" },
    { id: "team_ncsu", name: "NC State", abbr: "NCSU", confId: "conf_sou", prestige: 42, color: "#CC0000" },
    { id: "team_ou", name: "Oklahoma", abbr: "OU", confId: "conf_sou", prestige: 40, color: "#841617" },
    { id: "team_uga", name: "Georgia", abbr: "UGA", confId: "conf_sou", prestige: 38, color: "#BA0C2F" },
    { id: "team_uf", name: "Florida", abbr: "FLA", confId: "conf_sou", prestige: 35, color: "#0021A5" },
    { id: "team_ksu", name: "Kansas State", abbr: "KSU", confId: "conf_sou", prestige: 35, color: "#512888" },
    { id: "team_most", name: "Missouri State", abbr: "MOST", confId: "conf_sou", prestige: 32, color: "#571C1F" },
    { id: "team_lib", name: "Liberty", abbr: "LIB", confId: "conf_sou", prestige: 38, color: "#0A3161" },
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
  // Famous first names (non-weighted — the connection is harder to spot)
  "Wayne", "Gordie", "Alex", "Sidney", "Mike", "Chris", "Mario", "Bobby",
  "Mark", "Steve", "Joe", "Peter", "Nicklas", "Dominik", "Jaromir", "Brett",
  "Maurice", "Jean", "Guy", "Bryan", "Denis", "Phil", "Eric",
  // Hart winners' first names
  "Jose", "Henrik", "Corey", "Carey", "Patrick", "Taylor", "Leon", "Auston",
];

export const lastNames = [
  // Canadian (English)
  "Smith", "Brown", "Wilson", "Taylor", "Moore", "Clark", "Lewis", "Walker", "Carney", "Young",
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
  "Weber", "Muller", "Schmid", "Keller", "Fiala", "Hischier", "Stutzle",
  // North American (evening out the pools)
  "Campbell", "Fraser", "McKenzie", "Sullivan", "Murphy", "Kelly", "Ryan", "Burns",
  "Kennedy", "Ferguson", "Patterson", "Graham", "Duncan", "Boyd", "Crawford", "Bishop",
  "Fowler", "Hamilton", "Schultz", "McLeod", "Callahan", "Delaney", "Flynn", "Grady",
  "Hogan", "Keating", "Lynch", "Malone", "Nugent", "O'Brien", "Quinn", "Reilly",
  // Famous hockey bloodlines (is he related?)
  "Gretzky", "Howe", "Ovechkin", "Crosby", "Modano", "Chelios", "Zubov", "Lemieux",
  "Orr", "Messier", "Yzerman", "Sakic", "Forsberg", "Lidstrom", "Brodeur", "Hasek",
  "Jagr", "Fedorov", "Bure", "Hull",
];

export const regularLastNames = lastNames.slice(0, 131);
export const famousLastNames = lastNames.slice(131);

// Second wave of bloodlines (30 total at the same 4% weight — each one rarer).
famousLastNames.push(
  "Richard", "Beliveau", "Lafleur", "Bossy", "Trottier",
  "Potvin", "Esposito", "Selanne", "Lindros", "McDavid",
  // Hart Trophy winners 1990-2025 not already listed
  "Pronger", "Theodore", "St. Louis", "Thornton", "Sedin",
  "Perry", "Malkin", "Price", "Kane", "Hall",
  "Kucherov", "Draisaitl", "Matthews", "MacKinnon", "Hellebuyck"
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
