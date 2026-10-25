# Marquee combos and hunt targets

Static, prebuilt knowledge: read once at setup (corp pick) and when a theme opens up; don't re-derive per pick.
The complete, machine-derived links for every card are in `tm.sh <id> synergy` (index built once per card db and
cached; filters by this game's expansions and shows each card's status: unseen / passed / in hand / in play).
Check exact text with `cards "X"` before committing. A theme is a HUNT once we hold 1-2 pieces and the payoff is
still unseen: each unseen card reaches our draft ~10/deck per gen (4/deck without draft) plus our own draws, so
hunting a single named card is a long shot; hunt the theme (several payoffs), not one card.

## Tag scalers (value grows with each tag we add; early = compounding)
- **Jovian**: Io Mining Industries (1 VP/jovian + Ti/M€ prod), Ganymede Colony (city + 1 VP/jovian), Water Import From
  Europa (1 VP/jovian), Terraforming Ganymede (1 TR per jovian: play it LAST, after the other jovians).
  Jovian tags are space cards: pair with Ti, Space Station / Warp Drive / Mercurian Alloys / Advanced Alloys.
- **Science**: thresholds, not scalers. Quantum Extractor (4 sci, +4 energy prod), Mass Converter (5 sci, +6 energy prod),
  Warp Drive (5 sci, -4 on space cards, 2 VP), Anti-Gravity Technology (7 sci, 3 VP). Research counts as 2 science.
  Physics Complex (2 VP per science resource, fed by energy) turns a power engine into VP. Olympus Conference /
  Mars University add draws per science tag, which helps find the threshold cards.
- **Earth**: Cartel and Miranda Resort (M€ prod per earth tag), Earth Office (-3 M€ per earth card), Luna Metropolis
  (M€ prod per earth tag + city + 2 VP), Earth Catapult (-2 on every card).
- **Space**: Satellites (M€ prod per space tag), Space Station (-2 per space card), Toll Station (per OPPONENTS' space tags).
- **Events**: Media Group (+3 M€ per event), Optimal Aerobraking (+3 M€ +3 heat per space event).
- **Breadth**: Interplanetary Trade (M€ prod per different tag).

## Stock converters (turn stranded resources into M€/VP; game 4 lost for lack of these)
- **Steel**: Space Elevator (1 steel -> 5 M€ every gen), Advanced Alloys (+1 steel & Ti value), Rego Plastics (+1 steel),
  building-tag cities (Noctis City, Lava Tube Settlement, Domed Crater, Capital, Immigrant City, Underground City...)
  instead of the 25 M€ City SP.
- **Titanium**: Advanced Alloys, Mercurian Alloys (2 sci), Jovian/space VP cards above, Security Fleet.
- **Heat**: Caretaker Contract (8 heat -> 1 TR after temp maxes, 0°C req), Insulation (heat prod -> M€ prod).
- **Energy**: Power Infrastructure (energy -> M€), Physics Complex (energy -> VP), trade fleets (3 energy per trade).
- **Standard projects**: Standard Technology (+3 M€ per SP) if the endgame will be SP-heavy.

## Resource hosts and feeders (VP per resource; feeders make one host worth several VP)
- **Animals**: hosts Pets (+1 per city anywhere), Birds, Fish, Livestock, Small Animals, Predators, Herbivores, Ecological
  Zone, Stratospheric Birds, Venusian Animals (+1 animal per science tag we play: a science engine becomes VP);
  feeders Large Convoy, Imported Hydrogen, Imported Nitrogen, Local Heat Trapping, the Miranda colony (build = 1
  animal; trade = 0-3 animals by track; activates once an animal card is played, so our first host can open it).
  Viral Enhancers feeds per bio tag. `synergy "<host>"` prints the matching colony line with its track value.
- **Microbes**: hosts Decomposers, Tardigrades, GHG Producing Bacteria, Regolith Eaters, Nitrite Reducing Bacteria;
  feeders Symbiotic Fungus, Extreme-Cold Fungus, Imported Nitrogen, Imported Nutrients, Enceladus colony.
- **Floaters** (Venus): hosts Floating Habs, Stratopolis, Dirigibles (also pays for Venus cards), Jovian Lanterns;
  feeders Titan colony, Titan Floating Launch-pad, Dirigibles, Jovian Lanterns.

## City payoffs
- Pets, Rover Construction (+2 M€ per any city), Energy Saving (energy prod per city in play), Immigrant City.
