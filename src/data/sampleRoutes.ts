export interface SampleRoute {
  id: string;
  title: string;
  region: string;
  badge: string;
  category: 'Alpine' | 'Coastal' | 'Mountain Peak' | 'Cycling';
  gpxXml: string;
}

export const SAMPLE_ROUTES: SampleRoute[] = [
  {
    id: 'grossglockner',
    title: 'Grossglockner High Alpine Pass',
    region: 'Hohe Tauern, Austrian Alps',
    badge: 'ALPS EXPEDITION',
    category: 'Alpine',
    gpxXml: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOCT GPX Map Studio">
  <metadata>
    <name>GROSSGLOCKNER HIGH ALPINE PASS</name>
    <desc>Epic 38km alpine ascent through Austrian Alps with 1,800m elevation gain</desc>
  </metadata>
  <wpt lat="47.1683" lon="12.8256">
    <name>Ferleiten Toll Station</name>
    <ele>1145</ele>
    <desc>Start of the high alpine pass road, wildlife park and alpine inn.</desc>
    <link href="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="47.1278" lon="12.8319">
    <name>Edelweißspitze Summit View</name>
    <ele>2571</ele>
    <desc>Highest paved viewpoint with 360-degree panorama of thirty 3,000-meter peaks.</desc>
    <link href="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="47.1147" lon="12.8269">
    <name>Fuscher Törl Memorial</name>
    <ele>2428</ele>
    <desc>Architectural landmark chapel honoring road workers, opening south towards Glockner.</desc>
    <link href="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="47.0758" lon="12.7514">
    <name>Kaiser-Franz-Josefs-Höhe</name>
    <ele>2369</ele>
    <desc>Spectacular overlook directly facing the Grossglockner summit and Pasterze glacier tongue.</desc>
    <link href="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="47.0425" lon="12.8427">
    <name>Heiligenblut Gothic Village</name>
    <ele>1301</ele>
    <desc>Historic pilgrimage church of St. Vincent set against towering alpine needles.</desc>
    <link href="https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <trk>
    <name>GROSSGLOCKNER HIGH ALPINE PASS</name>
    <trkseg>
      <trkpt lat="47.1683" lon="12.8256"><ele>1145</ele><time>2026-10-24T06:00:00Z</time></trkpt>
      <trkpt lat="47.1620" lon="12.8220"><ele>1210</ele><time>2026-10-24T06:12:00Z</time></trkpt>
      <trkpt lat="47.1550" lon="12.8180"><ele>1320</ele><time>2026-10-24T06:25:00Z</time></trkpt>
      <trkpt lat="47.1490" lon="12.8205"><ele>1450</ele><time>2026-10-24T06:40:00Z</time></trkpt>
      <trkpt lat="47.1430" lon="12.8240"><ele>1590</ele><time>2026-10-24T06:55:00Z</time></trkpt>
      <trkpt lat="47.1390" lon="12.8190"><ele>1740</ele><time>2026-10-24T07:15:00Z</time></trkpt>
      <trkpt lat="47.1350" lon="12.8270"><ele>1910</ele><time>2026-10-24T07:35:00Z</time></trkpt>
      <trkpt lat="47.1310" lon="12.8210"><ele>2100</ele><time>2026-10-24T07:55:00Z</time></trkpt>
      <trkpt lat="47.1278" lon="12.8319"><ele>2571</ele><time>2026-10-24T08:25:00Z</time></trkpt>
      <trkpt lat="47.1220" lon="12.8290"><ele>2480</ele><time>2026-10-24T08:40:00Z</time></trkpt>
      <trkpt lat="47.1147" lon="12.8269"><ele>2428</ele><time>2026-10-24T08:55:00Z</time></trkpt>
      <trkpt lat="47.1080" lon="12.8210"><ele>2320</ele><time>2026-10-24T09:15:00Z</time></trkpt>
      <trkpt lat="47.0990" lon="12.8120"><ele>2240</ele><time>2026-10-24T09:35:00Z</time></trkpt>
      <trkpt lat="47.0910" lon="12.7950"><ele>2200</ele><time>2026-10-24T09:55:00Z</time></trkpt>
      <trkpt lat="47.0850" lon="12.7750"><ele>2280</ele><time>2026-10-24T10:15:00Z</time></trkpt>
      <trkpt lat="47.0758" lon="12.7514"><ele>2369</ele><time>2026-10-24T10:45:00Z</time></trkpt>
      <trkpt lat="47.0710" lon="12.7700"><ele>2180</ele><time>2026-10-24T11:10:00Z</time></trkpt>
      <trkpt lat="47.0650" lon="12.8020"><ele>1980</ele><time>2026-10-24T11:35:00Z</time></trkpt>
      <trkpt lat="47.0580" lon="12.8230"><ele>1750</ele><time>2026-10-24T12:00:00Z</time></trkpt>
      <trkpt lat="47.0500" lon="12.8360"><ele>1520</ele><time>2026-10-24T12:20:00Z</time></trkpt>
      <trkpt lat="47.0425" lon="12.8427"><ele>1301</ele><time>2026-10-24T12:45:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
  },
  {
    id: 'big-sur',
    title: 'Big Sur Pacific Coast Highway',
    region: 'California Coastline, USA',
    badge: 'COASTAL EXPEDITION',
    category: 'Coastal',
    gpxXml: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOCT GPX Map Studio">
  <metadata>
    <name>BIG SUR PACIFIC COAST HIGHWAY</name>
    <desc>Scenic California coastal drive hugging dramatic cliffs and crashing Pacific waves</desc>
  </metadata>
  <wpt lat="36.5204" lon="-121.9424">
    <name>Point Lobos Reserve</name>
    <ele>45</ele>
    <desc>Crown jewel of California state parks with sea otters, kelp groves and granite headlands.</desc>
    <link href="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="36.3714" lon="-121.9018">
    <name>Bixby Creek Bridge</name>
    <ele>82</ele>
    <desc>One of the tallest single-span concrete bridges in the world, towering over Bixby Canyon.</desc>
    <link href="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="36.2734" lon="-121.8485">
    <name>Pfeiffer Beach Arch</name>
    <ele>12</ele>
    <desc>Famous purple garnet sands and natural Keyhole Rock carved by Pacific swells.</desc>
    <link href="https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="36.1585" lon="-121.6708">
    <name>McWay Falls Tidefall</name>
    <ele>38</ele>
    <desc>Ethereal 24-meter waterfall plunging directly onto pristine turquoise coastal sands.</desc>
    <link href="https://images.unsplash.com/photo-1505144808419-1957a94ca45b?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <trk>
    <name>BIG SUR PACIFIC COAST HIGHWAY</name>
    <trkseg>
      <trkpt lat="36.5204" lon="-121.9424"><ele>45</ele><time>2026-10-24T09:00:00Z</time></trkpt>
      <trkpt lat="36.4850" lon="-121.9320"><ele>62</ele><time>2026-10-24T09:18:00Z</time></trkpt>
      <trkpt lat="36.4520" lon="-121.9210"><ele>95</ele><time>2026-10-24T09:35:00Z</time></trkpt>
      <trkpt lat="36.4150" lon="-121.9120"><ele>112</ele><time>2026-10-24T09:52:00Z</time></trkpt>
      <trkpt lat="36.3714" lon="-121.9018"><ele>82</ele><time>2026-10-24T10:15:00Z</time></trkpt>
      <trkpt lat="36.3420" lon="-121.8880"><ele>145</ele><time>2026-10-24T10:35:00Z</time></trkpt>
      <trkpt lat="36.3050" lon="-121.8650"><ele>160</ele><time>2026-10-24T10:55:00Z</time></trkpt>
      <trkpt lat="36.2734" lon="-121.8485"><ele>70</ele><time>2026-10-24T11:15:00Z</time></trkpt>
      <trkpt lat="36.2420" lon="-121.8120"><ele>185</ele><time>2026-10-24T11:40:00Z</time></trkpt>
      <trkpt lat="36.2050" lon="-121.7580"><ele>140</ele><time>2026-10-24T12:05:00Z</time></trkpt>
      <trkpt lat="36.1750" lon="-121.7050"><ele>95</ele><time>2026-10-24T12:28:00Z</time></trkpt>
      <trkpt lat="36.1585" lon="-121.6708"><ele>38</ele><time>2026-10-24T12:50:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
  },
  {
    id: 'mount-fuji',
    title: 'Mount Fuji Yoshida Ridge Ascent',
    region: 'Honshu Island, Japan',
    badge: 'SUMMIT RIDGE',
    category: 'Mountain Peak',
    gpxXml: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOCT GPX Map Studio">
  <metadata>
    <name>MOUNT FUJI YOSHIDA ASCENT</name>
    <desc>Pilgrimage ascent from the 5th Station through volcanic switchbacks to the crater rim</desc>
  </metadata>
  <wpt lat="35.3908" lon="138.7326">
    <name>Fuji 5th Station Base</name>
    <ele>2305</ele>
    <desc>Gateway bus terminal and shrine where hikers acclimatize before the night climb.</desc>
    <link href="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="35.3785" lon="138.7368">
    <name>7th Station Torii Gate</name>
    <ele>2700</ele>
    <desc>Beginning of rocky lava scramble and first mountain huts offering branded wooden walking sticks.</desc>
    <link href="https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="35.3672" lon="138.7335">
    <name>8.5th Station Ghoraikokan</name>
    <ele>3450</ele>
    <desc>High ridge perch offering shelter above cloud seas before the final pre-dawn summit push.</desc>
    <link href="https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="35.3606" lon="138.7274">
    <name>Kusushi Summit Shrine</name>
    <ele>3776</ele>
    <desc>Japan's rooftop crater rim. Sacred torii shrine facing the crimson rising sun (Goraiko).</desc>
    <link href="https://images.unsplash.com/photo-1528164344705-475426879c0d?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <trk>
    <name>MOUNT FUJI YOSHIDA ASCENT</name>
    <trkseg>
      <trkpt lat="35.3908" lon="138.7326"><ele>2305</ele><time>2026-10-24T20:00:00Z</time></trkpt>
      <trkpt lat="35.3870" lon="138.7350"><ele>2410</ele><time>2026-10-24T20:30:00Z</time></trkpt>
      <trkpt lat="35.3830" lon="138.7362"><ele>2550</ele><time>2026-10-24T21:10:00Z</time></trkpt>
      <trkpt lat="35.3785" lon="138.7368"><ele>2700</ele><time>2026-10-24T22:00:00Z</time></trkpt>
      <trkpt lat="35.3745" lon="138.7355"><ele>2920</ele><time>2026-10-24T23:00:00Z</time></trkpt>
      <trkpt lat="35.3710" lon="138.7345"><ele>3100</ele><time>2026-10-25T00:15:00Z</time></trkpt>
      <trkpt lat="35.3672" lon="138.7335"><ele>3450</ele><time>2026-10-25T02:00:00Z</time></trkpt>
      <trkpt lat="35.3640" lon="138.7310"><ele>3620</ele><time>2026-10-25T03:30:00Z</time></trkpt>
      <trkpt lat="35.3606" lon="138.7274"><ele>3776</ele><time>2026-10-25T04:45:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
  },
  {
    id: 'sa-calobra',
    title: 'Sa Calobra Serpentine Pass',
    region: 'Mallorca, Balearic Islands',
    badge: 'CYCLING ICON',
    category: 'Cycling',
    gpxXml: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LOCT GPX Map Studio">
  <metadata>
    <name>SA CALOBRA SERPENTINE PASS</name>
    <desc>Legendary 26 hairpin descent engineered by Antonio Parietti featuring the 270-degree Tie Knot</desc>
  </metadata>
  <wpt lat="39.8322" lon="2.8251">
    <name>Coll dels Reis Pass</name>
    <ele>682</ele>
    <desc>Summit crest between twin peaks opening directly towards the azure Mediterranean abyss.</desc>
    <link href="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="39.8398" lon="2.8184">
    <name>Nus de Sa Corbata (Tie Knot)</name>
    <ele>550</ele>
    <desc>Iconic architectural loop where the mountain road loops 270 degrees underneath itself.</desc>
    <link href="https://images.unsplash.com/photo-1502759683299-cdcd1a708232?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <wpt lat="39.8510" lon="2.7985">
    <name>Sa Calobra Port &amp; Cove</name>
    <ele>4</ele>
    <desc>Secluded Mediterranean fishing cove tucked between sheer limestone gorge canyons.</desc>
    <link href="https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&amp;auto=format&amp;fit=crop&amp;q=80"/>
  </wpt>
  <trk>
    <name>SA CALOBRA SERPENTINE PASS</name>
    <trkseg>
      <trkpt lat="39.8322" lon="2.8251"><ele>682</ele><time>2026-10-24T14:00:00Z</time></trkpt>
      <trkpt lat="39.8340" lon="2.8220"><ele>640</ele><time>2026-10-24T14:08:00Z</time></trkpt>
      <trkpt lat="39.8370" lon="2.8200"><ele>600</ele><time>2026-10-24T14:16:00Z</time></trkpt>
      <trkpt lat="39.8398" lon="2.8184"><ele>550</ele><time>2026-10-24T14:25:00Z</time></trkpt>
      <trkpt lat="39.8420" lon="2.8150"><ele>480</ele><time>2026-10-24T14:35:00Z</time></trkpt>
      <trkpt lat="39.8450" lon="2.8110"><ele>390</ele><time>2026-10-24T14:48:00Z</time></trkpt>
      <trkpt lat="39.8475" lon="2.8060"><ele>260</ele><time>2026-10-24T15:02:00Z</time></trkpt>
      <trkpt lat="39.8490" lon="2.8020"><ele>120</ele><time>2026-10-24T15:18:00Z</time></trkpt>
      <trkpt lat="39.8510" lon="2.7985"><ele>4</ele><time>2026-10-24T15:35:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
  }
];
