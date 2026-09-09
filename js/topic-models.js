// Tropical Cyclone Information System — Education Hub topic content
// Each object here is a "TopicModel": the single source of truth for one
// "Explore Topics" card and its detail modal. To add a new topic, append an
// entry here and add one matching card in pages/education/index.html with
// data-topic-id set to the new id — no modal code changes needed.
//
// Shape: {
//   id:       string   — card ↔ topic link (data-topic-id)
//   title:    string   — card heading + modal header
//   tagline:  string   — one-line summary shown under the modal title
//   icon:     string   — SVG markup (white strokes/fills; the badge is colored)
//   theme:    string   — accent key shared with CSS (.topic-modal--<theme>)
//                        sky | green | orange | purple | teal
//   sections: [{ heading: string|null, paragraphs: string[] }, ...]
// }

window.TOPIC_MODELS = [
  {
    id: "what-is-a-typhoon",
    title: "What is a Typhoon?",
    tagline: "How typhoons form, their parts, and how they are classified.",
    theme: "sky",
    icon:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M6.5 15a4 4 0 01.5-7.97A5.5 5.5 0 0117.6 9.02 3.5 3.5 0 0117 16H7c-.17 0-.34-.01-.5-.03z" fill="#fff" />' +
      '<path d="M10 17l-1.5 3M13 17l-1.5 3M16 17l-1.5 3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />' +
      "</svg>",
    sections: [
      {
        heading: null,
        paragraphs: [
          "A typhoon is a large, powerful tropical cyclone — a rotating storm system that forms over warm ocean water. In the Philippines, typhoons are some of the most significant weather events of the year, bringing strong winds and heavy rain that can affect entire communities.",
        ],
      },
      {
        heading: "How typhoons form",
        paragraphs: [
          "Typhoons need four ingredients: warm seawater (about 26.5°C or warmer), moisture in the air, gentle winds that vary little with height, and a spin from the Earth's rotation. When these come together, rising warm air lowers the pressure at the ocean surface and the system begins to rotate, feeding on heat and moisture as it grows.",
        ],
      },
      {
        heading: "Parts of a typhoon",
        paragraphs: [
          "The <strong>eye</strong> is the calm, clear center where air sinks. Around it spins the <strong>eyewall</strong> — a ring of towering clouds where the most destructive winds are found. Spiral bands called <strong>rainbands</strong> stretch hundreds of kilometers outward, bringing bands of rain and gusty winds well ahead of the center.",
        ],
      },
      {
        heading: "How typhoons are classified",
        paragraphs: [
          "PAGASA classifies tropical cyclones by their maximum sustained winds near the center: <strong>Tropical Depression</strong> (up to 61 km/h), <strong>Tropical Storm</strong> (62–88 km/h), <strong>Severe Tropical Storm</strong> (89–117 km/h), <strong>Typhoon</strong> (118–184 km/h) and <strong>Super Typhoon</strong> (185 km/h or more). The classification drives the public storm signals that follow.",
        ],
      },
    ],
  },
  {
    id: "typhoon-impacts",
    title: "Typhoon Impacts",
    tagline: "How typhoons affect communities, infrastructure, and the environment.",
    theme: "green",
    icon:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3.5L4 10v10.5h5.5V15a2.5 2.5 0 015 0v5.5H20V10L12 3.5z" fill="#fff" />' +
      '<path d="M12 10.8c-.9 0-1.6.7-1.6 1.6 0 1.1 1.6 2.6 1.6 2.6s1.6-1.5 1.6-2.6c0-.9-.7-1.6-1.6-1.6z" fill="#22c55e" />' +
      "</svg>",
    sections: [
      {
        heading: null,
        paragraphs: [
          "A typhoon's damage reaches far beyond broken roofs. Strong winds, intense rainfall, and storm surge combine to affect homes, livelihoods, and the environment — sometimes for years after the winds die down.",
        ],
      },
      {
        heading: "Wind damage",
        paragraphs: [
          "Destructive winds can tear off roofing, topple power and communication lines, and flatten crops. In coastal towns, flying debris and falling trees pose serious danger to life, which is why staying indoors away from windows matters during a signal.",
        ],
      },
      {
        heading: "Flooding and storm surge",
        paragraphs: [
          "Heavy rain swells rivers and floods low-lying barangays, while <strong>storm surge</strong> — seawater pushed ashore by the storm's winds — can inundate coastal communities within minutes. Historically, flooding has been the deadliest effect of typhoons in the Philippines.",
        ],
      },
      {
        heading: "Landslides",
        paragraphs: [
          "Saturated hillsides lose their grip. In the mountainous parts of Camarines Norte and the wider Bicol Region, landslides frequently cut off roads and bury homes near steep slopes.",
        ],
      },
      {
        heading: "Impacts on the community and environment",
        paragraphs: [
          "Schools and businesses close, power and water are interrupted, and farms can lose an entire season's harvest. After the storm, damaged mangroves and coastal erosion leave shorelines more exposed to the next typhoon — one reason restoration is part of long-term recovery.",
        ],
      },
    ],
  },
  {
    id: "before-the-storm",
    title: "Before the Storm",
    tagline: "What to do and prepare before a typhoon strikes.",
    theme: "orange",
    icon:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<rect x="5" y="4.5" width="14" height="17" rx="2.2" fill="#fff" />' +
      '<rect x="9" y="3" width="6" height="3.2" rx="1.4" fill="#fff" />' +
      '<path d="M9 12.2l1.8 1.8L15 10" stroke="#f97316" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />' +
      '<line x1="8.2" y1="17" x2="15.8" y2="17" stroke="#f97316" stroke-width="1.8" stroke-linecap="round" />' +
      "</svg>",
    sections: [
      {
        heading: null,
        paragraphs: [
          "Preparation in the calm days before landfall is what keeps families safe when the storm arrives. Use this timeline as a guide while a typhoon is still being monitored.",
        ],
      },
      {
        heading: "Stay informed early",
        paragraphs: [
          "Monitor PAGASA bulletins and official advisories as soon as a cyclone forms inside the Philippine Area of Responsibility. Know your barangay's warning channels and the location of the nearest evacuation center <em>before</em> signals are raised.",
        ],
      },
      {
        heading: "Prepare your home",
        paragraphs: [
          "Check the roof, windows, and doors for weak spots and make repairs early. Clean drainage around the house, secure or store loose items outdoors, and trim branches that could fall on the roof or power lines.",
        ],
      },
      {
        heading: "Build a go-bag",
        paragraphs: [
          "Pack enough for several days: drinking water, ready-to-eat food, a flashlight and radio with spare batteries, power bank, first-aid kit and maintenance medicines, important documents in a waterproof pouch, and some cash in small bills.",
        ],
      },
      {
        heading: "Plan with your family",
        paragraphs: [
          "Agree on where to shelter, an evacuation route, and how you will contact each other if you are separated. Assign who packs the go-bag and who checks on elderly relatives or pets — and evacuate early when your area is advised to, not when the rain has already started.",
        ],
      },
    ],
  },
  {
    id: "during-the-storm",
    title: "During the Storm",
    tagline: "Stay safe with essential reminders during severe weather.",
    theme: "purple",
    icon:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3l7 2.6v6c0 5-3 8.4-7 9.4-4-1-7-4.4-7-9.4v-6L12 3z" fill="#fff" />' +
      '<path d="M9 12l2.2 2.2L15.5 9.6" stroke="#8b5cf6" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />' +
      "</svg>",
    sections: [
      {
        heading: null,
        paragraphs: [
          "Once PAGASA raises a wind signal for your area, the priority shifts from preparing to staying safe. Keep this checklist within reach while the typhoon passes.",
        ],
      },
      {
        heading: "Stay indoors and informed",
        paragraphs: [
          "Remain inside a sturdy building away from doors and windows. Keep a battery-powered radio or charged phone on for PAGASA updates, and follow official instructions rather than rumors.",
        ],
      },
      {
        heading: "Watch for hazards inside",
        paragraphs: [
          "Unplug appliances before flooding reaches outlets, avoid touching electrical switches if you are wet or standing in water, and light the house with flashlights — never candles, which start fires when knocked over.",
        ],
      },
      {
        heading: "If you must move",
        paragraphs: [
          "If the house becomes unsafe, move to the strongest room or evacuate calmly to the nearest center. Bring your go-bag, avoid walking or driving through floodwater — as little as 15 cm of moving water can knock an adult down — and stay away from fallen power lines.",
        ],
      },
      {
        heading: "Wait for the all-clear",
        paragraphs: [
          "The <strong>eye of the storm</strong> can pass over with calm skies and clear weather, tricking people into going outside. Stay sheltered until officials announce that winds will not return and the signal has been lowered.",
        ],
      },
    ],
  },
  {
    id: "after-the-storm",
    title: "After the Storm",
    tagline: "Recovery tips and ways to help your community heal.",
    theme: "teal",
    icon:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3.5L4 10v10.5h5.5V15a2.5 2.5 0 015 0v5.5H20V10L12 3.5z" fill="#fff" />' +
      '<path d="M12 11.2c-1.5-1.6-3.8-.5-3.8 1.3 0 1.6 2 3 3.8 4.3 1.8-1.3 3.8-2.7 3.8-4.3 0-1.8-2.3-2.9-3.8-1.3z" fill="#14b8a6" />' +
      "</svg>",
    sections: [
      {
        heading: null,
        paragraphs: [
          "The danger does not end when the rain stops. Recovery is safest and fastest when it is done deliberately — checking hazards first, then working together as a community.",
        ],
      },
      {
        heading: "Check for hazards before anything else",
        paragraphs: [
          "Look outside for downed power lines, broken glass, and damaged structures before letting anyone out. Report damaged lines and gas or water leaks, and do not enter buildings that look unstable.",
        ],
      },
      {
        heading: "Stay healthy",
        paragraphs: [
          "Boil or purify drinking water if the supply may be contaminated, wash hands before handling food, and throw away food that may have spoiled. Standing water is a breeding ground for disease — drain it and watch for symptoms of leptospirosis and dengue in the days that follow.",
        ],
      },
      {
        heading: "Document and report damage",
        paragraphs: [
          "Photograph damage to your home and belongings before making temporary repairs; these records support insurance claims and barangay assistance. Report your household's condition so relief can reach everyone who needs it.",
        ],
      },
      {
        heading: "Help your community recover",
        paragraphs: [
          "Check on neighbors — especially the elderly, persons with disabilities, and families with young children. Join clean-up drives, help clear drainage, and support local recovery efforts; communities that recover together are stronger for the next storm.",
        ],
      },
    ],
  },
];
