export function inferCategory(title = "") {
  const t = title.toLowerCase();

  const rules = [
    ["Seating", ["scaun", "chair", "fotoliu", "sofa", "canapea", "taburet", "banca"]],
    ["Tables", ["masa", "table", "birou", "desk", "consola"]],
    ["Storage", ["dulap", "comoda", "raft", "shelf", "kallax", "pax", "biblioteca", "sertar"]],
    ["Beds", ["pat", "bed", "saltea", "mattress", "somiera"]],
    ["Office", ["markus", "micke", "alex", "office", "birou", "lampă birou"]],
    ["Lighting", ["lampa", "lamp", "aplica", "lustra", "bec", "light"]]
  ];

  for (const [cat, kws] of rules) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "Other";
}
