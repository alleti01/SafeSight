# SafeSight

Finds things in a home that may be risky or confusing for a person with dementia, based on the Alzheimer's Society guide *Making your home dementia friendly*.

Built at BananaHacks 2026.

## Credits

### Guide

- Hazards, wording and fixes follow the Alzheimer's Society guide [*Making your home dementia friendly*](https://www.alzheimers.org.uk/sites/default/files/migrate/downloads/making_your_home_dementia_friendly.pdf).

### Models

- [YOLO-World v2](https://docs.ultralytics.com/models/yolo-world/) (`yolov8s-worldv2`, via Ultralytics, AGPL-3.0): the starting object detector in `backend/detector.py`, used until Abhi's fine-tuned model is in place. Its text prompts use OpenAI's [CLIP](https://github.com/openai/CLIP) (MIT), from [Ultralytics' fork](https://github.com/ultralytics/CLIP).
- [YOLO11](https://docs.ultralytics.com/models/yolo11/) segmentation (`yolo11n-seg`, Ultralytics, AGPL-3.0, trained on COCO): finds people so they can be blurred before anything is saved (`backend/blur.py`).
- [SAM 2.1](https://github.com/facebookresearch/sam2) tiny (Meta, Apache-2.0, loaded through Ultralytics): traces each object's outline for the contrast checks (`backend/contrast.py`).
- Abhi's fine-tuned detector, its training data and results: see `model/`.

### Libraries

- App: [Next.js](https://nextjs.org), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Motion](https://motion.dev), [clsx](https://github.com/lukeed/clsx), [tailwind-merge](https://github.com/dcastil/tailwind-merge), [TypeScript](https://www.typescriptlang.org), [Vitest](https://vitest.dev) and [ESLint](https://eslint.org).
- Backend: [FastAPI](https://fastapi.tiangolo.com), [Uvicorn](https://www.uvicorn.org), [Ultralytics](https://github.com/ultralytics/ultralytics), [OpenCV](https://opencv.org), [NumPy](https://numpy.org), [Pillow](https://python-pillow.org), [pillow-heif](https://github.com/bigcat88/pillow_heif) (iPhone photos), [python-multipart](https://github.com/Kludex/python-multipart), [pytest](https://pytest.org) and [HTTPX](https://www.python-httpx.org).
- [Fancy Components](https://www.fancycomponents.dev) by Daniel Petho (MIT): Vertical Cut Reveal and Text Rotate, via [21st.dev](https://21st.dev). The text highlight in `app/src/components/ui/text-highlight.tsx` is modeled on its Text Highlighter.
- [Magic UI](https://magicui.design) (MIT): the scroll fade in `app/src/components/ui/blur-fade.tsx` is modeled on its Blur Fade.

### Fonts

- [Geist](https://vercel.com/font) (Vercel) and [Inter](https://rsms.me/inter/) (Rasmus Andersson), both SIL Open Font License, through Google Fonts. The earlier designs kept at `/v1` to `/v4` also use Manrope, Atkinson Hyperlegible, Newsreader and IBM Plex Mono (all SIL Open Font License).

### Images

- Website photos are from [Unsplash](https://unsplash.com) (Unsplash License), loaded from Unsplash and never stored in this repo: Clay Banks, Point3D Commercial Imaging Ltd., Lisa Anna, Alex Tyson, Abdul Kayum, David Marquez, avechenri, Brina Blum, Franco Debartolo, CDC, Jakub Żerdzicki and Centre for Ageing Better. Links to each photo are in `backend/tools/stock_photos.py`. The hazards and outlines drawn on them are our pipeline's real output (`backend/tools/annotate_site_images.py`); the findings shown were checked by us, since the starting model also makes mistakes.
- The example living room on the home page (`app/public/site/room-wide.jpg`) is AI-generated with OpenAI's GPT-6 Astra, from a prompt we wrote; the findings on it are our pipeline's real output, checked by us.
- Store logos in the "Where to buy" section (`app/public/site/stores/`) are from [Wikimedia Commons](https://commons.wikimedia.org) and shown in black and white. They are trademarks of their owners; SafeSight isn't affiliated with any of these stores. All are public domain on Commons except the Menards logo, [Menards Stripe Logo.svg](https://commons.wikimedia.org/wiki/File:Menards_Stripe_Logo.svg) by Mrpeters33, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) (shown in black and white). Sources: [Walmart](https://commons.wikimedia.org/wiki/File:Walmart_logo_(2025).svg), [Target](https://commons.wikimedia.org/wiki/File:Target_logo.svg), [Amazon](https://commons.wikimedia.org/wiki/File:Amazon_logo.svg), [The Home Depot](https://commons.wikimedia.org/wiki/File:The_Home_Depot_logo.svg), [Lowe's](https://commons.wikimedia.org/wiki/File:Lowes_Companies_Logo.svg), [IKEA](https://commons.wikimedia.org/wiki/File:Ikea_logo.svg), [Wayfair](https://commons.wikimedia.org/wiki/File:Wayfair_logo.svg), [Costco](https://commons.wikimedia.org/wiki/File:Costco_Wholesale_logo_2010-10-26.svg), [Ace Hardware](https://commons.wikimedia.org/wiki/File:Ace_Hardware_Logo.svg), [Kohl's](https://commons.wikimedia.org/wiki/File:Kohl%27s_logo.svg), [Dollar General](https://commons.wikimedia.org/wiki/File:Dollar_General_logo.svg).
- An earlier version of the site used images generated with [Stable Diffusion XL 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) (`backend/tools/generate_site_images.py`).

### AI tools

- [Claude Code](https://claude.com/claude-code) (Anthropic) with Claude Opus 5.5 helped write the app and backend code, tests and site wording, and researched design references; commits it helped with say so. Some of Abhi's commits were written with Claude Fable 5.1.
- OpenAI's GPT-6 Astra generated the example living room (above).
