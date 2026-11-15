# NASA imagery credits

<!-- W2-FILM START -->
## W2-FILM: experiment photographs

Retrieved and visually reviewed 2026-11-14 from NASA Image and Video Library. Photographs resized to a maximum edge of 1024 pixels, with no crop or content alteration. No logos, insignia, flags, patches or recognizable people in the selected photographs. NASA credit is a source acknowledgement, not endorsement. [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

| Investigation | File | nasa_id | NASA title | Original record | Download |
|---|---|---|---|---|---|
| PSI-10 ACME/Flame Design | media/iss059e103188.jpg | iss059e103188 | CIR / ACME / Flame Design hardware replacement | [NASA](https://images.nasa.gov/details/iss059e103188) | [Image](https://images-assets.nasa.gov/image/iss059e103188/iss059e103188~medium.jpg) |
| PSI-25 BASS-II | media/iss040e086481.jpg | iss040e086481 | BASS-II Experiment | [NASA](https://images.nasa.gov/details/iss040e086481) | [Image](https://images-assets.nasa.gov/image/iss040e086481/iss040e086481~medium.jpg) |
| PSI-25 BASS-II | media/iss040e088023.jpg | iss040e088023 | BASS-II Experiment | [NASA](https://images.nasa.gov/details/iss040e088023) | [Image](https://images-assets.nasa.gov/image/iss040e088023/iss040e088023~medium.jpg) |
| PSI-25 BASS-II | media/iss040e072900.jpg | iss040e072900 | BASS II Operations | [NASA](https://images.nasa.gov/details/iss040e072900) | [Image](https://images-assets.nasa.gov/image/iss040e072900/iss040e072900~medium.jpg) |
| PSI-26 BASS | media/iss035e015900.jpg | iss035e015900 | BASS Experiment Imagery | [NASA](https://images.nasa.gov/details/iss035e015900) | [Image](https://images-assets.nasa.gov/image/iss035e015900/iss035e015900~medium.jpg) |
| PSI-26 BASS | media/iss035e015679.jpg | iss035e015679 | BASS Experiment Imagery | [NASA](https://images.nasa.gov/details/iss035e015679) | [Image](https://images-assets.nasa.gov/image/iss035e015679/iss035e015679~medium.jpg) |
| PSI-26 BASS | media/iss035e015827.jpg | iss035e015827 | BASS Experiment Imagery | [NASA](https://images.nasa.gov/details/iss035e015827) | [Image](https://images-assets.nasa.gov/image/iss035e015827/iss035e015827~medium.jpg) |

The catalog explicitly records unavailable reviewed photographs for the other investigations. No photo from a different experiment is substituted. See `media/media.json` for provenance and checksums.
<!-- W2-FILM END -->

<!-- W2-REAL -->
## W2-REAL: scene texture and image-based light

Retrieved and visually reviewed on 2026-11-14 using the NASA Image and Video Library search API. No people, logos, insignia, flags or patches are included.

- `tex/mars.jpg`: **The Target**, nasa_id `PIA04304`. Credit: NASA/USGS. [Library record](https://images.nasa.gov/details/PIA04304); [image file](https://images-assets.nasa.gov/image/PIA04304/PIA04304~medium.jpg). Metadata retained in `tex/mars-metadata.json`.
- `tex/earth.jpg`: **Most Amazing High Definition Image of Earth - Blue Marble 2012**, nasa_id `GSFC_20171208_Archive_e001386`. Credit: NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring. [Library record](https://images.nasa.gov/details/GSFC_20171208_Archive_e001386); [image file](https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001386/GSFC_20171208_Archive_e001386~medium.jpg). Metadata retained in `tex/earth-metadata.json`.
- `tex/stars.jpg`: **Star Field in the Constellation Cepheus**, nasa_id `PIA12066`. Credit: NASA/JPL/MPS/DLR/IDA. [Library record](https://images.nasa.gov/details/PIA12066); [image file](https://images-assets.nasa.gov/image/PIA12066/PIA12066~orig.jpg). Metadata retained in `tex/stars-metadata.json`.

Mars is the Viking image/mosaic published by NASA/USGS; Earth is the 2012 Suomi NPP/VIIRS composite, not a live camera. The photographed hemispheres are cropped at load and projected onto round geometry, rather than invented back-side cartography. Rotation is restricted to a small in-plane drift. Cepheus is Dawn framing-camera imagery, a composite of two 600-second exposures acquired on 2007-12-03. It is dimmed and repeated as scenic sky texture, not an astrometric all-sky reconstruction.

Mars, Earth and the dim Cepheus plate also illuminate a PMREM lightbox alongside neutral practical strip lights; the reflected light is an artistic reconstruction, not measured cabin illumination. The flame and smoke are original shader illustrations, not NASA photographs or a combustion simulation.
<!-- /W2-REAL -->

<!-- W3-PHOTO START -->
## W3-PHOTO: physical candle comparison plate

- `tex/candle-pair.jpg`: **Candle in normal gravity and microgravity**, nasa_id `GRC-1998-C-00485`. Credit: **NASA Glenn Research Center**. [NASA library record](https://images.nasa.gov/details/GRC-1998-C-00485), [download](https://images-assets.nasa.gov/image/GRC-1998-C-00485/GRC-1998-C-00485~medium.jpg). The library dates the record 2004-05-01; that metadata date is not asserted as the exposure date. Original 1280×1024 image cropped to pixel rectangle [64,64,1216,960], preserving both photographs and their separator, removing all white margins, NASA insignia and center-name imprint. No colour, flame or photographic-content modification. Metadata retained in `tex/candle-pair-metadata.json`. Retrieved by W2-REAL and visually reviewed/cropped on 2026-11-14. The physical plate and enlarged on-demand panel identify it as NASA's photograph; the adjacent rendered candle remains explicitly an illustration of low-momentum observations, not a simulation. No NASA endorsement is implied.
<!-- W3-PHOTO END -->
